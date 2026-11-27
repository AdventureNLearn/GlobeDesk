// Validator rules for the wonders layer (records globedesk.wonder/1 and globedesk.wonders-overview/1).
// Kept in its own module so validate.mjs only gains one import and one call.
import { validateSchema } from "../../tests/jsonschema-lite.mjs";
import { JR, exists } from "./lib.mjs";
import { SC_CLASS } from "./space-class.mjs";

const asList = (r) => (Array.isArray(r) ? r : (r && r.errors) || []);
// Owner picks: no logos or images; no living people.
const LOGO = /\.(png|svg|jpe?g|gif|webp)\b|<img|data:image/i; // text may say "no logos"; files, tags and keys are what is refused
const LOGO_KEY = /^(logo|logos|image|images|img|thumbnail|icon|banner)$/i;
function logoKeys(o, at = "") {
  const out = [];
  if (Array.isArray(o)) o.forEach((x, i) => out.push(...logoKeys(x, `${at}/${i}`)));
  else if (o && typeof o === "object") for (const k of Object.keys(o)) { if (LOGO_KEY.test(k)) out.push(`${at}/${k}`); out.push(...logoKeys(o[k], `${at}/${k}`)); }
  return out;
}
const LIVING = /\bBernard Weber\b|\bWeber\b/;
const OFFICIAL_LIST = /\b(official|UNESCO)\b/i;
const ANCIENT_IDS = /petra|giza/i; // these belong to the Ancient layer (ancient-petra, ancient-giza); never a second entry here

function* strings(o, at = "") {
  if (typeof o === "string") yield [at, o];
  else if (Array.isArray(o)) for (let i = 0; i < o.length; i++) yield* strings(o[i], `${at}/${i}`);
  else if (o && typeof o === "object") for (const k of Object.keys(o)) yield* strings(o[k], `${at}/${k}`);
}
export function wonderPrivacyProblems(obj, label) {
  const p = [];
  for (const [at, s] of strings(obj)) {
    if (LOGO.test(s)) p.push(`${label}: ${at} points at a logo or image; the layer uses no logos or images`);
    if (LIVING.test(s)) p.push(`${label}: ${at} names a living person (${s.match(LIVING)[0]})`);
  }
  logoKeys(obj).forEach((k) => p.push(`${label}: ${k} is a logo or image field; the layer uses no logos or images`));
  return p;
}
// A text that names UNESCO or "official" next to the vote must say unofficial or no link; a bare "official list" claim is refused.
export function unofficialProblems(text, label) {
  return /\bofficial (list|seven|wonders)\b/i.test(text) && !/unofficial|not an official|not official|no link|myth|not a UNESCO/i.test(text) ? [`${label}: calls the vote an official list without saying it is unofficial`] : [];
}

