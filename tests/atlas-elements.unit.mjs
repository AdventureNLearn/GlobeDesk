// Unit tests for the 118 chemistry/elements Atlas entries (P1 data only).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const J = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

const chem = J("atlas/packs/chemistry/entries.json");
const elements = chem.entries.filter((e) => e.category_path && e.category_path[0] === "chemistry" && e.category_path[1] === "elements");
const byId = Object.fromEntries(elements.map((e) => [e.id, e]));
const sources = J("atlas/packs/core/sources.json").sources;
const sourceIds = new Set(sources.map((s) => s.id));

t("there are 118 element entries with unique {iupac-name}-element ids, in atomic-number order", () => {
  assert.equal(elements.length, 118);
  assert.equal(new Set(elements.map((e) => e.id)).size, 118);
  const zs = elements.map((e) => {
    const m = e.title.match(/element (\d+)\)$/);
    assert.ok(m, e.id + " title should include the atomic number");
    return Number(m[1]);
  });
  assert.deepEqual(zs, [...Array(118)].map((_, i) => i + 1));
  assert.equal(elements[0].id, "hydrogen-element");
  assert.equal(elements[12].id, "aluminium-element");
  assert.equal(elements[54].id, "caesium-element");
  assert.equal(elements[117].id, "oganesson-element");
});

t("lithium-element and copper-element were merged, not duplicated, and keep their existing links and USGS sources", () => {
  const li = byId["lithium-element"];
  const cu = byId["copper-element"];
  assert.ok(li && cu);
  assert.equal(chem.entries.filter((e) => e.id === "lithium-element").length, 1);
  assert.equal(chem.entries.filter((e) => e.id === "copper-element").length, 1);
  assert.equal(li.summary.includes("USGS tracks global lithium"), true);
  assert.equal(cu.summary.includes("third most consumed industrial metal"), true);
  assert.deepEqual(li.related.map((r) => r.to), ["lifepo4-vs-nmc", "phosphate-cathode-discovery"]);
  assert.deepEqual(li.see_also_ids, ["lithium-batteries-air-travel", "bag-solar-kit"]);
  assert.deepEqual(cu.related.map((r) => r.to), ["bell-bronze"]);
  assert.deepEqual(cu.see_also_ids, ["bag-solar-kit", "bells-overview"]);
  assert.ok(li.sources.includes("usgs-lithium"));
  assert.ok(li.sources.includes("nist-atomic-li"));
  assert.ok(cu.sources.includes("usgs-copper"));
  assert.ok(cu.sources.includes("nist-atomic-cu"));
});

t("every element cites the NIST, IUPAC and Wikidata sources, which are official and licensed", () => {
  const required = ["nist-atomic-weights", "iupac-periodic-table-2022", "wikidata-chemical-elements"];
  for (const id of required) assert.ok(sourceIds.has(id), "missing source " + id);
  const bySrc = Object.fromEntries(sources.map((s) => [s.id, s]));
  assert.equal(bySrc["nist-atomic-weights"].class, "official");
  assert.match(bySrc["nist-atomic-weights"].license, /public information and may be distributed or copied/);
  assert.equal(bySrc["nist-atomic-weights"].terms_url, "https://www.nist.gov/copyrights-disclaimers");
  assert.equal(bySrc["iupac-periodic-table-2022"].class, "official");
  assert.match(bySrc["iupac-periodic-table-2022"].license, /yours to use/i);
  assert.equal(bySrc["wikidata-chemical-elements"].class, "official");
  assert.match(bySrc["wikidata-chemical-elements"].license, /CC0/);
  for (const e of elements) {
    for (const id of required) assert.ok(e.sources.includes(id), e.id + " missing " + id);
    assert.equal(e.license.startsWith("CC BY 4.0"), true);
    assert.equal(e.subject_person_living, false);
    assert.equal(e.kind, "chemistry");
    assert.equal(e.status, "draft");
  }
});

t("Group 3 La, Lu, Ac and Lr are unresolved; the pack does not pick a side", () => {
  for (const id of ["lanthanum-element", "lutetium-element", "actinium-element", "lawrencium-element"]) {
    const e = byId[id];
    assert.ok(e, id);
    assert.match(e.summary, /IUPAC group \[UNKNOWN\]/);
    assert.match(e.notes, /does not pick a side/);
    assert.match(e.notes, /Lu and Lr or Sc, Y, La and Ac/);
  }
  const sc = byId["scandium-element"];
  const y = byId["yttrium-element"];
  assert.match(sc.summary, /IUPAC group 3/);
  assert.match(y.summary, /IUPAC group 3/);
});

t("the pack bundles nothing from PubChem or Bowserinator (PubChem is an outbound link id only), and unknown weights stay \\[UNKNOWN\\]", () => {
  // Owner pick (chem index C1): withheld properties link out to PubChem; no PubChem value is bundled.
  // The only exemption: the outbound source id inside each entry's own sources list. Anywhere else
  // (a summary, a field, a record) it still fails the check below.
  const OUTBOUND = "pubchem-elements-outbound";
  const out = sources.find((s) => s.id === OUTBOUND);
  assert.ok(out && /^Outbound link only\./.test(out.license), "the PubChem source is an outbound link only");
  const chemNoOutbound = { ...chem, entries: chem.entries.map((e) => (Array.isArray(e.sources) ? { ...e, sources: e.sources.filter((id) => id !== OUTBOUND) } : e)) };
  const blob = JSON.stringify(chemNoOutbound) + JSON.stringify(sources.filter((s) => [
    "nist-atomic-weights", "iupac-periodic-table-2022", "wikidata-chemical-elements"
  ].includes(s.id)));
  assert.equal(/pubchem/i.test(blob), false);
  assert.equal(/bowserinator/i.test(blob), false);
  const unknownWeight = elements.filter((e) => /Standard atomic weight \[UNKNOWN\]/.test(e.summary));
  assert.equal(unknownWeight.length, 24);
  assert.ok(byId["oganesson-element"].summary.includes("NIST lists no standard atomic weight"));
});

