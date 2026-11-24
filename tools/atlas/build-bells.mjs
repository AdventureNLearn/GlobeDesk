// Builds the Bells layer from the authoring files (bells-sources, bells-content*, bells-overview):
//   data/atlas/bells/<id>.json (one record per bell, schema globedesk.bell/1) and bells-overview.json,
//   data/atlas/chemistry/bell-bronze.json, atlas/packs/bells/entries.json,
//   the bell sources merged into atlas/packs/core/sources.json (by id), and the bell-bronze entry in
//   atlas/packs/chemistry/entries.json. Local only, no network. Idempotent: rerun after editing content.
// Run before build-packs.mjs and build-js.mjs.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ROOT, ATLAS } from "./lib.mjs";
import { BELL_SOURCES } from "./bells-sources.mjs";
import { BELLS, GEO, REGION_OF } from "./bells-content.mjs";
import { OVERVIEW, BRONZE } from "./bells-overview.mjs";

export const CHECKED = "2026-11-24";
const UNKNOWN = "[UNKNOWN]";
const LICENSE_REC = "CC BY 4.0 (our record text); linked sources keep their own terms";
const COORDS = "OpenStreetMap Nominatim lookup of the named site (ODbL)";
const precisionOf = (d) => (/^-?\d{1,4}-\d{2}-\d{2}$/.test(d) ? "day" : /^-?\d{1,4}-\d{2}$/.test(d) ? "month" : "year");
const yearOf = (d) => parseInt(String(d), 10);

// Era buckets for the layer filter. The first timeline row is the bell's origin unless the content says otherwise.
export const ERAS = [
  { id: "ancient", label: "Before 500", to: 499 }, { id: "medieval", label: "500–1499", to: 1499 },
  { id: "early-modern", label: "1500–1799", to: 1799 }, { id: "19th-century", label: "1800s", to: 1899 },
  { id: "20th-century", label: "1900s", to: 1999 }, { id: "21st-century", label: "2000s", to: 9999 },
];
export function eraOf(year) { if (year == null || Number.isNaN(year)) return UNKNOWN; return (ERAS.find((e) => year <= e.to) || ERAS[ERAS.length - 1]).id; }
// Bells whose first dated row is not when the bell was made: era stays [UNKNOWN] or is set from the present bells.
const ERA_OVERRIDE = { "maria-angola-cusco": UNKNOWN, "dolores-bell": UNKNOWN, "panaji-church-bell": UNKNOWN, "balangiga-bells": UNKNOWN,
  "lutine-bell": UNKNOWN, "uglich-exile-bell": UNKNOWN, "mechelen-carillons": UNKNOWN, "swan-bells-perth": UNKNOWN, "bow-bells": "20th-century" };

const srcById = new Map(BELL_SOURCES.map((s) => [s.id, s]));
const isOfficial = (id) => { const s = srcById.get(id); return !!s && s.class === "official"; };

function modelOf(b) {
  if (b.model === false) return { id: "none", available: false, from_sources: false, label: b.model_reason || "Not modelled: a ring, carillon or set has no single bell profile in the cited sources." };
  if (b.diameter_m) {
    const params = { diameter_m: b.diameter_m };
    if (b.height_m) params.height_m = b.height_m;
    if (b.thickness_m) params.thickness_m = b.thickness_m;
    return { id: "bell", available: true, from_sources: true, params, label: (b.model_note ? b.model_note + ". " : "") + "Parametric profile scaled from the sourced diameter" + (b.height_m ? " and height" : "") + (b.thickness_m ? " and wall thickness" : "") + "; the curve itself is a generic Western bell profile, not a scan." };
  }
  return { id: "bell", available: true, from_sources: false, label: "Generic bell profile: diameter [UNKNOWN], so the 3D shape is illustrative only and not to scale." };
}

