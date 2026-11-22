// Unit tests: Show all / Hide all must update visible map layers in one go, on both bases.
// A fake MapLibre map can report isStyleLoaded() as false (tiles / Event Layers)
// without blocking addLayer, matching live MapLibre. A second case never goes idle,
// emits styledata only while not-ready, and recreates the map mid-wait.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

function FakeMap(opts) {
  const zoom = opts && opts.zoom != null ? opts.zoom : 1.6;
  const glyphs = !!(opts && opts.glyphs);
  const sources = Object.assign({}, (opts && opts.sources) || {});
  const layers = {};
  const listeners = {};
  const neverIdle = !!(opts && opts.neverIdle);
  const startUnloaded = !!(opts && opts.startUnloaded);
  let tilesLoaded = !neverIdle && !startUnloaded;
  let mapLoaded = !startUnloaded;
  let canMutate = !startUnloaded;
  let terrain = null;
  let center = { lng: -77.01, lat: 38.89 };
  let pitch = 0, bearing = 0;
  const map = {
    _sources: sources,
    _layers: layers,
    getZoom: () => zoom,
    getPitch: () => pitch,
    getBearing: () => bearing,
    getCenter: () => center,
    loaded: () => mapLoaded,
    isStyleLoaded: () => (neverIdle ? false : tilesLoaded),
    getTerrain: () => terrain,
    setTerrain(t) { terrain = t || null; if (!neverIdle) tilesLoaded = false; },
    setSky() {},
    setProjection() {},
    jumpTo(o) {
      if (o && o.center) {
        const c = o.center;
        center = Array.isArray(c) ? { lng: c[0], lat: c[1] } : { lng: c.lng, lat: c.lat };
      }
      if (o && o.zoom != null) { /* zoom is closed over; ignore mid-test */ }
      if (o && o.pitch != null) pitch = o.pitch;
      if (o && o.bearing != null) bearing = o.bearing;
    },
    addControl() {},
    remove() {},
    getCanvas: () => ({ getContext: () => null }),
    project: () => ({ x: 0, y: 0 }),
    unproject: () => ({ lng: center.lng, lat: center.lat }),
    getStyle: () => ({ glyphs: glyphs ? "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf" : undefined, layers: Object.values(layers) }),
    getSource: (id) => sources[id] || null,
    getLayer: (id) => layers[id] || null,
    addSource(id, spec) {
      if (sources[id]) throw new Error("Source " + id + " already exists");
      sources[id] = Object.assign({ setData(d) { this.data = d; } }, spec);
      if (!neverIdle) tilesLoaded = false;
    },
    addLayer(layer) {
      if (!canMutate) throw new Error("style is not loaded");
      const l = Object.assign({ layout: { visibility: "visible" }, paint: {} }, layer);
      if (!l.layout) l.layout = { visibility: "visible" };
      if (l.layout.visibility == null) l.layout.visibility = "visible";
      layers[l.id] = l;
    },
    setLayoutProperty(id, key, val) { if (layers[id]) { layers[id].layout = layers[id].layout || {}; layers[id].layout[key] = val; } },
    getLayoutProperty(id, key) { return layers[id] && layers[id].layout ? layers[id].layout[key] : undefined; },
    setPaintProperty(id, key, val) { if (layers[id]) { layers[id].paint = layers[id].paint || {}; layers[id].paint[key] = val; } },
    on(ev, fn) { (listeners[ev] || (listeners[ev] = [])).push(fn); },
    once(ev, fn) {
      const wrap = (...a) => { map.off(ev, wrap); fn(...a); };
      map.on(ev, wrap);
    },
    off(ev, fn) { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); },
    emit(ev) {
      if (ev === "style.load") canMutate = true;
      if (ev === "load") mapLoaded = true;
      if (ev === "idle" && neverIdle) return;
      (listeners[ev] || []).slice().forEach((fn) => fn());
    },
    settle() {
      if (neverIdle) {
        map.emit("styledata");
        return;
      }
      tilesLoaded = true;
      canMutate = true;
      mapLoaded = true;
      map.emit("styledata");
      map.emit("idle");
    }
  };
  if (opts && opts.openmaptiles) sources.openmaptiles = { type: "vector" };
  return map;
}

function vis(map, id) {
  if (!map.getLayer(id)) return "missing";
  return map.getLayoutProperty(id, "visibility") || "visible";
}

