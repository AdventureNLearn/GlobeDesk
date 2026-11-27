// Builds the Wonders layer (New Seven Wonders, 2007 unofficial popular vote) from wonders-sources.mjs and wonders-content.mjs:
//   data/atlas/wonders/<id>.json (schema globedesk.wonder/1: six winners; Petra is a deferred cross-link),
//   data/atlas/wonders/wonders-overview.json (globedesk.wonders-overview/1: the vote, members, claims, 2 stories),
//   entries replaced or appended by id in atlas/packs/wonders/entries.json (the Wonders extra pack under history-places, subcategory wonders),
//   and the sources merged by id into atlas/packs/core/sources.json.
// Local only, no network, idempotent. Run after build-space.mjs and before build-packs.mjs.
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { ROOT, ATLAS } from "./lib.mjs";
import { WONDERS_SOURCES } from "./wonders-sources.mjs";
import { WONDERS, OVERVIEW, VOTE_DATE, UNOFFICIAL } from "./wonders-content.mjs";

export const CHECKED = "2026-11-27";
const LICENSE_REC = "CC BY 4.0 (our record text); UNESCO and the organisation's pages keep their own terms and are linked only; NASA content is generally not subject to copyright";
const PATH = ["history-places", "wonders"];
const OFFICIAL = new Set(WONDERS_SOURCES.filter((s) => s.class === "official").map((s) => s.id));
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1) + "…");
const uniq = (a) => [...new Set(a)];
const N7 = "new7wonders-faq";

export function wonderRecord(w) {
  const pinned = w.place.lat != null;
  const dates = [{ date: VOTE_DATE, precision: "day", label: "Named in the unofficial 2007 popular vote (declaration event date)" }, { date: w.inscribed, precision: "year", label: "Inscribed on UNESCO's World Heritage List (the property named in the sources)" }];
  const place = pinned
    ? { label: w.place.label, pinned: true, lat: w.place.lat, lng: w.place.lng, approximate: true, basis: "One Wikidata (CC0) coordinate for the whole site; a monument or city site covers more than one point", coords_source_id: w.wd, coords_text: `${w.place.lat}, ${w.place.lng}` }
    : { label: w.place.label, pinned: false, approximate: true, basis: "No pin: a line across several provinces cannot be shown honestly as one point", coords_source_id: null, coords_text: "[UNKNOWN]" };
  const sources = uniq([...(pinned ? [w.wd] : []), ...w.measures.map((m) => m.source), ...w.facts.map((f) => f.source), ...w.claims.flatMap((c) => [...c.sources, ...(c.positions || []).map((x) => x.source)])]);
  const official = sources.filter((id) => OFFICIAL.has(id));
  return { schema: "globedesk.wonder/1", id: w.id, title: w.title, vote_label: UNOFFICIAL, region: w.region, country: w.country, place, dates, measures: w.measures, facts: w.facts, claims: w.claims,
    tiers: { everyday: w.everyday, student: w.student }, sources, official_sources: official, official_status: official.length ? "listed" : "[UNKNOWN]", unknowns: w.unknowns,
    see_also_ids: [], confidence: "high", checked: CHECKED, license: LICENSE_REC, subject_person_living: false };
}
export function wonderEntry(w, rec) {
  const pinned = w.place.lat != null;
  return { id: w.id, title: w.title, aliases: w.aliases, kind: "place", category_path: PATH, see_also_paths: [["history-places", "archaeology-sites"]], tier: "everyday", tiers: rec.tiers, layer: "wonders", summary: w.everyday,
    places: [pinned ? { region: w.country, lat: w.place.lat, lng: w.place.lng, precision: "site", note: clip(`${w.place.label} (approximate pin: ${rec.place.basis})`, 300) }
      : { region: w.country, precision: "country", note: clip(`${w.place.label}. No map pin: ${rec.place.basis}.`, 300) }],
    dates: rec.dates.map((d) => ({ date: d.date, precision: d.precision, approximate: false, label: clip(d.label, 200) })),
    sources: rec.sources, related: [{ type: "part-of", to: OVERVIEW.id }], record: `data/atlas/wonders/${w.id}.json`, pack: "wonders", status: "draft", confidence: "high", license: "CC BY 4.0", checked: CHECKED,
    current: false, subject_person_living: false,
    notes: clip(`Wonders layer (unofficial 2007 popular vote). ${rec.unknowns.length ? "Gaps: " + rec.unknowns.join("; ") + "." : ""}`.trim(), 2000) };
}