export function wonderRules(entry, rec, ctx) {
  const p = [];
  const at = `wonder ${entry.id}`;
  asList(validateSchema(ctx.siteSchema, rec)).forEach((x) => p.push(`${at}: ${x}`));
  if (rec.id !== entry.id) p.push(`${at}: record id ${rec.id} does not match the entry`);
  if (ANCIENT_IDS.test(entry.id)) p.push(`${at}: Petra and Giza belong to the Ancient layer (ancient-petra, ancient-giza); cross-link them instead of adding a second entry`);
  const cited = [...rec.measures.map((m) => m.source), ...rec.facts.map((f) => f.source), ...(rec.place.coords_source_id ? [rec.place.coords_source_id] : []), ...rec.claims.flatMap((c) => [...c.sources, ...(c.positions || []).map((x) => x.source)])];
  cited.forEach((id) => { if (!rec.sources.includes(id)) p.push(`${at}: cited source ${id} is not listed in the record's sources`); });
  rec.sources.forEach((id) => {
    const s = ctx.sourceById.get(id);
    if (!s) p.push(`${at}: source ${id} not in core/sources.json`);
    else if (SC_CLASS(s) === "experimental") p.push(`${at}: source ${id} is experimental and cannot back a fact`);
  });
  const official = rec.sources.filter((id) => (ctx.sourceById.get(id) || {}).class === "official");
  if (JSON.stringify(official) !== JSON.stringify(rec.official_sources)) p.push(`${at}: official_sources must list exactly the official-class sources`);
  if (!official.length) p.push(`${at}: needs at least one official source (UNESCO or NASA)`);
  if (rec.official_status !== (official.length ? "listed" : "[UNKNOWN]")) p.push(`${at}: official_status does not match the official sources`);
  if (!rec.facts.some((f) => f.source === "new7wonders-faq")) p.push(`${at}: must say, with its source, that the site is one of the vote's winners`);
  if (!/unofficial/i.test(rec.tiers.everyday) || !/unofficial/i.test(rec.tiers.student) || !/unofficial/i.test(entry.title)) p.push(`${at}: the title and both tiers must say the vote is unofficial`);
  rec.claims.forEach((c) => {
    if (c.status === "people-disagree" && (c.positions || []).length < 2) p.push(`${at}: a people-disagree claim needs two positions`);
    if (c.status === "myth" && !c.sources.some((id) => (ctx.sourceById.get(id) || {}).class === "official")) p.push(`${at}: a myth label needs an official source that rejects it`);
    if (c.status === "myth" && !/^Myth:/.test(c.text)) p.push(`${at}: a myth claim's text must start with "Myth:"`);
  });
  if (rec.place.pinned) {
    const cs = ctx.sourceById.get(rec.place.coords_source_id) || {};
    if (!/wikidata\.org/.test(cs.url || "") || !/CC0/.test(cs.license || "")) p.push(`${at}: pin coordinates must come from a CC0 Wikidata item`);
    if (rec.place.approximate !== true) p.push(`${at}: the pin is approximate`);
    if (typeof rec.place.lat !== "number" || typeof rec.place.lng !== "number" || Math.abs(rec.place.lat) > 90 || Math.abs(rec.place.lng) > 180) p.push(`${at}: pin missing or out of range`);
    const pl = entry.places[0];
    if (entry.places.length !== 1 || !pl || pl.lat !== rec.place.lat || pl.lng !== rec.place.lng) p.push(`${at}: entry place does not match the record pin`);
    if (!/approximate/i.test(pl ? pl.note || "" : "")) p.push(`${at}: the entry place note must say the pin is approximate`);
  } else {
    if (rec.place.lat != null || rec.place.lng != null || entry.places.some((q) => q.lat != null)) p.push(`${at}: an unpinned wonder has no coordinates anywhere`);
    if (rec.place.coords_text !== "[UNKNOWN]") p.push(`${at}: an unpinned wonder shows its coordinates as [UNKNOWN]`);
  }
  if (!entry.tiers || entry.tiers.everyday !== rec.tiers.everyday || entry.tiers.student !== rec.tiers.student) p.push(`${at}: entry tiers must match the record`);
  if (entry.kind !== "place" || entry.pack !== "wonders" || entry.category_path.join("/") !== "history-places/wonders") p.push(`${at}: must be a place in the wonders pack, history-places/wonders`);
  if (!entry.related.some((r) => r.type === "part-of" && r.to === "wonders-overview")) p.push(`${at}: must link part-of wonders-overview`);
  if (JSON.stringify(entry.dates.map((d) => d.date)) !== JSON.stringify(rec.dates.map((d) => d.date))) p.push(`${at}: entry dates must match the record dates`);
  [rec.tiers.everyday, rec.tiers.student, entry.summary].forEach((s) => p.push(...unofficialProblems(s, at)));
  p.push(...wonderPrivacyProblems([rec, entry], at));
  (ctx.others || []).forEach((o) => {
    if (rec.place.pinned && (o.places || []).some((q) => q.lat != null && Math.abs(q.lat - rec.place.lat) <= 0.01 && Math.abs(q.lng - rec.place.lng) <= 0.01)) p.push(`${at}: duplicates the pin of existing entry ${o.id}`);
  });
  return p;
}

