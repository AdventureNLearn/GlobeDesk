// History pack (US 1776-2026, with a 1775 prologue): sourcing, reading levels, eras, records, links by id to the Bells layer, validator rules.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { validateSchema } from "./jsonschema-lite.mjs";
import { historyRules, artifactRules, entryRules } from "../tools/atlas/validate.mjs";
import { J, JR, allEntries } from "../tools/atlas/lib.mjs";
const require = createRequire(import.meta.url);
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const errs = (r) => (Array.isArray(r) ? r : (r && r.errors) || []);

const sources = J("packs/core/sources.json").sources;
const byId = new Map(sources.map((s) => [s.id, s]));
const cats = J("categories.json").categories;
const all = allEntries();
const ctx = { cats, entryIds: new Set(all.map((e) => e.id)), sourceIds: new Set(byId.keys()), sourceById: byId };
const hist = J("packs/history-places/entries.json").entries;
const bells = []; // bell entries live in the Bells pack and are checked by tests/bells.unit.mjs; history links to them by id
const bellPack = J("packs/bells/entries.json").entries;
const year = (d) => parseInt(d, 10);
const ERAS = [[1775, 1799], [1800, 1860], [1861, 1869], [1870, 1913], [1914, 1945], [1946, 1980], [1981, 2026]];

t("history pack: 60-90 sourced entries, dated 1776-2026 (one 1775 prologue), every era covered", () => {
  assert.ok(hist.length >= 60 && hist.length <= 90, String(hist.length));
  hist.forEach((e) => e.dates.forEach((d) => assert.ok((year(d.date) >= 1776 || e.id === "old-north-lanterns-1775") && year(d.date) <= 2026, e.id + " " + d.date)));
  ERAS.forEach(([a, b]) => assert.ok(hist.some((e) => { const y = year(e.dates[0].date); return y >= a && y <= b; }), `era ${a}-${b}`));
  assert.ok(hist.some((e) => e.dates.some((d) => d.date === "1776-07-04")) && hist.some((e) => e.dates.some((d) => d.date === "2026-07-04")));
});
t("every history entry has an official source with publisher and licence, and no living subject", () => hist.forEach((e) => {
  const off = e.sources.map((s) => byId.get(s)).filter((s) => s && s.class === "official");
  assert.ok(off.length >= 1, e.id); off.forEach((s) => { assert.ok(s.publisher && s.license && /^https:\/\//.test(s.url), s.id); });
  assert.equal(e.subject_person_living, false); assert.equal(e.current, false); assert.equal(e.kind, "event");
}));
t("reading levels: kids, everyday and student text on every history and bell entry; summary is the student text", () => hist.concat(bells).forEach((e) => {
  ["kids", "everyday", "student"].forEach((k) => assert.ok(e.tiers && e.tiers[k], e.id + " " + k));
  assert.equal(e.tiers[e.tier], e.summary, e.id);
}));
t("owner repos and Learning Lab are never cited by history or bells", () => hist.concat(bells).forEach((e) => e.sources.forEach((s) => assert.doesNotMatch(byId.get(s).url, /github\.com\/AdventureNLearn|grok\.me|adventurenlearn\.github\.io/i, e.id))));
t("pins: day-precision dates where given, approximate pins say so", () => hist.concat(bells).forEach((e) => e.places.forEach((p) => {
  if (p.lat != null) assert.match(p.note || "", /approximate/i, e.id);
})));
t("bell links are by id only: no bell entries duplicated in this pack, links point at Bells-layer ids", () => {
  const BELL_IDS = ["liberty-bell", "centennial-bell", "justice-bell", "old-north-bells", "bicentennial-bell"];
  assert.ok(!hist.some((e) => BELL_IDS.includes(e.id)), "a bell entry is duplicated in the history pack");
  BELL_IDS.forEach((id) => assert.equal(all.filter((e) => e.id === id).length, 1, id + " must exist exactly once (in the Bells pack)"));
  BELL_IDS.forEach((id) => assert.ok(bellPack.some((e) => e.id === id), id + " must live in the Bells pack"));
  const linked = new Set(hist.flatMap((e) => e.see_also_ids || []));
  BELL_IDS.forEach((id) => assert.ok(linked.has(id), id));
  assert.ok(hist.every((e) => !(e.related || []).some((r) => BELL_IDS.includes(r.to))), "bells must be see_also_ids, not related (the Bells pack owns them)");
});
t("artifact records for history objects: Constitution (four pages) and the 1844 telegraph tape", () => {
  const schema = JR("schema/globedesk-artifact.schema.json");
  for (const rel of ["data/atlas/artifacts/constitution-1787.json", "data/atlas/artifacts/telegraph-tape-1844.json"]) {
    const r = JR(rel); assert.deepEqual(errs(validateSchema(schema, r)), [], rel); assert.deepEqual(artifactRules(rel, r, ctx, schema), []);
  }
  assert.equal(JR("data/atlas/artifacts/constitution-1787.json").facts.find((f) => f.label === "Pages").value, "Four");
  assert.match(JR("data/atlas/artifacts/telegraph-tape-1844.json").facts[0].value, /What hath God wrought/);
});
t("validator: history entry with no official source, a layer entry with no pin, an artifact row with an unknown source", () => {
  const e = structuredClone(hist[0]); e.sources = ["oldnorth-bells"];
  assert.ok(historyRules(e, ctx).some((x) => /official source/.test(x)));
  const b = structuredClone(hist[0]); b.layer = "bells"; b.kind = "object"; b.places = [{ region: "US-PA", precision: "subdivision" }];
  assert.ok(historyRules(b, ctx).some((x) => /lat\/lng pin/.test(x)));
  const r = structuredClone(JR("data/atlas/artifacts/constitution-1787.json")); r.facts[0].source = "made-up-source";
  assert.ok(artifactRules("x", r, ctx, JR("schema/globedesk-artifact.schema.json")).some((x) => /unknown source/.test(x)));
  const tl = structuredClone(hist[0]); tl.tiers.student = "different"; assert.ok(historyRules(tl, ctx).some((x) => /must equal the summary/.test(x)));
});
t("history entries pass the shared entry rules (no Now home, known subcategories, related links exist)", () => hist.forEach((e) => assert.deepEqual(entryRules(e, ctx), [], e.id)));
console.log(`${n} atlas history tests ok`);
