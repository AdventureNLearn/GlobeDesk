// Builds the disasters layer (Volcanoes, earthquakes and disasters) from disasters-sources.mjs and
// disasters-content.mjs:
//   data/atlas/disasters/<id>.json (schema globedesk.disaster/1), data/atlas/disasters/disasters-overview.json
//   (globedesk.disaster-overview/1, with the stories and the cross-links to existing Atlas events),
//   the entries replaced or appended by id in atlas/packs/earth/entries.json (subcategory natural-hazards),
//   and the sources merged by id into atlas/packs/core/sources.json.
// Local only, no network, idempotent. Run after build-bells.mjs and before build-packs.mjs.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ROOT, ATLAS } from "./lib.mjs";
import { DISASTER_SOURCES } from "./disasters-sources.mjs";
import { DISASTERS, LINKED, OVERVIEW } from "./disasters-content.mjs";

export const CHECKED = "2026-11-26";
export const HAZARDS = [{ id: "eruption", label: "Volcanic eruptions" }, { id: "earthquake", label: "Earthquakes" }];
const LICENSE_REC = "CC BY 4.0 (our record text); NOAA NCEI and USGS values are US government works; linked sources keep their own terms";
const PATH = ["earth", "natural-hazards"];
const OFFICIAL = new Set(DISASTER_SOURCES.filter((s) => s.class === "official").map((s) => s.id));
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1) + "…");
const uniq = (a) => [...new Set(a)];

export function sourcesOf(d) {
  return uniq([d.ncei.dataset, d.date.source, ...d.measures.map((m) => m.source), ...d.facts.map((f) => f.source), ...d.claims.flatMap((c) => c.sources)]);
}

export function disasterRecord(d) {
  const sources = sourcesOf(d);
  const official = sources.filter((id) => OFFICIAL.has(id));
  return {
    schema: "globedesk.disaster/1", id: d.id, title: d.title, hazard: d.hazard, region: d.region, country: d.country,
    place: { ...d.place, coords_source: `NOAA NCEI ${d.hazard === "earthquake" ? "Significant Earthquake" : "Significant Volcanic Eruptions"} Database, event ${d.ncei.event_id}` },
    date: d.date, ncei: d.ncei, measures: d.measures, facts: d.facts, claims: d.claims,
    tiers: { everyday: d.everyday, student: d.student }, sources, official_sources: official, official_status: official.length ? "listed" : "[UNKNOWN]",
    unknowns: d.unknowns || [], see_also_ids: d.see_also_ids || [], confidence: d.confidence, checked: CHECKED, license: LICENSE_REC, subject_person_living: false,
  };
}

export function disasterEntry(d, rec) {
  return {
    id: d.id, title: d.title, aliases: d.aliases, kind: "event", category_path: PATH,
    see_also_paths: [["history-places", "events-eras"], ["earth", "geology-minerals"]], tier: "everyday",
    tiers: rec.tiers, layer: "disasters", ...(rec.see_also_ids.length ? { see_also_ids: rec.see_also_ids } : {}),
    summary: d.everyday,
    places: [{ region: d.country, lat: d.place.lat, lng: d.place.lng, precision: "site", note: clip(d.place.label + (d.place.approximate ? " (approximate pin: " + d.place.basis + ")" : ""), 300) }],
    dates: [{ date: d.date.date, precision: d.date.precision, approximate: false, label: clip(d.date.label, 200) }],
    sources: rec.sources,
    related: [{ type: "part-of", to: OVERVIEW.id }, ...(d.related || []).map(([type, to]) => ({ type, to }))],
    record: `data/atlas/disasters/${d.id}.json`, pack: "earth", status: "draft", confidence: d.confidence, license: "CC BY 4.0", checked: CHECKED,
    current: false, subject_person_living: false,
    notes: clip(`Disasters layer (${d.hazard}). NCEI event ${d.ncei.event_id}. ${rec.unknowns.length ? "Gaps: " + rec.unknowns.join("; ") + "." : ""}`.trim(), 2000),
  };
}

