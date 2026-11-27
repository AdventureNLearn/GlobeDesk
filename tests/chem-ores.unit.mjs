// Chem index C4: USGS MCS 2026 producing countries (CC0) and the live USGS MRDS map service.
// Country pins are country points, not mines. MRDS is live only from mrdata.usgs.gov, off by default,
// never cached or bundled, and skipped as unavailable when the host is down. Pure Node; no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const Layer = require("../js/atlas/chem-ores-layer.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };

const js = readFileSync(new URL("../js/atlas/atlas-data.js", import.meta.url), "utf8");
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(js, ctx);
const D = JSON.parse(JSON.stringify(ctx.window.GD.atlasData));
const rec = D.records[Layer.REC];
const reg = JSON.parse(readFileSync(new URL("../data/gis-registry.json", import.meta.url), "utf8"));
const mrds = reg.layers.find((l) => l.id === "usgs-mrds");

t("MCS record is bundled, CC0, cites the USGS data release, and keeps USGS values as printed", () => {
  assert.ok(rec);
  assert.equal(rec.source, "usgs-mcs-2026-data");
  assert.match(rec.licence, /CC0/);
  const src = D.sources.find((s) => s.id === "usgs-mcs-2026-data");
  assert.ok(src && src.class === "official" && /CC0/.test(src.license));
  const cu = rec.byElement["copper-element"];
  assert.equal(cu.commodity, "Copper");
  assert.equal(cu.unit, "thousand metric tons");
  assert.equal(cu.countries[0].country, "Chile");
  assert.equal(cu.countries[0].value, "5,300");
  assert.equal(cu.world_total, "23,000");
  for (const e of Object.values(rec.byElement)) {
    for (const c of e.countries) {
      assert.notEqual(c.country, "World total");
      assert.notEqual(c.country, "Other countries");
      assert.notEqual(c.value, "—");
      if (c.n == null) assert.doesNotMatch(c.value, /^\d/);
    }
  }
  assert.ok(rec.left_out.some((x) => /Rare Earths/.test(x)));
  assert.equal(rec.byElement["neodymium-element"], undefined, "mixed rare-earth totals are not split per element");
});

t("layer: off by default, pins are ranked country points sized by the USGS figure", () => {
  assert.equal(Layer.st.on, false);
  const list = Layer.elements(D);
  assert.equal(list.length, Object.keys(rec.byElement).length);
  assert.ok(list[0].z < list[list.length - 1].z);
  const p = Layer.pins(D, "lithium-element");
  assert.ok(p.length >= 5);
  assert.equal(p[0].country, "Australia");
  assert.equal(p[0].size, 4);
  p.forEach((x) => assert.ok(x.size >= 1 && x.size <= 4));
  assert.equal(Layer.pins(D, "oganesson-element").length, 0);
  const s = Layer.summary(D, "gold-element", 3);
  assert.equal(s.top.length, 3);
  const src = readFileSync(new URL("../js/atlas/chem-ores-layer.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|\.style\.|style="/);
});

t("MRDS registry row: live, working, off by default, exact host, quoted terms, not year-hidden", () => {
  assert.equal(reg.liveDefault, false);
  assert.ok(mrds);
  assert.equal(mrds.kind, "raster");
  assert.equal(mrds.status, "working");
  assert.equal(mrds.runtime, true);
  assert.equal(new URL(mrds.tiles.replace(/\{[^}]+\}/g, "0")).hostname, "mrdata.usgs.gov");
  assert.equal(new URL(mrds.sourceUrl).hostname, "mrdata.usgs.gov");
  assert.match(mrds.terms, /Access_Constraints: none/);
  assert.match(mrds.terms, /Use_Constraints: none/);
  assert.match(mrds.terms, /never cached or bundled/);
  assert.equal(mrds.termsUrl, "https://mrdata.usgs.gov/metadata/mrds.faq.html");
  assert.equal(mrds.yearKind, undefined);
  assert.match(mrds.tiles, /BBOX=\{bbox-epsg-3857\}/);
});

t("CSP adds only https://mrdata.usgs.gov, to img-src and connect-src, in index, serve.py and serve.ps1", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  const dir = (name) => (csp.split(";").map((x) => x.trim()).find((x) => x.startsWith(name + " ")) || "");
  assert.match(dir("img-src"), /https:\/\/mrdata\.usgs\.gov(\s|$)/);
  assert.match(dir("connect-src"), /https:\/\/mrdata\.usgs\.gov(\s|$)/);
  for (const d of ["default-src", "script-src", "style-src", "font-src", "media-src", "frame-src", "worker-src", "form-action"]) assert.doesNotMatch(dir(d), /usgs/, d);
  assert.equal((csp.match(/mrdata\.usgs\.gov/g) || []).length, 2);
  assert.doesNotMatch(csp, /\*\.usgs\.gov|https:\/\/\*/);
  const py = readFileSync(new URL("../tools/serve.py", import.meta.url), "utf8");
  const ps = readFileSync(new URL("../tools/serve.ps1", import.meta.url), "utf8");
  assert.ok(py.includes(csp.replace(/;\s*$/, "")) || py.includes(csp));
  assert.ok(ps.includes(csp.replace(/;\s*$/, "")) || ps.includes(csp));
});

t("no MRDS or MCS data copy ships in the app; MRDS tiles are never routed through the local tile cache", () => {
  const manifest = readFileSync(new URL("../grokme/manifest.json", import.meta.url), "utf8");
  assert.doesNotMatch(manifest, /mrds|MCS2026_Commodities_Data/i);
  for (const f of ["../js/gis.js", "../js/globe.js"]) {
    let s = ""; try { s = readFileSync(new URL(f, import.meta.url), "utf8"); } catch (e) { continue; }
    assert.doesNotMatch(s, /mrdata\.usgs\.gov/, f + " hard-codes no MRDS URL");
  }
});

console.log(n + " chem ores tests ok");
