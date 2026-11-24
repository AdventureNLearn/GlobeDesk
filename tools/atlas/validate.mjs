// Atlas validator. Pure Node. Returns a list of problems; empty means valid.
import path from "node:path";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { validateSchema } from "../../tests/jsonschema-lite.mjs";
import { ATLAS, J, JR, MAX_BYTES, CATEGORY_PACKS, allEntries, fileInfo, packSha, exists, daysBetween, DATE_FORM } from "./lib.mjs";

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
  if (cat) { const want = e.current ? [cat.pack, "now"] : [cat.pack]; if (!want.includes(e.pack)) p.push(`${at}: pack ${e.pack} should be ${want.join(" or ")}`); }
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
      if ((b.kind === "repo" || b.kind === "lab-card" || b.kind === "owner-project-pending") && b.class !== "experimental") p.push(`${at} backing ${i + 1}: ${b.kind} must be experimental`);
      if (b.kind === "owner-project-pending" && b.url) p.push(`${at} backing ${i + 1}: a withheld project carries no link`);
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
// and a globe layer entry needs a lat/lng pin.
export function historyRules(e, ctx) {
  const p = [];
  const at = `entry ${e.id}`;
  if (e.pack === "history-places" && e.status !== "placeholder" && !e.sources.some((s) => { const src = ctx.sourceById.get(s); return src && SC.classOf(src) === "official"; })) p.push(`${at}: a history entry needs at least one official source`);
  if (e.tiers && e.tiers[e.tier] && e.tiers[e.tier] !== e.summary) p.push(`${at}: tiers.${e.tier} must equal the summary`);
  if (e.layer && !e.places.some((pl) => pl.lat != null && pl.lng != null)) p.push(`${at}: an object-layer entry needs a lat/lng pin`);
  if (e.layer && e.status !== "placeholder" && !e.record) p.push(`${at}: an object-layer entry needs a record`);
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
    if (id !== "core") { const c = cats.find((x) => x.pack === id); if (!c || m.category !== c.id || m.refresh !== c.refresh) problems.push(`manifest ${id}: category or refresh does not match the tree`); }
  }
  const index = J("packs/core/index.json").entries.map((e) => e.id).sort();
  if (JSON.stringify(index) !== JSON.stringify([...ids].sort())) problems.push("core index does not list exactly the pack entries");
  problems.push(...deskRules(JR("desks/work-desks.json")));
  // Hygiene: shareable files carry no home paths, emails or key-like strings.
  for (const rel of ["categories.json", "views.json", "packs/core/sources.json", ...CATEGORY_PACKS.map((p) => `packs/${p}/entries.json`)]) {
    const s = readFileSync(path.join(ATLAS, rel), "utf8");
    if (/\/home\/|\/workspace\/|C:\\\\|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}|api[_-]?key|\bsecrets?\b|password|bearer /i.test(s)) problems.push(`hygiene: ${rel} has a path, email or key-like string`);
  }
  for (const rel of artifactRecs) {
    const s = readFileSync(path.join(ATLAS, "..", rel), "utf8");
    if (/\/home\/|\/workspace\/|C:\\\\|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}|api[_-]?key|\bsecrets?\b|password|bearer /i.test(s)) problems.push(`hygiene: ${rel} has a path, email or key-like string`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const p = validateAtlas();
  p.forEach((x) => console.log("FAIL", x));
  console.log(p.length ? `${p.length} problems` : "atlas valid");
  process.exit(p.length ? 1 : 0);
}
