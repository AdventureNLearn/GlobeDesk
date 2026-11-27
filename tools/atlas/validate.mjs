// Atlas validator. Pure Node. Returns a list of problems; empty means valid.
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { validateSchema } from "../../tests/jsonschema-lite.mjs";
import { hygieneHits } from "./hygiene.mjs";
import { ATLAS, J, JR, MAX_BYTES, CATEGORY_PACKS, allEntries, fileInfo, packSha, exists, daysBetween, DATE_FORM, packCategory, categoryPacks } from "./lib.mjs";

const NOW_MAX_DAYS = 92; // "about 90 days"
const SC = createRequire(import.meta.url)("../../js/source-class.js");
const asList = (r) => (Array.isArray(r) ? r : (r && r.errors) || []);

// Rules a schema cannot express. Used on real entries and on test fixtures.
export function entryRules(e, ctx) {
  const p = [];
  const at = `entry ${e.id}`;
  if (e.subject_person_living !== false) p.push(`${at}: subject_person_living must be false (no entries about living people)`);
  if (e.kind === "person") p.push(`${at}: person entries are not allowed`);
  if (e.officials_in_role && e.kind !== "event") p.push(`${at}: officials may be named only inside an event entry`);
  (e.officials_in_role || []).forEach((o) => { if (!o.role || !o.role.trim()) p.push(`${at}: an official needs a public role`); });
  if (e.category_path[0] === "now") p.push(`${at}: home category cannot be Now; use current: true`);
  const cat = ctx.cats.find((c) => c.id === e.category_path[0]);
  if (!cat) p.push(`${at}: unknown category ${e.category_path[0]}`);
  else if (!cat.subcategories.some((s) => s.id === e.category_path[1])) p.push(`${at}: unknown subcategory ${e.category_path.join("/")}`);
  (e.see_also_paths || []).forEach((sp) => { const c = ctx.cats.find((x) => x.id === sp[0]); if (!c || !c.subcategories.some((s) => s.id === sp[1])) p.push(`${at}: unknown see-also path ${sp.join("/")}`); });
  if (cat) { const want = e.current ? [...categoryPacks(cat), "now"] : categoryPacks(cat); if (!want.includes(e.pack)) p.push(`${at}: pack ${e.pack} should be ${want.join(" or ")}`); }
  if (e.pack === "now" && !e.current) p.push(`${at}: an entry in the Now pack must be current`);
  if (e.current) {
    const days = e.dates.filter((d) => d.precision === "day").map((d) => d.date).sort();
    if (!days.length) p.push(`${at}: a current entry needs a day-precision date`);
    else if (!e.now_until || daysBetween(days[days.length - 1], e.now_until) > NOW_MAX_DAYS) p.push(`${at}: now_until must be within ${NOW_MAX_DAYS} days of the event date`);
  }
  e.dates.forEach((d) => {
    if (!DATE_FORM[d.precision].test(d.date)) p.push(`${at}: date ${d.date} does not match precision ${d.precision}`);
    if (d.end && !DATE_FORM[d.precision].test(d.end)) p.push(`${at}: end ${d.end} does not match precision ${d.precision}`);
  });
  e.places.forEach((pl) => { if (!pl.region && (pl.lat == null || pl.lng == null)) p.push(`${at}: a place needs a region code or lat/lng`); });
  e.sources.forEach((s) => { if (!ctx.sourceIds.has(s)) p.push(`${at}: source ${s} not in core/sources.json`); });
  // Owner rule: experimental references (owner repos, Learning Lab cards) never back a claim.
  e.sources.forEach((s) => { const src = ctx.sourceById && ctx.sourceById.get(s); if (src && SC.classOf(src) === "experimental") p.push(`${at}: source ${s} is experimental (owner repo or card) and cannot back a claim; move it to outbound as an experimental reference`); });
  (e.outbound || []).forEach((o, i) => { if (o.class) SC.checkTag(o, `${at} outbound ${i + 1}`).forEach((x) => p.push(x)); });
  e.related.forEach((r) => { if (!ctx.entryIds.has(r.to)) p.push(`${at}: related entry ${r.to} does not exist`); });
  [e.record, ...(e.records || [])].filter(Boolean).forEach((r) => { if (!exists(r)) p.push(`${at}: record file ${r} missing`); });
  if (e.status === "placeholder" && e.sources.length) p.push(`${at}: placeholders carry no sources yet`);
  return p;
}

