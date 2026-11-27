// Element places layer (chem index C3): Wikidata CC0 points, cited coordinates only, no people,
// places, no people (labs, towns or cities, country or region points), off by default. Pure Node; no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const Layer = require("../js/atlas/chem-sites-layer.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };

const js = readFileSync(new URL("../js/atlas/atlas-data.js", import.meta.url), "utf8");
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(js, ctx);
const D = JSON.parse(JSON.stringify(ctx.window.GD.atlasData));
const rec = D.records[Layer.REC];
const src = (D.sources || []).find((s) => s.id === "wikidata-element-sites");

t("the record is bundled, CC0, and every place cites its own Wikidata coordinate", () => {
  assert.ok(rec, "element-sites record bundled");
  assert.equal(rec.schema, "globedesk.chem/0-draft");
  assert.match(rec.licence, /CC0/);
  assert.ok(src && /CC0/.test(src.license));
  assert.ok(rec.places.length >= 30);
  for (const p of rec.places) {
    assert.match(p.qid, /^Q\d+$/);
    assert.equal(p.coordinate, "Wikidata P625 of " + p.qid);
    assert.equal(p.url, "https://www.wikidata.org/wiki/" + p.qid);
    assert.ok(["site", "city", "area"].includes(p.scale), p.label);
    assert.ok(p.links.length >= 1);
    for (const l of p.links) assert.ok(["namesake", "discovery-location", "discoverer"].includes(l.rel));
  }
});

t("people are never pinned; discoverer pins are institutions only; Moon and myths are excluded", () => {
  for (const p of rec.places) {
    assert.equal(p.kinds.includes("human"), false, p.label);
    if (p.links.some((l) => l.rel === "discoverer")) assert.match(p.kinds.join(" "), /institute|laborator|university|college|academic|organization|agency|society/i, p.label);
  }
  const ex = new Map(rec.excluded.map((e) => [e.qid, e]));
  assert.equal(ex.get("Q405").reason, "coordinate is not on Earth");
  assert.equal(ex.get("Q42952").reason, "not a real-world place");
  for (const e of rec.excluded.filter((x) => /person/.test(x.reason))) assert.equal(e.label, "[person not named]");
  assert.ok(rec.places.some((p) => p.label === "Joint Institute for Nuclear Research" && p.scale === "site"));
  assert.ok(rec.places.some((p) => p.label === "Ytterby mine" && p.links.map((l) => l.symbol).join(",") === "Y,Tb,Er,Yb"));
});

t("layer pins, filters and clusters; area pins stay flagged", () => {
  const all = Layer.pins(D);
  assert.equal(all.length, rec.places.length);
  const names = Layer.filter(all, { rel: "namesake" });
  assert.ok(names.length > 0 && names.every((p) => p.links.every((l) => l.rel === "namesake")));
  const labs = Layer.filter(all, { scale: "site" });
  assert.ok(labs.every((p) => p.scale === "site"));
  const c0 = Layer.cluster(all, 0);
  assert.ok(c0.length < all.length);
  assert.equal(c0.reduce((a, c) => a + c.count, 0), all.length);
  assert.equal(Layer.cluster(all, Layer.CLUSTER_BELOW).length, all.length);
  assert.equal(Layer.pins({ records: {} }).length, 0);
});

t("off by default, panel lists counts and credit, and the code makes no network calls or inline styles", () => {
  assert.equal(Layer.st.on, false);
  const html = Layer.panelHtml.call(null);
  assert.equal(html, "", "no data in this Node context yet: panel hides");
  globalThis.GD.atlasData = D;
  const withData = Layer.panelHtml();
  delete globalThis.GD.atlasData;
  const by = (k) => rec.places.filter((p) => p.scale === k).length;
  assert.ok(withData.includes(rec.places.length + " of " + rec.places.length + " places, no people: " + by("site") + " exact sites, " + by("city") + " towns or cities, " + by("area") + " country or region points (dashed)."), withData);
  const desc = (withData.match(/<span class="lp-desc">([^<]*)</) || [])[1] || "";
  assert.doesNotMatch(desc, /\blabs?\b/i, "the layer is described as places, not labs");
  const s = readFileSync(new URL("../js/atlas/chem-sites-layer.js", import.meta.url), "utf8");
  assert.doesNotMatch(s, /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(s, /\.style\.|style="/);
  assert.match(s, /st = \{ on: false/);
  const idx = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(idx, /<script src="js\/atlas\/chem-sites-layer.js"><\/script>/);
  const lp = readFileSync(new URL("../js/layers-panel.js", import.meta.url), "utf8");
  assert.match(lp, /GD\.chemSitesLayer\.panelHtml\(\)/);
});

console.log(n + " chem sites tests ok");
