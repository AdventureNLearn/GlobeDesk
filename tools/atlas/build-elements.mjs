// Build 118 chemistry/elements Atlas entries from cached NIST, IUPAC and Wikidata
// snapshots. Local only. Does not fetch the network. The raw cache lives outside
// the repo: ../globedesk-plans/source-cache relative to the repo root, or
// GLOBEDESK_ELEMENTS_CACHE. This script writes derived Atlas files only, and
// merges lithium-element and copper-element instead of replacing them.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ATLAS = path.join(ROOT, "atlas");
const CHECKED = "2026-11-25";
const SOURCE_IDS = {
  nist: "nist-atomic-weights",
  iupac: "iupac-periodic-table-2022",
  wikidata: "wikidata-chemical-elements",
};

function cacheDir() {
  if (process.env.GLOBEDESK_ELEMENTS_CACHE) return path.resolve(process.env.GLOBEDESK_ELEMENTS_CACHE);
  return path.resolve(ROOT, "../globedesk-plans/source-cache");
}

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function save(p, obj) {
  writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

function titleCase(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function loadCache() {
  const dir = cacheDir();
  const nistPath = path.join(dir, "nist/nist-atomic-weights.json");
  const iupacPath = path.join(dir, "iupac/iupac-names-groups-2022.json");
  const wdPath = path.join(dir, "wikidata/elements-discovery.json");
  for (const p of [nistPath, iupacPath, wdPath]) {
    if (!existsSync(p)) {
      throw new Error("Missing source cache file " + p + ". Set GLOBEDESK_ELEMENTS_CACHE to the folder that holds the NIST, IUPAC and Wikidata snapshots.");
    }
  }
  return {
    dir,
    nist: readJson(nistPath),
    iupac: readJson(iupacPath),
    wikidata: readJson(wdPath),
  };
}

// Wikibase time precision: 11 day, 10 month, 9 year. Coarser is not a year we can record.
function parseWikidataTime(iso, precision) {
  const p = Number(precision);
  if (!Number.isFinite(p) || p < 9) return null;
  const m = String(iso).match(/^([+-]?)(\d{1,8})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return null;
  let year = parseInt(m[2], 10);
  if (m[1] === "-") year = -year;
  // Atlas dates: 1-4 digit astronomical year, optional month/day.
  if (year < -9999 || year > 9999) return null;
  const month = m[3];
  const day = m[4];
  let date;
  let prec;
  if (p >= 11 && month && day) {
    date = year + "-" + month + "-" + day;
    prec = "day";
  } else if (p >= 10 && month) {
    date = year + "-" + month;
    prec = "month";
  } else {
    date = String(year);
    prec = "year";
  }
  if (!/^-?[0-9]{1,4}(-[0-9]{2}(-[0-9]{2})?)?$/.test(date)) return null;
  return { date, precision: prec, approximate: false, label: "Discovery time (Wikidata)" };
}

function wikidataByZ(doc) {
  const rows = (doc.results && doc.results.bindings) || [];
  const byZ = new Map();
  for (const b of rows) {
    const z = Number(b.z && b.z.value);
    if (!Number.isInteger(z) || z < 1 || z > 118) continue;
    const rec = byZ.get(z) || { dates: [], discoverers: new Map(), elementUrl: null, label: null };
    if (b.element && b.element.value) rec.elementUrl = b.element.value;
    if (b.elementLabel && b.elementLabel.value) rec.label = b.elementLabel.value;
    if (b.discoveryTime && b.discoveryTime.value) {
      const parsed = parseWikidataTime(b.discoveryTime.value, b.precision && b.precision.value);
      if (parsed) {
        const key = parsed.date + "|" + parsed.precision;
        if (!rec.dates.some((d) => d.date + "|" + d.precision === key)) rec.dates.push(parsed);
      }
    }
    if (b.discovererLabel && b.discovererLabel.value) {
      const name = b.discovererLabel.value.trim();
      if (name && !/^Q\d+$/.test(name)) {
        const kind = (b.discovererInstanceLabel && b.discovererInstanceLabel.value) || "";
        const prev = rec.discoverers.get(name) || { name, kinds: new Set() };
        if (kind) prev.kinds.add(kind);
        rec.discoverers.set(name, prev);
      }
    }
    byZ.set(z, rec);
  }
  return byZ;
}

function discoverySentences(wd) {
  const names = wd ? [...wd.discoverers.values()].map((d) => d.name) : [];
  const credit = names.length
    ? "Discovery credit (Wikidata): " + names.join(", ") + "."
    : "Discovery credit [UNKNOWN] (Wikidata).";
  const dates = (wd && wd.dates) || [];
  let yearLine;
  if (dates.length === 1) {
    yearLine = "Discovery time (Wikidata): " + dates[0].date + ".";
  } else if (dates.length > 1) {
    yearLine = "Wikidata lists more than one discovery time (" + dates.map((d) => d.date).join(", ") + "); a single year is not chosen.";
  } else {
    yearLine = "Discovery year [UNKNOWN] (Wikidata).";
  }
  return { credit, yearLine, dates, names };
}

function buildSummary(iupac, nist, wd, groupNote) {
  const name = titleCase(iupac.name);
  const weightLine = nist.standard_atomic_weight === "[UNKNOWN]"
    ? "Standard atomic weight [UNKNOWN] (NIST lists no standard atomic weight)."
    : "Standard atomic weight " + nist.standard_atomic_weight + " (NIST Atomic Weights and Isotopic Compositions).";
  let groupBit;
  if (iupac.group === "[UNKNOWN]") {
    groupBit = "IUPAC group [UNKNOWN]";
  } else {
    groupBit = "IUPAC group " + iupac.group;
  }
  const { credit, yearLine } = discoverySentences(wd);
  const parts = [
    "DRAFT. " + name + " (" + iupac.symbol + ", element " + iupac.z + ").",
    weightLine,
    groupBit + ", period " + iupac.period + " (IUPAC Periodic Table, 4 May 2022).",
    yearLine,
    credit,
  ];
  if (groupNote) parts.push(groupNote);
  const summary = parts.join(" ");
  if (summary.length > 2000) throw new Error("summary too long for Z=" + iupac.z);
  return summary;
}

function elementEntry(iupac, nist, wd) {
  const name = titleCase(iupac.name);
  const id = iupac.name + "-element";
  const { dates } = discoverySentences(wd);
  const notes = iupac.group_note || undefined;
  const entry = {
    id,
    title: name + " (" + iupac.symbol + ", element " + iupac.z + ")",
    kind: "chemistry",
    category_path: ["chemistry", "elements"],
    tier: "student",
    summary: buildSummary(iupac, nist, wd, iupac.group_note),
    places: [],
    dates,
    sources: [SOURCE_IDS.nist, SOURCE_IDS.iupac, SOURCE_IDS.wikidata],
    related: [],
    pack: "chemistry",
    status: "draft",
    confidence: "high",
    license: "CC BY 4.0",
    checked: CHECKED,
    current: false,
    subject_person_living: false,
    aliases: [iupac.symbol + " (atomic number " + iupac.z + ")"],
  };
  if (notes) entry.notes = notes;
  return entry;
}

function mergePreserved(existing, generated) {
  // Keep hand-written summary, related links, aliases, confidence, status, tier,
  // existing sources (union), title, and any record / outbound / see_also fields.
  const sources = [];
  for (const id of [...(existing.sources || []), ...generated.sources]) {
    if (!sources.includes(id)) sources.push(id);
  }
  const merged = {
    ...generated,
    title: existing.title || generated.title,
    summary: existing.summary || generated.summary,
    aliases: existing.aliases && existing.aliases.length ? existing.aliases : generated.aliases,
    related: existing.related || [],
    sources,
    confidence: existing.confidence || generated.confidence,
    status: existing.status || generated.status,
    tier: existing.tier || generated.tier,
    license: existing.license || generated.license,
    checked: CHECKED,
  };
  if (existing.record) merged.record = existing.record;
  if (existing.records) merged.records = existing.records;
  if (existing.see_also_ids) merged.see_also_ids = existing.see_also_ids;
  if (existing.see_also_paths) merged.see_also_paths = existing.see_also_paths;
  if (existing.outbound) merged.outbound = existing.outbound;
  if (existing.tiers) merged.tiers = existing.tiers;
  // New sourced dates and group notes fill gaps only; do not drop a hand-written date list if present.
  if (existing.dates && existing.dates.length) merged.dates = existing.dates;
  if (existing.notes && generated.notes && existing.notes !== generated.notes) {
    merged.notes = existing.notes + " " + generated.notes;
  } else if (existing.notes) {
    merged.notes = existing.notes;
  }
  if (existing.summary && existing.summary !== generated.summary) {
    const extra = sourcedGapNotes(generated);
    const already = (merged.summary + " " + (merged.notes || "")).toLowerCase();
    if (extra && !already.includes("iupac group")) {
      merged.notes = (merged.notes ? merged.notes + " " : "") + extra;
    }
  }
  return merged;
}

function sourcedGapNotes(generated) {
  const bits = [];
  const g = generated.summary.match(/IUPAC group [^.]+\./);
  const y = generated.summary.match(/Discovery time \(Wikidata\): [^.]+\./)
    || generated.summary.match(/Wikidata lists more than one discovery time[^.]+\./)
    || generated.summary.match(/Discovery year \[UNKNOWN\] \(Wikidata\)\./);
  const c = generated.summary.match(/Discovery credit[^.]+\./);
  if (g) bits.push(g[0]);
  if (y) bits.push(y[0]);
  if (c) bits.push(c[0]);
  if (generated.notes) bits.push(generated.notes);
  return bits.join(" ");
}

function upsertSources(sources) {
  const catalog = [
    {
      id: SOURCE_IDS.nist,
      title: "NIST Atomic Weights and Isotopic Compositions with Relative Atomic Masses",
      url: "https://www.nist.gov/pml/atomic-weights-and-isotopic-compositions-relative-atomic-masses",
      checked: CHECKED,
      class: "official",
      publisher: "National Institute of Standards and Technology (NIST)",
      license: "US federal government work (public domain, 17 U.S.C. 105)",
      description: "Data compilation (formerly SRD 144) covering atomic numbers 1 to 118. Used here for atomic number, symbol and standard atomic weight.",
    },
    {
      id: SOURCE_IDS.iupac,
      title: "IUPAC Periodic Table of the Elements (4 May 2022)",
      url: "https://iupac.org/what-we-do/periodic-table-of-elements/",
      checked: CHECKED,
      class: "official",
      publisher: "International Union of Pure and Applied Chemistry (IUPAC)",
      license: "IUPAC states \"The table is yours to use.\" Official PDF marked Copyright © 2022 IUPAC. This pack uses official names and Group 1-18 numbering with IUPAC credit; the official table artwork is not bundled.",
      description: "Official names, symbols, period and Group 1-18 column numbers. Group 3 membership for La, Lu, Ac and Lr is unresolved on this table.",
    },
    {
      id: SOURCE_IDS.wikidata,
      title: "Wikidata structured data for chemical elements (discovery time and discoverer)",
      url: "https://www.wikidata.org/wiki/Wikidata:Copyright",
      checked: CHECKED,
      class: "official",
      publisher: "Wikidata",
      license: "Structured data in the main, Property, Lexeme and EntitySchema namespaces is CC0 (Wikidata:Copyright). Text in other namespaces is CC BY-SA and is not used here.",
      description: "Used only for structured discovery-time values (with Wikibase precision) and discoverer or laboratory name labels. No biographical details are copied.",
    },
  ];
  const byId = new Map(sources.map((s) => [s.id, s]));
  let added = 0;
  for (const src of catalog) {
    if (!byId.has(src.id)) {
      sources.push(src);
      added++;
    }
  }
  return added;
}

const cache = loadCache();
const nistByZ = new Map(cache.nist.elements.map((e) => [e.z, e]));
const iupacByZ = new Map(cache.iupac.elements.map((e) => [e.z, e]));
const wdByZ = wikidataByZ(cache.wikidata);

const generated = [];
for (let z = 1; z <= 118; z++) {
  const iupac = iupacByZ.get(z);
  const nist = nistByZ.get(z);
  if (!iupac || !nist) throw new Error("Missing cached NIST or IUPAC row for Z=" + z);
  if (iupac.symbol !== nist.symbol) throw new Error("Symbol mismatch at Z=" + z + ": IUPAC " + iupac.symbol + " vs NIST " + nist.symbol);
  generated.push(elementEntry(iupac, nist, wdByZ.get(z)));
}

const chemPath = path.join(ATLAS, "packs/chemistry/entries.json");
const chem = readJson(chemPath);
const existingById = new Map((chem.entries || []).map((e) => [e.id, e]));
const nonElements = (chem.entries || []).filter((e) => !(e.category_path && e.category_path[1] === "elements"));
const PRESERVE_IDS = new Set(["lithium-element", "copper-element"]);
const elements = generated.map((g) => {
  const prev = existingById.get(g.id);
  return prev && PRESERVE_IDS.has(g.id) ? mergePreserved(prev, g) : g;
});

// Guard: never drop or duplicate the two existing element entries.
for (const id of ["lithium-element", "copper-element"]) {
  if (!elements.some((e) => e.id === id)) throw new Error("Missing merged entry " + id);
  if (elements.filter((e) => e.id === id).length !== 1) throw new Error("Duplicated entry " + id);
}
if (elements.length !== 118) throw new Error("Expected 118 element entries, got " + elements.length);

const nextEntries = [...nonElements, ...elements];
if (new Set(nextEntries.map((e) => e.id)).size !== nextEntries.length) {
  throw new Error("Duplicate chemistry entry id after merge");
}
save(chemPath, { schema: chem.schema || "globedesk.atlas-entries/1", pack: "chemistry", entries: nextEntries });

const sourcesPath = path.join(ATLAS, "packs/core/sources.json");
const sourcesDoc = readJson(sourcesPath);
const added = upsertSources(sourcesDoc.sources);
save(sourcesPath, sourcesDoc);

const unknownWeight = generated.filter((e) => /Standard atomic weight \[UNKNOWN\]/.test(e.summary)).length;
const unknownGroup = elements.filter((e) => e.notes && e.notes.includes("group")).length;
const unknownYear = elements.filter((e) => !e.dates.length).length;
const multiYear = elements.filter((e) => e.dates.length > 1).length;

console.log("cache " + cache.dir);
console.log("wrote " + elements.length + " element entries and kept " + nonElements.length + " other chemistry entries");
console.log("sources appended: " + added);
console.log("NIST weight [UNKNOWN]: " + unknownWeight);
console.log("Wikidata year [UNKNOWN] (no year-or-finer date): " + unknownYear);
console.log("Wikidata multiple discovery times (not choosing one): " + multiYear);
console.log("merged lithium-element and copper-element");
