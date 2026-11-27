// Calm first screen on phones: short top bar, big globe, folded news list, no auto guide,
// bells off on a first visit, no [UNKNOWN] story title, and no frog on the Desk. No browser.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import vm from "node:vm";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const html = read("index.html"), css = read("css/app.css"), ui = read("js/ui.js"), sg = read("js/start-guide.js"), bells = read("js/atlas/bells-layer.js"), layout = read("js/layout.js");
const calm = css.slice(css.indexOf("/* Calm first screen on phones"), css.indexOf("/* Frosted glass panels."));

t("phone top bar hides Record, Export, aspect, Workspace, Atlas and Lite; the Menu still has them", () => {
  for (const sel of ["#btnRecord", "#btnExport", ".tools-essential .seg", "#btnViewToggle", "#btnAtlas", "#btnLiteToggle", "#layersHint"]) assert.ok(calm.includes("body.view-newsdesk:not(.lite) " + sel), sel);
  for (const keep of ["#btnMenu", "#btnReset", "#btnLayers", "#btnHelp"]) assert.ok(!calm.includes(keep), keep);
  assert.match(layout, /run: \(\) => clickId\("btnRecord"\)/);
  for (const id of ["btnViewToggle", "btnAtlas", "asp169", "asp916"]) assert.match(layout, new RegExp(`clickId\\("${id}"\\)`), id);
});
t("phone globe fills the stage area and the news list folds behind Explore stories", () => {
  assert.match(calm, /\.stage-wrap \{ height: 56vh;/);
  assert.match(calm, /\.stage \{ width: 100% !important; height: 100% !important; \}/);
  assert.match(calm, /:not\(\.nd-open\) #newsdesk > :not\(\.nd-explore\) \{ display: none !important; \}/);
  assert.match(html, /<button id="ndExplore" class="nd-explore"[^>]*aria-expanded="false"/);
});
t("the 46-step guide does not open on its own on a phone, and closes when Play starts; Help still opens it", () => {
  assert.match(sg, /!guideDone\(\) && !directLink && p\.get\("guide"\) !== "0" && !phone\) open\(0\)/);
  assert.match(sg, /on\("btnHelp", \(\) => open\(0\)\)/);
  for (const id of ["btnFlyover", "btnPlay"]) assert.match(sg, new RegExp(`on\\("${id}", \\(\\) => \\{ if \\(st\\.open\\) close\\("play"\\); \\}\\)`), id);
});
t("bells start off and only a saved choice turns them on", () => {
  assert.match(bells, /const st = \{ on: false,/);
  assert.match(bells, /st\.on = v\.on === true;/);
});
t("the rundown says Untitled story / No place set instead of [UNKNOWN]", () => {
  const ctx = { console }; ctx.window = ctx; ctx.GD = { model: { U: "[UNKNOWN]" } };
  const m = ui.match(/function shownTitle[\s\S]*?\n  function shownPlace[^\n]*\n/);
  assert.ok(m);
  vm.runInNewContext(m[0] + "; out = [shownTitle({ title: '[UNKNOWN]' }), shownPlace({ location: { name: '[UNKNOWN]' } }), shownTitle({ title: 'Suez Canal' })];", ctx);
  assert.deepEqual(Array.from(ctx.out), ["Untitled story", "No place set", "Suez Canal"]);
});
t("no frog character anywhere on the Desk or its first run", () => {
  const files = ["index.html", "css/app.css"];
  const walk = (d) => readdirSync(new URL("../" + d, import.meta.url)).forEach((f) => {
    const p = d + "/" + f; if (statSync(new URL("../" + p, import.meta.url)).isDirectory()) walk(p); else if (/\.(js|css|html|json)$/.test(f)) files.push(p);
  });
  walk("js"); walk("newsdesk"); walk("desks");
  for (const f of files) assert.doesNotMatch(read(f), /frog/i, f);
});
t("the live site's Ask this site launcher gets its own strip: phone bottom bar, desktop news-column footer; open panel untouched", () => {
  const ask = css.slice(css.indexOf('/* The live site adds its own "Ask this site"'), css.indexOf("/* Frosted glass panels."));
  assert.match(ask, /body:has\(> #sc-root\) \{ padding-bottom: calc\(64px/);
  assert.match(ask, /body:has\(> #sc-root\)::after \{ content: ""; position: fixed;[^}]*height: calc\(64px[^}]*z-index: 54;/);
  assert.match(ask, /#newsdesk::after \{ content: ""; position: sticky; bottom: 0; flex: 0 0 64px;/);
  assert.equal((ask.match(/#sc-root:not\(\.sc-open\) \{ bottom:/g) || []).length, 2);
  assert.doesNotMatch(ask, /start-guide|startGuide|\.sc-panel/);
});
console.log(`calm-first-screen: ${n} passed`);
