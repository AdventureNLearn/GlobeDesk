// Contributor cards, the community lane and the personal layer (local only, import/export).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { validateSchema } from "./jsonschema-lite.mjs";
const require = createRequire(import.meta.url);
const C = require("../js/community-cards.js");
const P = require("../js/personal-layer.js");
const SC = require("../js/source-class.js");
const J = (p) => JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const errs = (r) => (Array.isArray(r) ? r : (r && r.errors) || []);
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const cats = J("atlas/categories.json").categories;
const cardSchema = J("schema/globedesk-contributor-card.schema.json");
const AT = "@";
const card = (over) => Object.assign({ schema: "globedesk.contributor-card/1", handle: "canal-fan", description: "Maps public canal records.", topics: ["history-places/routes"], links: [{ title: "Dataset", url: "https://example.org/canals" }], checked: "2026-11-24", license: "CC BY 4.0" }, over || {});
const ctx = { categories: cats, today: "2026-11-24" };

t("a good card passes the schema and the validator", () => { assert.deepEqual(errs(validateSchema(cardSchema, card())), []); assert.deepEqual(C.validateCard(card(), ctx).errors, []); });
t("no email, phone, real name or location fields; schema and validator both refuse them", () => {
  for (const k of ["email", "phone", "real_name", "name", "address", "location", "lat"]) {
    const c = card({ [k]: "x" });
    assert.ok(errs(validateSchema(cardSchema, c)).length > 0, k);
    assert.ok(C.validateCard(c, ctx).errors.some((e) => /contact or location/.test(e)), k);
  }
  assert.ok(!C.validateCard(card({ description: "Mail me at someone" + AT + "example.org" }), ctx).ok);
  assert.ok(!C.validateCard(card({ description: "Call " + ["+1", "(555)", "010-0199"].join(" ") }), ctx).ok);
  assert.ok(C.validateCard(card({ description: "Canal records 1869-1914." }), ctx).ok);
});
t("limits: 1-2 lines, up to 3 https links, known topics, checked date, CC BY 4.0", () => {
  assert.ok(!C.validateCard(card({ description: "a\nb\nc" }), ctx).ok);
  assert.ok(!C.validateCard(card({ links: [1, 2, 3, 4].map((i) => ({ title: "l" + i, url: "https://example.org/" + i })) }), ctx).ok);
  assert.ok(!C.validateCard(card({ links: [{ title: "x", url: "http://example.org" }] }), ctx).ok);
  assert.ok(!C.validateCard(card({ topics: ["nope"] }), ctx).ok);
  assert.ok(!C.validateCard(card({ checked: "soon" }), ctx).ok);
  assert.ok(!C.validateCard(card({ license: "All rights reserved" }), ctx).ok);
});
t("cards fade after a year without a recheck", () => {
  assert.equal(C.validateCard(card({ checked: "2025-11-01" }), ctx).stale, true);
  assert.equal(C.contributorsFor({ cards: [card({ checked: "2025-01-01" })] }, "history-places", "2026-11-24")[0].stale, true);
});
t("strip contacts removes contact fields and mail/phone links", () => {
  const r = C.stripContacts(card({ email: "x", phone: "y", lat: 1, links: [{ title: "m", url: "mailto:x" }, { title: "ok", url: "https://example.org" }] }));
  assert.deepEqual(r.removed.sort(), ["email", "lat", "links[mailto]", "phone"]);
  assert.equal(r.card.links.length, 1);
});
t("shipped community file is valid and empty until review; community links stay separate from sources", () => {
  const doc = J("atlas/community/community.json");
  assert.deepEqual(errs(validateSchema(J("schema/globedesk-community.schema.json"), doc)), []);
  assert.deepEqual(C.validateCommunity(doc, ctx).errors, []);
  assert.equal(doc.cards.length + doc.links.length + doc.pins.length, 0);
  const fx = { schema: "globedesk.community/1", cards: [card()], links: [{ entry: "portable-solar-power", title: "Notes", url: "https://github.com/AdventureNLearn/GlobeDesk", card: "canal-fan", license: "CC BY 4.0", checked: "2026-11-24" }], pins: [] };
  assert.deepEqual(C.validateCommunity(fx, Object.assign({ entryIds: new Set(["portable-solar-power"]) }, ctx)).errors, []);
  assert.equal(SC.classOf(fx.links[0]), "experimental"); // owner link in a community lane is still experimental
  assert.ok(!C.validateCommunity(Object.assign({}, fx, { links: [Object.assign({}, fx.links[0], { card: "nobody" })] }), ctx).ok);
  assert.equal(C.contributorsFor(fx, "history-places", "2026-11-24").length, 1);
  assert.equal(C.contributorsFor(fx, "energy", "2026-11-24").length, 0);
});
t("personal layer: export then import round-trips; bad items dropped; wrong schema refused", () => {
  const layer = { schema: P.SCHEMA, pins: [{ id: "a1", title: "Camp", lat: 10.5, lng: -20.25, note: "dry" }], notes: [{ id: "n1", text: "Check fuse", entry: "bag-solar-kit" }], followed: ["energy", "objects/energy-kits"], links: [{ title: "Doc", url: "https://example.org/doc" }] };
  const text = P.exportText(layer, "2026-11-24T12:00:00Z");
  assert.deepEqual(errs(validateSchema(J("schema/globedesk-personal-layer.schema.json"), JSON.parse(text))), []);
  const r = P.importText(P.blank(), text);
  assert.ok(r.ok); assert.equal(r.dropped, 0); assert.deepEqual(r.layer.pins, layer.pins); assert.deepEqual(r.layer.followed, layer.followed);
  const r2 = P.importText(r.layer, text); assert.equal(r2.layer.pins.length, 1); // merge skips duplicates
  const bad = P.importText(P.blank(), JSON.stringify({ schema: P.SCHEMA, pins: [{ title: "x", lat: 200, lng: 0 }], links: [{ title: "x", url: "javascript:alert(1)" }], followed: ["Bad Topic"], notes: [] }));
  assert.ok(bad.ok); assert.equal(bad.dropped, 3); assert.equal(bad.layer.pins.length, 0);
  assert.equal(P.importText(P.blank(), "{}").ok, false); assert.equal(P.importText(P.blank(), "nope").ok, false);
});
t("Layers panel: Community switch is off by default with its own badge; Your layer says this device only", () => {
  const store = {}; const ctx2 = { window: { localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } } };
  vm.createContext(ctx2);
  ctx2.window.GD = { personal: P, atlasData: { community: J("atlas/community/community.json") } };
  vm.runInContext(readFileSync(new URL("../js/user-layers.js", import.meta.url), "utf8"), ctx2);
  const U = ctx2.window.GD.userLayers;
  assert.equal(U.communityOn(), false);
  const html = U.panelHtml();
  assert.match(html, /id="lpCommunity" aria-checked="false">/); assert.match(html, /cm-badge/); assert.match(html, /this device only/);
});
t("CONTRIBUTING has a Contributor cards section", () => assert.match(readFileSync(new URL("../CONTRIBUTING.md", import.meta.url), "utf8"), /## Contributor cards/));
console.log(`${n} community and personal-layer tests ok`);
