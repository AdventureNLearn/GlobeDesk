// Start view, short guide and Lite view (static checks; tests/firstload.mjs drives them in Chrome).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const html = read("index.html"), css = read("css/app.css"), ui = read("js/ui.js"), src = read("js/start-guide.js");

t("main buttons are labelled: Home, Layers, Atlas, Lite view, Help", () => {
  const ess = html.slice(html.indexOf('id="toolsEssential"'), html.indexOf('id="tools"'));
  for (const [id, label] of [["btnReset", "Home"], ["btnLayers", "Layers"], ["btnAtlas", "Atlas"], ["btnLiteToggle", "Lite view"], ["btnHelp", "Help"]]) {
    const m = ess.match(new RegExp(`<button id="${id}"[^>]*>([\\s\\S]*?)</button>`));
    assert.ok(m, id); assert.match(m[1].replace(/<[^>]+>/g, ""), new RegExp(label), id);
  }
});
t("guide markup: skippable, with sample and Atlas links and a hidden video slot", () => {
  for (const id of ["startGuide", "sgSkip", "sgNext", "sgBack", "sgSample", "sgAtlas", "sgLite", "sgVideo"]) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /id="startGuide"[^>]*hidden/);
  assert.match(html, /<script src="js\/start-guide.js"><\/script>\s*<script src="js\/ui.js">/);
});
t("ui boot starts the guide, and the sample is only loaded by ?sample=1 or the Sample button", () => {
  assert.match(ui, /GD\.startGuide\.boot\(params\)/);
  assert.match(ui, /else if \(params\.get\("sample"\)\) \{ ep = GD\.model\.sampleEpisode\(\)/);
  assert.equal((ui.match(/sampleEpisode\(\)/g) || []).length, 2, "boot (?sample=1) and the Sample button only");
});
t("Lite view hides the editing tools but keeps the globe and main buttons", () => {
  const lite = css.slice(css.indexOf("Lite view: the globe"));
  for (const sel of ["#newsdesk", ".dock-left", ".dock-right", ".dock-bottom", ".tools-overflow", "#btnRecord", "#btnExport"]) assert.ok(lite.includes("body.lite " + sel), sel);
  for (const keep of ["#btnReset", "#btnLayers", "#btnAtlas", "#btnHelp", "#btnLiteToggle", "#map"]) assert.ok(!lite.includes("body.lite " + keep), keep);
});

// Run start-guide.js against a tiny DOM stub.
function harness(search, saved) {
  const els = {}, ls = new Map(Object.entries(saved || {}));
  const mk = (id) => (els[id] = { id, hidden: id === "startGuide", disabled: false, textContent: "", innerHTML: "", title: "", dataset: {}, attrs: {}, handlers: {},
    classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, contains(c) { return this.s.has(c); }, toggle(c, on) { on ? this.s.add(c) : this.s.delete(c); } },
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(e, f) { this.handlers[e] = f; }, focus() {}, click() { if (this.handlers.click) this.handlers.click(); } });
  ["startGuide", "sgCount", "sgTitle", "sgBody", "sgLinks", "sgBack", "sgNext", "sgSkip", "sgLabel", "sgSample", "sgAtlas", "sgLite", "btnHelp", "btnLiteToggle", "btnReset", "btnLayers", "btnDemo", "btnAtlas", "layersHint"].forEach(mk);
  const body = mk("body");
  const ctx = { window: {}, console, URLSearchParams, location: { search },
    document: { body, getElementById: (id) => els[id] || null, querySelectorAll: (q) => Object.values(els).filter((e) => e.classList.contains("sg-target")) } };
  ctx.window.localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) };
  ctx.window.GD = { layersPanel: { dismissHint: () => ls.set("globedesk.layersHint", "1") } };
  vm.runInNewContext(src, ctx);
  const G = ctx.window.GD.startGuide; G.boot();
  return { G, els, ls, body };
}
t("first open shows the guide; Skip hides it and remembers; Help reopens it", () => {
  const h = harness("");
  assert.equal(h.els.startGuide.hidden, false); assert.equal(h.G.st.step, 0);
  h.els.sgSkip.click();
  assert.equal(h.els.startGuide.hidden, true); assert.equal(h.ls.get("globedesk.guide.v1"), "done");
  const again = harness("", Object.fromEntries(h.ls));
  assert.equal(again.els.startGuide.hidden, true, "not shown again after Skip");
  again.els.btnHelp.click(); assert.equal(again.els.startGuide.hidden, false);
});
t("Next walks the steps, highlights the button, and Done closes", () => {
  const h = harness("");
  h.els.sgNext.click(); assert.ok(h.els.btnReset.classList.contains("sg-target"));
  while (!h.els.startGuide.hidden) h.els.sgNext.click();
  assert.equal(h.ls.get("globedesk.guide.v1"), "done"); assert.ok(!h.els.btnReset.classList.contains("sg-target"));
});
t("?lite=1 turns Lite view on and remembers it; ?lite=0 turns it off", () => {
  const h = harness("?lite=1");
  assert.ok(h.body.classList.contains("lite")); assert.equal(h.ls.get("globedesk.lite"), "1"); assert.equal(h.els.btnLiteToggle.textContent, "Full view");
  const kept = harness("", { "globedesk.lite": "1" }); assert.ok(kept.body.classList.contains("lite"));
  const off = harness("?lite=0", { "globedesk.lite": "1" }); assert.ok(!off.body.classList.contains("lite"));
});
t("a direct link (?sample=1) does not pop the guide", () => {
  assert.equal(harness("?sample=1").els.startGuide.hidden, true);
});
console.log(`${n} start guide tests ok`);
