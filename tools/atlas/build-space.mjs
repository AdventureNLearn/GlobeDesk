// Builds the space layer (Space race and launch sites) from space-sources.mjs and space-content.mjs:
//   data/atlas/space/<id>.json (schema globedesk.space-site/1: Earth launch sites and Moon landing sites),
//   data/atlas/space/space-overview.json (globedesk.space-overview/1: members, linked Apollo 11, 2 stories),
//   entries replaced or appended by id in atlas/packs/science-history/entries.json (subcategory space-race),
//   and the sources merged by id into atlas/packs/core/sources.json.
// Local only, no network, idempotent. Run after build-disasters.mjs and before build-packs.mjs.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ROOT, ATLAS } from "./lib.mjs";
import { SPACE_SOURCES } from "./space-sources.mjs";
import { LAUNCH_SITES, LUNAR_SITES, LINKED, OVERVIEW, FRAME } from "./space-content.mjs";

export const CHECKED = "2026-11-26";
const LICENSE_REC = "CC BY 4.0 (our record text); NASA and IAU values are public-domain US-hosted data; linked sources keep their own terms";
const PATH = ["science-history", "space-race"];
const OFFICIAL = new Set(SPACE_SOURCES.filter((s) => s.class === "official").map((s) => s.id));
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1) + "…");
const uniq = (a) => [...new Set(a)];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (d) => { const [y, m, dd] = d.split("-"); return `${parseInt(dd, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`; };

// Normalised site list: one shape for Earth launch sites and Moon landing sites.
export function normalise() {
  const earth = LAUNCH_SITES.map((s) => ({ ...s, body: "earth", kind: "launch-site",
    place: { ...s.place, body: "earth", approximate: true, basis: "One Wikidata (CC0) coordinate for the whole site; a spaceport covers many square kilometres", coords_source_id: s.wd,
      coords_text: `${s.place.lat}, ${s.place.lng}` } }));
  const moon = LUNAR_SITES.map((s) => {
    const robot = s.kind === "robotic-landing";
    const measures = [{ label: "Launch date", value: longDate(s.launched), source: s.src }, { label: "Landing date", value: longDate(s.landed) + (s.landed_time ? ` at ${s.landed_time}` : ""), source: s.src },
      { label: "Latitude and longitude on the Moon", value: `${s.lat_text}, ${s.lng_text}`, source: s.src }, { label: "Landing region", value: s.region, source: s.src }];
    if (!robot) measures.push({ label: "Moonwalk (EVA) time, hours", value: s.eva_h, source: s.src }, { label: "Traverse, km", value: s.traverse_km, source: s.src }, { label: "Samples returned, kg", value: s.sample_kg, source: s.src });
    if (s.sample) measures.push({ label: "Mission type", value: "Lunar sample return (as listed)", source: s.src });
    const everyday = `${s.mission} landed on the Moon on ${longDate(s.landed)} in ${s.region}. NASA lists the site at ${s.lat_text}, ${s.lng_text} on the Moon.`;
    const student = robot
      ? `NSSDCA's Luna table lists ${s.mission} as launched on ${longDate(s.launched)} and landed on ${longDate(s.landed)} at ${s.landed_time}, in ${s.region}, at ${s.lat_text}, ${s.lng_text}.${s.sample ? " The table lists it as a lunar sample return." : ""} The launch site is not on that page [UNKNOWN].`
      : `NSSDCA's Apollo table lists a launch on ${longDate(s.launched)}, ${s.eva_h} hours of moonwalk time, ${s.traverse_km.startsWith("[") ? "a traverse length [UNKNOWN]" : `a ${s.traverse_km} km traverse`} and ${s.sample_kg} kg of samples. Coordinates use the DE421 Mean Earth/Polar Axis frame.`;
    const unknowns = robot ? [`${s.mission} launch site: not on the NSSDCA page, so [UNKNOWN]`, "IAU Gazetteer name for this landing point: not looked up [UNKNOWN]"]
      : ["IAU Gazetteer name for this landing point: not looked up [UNKNOWN] (only the Apollo 11 name was checked)"];
    if (!robot && s.traverse_km.startsWith("[")) unknowns.push(`Traverse length: the NSSDCA table prints it with the digits after the decimal point missing ${s.traverse_km.slice(s.traverse_km.indexOf("("))}`);
    return { ...s, body: "moon", country: null, region_label: s.region, everyday, student, measures, unknowns, confidence: "high", aliases: s.aliases,
      dates: [{ date: s.landed, precision: "day", label: `${s.mission} landed (NSSDCA)` }],
      facts: [{ text: robot ? `NSSDCA's Luna table lists ${s.mission}: launched ${longDate(s.launched)}, landed ${longDate(s.landed)} at ${s.landed_time}, ${s.lat_text}, ${s.lng_text}, ${s.region}.` : `NSSDCA's Apollo table lists ${s.mission}: launched ${longDate(s.launched)}, landed ${longDate(s.landed)} at ${s.region} (${s.lat_text}, ${s.lng_text}).`, source: s.src }],
      claims: [], related: [], see_also: [],
      place: { label: `${s.region}, the Moon`, body: "moon", lat: s.lat, lng: s.lng, approximate: false, basis: robot ? "Coordinates as printed in NSSDCA's Luna table; the table gives no reference frame" : FRAME, coords_source_id: s.src, coords_text: `${s.lat_text}, ${s.lng_text}` } };
  });
  return [...earth, ...moon];
}