function elStub() {
  return {
    style: {}, children: [], className: "", textContent: "",
    setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, appendChild(c) { this.children.push(c); return c; },
    querySelector() { return null; }, querySelectorAll() { return []; }
  };
}

function load(mapCtor) {
  const win = {
    GD: {},
    localStorage: { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = String(v); } },
    addEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: "node", onLine: false },
    devicePixelRatio: 1,
    console,
    GD_LAND: { type: "FeatureCollection", features: [] },
    GD_REGIONS: { world: { countries: [] }, "towns-index": { towns: [] } }
  };
  win.window = win;
  win.Promise = Promise;
  win.queueMicrotask = queueMicrotask;
  win.setTimeout = setTimeout;
  win.clearTimeout = clearTimeout;
  win.document = {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, readyState: "loading", createElement: () => elStub()
  };
  win.maplibregl = {
    Map: mapCtor || function () { throw new Error("real MapLibre should not be constructed in this unit test"); },
    NavigationControl: function () {},
    Marker: function () {}
  };
  const ctx = vm.createContext(win);
  for (const f of ["js/layers.js", "js/render.js", "js/layers-panel.js", "js/globe.js"]) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return win;
}

function attach(win, map, baseId, overlays) {
  const st = win.GD.globe.st;
  st.map = map;
  st.status = "ready";
  st.baseId = baseId;
  st.overlays = Object.assign({}, overlays);
  st.terrainOn = false;
  st.preserveDrawingBuffer = false;
  st.container = elStub();
  st.episode = { stories: [{ id: "s1", title: "Sample", location: { lat: 38.89, lon: -77.01 }, highlight: { a3: "USA" } }] };
  st.active = 0;
}

function defaults(layers) {
  const ov = {};
  layers.OVERLAYS.forEach((o) => { ov[o.id] = o.status === "unknown" ? false : o.default; });
  return ov;
}

