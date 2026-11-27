// Wonders layer (New Seven Wonders, an unofficial 2007 popular vote): records, overview, deferred Petra link,
// myth labels and validator rules. Pure Node; no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { validateAtlas } from "../tools/atlas/validate.mjs";
import { wonderRules, wondersOverviewRules } from "../tools/atlas/wonders-rules.mjs";
import { JR } from "../tools/atlas/lib.mjs";
const require = createRequire(import.meta.url);
const Bells = require("../js/atlas/bells-layer.js");
const Layer = require("../js/atlas/wonders-layer.js");
const Card = require("../js/atlas/wonders-card.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const clone = (x) => JSON.parse(JSON.stringify(x));

const js = readFileSync(new URL("../js/atlas/atlas-data.js", import.meta.url), "utf8");
const vctx = { window: {} }; vm.createContext(vctx); vm.runInContext(js, vctx);
const D = clone(vctx.window.GD.atlasData);
const byId = new Map(D.entries.map((e) => [e.id, e]));
const layer = D.entries.filter((e) => e.layer === "wonders" && e.kind !== "topic");
const sourceById = new Map(D.sources.map((s) => [s.id, s]));
const others = D.entries.filter((e) => e.layer !== "wonders");
const ctx = { sourceById, siteSchema: JR("schema/globedesk-wonder.schema.json"), overviewSchema: JR("schema/globedesk-wonders-overview.schema.json"),
  entryById: byId, others, layerIds: layer.map((e) => e.id) };
const rec = (id) => clone(D.records[byId.get(id).record]);
const ov = () => clone(D.records["data/atlas/wonders/wonders-overview.json"]);
const probs = (id, mut, extra = {}) => { const r = rec(id), e = clone(byId.get(id)); mut(r, e); return wonderRules(e, r, { ...ctx, ...extra }); };
const helpers = { esc: (s) => String(s), srcLink: (id) => "<a>" + id + "</a>", entryLink: (id) => "<b>" + id + "</b>" };

t("the whole atlas validates (wonders included)", () => assert.deepEqual(validateAtlas(), []));
t("six winners have a card; Petra is a deferred cross-link to the Ancient layer, never a second entry", () => {
  assert.deepEqual(layer.map((e) => e.id).sort(), ["wonder-chichen-itza", "wonder-christ-the-redeemer", "wonder-colosseum", "wonder-great-wall", "wonder-machu-picchu", "wonder-taj-mahal"]);
  const o = ov(); assert.equal(o.vote.length, 7); const p = o.vote.find((v) => v.name === "Petra");
  assert.equal(p.entry, null); assert.equal(p.deferred_link, "ancient-petra"); assert.ok(!D.entries.some((e) => /petra|giza/i.test(e.id)));
  assert.deepEqual(o.counts, { winners: 7, cards: 6, pinned: 5, deferred: 1 });
});
t("the vote is labelled unofficial in every title, tier, record and the UNESCO statement is cited", () => {
  [...layer, byId.get("wonders-overview")].forEach((e) => { assert.match(e.title, /unofficial/i); assert.match(e.tiers.everyday, /unofficial/i); assert.match(e.tiers.student, /unofficial/i); });
  layer.forEach((e) => assert.match(rec(e.id).vote_label, /^Unofficial:/));
  const o = ov(); assert.ok(o.facts.some((f) => f.source === "unesco-news-new7wonders" && /no link/.test(f.text)));
  assert.ok(o.claims.some((c) => c.status === "myth" && /^Myth:/.test(c.text) && c.sources.includes("unesco-news-new7wonders")));
  assert.ok(o.claims.some((c) => c.status === "not-proven" && c.sources.includes("new7wonders-faq")));
});
t("five approximate Wikidata (CC0) pins; the Great Wall is a line with no pin and no coordinates anywhere", () => {
  const pinned = layer.filter((e) => rec(e.id).place.pinned);
  assert.equal(pinned.length, 5);
  pinned.forEach((e) => { const r = rec(e.id); assert.equal(e.places.length, 1); assert.match(e.places[0].note, /approximate/); assert.match(sourceById.get(r.place.coords_source_id).license, /CC0/); });
  const w = byId.get("wonder-great-wall"); assert.ok(!rec(w.id).place.pinned); assert.ok(w.places.every((q) => q.lat == null && q.lng == null)); assert.equal(rec(w.id).place.coords_text, "[UNKNOWN]");
});
t("every fact, measure and claim names a source; each card has an official source (UNESCO or NASA)", () => {
  layer.forEach((e) => { const r = rec(e.id); assert.ok(r.official_sources.length >= 1); r.facts.forEach((f) => assert.ok(sourceById.has(f.source))); r.measures.forEach((m) => assert.ok(sourceById.has(m.source))); });
});
t("myth: the Great Wall 'seen from the Moon' belief is labelled Myth and rejected by a NASA page", () => {
  const c = rec("wonder-great-wall").claims.find((x) => x.status === "myth"); assert.match(c.text, /^Myth:/); assert.deepEqual(c.sources, ["nasa-great-wall"]); assert.equal(sourceById.get("nasa-great-wall").class, "official");
});
t("a disputed founding date is shown as people-disagree with both positions (Chichén Itzá)", () => {
  const c = rec("wonder-chichen-itza").claims[0]; assert.equal(c.status, "people-disagree"); assert.equal(c.positions.length, 2);
});
t("sources: UNESCO is linked only (CC BY-SA IGO), the organisation's page is all rights reserved with no logos, Wikidata is CC0, NASA is public", () => {
  assert.match(sourceById.get("unesco-whc-252").license, /CC BY-SA 3\.0 IGO[\s\S]*nothing is bundled/); assert.match(sourceById.get("unesco-news-new7wonders").license, /linked only/);
  assert.match(sourceById.get("new7wonders-faq").license, /all rights reserved[\s\S]*No logo/); assert.equal(sourceById.get("new7wonders-faq").class, "reference");
  assert.match(sourceById.get("nasa-great-wall").license, /not subject to copyright/);
});
t("no logos or images anywhere in the layer's records or entries", () => assert.doesNotMatch(JSON.stringify([layer, layer.map((e) => rec(e.id)), ov()]), /\.(png|svg|jpe?g|gif|webp)\b|<img|data:image|"(logo|image|img|thumbnail)"/i));
t("no personal data: no living person is named", () => assert.doesNotMatch(JSON.stringify([layer.map((e) => rec(e.id)), ov()]), /Weber|Hadid|Mayor\b/));
t("rule: Petra or Giza cannot be added as a second entry", () => assert.ok(probs("wonder-colosseum", (r, e) => { r.id = e.id = "wonder-petra"; }).some((p) => /Ancient layer/.test(p))));
t("rule: the vote must be called unofficial and an 'official list' claim is refused", () => {
  assert.ok(probs("wonder-taj-mahal", (r, e) => { e.title = "Taj Mahal"; }).some((p) => /unofficial/.test(p)));
  assert.ok(probs("wonder-taj-mahal", (r) => { r.tiers.student = "This is the official list of wonders."; }).some((p) => /official list without saying/.test(p)));
});
t("rule: a logo file or a living name is refused", () => {
  assert.ok(probs("wonder-colosseum", (r) => { r.facts[0].text += " See logo.png"; }).some((p) => /logo or image/.test(p)));
  assert.ok(probs("wonder-colosseum", (r) => { r.logo = "x"; }).some((p) => /logo or image field|additional|unknown/i.test(p)));
  assert.ok(probs("wonder-colosseum", (r) => { r.facts[0].text += " Founded by Bernard Weber."; }).some((p) => /living person/.test(p)));
});
t("rule: a pin must come from a CC0 Wikidata item; an unpinned wonder carries no coordinates", () => {
  assert.ok(probs("wonder-taj-mahal", (r) => { r.place.coords_source_id = "unesco-whc-252"; }).some((p) => /CC0 Wikidata/.test(p)));
  assert.ok(probs("wonder-great-wall", (r, e) => { e.places = [{ region: "CN", lat: 40, lng: 116, precision: "site", note: "approximate" }]; }).some((p) => /no coordinates anywhere/.test(p)));
});
t("rule: a myth needs an official rejecting source and the 'Myth:' label", () => {
  assert.ok(probs("wonder-great-wall", (r) => { r.claims[0].sources = ["new7wonders-faq"]; r.sources.push("new7wonders-faq"); }).some((p) => /official source that rejects/.test(p)));
  assert.ok(probs("wonder-great-wall", (r) => { r.claims[0].text = "The wall is visible from the Moon."; }).some((p) => /must start with "Myth:"/.test(p)));
});
t("rule: overview needs a card or a deferred Ancient link for each of the seven, and correct counts", () => {
  const o = ov(); o.vote[1].deferred_link = null; assert.ok(wondersOverviewRules(byId.get("wonders-overview"), o, ctx).some((p) => /neither a card nor a deferred/.test(p)));
  const o2 = ov(); o2.vote[1].deferred_link = "some-other-layer"; assert.ok(wondersOverviewRules(byId.get("wonders-overview"), o2, ctx).some((p) => /Ancient layer/.test(p)));
  const o3 = ov(); o3.counts.pinned = 6; o3.stories[0].steps[0].entry = "no-such-entry"; const p3 = wondersOverviewRules(byId.get("wonders-overview"), o3, ctx);
  assert.ok(p3.some((p) => /counts do not match/.test(p))); assert.ok(p3.some((p) => /no-such-entry/.test(p)));
});
t("layer: five pins (no Great Wall, no Petra), all approximate, off by default, own storage key, Bells clusters reused", () => {
  const ps = Layer.pins(D); assert.equal(ps.length, 5); assert.ok(ps.every((p) => p.approximate)); assert.ok(!ps.some((p) => p.id === "wonder-great-wall"));
  assert.equal(Layer.st.on, false); assert.equal(Layer.KEY, "globedesk.wonders.v1"); assert.notEqual(Layer.KEY, Bells.KEY);
  assert.equal(Bells.cluster(ps, 0).length < 5, true); assert.equal(Bells.cluster(ps, 9).length, 5);
});
t("layer: a cluster button says 'unofficial' in its visible text and its spoken label, not only its hover title", () => {
  const made = [];
  globalThis.document = { createElement: () => { const el = { a: {}, setAttribute(k, v) { this.a[k] = v; }, addEventListener() {}, appendChild() {}, remove() {} }; return el; } };
  globalThis.maplibregl = { Marker: function (o) { made.push(o.element); this.setLngLat = () => this; this.addTo = () => this; this.remove = () => {}; } };
  globalThis.GD.bellsLayer = Bells; globalThis.GD.atlasData = D; globalThis.GD.globe = { st: { map: { getZoom: () => 0 } }, flyTo() {} };
  Layer.st.on = true; Layer.sync();
  const clusters = made.filter((el) => el.className === "wd-cluster");
  assert.ok(clusters.length >= 1); clusters.forEach((el) => { assert.match(el.textContent, /^\d+ unofficial$/); assert.match(el.a["aria-label"], /unofficial 2007 vote/); });
  made.filter((el) => el.className === "wd-pin").forEach((el) => assert.match(el.a["aria-label"], /unofficial 2007 vote/));
  Layer.st.on = false; Layer.sync(); delete globalThis.document; delete globalThis.maplibregl; delete globalThis.GD.globe;
});
t("layer: panel says unofficial vote, five pins, no pin for the Great Wall and Petra in the Ancient layer", () => {
  globalThis.GD.atlasData = D;
  const h = Layer.panelHtml(); assert.match(h, /id="lpWonders"/); assert.match(h, /5 of the seven/); assert.match(h, /unofficial popular vote, not a UNESCO list/); assert.match(h, /Great Wall is a line/); assert.match(h, /Petra is in the Ancient layer/);
});
t("card: a record shows the unofficial banner, every measure with its source, the myth pill and a no-pin note", () => {
  const w = Card.html(rec("wonder-great-wall"), helpers);
  assert.match(w, /Unofficial vote/); assert.match(w, /no map pin/); assert.match(w, /pill red">Myth/); rec("wonder-great-wall").measures.forEach((x) => assert.ok(w.includes(x.value + ' <span class="muted">· <a>' + x.source + "</a>")));
  const c = Card.html(rec("wonder-chichen-itza"), helpers); assert.match(c, /People disagree/); assert.match(c, /approximate pin/);
  const o = Card.html(ov(), helpers); assert.match(o, /Unofficial vote/); assert.match(o, /<b>ancient-petra<\/b> <span class="muted">\(Ancient layer\)/); assert.equal((o.match(/data-wd-story=/g) || []).length, 2);
  assert.equal(Card.html({ schema: "globedesk.bell/1" }, helpers), "");
});
console.log(`wonders.unit: ${n} passed`);
