// Mobile first run: playback and Data year only claim what they do. No network, no browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const ctx = { console, Date, Math, JSON, URL, URLSearchParams };
ctx.window = ctx; ctx.GD = {}; ctx.window.GD = ctx.GD;
vm.createContext(ctx);
for (const f of ["js/model.js", "js/year-clock.js"]) vm.runInContext(read(f), ctx);
const { model, yearClock } = ctx.GD;
const html = read("index.html"), ui = read("js/ui.js"), layers = read("js/layers.js");

t("a blank episode has no timeline, so the transport hides its clock", () => {
  assert.equal(model.hasTimeline(model.blankEpisode()), false);
  assert.match(html, /id="tlEmpty"[^>]*hidden/);
  assert.match(ui, /GD\.model\.hasTimeline\(S\.episode\)/);
});
t("a camera move, a caption or a written card makes a timeline", () => {
  const a = model.blankEpisode(); a.stories[0].camera.push({ id: "k", at: 0, center: [0, 0], zoom: 2 });
  const b = model.blankEpisode(); b.stories[0].captions.push({ start: 0, end: 2, text: "x" });
  const c = model.blankEpisode(); c.stories[0].cards[0].title = "Suez Canal";
  for (const ep of [a, b, c]) assert.equal(model.hasTimeline(ep), true);
});
t("with dated imagery off the chip says IMAGERY OFF, never RECORDED", () => {
  assert.equal(yearClock.chipText({ kind: "recorded", datedOff: true }), "IMAGERY OFF");
  assert.equal(yearClock.chipText({ kind: "recorded" }), "RECORDED");
  assert.match(layers, /label: "EOX 2016 · dated imagery off",[\s\S]{0,500}datedOff: true/);
});
t("the Data year slider is disabled while nothing follows the year", () => {
  assert.match(ui, /const idle = !!\(st && st\.datedOff\) && !gisFollowsYear\(\);/);
  assert.match(ui, /sl\.disabled = idle;/);
});
console.log(`mobile-first-run: ${n} passed`);
