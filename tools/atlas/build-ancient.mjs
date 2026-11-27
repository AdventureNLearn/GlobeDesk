// Builds the Ancient World layer from the authoring files (ancient-sources, ancient-content):
//   data/atlas/ancient/<id>.json (one record per site or myth, schema globedesk.ancient/1) and ancient-world-overview.json,
//   atlas/packs/ancient-world/entries.json, and the Ancient World sources merged into atlas/packs/core/sources.json (by id).
// The polity outlines (js/atlas/ancient-extents-data.js, data/atlas/ancient/extents-index.json) come from
// tools/atlas/build-ancient-extents.py (needs a local Cliopatria copy) and are only read here. Local only, no network. Idempotent.
// Run before build-packs.mjs and build-js.mjs.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ROOT, ATLAS } from "./lib.mjs";
import { ANCIENT_SOURCES } from "./ancient-sources.mjs";
import { SITES, MYTHS, OVERVIEW } from "./ancient-content.mjs";

export const CHECKED = "2026-11-26";
const UNKNOWN = "[UNKNOWN]";
const LICENSE_REC = "CC BY 4.0 (our record text); pins are official UNESCO World Heritage points cited from the World Heritage Centre maps table (UNESCO terms), except Pompeii, which uses the Pleiades representative point (CC BY 3.0); linked sources keep their own terms";
const precisionOf = (d) => (/^-?\d{1,4}-\d{2}-\d{2}$/.test(d) ? "day" : /^-?\d{1,4}-\d{2}$/.test(d) ? "month" : "year");
const yearOf = (d) => parseInt(String(d), 10);
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1) + "…");

// Era buckets for the layer filter, by the earliest cited date (astronomical years: -2999 is 3000 BCE).
export const ERAS = [
  { id: "before-3000-bce", label: "Before 3000 BCE", to: -3000 }, { id: "3000-1001-bce", label: "3000–1001 BCE", to: -1000 },
  { id: "1000-1-bce", label: "1000–1 BCE", to: 0 }, { id: "1-1000-ce", label: "1–1000 CE", to: 1000 }, { id: "after-1000-ce", label: "After 1000 CE", to: 9999 },
];
export const eraOf = (y) => (y == null || Number.isNaN(y) ? UNKNOWN : (ERAS.find((e) => y <= e.to) || ERAS[ERAS.length - 1]).id);

const srcById = new Map(ANCIENT_SOURCES.map((s) => [s.id, s]));
const officialOf = (ids) => ids.filter((id) => (srcById.get(id) || {}).class === "official");
const row = ([date, event, source, o]) => ({ date, ...(o && o.end ? { end: o.end } : {}), precision: precisionOf(date), approximate: !!(o && o.approximate), event, source });

function coordsSource(p) {
  if (p.from === "unesco") {
    const where = p.component
      ? `component ${p.component} (${p.component_name}) of ${p.property}`
      : `${p.property} (World Heritage List ${p.list})`;
    return `UNESCO World Heritage Centre official point for ${where}, published as ${p.dms} at https://whc.unesco.org/en/list/${p.list}/maps/ (table read 2026-11-27); approximate, not a boundary`;
  }
  return p.from === "pleiades"
    ? `Pleiades place ${p.pleiades} representative point (CC BY 3.0); Wikidata ${p.wikidata} agrees within ${p.gap_km} km`
    : `Wikidata ${p.wikidata} coordinate (CC0)` + (p.pleiades ? `; the Pleiades ${p.pleiades} point is ${p.gap_km} km away, so not used` : "; no Pleiades record");
}

