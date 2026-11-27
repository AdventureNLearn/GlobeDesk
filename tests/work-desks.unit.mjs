// Eleven desks: lineup, schema, public-only links, sample desks with no link yet, public repos experimental (never official).
import assert from "node:assert/strict";
import { hygieneHits } from "../tools/atlas/hygiene.mjs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { validateSchema } from "./jsonschema-lite.mjs";
import { deskRules } from "../tools/atlas/validate.mjs";
const require = createRequire(import.meta.url);
const SC = require("../js/source-class.js");
const J = (p) => JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const errs = (r) => (Array.isArray(r) ? r : (r && r.errors) || []);
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const doc = J("desks/work-desks.json");
const schema = J("schema/globedesk-work-desks.schema.json");
const clone = () => JSON.parse(JSON.stringify(doc));

t("desk file matches its schema and the desk rules", () => { assert.deepEqual(errs(validateSchema(schema, doc)), []); assert.deepEqual(deskRules(doc), []); });
t("eleven desks in the approved order; News is the existing desk with its 10 sections", () => {
  assert.deepEqual(doc.desks.map((d) => d.title), ["News", "Permits and Codes", "Jobsite and Constructability", "Trades and Skills", "Engineering and 3D Objects", "Energy and Materials", "Infrastructure, Trade and Routes", "Regulatory and Public Records", "Surveillance and Civil Liberties", "Security and Counterterrorism", "Ancient World"]);
  const sections = J("newsdesk/sections.json").sections.map((s) => s.id);
  assert.equal(doc.desks[0].existing, true); assert.deepEqual(doc.desks[0].news_sections, sections);
  doc.desks.forEach((d) => d.news_sections.forEach((s) => assert.ok(sections.includes(s), d.id + ":" + s)));
});
t("every desk has a scope, tier notes for all four levels, and known Atlas categories", () => {
  const cats = J("atlas/categories.json").categories.map((c) => c.id);
  doc.desks.forEach((d) => { assert.ok(d.scope && d.tier_note); ["kids", "everyday", "student", "professional"].forEach((k) => assert.ok(d.tiers[k], d.id + ":" + k)); d.atlas_categories.forEach((c) => assert.ok(cats.includes(c), c)); });
});
t("links are public AdventureNLearn repos or the public Learning Lab only, all labelled experimental", () => {
  doc.desks.forEach((d) => d.backing.forEach((b) => {
    if (b.url) { assert.match(b.url, /^https:\/\/(github\.com\/AdventureNLearn\/[A-Za-z0-9._-]+|learninglab\.grok\.me\/)$/); assert.equal(b.class, "experimental"); assert.ok(SC.isOwnerUrl(b.url)); }
  }));
});
t("sample desks with no public link yet say 'link pending' and carry no link", () => {
  const pending = doc.desks.flatMap((d) => d.backing.filter((b) => b.kind === "sample-pending"));
  assert.equal(pending.length, 4);
  pending.forEach((b) => { assert.equal(b.url, undefined); assert.match(b.label, /^Sample desk: .*\(link pending/); assert.equal(b.class, "experimental"); });
});
t("owner rule: an owner repo or card can never be tagged official", () => {
  const d = clone(); d.desks[1].official_sources = [{ label: "x", publisher: "x", url: "https://github.com/AdventureNLearn/permit-harbor", class: "official", checked: "2026-11-24" }]; d.desks[1].official_status = "listed";
  assert.ok(deskRules(d).some((x) => /cannot be an official source/.test(x)));
  const d2 = clone(); d2.desks[1].backing[0].class = "internal";
  assert.ok(deskRules(d2).some((x) => /must be experimental/.test(x)));
  const d3 = clone(); d3.desks[1].official_sources = [{ label: "card", publisher: "x", url: "https://learninglab.grok.me/", class: "official", checked: "2026-11-24" }]; d3.desks[1].official_status = "listed";
  assert.ok(deskRules(d3).length > 0);
  assert.ok(SC.checkTag({ url: "https://github.com/AdventureNLearn/CTA6", class: "official" }, "x").length > 0);
  assert.ok(SC.checkTag({ url: "https://example.grok.me/", class: "reference" }, "x").length > 0);
  assert.equal(SC.classOf({ url: "https://github.com/AdventureNLearn/GlobeDesk", class: "official" }), "experimental");
  assert.deepEqual(SC.checkTag({ url: "https://www.faa.gov/hazmat/packsafe/lithium-batteries", class: "official" }, "x"), []);
});
t("all 11 desks list official sources; a desk with none must show [UNKNOWN]", () => {
  const unknown = doc.desks.filter((d) => !d.official_sources.length);
  assert.equal(unknown.length, 0);
  doc.desks.forEach((d) => assert.equal(d.official_status, "listed"));
  const d = clone(); d.desks[2].official_sources = []; d.desks[2].official_status = "listed"; assert.ok(deskRules(d).some((x) => /official_status/.test(x)));
});
t("rendered desk: experimental label on every owner link, separate group, official [UNKNOWN] shown", () => {
  const html = []; const ctx = { window: {}, globalThis: {} }; vm.createContext(ctx);
  ctx.window.GD = { sourceClass: SC, atlasData: { desks: doc, categories: J("atlas/categories.json").categories } };
  vm.runInContext(readFileSync(new URL("../js/work-desks.js", import.meta.url), "utf8"), ctx);
  const W = ctx.window.GD.workDesks;
  const permits = W.deskHtml(doc.desks[1]);
  const links = permits.match(/<a [^>]*>/g) || [];
  assert.equal(links.length, 6); // 3 official + 3 experimental
  assert.equal((permits.match(/Experimental \(not an official source\)/g) || []).length, 4); // 3 links + 1 pending
  assert.match(permits, /wd-official[\s\S]*census\.gov/);
  assert.ok(permits.indexOf("Official sources") < permits.indexOf("Experimental references"));
  const noOff = clone().desks[1]; noOff.official_sources = []; noOff.official_status = "[UNKNOWN]";
  assert.match(W.deskHtml(noOff), /Official source \[UNKNOWN\]/);
  const energy = W.deskHtml(doc.desks[5]);
  assert.match(energy, /wd-official[\s\S]*faa\.gov/); assert.doesNotMatch(energy, /Official source \[UNKNOWN\]/);
  assert.match(energy, /data-wd-atlas-view="elements"[^>]*>Elements periodic table</);
  html.push(permits);
});
t("OPSEC: desk text has no private paths, emails or secrets", () => {
  const s = readFileSync(new URL("../desks/work-desks.json", import.meta.url), "utf8");
  assert.doesNotMatch(s, /\/home\/|\/workspace\/|C:\\\\|namemap|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}|api[_-]?key|\bsecrets?\b|token|password/i);
  assert.deepEqual(hygieneHits(s), []);
});
console.log(`${n} work desk tests ok`);
