// Validator rules for the space layer (records globedesk.space-site/1 and globedesk.space-overview/1).
// Kept in its own module so validate.mjs only gains one import and one call.
import { validateSchema } from "../../tests/jsonschema-lite.mjs";
import { JR, exists } from "./lib.mjs";
import { SC_CLASS } from "./space-class.mjs";

const asList = (r) => (Array.isArray(r) ? r : (r && r.errors) || []);
// Named crews are not used: only dates, places and coordinates that NASA or the agency publishes.
const CREW = /\b(Armstrong|Aldrin|Collins|Conrad|Bean|Gordon|Lovell|Shepard|Mitchell|Roosa|Scott|Worden|Irwin|Young|Duke|Mattingly|Cernan|Schmitt|Evans|Tereshkova|Leonov|Titov)\b/;

function* strings(o, at = "") {
  if (typeof o === "string") yield [at, o];
  else if (Array.isArray(o)) for (let i = 0; i < o.length; i++) yield* strings(o[i], `${at}/${i}`);
  else if (o && typeof o === "object") for (const k of Object.keys(o)) yield* strings(o[k], `${at}/${k}`);
}
export function privacyProblems(obj, label) {
  const p = [];
  for (const [at, s] of strings(obj)) {
    if (CREW.test(s) && !/^\/excluded\//.test(at)) p.push(`${label}: ${at} names a crew member (${s.match(CREW)[0]}); use only dates, places and coordinates`);
  }
  return p;
}

export function spaceRules(entry, rec, ctx) {
  const p = [];
  const at = `space ${entry.id}`;
  asList(validateSchema(ctx.siteSchema, rec)).forEach((x) => p.push(`${at}: ${x}`));
  if (rec.id !== entry.id) p.push(`${at}: record id ${rec.id} does not match the entry`);
  if (/^apollo-11/.test(entry.id)) p.push(`${at}: Apollo 11 already exists as apollo-11-1969; cross-link it instead of adding it`);
  const cited = [...rec.measures.map((m) => m.source), ...rec.facts.map((f) => f.source), rec.place.coords_source_id, ...rec.claims.flatMap((c) => [...c.sources, ...(c.positions || []).map((x) => x.source)])];
  cited.forEach((id) => { if (!rec.sources.includes(id)) p.push(`${at}: cited source ${id} is not listed in the record's sources`); });
  rec.sources.forEach((id) => {
    const s = ctx.sourceById.get(id);
    if (!s) p.push(`${at}: source ${id} not in core/sources.json`);
    else if (SC_CLASS(s) === "experimental") p.push(`${at}: source ${id} is experimental and cannot back a fact`);
  });
  const official = rec.sources.filter((id) => (ctx.sourceById.get(id) || {}).class === "official");
  if (JSON.stringify(official) !== JSON.stringify(rec.official_sources)) p.push(`${at}: official_sources must list exactly the official-class sources`);
  if (!official.length) p.push(`${at}: needs at least one official source`);
  if (rec.official_status !== (official.length ? "listed" : "[UNKNOWN]")) p.push(`${at}: official_status does not match the official sources`);
  const cs = ctx.sourceById.get(rec.place.coords_source_id) || {};
  if (rec.body === "earth") {
    if (rec.place.body !== "earth" || rec.kind !== "launch-site") p.push(`${at}: an Earth site must be a launch-site on earth`);
    if (!/wikidata\.org/.test(cs.url || "") || !/CC0/.test(cs.license || "")) p.push(`${at}: Earth pin coordinates must come from a CC0 Wikidata item`);
    if (rec.place.approximate !== true) p.push(`${at}: an Earth pin is approximate`);
    if (Math.abs(rec.place.lat) > 90 || Math.abs(rec.place.lng) > 180) p.push(`${at}: pin out of range`);
    const pl = entry.places[0];
    if (entry.places.length !== 1 || pl.lat !== rec.place.lat || pl.lng !== rec.place.lng) p.push(`${at}: entry place does not match the record pin`);
    if (!/approximate/i.test(pl ? pl.note || "" : "")) p.push(`${at}: the pin is approximate and the entry place note must say so`);
    if (entry.kind !== "place") p.push(`${at}: an Earth site entry is kind place`);
  } else {
    if (rec.place.body !== "moon" || rec.region !== "Moon" || rec.kind === "launch-site") p.push(`${at}: a Moon site must be a landing on the Moon`);
    if (cs.class !== "official" || !/nssdc|planetarynames/.test(cs.url || "")) p.push(`${at}: lunar coordinates must come from NSSDCA or the IAU Gazetteer`);
    if (Math.abs(rec.place.lat) > 90 || rec.place.lng < -180 || rec.place.lng > 360) p.push(`${at}: lunar coordinates out of range`);
    if (entry.places.length) p.push(`${at}: a Moon site has no Earth pin; entry places must be empty`);
    if (entry.kind !== "event") p.push(`${at}: a Moon landing entry is kind event`);
  }
  if (!entry.tiers || entry.tiers.everyday !== rec.tiers.everyday || entry.tiers.student !== rec.tiers.student) p.push(`${at}: entry tiers must match the record`);
  if (entry.pack !== "science-history" || entry.category_path.join("/") !== "science-history/space-race") p.push(`${at}: must be in science-history/space-race`);
  if (!entry.related.some((r) => r.type === "part-of" && r.to === "space-overview")) p.push(`${at}: must link part-of space-overview`);
  if (JSON.stringify(entry.dates.map((d) => d.date)) !== JSON.stringify(rec.dates.map((d) => d.date))) p.push(`${at}: entry dates must match the record dates`);
  p.push(...privacyProblems([rec, entry], at));
  (ctx.others || []).forEach((o) => {
    const near = rec.body === "earth" && (o.places || []).some((q) => q.lat != null && Math.abs(q.lat - rec.place.lat) <= 0.05 && Math.abs(q.lng - rec.place.lng) <= 0.05);
    if (near && o.id !== "apollo-11-1969") p.push(`${at}: duplicates the pin of existing entry ${o.id}`);
  });
  return p;
}

export function spaceOverviewRules(entry, rec, ctx) {
  const p = [];
  const at = `space overview ${entry.id}`;
  asList(validateSchema(ctx.overviewSchema, rec)).forEach((x) => p.push(`${at}: ${x}`));
  if (rec.id !== entry.id) p.push(`${at}: record id ${rec.id} does not match its entry`);
  p.push(...privacyProblems([rec, entry], at));
  const byId = ctx.entryById;
  rec.members.forEach((m) => {
    const e = byId.get(m.id);
    if (!e) { p.push(`${at}: member ${m.id} is not an Atlas entry`); return; }
    if (m.linked && e.layer === "space") p.push(`${at}: linked member ${m.id} must be an existing event outside the layer`);
    if (!m.linked && e.layer !== "space") p.push(`${at}: member ${m.id} is not a space-layer entry`);
    const hasPin = e.places.some((q) => q.lat != null && q.lng != null);
    if (m.pinned !== (!m.linked && m.body === "earth" && hasPin)) p.push(`${at}: member ${m.id} pinned flag is wrong (only the layer's own Earth sites are pinned)`);
  });
  if (!rec.members.some((m) => m.id === "apollo-11-1969" && m.linked)) p.push(`${at}: Apollo 11 must be cross-linked as apollo-11-1969`);
  (ctx.layerIds || []).forEach((id) => { if (!rec.members.some((m) => m.id === id)) p.push(`${at}: space entry ${id} is missing from members`); });
  rec.linked.forEach((l) => { if (!rec.members.some((m) => m.id === l.id && m.linked)) p.push(`${at}: linked ${l.id} is not a linked member`); });
  const want = rec.members.reduce((m, x) => ((m[x.body] = (m[x.body] || 0) + 1), m), {});
  if (JSON.stringify(want) !== JSON.stringify(rec.counts)) p.push(`${at}: counts do not match the members`);
  const allCited = [...rec.linked.flatMap((l) => l.facts.map((f) => f.source)), ...rec.stories.flatMap((s) => s.steps.flatMap((x) => x.sources))];
  allCited.forEach((id) => {
    if (!ctx.sourceById.has(id)) p.push(`${at}: cites ${id}, not in core/sources.json`);
    if (!rec.sources.includes(id)) p.push(`${at}: cites ${id}, not listed in its sources`);
  });
  rec.stories.forEach((s) => s.steps.forEach((x, i) => { if (!byId.has(x.entry)) p.push(`${at}: story ${s.id} step ${i + 1} opens ${x.entry}, not an Atlas entry`); }));
  return p;
}

export function validateSpace(entries, ctx) {
  const problems = [];
  const siteSchema = JR("schema/globedesk-space-site.schema.json");
  const overviewSchema = JR("schema/globedesk-space-overview.schema.json");
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const layer = entries.filter((e) => e.layer === "space");
  const sites = layer.filter((e) => e.kind !== "topic");
  const others = entries.filter((e) => e.layer !== "space");
  sites.forEach((e) => {
    if (!e.record || !exists(e.record)) { problems.push(`space ${e.id}: record missing`); return; }
    problems.push(...spaceRules(e, JR(e.record), { ...ctx, siteSchema, others }));
  });
  layer.filter((e) => e.kind === "topic" && e.record && exists(e.record))
    .forEach((e) => problems.push(...spaceOverviewRules(e, JR(e.record), { ...ctx, overviewSchema, entryById, layerIds: sites.map((x) => x.id) })));
  if (sites.length && !layer.some((e) => e.id === "space-overview")) problems.push("space: overview entry missing");
  return problems;
}
