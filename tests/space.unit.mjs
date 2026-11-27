// Space layer (Space race and launch sites): records, overview, cross-link and validator rules. Pure Node; no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { validateAtlas } from "../tools/atlas/validate.mjs";
import { spaceRules, spaceOverviewRules } from "../tools/atlas/space-rules.mjs";
import { JR } from "../tools/atlas/lib.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Bells = require("../js/atlas/bells-layer.js");
const Layer = require("../js/atlas/space-layer.js");
const Card = require("../js/atlas/space-card.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const clone = (x) => JSON.parse(JSON.stringify(x));

const js = readFileSync(new URL("../js/atlas/atlas-data.js", import.meta.url), "utf8");
const vctx = { window: {} }; vm.createContext(vctx); vm.runInContext(js, vctx);
const D = clone(vctx.window.GD.atlasData);
const byId = new Map(D.entries.map((e) => [e.id, e]));
const layer = D.entries.filter((e) => e.layer === "space" && e.kind !== "topic");
const earth = layer.filter((e) => e.kind === "place"), moon = layer.filter((e) => e.kind === "event");
const sourceById = new Map(D.sources.map((s) => [s.id, s]));
const others = D.entries.filter((e) => e.layer !== "space");
const ctx = { sourceById, siteSchema: JR("schema/globedesk-space-site.schema.json"), overviewSchema: JR("schema/globedesk-space-overview.schema.json"),
  entryById: byId, others, layerIds: layer.map((e) => e.id) };
const rec = (id) => clone(D.records[byId.get(id).record]);
const ov = () => clone(D.records["data/atlas/space/space-overview.json"]);
const probs = (id, mut) => { const r = rec(id), e = clone(byId.get(id)); mut(r, e); return spaceRules(e, r, ctx); };

t("the whole atlas validates (space included)", () => assert.deepEqual(validateAtlas(), []));
t("first batch: 5 Earth launch sites and 7 Moon landing sites, each with an official source", () => {
  assert.deepEqual(earth.map((e) => e.id).sort(), ["baikonur-cosmodrome", "cape-canaveral-launch-site", "jiuquan-launch-center", "kourou-guiana-space-centre", "vandenberg-launch-base"]);
  assert.equal(moon.length, 7);
  layer.forEach((e) => assert.ok(rec(e.id).official_sources.length >= 1));
});
t("Earth pins: one approximate Wikidata (CC0) point each; Moon sites have no Earth pin but lunar coordinates", () => {
  earth.forEach((e) => { const r = rec(e.id); assert.equal(e.places.length, 1); assert.match(e.places[0].note, /approximate/); assert.match(sourceById.get(r.place.coords_source_id).license, /CC0/); });
  moon.forEach((e) => { const r = rec(e.id); assert.deepEqual(e.places, []); assert.equal(r.place.body, "moon"); assert.match(sourceById.get(r.place.coords_source_id).url, /nssdc/); });
  assert.equal(rec("apollo-17-landing-site").place.coords_text, "20.191 N, 30.772 E");
});
t("Apollo 11 is cross-linked, never duplicated; the history entry only gains a back-link", () => {
  assert.equal(D.entries.filter((e) => e.id === "apollo-11-1969").length, 1); assert.ok(!layer.some((e) => /^apollo-11/.test(e.id)));
  const o = ov(); assert.ok(o.members.some((m) => m.id === "apollo-11-1969" && m.linked && !m.pinned));
  assert.deepEqual(byId.get("apollo-11-1969").related, [{ type: "see-also", to: "space-overview" }]);
  assert.ok(o.linked[0].facts.some((f) => f.source === "iau-statio-tranquillitatis" && /Tranquility Base/.test(f.text)));
});
t("Cape Canaveral links to Apollo 11 and is not the Apollo 11 pin", () => {
  assert.ok(byId.get("cape-canaveral-launch-site").related.some((x) => x.to === "apollo-11-1969"));
  assert.notDeepEqual(byId.get("cape-canaveral-launch-site").places[0].lat, byId.get("apollo-11-1969").places[0].lat);
});
t("sources: NASA, IAU, ESA, CNSA, Vandenberg and Wikidata are registered with their terms; Roscosmos is not used", () => {
  assert.match(sourceById.get("iau-statio-tranquillitatis").license, /public domain/); assert.match(sourceById.get("nssdca-apollo-landings").license, /not subject to copyright/);
  ["esa-europes-spaceport", "esa-baikonur-steppes", "esa-baikonur-cosmodrome"].forEach((id) => assert.match(sourceById.get(id).license, /all material on esa\.int is protected by copyright/));
  assert.match(sourceById.get("cnsa-dongfanghong-1").license, /all rights reserved/); assert.match(sourceById.get("vsfb-history").license, /\[UNKNOWN\]/);
  assert.ok(D.sources.every((s) => !/roscosmos/i.test(s.url)));
});
t("Apollo 16 and 17 traverse lengths that NSSDCA prints cut off stay [UNKNOWN]", () => {
  ["apollo-16-landing-site", "apollo-17-landing-site"].forEach((id) => { const m = rec(id).measures.find((x) => /Traverse/.test(x.label)); assert.match(m.value, /^\[UNKNOWN\]/); });
});
t("two stories; every step opens an Atlas entry and cites a registered source", () => {
  const o = ov(); assert.equal(o.stories.length, 2);
  o.stories.forEach((s) => s.steps.forEach((x) => { assert.ok(byId.has(x.entry)); assert.ok(x.sources.length && x.sources.every((id) => sourceById.has(id))); }));
});
t("rule: Apollo 11 cannot be added as a second record", () => assert.ok(probs("apollo-12-landing-site", (r, e) => { r.id = e.id = "apollo-11-landing-site"; }).some((p) => /already exists as apollo-11-1969/.test(p))));
t("rule: a Moon site with an Earth pin is refused", () => assert.ok(probs("luna-9-landing-site", (r, e) => { e.places = [{ region: "US", lat: 1, lng: 1, precision: "site", note: "x" }]; }).some((p) => /no Earth pin/.test(p))));
t("rule: Earth pin coordinates must be a CC0 Wikidata item", () => assert.ok(probs("baikonur-cosmodrome", (r) => { r.place.coords_source_id = "nasa-sputnik-1957"; r.sources.push("nasa-sputnik-1957"); }).some((p) => /CC0 Wikidata/.test(p))));
t("rule: lunar coordinates must come from NSSDCA or the IAU", () => assert.ok(probs("luna-9-landing-site", (r) => { r.place.coords_source_id = "wd-q177477"; r.sources.push("wd-q177477"); }).some((p) => /NSSDCA or the IAU/.test(p))));
t("rule: named crew are refused in any text", () => {
  assert.ok(probs("apollo-12-landing-site", (r) => { r.tiers.student += " Armstrong walked here."; }).some((p) => /names a crew member/.test(p)));
});
t("rule: overview needs Apollo 11 linked, correct pinned flags and story links", () => {
  const o = ov(); o.members = o.members.filter((m) => m.id !== "apollo-11-1969");
  assert.ok(spaceOverviewRules(byId.get("space-overview"), o, ctx).some((p) => /Apollo 11 must be cross-linked/.test(p)));
  const o2 = ov(); o2.members.find((m) => m.id === "luna-9-landing-site").pinned = true; o2.stories[0].steps[0].entry = "no-such-entry";
  const p2 = spaceOverviewRules(byId.get("space-overview"), o2, ctx); assert.ok(p2.some((x) => /pinned flag is wrong/.test(x))); assert.ok(p2.some((x) => /no-such-entry/.test(x)));
});
t("layer: five pins, only the layer's own Earth sites (no Moon sites, no second Apollo 11 pin), all approximate", () => {
  const ps = Layer.pins(D); assert.equal(ps.length, 5); assert.ok(ps.every((p) => p.approximate));
  assert.deepEqual(ps.map((p) => p.id).sort(), earth.map((e) => e.id).sort());
  assert.ok(!ps.some((p) => p.id === "apollo-11-1969" || /landing/.test(p.id)));
  const k = ps.find((p) => p.id === "kourou-guiana-space-centre"); assert.equal(k.lat, byId.get(k.id).places[0].lat);
});
t("layer: reuses the Bells clusters, is off by default and has its own storage key", () => {
  assert.equal(Layer.st.on, false); assert.equal(Layer.KEY, "globedesk.space.v1"); assert.notEqual(Layer.KEY, Bells.KEY);
  assert.equal(Bells.cluster(Layer.pins(D), 9).length, 5);
});
t("layer: panel section lists the count, the credits and says Moon sites have no Earth pin", () => {
  globalThis.GD.atlasData = D;
  const h = Layer.panelHtml(); assert.match(h, /id="lpSpace"/); assert.match(h, /5 launch sites on Earth/); assert.match(h, /NASA NSSDCA/); assert.match(h, /no Earth pin/);
  assert.equal(Layer.panelHtml.call(null).includes("undefined"), false);
});
t("card: a Moon record shows lunar coordinates with a source and no Earth pin; an Earth record shows the approximate pin", () => {
  const helpers = { esc: (s) => String(s), srcLink: (id) => "<a>" + id + "</a>", entryLink: (id) => "<b>" + id + "</b>" };
  const m = Card.html(rec("apollo-15-landing-site"), helpers);
  assert.match(m, /lunar coordinates, no Earth pin/); assert.match(m, /26\.132 N|26\.13/); rec("apollo-15-landing-site").measures.forEach((x) => assert.ok(m.includes(x.value + ' <span class="muted">· <a>' + x.source + "</a>")));
  const b = Card.html(rec("baikonur-cosmodrome"), helpers); assert.match(b, /approximate pin/); assert.match(b, /Supported/);
  const o = Card.html(ov(), helpers); assert.match(o, /existing Atlas event/); assert.equal((o.match(/data-sp-story=/g) || []).length, 2); assert.match(o, /<b>apollo-11-1969<\/b>/);
  assert.equal(Card.html({ schema: "globedesk.bell/1" }, helpers), "");
});
t("Apollo 17 site name is spelled as NSSDCA prints it (Taurus-Littrow), everywhere", () => {
  assert.doesNotMatch(js, /Taurus-Littow(?!r)/); assert.match(JSON.stringify(rec("apollo-17-landing-site")), /Taurus-Littrow/);
  assert.ok(byId.get("apollo-17-landing-site").aliases.includes("Taurus-Littrow"));
});
console.log(`space.unit: ${n} passed`);