export function bellRecord(b) {
  const g = GEO[b.id];
  if (!g) throw new Error(`no coordinates for ${b.id}`);
  const timeline = (b.timeline || []).map(([date, event, source, o]) => ({ date, ...(o && o.end ? { end: o.end } : {}), precision: precisionOf(date), approximate: !!(o && o.approximate), event, source }));
  const first = timeline.length ? Math.min(...timeline.map((t) => yearOf(t.date))) : null;
  const official = b.sources.filter(isOfficial);
  return {
    schema: "globedesk.bell/1", id: b.id, title: b.title, kind: b.kind, status: b.status, status_note: b.status_note,
    era: Object.prototype.hasOwnProperty.call(ERA_OVERRIDE, b.id) ? ERA_OVERRIDE[b.id] : eraOf(first), region: REGION_OF[b.country], country: b.country,
    place: { label: b.place.label, lat: g[0], lng: g[1], approximate: !!b.place.approximate, basis: b.place.basis, coords_source: COORDS },
    maker: b.maker || UNKNOWN, mass_kg: b.mass_kg ?? null, mass_note: b.mass_note || UNKNOWN, diameter_m: b.diameter_m ?? null, height_m: b.height_m ?? null,
    ...(b.thickness_m ? { thickness_m: b.thickness_m } : {}), note: b.note ?? null, ...(b.bells_count !== undefined ? { bells_count: b.bells_count } : {}),
    alloy: { entry: "bell-bronze", note: b.alloy_note || UNKNOWN }, timeline, tiers: { everyday: b.everyday, student: b.student },
    sources: b.sources, official_sources: official, official_status: b.official_status || (official.length ? "listed" : UNKNOWN),
    model: modelOf(b), unknowns: b.unknowns || [], confidence: b.confidence, checked: CHECKED, license: LICENSE_REC, subject_person_living: false,
  };
}

const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1) + "…");
export function bellEntry(b, rec) {
  const seeAlso = [["history-places", "events-eras"], ["chemistry", "metals-alloys"], ...(b.see_also || [])];
  const dates = rec.timeline.map((t) => ({ date: t.date, ...(t.end ? { end: t.end } : {}), precision: t.precision, approximate: t.approximate, label: clip(t.event, 200) }));
  return {
    id: b.id, title: b.title, ...(b.aliases && b.aliases.length ? { aliases: b.aliases } : {}), kind: "object", category_path: ["objects", "bells"],
    see_also_paths: seeAlso.filter((p, i) => seeAlso.findIndex((q) => q.join("/") === p.join("/")) === i), tier: "everyday",
    tiers: { everyday: b.everyday, student: b.student }, layer: "bells", ...(rec.model.available ? { model: "bell" } : {}),
    summary: b.everyday,
    places: [{ region: b.country, lat: rec.place.lat, lng: rec.place.lng, precision: "site", note: clip(rec.place.label + (rec.place.approximate ? " (approximate pin)" : ""), 300) }],
    dates, sources: b.sources,
    related: [{ type: "made-of", to: "bell-bronze" }, { type: "part-of", to: "bells-overview" }, ...(b.related || []).map(([type, to]) => ({ type, to }))],
    record: `data/atlas/bells/${b.id}.json`, pack: "bells", status: "draft", confidence: b.confidence, license: "CC BY 4.0", checked: CHECKED,
    current: false, subject_person_living: false,
    notes: clip(`Bells layer. Status ${rec.status}. Official source ${rec.official_status}. ${rec.unknowns.length ? "Gaps: " + rec.unknowns.join("; ") + "." : ""}`.trim(), 2000),
  };
}

