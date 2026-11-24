// Builds the core pack (index, categories, places, years) and writes every manifest with hashes.
// Local only. Never deletes; overwrites only the generated files it owns.
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { ATLAS, J, MAX_BYTES, CATEGORY_PACKS, allEntries, fileInfo, packSha } from "./lib.mjs";

const VERSION = "0.1.0-draft";
const CHECKED = "2026-11-24";
const write = (rel, obj) => writeFileSync(path.join(ATLAS, rel), JSON.stringify(obj, null, 2) + "\n");
const cats = J("categories.json");
const entries = allEntries().sort((a, b) => a.title.localeCompare(b.title, "en"));

write("packs/core/categories.json", cats);
write("packs/core/index.json", {
  schema: "globedesk.atlas-index/1", generated: CHECKED,
  entries: entries.map((e) => ({ id: e.id, title: e.title, aliases: e.aliases || [], kind: e.kind, category_path: e.category_path, tier: e.tier, pack: e.pack, status: e.status, current: e.current, ...(e.now_until ? { now_until: e.now_until } : {}) })),
});
const places = {};
entries.forEach((e) => e.places.forEach((p) => { const k = p.region || `${p.lat},${p.lng}`; (places[k] ||= { key: k, precision: p.precision, entries: [] }).entries.push(e.id); }));
write("packs/core/places.json", { schema: "globedesk.atlas-places/1", generated: CHECKED, places: Object.values(places).sort((a, b) => a.key.localeCompare(b.key)), no_place: entries.filter((e) => !e.places.length).map((e) => e.id) });
const years = [];
entries.forEach((e) => e.dates.forEach((d) => years.push({ date: d.date, precision: d.precision, approximate: d.approximate, ...(d.end ? { end: d.end } : {}), entry: e.id })));
years.sort((a, b) => parseInt(a.date, 10) - parseInt(b.date, 10) || a.date.localeCompare(b.date));
write("packs/core/years.json", { schema: "globedesk.atlas-years/1", generated: CHECKED, dates: years, undated: entries.filter((e) => !e.dates.length).map((e) => e.id) });

function manifest(id, kind, title, files, entryCount, extra) {
  const listed = files.map((f) => ({ path: f, ...fileInfo(path.join(ATLAS, "packs", id, f)) }));
  const size = listed.reduce((s, f) => s + f.bytes, 0);
  write(`packs/${id}/manifest.json`, {
    schema: "globedesk.atlas-pack/1", id, title, kind, ...extra, version: VERSION, license: "CC BY 4.0",
    checked: CHECKED, sha256: packSha(listed), entry_count: entryCount, size_bytes: size, max_bytes: MAX_BYTES,
    refresh: extra.refresh, promote: "owner-yes-required", status: "draft", files: listed,
  });
}
manifest("core", "core", "Atlas core: index, category tree, places, years, sources", ["index.json", "categories.json", "places.json", "years.json", "sources.json"], entries.length, { refresh: "with-release" });
for (const p of CATEGORY_PACKS) {
  const c = cats.categories.find((x) => x.pack === p);
  manifest(p, "category", `Atlas pack: ${c.title}`, ["entries.json"], J(`packs/${p}/entries.json`).entries.length, { category: c.id, refresh: c.refresh });
}
console.log(`built core (${entries.length} entries) + ${CATEGORY_PACKS.length} category manifests`);