export function sourcesOf(s) {
  return uniq([s.place.coords_source_id, ...s.measures.map((m) => m.source), ...s.facts.map((f) => f.source), ...s.claims.flatMap((c) => c.sources)]);
}
export function spaceRecord(s) {
  const sources = sourcesOf(s);
  const official = sources.filter((id) => OFFICIAL.has(id));
  return {
    schema: "globedesk.space-site/1", id: s.id, title: s.title, body: s.body, kind: s.kind, region: s.body === "moon" ? "Moon" : s.region, country: s.country || "[UNKNOWN]",
    place: s.place, dates: s.dates, measures: s.measures, facts: s.facts, claims: s.claims, tiers: { everyday: s.everyday, student: s.student },
    sources, official_sources: official, official_status: official.length ? "listed" : "[UNKNOWN]", unknowns: s.unknowns, see_also_ids: s.see_also || [],
    confidence: s.confidence, checked: CHECKED, license: LICENSE_REC, subject_person_living: false,
  };
}
export function spaceEntry(s, rec) {
  const related = [{ type: "part-of", to: OVERVIEW.id }, ...(s.related || []).map(([type, to]) => ({ type, to }))];
  if (s.body === "moon" && /^apollo-/.test(s.id)) related.push({ type: "see-also", to: "apollo-11-1969" });
  return {
    id: s.id, title: s.title, ...(s.aliases && s.aliases.length ? { aliases: s.aliases } : {}), kind: s.body === "moon" ? "event" : "place", category_path: PATH,
    see_also_paths: [["history-places", "events-eras"]], tier: "everyday", tiers: rec.tiers, layer: "space", summary: s.everyday,
    places: s.body === "moon" ? [] : [{ region: s.usRegion || s.country, lat: s.place.lat, lng: s.place.lng, precision: "site", note: clip(`${s.place.label} (approximate pin: ${s.place.basis})`, 300) }],
    dates: s.dates.map((d) => ({ date: d.date, precision: d.precision, approximate: false, label: clip(d.label, 200) })),
    sources: rec.sources, related, record: `data/atlas/space/${s.id}.json`, pack: "science-history", status: "draft", confidence: s.confidence, license: "CC BY 4.0", checked: CHECKED,
    current: false, subject_person_living: false,
    notes: clip(`Space layer (${s.body === "moon" ? "Moon site, no Earth pin" : "Earth launch site"}). ${rec.unknowns.length ? "Gaps: " + rec.unknowns.join("; ") + "." : ""}`.trim(), 2000),
  };
}

