// Unit tests for the official-GIS connector. No live network: stubs and fixtures only.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { console, window: { GD: {} }, Date, URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView, setTimeout, clearTimeout };
ctx.window.window = ctx.window;
ctx.globalThis = ctx;
ctx.URL = URL;
ctx.URLSearchParams = URLSearchParams;
vm.createContext(ctx);
for (const f of ["sanitize", "schema", "gis", "commands"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
}
const { schema, gis, commands } = ctx.window.GD;
const J = (v) => JSON.parse(JSON.stringify(v));
assert.deepEqual = ((orig) => (a, b, m) => orig(J(a), J(b), m))(assert.deepEqual);
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

const fixture = JSON.parse(fs.readFileSync(path.join(root, "data/gis-registry.json"), "utf8"));
const fx = (name) => fs.readFileSync(path.join(root, "tests/fixtures/gis", name), "utf8");
const csp = fs.readFileSync(path.join(root, "index.html"), "utf8");
const cspHostsInHtml = [...csp.matchAll(/https:\/\/([^/\s"']+)/g)].map((m) => m[1].toLowerCase());

const workingQuery = {
  id: "test-query",
  label: "Test query overlay",
  group: "overlay",
  kind: "geojson-query",
  status: "working",
  runtime: true,
  credit: "Test fixture, not a live host",
  terms: "Tests only. Not an official source.",
  termsUrl: "https://example.invalid/terms",
  sourceUrl: "https://example.invalid/arcgis/rest/services/demo/MapServer/0",
  queryUrl: "https://example.invalid/arcgis/rest/services/demo/MapServer/0/query",
  idField: "OBJECTID",
  maxFeatures: 200,
  minzoom: 10,
  color: "#38bdf8",
  geometry: "point"
};

await t("the shipped GIS registry validates, keeps OpenHistoricalMap unknown, and stores no URL on that row", async () => {
  assert.equal(fixture.schema, "globedesk.gis-registry/1");
  assert.equal(fixture.liveDefault, false);
  assert.deepEqual(gis.validateRegistry(fixture), []);
  gis.load(J(fixture));
  assert.deepEqual(gis.state.errors, []);
  const ohm = gis.byId("ohm");
  assert.ok(ohm);
  assert.equal(ohm.status, "unknown");
  assert.equal(ohm.kind, "none");
  assert.match(ohm.reason, /not wired yet/);
  assert.equal(ohm.sourceUrl, undefined);
  assert.equal(ohm.queryUrl, undefined);
  assert.equal(ohm.termsUrl, undefined);
  assert.equal(JSON.stringify(ohm).includes("http"), false);
  assert.deepEqual(gis.hostnamesFrom(fixture), [
    "basemap.nationalmap.gov",
    "hydro.nationalmap.gov",
    "mrdata.usgs.gov",
    "nowcoast.noaa.gov",
    "tigerweb.geo.census.gov"
  ]);
  assert.deepEqual(gis.cspHosts(), gis.hostnamesFrom(fixture));
  assert.equal(gis.isLiveEnabled(), false);
});

await t("an unknown layer with a URL or a working layer without credit fails validation", async () => {
  const withUrl = J(fixture);
  const ohmRow = withUrl.layers.find((l) => l.id === "ohm");
  ohmRow.sourceUrl = "https://example.invalid/ohm";
  assert.ok(gis.validateRegistry(withUrl).some((e) => /must not store/.test(e)));
  const bare = {
    schema: "globedesk.gis-registry/1",
    liveDefault: false,
    layers: [{ id: "live", label: "Live", group: "overlay", kind: "raster", status: "working", runtime: true, sourceUrl: "https://example.invalid/map", terms: "t", termsUrl: "https://example.invalid/terms", minzoom: 0, tiles: "https://example.invalid/{z}/{x}/{y}.png" }]
  };
  assert.ok(gis.validateRegistry(bare).some((e) => /credit/.test(e)));
  const ok = J(bare);
  ok.layers[0].credit = "Example credit";
  assert.deepEqual(gis.validateRegistry(ok), []);
  assert.deepEqual(gis.hostnamesFrom(ok), ["example.invalid"]);
});

await t("the query URL builder asks for geometry plus one non-person id, with a cap and no paging", async () => {
  const built = gis.featureQueryUrl(workingQuery, [-88.12, 41.70, -87.50, 42.10]);
  assert.equal(built.error, undefined, built.error);
  const u = new URL(built.url);
  assert.equal(u.hostname, "example.invalid");
  assert.equal(u.searchParams.get("outFields"), "OBJECTID");
  assert.equal(u.searchParams.get("returnGeometry"), "true");
  assert.equal(u.searchParams.get("resultRecordCount"), "200");
  assert.equal(u.searchParams.get("f"), "geojson");
  assert.equal(u.searchParams.get("resultOffset"), null);
  assert.equal(/resultOffset=/i.test(built.url), false);
  const personal = gis.featureQueryUrl(Object.assign({}, workingQuery, { idField: "owner" }), [-88, 41, -87, 42]);
  assert.match(personal.error, /owner, address, phone, email, or valuation/);
  const badReg = { schema: "globedesk.gis-registry/1", layers: [Object.assign({}, workingQuery, { idField: "email" })] };
  assert.ok(gis.validateRegistry(badReg).some((e) => /idField/.test(e)));
});

await t("the body parser classifies synthetic fixtures, checks HTTP status first, and does not swap a down host", async () => {
  // tests/fixtures/gis are synthetic examples, not captured live service bodies.
  const gisFxDir = path.join(root, "tests/fixtures/gis");
  assert.match(fs.readFileSync(path.join(gisFxDir, "README.md"), "utf8"), /synthetic/i);
  fs.readdirSync(gisFxDir).forEach((name) => {
    if (name === "README.md") return;
    assert.match(fs.readFileSync(path.join(gisFxDir, name), "utf8"), /synthetic/i);
  });
  const err = gis.parseGisServiceBody(fx("arcgis-error.json"), "application/json", 200);
  assert.equal(err.ok, false);
  assert.match(err.reason, /ArcGIS error 500: Error performing query operation/);
  const silent = gis.parseGisServiceBody(fx("arcgis-error-no-message.json"), "application/json", 200);
  assert.equal(silent.ok, false);
  assert.match(silent.reason, /ArcGIS error 500: no message/);
  const silentHttp = gis.parseGisServiceBody(fx("arcgis-error-no-message.json"), "application/json", 500);
  assert.equal(silentHttp.ok, false);
  assert.equal(silentHttp.reason, "HTTP 500");
  const html = gis.parseGisServiceBody(fx("web-adaptor.html"), "text/html", 200);
  assert.equal(html.ok, false);
  assert.equal(html.reason, "Web Adaptor");
  const geo = gis.parseGisServiceBody(fx("healthy-geojson.json"), "application/json", 200);
  assert.equal(geo.ok, true);
  const meta = gis.parseGisServiceBody(fx("healthy-metadata.json"), "application/json", 200);
  assert.equal(meta.ok, true);
  const emptyFc = gis.parseGisServiceBody(JSON.stringify({ type: "FeatureCollection", features: [] }), "application/geo+json", 200);
  assert.equal(emptyFc.ok, true);
  const http500 = gis.parseGisServiceBody("plain failure", "text/plain", 503);
  assert.equal(http500.ok, false);
  assert.equal(http500.reason, "HTTP 503");
  const json500 = gis.parseGisServiceBody(JSON.stringify({ type: "FeatureCollection", features: [] }), "application/json", 500);
  assert.equal(json500.ok, false);
  assert.equal(json500.reason, "HTTP 500");
  const errStr = gis.parseGisServiceBody(JSON.stringify({ error: "down" }), "application/json", 200);
  assert.equal(errStr.ok, false);
  assert.match(errStr.reason, /ArcGIS error: down/);
  const statusErr = gis.parseGisServiceBody(JSON.stringify({ status: "error" }), "application/json", 200);
  assert.equal(statusErr.ok, false);
  assert.match(statusErr.reason, /service status: error/);
  const emptyObj = gis.parseGisServiceBody("{}", "application/json", 200);
  assert.equal(emptyObj.ok, false);
  assert.equal(emptyObj.reason, "empty JSON object");
});

await t("live GIS stays off by default, and a down or unknown overlay is skipped rather than replaced", async () => {
  const doc = { schema: "globedesk.gis-registry/1", liveDefault: false, layers: [workingQuery, J(fixture.layers.find((l) => l.id === "ohm"))] };
  gis.load(doc);
  assert.equal(gis.isLiveEnabled(), false);
  const listed = gis.listed();
  assert.equal(listed.liveEnabled, false);
  const q = listed.layers.find((l) => l.id === "test-query");
  assert.equal(q.status, "off");
  assert.equal(JSON.stringify(listed).includes("example.invalid"), false);
  const refused = gis.setOverlay({ id: "test-query", on: true });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /live GIS is off/);
  assert.equal(gis.listed().layers.find((l) => l.id === "test-query").status, "off");

  const skippedUnknown = gis.setOverlay({ id: "ohm", on: true });
  assert.equal(skippedUnknown.ok, false);
  assert.match(skippedUnknown.error, /skipped/);
  assert.equal(gis.gisStatus({ id: "ohm" }).result.status, "unknown");

  gis.setLiveEnabled(true);
  assert.equal(gis.isLiveEnabled(), true);
  const on = gis.setOverlay({ id: "test-query", on: true });
  assert.equal(on.ok, true, on.error);

  let fetches = 0;
  const downFetch = () => { fetches++; return Promise.resolve({ status: 200, headers: { get: () => "application/json" }, text: () => Promise.resolve(fx("arcgis-error.json")) }); };
  const down = await gis.refresh({ zoom: 12, bounds: [-88, 41, -87, 42] }, downFetch);
  assert.equal(fetches, 1);
  assert.equal(down[0].ok, false);
  assert.equal(down[0].skipped, true);
  assert.match(down[0].reason, /ArcGIS error/);
  const afterDown = gis.gisStatus({ id: "test-query" });
  assert.equal(afterDown.result.status, "error");
  assert.equal(gis.state.overlaysOn["test-query"], false);
  const skipped = await gis.refresh({ zoom: 12, bounds: [-88, 41, -87, 42] }, downFetch);
  assert.equal(fetches, 1);
  assert.equal(skipped.length, 0);
  assert.equal(gis.gisStatus({ id: "test-query" }).result.status, "error");
  const cmdRefuse = await commands.run({ cmd: "setOverlay", id: "test-query", on: true });
  assert.equal(cmdRefuse.ok, false);
  assert.match(cmdRefuse.error, /skipped/);
  assert.equal(gis.state.overlaysOn["test-query"], false);
  assert.equal(gis.gisStatus({ id: "test-query" }).result.status, "error");
  const retry = gis.setOverlay({ id: "test-query", on: true });
  assert.equal(retry.ok, true, retry.error);
  const retried = await gis.refresh({ zoom: 12, bounds: [-88, 41, -87, 42] }, downFetch);
  assert.equal(fetches, 2);
  assert.equal(retried[0].ok, false);
  const url = gis.byId("test-query").queryUrl;
  assert.equal(url, workingQuery.queryUrl);

  gis.setHealth = null;
  gis.state.health["test-query"] = { token: "off", reason: "", at: 0 };
  gis.state.overlaysOn["test-query"] = true;
  const below = await gis.refreshLayer(gis.byId("test-query"), { zoom: 5, bounds: [-88, 41, -87, 42] }, downFetch);
  assert.equal(below.result.status, "below-minzoom");
  assert.equal(fetches, 2);

  gis.state.health["test-query"] = { token: "off", reason: "", at: 0 };
  gis.state.overlaysOn["test-query"] = true;
  const okFetch = () => ({ status: 200, headers: { get: () => "application/geo+json" }, text: () => Promise.resolve(fx("healthy-geojson.json")) });
  const ok = await gis.refreshLayer(gis.byId("test-query"), { zoom: 12, bounds: [-88, 41, -87, 42] }, okFetch);
  assert.equal(ok.ok, true, ok.reason);
  assert.match(ok.result.status, /^ok:/);
  assert.deepEqual(ok.result.features.features[0].properties, {});
  assert.equal(ok.result.features.features[0].geometry.type, "Point");

  gis.setLiveEnabled(false);
  const again = gis.setOverlay({ id: "test-query", on: true });
  assert.equal(again.ok, false);
});

await t("listGis and gisStatus go through the command API, and extra keys are rejected", async () => {
  gis.load(J(fixture));
  gis.setLiveEnabled(false);
  const listed = await commands.run({ cmd: "listGis" });
  assert.equal(listed.ok, true, listed.error);
  assert.equal(listed.result.liveEnabled, false);
  assert.ok(listed.result.layers.some((l) => l.id === "ohm" && l.status === "unknown"));
  assert.equal(JSON.stringify(listed.result).includes("http"), false);
  const st = await commands.run({ cmd: "gisStatus", id: "ohm" });
  assert.equal(st.ok, true, st.error);
  assert.equal(st.result.status, "unknown");
  const extra = commands.unpack({ cmd: "listGis", url: "https://example.invalid/" });
  assert.match(extra.error, /unknown field/);
  const missing = commands.unpack({ cmd: "gisStatus" });
  assert.match(missing.error, /missing id|gisStatus requires id/);
  const setOhm = await commands.run({ cmd: "setOverlay", id: "ohm", on: true });
  assert.equal(setOhm.ok, false);
  assert.match(setOhm.error, /skipped|unknown/);
});

await t("CSP allow-list is derived only from working entries, and matches the approved official-GIS host list", async () => {
  assert.deepEqual(gis.hostnamesFrom(fixture), [
    "basemap.nationalmap.gov",
    "hydro.nationalmap.gov",
    "mrdata.usgs.gov",
    "nowcoast.noaa.gov",
    "tigerweb.geo.census.gov"
  ]);
  const live = { schema: "globedesk.gis-registry/1", layers: [workingQuery] };
  assert.deepEqual(gis.hostnamesFrom(live), ["example.invalid"]);
  gis.hostnamesFrom(fixture).forEach((h) => {
    assert.ok(cspHostsInHtml.includes(h) || h === "example.invalid", "unexpected host " + h);
  });
  assert.equal(csp.includes("example.invalid"), false);
  const cspMeta = csp.match(/Content-Security-Policy" content="([^"]+)"/);
  assert.ok(cspMeta);
  // Frozen to the owner-approved host list (card t2987s11225). Opt-in cannot change a meta tag after load.
  // + https://mrdata.usgs.gov (img-src and connect-src only): owner pick 5 for the chem index, 2026-11-26 (live USGS MRDS deposits).
  const FROZEN_CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://tiles.maps.eox.at https://tiles.openfreemap.org https://s3.amazonaws.com/elevation-tiles-prod/ https://gibs.earthdata.nasa.gov https://api.maptiler.com https://basemap.nationalmap.gov https://hydro.nationalmap.gov https://tigerweb.geo.census.gov https://nowcoast.noaa.gov https://mrdata.usgs.gov; connect-src 'self' https://tiles.maps.eox.at https://tiles.openfreemap.org https://s3.amazonaws.com/elevation-tiles-prod/ https://gibs.earthdata.nasa.gov https://api.maptiler.com https://basemap.nationalmap.gov https://hydro.nationalmap.gov https://tigerweb.geo.census.gov https://nowcoast.noaa.gov https://mrdata.usgs.gov https://photon.komoot.io; font-src 'self' data: https://tiles.openfreemap.org; media-src 'self' blob: data:; frame-src https://www.youtube-nocookie.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';";
  assert.equal(cspMeta[1], FROZEN_CSP);
  const hosts = [...new Set((cspMeta[1].match(/https:\/\/([^/\s;]+)/g) || []).map((u) => u.replace(/^https:\/\//, "").toLowerCase()))].sort();
  assert.deepEqual(hosts, [
    "api.maptiler.com",
    "basemap.nationalmap.gov",
    "gibs.earthdata.nasa.gov",
    "hydro.nationalmap.gov",
    "mrdata.usgs.gov",
    "nowcoast.noaa.gov",
    "photon.komoot.io",
    "s3.amazonaws.com",
    "tigerweb.geo.census.gov",
    "tiles.maps.eox.at",
    "tiles.openfreemap.org",
    "www.youtube-nocookie.com"
  ]);
  assert.equal(/nominatim/i.test(cspMeta[1]), false);
  assert.equal(cspMeta[1].includes("geocoding.geo.census.gov"), false);
  assert.equal(/arcgisonline|services\.arcgis\.com/i.test(cspMeta[1]), false);
});

await t("a personal-data scan of the registry and GIS fixtures stays clean", async () => {
  const files = [
    path.join(root, "data/gis-registry.json"),
    path.join(root, "js/gis.js"),
    ...fs.readdirSync(path.join(root, "tests/fixtures/gis")).map((f) => path.join(root, "tests/fixtures/gis", f))
  ];
  const hits = [];
  files.forEach((file) => {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(root, file);
    String(text).split(/\n/).forEach((line, i) => {
      if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(line)) hits.push(rel + ":" + (i + 1) + " email");
      if (/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(line)) hits.push(rel + ":" + (i + 1) + " phone");
      if (/(^|[^A-Za-z])(owner|streetAddress|phoneNumber|emailAddress|valuation)([^A-Za-z]|$)/i.test(line) && !/must not carry an owner, address, phone, email, or valuation/.test(line) && !/PERSONAL_FIELD/.test(line) && !/idField must not be a person/.test(line)) {
        hits.push(rel + ":" + (i + 1) + " field");
      }
    });
  });
  assert.deepEqual(hits, []);
});

await t("the news-desk GIS strip shows a named unknown overlay as [UNKNOWN], not a stand-in map", async () => {
  function el(tag) {
    const rec = {
      tagName: String(tag || "div").toUpperCase(), nodeType: 1, childNodes: [], parentNode: null,
      className: "", id: "",
      appendChild(c) { if (!c) return c; c.parentNode = this; this.childNodes.push(c); return c; },
      get textContent() { return (this.childNodes || []).map((c) => c.textContent).join(""); },
      set textContent(v) { this.childNodes = []; if (String(v)) this.childNodes.push({ nodeType: 3, textContent: String(v) }); }
    };
    return rec;
  }
  ctx.document = { createElement: (tag) => el(tag), createTextNode: (d) => ({ nodeType: 3, textContent: String(d) }) };
  ctx.window.document = ctx.document;
  gis.load(J(fixture));
  const story = { id: "story-x", title: "X", gisOverlayIds: ["ohm", "not-a-layer"] };
  const parent = el("div");
  gis.mountNewsdesk(parent, story);
  const text = parent.textContent;
  assert.match(text, /Official GIS/);
  assert.match(text, /OpenHistoricalMap/);
  assert.match(text, /\[UNKNOWN\]/);
  assert.match(text, /not-a-layer/);
  assert.equal(/https?:\/\//.test(text), false);
});

await t("gisOverlayIds warnings use the bundled registry list and do not depend on load order", async () => {
  const shipped = JSON.parse(fs.readFileSync(path.join(root, "data/gis-registry.json"), "utf8"));
  assert.deepEqual(schema.BUNDLED_GIS_OVERLAY_IDS, (shipped.layers || []).map((l) => l.id));
  gis.empty();
  const blank = JSON.parse(fs.readFileSync(path.join(root, "episodes/blank.globedesk.json"), "utf8"));
  const ep = J(blank);
  const before = [];
  ep.stories[0].gisOverlayIds = ["ohm"];
  assert.deepEqual(schema.validate(ep, before), []);
  assert.deepEqual(before, []);
  const unknownBefore = [];
  ep.stories[0].gisOverlayIds = ["ohm", "not-a-layer"];
  assert.deepEqual(schema.validate(ep, unknownBefore), []);
  assert.ok(unknownBefore.some((e) => /not in the GIS registry/.test(e)));
  gis.load(J(fixture));
  const unknownAfter = [];
  assert.deepEqual(schema.validate(ep, unknownAfter), []);
  assert.ok(unknownAfter.some((e) => /not in the GIS registry/.test(e)));
  const okAfter = [];
  ep.stories[0].gisOverlayIds = ["ohm"];
  assert.deepEqual(schema.validate(ep, okAfter), []);
  assert.deepEqual(okAfter, []);
  ep.stories[0].gisOverlayIds = [""];
  assert.ok(schema.validate(ep).some((e) => /gisOverlayIds/.test(e)));
});

await t("onMapMoveEnd refreshes a live query overlay and is wired to map moveend", async () => {
  const globeSrc = fs.readFileSync(path.join(root, "js/globe.js"), "utf8");
  assert.match(globeSrc, /map\.on\("moveend"/);
  assert.match(globeSrc, /GD\.gis\.onMapMoveEnd/);
  gis.load({ schema: "globedesk.gis-registry/1", liveDefault: false, layers: [J(workingQuery)] });
  gis.setLiveEnabled(true);
  const on = gis.setOverlay({ id: "test-query", on: true });
  assert.equal(on.ok, true, on.error);
  ctx.window.GD.globe = {
    st: {
      map: {
        getZoom: () => 12,
        getBounds: () => ({ getWest: () => -88, getSouth: () => 41, getEast: () => -87, getNorth: () => 42 })
      }
    }
  };
  let fetches = 0;
  const okFetch = () => {
    fetches++;
    return { status: 200, headers: { get: () => "application/geo+json" }, text: () => Promise.resolve(fx("healthy-geojson.json")) };
  };
  const out = await gis.onMapMoveEnd(okFetch);
  assert.equal(fetches, 1);
  assert.equal(out[0].ok, true, out[0].reason);
  gis.setLiveEnabled(false);
  const quiet = await gis.onMapMoveEnd(okFetch);
  assert.deepEqual(quiet, []);
  assert.equal(fetches, 1);
  gis.setLiveEnabled(true);
  gis.state.overlaysOn["test-query"] = false;
  const off = await gis.onMapMoveEnd(okFetch);
  assert.deepEqual(off, []);
  assert.equal(fetches, 1);

  gis.state.overlaysOn["test-query"] = true;
  gis.state.health["test-query"] = { token: "ok", reason: "ok:1", at: 0 };
  const burst = [];
  for (let i = 0; i < 50; i++) burst.push(gis.onMapMoveEnd(okFetch));
  const burstOut = await Promise.all(burst);
  assert.equal(fetches, 2);
  assert.equal(burstOut.length, 50);
  assert.equal(burstOut[0].length, 1);
  assert.equal(burstOut[0][0].ok, true, burstOut[0][0] && burstOut[0][0].reason);
  burstOut.forEach((rows) => assert.equal(rows, burstOut[0]));

  const downFetch = () => { fetches++; return Promise.resolve({ status: 500, headers: { get: () => "text/plain" }, text: () => Promise.resolve("plain failure") }); };
  gis.state.overlaysOn["test-query"] = true;
  gis.state.health["test-query"] = { token: "off", reason: "", at: 0 };
  const down = await gis.onMapMoveEnd(downFetch);
  assert.equal(fetches, 3);
  assert.equal(down[0].ok, false);
  assert.equal(gis.gisStatus({ id: "test-query" }).result.status, "error");
  const noRetry = await gis.onMapMoveEnd(downFetch);
  assert.deepEqual(noRetry, []);
  assert.equal(fetches, 3);

  gis.setLiveEnabled(false);
  delete ctx.window.GD.globe;
});


await t("official GIS overlays stay off by default and use only approved tile URLs", async () => {
  assert.equal(fixture.liveDefault, false);
  gis.load(J(fixture));
  assert.equal(gis.isLiveEnabled(), false);
  assert.equal(gis.byId("usgs-topo").kind, "raster");
  assert.equal(gis.byId("ohm").status, "unknown");
  const refused = gis.setOverlay({ id: "usgs-topo", on: true });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /live GIS is off/);
  gis.setLiveEnabled(true);
  const on = gis.setOverlay({ id: "usgs-topo", on: true });
  assert.equal(on.ok, true, on.error);
  assert.equal(gis.rasterTileUrl(gis.byId("usgs-topo")), "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}");
  const radar = gis.byId("nowcoast-radar");
  assert.equal(gis.rasterTileUrl(radar), gis.wmsGetMap(radar.sourceUrl, radar.wmsLayer));
  const text = JSON.stringify(fixture);
  assert.equal(text.includes("nominatim"), false);
  assert.equal(text.includes("geocoding.geo.census.gov"), false);
  assert.equal(text.includes("openstreetmap.org/search"), false);
  assert.equal(/services\.arcgis\.com|arcgisonline/i.test(text), false);
  const ohm = gis.byId("ohm");
  assert.equal(JSON.stringify(ohm).includes("http"), false);
  gis.setLiveEnabled(false);
  assert.equal(gis.state.overlaysOn["usgs-topo"], false);
});


await t("repeated raster tile errors mark the overlay down, switch it off, and drop the source", () => {
  const official = J(fixture);
  gis.load(official);
  gis.setLiveEnabled(true);
  const layer = gis.byId("usgs-topo");
  assert.ok(layer);
  gis.setOverlay({ id: "usgs-topo", on: true });
  const sources = {}, layers = {};
  const map = {
    getSource: (id) => sources[id] || null,
    getLayer: (id) => layers[id] || null,
    addSource: (id, spec) => { sources[id] = Object.assign({ setTiles(tiles) { this.tiles = tiles; } }, spec); },
    addLayer: (spec) => { layers[spec.id] = spec; },
    removeLayer: (id) => { delete layers[id]; },
    removeSource: (id) => { delete sources[id]; },
    setLayoutProperty: () => {}
  };
  ctx.window.GD.globe = { st: { map: map } };
  gis.syncMap(map);
  assert.ok(sources["gd-gis-usgs-topo"]);
  ctx.window.GD.ui = { toast() {} };
  for (let i = 0; i < gis.TILE_ERROR_LIMIT; i++) {
    const handled = gis.noteTileError({ sourceId: "gd-gis-usgs-topo", error: { message: "Failed to fetch" } });
    assert.equal(handled, true);
  }
  assert.equal(gis.state.overlaysOn["usgs-topo"], false);
  assert.equal(gis.tokenFor(layer), "error");
  assert.equal(sources["gd-gis-usgs-topo"], undefined);
  gis.setLiveEnabled(false);
  delete ctx.window.GD.globe;
});

await t("when a live overlay goes down its switches uncheck at once, without a panel redraw", () => {
  gis.load(J(fixture));
  gis.setLiveEnabled(true);
  gis.setOverlay({ id: "usgs-mrds", on: true });
  const sources = {}, layers = {};
  const map = {
    getSource: (id) => sources[id] || null, getLayer: (id) => layers[id] || null,
    addSource: (id, spec) => { sources[id] = Object.assign({ setTiles(tiles) { this.tiles = tiles; } }, spec); },
    addLayer: (spec) => { layers[spec.id] = spec; }, removeLayer: (id) => { delete layers[id]; }, removeSource: (id) => { delete sources[id]; },
    setLayoutProperty: () => {}
  };
  ctx.window.GD.globe = { st: { map: map } };
  gis.syncMap(map);
  const mk = (attr) => {
    const status = { textContent: "on" };
    const row = { cls: new Set(["lp-row", "on"]), classList: { remove(c) { row.cls.delete(c); } }, querySelector: (q) => (q === ".gis-status" ? status : null) };
    const input = { attr, checked: true, aria: "true", setAttribute(k, v) { if (k === "aria-checked") this.aria = v; }, closest: (q) => (q === "label" ? row : null) };
    return { input, row, status };
  };
  const panel = mk("data-lp-gis"), inspector = mk("data-gis"), other = mk("data-lp-gis");
  const prevDoc = ctx.window.document;
  ctx.window.document = {
    querySelectorAll: (sel) => [panel, inspector, other]
      .filter((x) => (x === other ? sel.includes('"usgs-topo"') : sel.includes("[" + x.input.attr + '="usgs-mrds"]')))
      .map((x) => x.input)
  };
  ctx.window.GD.ui = { toast() {} };
  let redraws = 0;
  ctx.window.GD.layersPanel = { render() { redraws++; } };
  for (let i = 0; i < gis.TILE_ERROR_LIMIT; i++) gis.noteTileError({ sourceId: "gd-gis-usgs-mrds", error: { message: "Failed to fetch" } });
  assert.equal(gis.state.overlaysOn["usgs-mrds"], false);
  for (const x of [panel, inspector]) {
    assert.equal(x.input.checked, false);
    assert.equal(x.input.aria, "false");
    assert.equal(x.row.cls.has("on"), false);
    assert.equal(x.status.textContent, "down / skipped");
  }
  assert.equal(other.input.checked, true, "other overlays' switches are untouched");
  assert.equal(redraws, 0, "no panel redraw needed");
  assert.equal(gis.reflectSwitchOff('x"], body, [a="'), 0, "odd ids never reach a selector");
  ctx.window.document = prevDoc;
  delete ctx.window.GD.layersPanel;
  gis.setLiveEnabled(false);
  delete ctx.window.GD.globe;
});

console.log("\n" + n + " tests passed");
