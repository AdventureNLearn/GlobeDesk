// Elements browse view: 18-column layout, family lines, Group 3 fork, search dimming, table fallback.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const M = require("../js/atlas/atlas-model.js");
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok", name); };

const js = readFileSync(new URL("../js/atlas/atlas-data.js", import.meta.url), "utf8");
const dataCtx = { window: {} };
vm.createContext(dataCtx);
vm.runInContext(js, dataCtx);
const D = JSON.parse(JSON.stringify(dataCtx.window.GD.atlasData));

t("elementPos follows the IUPAC 18-column table and leaves period 6/7 group-3 cells empty", () => {
  assert.deepEqual(M.elementPos(1), { col: 1, row: 1 });
  assert.deepEqual(M.elementPos(2), { col: 18, row: 1 });
  assert.deepEqual(M.elementPos(3), { col: 1, row: 2 });
  assert.deepEqual(M.elementPos(6), { col: 14, row: 2 });
  assert.deepEqual(M.elementPos(26), { col: 8, row: 4 });
  assert.deepEqual(M.elementPos(21), { col: 3, row: 4 });
  assert.deepEqual(M.elementPos(39), { col: 3, row: 5 });
  assert.deepEqual(M.elementPos(57), { col: 3, row: 9 });
  assert.deepEqual(M.elementPos(71), { col: 17, row: 9 });
  assert.deepEqual(M.elementPos(72), { col: 4, row: 6 });
  assert.deepEqual(M.elementPos(89), { col: 3, row: 10 });
  assert.deepEqual(M.elementPos(103), { col: 17, row: 10 });
  assert.deepEqual(M.elementPos(104), { col: 4, row: 7 });
  assert.deepEqual(M.elementPos(118), { col: 18, row: 7 });
  const occupied = new Set();
  for (let z = 1; z <= 118; z++) {
    const p = M.elementPos(z);
    assert.ok(p, "z " + z);
    const k = p.col + "," + p.row;
    assert.equal(occupied.has(k), false, "overlap at " + k);
    occupied.add(k);
    assert.ok(p.col >= 1 && p.col <= 18 && p.row >= 1 && p.row <= 10);
  }
  assert.equal(occupied.has("3,6"), false);
  assert.equal(occupied.has("3,7"), false);
  assert.equal(occupied.has("3,8"), false);
});

t("family ids follow IUPAC-named groups and leave La/Lu/Ac/Lr in the f-block series", () => {
  assert.equal(M.elementFamily(1), "hydrogen");
  assert.equal(M.elementFamily(3), "alkali-metal");
  assert.equal(M.elementFamily(12), "alkaline-earth");
  assert.equal(M.elementFamily(21), "group-3");
  assert.equal(M.elementFamily(39), "group-3");
  assert.equal(M.elementFamily(26), "groups-4-12");
  assert.equal(M.elementFamily(13), "groups-13-16");
  assert.equal(M.elementFamily(9), "halogen");
  assert.equal(M.elementFamily(10), "noble-gas");
  assert.equal(M.elementFamily(57), "lanthanoid");
  assert.equal(M.elementFamily(71), "lanthanoid");
  assert.equal(M.elementFamily(89), "actinoid");
  assert.equal(M.elementFamily(103), "actinoid");
});

