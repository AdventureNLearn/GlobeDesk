// Bells layer: the worldwide bell records, the parametric bell model, the layer's pins, filters and clusters,
// and the validator rules for bells. Pure Node; no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { validateSchema } from "./jsonschema-lite.mjs";
import { validateAtlas, bellRules } from "../tools/atlas/validate.mjs";
import { J, JR } from "../tools/atlas/lib.mjs";
const require = createRequire(import.meta.url);
const Bell = require("../js/atlas/models/bell.js");
const Layer = require("../js/atlas/bells-layer.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const errs = (r) => (Array.isArray(r) ? r : (r && r.errors) || []);

const js = readFileSync(new URL("../js/atlas/atlas-data.js", import.meta.url), "utf8");
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(js, ctx);
const D = JSON.parse(JSON.stringify(ctx.window.GD.atlasData));
const bells = D.entries.filter((e) => e.layer === "bells" && e.kind === "object");
const rec = (e) => D.records[e.record];
const sources = new Map(D.sources.map((s) => [s.id, s]));
const schema = JR("schema/globedesk-bell.schema.json");

t("the whole atlas validates (bells included)", () => assert.deepEqual(validateAtlas(), []));
t("40-60 bells on every inhabited continent, each with a record in the bundle", () => {
  assert.ok(bells.length >= 40 && bells.length <= 60, String(bells.length));
  const regions = new Set(bells.map((e) => rec(e).region));
  for (const r of Layer.REGIONS) assert.ok(regions.has(r), r);
  bells.forEach((e) => assert.ok(rec(e), e.id));
});
t("the history pack's stable bell ids exist here and are owned by the Bells pack", () => {
  for (const id of ["liberty-bell", "old-north-bells", "centennial-bell", "justice-bell", "bicentennial-bell"]) {
    const e = D.entries.find((x) => x.id === id);
    assert.ok(e, id); assert.equal(e.pack, "bells"); assert.equal(e.layer, "bells");
  }
  assert.equal(new Set(D.entries.map((e) => e.id)).size, D.entries.length);
});
t("every record matches its schema; every fact cites a registered source with publisher and licence", () => {
  bells.forEach((e) => {
    const r = rec(e);
    assert.deepEqual(errs(validateSchema(schema, r)), [], e.id);
    r.sources.forEach((id) => { const s = sources.get(id); assert.ok(s && s.publisher && s.license && /^https:\/\//.test(s.url), id); });
    r.timeline.forEach((x) => assert.ok(r.sources.includes(x.source), e.id + " " + x.event));
  });
});
t("an official or primary source for each bell, or low confidence; Wikipedia never the only source", () => {
  bells.forEach((e) => {
    const r = rec(e);
    const strong = r.sources.some((id) => sources.get(id).class === "official" || sources.get(id).primary === true);
    assert.ok(strong || r.confidence === "low", e.id);
    assert.ok(!r.sources.every((id) => /wikipedia\.org/.test(sources.get(id).url)), e.id);
  });
});
t("bell-bronze is in Chemistry and every bell links made-of to it; no living subjects", () => {
  const bb = D.entries.find((e) => e.id === "bell-bronze");
  assert.ok(bb && bb.category_path[0] === "chemistry");
  bells.forEach((e) => { assert.ok(e.related.some((r) => r.type === "made-of" && r.to === "bell-bronze"), e.id); assert.equal(e.subject_person_living, false); });
  const ov = D.entries.find((e) => e.id === "bells-overview");
  const o = D.records[ov.record];
  for (const s of ["bianzhong", "bonsho", "church", "carillons", "russia", "change-ringing", "ship-civic", "modern", "casting"]) assert.ok(o.sections.some((x) => x.id === s), s);
});
t("bell model: sourced dimensions scale the profile; missing height and wall are flagged assumptions", () => {
  const L = Bell.layout({ diameter_m: 2.7, height_m: 2.2 });
  assert.equal(L.kind, "bell"); assert.equal(L.diameter, 2700); assert.equal(L.height, 2200);
  assert.deepEqual(L.assumed, { height: false, thickness: true });
  assert.ok(L.profile.length > 8 && L.profile.every(([r, y]) => r >= 0 && y >= 0 && r <= 1350.1 && y <= 2200.1));
  const G = Bell.layout({ diameter_m: 1 });
  assert.equal(G.height, 800); assert.ok(G.assumed.height && G.assumed.thickness);
  assert.equal(Bell.layout({ diameter_m: 1, height_m: 10 }).height, 2000, "height clamped to 2 x diameter");
  assert.throws(() => Bell.layout({}), /diameter/);
  assert.equal(typeof Bell.build, "function");
});
t("every bell with a 3D model has usable parameters; sourced ones use the record's diameter", () => {
  bells.filter((e) => rec(e).model.available).forEach((e) => {
    const r = rec(e); const L = Bell.layout(r.model.params || { diameter_m: 1 });
    assert.ok(L.diameter > 0, e.id);
    if (r.model.from_sources) assert.equal(r.model.params.diameter_m, r.diameter_m, e.id);
  });
  assert.ok(rec(bells.find((e) => e.id === "big-ben-great-bell")).model.from_sources);
  assert.equal(rec(bells.find((e) => e.id === "mechelen-carillons")).model.available, false, "carillons are not one bell");
});
t("layer pins: one per bell, approximate pins flagged, filters by era and region", () => {
  const P = Layer.pins(D);
  assert.equal(P.length, bells.length);
  assert.ok(P.every((p) => Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180));
  assert.equal(P.find((p) => p.id === "wilbank-bell").approximate, true);
  assert.equal(P.find((p) => p.id === "big-ben-great-bell").approximate, false);
  const eu = Layer.filter(P, { region: "Europe" });
  assert.ok(eu.length > 0 && eu.every((p) => p.region === "Europe"));
  const anc = Layer.filter(P, { era: "ancient" });
  assert.ok(anc.some((p) => p.id === "nimrud-bronze-bell") && anc.every((p) => p.era === "ancient"));
  assert.equal(Layer.filter(P, { era: "all", region: "all" }).length, P.length);
});
t("clusters: grouped at low zoom, every pin counted once, single pins at drill zoom", () => {
  const P = Layer.pins(D);
  const c1 = Layer.cluster(P, 1);
  assert.ok(c1.length < P.length / 2, String(c1.length));
  assert.equal(c1.reduce((a, c) => a + c.count, 0), P.length);
  const c9 = Layer.cluster(P, Layer.CLUSTER_BELOW);
  assert.equal(c9.length, P.length); assert.ok(c9.every((c) => c.count === 1));
  const ph = Layer.cluster(P.filter((p) => /liberty-bell|centennial-bell|justice-bell/.test(p.id)), 4);
  assert.equal(ph.length, 1, "Philadelphia bells share one cluster at zoom 4");
  const q = Layer.project(0, 0, 0); assert.deepEqual([Math.round(q.x), Math.round(q.y)], [256, 256]);
});
t("panel html lists the toggle and both filters; code has no network calls or inline styles", () => {
  const h = Layer.panelHtml();
  assert.match(h, /id="lpBells"/); assert.match(h, /id="lpBellsEra"/); assert.match(h, /id="lpBellsRegion"/);
  for (const f of ["js/atlas/bells-layer.js", "js/atlas/models/bell.js"]) {
    const s = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.doesNotMatch(s, /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/, f); assert.doesNotMatch(s, /style="/, f);
  }
});
t("validator rejects a Wikipedia-only bell, an unflagged approximate pin and a sourced model with no diameter", () => {
  const e = JSON.parse(JSON.stringify(D.entries.find((x) => x.id === "big-ben-great-bell")));
  const r = JSON.parse(JSON.stringify(rec(e)));
  const srcs = J("packs/core/sources.json").sources;
  const c = { sourceById: new Map(srcs.map((s) => [s.id, s])), bellSchema: schema };
  assert.deepEqual(bellRules(e, r, c), []);
  const wiki = srcs.find((s) => /wikipedia\.org/.test(s.url));
  const w = JSON.parse(JSON.stringify(r)); w.sources = [wiki.id]; w.timeline = []; w.official_sources = []; w.official_status = "[UNKNOWN]"; w.confidence = "low";
  assert.ok(bellRules(e, w, c).some((x) => /Wikipedia/.test(x)));
  const a = JSON.parse(JSON.stringify(r)); a.place.approximate = true;
  assert.ok(bellRules(e, a, c).some((x) => /approximate/.test(x)));
  const m = JSON.parse(JSON.stringify(r)); m.diameter_m = null;
  assert.ok(bellRules(e, m, c).some((x) => /diameter/.test(x)));
});
console.log(`${n} bells tests ok`);