export function buildAll() {
  const sites = normalise();
  const records = sites.map(spaceRecord);
  const entries = sites.map((s, i) => spaceEntry(s, records[i]));
  const members = [...sites.map((s) => ({ id: s.id, body: s.body, linked: false, pinned: s.body === "earth" })), ...LINKED.map((l) => ({ id: l.id, body: l.body, linked: true, pinned: false }))];
  const counts = members.reduce((m, x) => ((m[x.body] = (m[x.body] || 0) + 1), m), {});
  const ovSources = uniq([...LINKED.flatMap((l) => l.facts.map((f) => f.source)), ...OVERVIEW.stories.flatMap((s) => s.steps.flatMap((x) => x.sources))]);
  const overviewRec = { schema: "globedesk.space-overview/1", id: OVERVIEW.id, title: OVERVIEW.title, checked: CHECKED, license: LICENSE_REC, tiers: { everyday: OVERVIEW.everyday, student: OVERVIEW.student },
    bodies: [{ id: "earth", label: "Launch sites on Earth (pins)" }, { id: "moon", label: "Landing sites on the Moon (lunar coordinates, no pin)" }],
    members, counts, linked: LINKED, stories: OVERVIEW.stories, sources: ovSources,
    excluded: [{ name: "Roscosmos and CNES pages", reason: "Not opened on 2026-11-26 (HTTP 500 / not fetched), so not used [UNKNOWN]" }, { name: "Named Apollo crews", reason: "Not used; only dates, places and coordinates from NASA pages" }] };
  const overviewEntry = { id: OVERVIEW.id, title: OVERVIEW.title, aliases: OVERVIEW.aliases, kind: "topic", category_path: PATH, see_also_paths: [["history-places", "events-eras"]], tier: "everyday",
    tiers: overviewRec.tiers, layer: "space", summary: OVERVIEW.everyday, places: [], dates: [], sources: ovSources, related: members.map((m) => ({ type: "see-also", to: m.id })),
    record: "data/atlas/space/space-overview.json", pack: "science-history", status: "draft", confidence: "medium", license: "CC BY 4.0", checked: CHECKED, current: false, subject_person_living: false };
  return { records, entries: [overviewEntry, ...entries], overviewRec };
}

function writeJson(rel, obj) { const abs = path.join(ROOT, rel); mkdirSync(path.dirname(abs), { recursive: true }); writeFileSync(abs, JSON.stringify(obj, null, 2) + "\n"); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = buildAll();
  out.records.forEach((r) => writeJson(`data/atlas/space/${r.id}.json`, r));
  writeJson("data/atlas/space/space-overview.json", out.overviewRec);
  const srcPath = path.join(ATLAS, "packs/core/sources.json");
  const doc = JSON.parse(readFileSync(srcPath, "utf8"));
  SPACE_SOURCES.forEach((s) => { const i = doc.sources.findIndex((x) => x.id === s.id); if (i >= 0) doc.sources[i] = s; else doc.sources.push(s); });
  writeFileSync(srcPath, JSON.stringify(doc, null, 2) + "\n");
  const packPath = path.join(ATLAS, "packs/science-history/entries.json");
  const pack = JSON.parse(readFileSync(packPath, "utf8"));
  out.entries.forEach((e) => { const i = pack.entries.findIndex((x) => x.id === e.id); if (i >= 0) pack.entries[i] = e; else pack.entries.push(e); });
  writeFileSync(packPath, JSON.stringify(pack, null, 2) + "\n");
  console.log(`built ${out.records.length} space records (${out.records.filter((r) => r.body === "earth").length} Earth, ${out.records.filter((r) => r.body === "moon").length} Moon), ${out.entries.length} science-history entries (incl. overview), ${out.overviewRec.stories.length} stories, ${SPACE_SOURCES.length} sources`);
}