// Every registered source carries a class; an owner repo or card can never be tagged official or reference.
export function sourceRules(sources) {
  const p = [];
  sources.forEach((s) => {
    if (!SC.CLASSES.includes(s.class)) p.push(`source ${s.id}: class must be one of ${SC.CLASSES.join(", ")}`);
    p.push(...SC.checkTag(s, `source ${s.id}`));
    if (s.class === "official" && !s.publisher) p.push(`source ${s.id}: an official source needs its publisher`);
  });
  return p;
}

// Desk lineup: experimental backing only, official sources must not be owner links, [UNKNOWN] when none.
export function deskRules(doc) {
  const p = [];
  (doc.desks || []).forEach((d) => {
    const at = `desk ${d.id}`;
    (d.backing || []).forEach((b, i) => {
      if (b.url && SC.isOwnerUrl(b.url) && b.class !== "experimental") p.push(`${at} backing ${i + 1}: owner repo or card must be experimental`);
      if ((b.kind === "repo" || b.kind === "lab-card" || b.kind === "sample-pending") && b.class !== "experimental") p.push(`${at} backing ${i + 1}: ${b.kind} must be experimental`);
      if (b.kind === "sample-pending" && b.url) p.push(`${at} backing ${i + 1}: a sample desk with no link yet carries no link`);
    });
    (d.official_sources || []).forEach((o, i) => {
      if (o.class !== "official") p.push(`${at} official ${i + 1}: class must be official`);
      if (SC.isOwnerUrl(o.url)) p.push(`${at} official ${i + 1}: an owner repo or card cannot be an official source`);
    });
    const want = (d.official_sources || []).length ? "listed" : "[UNKNOWN]";
    if (d.official_status !== want) p.push(`${at}: official_status must be ${want}`);
  });
  return p;
}

// Historic object and material records: schema, every row cites a registered source, unknowns stay marked.
export function artifactRules(rel, rec, ctx, schema) {
  const p = [];
  const at = `record ${rel}`;
  asList(validateSchema(schema, rec)).forEach((x) => p.push(`${at}: ${x}`));
  ["facts", "parts", "materials", "timeline"].forEach((k) => (rec[k] || []).forEach((row, i) => { if (!ctx.sourceIds.has(row.source)) p.push(`${at}: ${k} ${i + 1} cites unknown source ${row.source}`); }));
  (rec.citations || []).forEach((c) => { const s = ctx.sourceById.get(c.id); if (!s) p.push(`${at}: citation ${c.id} not in core/sources.json`); else if (s.url !== c.url) p.push(`${at}: citation ${c.id} url differs from the registry`); if (s && SC.classOf(s) === "experimental") p.push(`${at}: citation ${c.id} is experimental and cannot back a fact`); });
  (rec.timeline || []).forEach((t) => { if (!DATE_FORM[t.precision].test(t.date)) p.push(`${at}: timeline date ${t.date} does not match precision ${t.precision}`); });
  return p;
}

// History pack and object layers: at least one official source, reading-level text agrees with the summary,
// and a globe layer object needs a lat/lng pin (a layer overview topic, such as bells-overview, has no single place).
// History timeline range (owner decision 2026-11-24, OPEN-ITEMS #30): it starts at 1775 so the Old North
// lanterns of April 1775 sit inside the timeline, and ends at the current release year.
export const HISTORY_RANGE = { min: 1775, max: 2026 };

