// Chemistry index (C3): element discovery sites and namesake places from Wikidata (CC0).
// Local only, no network. Reads source-cache/wikidata-sites/wikidata-element-sites.json and writes
// data/atlas/chemistry/element-sites.json. Only places with their own Wikidata coordinate (P625, Earth)
// are pinned. People are never pinned: a discoverer credit becomes a pin only when the discoverer is a
// laboratory or institution. Each pin has a scale: "site" (a lab, institution, mine or building),
// "city" (a town or city's reference point) or "area" (a country or region's reference point), so a
// pin is never read as more exact than it is.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CHECKED = "2026-11-26";
const OUT_REL = "data/atlas/chemistry/element-sites.json";
const EARTH = "http://www.wikidata.org/entity/Q2";
const REL_LABEL = { namesake: "Named after this place", "discovery-location": "Discovery location", discoverer: "Discovering laboratory or institution" };

function cacheDir() {
  if (process.env.GLOBEDESK_ELEMENTS_CACHE) return path.resolve(process.env.GLOBEDESK_ELEMENTS_CACHE);
  return path.resolve(ROOT, ".cache/sources");
}
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const save = (p, obj) => writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");

const SITE_RE = /research institute|laborator|university|college|academic|educational|scientific|institute|mine\b|building|city|town|village|settlement|commune|comune|municipality|parish|locality|capital|agency|society|museum|residenz|district|township|city district|organization/i;
const EXACT_RE = /research institute|laborator|university(?! (city|town))|college(?! town)|academic|institute|mine\b|building|society|museum|archaeological site/i;
const AREA_RE = /sovereign state|\bcountry\b|empire|continent|part of the world|\bstate\b|region|oblast|prefecture|island|river|superpower|republic/i;
const NOT_A_PLACE_RE = /mythological|fictional|deity|character/i;
const ORG_RE = /research institute|laborator|university|college|academic|institute|organization|agency|society/i;

export function classify(target) {
  const kinds = (target.instanceOf || []).map((i) => i.label || "").filter(Boolean);
  if ((target.instanceOf || []).some((i) => i.id === "Q5")) return { drop: "a person (people are never pinned)" };
  if (kinds.some((k) => NOT_A_PLACE_RE.test(k))) return { drop: "not a real-world place" };
  const c = (target.coords || [])[0];
  if (!c) return { drop: "no Wikidata coordinate" };
  if (c.globe && c.globe !== EARTH) return { drop: "coordinate is not on Earth" };
  if (!target.label) return { drop: "no English label on Wikidata" };
  const area = kinds.some((k) => AREA_RE.test(k)) && !kinds.some((k) => /city|town|laborator|institute|university/i.test(k));
  const exact = kinds.some((k) => EXACT_RE.test(k));
  const scale = exact ? "site" : (!area && kinds.some((k) => SITE_RE.test(k)) ? "city" : "area");
  return { scale, lat: c.lat, lng: c.lon, kinds, org: kinds.some((k) => ORG_RE.test(k)) };
}

const dir = cacheDir();
const cachePath = path.join(dir, "wikidata-sites/wikidata-element-sites.json");
if (!existsSync(cachePath)) throw new Error("Missing " + cachePath);
const cache = readJson(cachePath);
const iupac = readJson(path.join(dir, "iupac/iupac-names-groups-2022.json")).elements;
const symByZ = new Map(iupac.map((e) => [e.z, e]));

const places = new Map();
const dropped = new Map();
for (const l of cache.links) {
  const t = cache.targets[l.target];
  if (!t) continue;
  const c = classify(t);
  // A discoverer credit becomes a pin only for an institution, never for a person.
  if (!c.drop && l.rel === "discoverer" && !c.org) c.drop = "discoverer is not a laboratory or institution";
  if (c.drop) {
    if (!dropped.has(l.target)) dropped.set(l.target, { qid: l.target, label: t.label || "[UNKNOWN]", reason: c.drop, zs: [] });
    dropped.get(l.target).zs.push(l.z);
    continue;
  }
  const iu = symByZ.get(l.z);
  if (!places.has(l.target)) {
    places.set(l.target, {
      id: "wd-" + l.target, qid: l.target, label: t.label || "[UNKNOWN]", lat: Number(c.lat.toFixed(5)), lng: Number(c.lng.toFixed(5)),
      scale: c.scale, kinds: c.kinds.slice(0, 4), country: (t.country || []).map((x) => x.label).filter(Boolean).slice(0, 2),
      coordinate: "Wikidata P625 of " + l.target, url: "https://www.wikidata.org/wiki/" + l.target, links: [],
    });
  }
  const p = places.get(l.target);
  const rel = { z: l.z, id: iu.name + "-element", symbol: iu.symbol, rel: l.rel, label: REL_LABEL[l.rel] };
  if (!p.links.some((x) => x.z === rel.z && x.rel === rel.rel)) p.links.push(rel);
}
const list = Array.from(places.values()).sort((a, b) => Math.min(...a.links.map((x) => x.z)) - Math.min(...b.links.map((x) => x.z)) || a.label.localeCompare(b.label));
list.forEach((p) => p.links.sort((a, b) => a.z - b.z));

const doc = {
  schema: "globedesk.chem/0-draft",
  id: "element-sites",
  title: "Element discovery sites and namesake places (Wikidata)",
  status: "draft",
  checked: CHECKED,
  licence: "Wikidata structured data, CC0 1.0",
  fetched: cache.fetched,
  note: "Each pin is the place's own Wikidata coordinate (P625). Scale: 'site' is a lab, institution, mine or building; 'city' is a town or city's reference point; 'area' is a country or region's reference point, not a site. People are never pinned; a discoverer credit becomes a pin only for a laboratory or institution.",
  relations: REL_LABEL,
  places: list,
  excluded: Array.from(dropped.values()).sort((a, b) => a.zs[0] - b.zs[0]).map((d) => ({ qid: d.qid, label: d.reason.startsWith("a person") ? "[person not named]" : d.label, reason: d.reason, zs: Array.from(new Set(d.zs)) })),
};
save(path.join(ROOT, OUT_REL), doc);

const sourcesPath = path.join(ROOT, "atlas/packs/core/sources.json");
const sourcesDoc = readJson(sourcesPath);
const src = {
  id: "wikidata-element-sites",
  title: "Wikidata structured data: element namesakes (P138), discovery locations (P189), discovering institutions (P61) and place coordinates (P625)",
  url: "https://www.wikidata.org/wiki/Wikidata:Copyright",
  checked: CHECKED,
  class: "official",
  publisher: "Wikidata",
  license: "Structured data in the main, Property, Lexeme and EntitySchema namespaces is CC0 (Wikidata:Copyright). Text in other namespaces is CC BY-SA and is not used here.",
  description: "Place labels and coordinates only: places, no people. No biographical details.",
};
const i = sourcesDoc.sources.findIndex((s) => s.id === src.id);
if (i >= 0) Object.assign(sourcesDoc.sources[i], src); else sourcesDoc.sources.push(src);
save(sourcesPath, sourcesDoc);
const count = (k) => list.filter((p) => p.scale === k).length;
console.log("element-sites: " + list.length + " places (" + count("site") + " site, " + count("city") + " city, " + count("area") + " area), " + doc.excluded.length + " excluded targets");
