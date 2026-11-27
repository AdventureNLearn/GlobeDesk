// Chemistry index (C1): one sortable row per element. Local only, no network.
// Reads the source cache at .cache/sources in the repo (gitignored), or
// GLOBEDESK_ELEMENTS_CACHE, and writes data/atlas/chemistry/elements-index.json.
// Bundled values: NIST standard atomic weight (CIAAW is cited as the recommending
// body, outbound only) and first ionization energy from NIST SP 966 (Z=1-108).
// Properties whose licence is not cleared are NOT bundled: they ship as [UNKNOWN]
// with an outbound PubChem link. Run build-elements.mjs afterwards so each element
// entry lists this record.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CHECKED = "2026-11-26";
const OUT_REL = "data/atlas/chemistry/elements-index.json";
const U = "[UNKNOWN]";

function cacheDir() {
  if (process.env.GLOBEDESK_ELEMENTS_CACHE) return path.resolve(process.env.GLOBEDESK_ELEMENTS_CACHE);
  return path.resolve(ROOT, ".cache/sources");
}
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const save = (p, obj) => writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
function need(p) {
  if (!existsSync(p)) throw new Error("Missing source cache file " + p);
  return p;
}

// Strip the Excel ="..." wrapping in the NIST ASD CSV export.
function asdCell(s) {
  return String(s || "").trim().replace(/^"?=?"+/, "").replace(/"+$/, "").trim();
}

export function weightSortKey(w) {
  const s = String(w || "").trim();
  let m = s.match(/^\[(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\]$/);
  if (m) return { kind: "interval", sort: Number(m[1]) };
  m = s.match(/^\[(\d+)\]$/);
  if (m) return { kind: "bracketed-integer", sort: Number(m[1]) };
  m = s.match(/^(\d+(?:\.\d+)?)(?:\(\d+\))?$/);
  if (m) return { kind: "value", sort: Number(m[1]) };
  return { kind: U, sort: null };
}

// NIST ASD prefix notation (from the cached ASD ionization-energy help page):
// "(" theoretical, "[" semi-empirical. Used only to label a basis; ASD values are not bundled.
function asdBasisByZ(dir) {
  const p = path.join(dir, "nist-asd/ie-neutral.csv");
  const out = new Map();
  if (!existsSync(p)) return out;
  const lines = readFileSync(p, "utf8").split(/\r?\n/).slice(1);
  for (const line of lines) {
    const cells = line.split(/,(?=")/).map(asdCell);
    const z = Number(cells[0]);
    if (!Number.isInteger(z) || z < 1) continue;
    const prefix = cells[9];
    if (prefix === "(") out.set(z, "theoretical");
    else if (prefix === "[") out.set(z, "semi-empirical");
  }
  return out;
}

const dir = cacheDir();
const weights = readJson(need(path.join(dir, "nist/nist-atomic-weights.json"))).elements;
const ie = readJson(need(path.join(dir, "nist-sp966/nist-sp966-ionization.json")));
const iupac = readJson(need(path.join(dir, "iupac/iupac-names-groups-2022.json"))).elements;
const ieByZ = new Map(ie.elements.map((e) => [e.z, e]));
const wByZ = new Map(weights.map((e) => [e.z, e]));
const basis = asdBasisByZ(dir);

const rows = {};
for (let z = 1; z <= 118; z++) {
  const iu = iupac.find((e) => e.z === z);
  const w = wByZ.get(z);
  if (!iu || !w) throw new Error("Missing IUPAC or NIST row for Z=" + z);
  if (iu.symbol !== w.symbol) throw new Error("Symbol mismatch at Z=" + z);
  const wk = weightSortKey(w.standard_atomic_weight);
  const row = {
    z,
    symbol: iu.symbol,
    id: iu.name + "-element",
    weight: wk.kind === U ? U : w.standard_atomic_weight,
    weight_kind: wk.kind,
    weight_sort: wk.sort,
  };
  const r = ieByZ.get(z);
  if (z <= 108 && r && /^\d+(\.\d+)?$/.test(r.ie_ev)) {
    row.ie_ev = r.ie_ev;
    row.ie_sort = Number(r.ie_ev);
    row.ie_status = z >= 104 ? "not-proven" : "supported";
    const b = basis.get(z);
    if (b) row.ie_basis = b;
  } else {
    row.ie_ev = U;
    row.ie_sort = null;
    row.ie_status = U;
  }
  rows[z] = row;
}

const ieCount = Object.values(rows).filter((r) => r.ie_ev !== U).length;
if (ieCount !== 108) throw new Error("Expected 108 SP 966 ionization energies, got " + ieCount);

const withheld = [
  ["density", "Density"],
  ["melting-point", "Melting point"],
  ["boiling-point", "Boiling point"],
  ["standard-state", "Standard state"],
  ["oxidation-states", "Oxidation states"],
  ["electronegativity", "Electronegativity (Pauling)"],
].map(([id, label]) => ({
  id,
  label,
  value: U,
  reason: "Licence not cleared for bundling (PubChem attributes these to Jefferson Lab, LANL or PubChem Elements; their reuse terms are not confirmed). Look it up at the source.",
  outbound: "pubchem-element",
}));

const doc = {
  schema: "globedesk.chem/0-draft",
  id: "elements-index",
  title: "Chemistry index: sortable element properties",
  status: "draft",
  checked: CHECKED,
  note: "Bundled columns are NIST works (17 U.S.C. 105). Withheld columns are [UNKNOWN] with an outbound link; no values are copied.",
  columns: [
    { id: "z", label: "Z", source: "iupac-periodic-table-2022" },
    { id: "weight", label: "Standard atomic weight", source: "nist-atomic-weights", recommending_body: "ciaaw-atomic-weights",
      note: "Values as NIST publishes them. CIAAW (IUPAC) is the body that recommends standard atomic weights. Intervals sort by their lower bound. A single bracketed integer is shown exactly as NIST prints it; NIST's wording for it is [UNKNOWN] in our cache." },
    { id: "ie", label: "First ionization energy", unit: "eV", source: "nist-sp966-ionization",
      note: "NIST SP 966 (June 2024) for Z=1-108. Z=104-108 are not-proven (NIST ASD gives only calculated or semi-empirical values). Z=109-118 are [UNKNOWN]: SP 966 prints none." },
  ],
  withheld,
  outbound: {
    "pubchem-element": { label: "PubChem element page", url_template: "https://pubchem.ncbi.nlm.nih.gov/element/{z}", source: "pubchem-elements-outbound" },
  },
  byZ: rows,
};
save(path.join(ROOT, OUT_REL), doc);

// Sources: register once; update in place on rerun.
const sourcesPath = path.join(ROOT, "atlas/packs/core/sources.json");
const sourcesDoc = readJson(sourcesPath);
const catalog = [
  {
    id: "nist-sp966-ionization",
    title: "NIST Periodic Table: Atomic Properties of the Elements (SP 966, June 2024), first ionization energy",
    url: "https://www.nist.gov/pml/periodic-table-elements",
    checked: CHECKED,
    class: "official",
    publisher: "National Institute of Standards and Technology (NIST)",
    license: "NIST states: \"Pursuant to title 17 United States Code Section 105, works of NIST employees are not subject to copyright protection in the United States.\"",
    terms_url: "https://www.nist.gov/open/license",
    description: "Ionization Energy (eV) cell for Z=1-108, parsed from the June 2024 PDF. Not taken from NIST ASD (SRD 78), whose values are not bundled.",
  },
  {
    id: "ciaaw-atomic-weights",
    title: "IUPAC Commission on Isotopic Abundances and Atomic Weights (CIAAW): standard atomic weights",
    url: "https://www.ciaaw.org/atomic-weights.htm",
    checked: CHECKED,
    class: "official",
    publisher: "IUPAC Commission on Isotopic Abundances and Atomic Weights (CIAAW)",
    license: "Outbound citation only. No redistribution grant found on the CIAAW site; no CIAAW values are bundled.",
    description: "Cited as the body that recommends standard atomic weights. Bundled weights are NIST's.",
  },
  {
    id: "pubchem-elements-outbound",
    title: "PubChem Periodic Table and element pages",
    url: "https://pubchem.ncbi.nlm.nih.gov/periodic-table/",
    checked: CHECKED,
    class: "official",
    publisher: "National Center for Biotechnology Information (NCBI), U.S. National Library of Medicine",
    license: "Outbound link only. Element properties on PubChem are attributed to third parties (Jefferson Lab, LANL, PubChem Elements) whose reuse terms are not confirmed; nothing is bundled.",
    terms_url: "https://www.nlm.nih.gov/web_policies.html",
  },
];
const byId = new Map(sourcesDoc.sources.map((s) => [s.id, s]));
let added = 0;
for (const s of catalog) {
  if (byId.has(s.id)) Object.assign(byId.get(s.id), s);
  else { sourcesDoc.sources.push(s); added++; }
}
save(sourcesPath, sourcesDoc);
console.log("elements-index: 118 rows, " + ieCount + " ionization energies, " + (118 - ieCount) + " [UNKNOWN]; sources appended: " + added);
