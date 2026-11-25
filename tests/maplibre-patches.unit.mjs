// The vendored MapLibre 5.24.1 carries backports of two upstream fixes (see vendor/MAPLIBRE-PATCHES.md).
// A vendor update that drops them would bring back the first-load "reading 'signal'" / "reading 'bind'" errors.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const js = fs.readFileSync(path.join(root, "vendor", "maplibre-gl.js"), "utf8");
const doc = fs.readFileSync(path.join(root, "vendor", "MAPLIBRE-PATCHES.md"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
t("#8004: raster tiles transform the request before creating the AbortController", () => {
  assert.ok(js.includes('const gdReq=yield this.map._requestManager.transformRequest(i,"Tile");e.abortController=new AbortController;try{const o=yield v.getImage(gdReq,e.abortController,'));
  assert.ok(!js.includes('v.getImage(yield this.map._requestManager.transformRequest(i,"Tile"),e.abortController'));
});
t("#8004: image sources transform the request before creating the AbortController", () => {
  assert.ok(js.includes('const gdReq=yield this.map._requestManager.transformRequest(this.url,"Image");this._request=new AbortController;try{const t=yield v.getImage(gdReq,this._request);'));
});
t("#7911: a source data change reloads errored tiles as loading, not expired", () => {
  assert.ok(js.includes('this._reloadTile(i,"errored"===o.state?"loading":"expired")'));
});
t("patches are documented", () => {
  assert.match(doc, /#8004/); assert.match(doc, /#7911/);
});
console.log(`${n} maplibre patch tests ok`);
