// Unit tests for the shell layout (templates, lock, clamp, menu markup, CSP).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { console, window: { GD: {}, innerWidth: 1024, innerHeight: 768 } };
ctx.window.window = ctx.window;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js", "layout.js"), "utf8"), ctx);
const layout = ctx.window.GD.layout;
assert.ok(layout, "GD.layout should load without a document");

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

await t("four named templates exist and Edit is the default", () => {
  assert.equal(JSON.stringify(Array.from(layout.TEMPLATES)), JSON.stringify(["edit","present","research","compact"]));
  const st = layout.defaultState("edit");
  assert.equal(st.template, "edit");
  assert.equal(st.panels.inspector.dock, "right");
  assert.equal(st.panels.inspector.visible, true);
  assert.equal(st.panels.rundown.dock, "left");
  assert.equal(st.panels.bin.visible, true);
  assert.equal(st.newsW, 0);
  assert.equal(st.docks.right, 360);
  assert.equal(st.lockAll, false);
});

await t("Present hides editor panels and keeps the playback bar", () => {
  const st = layout.defaultState("present");
  assert.equal(st.panels.inspector.visible, false);
  assert.equal(st.panels.rundown.visible, false);
  assert.equal(st.panels.bin.visible, false);
  assert.equal(st.panels.readable.visible, false);
  assert.equal(st.panels.transport.visible, true);
  assert.equal(st.docks.left, 0);
  assert.equal(st.docks.right, 0);
});

await t("Research brings the news desk forward and keeps the Inspector", () => {
  const st = layout.defaultState("research");
  assert.ok(st.newsW >= 300);
  assert.equal(st.panels.inspector.visible, true);
  assert.equal(st.panels.rundown.visible, false);
  assert.equal(st.panels.bin.visible, false);
  assert.equal(st.panels.readable.visible, false);
  assert.equal(st.panels.transport.visible, true);
});

await t("Compact uses narrower docks for a laptop-width window", () => {
  const st = layout.defaultState("compact");
  assert.ok(st.docks.left <= 220);
  assert.ok(st.docks.right <= 300);
  assert.equal(st.panels.inspector.visible, true);
  assert.equal(st.panels.readable.visible, false);
});

await t("locked and lock-all panels cannot be dragged or resized", () => {
  const st = layout.defaultState("edit");
  assert.equal(layout.canDrag("inspector", st), true);
  assert.equal(layout.canResize("inspector", st), true);
  st.panels.inspector.locked = true;
  assert.equal(layout.canDrag("inspector", st), false);
  assert.equal(layout.canResize("inspector", st), false);
  st.panels.inspector.locked = false;
  st.lockAll = true;
  assert.equal(layout.canDrag("rundown", st), false);
  assert.equal(layout.canDrag("inspector", st), false);
});

await t("clamp keeps docks and floats inside a resized viewport", () => {
  const st = layout.defaultState("edit");
  st.docks.left = 500;
  st.docks.right = 500;
  st.newsW = 0;
  layout.clampState(st, 1024, 768);
  assert.ok(st.docks.left + st.docks.right <= 1024 - 280, "stage keeps a minimum width");
  st.panels.inspector.dock = "float";
  st.panels.inspector.x = 4000;
  st.panels.inspector.y = 4000;
  st.panels.inspector.w = 9000;
  st.panels.inspector.h = 9000;
  layout.clampState(st, 1024, 768);
  assert.ok(st.panels.inspector.x <= 1024 - 48);
  assert.ok(st.panels.inspector.y <= 768 - 36);
  assert.ok(st.panels.inspector.y >= 52);
  assert.ok(st.panels.inspector.w <= 1024);
  assert.ok(st.panels.inspector.h <= 768);
  st.panels.inspector.scale = 9;
  layout.clampState(st, 1024, 768);
  assert.equal(st.panels.inspector.scale, 1.4);
});

