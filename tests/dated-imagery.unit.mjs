// Dated GIBS imagery (Step C). No network. Live imagery stays off by default.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const store = {};
const ctx = {
  window: {},
  Date,
  URL,
  console,
  localStorage: {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  }
};
ctx.window = ctx;
ctx.GD = {};
ctx.window.GD = ctx.GD;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js", "year-clock.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js", "layers.js"), "utf8"), ctx);
const yc = ctx.window.GD.yearClock;
const layers = ctx.window.GD.layers;
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("dated imagery is off by default and does not request GIBS when the year slider moves", () => {
  layers.resetLiveImageryForTests();
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  yc.setYear(2000, { silent: true });
  assert.equal(layers.isLiveImagery(), false);
  const spec = layers.datedSatSpec();
  assert.equal(spec.live, false);
  assert.equal(spec.requestsGibs, false);
  assert.ok(spec.tiles && spec.tiles.includes("tiles.maps.eox.at"));
  assert.ok(spec.tiles.includes("s2cloudless_3857"));
  assert.equal(/gibs\.earthdata/.test(spec.tiles), false);
  assert.match(spec.status.spoken, /Dated imagery is off/i);
});

t("with live imagery on, 2000 uses recorded Landsat WELD at the official date", () => {
  layers.resetLiveImageryForTests();
  layers.setLiveImagery(true);
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  yc.setYear(2000, { silent: true });
  const spec = layers.datedSatSpec();
  assert.equal(spec.live, true);
  assert.equal(spec.requestsGibs, true);
  assert.equal(spec.kind, "recorded");
  assert.equal(spec.stack, "weld");
  assert.equal(spec.date, "2000-12-01");
  assert.equal(spec.tiles, "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/2000-12-01/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg");
  assert.equal(spec.maxzoom, 12);
  assert.match(spec.credit, /GIBS/);
  assert.match(spec.credit, /2000-12-01/);
});

t("current year uses a non-future GIBS daily date, labelled recorded, not cloudless", () => {
  layers.resetLiveImageryForTests();
  layers.setLiveImagery(true);
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  yc.setYear(2026, { silent: true });
  yc.setDate("2026-11-20", { silent: true });
  const spec = layers.datedSatSpec();
  assert.equal(spec.requestsGibs, true);
  assert.ok(spec.kind === "recorded" || spec.kind === "recorded-nearest");
  assert.equal(spec.stack, "gibs-daily");
  assert.ok(spec.date && spec.date <= "2026-11-22");
  assert.equal(spec.date > "2026-11-22", false);
  assert.ok(spec.tiles.includes("gibs.earthdata.nasa.gov"));
  assert.ok(spec.tiles.includes(spec.date));
  assert.equal(/s2cloudless/.test(spec.tiles), false);
  assert.equal(yc.gibsTileUrl(spec.layerId, "2027-01-01"), null);
});

