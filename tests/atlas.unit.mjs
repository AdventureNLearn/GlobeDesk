import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { validateSchema } from "./jsonschema-lite.mjs";
import { OPTIONS, size } from "../tools/atlas/sizing.mjs";
const require = createRequire(import.meta.url);
const J = (p) => JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };

const objSchema = J("schema/globedesk-object.schema.json");
const priceSchema = J("schema/globedesk-prices.schema.json");
const kit = J("data/atlas/objects/bag-solar-kit.json");
const regions = readdirSync(new URL("../data/atlas/prices/", import.meta.url)).map((f) => f.replace(".json", ""));
const prices = Object.fromEntries(regions.map((r) => [r, J(`data/atlas/prices/${r}.json`)]));

const errs = (r) => (Array.isArray(r) ? r : (r && r.errors) || []);
t("object record matches schema", () => assert.deepEqual(errs(validateSchema(objSchema, kit)), []));
t("every price file matches schema", () => regions.forEach((r) => assert.deepEqual(errs(validateSchema(priceSchema, prices[r])), [], r)));
t("schema rejects a checked price with no source", () => {
  const bad = { schema: "globedesk.prices/1", region: "US", currency: "USD", rows: [{ object: "bag-solar-kit", part: "mppt", status: "checked", low: 1 }] };
  assert.ok(errs(validateSchema(priceSchema, bad)).length > 0);
});
t("record options equal the sizing math", () => OPTIONS.forEach((o) => {
  const s = size(o); const rec = kit.options.find((x) => x.id === o.id);
  assert.equal(rec.wh, s.wh); assert.equal(rec.derived.main_fuse_a, s.fuseA); assert.equal(rec.derived.wire_awg, s.gaugeAWG);
}));
t("sizing: 4S1P 6 Ah is 76.8 Wh and carry-on", () => { const s = size(OPTIONS[0]); assert.equal(s.wh, 76.8); assert.match(s.air, /carry-on OK/); });
t("sizing: fuse >= 1.25x load and per-cell C <= 3", () => OPTIONS.map((o) => size(o)).forEach((s) => { assert.ok(s.fuseA >= s.loadA * 1.25); assert.ok(s.perCellC <= 3); }));
t("sizing: S kit charge limit is the cell 1C (6 A)", () => assert.equal(size(OPTIONS[0]).chargeLimitA, 6));
t("every part cites only known citation ids", () => { const ids = new Set(kit.citations.map((c) => c.id)); kit.parts.concat(kit.safety).forEach((p) => p.citations.forEach((c) => assert.ok(ids.has(c), c))); });
t("every price row points at a real part (or the prebuilt reference)", () => { const ids = new Set(kit.parts.map((p) => p.id).concat("ref-prebuilt-pack")); regions.forEach((r) => prices[r].rows.forEach((row) => assert.ok(ids.has(row.part), r + ":" + row.part))); });
t("pricing: region falls back to country, rejects junk", () => {
  const P = require("../js/atlas/pricing.js");
  assert.equal(P.resolve("us-fl", regions), "US"); assert.equal(P.resolve("ZZ", regions), null); assert.equal(P.resolve("1 Main St", regions), null);
});
t("pricing: unknown parts keep the total partial", () => {
  const P = require("../js/atlas/pricing.js"); const q = P.quote(kit, "S", prices.US);
  assert.equal(q.complete, false); assert.ok(q.unknownParts.includes("bms"));
  assert.equal(q.lines.find((l) => l.part === "cell").low, 21.64);
  assert.equal(q.lines.find((l) => l.part === "inverter").status, "not-needed");
});
t("model: S box holds 4 cells in a row", () => { const M = require("../js/atlas/models/bag-solar-kit.js"); const L = M.layout(1); assert.equal(L.cells.length, 4); assert.ok(L.box.w > 4 * 32.2); });
t("hygiene: no home paths, emails or key-like strings", () => {
  const files = ["data/atlas/objects/bag-solar-kit.json", ...regions.map((r) => `data/atlas/prices/${r}.json`), "data/atlas/chemistry/lifepo4-vs-nmc.json"];
  files.forEach((f) => { const s = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.doesNotMatch(s, /\/home\/|C:\\\\Users|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|api[_-]?key|secret|token/i, f); });
});
console.log(`${n} passed`);
