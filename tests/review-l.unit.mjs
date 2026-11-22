// Unit checks for Review L flags folded into v1.2: load notice, town-label
// collision, layout-shots output dir, and the stage-header CSS offset.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

const ctx = { window: {}, console, Date };
ctx.window = ctx;
ctx.GD = {};
ctx.window.GD = ctx.GD;
ctx.maplibregl = {
  Map: function () {},
  Marker: function () {},
  NavigationControl: function () {}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js", "globe.js"), "utf8"), ctx);
const globe = ctx.window.GD.globe;

t("town labels hide below zoom 6 and skip points within 40 px of the pin or an earlier label", () => {
  assert.equal(globe.TOWN_LABEL_MIN_ZOOM, 6);
  assert.equal(globe.TOWN_LABEL_MIN_PX, 40);
  assert.equal(globe.pointsTooClose({ x: 0, y: 0 }, { x: 39, y: 0 }, 40), true);
  assert.equal(globe.pointsTooClose({ x: 0, y: 0 }, { x: 40, y: 0 }, 40), false);
  const pin = { x: 100, y: 100 };
  const nearPin = { x: 120, y: 105, name: "near" };
  const far = { x: 200, y: 200, name: "far" };
  const closeToFar = { x: 210, y: 200, name: "close" };
  const picked = globe.pickTownLabelPoints([nearPin, far, closeToFar], [pin], 40);
  assert.equal(picked.map((p) => p.name).join(","), "far");
});

const uiSrc = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");
t("loadEpisode keeps the unknown-id warning on the same toast as the load reason", () => {
  const start = uiSrc.indexOf("function formatLoadNotice");
  const end = uiSrc.indexOf("function loadEpisode");
  assert.ok(start >= 0 && end > start);
  const noticeCtx = { console };
  vm.createContext(noticeCtx);
  vm.runInContext(uiSrc.slice(start, end) + "; this.formatLoadNotice = formatLoadNotice;", noticeCtx);
  const fn = noticeCtx.formatLoadNotice;
  assert.equal(fn("Washington, DC sample loaded.", ["story.gisOverlayIds[0] is not in the GIS registry"]),
    "Washington, DC sample loaded. · Note: story.gisOverlayIds[0] is not in the GIS registry");
  assert.equal(fn("Opened from the archive.", ["a", "b"]),
    "Opened from the archive. · Note: a (2 warnings)");
  assert.equal(fn("Loaded episode.", []), "Loaded episode.");
  assert.equal(fn("", ["only"]), "Note: only");
  const loadBody = uiSrc.slice(end, uiSrc.indexOf("function rememberSoon"));
  assert.equal(/if \(why\) toast\(why\)/.test(loadBody), false);
  assert.match(loadBody, /formatLoadNotice\(why, warns\)/);
});

t("map controls sit below the in-stage header band, not only the 16:9 safe-top", () => {
  const css = fs.readFileSync(path.join(root, "css", "app.css"), "utf8");
  assert.match(css, /max\(\s*var\(--safe-top[^)]*\),\s*var\(--stage-header[^)]*\)\s*\)/);
  assert.match(uiSrc, /--stage-header/);
  assert.match(uiSrc, /headerHeightPct/);
});

t("layout-shots does not default to the sibling globedesk-shots folder", () => {
  const src = fs.readFileSync(path.join(root, "tests", "layout-shots.mjs"), "utf8");
  assert.equal(src.includes('path.resolve(root, "..", "globedesk-shots")'), false);
  assert.match(src, /SHOT_DIR/);
  assert.match(src, /mkdtempSync/);
  assert.match(src, /zoom \+ button clipped under stage title band/);
});

console.log(n + " review-l tests ok");