export function siteRecord(s) {
  const timeline = s.timeline.map(row);
  const first = Math.min(...timeline.map((t) => yearOf(t.date)));
  const official = officialOf(s.sources);
  return {
    schema: "globedesk.ancient/1", id: s.id, title: s.title, kind: "site", country: s.country,
    place: { label: s.label, pin: s.hold ? "held" : "shown", ...(s.hold ? { hold_reason: s.hold.reason, hold_source: s.hold.source } : { lat: s.pin.lat, lng: s.pin.lng }),
      approximate: true, basis: s.hold ? "site centre from a gazetteer; not a boundary" : (s.pin.from === "unesco" ? "official UNESCO World Heritage point; not a boundary" : "site centre from a gazetteer; not a boundary"), coords_source: s.hold ? "Pin held for the owner's site-by-site YES (sacred, Indigenous, burial or ritual site)" : coordsSource(s.pin),
      pleiades: s.pin.pleiades ? `https://pleiades.stoa.org/places/${s.pin.pleiades}` : null, wikidata: `https://www.wikidata.org/wiki/${s.pin.wikidata}` },
    era: eraOf(first), earliest_cited_year: first, status: s.status, ...(s.status_note ? { status_note: s.status_note } : {}), ...(s.sensitive ? { sensitive: true } : {}),
    tiers: { everyday: s.everyday, student: s.student }, timeline, facts: s.facts.map(([label, value, source]) => ({ label, value, source })), claims: [],
    sources: s.sources, official_sources: official, official_status: official.length ? "listed" : UNKNOWN,
    unknowns: s.unknowns, confidence: s.confidence, checked: CHECKED, license: LICENSE_REC, subject_person_living: false,
  };
}

export function mythRecord(m) {
  const official = officialOf(m.sources);
  return {
    schema: "globedesk.ancient/1", id: m.id, title: m.title, kind: "myth", place: null, era: UNKNOWN, status: "Myth or legend: no pin",
    tiers: { everyday: m.everyday, student: m.student }, timeline: m.dates.map(row), facts: [],
    claims: m.claims.map((c) => ({ text: c.text, claimStatus: c.status, sourceIds: c.sources, ...(c.note ? { note: c.note } : {}) })),
    sources: m.sources, official_sources: official, official_status: official.length ? "listed" : UNKNOWN,
    unknowns: m.unknowns, confidence: "medium", checked: CHECKED, license: LICENSE_REC, subject_person_living: false,
  };
}

const base = { category_path: ["history-places", "archaeology-sites"], tier: "everyday", layer: "ancient", pack: "ancient-world", status: "draft",
  license: "CC BY 4.0", checked: CHECKED, current: false, subject_person_living: false };

export function siteEntry(s, rec) {
  return {
    id: s.id, title: s.title, ...(s.aliases ? { aliases: s.aliases } : {}), kind: "place", ...base,
    see_also_paths: [["history-places", "maps-boundaries"]], tiers: { everyday: s.everyday, student: s.student }, summary: s.everyday,
    places: [rec.place.pin === "held" ? { region: s.country, precision: "country", note: clip(rec.place.label + ". Pin held for owner review: " + rec.place.hold_reason, 300) }
      : { region: s.country, lat: rec.place.lat, lng: rec.place.lng, precision: "site", note: clip(rec.place.label + " (approximate pin)", 300) }],
    dates: rec.timeline.map((t) => ({ date: t.date, ...(t.end ? { end: t.end } : {}), precision: t.precision, approximate: t.approximate, label: clip(t.event, 200) })),
    sources: s.sources, related: [{ type: "part-of", to: OVERVIEW.id }, ...(s.related || []).map(([type, to]) => ({ type, to }))], record: `data/atlas/ancient/${s.id}.json`, confidence: s.confidence,
    notes: clip(`Ancient World layer. ${rec.status}. Pin ${rec.place.pin}: ${rec.place.pin === "held" ? rec.place.hold_reason : rec.place.coords_source}. ${rec.unknowns.length ? "Gaps: " + rec.unknowns.join("; ") + "." : ""}`.trim(), 2000),
  };
}