export function buildAll() {
  const records = DISASTERS.map(disasterRecord);
  const entries = DISASTERS.map((d, i) => disasterEntry(d, records[i]));
  const members = [...DISASTERS.map((d) => ({ id: d.id, hazard: d.hazard, linked: false })), ...LINKED.map((l) => ({ id: l.id, hazard: l.hazard, linked: true }))];
  const counts = members.reduce((m, x) => ((m[x.hazard] = (m[x.hazard] || 0) + 1), m), {});
  const ovSources = uniq([...DISASTER_SOURCES.filter((s) => s.class === "official").map((s) => s.id),
    ...LINKED.flatMap((l) => l.facts.map((f) => f.source)), ...OVERVIEW.stories.flatMap((s) => s.steps.flatMap((x) => x.sources))]);
  const overviewRec = { schema: "globedesk.disaster-overview/1", id: OVERVIEW.id, title: OVERVIEW.title, checked: CHECKED, license: LICENSE_REC,
    tiers: { everyday: OVERVIEW.everyday, student: OVERVIEW.student }, hazards: HAZARDS, members, counts,
    linked: LINKED, stories: OVERVIEW.stories, sources: ovSources,
    excluded: [{ name: "Smithsonian Global Volcanism Program", reason: "Reuse terms [UNKNOWN]; not bundled or linked" }] };
  const overviewEntry = { id: OVERVIEW.id, title: OVERVIEW.title, aliases: OVERVIEW.aliases, kind: "topic", category_path: PATH,
    see_also_paths: [["history-places", "events-eras"], ["earth", "geology-minerals"]], tier: "everyday", tiers: overviewRec.tiers,
    layer: "disasters", summary: OVERVIEW.everyday, places: [], dates: [], sources: ovSources,
    related: members.map((m) => ({ type: "see-also", to: m.id })), record: "data/atlas/disasters/disasters-overview.json", pack: "earth",
    status: "draft", confidence: "medium", license: "CC BY 4.0", checked: CHECKED, current: false, subject_person_living: false };
  return { records, entries: [overviewEntry, ...entries], overviewRec };
}

function writeJson(rel, obj) { const abs = path.join(ROOT, rel); mkdirSync(path.dirname(abs), { recursive: true }); writeFileSync(abs, JSON.stringify(obj, null, 2) + "\n"); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = buildAll();
  out.records.forEach((r) => writeJson(`data/atlas/disasters/${r.id}.json`, r));
  writeJson("data/atlas/disasters/disasters-overview.json", out.overviewRec);
  // Sources and earth entries: replace by id, append new ones; existing order kept. Works on parsed JSON.
  const srcPath = path.join(ATLAS, "packs/core/sources.json");
  const doc = JSON.parse(readFileSync(srcPath, "utf8"));
  DISASTER_SOURCES.forEach((s) => { const i = doc.sources.findIndex((x) => x.id === s.id); if (i >= 0) doc.sources[i] = s; else doc.sources.push(s); });
  writeFileSync(srcPath, JSON.stringify(doc, null, 2) + "\n");
  const earthPath = path.join(ATLAS, "packs/earth/entries.json");
  const earth = JSON.parse(readFileSync(earthPath, "utf8"));
  out.entries.forEach((e) => { const i = earth.entries.findIndex((x) => x.id === e.id); if (i >= 0) earth.entries[i] = e; else earth.entries.push(e); });
  writeFileSync(earthPath, JSON.stringify(earth, null, 2) + "\n");
  console.log(`built ${out.records.length} disaster records, ${out.entries.length} earth-pack entries (incl. overview), ${out.overviewRec.linked.length} cross-links, ${out.overviewRec.stories.length} stories, ${DISASTER_SOURCES.length} sources`);
}
