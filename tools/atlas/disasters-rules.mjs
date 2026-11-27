// Validator rules for the disasters layer (records globedesk.disaster/1 and globedesk.disaster-overview/1).
// Kept in its own module so validate.mjs only gains one import and one call.
import { validateSchema } from "../../tests/jsonschema-lite.mjs";
import { JR, exists } from "./lib.mjs";

const asList = (r) => (Array.isArray(r) ? r : (r && r.errors) || []);
const yearOf = (d) => parseInt(String(d), 10);
const BLOCKED_URL = /volcano\.si\.edu|smithsonian/i; // GVP: terms [UNKNOWN], never cited
// GVP link or name in any text of a record or entry. A link is never allowed. A name is allowed only inside the
// exact notice sentence below (in /unknowns or an entry's /notes), or as the exact name in the overview's
// "excluded" list. Any other text that names GVP fails, even if it also says "not used" or [UNKNOWN].
const GVP_URL = /volcano\.si\.edu/i;
const GVP_NAME = /\bGVP\b|Global Volcanism|Smithsonian/i;
const GVP_NOTICE_PATHS = /^\/(unknowns\/\d+|notes)$/;
export const GVP_NOTICE = "(Smithsonian GVP not used; its terms are [UNKNOWN])";
export const GVP_EXCLUDED_NAME = "Smithsonian Global Volcanism Program";
function* strings(o, at = "") {
  if (typeof o === "string") yield [at, o];
  else if (Array.isArray(o)) for (let i = 0; i < o.length; i++) yield* strings(o[i], `${at}/${i}`);
  else if (o && typeof o === "object") for (const k of Object.keys(o)) yield* strings(o[k], `${at}/${k}`);
}
export function gvpProblems(obj, label) {
  const p = [];
  for (const [at, s] of strings(obj)) {
    if (GVP_URL.test(s)) p.push(`${label}: ${at} links Smithsonian GVP (volcano.si.edu), whose terms are [UNKNOWN]`);
    else if (GVP_NAME.test(s)) {
      const okName = /^\/excluded\/\d+\/name$/.test(at) && s === GVP_EXCLUDED_NAME;
      const okNotice = GVP_NOTICE_PATHS.test(at) && !GVP_NAME.test(s.split(GVP_NOTICE).join(""));
      if (!okName && !okNotice) p.push(`${label}: ${at} names Smithsonian GVP outside the exact notice sentence`);
    }
  }
  return p;
}

export function disasterRules(entry, rec, ctx) {
  const p = [];
  const at = `disaster ${entry.id}`;
  asList(validateSchema(ctx.disasterSchema, rec)).forEach((x) => p.push(`${at}: ${x}`));
  if (rec.id !== entry.id) p.push(`${at}: record id ${rec.id} does not match the entry`);
  const cited = [rec.date.source, ...rec.measures.map((m) => m.source), ...rec.facts.map((f) => f.source),
    ...rec.claims.flatMap((c) => [...c.sources, ...(c.positions || []).map((x) => x.source)])];
  cited.forEach((id) => { if (!rec.sources.includes(id)) p.push(`${at}: cited source ${id} is not listed in the record's sources`); });
  rec.sources.forEach((id) => {
    const s = ctx.sourceById.get(id);
    if (!s) p.push(`${at}: source ${id} not in core/sources.json`);
    else if (BLOCKED_URL.test(s.url || "")) p.push(`${at}: source ${id} is Smithsonian GVP, whose terms are [UNKNOWN]`);
  });
  p.push(...gvpProblems(rec, at), ...gvpProblems(entry, `${at} entry`));
  const official = rec.sources.filter((id) => (ctx.sourceById.get(id) || {}).class === "official");
  if (JSON.stringify(official) !== JSON.stringify(rec.official_sources)) p.push(`${at}: official_sources must list exactly the official-class sources`);
  if (rec.official_status !== (official.length ? "listed" : "[UNKNOWN]")) p.push(`${at}: official_status does not match the official sources`);
  if (!official.includes(rec.ncei.dataset)) p.push(`${at}: the NCEI dataset ${rec.ncei.dataset} must be cited as an official source`);
  if (rec.hazard === "earthquake" && rec.ncei.dataset !== "ncei-sig-earthquakes") p.push(`${at}: an earthquake must cite the NCEI earthquake database`);
  if (rec.hazard === "eruption" && rec.ncei.dataset !== "ncei-sig-volcanoes") p.push(`${at}: an eruption must cite the NCEI volcano database`);
  rec.claims.filter((c) => c.status === "people-disagree").forEach((c) => {
    const ps = c.positions || [];
    if (ps.length < 2 || new Set(ps.map((x) => x.source)).size < 2) p.push(`${at}: a people-disagree claim needs two positions from different sources`);
  });
  if (Math.abs(rec.place.lat) > 90 || Math.abs(rec.place.lng) > 180) p.push(`${at}: pin out of range`);
  const pl = entry.places[0];
  if (!pl || pl.lat !== rec.place.lat || pl.lng !== rec.place.lng || pl.region !== rec.country) p.push(`${at}: entry place does not match the record pin`);
  if (!/approximate/i.test(pl ? pl.note || "" : "")) p.push(`${at}: the NCEI pin is approximate and the entry place note must say so`);
  if (!entry.tiers || entry.tiers.everyday !== rec.tiers.everyday || entry.tiers.student !== rec.tiers.student) p.push(`${at}: entry tiers must match the record`);
  if (entry.kind !== "event" || entry.pack !== "earth" || entry.category_path.join("/") !== "earth/natural-hazards") p.push(`${at}: must be an event in earth/natural-hazards`);
  if (!entry.related.some((r) => r.type === "part-of" && r.to === "disasters-overview")) p.push(`${at}: must link part-of disasters-overview`);
  if (!entry.dates.length || entry.dates[0].date !== rec.date.date) p.push(`${at}: entry date must match the record date`);
  // Never duplicate an existing Atlas event: no other entry with a pin within 1° in the same year.
  (ctx.others || []).forEach((o) => {
    const near = (o.places || []).some((q) => q.lat != null && Math.abs(q.lat - rec.place.lat) <= 1 && Math.abs(q.lng - rec.place.lng) <= 1);
    if (near && (o.dates || []).some((d) => yearOf(d.date) === yearOf(rec.date.date))) p.push(`${at}: duplicates existing entry ${o.id}; cross-link it from the overview instead`);
  });
  return p;
}