export function historyRules(e, ctx) {
  const p = [];
  const at = `entry ${e.id}`;
  if (e.pack === "history-places" && e.status !== "placeholder" && !e.sources.some((s) => { const src = ctx.sourceById.get(s); return src && SC.classOf(src) === "official"; })) p.push(`${at}: a history entry needs at least one official source`);
  if (e.pack === "history-places") (e.dates || []).forEach((d) => { const y = parseInt(String(d.date), 10); if (!(y >= HISTORY_RANGE.min && y <= HISTORY_RANGE.max)) p.push(`${at}: history date ${d.date} is outside ${HISTORY_RANGE.min}-${HISTORY_RANGE.max}`); });
  if (e.tiers && e.tiers[e.tier] && e.tiers[e.tier] !== e.summary) p.push(`${at}: tiers.${e.tier} must equal the summary`);
  if (e.layer && e.kind === "object" && !e.places.some((pl) => pl.lat != null && pl.lng != null)) p.push(`${at}: an object-layer entry needs a lat/lng pin`);
  if (e.layer && e.status !== "placeholder" && !e.record) p.push(`${at}: an object-layer entry needs a record`);
  return p;
}

// Bells layer: each bell record matches its schema and its entry; facts cite registered sources; at least one
// official source (official_status listed) or official_status [UNKNOWN]; no official or primary source means low confidence; Wikipedia is never the only source; pins in range.
export function bellRules(entry, rec, ctx) {
  const p = [];
  const at = `bell ${entry.id}`;
  asList(validateSchema(ctx.bellSchema, rec)).forEach((x) => p.push(`${at}: ${x}`));
  if (rec.id !== entry.id) p.push(`${at}: record id ${rec.id} does not match the entry`);
  const known = (id) => ctx.sourceById.has(id);
  [...rec.sources, ...rec.timeline.map((t) => t.source)].forEach((id) => { if (!known(id)) p.push(`${at}: source ${id} not in core/sources.json`); });
  rec.timeline.forEach((t) => { if (!rec.sources.includes(t.source)) p.push(`${at}: timeline source ${t.source} is not listed in the record's sources`); });
  const cls = (id) => (ctx.sourceById.get(id) || {});
  const official = rec.sources.filter((id) => cls(id).class === "official");
  const primary = rec.sources.filter((id) => cls(id).primary === true);
  if (official.length && rec.official_status !== "listed") p.push(`${at}: official_status must be listed when an official source is cited`);
  if (!official.length && rec.official_status !== "[UNKNOWN]") p.push(`${at}: official_status must be [UNKNOWN] when no official source is cited`);
  if (!official.length && !primary.length && rec.confidence !== "low") p.push(`${at}: with no official or primary source, confidence must be low`);
  if (JSON.stringify(official) !== JSON.stringify(rec.official_sources)) p.push(`${at}: official_sources must list exactly the official-class sources`);
  if (rec.sources.every((id) => /wikipedia\.org/.test((ctx.sourceById.get(id) || {}).url || ""))) p.push(`${at}: Wikipedia cannot be the only source`);
  if (Math.abs(rec.place.lat) > 90 || Math.abs(rec.place.lng) > 180) p.push(`${at}: pin out of range`);
  const pl = entry.places[0];
  if (!pl || pl.lat !== rec.place.lat || pl.lng !== rec.place.lng || pl.region !== rec.country) p.push(`${at}: entry place does not match the record pin`);
  if (rec.place.approximate && !/approximate/i.test(pl ? pl.note || "" : "")) p.push(`${at}: an approximate pin must say so in the entry place note`);
  if (!entry.tiers || entry.tiers.everyday !== rec.tiers.everyday || entry.tiers.student !== rec.tiers.student) p.push(`${at}: entry tiers must match the record`);
  if (!entry.related.some((r) => r.type === "made-of" && r.to === "bell-bronze")) p.push(`${at}: must link made-of bell-bronze`);
  if (rec.model.available !== (entry.model === "bell")) p.push(`${at}: entry model and record model disagree`);
  if (rec.model.from_sources && !(rec.diameter_m > 0)) p.push(`${at}: a sourced 3D model needs a sourced diameter`);
  return p;
}

