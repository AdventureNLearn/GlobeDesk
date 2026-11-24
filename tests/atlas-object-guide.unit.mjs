// Proves a user-made object copied from the bag solar kit sample can be
// validated and that its parametric layout is loadable. The fixture is not a
// shipped catalog entry.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateSchema } from "./jsonschema-lite.mjs";
import { objectRules, priceRules, validateRecordFile } from "../tools/atlas/validate.mjs";
import { JR } from "../tools/atlas/lib.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIX = path.join(ROOT, "tests/fixtures/atlas");
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const errs = (r) => (Array.isArray(r) ? r : (r && r.errors) || []);

const lamp = JSON.parse(readFileSync(path.join(FIX, "sample-lamp.json"), "utf8"));
const prices = JSON.parse(readFileSync(path.join(FIX, "sample-lamp-prices-US.json"), "utf8"));
const model = require("./fixtures/atlas/sample-lamp-model.js");

t("sample-lamp matches the object schema and objectRules", () => {
  assert.deepEqual(errs(validateSchema(JR("schema/globedesk-object.schema.json"), lamp)), []);
  assert.deepEqual(objectRules("tests/fixtures/atlas/sample-lamp.json", lamp), []);
});

t("sample-lamp prices use status unknown and match the prices schema", () => {
  assert.deepEqual(errs(validateSchema(JR("schema/globedesk-prices.schema.json"), prices)), []);
  assert.deepEqual(priceRules("tests/fixtures/atlas/sample-lamp-prices-US.json", prices), []);
  assert.ok(prices.rows.length >= 1);
  prices.rows.forEach((row) => {
    assert.equal(row.object, "sample-lamp");
    assert.equal(row.status, "unknown");
    assert.equal(row.low, undefined);
    assert.equal(row.high, undefined);
  });
});

t("validate.mjs accepts the fixture on the single-file path", () => {
  assert.deepEqual(validateRecordFile("tests/fixtures/atlas/sample-lamp.json"), []);
  assert.deepEqual(validateRecordFile("tests/fixtures/atlas/sample-lamp-prices-US.json"), []);
  const r = spawnSync(process.execPath, ["tools/atlas/validate.mjs", "tests/fixtures/atlas/sample-lamp.json"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /record valid/);
});

t("validate.mjs rejects a broken user-made object", () => {
  const bad = { ...lamp, options: [] };
  assert.ok(objectRules("bad.json", bad).length > 0);
});

t("sample-lamp layout() returns the workshop shape and registers as sample-lamp", () => {
  const L = model.layout(1);
  assert.equal(L.units, "mm");
  assert.ok(Array.isArray(L.cells) && L.cells.length >= 1);
  L.cells.forEach((c) => {
    assert.equal(typeof c.d, "number");
    assert.equal(typeof c.h, "number");
    assert.equal(typeof c.x, "number");
    assert.equal(typeof c.y, "number");
  });
  assert.equal(typeof L.box.w, "number");
  assert.equal(typeof L.box.h, "number");
  assert.equal(typeof L.box.d, "number");
  assert.equal(typeof L.inner.w, "number");
  globalThis.GD_ATLAS_MODELS = Object.assign(globalThis.GD_ATLAS_MODELS || {}, { "sample-lamp": model });
  assert.equal(typeof globalThis.GD_ATLAS_MODELS["sample-lamp"].layout, "function");
  assert.equal(globalThis.GD_ATLAS_MODELS["sample-lamp"].layout(1).cells.length, L.cells.length);
});

t("3D workshop looks up the selected object's model, not only bag-solar-kit", () => {
  const src = readFileSync(path.join(ROOT, "js/atlas/atlas-view.js"), "utf8");
  assert.ok(!/atlas3d\.show\(\s*box,\s*"bag-solar-kit"/.test(src));
  assert.match(src, /atlas3d\.show\(\s*box,\s*modelId/);
  assert.match(src, /kit\.model && kit\.model\.generator/);
  assert.match(src, /objectTab/);
  assert.match(src, /kit\.facts && typeof kit\.facts === "object"/);
  assert.match(src, /o\.derived && typeof o\.derived === "object"/);
});

console.log(n + " tests");
