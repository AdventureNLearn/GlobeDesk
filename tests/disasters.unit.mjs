// Disasters layer (Volcanoes, earthquakes and disasters): records, overview, cross-links and validator rules.
// Pure Node; no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { validateAtlas } from "../tools/atlas/validate.mjs";
import { disasterRules, disasterOverviewRules, gvpProblems } from "../tools/atlas/disasters-rules.mjs";
import { JR } from "../tools/atlas/lib.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Bells = require("../js/atlas/bells-layer.js");
const Layer = require("../js/atlas/disasters-layer.js");
const Card = require("../js/atlas/disasters-card.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const clone = (x) => JSON.parse(JSON.stringify(x));

const js = readFileSync(new URL("../js/atlas/atlas-data.js", import.meta.url), "utf8");
const vctx = { window: {} }; vm.createContext(vctx); vm.runInContext(js, vctx);
const D = clone(vctx.window.GD.atlasData);
const byId = new Map(D.entries.map((e) => [e.id, e]));
const events = D.entries.filter((e) => e.layer === "disasters" && e.kind === "event");
const sourceById = new Map(D.sources.map((s) => [s.id, s]));
const others = D.entries.filter((e) => e.layer !== "disasters");
const ctx = { sourceById, disasterSchema: JR("schema/globedesk-disaster.schema.json"), overviewSchema: JR("schema/globedesk-disaster-overview.schema.json"),
  entryById: byId, others, layerIds: events.map((e) => e.id) };
const rec = (id) => clone(D.records[byId.get(id).record]);
const ov = () => clone(D.records["data/atlas/disasters/disasters-overview.json"]);

t("the whole atlas validates (disasters included)", () => assert.deepEqual(validateAtlas(), []));
t("first batch: Krakatau, Tambora, Vesuvius, Lisbon as new records; each cites NCEI as official", () => {
  assert.deepEqual(events.map((e) => e.id).sort(), ["krakatau-1883", "lisbon-1755", "tambora-1815", "vesuvius-79"]);
  events.forEach((e) => { const r = rec(e.id); assert.ok(r.official_sources.includes(r.ncei.dataset)); assert.equal(r.place.approximate, true); assert.match(e.places[0].note, /approximate/); });
});
t("Mount St. Helens 1980 and San Francisco 1906 are cross-linked, not duplicated", () => {
  const o = ov();
  ["mount-st-helens-1980", "san-francisco-earthquake-1906"].forEach((id) => {
    assert.ok(o.members.some((m) => m.id === id && m.linked));
    assert.equal(byId.get(id).pack, "history-places"); assert.equal(byId.get(id).layer, undefined);
    assert.equal(D.entries.filter((e) => e.id === id).length, 1);
  });
});
t("back-links: the two existing events link to the overview, and the overview links back to them", () => {
  ["mount-st-helens-1980", "san-francisco-earthquake-1906"].forEach((id) => {
    assert.deepEqual(byId.get(id).related, [{ type: "see-also", to: "disasters-overview" }]);
    assert.ok(byId.get("disasters-overview").related.some((r) => r.to === id));
  });
});
t("NCEI and USGS death tolls that differ are kept as people-disagree claims", () => {
  ["tambora-1815", "vesuvius-79"].forEach((id) => assert.ok(rec(id).claims.some((c) => c.status === "people-disagree" && c.positions.length === 2)));
  assert.ok(rec("lisbon-1755").claims.some((c) => /fault/.test(c.text) && c.status === "people-disagree"));
});
t("Vesuvius points to the Ancient-world Pompeii entry by id only", () => assert.deepEqual(byId.get("vesuvius-79").see_also_ids, ["ancient-pompeii"]));
t("two stories, every step opens an Atlas entry and cites a source", () => {
  const o = ov(); assert.equal(o.stories.length, 2);
  o.stories.forEach((s) => s.steps.forEach((x) => { assert.ok(byId.has(x.entry)); assert.ok(x.sources.length && x.sources.every((id) => sourceById.has(id))); }));
});
t("no Smithsonian GVP source anywhere in the registry", () => assert.ok(D.sources.every((s) => !/volcano\.si\.edu|smithsonian/i.test(s.url || ""))));
t("rule: a fact citing a source not in the record is caught", () => {
  const r = rec("krakatau-1883"); r.facts.push({ text: "x", source: "usgs-1906" });
  assert.ok(disasterRules(byId.get("krakatau-1883"), r, { ...ctx }).some((p) => /not listed in the record's sources/.test(p)));
});
t("rule: a GVP source is refused", () => {
  const r = rec("krakatau-1883"); r.sources.push("gvp-test");
  const sb = new Map(sourceById); sb.set("gvp-test", { id: "gvp-test", url: "https://volcano.si.edu/x", class: "reference" });
  assert.ok(disasterRules(byId.get("krakatau-1883"), r, { ...ctx, sourceById: sb }).some((p) => /Smithsonian GVP/.test(p)));
});
t("rule: a GVP link or name in any free text is refused; the 'not used' notices are allowed", () => {
  const K = "krakatau-1883", e = byId.get(K);
  const hit = (mut, re) => { const r = rec(K); mut(r); assert.ok(disasterRules(e, r, ctx).some((p) => re.test(p)), re.source); };
  hit((r) => { r.facts[0].text += " See https://volcano.si.edu/volcano.cfm?vn=262000"; }, /links Smithsonian GVP/);
  hit((r) => { r.tiers.student += " (Smithsonian GVP lists more.)"; }, /names Smithsonian GVP/);
  hit((r) => { r.measures[0].label = "GVP VEI"; }, /names Smithsonian GVP/);
  hit((r) => { r.claims[0].text = "Per the Global Volcanism Program, 36,000 died."; }, /names Smithsonian GVP/);
  hit((r) => { r.unknowns.push("Smithsonian GVP has more"); }, /names Smithsonian GVP/);
  const en = clone(e); en.summary += " volcano.si.edu"; assert.ok(disasterRules(en, rec(K), ctx).some((p) => /entry: \/summary links Smithsonian GVP/.test(p)));
  const o = ov(); o.stories[0].steps[0].text += " GVP says so."; assert.ok(disasterOverviewRules(byId.get("disasters-overview"), o, ctx).some((p) => /names Smithsonian GVP/.test(p)));
  const o2 = ov(); o2.stories[0].steps[0].text = "see volcano.si.edu"; assert.ok(disasterOverviewRules(byId.get("disasters-overview"), o2, ctx).some((p) => /links Smithsonian GVP/.test(p)));
  hit((r) => { r.unknowns.push("Present-day activity: [UNKNOWN]; Smithsonian GVP lists it"); }, /outside the exact notice sentence/);
  hit((r) => { r.unknowns.push("GVP is not used here, but its VEI is 6"); }, /outside the exact notice sentence/);
  hit((r) => { r.unknowns[1] += " GVP says more."; }, /outside the exact notice sentence/);
  hit((r) => { r.facts[0].text += " (Smithsonian GVP not used; its terms are [UNKNOWN])"; }, /outside the exact notice sentence/);
  const ox = ov(); ox.excluded[0].name = "Smithsonian Global Volcanism Program (not used)"; assert.ok(disasterOverviewRules(byId.get("disasters-overview"), ox, ctx).some((p) => /outside the exact notice sentence/.test(p)));
  assert.deepEqual(gvpProblems(ov(), "ov"), []); events.forEach((x) => assert.deepEqual(gvpProblems(rec(x.id), x.id).concat(gvpProblems(x, x.id)), []));
  assert.ok(rec(K).unknowns.some((u) => /GVP/.test(u)));
});
t("rule: a people-disagree claim needs two positions from different sources", () => {
  const r = rec("tambora-1815"); r.claims[0].positions = [r.claims[0].positions[0]];
  assert.ok(disasterRules(byId.get("tambora-1815"), r, ctx).some((p) => /people-disagree/.test(p)));
});
t("rule: a new record on top of an existing event (same year, within 1°) is refused as a duplicate", () => {
  const r = rec("krakatau-1883"); const e = clone(byId.get("krakatau-1883"));
  Object.assign(r.place, { lat: 46.2, lng: -122.18 }); r.date.date = "1980-05-18"; e.places[0] = { ...e.places[0], lat: 46.2, lng: -122.18 }; e.dates[0].date = "1980-05-18";
  assert.ok(disasterRules(e, r, ctx).some((p) => /duplicates existing entry mount-st-helens-1980/.test(p)));
});
t("rule: an earthquake must cite the NCEI earthquake database", () => {
  const r = rec("lisbon-1755"); r.ncei.dataset = "ncei-sig-volcanoes";
  assert.ok(disasterRules(byId.get("lisbon-1755"), r, ctx).some((p) => /NCEI earthquake database/.test(p)));
});
t("rule: overview counts and story links are checked", () => {
  const o = ov(); o.counts.eruption = 99; o.stories[0].steps[0].entry = "no-such-entry";
  const p = disasterOverviewRules(byId.get("disasters-overview"), o, ctx);
  assert.ok(p.some((x) => /counts do not match/.test(x))); assert.ok(p.some((x) => /no-such-entry/.test(x)));
});

t("layer: six pins (4 new + 2 cross-linked from their own entries), all approximate, hazard filter works", () => {
  const ps = Layer.pins(D);
  assert.equal(ps.length, 6); assert.ok(ps.every((p) => p.approximate));
  const msh = ps.find((p) => p.id === "mount-st-helens-1980"); assert.ok(msh.linked); assert.equal(msh.lat, byId.get("mount-st-helens-1980").places[0].lat);
  assert.equal(Layer.filter(ps, { hazard: "earthquake" }).map((p) => p.id).sort().join(), "lisbon-1755,san-francisco-earthquake-1906");
  assert.equal(Layer.filter(ps, { hazard: "eruption" }).length, 4);
});
t("layer: reuses the Bells clusters (the two Indonesian volcanoes group at zoom 0, split at zoom 9) and is off by default", () => {
  const id = Layer.pins(D).filter((p) => p.id === "krakatau-1883" || p.id === "tambora-1815");
  assert.equal(Bells.cluster(id, 0).length, 1); assert.equal(Bells.cluster(id, 9).length, 2);
  assert.equal(Layer.st.on, false); assert.equal(Layer.KEY, "globedesk.disasters.v1"); assert.notEqual(Layer.KEY, Bells.KEY);
});
t("layer: panel section lists the counts and the NCEI credit", () => {
  globalThis.GD.atlasData = D;
  const h = Layer.panelHtml(); assert.match(h, /id="lpDisasters"/); assert.match(h, /6 of 6 events shown/); assert.match(h, /NOAA NCEI/); assert.match(h, /lpDisastersHazard/);
});
t("card: a record shows every measure with its source, the approximate pin and the disputed claim", () => {
  const helpers = { esc: (s) => String(s), srcLink: (id) => "<a>" + id + "</a>", entryLink: (id) => "<b>" + id + "</b>" };
  const h = Card.html(rec("tambora-1815"), helpers);
  assert.match(h, /approximate pin/); assert.match(h, /People disagree/); assert.match(h, /92,000/); assert.match(h, /60,000/);
  rec("tambora-1815").measures.forEach((m) => assert.ok(h.includes(m.value + ' <span class="muted">· <a>' + m.source + "</a>")));
  const o = Card.html(ov(), helpers);
  assert.match(o, /existing Atlas event/); assert.equal((o.match(/data-dl-story=/g) || []).length, 2); assert.match(o, /Smithsonian Global Volcanism Program/);
  assert.equal(Card.html({ schema: "globedesk.bell/1" }, helpers), "");
});
console.log(`disasters.unit: ${n} passed`);