await t("the hamburger sits beside the title and overflow tools are not in the essential bar", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const header = html.slice(html.indexOf('<header class="topbar"'), html.indexOf("</header>"));
  assert.match(header, /id="btnMenu"/);
  const menuAt = header.indexOf('id="btnMenu"');
  const brandAt = header.indexOf("brand-name");
  assert.ok(menuAt >= 0 && brandAt > menuAt, "menu button is to the left of the GlobeDesk title");
  assert.match(header, /aria-controls="appMenu"/);
  assert.match(header, /id="toolsEssential"/);
  const ess = header.slice(header.indexOf('id="toolsEssential"'), header.indexOf('id="tools"'));
  assert.match(ess, /id="asp169"/);
  assert.match(ess, /id="asp916"/);
  assert.match(ess, /id="btnReset"/);
  assert.match(ess, /id="btnRecord"/);
  assert.match(ess, /id="btnViewToggle"/);
  assert.doesNotMatch(ess, /id="btnArchive"/);
  assert.doesNotMatch(ess, /id="btnSave"/);
  assert.match(html, /id="appMenu"/);
  assert.match(html, /id="appMenuSearch"/);
  assert.match(html, /js\/layout\.js/);
  assert.match(html, /id="dockLeft"/);
  assert.match(html, /id="dockRight"/);
  assert.match(html, /id="transportBar"/);
});

await t("the static CSP matches the approved host list", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const cspMeta = html.match(/Content-Security-Policy" content="([^"]+)"/);
  assert.ok(cspMeta, "CSP meta is present");
  const policy = cspMeta[1];
  const allow = ["api.maptiler.com", "basemap.nationalmap.gov", "gibs.earthdata.nasa.gov", "hydro.nationalmap.gov", "mrdata.usgs.gov", "nowcoast.noaa.gov", "photon.komoot.io", "s3.amazonaws.com", "tigerweb.geo.census.gov", "tiles.maps.eox.at", "tiles.openfreemap.org", "www.youtube-nocookie.com"];
  const got = [...new Set([...policy.matchAll(/https:\/\/([^/\s;"']+)/g)].map((m) => m[1].split("/")[0]))].sort();
  assert.equal(JSON.stringify(got), JSON.stringify(allow));
});


await t("map attribution is compact and the app does not force it open", () => {
  const globe = fs.readFileSync(path.join(root, "js", "globe.js"), "utf8");
  const ui = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");
  assert.match(globe, /attributionControl:\s*\{\s*compact:\s*true/);
  assert.match(ui, /classList\.add\([\"']maplibregl-compact[\"']\)/);
  assert.match(ui, /classList\.remove\([\"']maplibregl-compact-show[\"']\)/);
  assert.equal(ui.includes("classList.remove(\"maplibregl-compact\")"), false);
  assert.equal(ui.includes("classList.add(\"maplibregl-compact-show\")"), false);
  assert.match(globe, /gd-pan-ctrl/);
  assert.match(globe, /gd-pan-cell/);
});

await t("panel scale is a compact header control, not a always-visible slider", () => {
  const js = fs.readFileSync(path.join(root, "js", "layout.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "css", "app.css"), "utf8");
  assert.match(js, /gd-panel-scale-btn/);
  assert.match(js, /gd-panel-scale-pop/);
  assert.match(css, /gd-panel-scale-pop/);
  assert.equal(css.includes("#transportBar:not(.is-floating) .gd-panel-zoom { display: none; }"), false);
});

await t("floating panels stay fully on screen after clamp", () => {
  const st = layout.defaultState("edit");
  st.panels.inspector.dock = "float";
  st.panels.inspector.x = 80;
  st.panels.inspector.w = 2000;
  st.panels.inspector.y = 700;
  st.panels.inspector.h = 500;
  layout.clampState(st, 1024, 768);
  assert.ok(st.panels.inspector.x >= 0);
  assert.ok(st.panels.inspector.y >= 52);
  assert.ok(st.panels.inspector.x + st.panels.inspector.w <= 1024 + 0.5, "float must not run past the right edge");
  assert.ok(st.panels.inspector.y + st.panels.inspector.h <= 768 + 0.5, "float must not run past the bottom edge");
});

await t("the playback bar cannot stay floating; it returns to the bottom dock", () => {
  assert.equal(layout.dockAfterMove("transport", "float"), "bottom");
  assert.equal(layout.dockAfterMove("transport", "bottom"), "bottom");
  assert.equal(layout.dockAfterMove("transport", "left"), "left");
  assert.equal(layout.dockAfterMove("inspector", "float"), "float");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /id="transportBar"[^>]*aria-label="Playback"/);
});

console.log("\n" + n + " tests passed");