t("Blue Marble overlay tiles stay undated", () => {
  const L = layers.OVERLAYS.find((o) => o.id === "bluemarble");
  assert.ok(L.tiles.includes("gibs.earthdata.nasa.gov"));
  assert.ok(L.tiles.includes("BlueMarble_ShadedRelief_Bathymetry"));
  assert.equal(/\/default\/\d{4}-\d{2}-\d{2}\//.test(L.tiles), false);
  layers.setLocalBlueMarbleProxy(false);
  assert.equal(layers.blueMarbleTiles(), L.tiles);
});

t("a gap year with live imagery on is a labelled PROJECTED WELD blend", () => {
  layers.resetLiveImageryForTests();
  layers.setLiveImagery(true);
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  yc.setShowProjected(true, { silent: true });
  yc.setYear(1995, { silent: true });
  const spec = layers.datedSatSpec();
  assert.equal(spec.kind, "projected");
  assert.equal(spec.stack, "weld");
  assert.ok(spec.tilesPrev.includes("1990-12-01"));
  assert.ok(spec.tilesNext.includes("1998-12-01"));
  assert.match(spec.status.spoken, /not recorded imagery for 1995/i);
  assert.match(spec.credit, /PROJECTED view for 1995/i);
  const once = spec.credit.split(/PROJECTED view for 1995/i).length - 1;
  assert.equal(once, 1, spec.credit);
});

t("eoxTiles still uses the 2016 mosaic and the local pack only when the proxy is on", () => {
  layers.resetLiveImageryForTests();
  const remote = layers.BASES.find((b) => b.id === "sat-hybrid").satTiles;
  const loc = { protocol: "http:", hostname: "127.0.0.1", origin: "http://127.0.0.1:8080" };
  layers.setLocalBlueMarbleProxy(false);
  assert.equal(layers.eoxTiles(loc), remote);
  layers.setLocalBlueMarbleProxy(true);
  assert.equal(layers.eoxTiles(loc), "http://127.0.0.1:8080/tiles/eox2016/{z}/{x}/{y}.jpg");
  layers.setLocalBlueMarbleProxy(false);
});


t("EOX 2016 needs no extra gate; 2018-2025 stay off without the NC acknowledgement; 2017 cannot be turned on", () => {
  layers.resetLiveImageryForTests();
  layers.setLiveImagery(true);
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  yc.setYear(2016, { silent: true });
  const y2016 = layers.datedSatSpec();
  assert.equal(y2016.stack, "eox");
  assert.equal(y2016.kind, "recorded");
  assert.ok(y2016.tiles.includes("s2cloudless_3857"));
  assert.match(y2016.credit, /CC BY 4.0/);
  assert.equal(/NC-SA/.test(y2016.credit), false);
  assert.equal(layers.eoxNonCommercialAck(), false);

  yc.setYear(2024, { silent: true });
  const off = layers.datedSatSpec();
  assert.notEqual(off.stack, "eox");
  assert.equal(/s2cloudless-2024/.test(off.tiles || ""), false);
  assert.equal(yc.eoxLayerId(2024, { nonCommercialAck: false }), null);

  layers.setEoxNonCommercialAck(true);
  const on = layers.datedSatSpec();
  assert.equal(on.stack, "eox");
  assert.equal(on.kind, "recorded");
  assert.equal(on.tiles, "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg");
  assert.match(on.credit, /CC BY-NC-SA/);
  assert.match(on.credit, /Copernicus Sentinel data 2024/);
  assert.match(on.credit, /Not for public commercial use/);
  assert.equal(layers.eoxCredit(2024).includes("CC BY-NC-SA"), true);

  yc.setYear(2017, { silent: true });
  assert.equal(yc.eoxLayerId(2017, { nonCommercialAck: true }), null);
  const y2017 = layers.datedSatSpec();
  assert.equal(/s2cloudless-2017/.test(JSON.stringify(y2017)), false);
  assert.notEqual(y2017.stack, "eox");

  const hybrid = layers.BASES.find((b) => b.id === "sat-hybrid");
  assert.ok(hybrid.satTiles.includes("s2cloudless_3857"));
  assert.equal(/s2cloudless-20/.test(hybrid.satTiles), false);
});


t("GIBS daily uses maxzoom 9, and an offline base does not name EOX 2016", () => {
  layers.resetLiveImageryForTests();
  layers.setLiveImagery(true);
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  yc.setYear(2026, { silent: true });
  yc.setDate("2026-11-20", { silent: true });
  const daily = layers.datedSatSpec();
  assert.equal(daily.stack, "gibs-daily");
  assert.equal(daily.maxzoom, 9);
  assert.match(daily.credit, /GIBS/);
  assert.match(daily.credit, /acknowledge/i);

  layers.resetLiveImageryForTests();
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  ctx.GD.globe = { st: { baseId: "offline" } };
  const off = layers.datedSatSpec();
  assert.equal(off.kind, "none");
  assert.equal(off.requestsGibs, false);
  assert.equal(/EOX 2016/.test(JSON.stringify(off)), false);
  assert.match(off.status.spoken, /Natural Earth/i);
  const badge = yc.yearBadgeSpec();
  assert.equal(badge, null);
  delete ctx.GD.globe;
});

t("repeated dated-imagery tile errors switch the layer off and stop GIBS requests", () => {
  layers.resetLiveImageryForTests();
  layers.setLiveImagery(true);
  yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
  yc.setYear(2000, { silent: true });
  assert.equal(layers.datedSatSpec().requestsGibs, true);
  ctx.GD.ui = { toast() {} };
  for (let i = 0; i < layers.IMAGERY_ERROR_LIMIT; i++) {
    layers.noteDatedTileError({ sourceId: "sat", error: { message: "Failed to fetch" } });
  }
  assert.equal(layers.isLiveImagery(), false);
  assert.equal(layers.datedSatSpec().requestsGibs, false);
});

layers.resetLiveImageryForTests();
console.log(n + " dated-imagery tests ok");