t("elementsView places all 118 records and draws a Group 3 unresolved fork", () => {
  const ev = M.elementsView(D, {});
  assert.equal(ev.stars.length, 118);
  assert.deepEqual(ev.missing, []);
  const byId = Object.fromEntries(ev.stars.map((s) => [s.id, s]));
  assert.equal(byId["hydrogen-element"].col, 1);
  assert.equal(byId["helium-element"].col, 18);
  assert.equal(byId["aluminium-element"].symbol, "Al");
  assert.equal(byId["caesium-element"].name, "Caesium");
  assert.equal(byId["lanthanum-element"].row, 9);
  assert.equal(byId["lutetium-element"].col, 17);
  assert.ok(!ev.stars.some((s) => s.col === 3 && (s.row === 6 || s.row === 7)));
  const g3 = ev.lines.find((l) => l.family === "group-3");
  assert.deepEqual(g3.points.map((p) => p.z), [21, 39]);
  assert.equal(ev.forks.length, 1);
  assert.equal(ev.forks[0].kind, "group-3-unresolved");
  const pts = ev.forks[0].paths.flat().map((p) => p.col + "," + p.row);
  assert.ok(pts.includes("3,9") && pts.includes("17,9") && pts.includes("3,10") && pts.includes("17,10"));
});

t("search marks matching stars and leaves the others in the layout", () => {
  const ev = M.elementsView(D, { q: "oganesson" });
  assert.equal(ev.stars.length, 118);
  const hits = ev.stars.filter((s) => s.match);
  assert.deepEqual(hits.map((s) => s.id), ["oganesson-element"]);
  assert.equal(ev.stars.filter((s) => !s.match).length, 117);
  assert.equal(M.elementsView(D, { q: "zzqx nothing" }).stars.filter((s) => s.match).length, 0);
});

t("arrow keys step to the nearest star on the same row or column", () => {
  const ev = M.elementsView(D, {});
  const h = ev.stars.find((s) => s.id === "hydrogen-element");
  const he = M.stepElement(ev.stars, h, "ArrowRight");
  assert.equal(he.id, "helium-element");
  assert.equal(M.stepElement(ev.stars, h, "ArrowDown").id, "lithium-element");
  const y = ev.stars.find((s) => s.id === "yttrium-element");
  assert.equal(M.stepElement(ev.stars, y, "ArrowDown").id, "lanthanum-element");
  const la = ev.stars.find((s) => s.id === "lanthanum-element");
  assert.equal(M.stepElement(ev.stars, la, "ArrowRight").id, "cerium-element");
  assert.equal(M.stepElement(ev.stars, ev.stars[0], "Home").z, 1);
  assert.equal(M.stepElement(ev.stars, ev.stars[0], "End").z, 118);
  const ogHits = ev.stars.map((s) => Object.assign({}, s, { match: s.id === "oganesson-element" }));
  assert.equal(M.stepElement(ogHits, h, "End", { matchesOnly: true }).id, "oganesson-element");
});

function renderAtlas(opts) {
  const nodes = Object.create(null);
  function el(tag, id) {
    const n = {
      tagName: String(tag).toUpperCase(),
      id: id || "",
      hidden: false,
      innerHTML: "",
      className: "",
      classList: { _s: new Set(), add(...a) { a.forEach((x) => this._s.add(x)); }, remove(...a) { a.forEach((x) => this._s.delete(x)); }, contains(x) { return this._s.has(x); } },
      attributes: Object.create(null),
      listeners: {},
      setAttribute(k, v) { this.attributes[k] = String(v); if (k === "id") { this.id = v; nodes[v] = this; } },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
      addEventListener(typ, fn) { (this.listeners[typ] = this.listeners[typ] || []).push(fn); },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) { return []; },
      focus() { document.activeElement = this; }
    };
    if (id) nodes[id] = n;
    return n;
  }
  const body = el("body");
  const atlasView = el("aside", "atlasView");
  el("button", "btnAtlas");
  const document = { body, readyState: "complete", activeElement: body, getElementById: (id) => nodes[id] || null, addEventListener() {} };
  const matchMedia = (q) => ({ matches: !!(opts && opts.reduced && String(q).includes("prefers-reduced-motion")) });
  const ctx = { window: { GD: { atlasData: D, atlasModel: M } }, document, matchMedia, console };
  ctx.window.window = ctx.window;
  ctx.globalThis = ctx;
  ctx.window.document = document;
  ctx.window.matchMedia = matchMedia;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../js/atlas/atlas-view.js", import.meta.url), "utf8"), ctx);
  const atlas = ctx.window.GD.atlas;
  atlas.st.open = true;
  atlas.st.view = "elements";
  if (opts && "elementsMode" in opts) atlas.st.elementsMode = opts.elementsMode;
  if (opts && "q" in opts) atlas.st.q = opts.q;
  if (opts && "selected" in opts) atlas.st.selected = opts.selected;
  atlas.render();
  return atlasView.innerHTML;
}