export function mythEntry(m, rec) {
  return {
    id: m.id, title: m.title, aliases: m.aliases, kind: "topic", ...base, tiers: { everyday: m.everyday, student: m.student },
    summary: m.everyday, places: [], dates: rec.timeline.map((t) => ({ date: t.date, ...(t.end ? { end: t.end } : {}), precision: t.precision, approximate: t.approximate, label: clip(t.event, 200) })),
    sources: m.sources, related: [{ type: "part-of", to: OVERVIEW.id }], record: `data/atlas/ancient/${m.id}.json`, confidence: "medium",
    notes: clip(`Myth or legend, no pin. Claims: ${rec.claims.map((c) => `${c.text} (${c.claimStatus})`).join("; ")}.`, 2000),
  };
}

export function buildAll() {
  const siteRecs = SITES.map(siteRecord);
  const mythRecs = MYTHS.map(mythRecord);
  const extents = JSON.parse(readFileSync(path.join(ROOT, "data/atlas/ancient/extents-index.json"), "utf8"));
  const overviewRec = { schema: "globedesk.ancient-overview/1", id: OVERVIEW.id, title: OVERVIEW.title, checked: CHECKED, license: LICENSE_REC,
    tiers: { everyday: OVERVIEW.everyday, student: OVERVIEW.student }, eras: ERAS,
    counts: siteRecs.reduce((m, r) => ((m[r.era] = (m[r.era] || 0) + 1), m), {}),
    pins: { shown: siteRecs.filter((r) => r.place.pin === "shown").map((r) => r.id), held: siteRecs.filter((r) => r.place.pin === "held").map((r) => r.id) }, sites: siteRecs.map((r) => r.id), myths: mythRecs.map((r) => r.id),
    extents: { index: "data/atlas/ancient/extents-index.json", file: extents.file, source: "cliopatria", approximate: true, attribution: extents.attribution } };
  const overviewEntry = { id: OVERVIEW.id, title: OVERVIEW.title, aliases: OVERVIEW.aliases, kind: "topic", ...base,
    see_also_paths: [["history-places", "maps-boundaries"]], tiers: { everyday: OVERVIEW.everyday, student: OVERVIEW.student }, summary: OVERVIEW.everyday,
    places: [], dates: [], sources: ["unesco-whc-1572", "pleiades-245438984", "wikidata-p625", "cliopatria"], related: [],
    record: `data/atlas/ancient/${OVERVIEW.id}.json`, records: ["data/atlas/ancient/extents-index.json"], confidence: "medium" };
  const entries = [overviewEntry, ...SITES.map((s, i) => siteEntry(s, siteRecs[i])), ...MYTHS.map((m, i) => mythEntry(m, mythRecs[i]))];
  return { siteRecs, mythRecs, overviewRec, entries };
}

function writeJson(rel, obj) { const abs = path.join(ROOT, rel); mkdirSync(path.dirname(abs), { recursive: true }); writeFileSync(abs, JSON.stringify(obj, null, 2) + "\n"); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = buildAll();
  [...out.siteRecs, ...out.mythRecs].forEach((r) => writeJson(`data/atlas/ancient/${r.id}.json`, r));
  writeJson(`data/atlas/ancient/${OVERVIEW.id}.json`, out.overviewRec);
  writeJson("atlas/packs/ancient-world/entries.json", { schema: "globedesk.atlas-entries/1", pack: "ancient-world", entries: out.entries });
  const srcPath = path.join(ATLAS, "packs/core/sources.json");
  const doc = JSON.parse(readFileSync(srcPath, "utf8"));
  ANCIENT_SOURCES.forEach((s) => { const i = doc.sources.findIndex((x) => x.id === s.id); if (i >= 0) doc.sources[i] = s; else doc.sources.push(s); });
  writeFileSync(srcPath, JSON.stringify(doc, null, 2) + "\n");
  console.log(`built ${out.siteRecs.length} site records, ${out.mythRecs.length} myth records, ${out.entries.length} ancient-world entries, ${ANCIENT_SOURCES.length} sources`);
}