export function buildAll() {
  const records = WONDERS.map(wonderRecord);
  const entries = WONDERS.map((w, i) => wonderEntry(w, records[i]));
  const members = WONDERS.map((w) => ({ id: w.id, linked: false, pinned: w.place.lat != null }));
  const ovSources = uniq([N7, ...OVERVIEW.facts.map((f) => f.source), ...OVERVIEW.claims.flatMap((c) => c.sources), ...OVERVIEW.stories.flatMap((s) => s.steps.flatMap((x) => x.sources))]);
  const overviewRec = { schema: "globedesk.wonders-overview/1", id: OVERVIEW.id, title: OVERVIEW.title, vote_label: UNOFFICIAL, checked: CHECKED, license: LICENSE_REC, tiers: { everyday: OVERVIEW.everyday, student: OVERVIEW.student },
    vote_date: VOTE_DATE, vote: OVERVIEW.vote, members, counts: { winners: OVERVIEW.vote.length, cards: members.length, pinned: members.filter((m) => m.pinned).length, deferred: OVERVIEW.vote.filter((v) => v.deferred_link).length },
    facts: OVERVIEW.facts, claims: OVERVIEW.claims, stories: OVERVIEW.stories, sources: ovSources,
    unknowns: ["Great Pyramid of Giza (the vote's honorary candidate): not checked [UNKNOWN]", "Vote totals: only the organisation's own figure exists (not-proven)", "Petra: its card lives in the Ancient layer (ancient-petra); this copy shows '(not in this copy)' until that layer is added"],
    excluded: [{ name: "Logos, campaign text and branding of the organisation", reason: "Not used: all rights reserved and a commercial licensing arm; only the date and the list of seven are restated as facts" }, { name: "Natural-wonders and city lists from the same organisation", reason: "Not in this batch" }] };
  const overviewEntry = { id: OVERVIEW.id, title: OVERVIEW.title, aliases: OVERVIEW.aliases, kind: "topic", category_path: PATH, see_also_paths: [["history-places", "archaeology-sites"]], tier: "everyday",
    tiers: overviewRec.tiers, layer: "wonders", summary: OVERVIEW.everyday, places: [], dates: [{ date: VOTE_DATE, precision: "day", approximate: false, label: "Declaration event of the unofficial 2007 popular vote" }], sources: ovSources,
    related: members.map((m) => ({ type: "see-also", to: m.id })), record: "data/atlas/wonders/wonders-overview.json", pack: "wonders", status: "draft", confidence: "medium", license: "CC BY 4.0", checked: CHECKED, current: false, subject_person_living: false };
  return { records, entries: [overviewEntry, ...entries], overviewRec };
}

function writeJson(rel, obj) { const abs = path.join(ROOT, rel); mkdirSync(path.dirname(abs), { recursive: true }); writeFileSync(abs, JSON.stringify(obj, null, 2) + "\n"); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = buildAll();
  out.records.forEach((r) => writeJson(`data/atlas/wonders/${r.id}.json`, r));
  writeJson("data/atlas/wonders/wonders-overview.json", out.overviewRec);
  const srcPath = path.join(ATLAS, "packs/core/sources.json");
  const doc = JSON.parse(readFileSync(srcPath, "utf8"));
  WONDERS_SOURCES.forEach((s) => { const i = doc.sources.findIndex((x) => x.id === s.id); if (i >= 0) doc.sources[i] = s; else doc.sources.push(s); });
  writeFileSync(srcPath, JSON.stringify(doc, null, 2) + "\n");
  const packPath = path.join(ATLAS, "packs/wonders/entries.json");
  mkdirSync(path.dirname(packPath), { recursive: true });
  const pack = existsSync(packPath) ? JSON.parse(readFileSync(packPath, "utf8")) : { schema: "globedesk.atlas-entries/1", pack: "wonders", entries: [] };
  out.entries.forEach((e) => { const i = pack.entries.findIndex((x) => x.id === e.id); if (i >= 0) pack.entries[i] = e; else pack.entries.push(e); });
  writeFileSync(packPath, JSON.stringify(pack, null, 2) + "\n");
  console.log(`built ${out.records.length} wonder records (${out.records.filter((r) => r.place.pinned).length} pinned), ${out.entries.length} wonders-pack entries (incl. overview), ${out.overviewRec.stories.length} stories, ${WONDERS_SOURCES.length} sources`);
}