export function buildAll() {
  const records = BELLS.map(bellRecord);
  const entries = BELLS.map((b, i) => bellEntry(b, records[i]));
  const overviewRec = { schema: "globedesk.bell-overview/1", id: OVERVIEW.id, title: OVERVIEW.title, checked: CHECKED, license: LICENSE_REC,
    tiers: { everyday: OVERVIEW.everyday, student: OVERVIEW.student }, sections: OVERVIEW.sections,
    counts: records.reduce((m, r) => ((m[r.region] = (m[r.region] || 0) + 1), m), {}), eras: ERAS };
  const ovSources = [...new Set(OVERVIEW.sections.flatMap((s) => s.sources))];
  const overviewEntry = { id: OVERVIEW.id, title: OVERVIEW.title, aliases: OVERVIEW.aliases, kind: "topic", category_path: ["objects", "bells"],
    see_also_paths: [["history-places", "events-eras"], ["chemistry", "metals-alloys"]], tier: "everyday", tiers: { everyday: OVERVIEW.everyday, student: OVERVIEW.student },
    layer: "bells", summary: OVERVIEW.everyday, places: [], dates: [], sources: ovSources,
    related: [{ type: "see-also", to: "bell-bronze" }], record: "data/atlas/bells/bells-overview.json", pack: "bells", status: "draft", confidence: "medium",
    license: "CC BY 4.0", checked: CHECKED, current: false, subject_person_living: false };
  const bronzeRec = { schema: "globedesk.chem/0-draft", id: BRONZE.id, name: BRONZE.title, license: LICENSE_REC, checked: CHECKED,
    note: "Composition and temperature as sourced; phase data [UNKNOWN].", properties: BRONZE.properties, used_by: records.map((r) => r.id) };
  const bronzeEntry = { id: BRONZE.id, title: BRONZE.title, aliases: BRONZE.aliases, kind: "chemistry", category_path: ["chemistry", "metals-alloys"],
    see_also_paths: [["objects", "bells"]], tier: "everyday", tiers: { everyday: BRONZE.everyday, student: BRONZE.student }, summary: BRONZE.everyday,
    places: [], dates: [], sources: BRONZE.sources, related: [{ type: "cited-by", to: "bells-overview" }, { type: "cited-by", to: "liberty-bell" }],
    record: "data/atlas/chemistry/bell-bronze.json", pack: "chemistry", status: "draft", confidence: "medium", license: "CC BY 4.0", checked: CHECKED,
    current: false, subject_person_living: false };
  return { records, entries: [overviewEntry, ...entries], overviewRec, bronzeRec, bronzeEntry };
}

function writeJson(rel, obj) { const abs = path.join(ROOT, rel); mkdirSync(path.dirname(abs), { recursive: true }); writeFileSync(abs, JSON.stringify(obj, null, 2) + "\n"); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = buildAll();
  out.records.forEach((r) => writeJson(`data/atlas/bells/${r.id}.json`, r));
  writeJson("data/atlas/bells/bells-overview.json", out.overviewRec);
  writeJson("data/atlas/chemistry/bell-bronze.json", out.bronzeRec);
  writeJson("atlas/packs/bells/entries.json", { schema: "globedesk.atlas-entries/1", pack: "bells", entries: out.entries });
  // Sources: replace by id, append new ones; existing order kept.
  const srcPath = path.join(ATLAS, "packs/core/sources.json");
  const doc = JSON.parse(readFileSync(srcPath, "utf8"));
  const clean = (s) => { const { verify, ...rest } = s; return { ...rest, verified: verify === "webfetch" ? "opened via a fetch service (direct fetch blocked by the site)" : "opened directly (HTTP 200)" }; };
  BELL_SOURCES.forEach((s) => { const i = doc.sources.findIndex((x) => x.id === s.id); if (i >= 0) doc.sources[i] = clean(s); else doc.sources.push(clean(s)); });
  writeFileSync(srcPath, JSON.stringify(doc, null, 2) + "\n");
  // Chemistry pack: keep the hand-formatted file; insert or replace the one bell-bronze line.
  const chemPath = path.join(ATLAS, "packs/chemistry/entries.json");
  let chem = readFileSync(chemPath, "utf8");
  const line = "  " + JSON.stringify(out.bronzeEntry);
  const re = /\n {2}\{"id":"bell-bronze".*\}(,?)(?=\n)/;
  if (re.test(chem)) chem = chem.replace(re, (m, comma) => "\n" + line + comma);
  else chem = chem.replace(/\n\] \}\s*$/, ",\n" + line + "\n] }\n");
  writeFileSync(chemPath, chem);
  JSON.parse(chem);
  console.log(`built ${out.records.length} bell records, ${out.entries.length} bells-pack entries, bell-bronze, ${BELL_SOURCES.length} sources`);
}