t("constellation markup has 118 stars, family lines, the fork, and no inline styles", () => {
  const html = renderAtlas({ elementsMode: "constellation" });
  assert.match(html, /data-at-view="elements"/);
  assert.equal((html.match(/class="at-el-star /g) || []).length, 118);
  assert.match(html, /data-at-entry="hydrogen-element"[^>]*data-at-el-c="1"[^>]*data-at-el-r="1"/);
  assert.match(html, /data-at-entry="lanthanum-element"[^>]*data-at-el-c="3"[^>]*data-at-el-r="9"/);
  assert.doesNotMatch(html, /data-at-el-c="3"[^>]*data-at-el-r="6"/);
  assert.doesNotMatch(html, /data-at-el-c="3"[^>]*data-at-el-r="7"/);
  assert.match(html, /class="at-el-fork"/);
  assert.match(html, /Group 3 membership is unresolved/);
  assert.match(html, /at-el-line at-fam-alkali-metal/);
  assert.match(html, /data-at-el-mode="table"/);
  assert.doesNotMatch(html, /style="/);
  assert.doesNotMatch(html, /\bfetch\(|XMLHttpRequest|WebSocket/);
  assert.doesNotMatch(html, /elements\.html|#elements/);
});

t("table mode lists matching rows and reduced motion defaults to the table", () => {
  const table = renderAtlas({ elementsMode: "table" });
  assert.match(table, /class="at-table at-el-table"/);
  assert.equal((table.match(/data-at-entry="[^"]+-element"/g) || []).length, 118);
  assert.doesNotMatch(table, /class="at-el-grid"/);
  const filtered = renderAtlas({ elementsMode: "table", q: "oganesson" });
  assert.equal((filtered.match(/data-at-entry="[^"]+-element"/g) || []).length, 1);
  assert.match(filtered, /oganesson-element/);
  const reduced = renderAtlas({ reduced: true, elementsMode: null });
  assert.match(reduced, /at-el-table/);
  assert.doesNotMatch(reduced, /class="at-el-grid"/);
});

t("search dims non-matching stars in the constellation and select can target a star", () => {
  const html = renderAtlas({ elementsMode: "constellation", q: "oganesson", selected: "oganesson-element" });
  const miss = (html.match(/at-el-miss/g) || []).length;
  assert.equal(miss, 117);
  const btn = /<button[^>]*data-at-entry="oganesson-element"[^>]*>/.exec(html)[0];
  assert.match(btn, /\bon\b/);
  assert.doesNotMatch(btn, /at-el-miss/);
  const dim = /<button[^>]*data-at-entry="hydrogen-element"[^>]*>/.exec(html)[0];
  assert.match(dim, /at-el-miss/);
});

t("view source still has no network calls and no inline styles", () => {
  const s = readFileSync(new URL("../js/atlas/atlas-view.js", import.meta.url), "utf8");
  const m = readFileSync(new URL("../js/atlas/atlas-model.js", import.meta.url), "utf8");
  for (const [name, src] of [["atlas-view.js", s], ["atlas-model.js", m]]) {
    assert.doesNotMatch(src, /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/, name);
    assert.doesNotMatch(src, /style="/, name);
  }
  assert.match(s, /GD\.atlas\.select|select\(id\)/);
  assert.match(s, /prefers-reduced-motion/);
  assert.doesNotMatch(s, /elements\.html/);
});

console.log(n + " atlas elements view tests ok");
