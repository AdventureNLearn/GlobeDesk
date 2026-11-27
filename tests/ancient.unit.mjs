// Ancient World data: 13 site records with approximate pins, 3 myths with no pins, sources registered with a
// licence, and the validator rules that guard them. Pure Node; no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { validateAtlas, ancientRules } from "../tools/atlas/validate.mjs";
import { JR } from "../tools/atlas/lib.mjs";
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };

const js = readFileSync(new URL("../js/atlas/atlas-data.js", import.meta.url), "utf8");
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(js, ctx);
const D = JSON.parse(JSON.stringify(ctx.window.GD.atlasData));
const pack = D.entries.filter((e) => e.pack === "ancient-world");
const rec = (e) => D.records[e.record];
const sites = pack.filter((e) => rec(e).kind === "site"), myths = pack.filter((e) => rec(e).kind === "myth");
const sourceById = new Map(D.sources.map((s) => [s.id, s]));
const vctx = { sourceById, ancientSchema: JR("schema/globedesk-ancient.schema.json") };
const clone = (x) => JSON.parse(JSON.stringify(x));

t("the whole atlas validates (Ancient World included)", () => assert.deepEqual(validateAtlas(), []));
t("the owner's first batch: 12 sites plus Palmyra, and three myths", () => {
  const want = ["ancient-ur", "ancient-giza", "ancient-mohenjo-daro", "ancient-troy", "ancient-pompeii", "ancient-goebekli-tepe", "ancient-petra",
    "ancient-teotihuacan", "ancient-caral", "ancient-qin-mausoleum", "ancient-great-zimbabwe", "ancient-merv", "ancient-palmyra"];
  assert.deepEqual(sites.map((e) => e.id).sort(), [...want].sort());
  assert.deepEqual(myths.map((e) => e.id).sort(), ["myth-atlantis", "myth-el-dorado", "myth-shangri-la"]);
  assert.ok(pack.some((e) => e.id === "ancient-world-overview"));
});
t("the pack sits under History and places and is listed in the bundle manifests", () => {
  const hp = D.categories.find((c) => c.id === "history-places");
  assert.ok(hp.extra_packs.includes("ancient-world"));
  assert.equal(D.manifests["ancient-world"].entry_count, pack.length);
});
t("all 13 sites are pinned at their cited official points (owner YES 2026-11-27); none remain held", () => {
  const shown = sites.filter((e) => rec(e).place.pin === "shown"), held = sites.filter((e) => rec(e).place.pin === "held");
  assert.equal(held.length, 0);
  assert.equal(shown.length, 13);
  const want = {
    "ancient-goebekli-tepe": { lat: 37.223242, lng: 38.922364, list: 1572 },
    "ancient-ur": { lat: 30.963056, lng: 46.103056, list: 1481 },
    "ancient-caral": { lat: -10.891667, lng: -77.521389, list: 1269 },
    "ancient-giza": { lat: 29.97604, lng: 31.13041, list: 86 },
    "ancient-mohenjo-daro": { lat: 27.329167, lng: 68.138889, list: 138 },
    "ancient-troy": { lat: 39.95644, lng: 26.239, list: 849 },
    "ancient-merv": { lat: 37.664831, lng: 62.174892, list: 886 },
    "ancient-palmyra": { lat: 34.554167, lng: 38.266667, list: 23 },
    "ancient-petra": { lat: 30.33056, lng: 35.44333, list: 326 },
    "ancient-qin-mausoleum": { lat: 34.381417, lng: 109.253667, list: 441 },
    "ancient-teotihuacan": { lat: 19.69167, lng: -98.84167, list: 414 },
    "ancient-great-zimbabwe": { lat: -20.27117, lng: 30.933269, list: 364 },
    "ancient-pompeii": { lat: 40.7494, lng: 14.4854, list: null },
  };
  assert.deepEqual(shown.map((e) => e.id).sort(), Object.keys(want).sort());
  shown.forEach((e) => {
    const r = rec(e), w = want[e.id];
    assert.equal(r.place.lat, w.lat, e.id); assert.equal(r.place.lng, w.lng, e.id);
    assert.equal(e.places[0].lat, w.lat, e.id); assert.equal(e.places[0].lng, w.lng, e.id);
    assert.match(e.places[0].note, /approximate/i, e.id); assert.equal(r.place.approximate, true, e.id);
    if (e.id === "ancient-pompeii") {
      assert.match(r.place.coords_source, /Pleiades place 433032/);
    } else {
      assert.match(r.place.coords_source, new RegExp(`https://whc\\.unesco\\.org/en/list/${w.list}/maps/`));
      assert.match(r.place.basis, /UNESCO World Heritage point/);
    }
  });
});
t("myths have no pin and a Myth: title", () => {
  myths.forEach((e) => { assert.equal(e.places.length, 0, e.id); assert.equal(rec(e).place, null); assert.match(e.title, /^Myth: /); });
});
t("myth labels: the story source is supported, a real place is not-proven, and nothing is people-disagree without two groups", () => {
  myths.forEach((e) => {
    const c = rec(e).claims;
    assert.ok(c.some((x) => x.claimStatus === "supported" && x.sourceIds.length), e.id);
    assert.ok(c.some((x) => x.claimStatus === "not-proven"), e.id);
    c.filter((x) => x.claimStatus === "people-disagree").forEach((x) => assert.ok((x.disagree || []).length >= 2));
  });
});
t("every cited source is registered with a publisher, a licence line and an https link", () => {
  pack.forEach((e) => e.sources.forEach((id) => {
    const s = sourceById.get(id); assert.ok(s, id);
    assert.ok(s.license && s.publisher && /^https:\/\//.test(s.url), id);
  }));
});
t("dates before 1775 are allowed here (the history range applies only to the history-places pack)", () => {
  assert.equal(rec(sites.find((e) => e.id === "ancient-goebekli-tepe")).timeline[0].date, "-9599");
});
t("Palmyra shows its Danger listing and dated losses from UN sources, marked sensitive", () => {
  const r = rec(sites.find((e) => e.id === "ancient-palmyra"));
  assert.equal(r.status, "World Heritage in Danger"); assert.equal(r.sensitive, true);
  for (const d of ["2013", "2015-08-30", "2015-10-05"]) assert.ok(r.timeline.some((x) => x.date === d), d);
  r.timeline.filter((x) => x.date >= "2013").forEach((x) => assert.equal(sourceById.get(x.source).class, "official"));
});
t("rules: a myth with a pin, a site without an official source, and an unregistered source each fail", () => {
  const m = myths[0], mr = clone(rec(m)), me = clone(m);
  me.places = [{ lat: 1, lng: 1, precision: "site" }];
  assert.ok(ancientRules(me, mr, vctx).some((x) => /no pin/.test(x)));
  const s = sites[0], sr = clone(rec(s)), se = clone(s);
  sr.sources = sr.sources.filter((id) => sourceById.get(id).class !== "official"); se.sources = sr.sources; sr.official_sources = [];
  assert.ok(ancientRules(se, sr, vctx).some((x) => /official source/.test(x)));
  const h = sites[0], hr = clone(rec(h)), he = clone(h);
  hr.place = { ...hr.place, pin: "held", hold_reason: "synthetic hold for the rule check", hold_source: hr.official_sources[0] };
  delete hr.place.lat; delete hr.place.lng;
  he.places = [{ ...he.places[0], lat: 1, lng: 2 }];
  assert.ok(ancientRules(he, hr, vctx).some((x) => /held pin must ship no coordinates/.test(x)));
  const s2 = clone(rec(s)); s2.facts.push({ label: "x", value: "y", source: "no-such-source" });
  assert.ok(ancientRules(s, s2, vctx).some((x) => /no-such-source/.test(x)));
  const m2 = clone(rec(m)); m2.claims = m2.claims.filter((c) => c.claimStatus !== "not-proven");
  assert.ok(ancientRules(m, m2, vctx).some((x) => /not-proven/.test(x)));
});
console.log(`ancient: ${n} tests passed`);
