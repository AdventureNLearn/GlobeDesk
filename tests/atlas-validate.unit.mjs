// Pure Node test for the Atlas skeleton: schemas, the no-living-person rule, Now timing, dates and pack sizes.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateSchema } from "./jsonschema-lite.mjs";
import { validateAtlas, entryRules, packRules, sourceRules } from "../tools/atlas/validate.mjs";
import { J, JR, allEntries, fileInfo, packSha, MAX_BYTES } from "../tools/atlas/lib.mjs";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const errs = (r) => (Array.isArray(r) ? r : (r && r.errors) || []);
const schema = JR("schema/atlas-entry.schema.json");
const cats = J("categories.json").categories;
const base = allEntries().find((e) => e.id === "phosphate-cathode-discovery");
const ctx = { cats, entryIds: new Set(allEntries().map((e) => e.id)), sourceIds: new Set(J("packs/core/sources.json").sources.map((s) => s.id)) };
const fix = (over) => ({ ...structuredClone(base), ...over });
const bad = (e) => errs(validateSchema(schema, e)).length + entryRules(e, ctx).length > 0;

t("whole atlas validates (schemas, links, sources, manifests, sizes, hygiene)", () => assert.deepEqual(validateAtlas(), []));
t("12 categories, each with 3-6 subcategories; category 8 and 12 as approved", () => {
  assert.equal(cats.length, 12);
  assert.equal(cats[7].title, "Health, anatomy and first aid"); assert.match(cats[7].scope, /No personal treatment advice/);
  assert.equal(cats[11].id, "now"); assert.equal(cats[11].refresh, "weekly");
  cats.filter((c) => c.id !== "now").forEach((c) => assert.equal(c.refresh, "quarterly"));
});
t("rejects an entry about a living person (schema and rule)", () => {
  const e = fix({ subject_person_living: true });
  assert.ok(errs(validateSchema(schema, e)).length > 0); assert.ok(entryRules(e, ctx).length > 0);
});
t("rejects a missing subject_person_living field", () => { const e = fix({}); delete e.subject_person_living; assert.ok(bad(e)); });
t("rejects a person kind", () => assert.ok(bad(fix({ kind: "person" }))));
t("officials only by role, only inside events", () => {
  assert.ok(!bad(fix({ officials_in_role: [{ role: "Head of a public agency" }] })));
  assert.ok(bad(fix({ kind: "topic", officials_in_role: [{ role: "Head of a public agency" }] })));
  assert.ok(bad(fix({ officials_in_role: [{ name: "No role given" }] })));
});
t("current needs now_until within about 90 days of a day-precision date", () => {
  const d = [{ date: "2026-11-20", precision: "day", approximate: false }];
  assert.ok(!bad(fix({ current: true, dates: d, now_until: "2027-02-18" })));
  assert.ok(bad(fix({ current: true, dates: d })));
  assert.ok(bad(fix({ current: true, dates: d, now_until: "2027-06-01" })));
  assert.ok(bad(fix({ current: true, now_until: "2027-02-18" }))); // only a year date
});
t("Now is never a home category", () => assert.ok(bad(fix({ category_path: ["now", "this-week"] }))));
t("date form must match precision; tier is one of four", () => {
  assert.ok(bad(fix({ dates: [{ date: "1996", precision: "day", approximate: false }] })));
  assert.ok(bad(fix({ dates: [{ date: "1996-13", precision: "month", approximate: false }] })));
  assert.ok(!bad(fix({ dates: [{ date: "-500", precision: "year", approximate: true }] })));
  assert.ok(bad(fix({ tier: "expert" })));
});
t("non-placeholder needs a source; placeholders need the label", () => {
  assert.ok(bad(fix({ sources: [] })));
  assert.ok(bad(fix({ status: "placeholder", sources: [] })));
  assert.ok(!bad(fix({ status: "placeholder", sources: [], title: "[PLACEHOLDER] Test" })));
});
t("unknown source, related entry or category is caught", () => {
  assert.ok(bad(fix({ sources: ["not-registered"] })));
  assert.ok(bad(fix({ related: [{ type: "uses", to: "no-such-entry" }] })));
  assert.ok(bad(fix({ category_path: ["chemistry", "no-such-sub"] })));
});
t("pack over 50 MB is refused; tampered file is caught", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "atlas-"));
  writeFileSync(path.join(dir, "entries.json"), "{}");
  const files = [{ path: "entries.json", ...fileInfo(path.join(dir, "entries.json")) }];
  const m = { id: "fake", files, sha256: packSha(files), size_bytes: files[0].bytes };
  assert.deepEqual(packRules(m, dir), []);
  assert.ok(packRules({ ...m, size_bytes: MAX_BYTES }, dir).length > 0);
  writeFileSync(path.join(dir, "entries.json"), "{ }");
  assert.ok(packRules(m, dir).length > 0);
});
t("every real pack is under 50 MB", () => ["core", "civic", "energy", "objects", "chemistry", "food", "preparedness", "health", "economics", "earth", "science-history", "now"].forEach((p) => assert.ok(J(`packs/${p}/manifest.json`).size_bytes < MAX_BYTES)));
t("reused records stay marked draft", () => ["bag-solar-kit", "lifepo4-vs-nmc", "bag-solar-kit-prices"].forEach((id) => assert.equal(allEntries().find((e) => e.id === id).status, "draft")));
t("owner rule: an owner repo or Learning Lab card can't be tagged official, and never backs a claim", () => {
  const ok = J("packs/core/sources.json").sources;
  assert.deepEqual(sourceRules(ok), []);
  assert.ok(ok.filter((x) => x.class === "official").every((x) => x.publisher));
  assert.ok(sourceRules([{ id: "gd", url: "https://github.com/AdventureNLearn/GlobeDesk", class: "official", publisher: "x" }]).length > 0);
  assert.ok(sourceRules([{ id: "lab", url: "https://learninglab.grok.me/", class: "reference" }]).length > 0);
  assert.ok(sourceRules([{ id: "nocls", url: "https://www.faa.gov/" }]).length > 0);
  assert.deepEqual(sourceRules([{ id: "lab", url: "https://learninglab.grok.me/", class: "experimental" }]), []);
  const exp = { ...ctx, sourceIds: new Set([...ctx.sourceIds, "lab-card"]), sourceById: new Map([["lab-card", { id: "lab-card", url: "https://learninglab.grok.me/", class: "experimental" }]]) };
  assert.ok(entryRules(fix({ sources: ["lab-card"] }), exp).some((x) => /experimental/.test(x)));
});
console.log(`${n} passed`);
