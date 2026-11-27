// First-run flyover: built only from cited stories already in the repo; dates drive the pins. No network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
let n = 0;
const J = (v) => JSON.parse(JSON.stringify(v));
const eq = (a, b, m) => assert.deepEqual(J(a), J(b), m);
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const ctx = { console, Date, Math, JSON, URL, URLSearchParams };
ctx.window = ctx; ctx.GD = {}; ctx.window.GD = ctx.GD;
vm.createContext(ctx);
for (const f of ["js/events-model.js", "js/model.js", "js/flyover.js"]) vm.runInContext(read(f), ctx);
const { model, flyover, events } = ctx.GD;
const topics = JSON.parse(read(flyover.PATH));
const ep = flyover.build(topics, null);
const html = read("index.html"), ui = read("js/ui.js");

t("builds four stops in date order from the bundled topics file", () => {
  assert.ok(ep, "built");
  assert.equal(ep.stories.length, 4);
  const d = ep.stories.map((s) => s.date);
  eq(d.slice().sort(), d);
  assert.equal(model.hasTimeline(ep), true);
  eq(model.validate(ep), []);
});
t("every stop keeps its source text exactly and cites a verified https source", () => {
  ep.stories.forEach((s) => {
    const src = topics.stories.find((x) => x.id === s.id);
    for (const k of ["title", "summary", "date", "captions", "cards", "sources", "camera", "location"]) eq(s[k], src[k], s.id + " " + k);
    assert.ok(s.sources.some((x) => x.status === "verified" && /^https:\/\//.test(x.url)), s.id);
  });
});
t("each story's event window is its own date, so later pins stay hidden", () => {
  const feats = ep.eventLayers[0].features;
  assert.equal(feats.length, 4);
  ep.stories.forEach((s, i) => {
    eq(s.eventWindow, { start: s.date, end: s.date });
    const clock = events.parseTime(s.eventWindow.start);
    const shown = feats.filter((f) => events.visibleAt(f, clock)).map((f) => f.properties.storyId);
    eq(shown, ep.stories.slice(0, i + 1).map((x) => x.id), s.id);
  });
});
t("a missing stop means no flyover, not a made-up one", () => {
  const cut = JSON.parse(JSON.stringify(topics));
  cut.stories = cut.stories.filter((s) => s.id !== flyover.STOPS[1]);
  assert.equal(flyover.build(cut, null), null);
});
t("offered only for an untouched blank episode", () => {
  assert.equal(flyover.offerable(model.blankEpisode()), true);
  const typed = model.blankEpisode(); typed.stories[0].title = "My story";
  assert.equal(flyover.offerable(typed), false);
  assert.equal(flyover.offerable(ep), false);
});
t("the transport shows the flyover button, the years, the now-playing line and the event clock", () => {
  for (const id of ["btnFlyover", "segYears", "nowPlaying", "evClockNow"]) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /<script src="js\/playback.js"><\/script>\s*<script src="js\/flyover.js"><\/script>/);
  assert.match(ui, /GD\.flyover\.play\(\)/);
});
console.log(`flyover: ${n} passed`);
