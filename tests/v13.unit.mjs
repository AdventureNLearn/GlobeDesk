// Unit tests for v1.3: Layers panel, frame-accurate export helpers, default title, version.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
let n = 0;
const J = (v) => JSON.parse(JSON.stringify(v)); // vm results come from another realm
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

function load(files) {
  const win = { GD: {}, localStorage: { getItem: () => null, setItem() {} }, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  win.window = win;
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, readyState: "loading", createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
  win.navigator = { userAgent: "node" };
  win.console = console;
  const ctx = vm.createContext(win);
  for (const f of files) vm.runInContext(read(...f.split("/")), ctx, { filename: f });
  return win.GD;
}

const GD = load(["js/layers.js", "js/layers-panel.js", "js/frame-export.js", "js/recorder.js"]);
const LP = GD.layersPanel, FX = GD.frameExport, L = GD.layers;

await t("Layers button sits in the main toolbar with a tooltip, L shortcut and a hidden first-run hint", () => {
  const html = read("index.html");
  const header = html.slice(html.indexOf('<header class="topbar"'), html.indexOf("</header>"));
  const ess = header.slice(header.indexOf('id="toolsEssential"'), header.indexOf('id="tools"'));
  assert.match(ess, /id="btnLayers"/);
  assert.match(ess, /aria-keyshortcuts="l"/);
  assert.match(ess, /aria-controls="layersPanel"/);
  assert.match(ess, /id="layersHint"[^>]*hidden/);
  assert.match(html, /<dialog id="layersPanel"/);
  assert.match(html, /id="layersShowAll"/);
  assert.match(html, /id="layersHideAll"/);
  assert.match(html, /js\/layers-panel\.js/);
  assert.doesNotMatch(html.slice(html.indexOf('<dialog id="layersPanel"')), /\sstyle="/, "no inline styles (CSP)");
  assert.match(read("js", "ui.js"), /e\.key === "l" \|\| e\.key === "L"/);
});

await t("Every base map and overlay in the registry has a plain description and a legend", () => {
  for (const b of L.BASES) assert.ok(LP.BASE_INFO[b.id] && LP.BASE_INFO[b.id].desc, "base " + b.id);
  for (const o of L.OVERLAYS) assert.ok(LP.OVERLAY_INFO[o.id] && LP.OVERLAY_INFO[o.id].desc && LP.OVERLAY_INFO[o.id].legend, "overlay " + o.id);
  const m = LP.model(L, { baseId: "offline", overlays: { countries: true } }, [{ id: "g1", label: "GIS sample", on: false }]);
  assert.equal(m.bases.length, L.BASES.length);
  assert.equal(m.overlays.length, L.OVERLAYS.length);
  assert.equal(m.bases.find((b) => b.id === "offline").on, true);
  assert.equal(m.overlays.find((o) => o.id === "countries").on, true);
  assert.equal(m.gis[0].label, "GIS sample");
});

await t("Show all turns every usable overlay on and keeps the satellite base; Hide all turns all off", () => {
  const all = LP.showAllPlan(L, {}, "sat-hybrid");
  assert.equal(all.bluemarble, false, "Blue Marble would replace the satellite base");
  assert.equal(all.countries, true);
  for (const o of L.OVERLAYS) if (o.status === "unknown") assert.equal(all[o.id], false);
  const off = LP.showAllPlan(L, {}, "offline");
  assert.equal(off.bluemarble, true);
  const none = LP.hideAllPlan(L, all);
  for (const o of L.OVERLAYS) assert.equal(none[o.id], false);
});

await t("Layers panel credits keep only https links and escape all other markup", () => {
  const c = LP.creditHtml('Sat: <a href="https://s2maps.eu" target="_blank">EOX</a> & <img src=x onerror=alert(1)> <a href="javascript:alert(1)">bad</a>');
  assert.match(c, /<a href="https:\/\/s2maps\.eu" target="_blank" rel="noopener noreferrer">EOX<\/a>/);
  assert.doesNotMatch(c, /<img|javascript:/);
  assert.match(c, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(c, /&amp;/);
  for (const o of L.BASES.concat(L.OVERLAYS)) {
    const h = LP.creditHtml(o.credit || "");
    assert.doesNotMatch(h.replace(/<a href="https:[^"]*" target="_blank" rel="noopener noreferrer">[^<]*<\/a>/g, ""), /<[a-z]/i, o.id);
  }
  assert.match(read("js", "layers-panel.js"), /creditHtml\(b\.credit\)/);
  assert.match(read("js", "layers-panel.js"), /creditHtml\(o\.credit\)/);
});

await t("framePlan puts frame n at exactly n / fps and caps length", () => {
  const p = FX.framePlan(3, 30, 0);
  assert.equal(p.count, 90);
  assert.equal(p.ts(45), 1.5);
  assert.equal(FX.framePlan(10, 30, 5).at(30), 6);
  assert.equal(FX.clampFps(500), 60);
  assert.equal(FX.clampFps(0), 30);
  assert.equal(FX.framePlan(99999, 30).count, FX.MAX_SECONDS * 30);
});

await t("cameraAtTime is deterministic: starts at home, eases, and lands on each keyframe", () => {
  const ep = { stories: [{ durationSec: 10, camera: [{ at: 0, durationSec: 4, center: [-77, 38.9], zoom: 10, pitch: 40, bearing: 20 }] }] };
  const home = { center: [0, 0], zoom: 1, pitch: 0, bearing: 0 };
  assert.deepEqual(J(FX.cameraAtTime(ep, 0, home).center), [0, 0]);
  const mid = FX.cameraAtTime(ep, 2, home);
  assert.ok(mid.zoom > 1 && mid.zoom < 10);
  assert.deepEqual(J(FX.cameraAtTime(ep, 2, home)), J(mid), "same time, same camera");
  const end = FX.cameraAtTime(ep, 6, home);
  assert.deepEqual(J(end.center), [-77, 38.9]);
  assert.equal(end.zoom, 10);
});

await t("choosePath prefers WebCodecs MP4, then local ffmpeg, then WebM; 16:9 and 9:16 sizes", () => {
  assert.equal(FX.choosePath({ h264: true, aac: true }, true).path, "mp4");
  assert.equal(FX.choosePath({ h264: true, aac: false }, false).path, "mp4");
  assert.equal(FX.choosePath({ h264: true, aac: false, ffmpeg: true, webmVideo: true }, true).path, "ffmpeg");
  assert.equal(FX.choosePath({ webmVideo: true }, true).path, "webm");
  assert.equal(FX.choosePath({ mediaRecorder: true }, false).path, "webm-realtime");
  assert.equal(FX.choosePath({}, false).path, "none");
  assert.deepEqual(J(FX.sizeFor("16:9")), [1920, 1080]);
  assert.deepEqual(J(FX.sizeFor("9:16")), [1080, 1920]);
  const fe = read("js", "frame-export.js");
  assert.doesNotMatch(fe, /@ffmpeg\/|ffmpeg-core|createFFmpeg|new FFmpeg/);
  assert.ok(!fs.readdirSync(path.join(root, "vendor")).some((f) => /ffmpeg/i.test(f)), "no ffmpeg.wasm vendored");
  const mb = read("vendor", "mediabunny-1.66.2.min.js");
  assert.match(mb.slice(0, 2000), /Mozilla Public License|MPL/, "Mediabunny keeps its licence header");
});

await t("Default title replaces [UNKNOWN] on first load", () => {
  const dt = GD.recorder.displayTitle;
  assert.equal(dt({ title: "[UNKNOWN]", stories: [{ title: "[UNKNOWN]" }] }, { title: "[UNKNOWN]" }), "Welcome to GlobeDesk");
  assert.equal(dt({ title: "Sample Show" }, { title: "[UNKNOWN]" }), "Sample Show");
  assert.equal(dt({ title: "Sample Show" }, { title: "Sample story" }), "Sample story");
  assert.equal(dt(null, null), "Welcome to GlobeDesk");
});

await t("Version is v1.4.0 Atlas in the app, package.json and the CHANGELOG", () => {
  assert.match(read("js", "version.js"), /APP\s*[:=]\s*"1\.4\.0"/);
  assert.doesNotMatch(read("js", "version.js"), /1\.4\.0-draft|not released/);
  assert.equal(JSON.parse(read("package.json")).version, "1.4.0");
  assert.match(read("index.html"), /v1\.4\.0 · Atlas/);
  assert.match(read("CHANGELOG.md"), /v1\.4\.0[^\n]*Atlas/);
  assert.match(read("CHANGELOG.md"), /1\.3\.1/);
});

await t("Open-source pages exist and Help links to Contribute and Fork it on GitHub", () => {
  for (const f of ["CONTRIBUTING.md", "FORKING.md", "CODE_OF_CONDUCT.md", "SECURITY.md", ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/ISSUE_TEMPLATE/bug_report.md", ".github/ISSUE_TEMPLATE/layer_data_proposal.md", ".github/ISSUE_TEMPLATE/feature_request.md"]) {
    assert.ok(fs.existsSync(path.join(root, f)), f);
  }
  assert.match(read("CODE_OF_CONDUCT.md"), /Contributor Covenant\]\[homepage\], version 2\.1/);
  assert.doesNotMatch(read("CODE_OF_CONDUCT.md"), /INSERT CONTACT METHOD|@[a-z0-9-]+\.[a-z]{2,}/i, "contact is GitHub only, no email");
  const readme = read("README.md");
  for (const l of ["CONTRIBUTING.md", "FORKING.md", "LICENSE", "SECURITY.md"]) assert.ok(readme.includes("](" + l + ")"), l);
  const lay = read("js", "layout.js");
  assert.match(lay, /id: "help-contribute"/);
  assert.match(lay, /id: "help-fork"/);
  assert.match(lay, /id: "help-about"/);
  assert.match(lay, /const REPO = "https:\/\/github\.com\/AdventureNLearn\/GlobeDesk";/);
  assert.match(lay, /"noopener,noreferrer"/);
  const csp = read("index.html").match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.doesNotMatch(csp, /github\.com/, "CSP unchanged: links are navigation, not fetches");
});

console.log(n + " v13 tests ok");