export function disasterOverviewRules(entry, rec, ctx) {
  const p = [];
  const at = `disaster overview ${entry.id}`;
  asList(validateSchema(ctx.overviewSchema, rec)).forEach((x) => p.push(`${at}: ${x}`));
  if (rec.id !== entry.id) p.push(`${at}: record id ${rec.id} does not match its entry`);
  p.push(...gvpProblems(rec, at), ...gvpProblems(entry, `${at} entry`));
  const byId = ctx.entryById;
  rec.members.forEach((m) => {
    const e = byId.get(m.id);
    if (!e) { p.push(`${at}: member ${m.id} is not an Atlas entry`); return; }
    if (m.linked && e.layer === "disasters") p.push(`${at}: linked member ${m.id} must be an existing event outside the layer`);
    if (!m.linked && e.layer !== "disasters") p.push(`${at}: member ${m.id} is not a disasters-layer entry`);
    if (!e.places.some((q) => q.lat != null && q.lng != null)) p.push(`${at}: member ${m.id} has no pin`);
  });
  (ctx.layerIds || []).forEach((id) => { if (!rec.members.some((m) => m.id === id)) p.push(`${at}: disasters entry ${id} is missing from members`); });
  rec.linked.forEach((l) => { if (!rec.members.some((m) => m.id === l.id && m.linked)) p.push(`${at}: linked ${l.id} is not a linked member`); });
  const want = rec.members.reduce((m, x) => ((m[x.hazard] = (m[x.hazard] || 0) + 1), m), {});
  if (JSON.stringify(want) !== JSON.stringify(rec.counts)) p.push(`${at}: counts do not match the members`);
  const allCited = [...rec.linked.flatMap((l) => l.facts.map((f) => f.source)), ...rec.stories.flatMap((s) => s.steps.flatMap((x) => x.sources))];
  allCited.forEach((id) => {
    if (!ctx.sourceById.has(id)) p.push(`${at}: cites ${id}, not in core/sources.json`);
    if (!rec.sources.includes(id)) p.push(`${at}: cites ${id}, not listed in its sources`);
  });
  rec.stories.forEach((s) => s.steps.forEach((x, i) => { if (!byId.has(x.entry)) p.push(`${at}: story ${s.id} step ${i + 1} opens ${x.entry}, not an Atlas entry`); }));
  return p;
}

// All disasters checks for validate.mjs.
export function validateDisasters(entries, ctx) {
  const problems = [];
  const disasterSchema = JR("schema/globedesk-disaster.schema.json");
  const overviewSchema = JR("schema/globedesk-disaster-overview.schema.json");
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const layer = entries.filter((e) => e.layer === "disasters");
  const events = layer.filter((e) => e.kind === "event");
  const others = entries.filter((e) => e.layer !== "disasters");
  events.forEach((e) => {
    if (!e.record || !exists(e.record)) { problems.push(`disaster ${e.id}: record missing`); return; }
    problems.push(...disasterRules(e, JR(e.record), { ...ctx, disasterSchema, others }));
  });
  layer.filter((e) => e.record && exists(e.record) && JR(e.record).schema === "globedesk.disaster-overview/1")
    .forEach((e) => problems.push(...disasterOverviewRules(e, JR(e.record), { ...ctx, overviewSchema, entryById, layerIds: events.map((x) => x.id) })));
  (ctx.sourceById ? [...ctx.sourceById.values()] : []).filter((s) => GVP_URL.test(s.url || "")).forEach((s) => problems.push(`source ${s.id}: Smithsonian GVP (volcano.si.edu) is never registered; its terms are [UNKNOWN]`));
  if (events.length && !layer.some((e) => e.id === "disasters-overview")) problems.push("disasters: overview entry missing");
  return problems;
}
