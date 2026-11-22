// Data year drives official GIS tile URLs. No network.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, console, Date, URL, URLSearchParams };
ctx.window = ctx;
ctx.GD = {};
ctx.window.GD = ctx.GD;
vm.createContext(ctx);
for (const f of ["year-clock", "schema", "gis"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
}
const { yearClock: yc, gis } = ctx.window.GD;
const doc = JSON.parse(fs.readFileSync(path.join(root, "data/gis-registry.json"), "utf8"));
gis.load(JSON.parse(JSON.stringify(doc)));
yc.resetForTests({ now: () => new Date("2026-11-22T12:00:00-05:00") });
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("TIGER vintages follow the data year and never invent ACS2020", () => {
  yc.setYear(2018, { silent: true });
  const u2018 = gis.rasterTileUrl(gis.byId("tiger-boundaries"));
  assert.ok(u2018.includes("/TIGERweb/tigerWMS_ACS2018/MapServer/export"));
  yc.setYear(2010, { silent: true });
  assert.ok(gis.rasterTileUrl(gis.byId("tiger-boundaries")).includes("tigerWMS_Census2010"));
  yc.setYear(2020, { silent: true });
  assert.ok(gis.rasterTileUrl(gis.byId("tiger-boundaries")).includes("tigerWMS_Census2020"));
  assert.equal(gis.rasterTileUrl(gis.byId("tiger-boundaries")).includes("ACS2020"), false);
  yc.setYear(2005, { silent: true });
  const u2005 = gis.rasterTileUrl(gis.byId("tiger-boundaries"));
  assert.equal(u2005, null);
  const st = yc.statusFor({ kind: "tiger" }, 2005);
  assert.equal(st.kind, "unavailable");
  assert.equal(/tigerWMS_/i.test(st.label || ""), false);
  gis.setLiveEnabled(true);
  gis.setOverlay({ id: "tiger-boundaries", on: true });
  yc.setYear(2005, { silent: true });
  const row = (gis.editorRows() || []).find((r) => r.id === "tiger-boundaries");
  assert.ok(row);
  assert.equal(gis.tokenFor(gis.byId("tiger-boundaries")), "unavailable");
  assert.equal(row.status, "unavailable");
  assert.notEqual(row.statusLabel, "ok");
  assert.match(row.statusLabel, /unavailable/i);
  gis.setLiveEnabled(false);
});

t("official rasters declare a min zoom, and NHD is 7", () => {
  assert.equal(gis.minZoomOf(gis.byId("usgs-nhd")), 7);
  assert.ok(gis.minZoomOf(gis.byId("tiger-boundaries")) >= 4);
  assert.ok(gis.minZoomOf(gis.byId("nowcoast-radar")) >= 4);
  assert.ok(gis.minZoomOf(gis.byId("usgs-topo")) >= 3);
});

t("current USGS and nowCOAST layers hide on a historical year", () => {
  yc.setYear(2016, { silent: true });
  assert.equal(gis.rasterTileUrl(gis.byId("usgs-topo")), null);
  assert.equal(gis.rasterTileUrl(gis.byId("usgs-imagery")), null);
  assert.equal(gis.rasterTileUrl(gis.byId("usgs-nhd")), null);
  assert.equal(gis.rasterTileUrl(gis.byId("nowcoast-radar")), null);
  yc.setYear(2026, { silent: true });
  assert.ok(gis.rasterTileUrl(gis.byId("usgs-topo")).includes("basemap.nationalmap.gov"));
  assert.ok(gis.rasterTileUrl(gis.byId("nowcoast-radar")).includes("nowcoast.noaa.gov"));
});

t("yearClock changes are wired to gis.syncMap", () => {
  const src = fs.readFileSync(path.join(root, "js", "gis.js"), "utf8");
  assert.match(src, /yearClock\.onChange/);
  assert.match(src, /syncMap\(\)/);
});

console.log(n + " year-layers tests ok");