// Bells overview (globedesk.bell-overview/1): schema, id matches its entry, every section cites registered
// sources and links entries that exist, and the per-region counts match the bell records.
export function bellOverviewRules(entry, rec, ctx) {
  const p = [];
  const at = `bell overview ${entry.id}`;
  asList(validateSchema(ctx.overviewSchema, rec)).forEach((x) => p.push(`${at}: ${x}`));
  if (rec.id !== entry.id) p.push(`${at}: record id ${rec.id} does not match its entry`);
  (rec.sections || []).forEach((sec) => {
    (sec.sources || []).forEach((id) => { if (!ctx.sourceById.has(id)) p.push(`${at}: section ${sec.id} cites ${id}, not in core/sources.json`); });
    (sec.bells || []).forEach((id) => { if (!ctx.entryIds.has(id)) p.push(`${at}: section ${sec.id} links ${id}, not an Atlas entry`); });
  });
  if (ctx.bellRegions) {
    const want = {};
    ctx.bellRegions.forEach((r) => { want[r] = (want[r] || 0) + 1; });
    const got = rec.counts || {};
    new Set([...Object.keys(want), ...Object.keys(got)]).forEach((k) => {
      if ((want[k] || 0) !== (got[k] || 0)) p.push(`${at}: count for ${k} is ${got[k] || 0}, bell records give ${want[k] || 0}`);
    });
  }
  return p;
}

export function packRules(m, dir) {
  const p = [];
  let size = 0;
  for (const f of m.files) {
    const info = fileInfo(path.join(dir, f.path));
    size += info.bytes;
    if (info.sha256 !== f.sha256) p.push(`pack ${m.id}: ${f.path} sha256 changed since the manifest was built`);
    if (info.bytes !== f.bytes) p.push(`pack ${m.id}: ${f.path} size changed since the manifest was built`);
  }
  if (packSha(m.files) !== m.sha256) p.push(`pack ${m.id}: pack sha256 does not match its file list`);
  if (size !== m.size_bytes) p.push(`pack ${m.id}: size_bytes ${m.size_bytes} != actual ${size}`);
  if (size >= MAX_BYTES || m.size_bytes >= MAX_BYTES) p.push(`pack ${m.id}: ${size} bytes is not under the 50 MB limit`);
  return p;
}


// Object and price records referenced by entries, or passed as a single file.
export function objectRules(rel, rec) {
  const p = [];
  const schema = JR("schema/globedesk-object.schema.json");
  asList(validateSchema(schema, rec)).forEach((x) => p.push(`record ${rel}: ${x}`));
  const citeIds = new Set((rec.citations || []).map((c) => c.id));
  (rec.parts || []).forEach((part) => (part.citations || []).forEach((c) => {
    if (!citeIds.has(c)) p.push(`record ${rel}: part ${part.id} cites unknown ${c}`);
  }));
  (rec.safety || []).forEach((s) => (s.citations || []).forEach((c) => {
    if (!citeIds.has(c)) p.push(`record ${rel}: safety ${s.id} cites unknown ${c}`);
  }));
  return p;
}

export function priceRules(rel, rec) {
  const p = [];
  const schema = JR("schema/globedesk-prices.schema.json");
  asList(validateSchema(schema, rec)).forEach((x) => p.push(`record ${rel}: ${x}`));
  return p;
}

export function validateRecordFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!existsSync(abs)) return [`${filePath}: file not found`];
  let rec;
  try { rec = JSON.parse(readFileSync(abs, "utf8")); }
  catch { return [`${filePath}: not valid JSON`]; }
  if (rec && rec.schema === "globedesk.object/1") return objectRules(filePath, rec);
  if (rec && rec.schema === "globedesk.prices/1") return priceRules(filePath, rec);
  return [`${filePath}: unknown record schema ${rec && rec.schema ? rec.schema : "[UNKNOWN]"}`];
}

