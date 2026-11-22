// Opt-in geocoding. No network. Photon URL shape, Census proxy only, off by default.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const store = {};
const ctx = {
  window: {},
  console,
  URL,
  URLSearchParams,
  AbortController,
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
vm.runInContext(fs.readFileSync(path.join(root, "js", "geocode.js"), "utf8"), ctx);
const geo = ctx.window.GD.geocode;
let n = 0;
const t = (name, fn) => { const r = fn(); if (r && typeof r.then === "function") return r.then(() => { n++; console.log("ok -", name); }); n++; console.log("ok -", name); return Promise.resolve(); };

await t("address search is off by default and does not fetch", async () => {
  geo.resetForTests();
  assert.equal(geo.isLive(), false);
  let fetches = 0;
  const out = await geo.searchOnline("Washington", { fetcher: () => { fetches++; return Promise.resolve({ ok: true, json: () => Promise.resolve({ features: [] }) }); } });
  assert.equal(out.reason, "off");
  assert.equal(out.hits.length, 0);
  assert.equal(fetches, 0);
});

await t("Photon URL uses the official demo path, a cap of 5, and no Nominatim host", () => {
  const url = geo.photonUrl("National Mall");
  assert.equal(url, "https://photon.komoot.io/api/?q=National%20Mall&limit=5");
  assert.equal(/nominatim/i.test(url), false);
  assert.equal(geo.photonUrl("  "), null);
});

await t("Census queries go only to the same-origin serve.py proxy", () => {
  const url = geo.censusProxyUrl("1600 Pennsylvania Ave NW");
  assert.equal(url, "/api/geocode/census?address=1600%20Pennsylvania%20Ave%20NW");
  assert.equal(url.includes("geocoding.geo.census.gov"), false);
  const src = fs.readFileSync(path.join(root, "js", "geocode.js"), "utf8");
  assert.equal(src.includes("nominatim.openstreetmap.org"), false);
  assert.equal(src.includes("geocoding.geo.census.gov"), false);
});

await t("Photon and Census bodies parse to lat/lon hits with required credit", () => {
  const photon = geo.parsePhoton({
    features: [{ type: "Feature", geometry: { type: "Point", coordinates: [-77.0365, 38.8977] }, properties: { name: "White House", city: "Washington", country: "United States" } }]
  });
  assert.equal(photon.length, 1);
  assert.equal(photon[0].lat, 38.8977);
  assert.equal(photon[0].lon, -77.0365);
  assert.equal(photon[0].source, "photon");
  assert.match(photon[0].credit, /OpenStreetMap/);
  const census = geo.parseCensus({
    result: { addressMatches: [{ matchedAddress: "1600 PENNSYLVANIA AVE NW", coordinates: { x: -77.0365, y: 38.8977 } }] }
  });
  assert.equal(census[0].lat, 38.8977);
  assert.equal(census[0].lon, -77.0365);
  assert.match(census[0].credit, /not endorsed or certified by the Census Bureau/);
});

await t("a live search uses Photon and only adds the Census proxy when that opt-in is on", async () => {
  geo.resetForTests();
  geo.setLive(true);
  const seen = [];
  const photonDoc = { features: [{ type: "Feature", geometry: { type: "Point", coordinates: [2.35, 48.85] }, properties: { name: "Paris" } }] };
  const fetcher = (url) => {
    seen.push(url);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(url.indexOf("photon") >= 0 ? photonDoc : { result: { addressMatches: [] } }) });
  };
  const out = await geo.searchOnline("Paris", { fetcher });
  assert.equal(out.hits.length, 1);
  assert.equal(out.hits[0].name.includes("Paris"), true);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].startsWith("https://photon.komoot.io/api/"), true);
  geo.setCensusEnabled(true);
  const seen2 = [];
  const fetcher2 = (url) => { seen2.push(url); return fetcher(url); };
  await geo.searchOnline("Paris 2", { fetcher: fetcher2 });
  assert.equal(seen2.some((u) => u.startsWith("/api/geocode/census?")), true);
  assert.equal(seen2.some((u) => u.includes("geocoding.geo.census.gov")), false);
});


await t("Photon needs at least three characters and Census-only search does not call Photon", async () => {
  geo.resetForTests();
  geo.setLive(true);
  let fetches = 0;
  const fetcher = () => { fetches++; return Promise.resolve({ ok: true, json: () => Promise.resolve({ features: [] }) }); };
  const short = await geo.searchOnline("W", { fetcher });
  assert.equal(short.reason, "short");
  assert.equal(fetches, 0);
  geo.resetForTests();
  geo.setCensusEnabled(true);
  const seen = [];
  const out = await geo.searchOnline("National Mall", { fetcher: (url) => { seen.push(url); return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { addressMatches: [] } }) }); } });
  assert.equal(seen.some((u) => u.includes("photon.komoot.io")), false);
  assert.equal(seen.some((u) => u.startsWith("/api/geocode/census?")), true);
  assert.equal(out.reason === "ok" || out.reason === "cache", true);
});

await t("a new Photon search aborts the previous in-flight request", async () => {
  geo.resetForTests();
  geo.setLive(true);
  let aborted = 0;
  const fetcher = (url, opts) => {
    if (url.includes("First")) {
      return new Promise((resolve, reject) => {
        if (opts && opts.signal) {
          opts.signal.addEventListener("abort", () => { aborted++; reject(Object.assign(new Error("aborted"), { name: "AbortError" })); });
        }
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ features: [] }) });
  };
  const pending = geo.searchOnline("First query", { fetcher });
  const second = await geo.searchOnline("Second query", { fetcher });
  assert.ok(aborted >= 1);
  assert.equal(second.reason === "ok" || second.reason === "cache", true);
  const firstOut = await pending;
  assert.equal(firstOut.reason, "superseded");
});

console.log(n + " geocode tests ok");