t("discoverer credits are names only; Wikidata years that are not year-or-finer stay \\[UNKNOWN\\]", () => {
  const cu = byId["copper-element"];
  assert.equal(cu.dates.length, 0);
  assert.match(cu.notes, /Discovery year \[UNKNOWN\] \(Wikidata\)/);
  const li = byId["lithium-element"];
  assert.deepEqual(li.dates, [{ date: "1817", precision: "year", approximate: false, label: "Discovery time (Wikidata)" }]);
  const og = byId["oganesson-element"];
  assert.equal(og.summary.includes("Joint Institute for Nuclear Research"), true);
  assert.equal(/born|birth|died|death|lived|nationality/i.test(JSON.stringify(elements)), false);
});


t("every element cites NIST SP 966 and links to the electron-configuration record", () => {
  const bySrc = Object.fromEntries(sources.map((s) => [s.id, s]));
  const pt = bySrc["nist-periodic-table-2024"];
  assert.ok(pt);
  assert.equal(pt.class, "official");
  assert.match(pt.license, /title 17 United States Code Section 105/);
  assert.equal(pt.terms_url, "https://www.nist.gov/open/license");
  const rec = J("data/atlas/chemistry/elements-electron-config.json");
  assert.equal(Object.keys(rec.byId).length, 118);

  let measured = 0, notProven = 0, unknown = 0, disagree = 0;
  for (const e of elements) {
    assert.ok(e.sources.includes("nist-periodic-table-2024"), e.id);
    assert.equal(e.record, "data/atlas/chemistry/elements-electron-config.json", e.id);
    const row = rec.byId[e.id];
    assert.ok(row, e.id);
    if (row.status === "supported") {
      measured++;
      assert.ok(Array.isArray(row.shells) && row.shells.length >= 1, e.id);
      assert.equal(row.shells.reduce((a, b) => a + b, 0), row.z, e.id);
      assert.deepEqual(Object.values(row.shells_by_letter), row.shells, e.id);
    } else if (row.status === "not-proven") {
      notProven++;
      assert.equal(row.shells, null);
      assert.equal(row.config, "[UNKNOWN]");
      assert.match(row.note, /calculated|theoretical/i);
    } else if (row.status === "[UNKNOWN]") {
      unknown++;
      assert.equal(row.shells, null);
      assert.equal(row.config, "[UNKNOWN]");
      assert.match(row.note, /aufbau/i);
    } else if (row.status === "people-disagree") {
      disagree++;
    }
  }
  assert.equal(measured, 103);
  assert.equal(notProven, 5);
  assert.equal(unknown, 10);
  assert.equal(disagree, 0);
  assert.deepEqual(rec.byId["carbon-element"].shells, [2, 4]);
  assert.deepEqual(rec.byId["chromium-element"].shells, [2, 8, 13, 1]);
  assert.deepEqual(rec.byId["copper-element"].shells, [2, 8, 18, 1]);
  assert.deepEqual(rec.byId["gold-element"].shells, [2, 8, 18, 32, 18, 1]);
  assert.deepEqual(rec.byId["lawrencium-element"].shells, [2, 8, 18, 32, 32, 8, 3]);
  assert.equal(rec.byId["rutherfordium-element"].status, "not-proven");
  assert.equal(rec.byId["oganesson-element"].status, "[UNKNOWN]");
});

t("cross-links point only to existing Atlas records across chemistry, objects, energy, bells, history and science-history", () => {
  const allIds = new Set();
  for (const dir of fs.readdirSync(path.join(root, "atlas/packs"))) {
    const p = path.join(root, "atlas/packs", dir, "entries.json");
    if (fs.existsSync(p)) for (const e of JSON.parse(fs.readFileSync(p, "utf8")).entries) allIds.add(e.id);
  }
  assert.deepEqual(byId["tin-element"].related.map((r) => r.to), ["bell-bronze"]);
  assert.deepEqual(byId["tin-element"].see_also_ids, ["bells-overview"]);
  assert.deepEqual(byId["silicon-element"].see_also_ids, ["transistor-effect-nobel-1956", "portable-solar-power"]);
  assert.deepEqual(byId["gold-element"].see_also_ids, ["gold-discovery-1848"]);
  assert.deepEqual(byId["caesium-element"].see_also_ids, ["international-system-of-units-si"]);
  for (const e of elements) {
    for (const r of (e.related || [])) assert.ok(allIds.has(r.to), e.id + " missing related target " + r.to);
    for (const s of (e.see_also_ids || [])) assert.ok(allIds.has(s), e.id + " missing see_also target " + s);
  }
});

console.log(n + " tests passed");