export function validateAtlas() {
  const problems = [];
  const entrySchema = JR("schema/atlas-entry.schema.json");
  const manSchema = JR("schema/atlas-pack-manifest.schema.json");
  const cats = J("categories.json").categories;
  if (cats.length !== 12) problems.push(`expected 12 categories, found ${cats.length}`);
  cats.forEach((c) => { if (c.subcategories.length < 3 || c.subcategories.length > 6) problems.push(`category ${c.id}: needs 3-6 subcategories`); });
  const entries = allEntries();
  const ids = entries.map((e) => e.id);
  new Set(ids).size !== ids.length && problems.push("duplicate entry ids");
  const sources = J("packs/core/sources.json").sources;
  const ctx = { cats, entryIds: new Set(ids), sourceIds: new Set(sources.map((s) => s.id)), sourceById: new Map(sources.map((s) => [s.id, s])) };
  problems.push(...sourceRules(sources));
  for (const e of entries) {
    asList(validateSchema(entrySchema, e)).forEach((x) => problems.push(`entry ${e.id}: ${x}`));
    problems.push(...entryRules(e, ctx));
    problems.push(...historyRules(e, ctx));
  }
  const artSchema = JR("schema/globedesk-artifact.schema.json");
  const artifactRecs = [...new Set(entries.flatMap((e) => [e.record, ...(e.records || [])]).filter(Boolean))].filter((r) => exists(r) && JR(r).schema === "globedesk.artifact/1");
  artifactRecs.forEach((r) => problems.push(...artifactRules(r, JR(r), ctx, artSchema)));
  for (const id of ["core", ...CATEGORY_PACKS]) {
    const m = J(`packs/${id}/manifest.json`);
    asList(validateSchema(manSchema, m)).forEach((x) => problems.push(`manifest ${id}: ${x}`));
    problems.push(...packRules(m, path.join(ATLAS, "packs", id)));
    const count = id === "core" ? entries.length : J(`packs/${id}/entries.json`).entries.length;
    if (m.entry_count !== count) problems.push(`manifest ${id}: entry_count ${m.entry_count} != ${count}`);
    if (id !== "core") { const c = packCategory(cats, id); if (!c || m.category !== c.id || m.refresh !== c.refresh) problems.push(`manifest ${id}: category or refresh does not match the tree`); }
  }
  const bellSchema = JR("schema/globedesk-bell.schema.json");
  entries.filter((e) => e.layer === "bells" && e.kind === "object").forEach((e) => {
    if (!e.record || !exists(e.record)) { problems.push(`bell ${e.id}: record missing`); return; }
    problems.push(...bellRules(e, JR(e.record), { ...ctx, bellSchema }));
  });
  const overviewSchema = JR("schema/globedesk-bell-overview.schema.json");
  const bellRegions = entries.filter((e) => e.layer === "bells" && e.kind === "object" && e.record && exists(e.record)).map((e) => JR(e.record).region);
  entries.filter((e) => e.record && exists(e.record) && JR(e.record).schema === "globedesk.bell-overview/1")
    .forEach((e) => problems.push(...bellOverviewRules(e, JR(e.record), { ...ctx, overviewSchema, bellRegions })));
  const index = J("packs/core/index.json").entries.map((e) => e.id).sort();
  if (JSON.stringify(index) !== JSON.stringify([...ids].sort())) problems.push("core index does not list exactly the pack entries");
  problems.push(...deskRules(JR("desks/work-desks.json")));
  const recordPaths = new Set();
  for (const e of entries) {
    [e.record, ...(e.records || [])].filter(Boolean).forEach((r) => recordPaths.add(r));
  }
  for (const r of recordPaths) {
    if (!exists(r)) continue;
    const rec = JR(r);
    if (rec.schema === "globedesk.object/1") problems.push(...objectRules(r, rec));
    if (rec.schema === "globedesk.prices/1") problems.push(...priceRules(r, rec));
  }
  // Hygiene: shareable files carry no home paths, emails or key-like strings.
  for (const rel of ["categories.json", "views.json", "packs/core/sources.json", ...CATEGORY_PACKS.map((p) => `packs/${p}/entries.json`)]) {
    const s = readFileSync(path.join(ATLAS, rel), "utf8");
    { const hits = hygieneHits(s); if (hits.length) problems.push(`hygiene: ${rel} has a path, email or key-like string (${hits.join(", ")})`); }
  }
  for (const rel of artifactRecs) {
    const s = readFileSync(path.join(ATLAS, "..", rel), "utf8");
    { const hits = hygieneHits(s); if (hits.length) problems.push(`hygiene: ${rel} has a path, email or key-like string (${hits.join(", ")})`); }
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2];
  const p = target ? validateRecordFile(target) : validateAtlas();
  p.forEach((x) => console.log("FAIL", x));
  console.log(p.length ? `${p.length} problems` : (target ? "record valid" : "atlas valid"));
  process.exit(p.length ? 1 : 0);
}
