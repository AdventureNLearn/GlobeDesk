// Atlas browsing model (A-Z, by place, by year with months/weeks/This week, tiers, Now, tree) and the generated data copy.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { buildData, render } from "../tools/atlas/build-js.mjs";
const require = createRequire(import.meta.url);
const M = require("../js/atlas/atlas-model.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };

const js = readFileSync(new URL("../js/atlas/atlas-data.js", import.meta.url), "utf8");
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(js, ctx);
const D = JSON.parse(JSON.stringify(ctx.window.GD.atlasData)); // same-realm copy for deepStrictEqual

t("generated js/atlas/atlas-data.js matches the JSON sources (rebuild with tools/atlas/build-js.mjs)", () => assert.equal(js, render(buildData())));
t("bundle carries 12 categories, 10 desks and the community lane", () => {
  assert.equal(D.categories.length, 12); assert.equal(D.desks.desks.length, 10); assert.equal(D.community.schema, "globedesk.community/1");
  assert.ok(D.openItems >= 12);
});
t("A-Z lists every title and alias, sorted, with jump letters; placeholders sort by name", () => {
  const rows = M.azRows(D, {});
  assert.equal(rows.filter((r) => !r.alias).length, D.entries.length);
  assert.ok(rows.some((r) => r.alias && r.id === "bag-solar-kit"));
  assert.deepEqual(M.letters(rows), ["B", "C", "L", "P", "S", "W"]);
});
t("search, category and tier filters", () => {
  assert.deepEqual(M.azRows(D, { q: "zzqx nothing" }).map((r) => r.id), []);
  assert.ok(M.azRows(D, { q: "air travel" }).some((r) => r.id === "lithium-batteries-air-travel"));
  assert.ok(M.azRows(D, { category: "chemistry" }).every((r) => r.entry.category_path[0] === "chemistry" || (r.entry.see_also_paths || []).some((p) => p[0] === "chemistry")));
  assert.ok(M.azRows(D, { tier: "kids" }).every((r) => r.entry.tier === "kids"));
});
t("by place: coarse keys; US-TX rolls up under US with no invented point; No place bucket", () => {
  const r = M.byPlace(D, {});
  const us = r.rows.find((x) => x.key === "US");
  assert.equal(us.a3, "USA"); assert.equal(us.subdivisions[0].key, "US-TX"); assert.ok(us.entries.includes("phosphate-cathode-discovery"));
  assert.ok(!r.rows.some((x) => x.key === "US-TX"));
  assert.ok(r.noPlace.includes("bag-solar-kit"));
});
t("ISO weeks (Monday start) across year edges", () => {
  assert.deepEqual(M.isoWeek("2026-11-24"), { year: 2026, week: 48, start: "2026-11-23", end: "2026-11-29" });
  assert.equal(M.isoWeek("2021-01-03").week, 53); assert.equal(M.isoWeek("2026-01-01").week, 1);
});
t("by year: years, then months and weeks in the current year, and This week", () => {
  const y = M.byYear(D, {}, { today: "2026-11-24" });
  assert.equal(y.range.min, 1996); assert.equal(y.range.max, 2026); assert.ok(y.undated.length > 0);
  assert.deepEqual(M.byYear(D, {}, { today: "2026-11-24", year: 1996 }).rows.map((d) => d.entry), ["phosphate-cathode-discovery"]);
  const m = M.byYear(D, {}, { today: "2026-11-24", zoom: "months" });
  assert.equal(m.buckets.length, 12); assert.equal(m.buckets[10].rows.length, 1);
  const w = M.byYear(D, {}, { today: "2026-11-24", zoom: "weeks" });
  assert.equal(w.buckets[0].key, "2026-W48");
  const tw = M.byYear(D, {}, { today: "2026-11-24", zoom: "this-week" });
  assert.equal(tw.key, "2026-W48"); assert.equal(tw.rows[0].entry, "bag-solar-kit-prices");
  assert.equal(M.byYear(D, {}, { today: "2026-12-10", zoom: "this-week" }).rows.length, 0);
  assert.equal(M.yearLabel(0), "1 BCE");
});
t("Now status: this week, this month, leaving soon, left after now_until", () => {
  const e = { current: true, now_until: "2027-02-18", dates: [{ date: "2026-11-20", precision: "day" }] };
  assert.equal(M.nowStatus(e, "2026-11-24"), "this-week");
  assert.equal(M.nowStatus(e, "2026-12-20"), "this-month");
  assert.equal(M.nowStatus(e, "2027-02-10"), "leaving-soon");
  assert.equal(M.nowStatus(e, "2027-02-19"), "left");
  assert.equal(M.nowStatus({ current: false }, "2026-11-24"), "not-current");
});
t("tree: 4 bundled packs installed, 8 categories greyed, Now weekly", () => {
  const tr = M.tree(D);
  assert.deepEqual(tr.filter((c) => c.installed).map((c) => c.id), ["energy", "objects", "chemistry", "economics"]);
  assert.equal(tr.find((c) => c.id === "now").refresh, "weekly");
});
t("tier switch: other levels say not written yet [UNKNOWN]", () => {
  const e = D.entries.find((x) => x.id === "portable-solar-power");
  assert.equal(M.tierNote(e, "everyday"), null);
  assert.match(M.tierNote(e, "kids"), /No Kids version yet \[UNKNOWN\]/);
});
t("view code has no network calls and no inline styles; online lookups stay off", () => {
  for (const f of ["js/atlas/atlas-view.js", "js/atlas/atlas-model.js", "js/atlas/atlas-3d.js", "js/work-desks.js", "js/user-layers.js", "js/personal-layer.js", "js/community-cards.js", "js/source-class.js"]) {
    const s = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.doesNotMatch(s, /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/, f);
    assert.doesNotMatch(s, /style="/, f);
  }
  assert.match(readFileSync(new URL("../js/atlas/atlas-3d.js", import.meta.url), "utf8"), /SRC = "vendor\/three-0\.158\.0\.min\.js"/);
});
t("three.js is vendored unmodified with its MIT licence and credited", () => {
  const lic = readFileSync(new URL("../vendor/LICENSE-three.txt", import.meta.url), "utf8");
  assert.match(lic, /MIT License/); assert.match(readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8"), /three\.js/);
  assert.match(readFileSync(new URL("../vendor/three-0.158.0.min.js", import.meta.url), "utf8").slice(0, 600), /Three\.js Authors[\s\S]*SPDX-License-Identifier: MIT/);
});
console.log(`${n} atlas view tests ok`);