export function wondersOverviewRules(entry, rec, ctx) {
  const p = [];
  const at = `wonders overview ${entry.id}`;
  asList(validateSchema(ctx.overviewSchema, rec)).forEach((x) => p.push(`${at}: ${x}`));
  if (rec.id !== entry.id) p.push(`${at}: record id ${rec.id} does not match its entry`);
  if (!/unofficial/i.test(entry.title) || !/unofficial/i.test(rec.tiers.everyday) || !/unofficial/i.test(rec.tiers.student)) p.push(`${at}: the title and both tiers must say the vote is unofficial`);
  [rec.tiers.everyday, rec.tiers.student, entry.summary, ...rec.facts.map((f) => f.text), ...rec.claims.map((c) => c.text)].forEach((s) => p.push(...unofficialProblems(s, at)));
  p.push(...wonderPrivacyProblems([rec, entry], at));
  const byId = ctx.entryById;
  rec.members.forEach((m) => {
    const e = byId.get(m.id);
    if (!e) { p.push(`${at}: member ${m.id} is not an Atlas entry`); return; }
    if (m.linked || e.layer !== "wonders") p.push(`${at}: member ${m.id} must be a wonders-layer entry`);
    const hasPin = e.places.some((q) => q.lat != null && q.lng != null);
    if (m.pinned !== hasPin) p.push(`${at}: member ${m.id} pinned flag is wrong`);
  });
  (ctx.layerIds || []).forEach((id) => { if (!rec.members.some((m) => m.id === id)) p.push(`${at}: wonders entry ${id} is missing from members`); });
  rec.vote.forEach((v) => {
    if (v.entry && !rec.members.some((m) => m.id === v.entry)) p.push(`${at}: vote item ${v.name} opens ${v.entry}, which is not a member`);
    if (!v.entry && !v.deferred_link) p.push(`${at}: vote item ${v.name} has neither a card nor a deferred cross-link`);
    if (v.entry && v.deferred_link) p.push(`${at}: vote item ${v.name} has both a card and a deferred link`);
    if (v.deferred_link && !/^ancient-/.test(v.deferred_link)) p.push(`${at}: a deferred link must point into the Ancient layer`);
    if (!ctx.sourceById.has(v.source)) p.push(`${at}: vote item ${v.name} cites ${v.source}, not in core/sources.json`);
  });
  const want = { winners: rec.vote.length, cards: rec.members.length, pinned: rec.members.filter((m) => m.pinned).length, deferred: rec.vote.filter((v) => v.deferred_link).length };
  if (JSON.stringify(want) !== JSON.stringify(rec.counts)) p.push(`${at}: counts do not match the vote and members`);
  const allCited = [...rec.facts.map((f) => f.source), ...rec.claims.flatMap((c) => c.sources), ...rec.stories.flatMap((s) => s.steps.flatMap((x) => x.sources))];
  allCited.forEach((id) => {
    if (!ctx.sourceById.has(id)) p.push(`${at}: cites ${id}, not in core/sources.json`);
    if (!rec.sources.includes(id)) p.push(`${at}: cites ${id}, not listed in its sources`);
  });
  rec.claims.forEach((c) => { if (c.status === "myth" && !/^Myth:|Myth:/.test(c.text)) p.push(`${at}: a myth claim must say "Myth:"`); });
  rec.stories.forEach((s) => s.steps.forEach((x, i) => { if (!byId.has(x.entry)) p.push(`${at}: story ${s.id} step ${i + 1} opens ${x.entry}, not an Atlas entry`); }));
  return p;
}

export function validateWonders(entries, ctx) {
  const problems = [];
  const siteSchema = JR("schema/globedesk-wonder.schema.json");
  const overviewSchema = JR("schema/globedesk-wonders-overview.schema.json");
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const layer = entries.filter((e) => e.layer === "wonders");
  const sites = layer.filter((e) => e.kind !== "topic");
  const others = entries.filter((e) => e.layer !== "wonders");
  sites.forEach((e) => {
    if (!e.record || !exists(e.record)) { problems.push(`wonder ${e.id}: record missing`); return; }
    problems.push(...wonderRules(e, JR(e.record), { ...ctx, siteSchema, others }));
  });
  layer.filter((e) => e.kind === "topic" && e.record && exists(e.record))
    .forEach((e) => problems.push(...wondersOverviewRules(e, JR(e.record), { ...ctx, overviewSchema, entryById, layerIds: sites.map((x) => x.id) })));
  if (sites.length && !layer.some((e) => e.id === "wonders-overview")) problems.push("wonders: overview entry missing");
  return problems;
}
