// recreateMap() must always finish and clear st.recreating, even when the new map never fires "load"
// or reports a style error, so Event Layers resume and the next rebuild works. Also: a throw in
// setEpisode during the rebuild still clears the pause.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

// Map stub: behaviour per instance is picked by the next entry of `plan` ("never", "load", "error", "tile-error").
const plan = [];
const made = [];
function StubMap() {
  const h = {};
  const mode = plan.shift() || "load";
  const m = {
    mode, removed: false,
    on(ev, f) { (h[ev] = h[ev] || []).push(f); return m; },
    once(ev, f) { const g = (e) => { m.off(ev, g); f(e); }; return m.on(ev, g); },
    off(ev, f) { h[ev] = (h[ev] || []).filter((x) => x !== f); return m; },
    fire(ev, e) { (h[ev] || []).slice().forEach((f) => f(e)); },
    addControl() {}, loaded: () => false, isStyleLoaded: () => false,
    remove() { m.removed = true; }, jumpTo() {}, getCenter: () => ({ lng: 0, lat: 0 }), getZoom: () => 1, getPitch: () => 0, getBearing: () => 0, getCanvas: () => ({ getContext: () => null }),
    getSource: (id) => (mode === "load-throw" && id === "gd-pins" ? { setData() { throw new Error("bad episode"); } } : null), getLayer: () => null
  };
  made.push(m);
  setTimeout(() => {
    if (mode === "load" || mode === "load-throw") m.fire("load", {});
    if (mode === "error") m.fire("error", { error: new Error("style failed") });
    if (mode === "tile-error") { m.fire("error", { tile: {}, sourceId: "sat", error: new Error("tile 404") }); setTimeout(() => m.fire("load", {}), 20); }
  }, 10);
  return m;
}
const ctx = { window: {}, console, Date, setTimeout, clearTimeout, Promise, addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 };
ctx.window = ctx; ctx.GD = { layers: { base: () => ({ kind: "local" }) } }; ctx.window.GD = ctx.GD;
ctx.maplibregl = { Map: StubMap, Marker: function () {}, NavigationControl: function () {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js", "globe.js"), "utf8"), ctx);
const globe = ctx.window.GD.globe;
globe.st.container = {};
globe.st.recreateTimeoutMs = 80;

await t("a map that never loads: recreateMap resolves on the timeout and clears st.recreating", async () => {
  plan.push("never");
  const p = globe.prepareForExport();
  assert.ok(globe.st.recreating, "paused while rebuilding");
  assert.equal(await p, "timeout");
  assert.equal(globe.st.recreating, null);
  assert.equal(globe.st.recreateOutcome, "timeout");
});
await t("the next rebuild after a stuck one still works (new map, resolves on load)", async () => {
  plan.push("load");
  const before = made.length;
  assert.equal(await globe.endExport(), "load");
  assert.equal(made.length, before + 1, "a new map was built, not the old promise reused");
  assert.equal(globe.st.recreating, null);
});
await t("a style-level error ends the wait; tile errors do not", async () => {
  plan.push("error");
  assert.equal(await globe.prepareForExport(), "error");
  assert.equal(globe.st.recreating, null);
  plan.push("tile-error");
  assert.equal(await globe.endExport(), "load");
});
await t("a throw in setEpisode during the rebuild rejects but still clears the pause", async () => {
  globe.st.episode = { stories: [] };
  plan.push("load-throw");
  let err = null;
  try { await globe.prepareForExport(); } catch (e) { err = e; }
  assert.ok(err && /bad episode/.test(err.message), "error surfaces: " + (err && err.message));
  assert.equal(globe.st.recreating, null);
  globe.st.episode = null;
  plan.push("load");
  assert.equal(await globe.endExport(), "load", "and the next rebuild works");
});
await t("Event Layers skip frames only while st.recreating is set", () => {
  const src = fs.readFileSync(path.join(root, "js", "events-map.js"), "utf8");
  assert.match(src, /if \(GD\.globe && GD\.globe\.st && GD\.globe\.st\.recreating\) return;/);
});
console.log(`${n} recreate-map tests ok`);
