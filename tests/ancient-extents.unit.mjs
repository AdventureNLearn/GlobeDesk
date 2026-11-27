// Ancient World polity outlines (Cliopatria subset, CC BY 4.0): approved attribution word for word, licence link,
// change note, approximate flag, size budget, file integrity, and the layer's per-year filter. Pure Node.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { validateAtlas, extentsRules, EXTENTS_ATTRIBUTION, EXTENTS_MAX_BYTES } from "../tools/atlas/validate.mjs";
import { JR } from "../tools/atlas/lib.mjs";
const require = createRequire(import.meta.url);
const Layer = require("../js/atlas/ancient-layer.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const idx = JR("data/atlas/ancient/extents-index.json");
const sources = JR("atlas/packs/core/sources.json").sources;
const ctx = { sourceById: new Map(sources.map((s) => [s.id, s])) };
const c = { window: {} }; vm.createContext(c);
vm.runInContext(readFileSync(new URL("../js/atlas/ancient-extents-data.js", import.meta.url), "utf8"), c);
const FC = c.window.GD.ancientExtents;

t("the whole atlas validates (extents included)", () => assert.deepEqual(validateAtlas(), []));
t("approved attribution, word for word, in the index, the data file and the source registry", () => {
  assert.equal(EXTENTS_ATTRIBUTION, "Polity borders: Cliopatria, Seshat Global History Databank (https://github.com/Seshat-Global-History-Databank/cliopatria), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Subset; borders simplified and approximate; changes by GlobeDesk.");
  assert.equal(idx.attribution, EXTENTS_ATTRIBUTION); assert.equal(FC.credit, EXTENTS_ATTRIBUTION);
  const s = ctx.sourceById.get("cliopatria");
  assert.equal(s.attribution, EXTENTS_ATTRIBUTION); assert.equal(s.license_url, "https://creativecommons.org/licenses/by/4.0/"); assert.match(s.license, /CC BY 4\.0/);
  assert.match(s.license, /Authors \[UNKNOWN\]/);
});
t("changes noted, borders approximate, pinned commit, under the 2 MiB layer budget", () => {
  assert.ok(idx.changes.length > 20); assert.equal(idx.approximate, true); assert.equal(FC.approximate, true);
  assert.equal(idx.source.commit, "04b4e06bb4cce4f4834a057efbd23d4453619256");
  assert.ok(idx.bytes < EXTENTS_MAX_BYTES, String(idx.bytes));
  assert.equal(FC.features.length, idx.feature_count);
  assert.deepEqual([...new Set(FC.features.map((f) => Object.keys(f.properties).sort().join()))], ["from,name,to,wikidata,year"]);
});
t("rules: a reworded attribution, a missing approximate flag and a changed file each fail", () => {
  const a = structuredClone(idx); a.attribution = "Cliopatria, CC BY"; assert.ok(extentsRules("x", a, ctx).some((x) => /word for word/.test(x)));
  const b = structuredClone(idx); b.approximate = false; assert.ok(extentsRules("x", b, ctx).some((x) => /approximate/.test(x)));
  const d = structuredClone(idx); d.sha256 = "0".repeat(64); assert.ok(extentsRules("x", d, ctx).some((x) => /changed since/.test(x)));
});
t("layer: one snapshot year at a time, every feature flagged approximate; off by default", () => {
  assert.equal(Layer.st.outlines, false);
  idx.years.forEach((y) => assert.equal(Layer.outlinesFor(FC, y.year).features.length, y.polities, String(y.year)));
  assert.ok(Layer.outlinesFor(FC, -500).features.every((f) => f.properties.approximate === true));
  assert.equal(Layer.outlinesFor(FC, -9600).features.length, 0, "nothing before Cliopatria's coverage");
  assert.equal(Layer.EXT_FILE, idx.file);
});
console.log(`${n} ancient extents tests ok`);
