// Unit tests for Reset / Home: toolbar control, shortcut H, and resetView behavior.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

await t("Reset sits in the main toolbar with a tooltip and an H shortcut, not over the Playback bar", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const header = html.slice(html.indexOf('<header class="topbar"'), html.indexOf("</header>"));
  const ess = header.slice(header.indexOf('id="toolsEssential"'), header.indexOf('id="tools"'));
  assert.match(ess, /id="btnReset"/);
  assert.match(ess, /title="Reset to the default globe \(H\)"/);
  assert.match(ess, /aria-keyshortcuts="h"/);
  const transportAt = html.indexOf('id="transportBar"');
  const resetAt = header.indexOf('id="btnReset"');
  assert.ok(resetAt >= 0 && transportAt > resetAt, "Reset is in the top bar, not in the Playback bar");
  assert.match(html, /js\/reset-view\.js/);
  const ui = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");
  assert.match(ui, /e\.key === "h" \|\| e\.key === "H"/);
  assert.doesNotMatch(ui, /Escape[\s\S]{0,80}resetView/, "Escape is left for dialogs and drawers, not Reset");
});

await t("resetView clears selection, closes info and inspector, stops playback, and flies home without touching layers or desks", () => {
  const ctx = { console, window: { GD: {} }, document: { getElementById: (id) => ctx._els[id] || null } };
  ctx.window.window = ctx.window;
  ctx.window.document = ctx.document;
  ctx.globalThis = ctx;
  ctx.document.defaultView = ctx.window;
  ctx._els = { gdFull: { hidden: false } };
  const flights = [];
  const layers = { countries: true, pins: true };
  const desks = [{ id: "sample-civic-desk", label: "Sample Civic Desk" }];
  const catalog = { items: ["sample-item"] };
  let inspectorVisible = true;
  const newsdesk = { state: { selectedId: "story-nd-chicago-river-reversal" }, selectTopic(id, opts) { this.state.selectedId = id; this.lastOpts = opts; } };
  ctx.window.GD = {
    state: { playing: true, paused: false, episode: { stories: [{ id: "s1", highlight: { a3: "EGY" } }] }, forcedCards: ["s1"], storyIdx: 0 },
    playback: { pause() { ctx.window.GD.state.playing = false; ctx.window.GD.state.paused = true; this.paused = true; } },
    mapPointer: { sel: { kind: "pin", storyIdx: 0 }, stopMotion() { this.stopped = true; }, clearSelection() { this.sel = null; } },
    newsdesk,
    callouts: { open: ["s1"], clear() { this.open = []; } },
    research: { open: true, isOpen() { return this.open; }, close() { this.open = false; } },
    layout: { setPanelVisible(id, on) { if (id === "inspector") inspectorVisible = !!on; } },
    globe: {
      HOME_VIEW: { center: [40, 28], zoom: 1.6, pitch: 0, bearing: 0 },
      st: { active: 0, map: {} },
      setEpisode(ep, idx) { this.st.active = idx; this.ep = ep; },
      flyTo(kf) { flights.push(kf); }
    },
    ui: { overlays: 1, rundown: 1, renderOverlays() { this.overlays++; }, renderRundown() { this.rundown++; } },
    layers: { snapshot: layers },
    outbound: { targets: desks },
    catalog: { items: catalog.items }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "js", "reset-view.js"), "utf8"), ctx);
  const result = ctx.window.GD.resetView();
  assert.equal(result.ok, true);
  assert.equal(ctx.window.GD.state.playing, false);
  assert.equal(ctx.window.GD.mapPointer.sel, null);
  assert.equal(ctx.window.GD.mapPointer.stopped, true);
  assert.equal(newsdesk.state.selectedId, null);
  assert.equal(newsdesk.lastOpts.silent, true);
  assert.equal(ctx.window.GD.callouts.open.length, 0);
  assert.equal(ctx.window.GD.state.forcedCards.length, 0);
  assert.equal(ctx._els.gdFull.hidden, true);
  assert.equal(ctx.window.GD.research.open, false);
  assert.equal(inspectorVisible, false);
  assert.equal(ctx.window.GD.globe.st.active, -1);
  assert.equal(flights.length, 1);
  assert.deepEqual(flights[0].center, [40, 28]);
  assert.equal(flights[0].zoom, 1.6);
  assert.equal(flights[0].pitch, 0);
  assert.equal(flights[0].bearing, 0);
  assert.deepEqual(layers, { countries: true, pins: true });
  assert.deepEqual(desks, [{ id: "sample-civic-desk", label: "Sample Civic Desk" }]);
  assert.deepEqual(catalog.items, ["sample-item"]);
  assert.equal(ctx.window.GD.state.episode.stories[0].highlight.a3, "EGY");
});

await t("the default globe view is the same Home used by the globe", () => {
  const src = fs.readFileSync(path.join(root, "js", "globe.js"), "utf8");
  assert.match(src, /const HOME_VIEW = \{ center: \[40, 28\], zoom: 1\.6, pitch: 0, bearing: 0 \}/);
  const reset = fs.readFileSync(path.join(root, "js", "reset-view.js"), "utf8");
  assert.match(reset, /center: \[40, 28\], zoom: 1\.6, pitch: 0, bearing: 0/);
});

console.log(n + " reset tests ok");