function applyPlan(GD, plan) {
  const cur = GD.globe.st.overlays || {};
  Object.keys(plan).filter((id) => !plan[id] && cur[id]).forEach((id) => GD.globe.setOverlay(id, false));
  Object.keys(plan).filter((id) => plan[id] && !GD.globe.st.overlays[id]).forEach((id) => GD.globe.setOverlay(id, true));
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

async function settle(map, times) {
  await flush();
  for (let i = 0; i < (times || 8); i++) {
    if (map.isStyleLoaded()) return i;
    map.settle();
    await flush();
  }
  throw new Error("style never settled");
}

function assertShow(map, { blue, hill, story }) {
  if (blue) assert.equal(vis(map, "gd-bluemarble"), "visible", "Blue Marble should be drawn");
  else assert.ok(vis(map, "gd-bluemarble") === "missing" || vis(map, "gd-bluemarble") === "none", "Blue Marble should be off, got " + vis(map, "gd-bluemarble"));
  if (hill) assert.equal(vis(map, "gd-hillshade"), "visible", "hillshade should be drawn");
  else assert.ok(vis(map, "gd-hillshade") === "missing" || vis(map, "gd-hillshade") === "none", "hillshade should be off, got " + vis(map, "gd-hillshade"));
  if (story) {
    for (const id of ["gd-hl-glow", "gd-pins", "gd-arcs", "gd-rings"]) {
      assert.equal(vis(map, id), "visible", id + " should be drawn");
    }
  }
}

function assertHidden(map, ids) {
  for (const id of ids) {
    assert.ok(vis(map, id) === "missing" || vis(map, id) === "none", id + " should be hidden, got " + vis(map, id));
  }
}

await t("Offline globe: Show all draws Blue Marble, glow and pin in one go; Hide all hides them", async () => {
  const win = load();
  const GD = win.GD;
  const map = FakeMap({ zoom: 1.6 });
  attach(win, map, "offline", defaults(GD.layers));
  applyPlan(GD, GD.layersPanel.showAllPlan(GD.layers, GD.globe.st.overlays, "offline"));
  await settle(map);
  assert.equal(GD.globe.st.overlays.bluemarble, true);
  assertShow(map, { blue: true, hill: false, story: true });
  applyPlan(GD, GD.layersPanel.hideAllPlan(GD.layers, GD.globe.st.overlays));
  await settle(map);
  for (const o of GD.layers.OVERLAYS) assert.equal(GD.globe.st.overlays[o.id], false, o.id);
  assertHidden(map, ["gd-bluemarble", "gd-hl-glow", "gd-hl-fill", "gd-pins", "gd-arcs", "gd-rings", "gd-countries", "gd-towns"]);
  assert.equal(map.getTerrain(), null, "no terrain on the offline globe after Hide all");
});

await t("Satellite base: Show all draws hillshade, glow, rings, arcs and pin in one go; Hide all hides them", async () => {
  const win = load();
  const GD = win.GD;
  const map = FakeMap({ zoom: 12, glyphs: true, openmaptiles: true });
  attach(win, map, "sat-hybrid", defaults(GD.layers));
  applyPlan(GD, GD.layersPanel.showAllPlan(GD.layers, GD.globe.st.overlays, "sat-hybrid"));
  await settle(map);
  assert.equal(GD.globe.st.overlays.terrain, true);
  assert.equal(GD.globe.st.overlays.bluemarble, false, "Blue Marble stays off on the satellite base");
  assertShow(map, { blue: false, hill: true, story: true });
  assert.ok(map.getTerrain(), "terrain is on the map after Show all at zoom 12");
  applyPlan(GD, GD.layersPanel.hideAllPlan(GD.layers, GD.globe.st.overlays));
  await settle(map);
  for (const o of GD.layers.OVERLAYS) assert.equal(GD.globe.st.overlays[o.id], false, o.id);
  assertHidden(map, ["gd-hillshade", "gd-hl-glow", "gd-hl-fill", "gd-pins", "gd-arcs", "gd-rings", "gd-bluemarble"]);
  assert.equal(map.getTerrain(), null, "getTerrain() is cleared after Hide all");
});

await t("Never-idle map: styledata while not-ready, no idle, and a mid-wait recreate still lands the final state", async () => {
  const maps = [];
  const win = load(function MapCtor() {
    const m = FakeMap({ neverIdle: true, startUnloaded: true, zoom: 12, glyphs: true, openmaptiles: true });
    maps.push(m);
    return m;
  });
  const GD = win.GD;
  const mapA = FakeMap({ neverIdle: true, zoom: 12, glyphs: true, openmaptiles: true });
  attach(win, mapA, "sat-hybrid", defaults(GD.layers));
  // Style is attached later: a Show all while loading must wait, and idle will never come.
  GD.globe.st.status = "style-loading";
  applyPlan(GD, GD.layersPanel.showAllPlan(GD.layers, GD.globe.st.overlays, "sat-hybrid"));
  await flush();
  assert.equal(vis(mapA, "gd-hillshade"), "missing", "must not apply while the style is unbound");
  for (let i = 0; i < 6; i++) mapA.emit("styledata");
  await flush();
  assert.equal(vis(mapA, "gd-hillshade"), "missing", "styledata while not-ready must not count as settled");
  assert.equal(mapA.isStyleLoaded(), false);

  const pending = GD.globe.prepareForExport();
  assert.ok(maps.length >= 1, "recreateMap built a new map");
  const mapB = maps[maps.length - 1];
  assert.notEqual(mapB, mapA);
  // The old map never goes idle; the wait must move to the new map.
  mapA.emit("styledata");
  mapA.emit("idle");
  await flush();
  assert.equal(vis(mapA, "gd-hillshade"), "missing", "old map must not receive the retry");

  mapB.emit("style.load");
  await flush();
  await flush();
  mapB.emit("load");
  await pending;
  await flush();
  await flush();
  assert.equal(GD.globe.st.map, mapB);
  assert.equal(GD.globe.st.status, "ready");
  assert.equal(mapB.isStyleLoaded(), false, "tiles still not loaded (never idle)");
  assert.equal(GD.globe.st.overlays.terrain, true);
  assertShow(mapB, { blue: false, hill: true, story: true });
  assert.ok(mapB.getTerrain(), "terrain is on the new map after Show all");

  applyPlan(GD, GD.layersPanel.hideAllPlan(GD.layers, GD.globe.st.overlays));
  await flush();
  // Still never idle, and styledata only fires while not-ready — the apply must not wait for idle.
  for (let i = 0; i < 4; i++) mapB.emit("styledata");
  await flush();
  for (const o of GD.layers.OVERLAYS) assert.equal(GD.globe.st.overlays[o.id], false, o.id);
  assertHidden(mapB, ["gd-hillshade", "gd-hl-glow", "gd-hl-fill", "gd-pins", "gd-arcs", "gd-rings"]);
  assert.equal(mapB.getTerrain(), null, "getTerrain() is cleared after Hide all on the recreated map");
});

console.log(n + " v13 layers-batch tests ok");
