// Chemistry index (C1 data): NIST SP 966 first ionization energy, NIST weights with CIAAW cited,
// withheld properties as [UNKNOWN] with an outbound link. Local, no network.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const J = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
const U = "[UNKNOWN]";
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

const idx = J("data/atlas/chemistry/elements-index.json");
const rows = Object.values(idx.byZ);
const sources = new Map(J("atlas/packs/core/sources.json").sources.map((s) => [s.id, s]));
const elements = J("atlas/packs/chemistry/entries.json").entries.filter((e) => e.category_path && e.category_path[1] === "elements");

t("118 rows in Z order with IUPAC symbols and element ids", () => {
  assert.equal(idx.schema, "globedesk.chem/0-draft");
  assert.equal(rows.length, 118);
  rows.forEach((r, i) => assert.equal(r.z, i + 1));
  assert.equal(idx.byZ["1"].symbol, "H");
  assert.equal(idx.byZ["118"].id, "oganesson-element");
});

t("SP 966 ionization energy for Z=1-108; 104-108 not-proven; 109-118 [UNKNOWN]", () => {
  assert.equal(idx.byZ["1"].ie_ev, "13.5984");
  assert.equal(idx.byZ["26"].ie_ev, "7.9025");
  assert.equal(idx.byZ["79"].ie_ev, "9.2256");
  for (const r of rows) {
    if (r.z <= 103) assert.equal(r.ie_status, "supported", "Z=" + r.z);
    else if (r.z <= 108) assert.equal(r.ie_status, "not-proven", "Z=" + r.z);
    else { assert.equal(r.ie_status, U); assert.equal(r.ie_ev, U); assert.equal(r.ie_sort, null); }
    if (r.ie_ev !== U) assert.equal(r.ie_sort, Number(r.ie_ev));
  }
});

t("weights are NIST strings with a sort key; intervals sort by their lower bound; unknowns stay [UNKNOWN]", () => {
  assert.equal(idx.byZ["1"].weight_kind, "interval");
  assert.equal(idx.byZ["1"].weight_sort, 1.00784);
  assert.equal(idx.byZ["2"].weight, "4.002602(2)");
  assert.equal(idx.byZ["2"].weight_sort, 4.002602);
  assert.equal(rows.filter((r) => r.weight === U).length, 24);
  rows.filter((r) => r.weight === U).forEach((r) => assert.equal(r.weight_sort, null));
  const w = idx.columns.find((c) => c.id === "weight");
  assert.equal(w.source, "nist-atomic-weights");
  assert.equal(w.recommending_body, "ciaaw-atomic-weights");
});

t("withheld properties ship as [UNKNOWN] with a PubChem outbound template and no values", () => {
  assert.ok(idx.withheld.length >= 5);
  for (const w of idx.withheld) { assert.equal(w.value, U); assert.equal(w.outbound, "pubchem-element"); }
  assert.equal(idx.outbound["pubchem-element"].url_template, "https://pubchem.ncbi.nlm.nih.gov/element/{z}");
  const blob = JSON.stringify(idx.byZ);
  assert.doesNotMatch(blob, /density|melting|boiling|electronegativ|oxidation/i);
});

t("new sources are registered, official, and CIAAW/PubChem are outbound-only", () => {
  for (const id of ["nist-sp966-ionization", "ciaaw-atomic-weights", "pubchem-elements-outbound"]) {
    const s = sources.get(id);
    assert.ok(s, id);
    assert.equal(s.class, "official");
    assert.ok(s.publisher && s.license && /^https:\/\//.test(s.url));
  }
  assert.match(sources.get("ciaaw-atomic-weights").license, /Outbound citation only/);
  assert.match(sources.get("pubchem-elements-outbound").license, /Outbound link only/);
});

t("every element entry lists the index record and its sources", () => {
  assert.equal(elements.length, 118);
  for (const e of elements) {
    assert.ok((e.records || []).includes("data/atlas/chemistry/elements-index.json"), e.id);
    assert.ok(e.sources.includes("nist-sp966-ionization"), e.id);
  }
});

t("the bundled Atlas data carries the index record", () => {
  const js = fs.readFileSync(path.join(root, "js/atlas/atlas-data.js"), "utf8");
  assert.ok(js.includes("data/atlas/chemistry/elements-index.json"));
  assert.ok(js.includes("globedesk.chem/0-draft"));
});

console.log(n + " chem index tests ok");
