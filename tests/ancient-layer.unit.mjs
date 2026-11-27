// Ancient World layer, deep-time clock and desk: pins for all 13 shown sites, empty held list, myth lists, the clock
// registry (America 250 unchanged), the clock rule in the validator, and the desk's timeline button. Pure Node.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { historyRules, deskRules, HISTORY_RANGE } from "../tools/atlas/validate.mjs";
const require = createRequire(import.meta.url);
const CK = require("../js/atlas/clocks.js");
const Layer = require("../js/atlas/ancient-layer.js");
const M = require("../js/atlas/atlas-model.js");
const SC = require("../js/source-class.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const js = readFileSync(new URL("../js/atlas/atlas-data.js", import.meta.url), "utf8");
const c = { window: {} }; vm.createContext(c); vm.runInContext(js, c);
const D = JSON.parse(JSON.stringify(c.window.GD.atlasData));
const ctx = { sourceById: new Map(D.sources.map((s) => [s.id, s])) };

t("clocks: America 250 is unchanged (1775-2026) and still drives the history range", () => {
  assert.deepEqual([CK.byId("america-250").min, CK.byId("america-250").max], [1775, 2026]);
  assert.deepEqual(HISTORY_RANGE, { min: 1775, max: 2026 });
  assert.equal(CK.forPack("history-places").id, "america-250");
});
t("clocks: Ancient World runs on the deep-time clock, which reaches the earliest site", () => {
  const dt = CK.forPack("ancient-world");
  assert.equal(dt.id, "deep-time"); assert.equal(CK.forDesk("ancient-world"), dt);
  assert.ok(CK.inRange(dt, -9599)); assert.equal(CK.rangeLabel(dt), "10000 BCE–2026");
  assert.equal(CK.forPack("bells"), null, "packs without a clock are not limited");
});
t("validator: each pack is checked against its own clock", () => {
  const anc = structuredClone(D.entries.find((e) => e.id === "ancient-pompeii"));
  assert.ok(!historyRules(anc, ctx).some((x) => /outside/.test(x)));
  anc.dates = [{ date: "2030", precision: "year", approximate: false, label: "x" }];
  assert.ok(historyRules(anc, ctx).some((x) => /deep-time date 2030 is outside -9999-2026/.test(x)));
  const hist = structuredClone(D.entries.find((e) => e.pack === "history-places"));
  hist.dates = [{ date: "-500", precision: "year" }];
  assert.ok(historyRules(hist, ctx).some((x) => /history date -500 is outside 1775-2026/.test(x)), "America 250 still rejects ancient dates");
});
t("validator: a desk may only name a clock that exists and lists it", () => {
  const doc = JSON.parse(readFileSync(new URL("../desks/work-desks.json", import.meta.url), "utf8"));
  assert.deepEqual(deskRules(doc), []);
  const bad = structuredClone(doc); bad.desks[10].clock = "no-such-clock";
  assert.ok(deskRules(bad).some((x) => /unknown clock/.test(x)));
  const wrong = structuredClone(doc); wrong.desks[1].clock = "deep-time";
  assert.ok(deskRules(wrong).some((x) => /does not list this desk/.test(x)));
});
t("layer: all 13 shown sites get pins; the held list is empty; myths are listed, never pinned", () => {
  const ids = Layer.pins(D).map((p) => p.id).sort();
  assert.equal(ids.length, 13);
  assert.ok(ids.includes("ancient-pompeii") && ids.includes("ancient-palmyra") && ids.includes("ancient-goebekli-tepe"));
  assert.equal(Layer.held(D).length, 0);
  assert.deepEqual(Layer.myths(D).map((m) => m.id).sort(), ["myth-atlantis", "myth-el-dorado", "myth-shangri-la"]);
  assert.ok(Layer.pins(D).every((p) => p.approximate));
  assert.equal(Layer.filter(Layer.pins(D), { era: "1-1000-ce" }).length, 2);
  assert.equal(Layer.filter(Layer.pins(D), { era: "before-3000-bce" }).length, 2);
});
t("layer panel: off by default, says pins are approximate, lists myths, and does not list a held-pin review line", () => {
  assert.equal(Layer.st.on, false);
  const g = { GD: { atlasData: D } }; const old = globalThis.GD; globalThis.GD = g.GD;
  const ctx2 = { window: { GD: { atlasData: D } } }; vm.createContext(ctx2);
  vm.runInContext(readFileSync(new URL("../js/atlas/ancient-layer.js", import.meta.url), "utf8"), ctx2);
  const html = ctx2.window.GD.ancientLayer.panelHtml();
  globalThis.GD = old;
  assert.match(html, /approximate/); assert.match(html, /Atlantis/);
  assert.doesNotMatch(html, /held for owner review/);
  assert.match(html, /13 of 13 pinned sites shown/);
});
t("by year on the deep-time clock: the Ancient World pack alone, back to 9600 BC", () => {
  const y = M.byYear(D, { pack: "ancient-world" }, { today: "2026-11-26" });
  assert.equal(y.range.min, -9599); assert.ok(y.rows.every((r) => D.entries.find((e) => e.id === r.entry).pack === "ancient-world"));
  assert.ok(M.byYear(D, { pack: "ancient-world" }, { today: "2026-11-26", year: -9000 }).rows.some((r) => r.entry === "ancient-goebekli-tepe"));
  assert.equal(M.yearLabel(-9599), "9600 BCE");
});
t("desk 11: Ancient World shows the deep-time clock with a timeline button and a layer button", () => {
  const doc = JSON.parse(readFileSync(new URL("../desks/work-desks.json", import.meta.url), "utf8"));
  const ctx3 = { window: {} }; vm.createContext(ctx3);
  ctx3.window.GD = { sourceClass: SC, clocks: CK, atlasData: { desks: doc, categories: D.categories } };
  vm.runInContext(readFileSync(new URL("../js/work-desks.js", import.meta.url), "utf8"), ctx3);
  const html = ctx3.window.GD.workDesks.deskHtml(doc.desks.find((d) => d.id === "ancient-world"));
  assert.match(html, /Deep-time clock/); assert.match(html, /data-wd-clock="ancient-world"/); assert.match(html, /data-wd-layer="ancient"/);
  assert.doesNotMatch(ctx3.window.GD.workDesks.deskHtml(doc.desks[1]), /data-wd-clock/);
});
console.log(`${n} ancient layer tests ok`);
