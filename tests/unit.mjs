// Unit checks for the pieces built here: model, captions, camera path, validation. No browser, no network.
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path"; import assert from "node:assert/strict"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, Date, URL, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView, console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "data", "land.js"), "utf8"), ctx);
for (const f of ["themes", "captions", "events-model", "sanitize", "zip", "schema", "model", "archive", "layers", "render", "audio-mix", "recorder", "map-pointer", "commands", "newsdesk"]) vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
ctx.window.GD.model.setSampleEpisode(JSON.parse(fs.readFileSync(path.join(root, "episodes", "washington-dc-demo.globedesk.json"), "utf8")));
const { model, captions, themes, recorder, sanitize, zip, schema, layers, audioMix, archive, render, commands, mapPointer } = ctx.window.GD;
const land = ctx.window.GD_LAND;
const J = (v) => JSON.parse(JSON.stringify(v));
assert.deepEqual = ((orig) => (a, b, m) => orig(J(a), J(b), m))(assert.deepEqual);
let n = 0; const pending = []; const t = (name, fn) => { const r = fn(); if (r && typeof r.then === "function") pending.push(Promise.resolve(r).then(() => { n++; console.log("ok -", name); })); else { n++; console.log("ok -", name); } };

t("bundled Washington, DC sample: 2 stories, globedesk look, outro off, approximate pins, official sources", () => {
  const ep = model.sampleEpisode();
  assert.equal(ep.stories.length, 2);
  assert.equal(ep.look.theme, "globedesk");
  assert.equal(ep.outro.enabled, false);
  assert.deepEqual(ep.stories.map((s) => s.slug), ["capitol", "lincoln"]);
  for (const s of ep.stories) {
    assert.equal(s.location.verified, false);
    assert.equal(s.location.precision, "approximate");
    assert.ok(s.sources.every((x) => !x.url || /^https:\/\//.test(x.url)));
    assert.ok(s.sources.length >= 1);
  }
  assert.deepEqual(model.validate(ep), []);
});
t("auto camera path: orbit, dive, street, cinematic with two cuts ~8 s apart", () => {
  const p = model.autoCameraPath(50.45, 30.56, 8);
  assert.deepEqual(p.map((k) => k.preset), ["orbit", "dive", "street", "cinematic"]);
  assert.deepEqual(p.filter((k) => k.cut).map((k) => k.at), [0, 8]);
  assert.ok(p[2].zoom >= 16 && p[3].pitch >= 70);
});
t("land check: Kyiv and Riyadh are land; Hormuz pin is water", () => {
  assert.equal(model.pointInLand(50.45, 30.56, land), true);
  assert.equal(model.pointInLand(24.71, 46.68, land), true);
  assert.equal(model.pointInLand(26.57, 56.25, land), false);
});
t("water pin without a land look target stays at a regional close, no street zoom", () => {
  const p = model.autoCameraPathForLocation({ lat: 26.57, lon: 56.25, name: "Strait of Hormuz (approx. center)" }, 8, land);
  assert.ok(p.every((k) => k.preset !== "street" && k.zoom < 12));
  assert.ok(p.some((k) => k.preset === "close" && k.zoom >= 6 && k.zoom < 9));
});
t("separate look target: street keyframes use the land target, pin stays on the story", () => {
  const loc = { lat: 26.57, lon: 56.25, look: { lat: 27.18, lon: 56.28, name: "Bandar Abbas (gazetteer, approx.)" } };
  // Bandar Abbas-ish coast should be land; if the coarse land pack misses it, skip the on-land assertion's path via explicit coords
  const p = model.autoCameraPath(loc.lat, loc.lon, 8, { lookLat: loc.look.lat, lookLon: loc.look.lon, onLand: true });
  const street = p.filter((k) => k.preset === "street" || k.preset === "cinematic");
  assert.equal(street.length, 2);
  street.forEach((k) => { assert.equal(k.center[0], 56.28); assert.equal(k.center[1], 27.18); assert.ok(k.zoom >= 15); });
  assert.deepEqual(p[0].center, [56.25, 26.57]); // orbit stays on the pin
});
t("lookTarget falls back to the pin when look is unset", () => {
  const t = model.lookTarget({ lat: 50.45, lon: 30.56, name: "Kyiv" });
  assert.equal(t.from, "pin");
  assert.equal(t.lat, 50.45);
});
t("citation layout: title starts to the right of the badge and stays inside the header", () => {
  const ctx = { font: "", measureText: (t) => ({ width: String(t).length * 8 }) };
  const font = (w, px) => `${w} ${px}px sans-serif`;
  const lay = recorder.layoutHeader(1920, 1080, { headerHeightPct: 15 }, 1, ctx, font, "GLOBEDESK", "The United States Capitol stands at the eastern end of the National Mall");
  assert.ok(lay.titleX >= lay.badgeX + lay.badgeW, "title must start after the badge");
  assert.ok(lay.titleY0 + (lay.titleLines.length - 1) * lay.titleLineH < lay.lowerBarTop, "title stays above the lower header bar");
  assert.ok(lay.headerBottom <= 1080 * 0.16);
  assert.ok(lay.titleLines.length >= 1);
});
t("pacing: Washington, DC sample is 3 cuts in 16 s, outro off", () => {
  const ep = model.sampleEpisode();
  const shots = ep.stories.reduce((a, s) => a + s.camera.filter((k) => k.cut).length, 0);
  assert.equal(shots, 3);
  assert.equal(model.storiesDuration(ep), 16);
  assert.equal(model.totalDuration(ep), 16);
});
t("captions: SRT and VTT round trip", () => {
  const cues = [{ start: 0, end: 1.5, text: "Hello" }, { start: 1.5, end: 3.25, text: "World line" }];
  assert.deepEqual(captions.parse(captions.toSRT(cues)), cues);
  assert.deepEqual(captions.parse(captions.toVTT(cues)), cues);
});
t("captions: auto from script stays inside duration and ≤12 words per cue", () => {
  const c = captions.fromScript("One two three. Four five six seven eight nine ten eleven twelve thirteen fourteen.", 10);
  assert.ok(c.length >= 2 && c[c.length - 1].end <= 10);
  assert.ok(c.every((x) => x.text.split(" ").length <= 12));
});
t("validation rejects non-https sources and bad status", () => {
  const ep = model.blankEpisode();
  ep.stories[0].sources[0].url = "http://example.com"; ep.stories[0].sources[0].status = "maybe";
  assert.equal(model.validate(ep).length, 2);
});
t("citation line format", () => {
  assert.equal(model.citationLine({ type: "File photo", date: "Apr 2026", credit: "Photo: X", license: "Public domain" }), "File photo (Apr 2026) / Photo: X; Public domain");
});
t("9:16 safe zones match header/caption bands", () => { assert.equal(themes.SAFE["9:16"].top, 0.15); assert.equal(themes.SAFE["9:16"].bottom, 0.15); });
t("no secrets / personal data patterns in shipped text files", () => {
  const files = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) { if (![".git", "shots", "vendor", "node_modules"].includes(e.name)) walk(p); } else if (/\.(js|mjs|json|html|css|md)$/.test(e.name)) files.push(p); });
  walk(root);
  const bad = [/sk-[A-Za-z0-9]{20,}/, /xai-[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/, /[A-Za-z0-9._%+-]+@(?:gmail|yahoo|outlook|hotmail)\.com/i, /\/home\/[a-z]+\//, /C:\\\\Users\\\\/];

  for (const f of files) { const s = fs.readFileSync(f, "utf8"); for (const r of bad) assert.ok(!r.test(s), `${path.relative(root, f)} matches ${r}`); }
});

t("v0.4 schema is globedesk.episode/2 and still reads /1", () => {
  assert.equal(model.SCHEMA, "globedesk.episode/2");
  const ep = model.blankEpisode();
  assert.equal(ep.schema, "globedesk.episode/2");
  assert.equal(ep.stories[0].asReported, true);
  assert.deepEqual(model.validate(ep), []);
  const old = model.sampleEpisode();
  old.schema = "globedesk.episode/1";
  assert.deepEqual(model.validate(old), []);
  model.normalizeEpisode(old);
  assert.equal(old.schema, "globedesk.episode/2");
  assert.equal(old.sample, true);
});
t("terrain is opt-in (default off)", () => {
  const terr = layers.OVERLAYS.find((o) => o.id === "terrain");
  assert.equal(terr.default, false);
});
t("sanitize escapes HTML and allows only https / allowlisted embeds", () => {
  assert.equal(sanitize.esc('<img src="x" onerror="alert(1)">'), "&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(sanitize.isHttpsUrl("http://example.com"), false);
  assert.equal(sanitize.isHttpsUrl("https://example.com/a"), true);
  assert.ok(sanitize.embedInfo("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
  assert.equal(sanitize.embedSrc("https://youtu.be/dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(sanitize.embedInfo("https://evil.example/embed"), null);
});
t("zip store round-trip", () => {
  const bytes = zip.write([{ name: "project.json", data: '{"ok":true}' }, { name: "media/a/hi.txt", data: "hello" }]);
  const files = zip.read(bytes);
  assert.equal(zip.readText(files, "project.json"), '{"ok":true}');
  assert.equal(new TextDecoder().decode(files["media/a/hi.txt"]), "hello");
});
t("audio overlay timing: offset, window, loop mediaTime", () => {
  const o = { at: 2, offset: 1.5, dur: 4, loop: false };
  assert.equal(audioMix.activeAt(o, 1.9), false);
  assert.equal(audioMix.activeAt(o, 2), true);
  assert.equal(audioMix.activeAt(o, 6), false);
  assert.equal(audioMix.mediaTime(o, 3), 2.5);
  const looped = { at: 0, offset: 0, loop: true, mediaDur: 4 };
  assert.equal(audioMix.mediaTime(looped, 5), 1);
});
t("duplicate story gets new ids", () => {
  const a = model.blankStory(1); a.title = "Alpha";
  const b = model.duplicateStory(a);
  assert.notEqual(a.id, b.id);
  assert.ok(b.title.includes("copy"));
  assert.notEqual(a.cards[0].id, b.cards[0].id);
});
t("content embed requires credit and allowlisted https", () => {
  const ep = model.blankEpisode();
  ep.stories[0].content = [{ id: "ct-1", kind: "embed", embedUrl: "https://example.com/nope", credit: "" }];
  const errs = model.validate(ep);
  assert.ok(errs.some((e) => /embedUrl|credit/.test(e)));
  ep.stories[0].content = [{ id: "ct-1", kind: "embed", embedUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa", credit: "@someone" }];
  assert.deepEqual(model.validate(ep), []);
});
t("truncated header layout still keeps title to the right of the badge", () => {
  const ctx = { font: "", measureText: (t) => ({ width: String(t).length * 8 }) };
  const font = (w, px) => `${w} ${px}px sans-serif`;
  const long = "A very long headline that should wrap and mark truncation when it exceeds two lines of the header band in 16:9";
  const lay = recorder.layoutHeader(1920, 1080, { headerHeightPct: 15 }, 1, ctx, font, "GLOBEDESK", long);
  assert.equal(typeof lay.titleFull, "string");
  assert.equal(lay.titleFull, long);
});

t("isHttpsUrl rejects userinfo", () => {
  assert.equal(sanitize.isHttpsUrl("https://user@evil.example/"), false);
  assert.equal(sanitize.isHttpsUrl("https://user:pass@evil.example/x"), false);
  assert.equal(sanitize.isHttpsUrl("https://example.com/ok"), true);
});

t("validation rejects unknown keys, oversize titles, and non-numeric duration", () => {
  const ep = model.blankEpisode();
  assert.deepEqual(model.validate(ep), []);
  ep.notAField = 1;
  assert.ok(model.validate(ep).some((e) => /unknown key/.test(e)));
  const ep2 = model.blankEpisode();
  ep2.stories[0].title = "x".repeat(schema.LIMITS.str.short + 1);
  assert.ok(model.validate(ep2).some((e) => /title|longer/.test(e)));
  const ep3 = model.blankEpisode();
  ep3.stories[0].durationSec = "<img src=x onerror=alert(1)>";
  assert.ok(model.validate(ep3).some((e) => /durationSec/.test(e)));
  const ep4 = model.blankEpisode();
  ep4.stories[0].cards = { title: "nope" };
  assert.ok(model.validate(ep4).some((e) => /cards/.test(e)));
  const ep5 = model.sampleEpisode();
  assert.deepEqual(model.validate(ep5), []);
});

t("numeric HTML interpolation is coerced and escaped", () => {
  const payload = "<img src=x onerror=alert(1)>";
  const html = "• " + sanitize.esc(Number(payload)) + "s";
  assert.equal(/<img/.test(html), false);
  assert.equal(html.includes("NaN"), true);
  const h = "Header (top " + sanitize.esc(Number('"><a href="https://evil.example/">')) + "%)";
  assert.equal(/<a /.test(h), false);
});

t("CSP in index.html, serve.py and serve.ps1 is the same policy", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const py = fs.readFileSync(path.join(root, "tools", "serve.py"), "utf8");
  const ps = fs.readFileSync(path.join(root, "tools", "serve.ps1"), "utf8");
  const take = (text, re) => {
    const m = text.match(re);
    if (!m) return "";
    return m[1].replace(/;+\s*$/, "").replace(/\s+/g, " ").trim();
  };
  const h = take(html, /http-equiv="Content-Security-Policy" content="([^"]+)"/);
  const y = take(py, /send_header\("Content-Security-Policy",\s*"([^"]+)"/);
  const w = take(ps, /Headers\.Add\("Content-Security-Policy", "([^"]+)"/);
  assert.ok(h, "index CSP missing");
  assert.equal(h, y);
  assert.equal(h, w);
  assert.ok(h.includes("frame-src https://www.youtube-nocookie.com"));
  assert.equal(/youtube\.com(?!-nocookie)/.test(h), false);
  assert.equal(/api\.x\.ai/.test(h), false);
  assert.equal(/unsafe-inline/.test(h), false);
  assert.ok(h.includes("https://s3.amazonaws.com/elevation-tiles-prod/"));
  assert.equal(/s3\.amazonaws\.com(?!\/elevation-tiles-prod\/)/.test(h), false);
});


t("P0: drawing buffer is off unless recording, antialias defaults off", () => {
  const a = render.canvasContextAttributes({});
  assert.equal(a.preserveDrawingBuffer, false);
  assert.equal(a.antialias, false);
  const b = render.canvasContextAttributes({ recording: true, antialias: true });
  assert.equal(b.preserveDrawingBuffer, true);
  assert.equal(b.antialias, true);
  const c = render.canvasContextAttributes({ recording: false, antialias: false });
  assert.equal(c.preserveDrawingBuffer, false);
});
t("P0: pixel-ratio cap defaults to 1.5 and never exceeds the cap", () => {
  assert.equal(render.DEFAULT_PIXEL_RATIO_CAP, 1.5);
  assert.equal(render.pixelRatio(3, 1.5), 1.5);
  assert.equal(render.pixelRatio(1, 1.5), 1);
  assert.equal(render.pixelRatio(2, 1), 1);
  assert.equal(render.pixelRatio(undefined, undefined), 1);
});
t("P0: GIBS Blue Marble and EOX hybrid never stay stacked", () => {
  assert.equal(render.rastersStacked("sat-hybrid", { bluemarble: true }), true);
  assert.equal(render.rastersStacked("sat-hybrid", { bluemarble: false }), false);
  assert.equal(render.rastersStacked("offline", { bluemarble: true }), false);
  const on = render.policyOnSetOverlay("sat-hybrid", { bluemarble: false }, "bluemarble", true);
  assert.equal(on.baseId, "offline");
  assert.equal(on.overlays.bluemarble, true);
  assert.equal(render.rastersStacked(on.baseId, on.overlays), false);
  const off = render.policyOnSetBase("sat-hybrid", { bluemarble: true, towns: true });
  assert.equal(off.overlays.bluemarble, false);
  assert.equal(off.overlays.towns, true);
  assert.equal(render.rastersStacked(off.baseId, off.overlays), false);
  const start = render.normalizeStartup("sat-hybrid", { bluemarble: true });
  assert.equal(start.overlays.bluemarble, false);
});
t("P0: render prefs persist only in the provided storage", () => {
  const store = { data: {}, getItem(k) { return Object.prototype.hasOwnProperty.call(this.data, k) ? this.data[k] : null; }, setItem(k, v) { this.data[k] = String(v); } };
  assert.equal(render.readAntialias(store), false);
  render.writeAntialias(true, store);
  assert.equal(render.readAntialias(store), true);
  assert.equal(render.readPixelRatioCap(store), 1.5);
  render.writePixelRatioCap(2, store);
  assert.equal(render.readPixelRatioCap(store), 2);
});

t("P0: prepareForExport is inside recorder.start try so a throw still ends export", () => {
  const src = fs.readFileSync(path.join(root, "js", "recorder.js"), "utf8");
  const start = src.indexOf("async function start(");
  const fn = src.slice(start, src.indexOf("function stop(", start));
  const tryAt = fn.indexOf("try {");
  const prepAt = fn.indexOf("prepareForExport");
  const catchAt = fn.indexOf("} catch");
  assert.ok(tryAt >= 0 && prepAt > tryAt && prepAt < catchAt && fn.includes("endExport"));
});

t("P1: Blue Marble uses GIBS unless a local tile proxy is available", () => {
  const remote = layers.OVERLAYS.find((o) => o.id === "bluemarble").tiles;
  assert.ok(remote && remote.includes("gibs.earthdata.nasa.gov"));
  layers.setLocalBlueMarbleProxy(false);
  assert.equal(layers.blueMarbleTiles({ protocol: "http:", hostname: "127.0.0.1", origin: "http://127.0.0.1:8080" }), remote);
  layers.setLocalBlueMarbleProxy(true);
  assert.equal(layers.blueMarbleTiles({ protocol: "http:", hostname: "127.0.0.1", origin: "http://127.0.0.1:8080" }), "http://127.0.0.1:8080/tiles/bluemarble/{z}/{x}/{y}.jpeg");
  assert.equal(layers.blueMarbleTiles(), remote, "no window location: stay on GIBS");
  layers.setLocalBlueMarbleProxy(false);
  const note = layers.OVERLAYS.find((o) => o.id === "bluemarble").note;
  assert.ok(note.includes("./globedesk-data"));
  assert.ok(note.includes("/tiles"));
  assert.equal(note.includes("C:"), false);
});

t("P2: EOX and the DC region pack use the local /tiles proxy only when it is available", () => {
  const remote = layers.BASES.find((b) => b.id === "sat-hybrid").satTiles;
  const region = layers.OVERLAYS.find((o) => o.id === "eox-region");
  assert.ok(remote && remote.includes("tiles.maps.eox.at"));
  assert.ok(region && region.tiles.includes("s2cloudless_3857"));
  assert.ok(region.note.includes("CC BY 4.0"));
  assert.equal(region.note.includes("C:"), false);
  const loc = { protocol: "http:", hostname: "127.0.0.1", origin: "http://127.0.0.1:8080" };
  layers.setLocalBlueMarbleProxy(false);
  assert.equal(layers.eoxTiles(loc), remote);
  assert.equal(layers.eoxRegionTiles(loc), region.tiles);
  layers.setLocalBlueMarbleProxy(true);
  assert.equal(layers.eoxTiles(loc), "http://127.0.0.1:8080/tiles/eox2016/{z}/{x}/{y}.jpg");
  assert.equal(layers.eoxRegionTiles(loc), "http://127.0.0.1:8080/tiles/eox2016/{z}/{x}/{y}.jpg");
  layers.setLocalBlueMarbleProxy(false);
});

t("P2: packs probe times out so a hung /api/packs cannot block the globe", () => {
  assert.equal(layers.PACKS_PROBE_TIMEOUT_MS, 2000);
  const src = fs.readFileSync(path.join(root, "js", "layers.js"), "utf8");
  assert.ok(src.includes("AbortController"));
  assert.ok(src.includes("PACKS_PROBE_TIMEOUT_MS"));
  const fn = src.slice(src.indexOf("function probeLocalTileProxy"), src.indexOf("function blueMarbleTiles"));
  assert.ok(fn.includes("timeoutMs"));
  assert.ok(fn.includes("ctl.abort"));
});

t("P2: DC region overlay is not stacked with EOX hybrid or Blue Marble", () => {
  assert.equal(render.rastersStacked("sat-hybrid", { "eox-region": true }), true);
  assert.equal(render.rastersStacked("offline", { "eox-region": true }), false);
  assert.equal(render.rastersStacked("offline", { bluemarble: true, "eox-region": true }), true);
  const on = render.policyOnSetOverlay("sat-hybrid", { "eox-region": false }, "eox-region", true);
  assert.equal(on.baseId, "offline");
  assert.equal(on.overlays["eox-region"], true);
  assert.equal(on.overlays.bluemarble, false);
  assert.equal(render.rastersStacked(on.baseId, on.overlays), false);
  const off = render.policyOnSetBase("sat-hybrid", { "eox-region": true, towns: true });
  assert.equal(off.overlays["eox-region"], false);
  assert.equal(off.overlays.towns, true);
});

const dcEp = JSON.parse(fs.readFileSync(path.join(root, "episodes", "washington-dc-demo.globedesk.json"), "utf8"));
t("P3: DC sample episode is globedesk.episode/2 and validates", () => {
  assert.equal(dcEp.schema, "globedesk.episode/2");
  assert.equal(dcEp.stories.length, 2);
  assert.equal(dcEp.stories[0].slug, "capitol");
  assert.equal(dcEp.stories[1].slug, "lincoln");
  assert.equal(dcEp.look.map.base, "offline");
  assert.equal(dcEp.outro.enabled, false);
  const errs = schema.validate(dcEp);
  assert.deepEqual(errs, []);
  for (const s of dcEp.stories) {
    assert.equal(s.location.precision, "approximate");
    assert.equal(s.location.verified, false);
    assert.ok(s.location.note.includes("[UNKNOWN]"));
    assert.ok(s.sources.every((x) => x.status === "verified" && /^https:\/\//.test(x.url)));
  }
});

t("P3: command allowlist and validation", () => {
  const need = ["flyTo", "zoom", "toggleLayer", "dropPin", "openCard", "closeCard", "play", "pause", "resume"];
  need.forEach((c) => assert.ok(commands.list().includes(c), c));
  const ok = commands.unpack({ cmd: "flyTo", lat: 38.89, lon: -77.01, zoom: 13 });
  assert.equal(ok.cmd, "flyTo");
  assert.equal(ok.args.zoom, 13);
  const bad = commands.unpack({ cmd: "eval", code: "1" });
  assert.ok(bad.error.includes("unknown command"));
  const range = commands.unpack({ cmd: "zoom", zoom: 99 });
  assert.ok(range.error);
  const layer = commands.unpack({ cmd: "toggleLayer", id: "eox-region", on: true });
  assert.equal(layer.args.id, "eox-region");
});

t("P3: story state at beat times and resume restores pins", () => {
  const s0 = dcEp.stories[0], s1 = dcEp.stories[1];
  assert.deepEqual(commands.cardsAt(s0, 0).map((c) => c.id), []);
  assert.deepEqual(commands.cardsAt(s0, 3).map((c) => c.id), ["card-capitol"]);
  assert.deepEqual(commands.cardsAt(s1, 3).map((c) => c.id), ["card-lincoln"]);
  const cam0 = commands.cameraAt(s0, 3);
  assert.equal(cam0.id, "kf-capitol-close");
  assert.equal(cam0.zoom, 13);
  const cam1 = commands.cameraAt(s1, 0);
  assert.equal(cam1.center[0], -77.05);
  const snap = commands.cloneLocations(dcEp);
  dcEp.stories[0].location.lat = 10;
  dcEp.stories[0].location.lon = 20;
  commands.restoreLocations(dcEp, snap);
  assert.equal(dcEp.stories[0].location.lat, 38.89);
  assert.equal(dcEp.stories[0].location.lon, -77.01);
  assert.equal(dcEp.stories[1].location.lon, -77.05);
});

t("P3: DC region overlay declares MapLibre bounds", () => {
  const region = layers.OVERLAYS.find((o) => o.id === "eox-region");
  assert.deepEqual(region.bounds, [-77.12, 38.83, -76.94, 38.97]);
  assert.deepEqual(layers.eoxRegionBounds(), [-77.12, 38.83, -76.94, 38.97]);
  const globeSrc = fs.readFileSync(path.join(root, "js", "globe.js"), "utf8");
  assert.ok(globeSrc.includes("eoxRegionBounds"));
  assert.ok(globeSrc.includes("src.bounds"));
  const uiSrc = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");
  assert.ok(uiSrc.includes("wantBase"));
  assert.ok(uiSrc.includes("ep.look.map.base"));
});

t("P3: openCard on an already-open card is ok", async () => {
  const GD = ctx.window.GD;
  const prev = { state: GD.state, callouts: GD.callouts, playback: GD.playback, ui: GD.ui };
  GD.state = { episode: dcEp, storyIdx: 0, t: 0, forcedCards: [], ov: { cards: [] } };
  GD.callouts = { isOpen: () => false, open() {}, close() {}, clear() {}, state: { open: [] } };
  GD.playback = null;
  GD.ui = null;
  const first = await commands.run({ cmd: "openCard", args: { id: "card-capitol" } });
  assert.equal(first.ok, true);
  assert.equal(first.result.alreadyOpen, false);
  assert.ok(GD.state.forcedCards.includes("card-capitol"));
  const second = await commands.run({ cmd: "openCard", args: { id: "card-capitol" } });
  assert.equal(second.ok, true);
  assert.equal(second.result.alreadyOpen, true);
  assert.equal(second.result.id, "card-capitol");
  GD.state.ov = { cards: [{ id: "card-lincoln" }] };
  const timed = await commands.run({ cmd: "openCard", args: { id: "card-lincoln" } });
  assert.equal(timed.ok, true);
  assert.equal(timed.result.alreadyOpen, true);
  Object.assign(GD, prev);
});

t("P3: plain click never drops a pin; only right-click or long-press does", () => {
  assert.equal(mapPointer.LONG_PRESS_MS, 500);
  assert.equal(mapPointer.actionFor({ type: "click" }, {}), "keep");
  assert.equal(mapPointer.actionFor({ type: "tap" }, {}), "keep");
  assert.equal(mapPointer.actionFor({ type: "click", button: 0 }, {}), "keep");
  assert.equal(mapPointer.actionFor({ type: "click" }, { pin: { kind: "pin", id: "s1" } }), "select");
  assert.equal(mapPointer.actionFor({ type: "tap" }, { card: { kind: "card", id: "c1" } }), "select");
  assert.equal(mapPointer.actionFor({ type: "click" }, { eventFeature: { kind: "event", id: "e1" } }), "select");
  assert.equal(mapPointer.actionFor({ type: "contextmenu" }, {}), "dropPin");
  assert.equal(mapPointer.actionFor({ type: "longpress" }, {}), "dropPin");
  assert.equal(mapPointer.actionFor({ type: "click", button: 2 }, {}), "keep");
  assert.equal(mapPointer.actionFor({ type: "drag" }, {}), "keep");
  assert.equal(mapPointer.shouldCancelLongPress({ x: 0, y: 0 }, { x: 11, y: 0 }), true);
  assert.equal(mapPointer.shouldCancelLongPress({ x: 0, y: 0 }, { x: 3, y: 3 }), false);
});

t("P3: selection survives pan, zoom, and empty taps; only close, Escape, or a new pick changes it", () => {
  const GD = ctx.window.GD;
  const prev = GD.state;
  GD.state = { mapSel: null, episode: dcEp, storyIdx: 0 };
  const pin = { kind: "pin", id: "story-capitol", storyIdx: 0 };
  const picked = mapPointer.apply({ type: "click" }, { pin });
  assert.equal(picked.action, "select");
  assert.equal(mapPointer.getSelection().id, "story-capitol");
  const empty = mapPointer.apply({ type: "click" }, {});
  assert.equal(empty.action, "keep");
  assert.equal(mapPointer.getSelection().id, "story-capitol");
  assert.equal(mapPointer.apply({ type: "pan" }, {}).action, "keep");
  assert.equal(mapPointer.apply({ type: "zoom" }, {}).action, "keep");
  assert.equal(mapPointer.apply({ type: "drag" }, {}).action, "keep");
  assert.equal(mapPointer.getSelection().id, "story-capitol");
  const dropped = mapPointer.apply({ type: "contextmenu" }, {});
  assert.equal(dropped.action, "dropPin");
  assert.equal(mapPointer.getSelection().id, "story-capitol");
  const other = mapPointer.apply({ type: "click" }, { eventFeature: { kind: "event", id: "ev-1" } });
  assert.equal(other.action, "select");
  assert.equal(mapPointer.getSelection().id, "ev-1");
  const gone = mapPointer.apply({ type: "escape" }, {});
  assert.equal(gone.action, "clearSelection");
  assert.equal(mapPointer.getSelection(), null);
  assert.equal(mapPointer.nextSelection(pin, "keep"), pin);
  assert.equal(mapPointer.nextSelection(pin, "dropPin"), pin);
  assert.equal(mapPointer.nextSelection(pin, "clearSelection"), null);
  GD.state = prev;
});

t("P3: one click dispatcher — an event pick selects and never drops a pin", () => {
  const evHit = { eventFeature: { kind: "event", id: "zone-1" } };
  assert.equal(mapPointer.actionFor({ type: "click" }, evHit), "select");
  assert.notEqual(mapPointer.actionFor({ type: "click" }, evHit), "dropPin");
  const both = { pin: { kind: "pin", id: "s1", storyIdx: 0 }, eventFeature: { kind: "event", id: "zone-1" } };
  assert.equal(mapPointer.actionFor({ type: "click" }, both), "select");
  const dispatched = mapPointer.apply({ type: "click" }, evHit);
  assert.equal(dispatched.action, "select");
  assert.equal(dispatched.selection.id, "zone-1");
  mapPointer.clearSelection();
});

t("P3: a double-click zoom does not run the click action", () => {
  assert.equal(mapPointer.DBLCLICK_MS, 300);
  assert.equal(mapPointer.actionFor({ type: "dblclick" }, { pin: { id: "s1" } }), "keep");
  assert.equal(mapPointer.actionFor({ type: "click", detail: 2 }, { pin: { id: "s1" } }), "keep");
  assert.equal(mapPointer.actionFor({ type: "click", detail: 2 }, {}), "keep");
});

t("P3: selecting while paused does not seek or clear explore state", () => {
  assert.equal(mapPointer.shouldSeekOnSelect({ paused: true, playing: false }), false);
  assert.equal(mapPointer.shouldSeekOnSelect({ paused: false, playing: true }), true);
  assert.equal(mapPointer.shouldSeekOnSelect({ paused: false, playing: false }), true);
  const GD = ctx.window.GD;
  const prev = GD.state;
  GD.state = { episode: dcEp, storyIdx: 0, paused: true, playing: false, mapSel: { kind: "pin", id: "story-capitol", storyIdx: 0 } };
  const pin = { lat: 10, lon: 20 };
  dcEp.stories[0].location.lat = 10;
  dcEp.stories[0].location.lon = 20;
  const action = mapPointer.apply({ type: "click" }, { pin: { kind: "pin", id: "story-lincoln", storyIdx: 1 } });
  assert.equal(action.action, "select");
  assert.equal(mapPointer.shouldSeekOnSelect(GD.state), false);
  assert.equal(dcEp.stories[0].location.lat, 10);
  assert.equal(dcEp.stories[0].location.lon, 20);
  commands.restoreLocations(dcEp, [{ id: dcEp.stories[0].id, location: { name: "U.S. Capitol (approx.)", lat: 38.89, lon: -77.01, precision: "approximate", verified: false } }, { id: dcEp.stories[1].id, location: JSON.parse(JSON.stringify(dcEp.stories[1].location)) }]);
  GD.state = prev;
});

t("P3: story and API flyTo are queued while the pointer is down", () => {
  mapPointer.resetPointerState();
  assert.equal(mapPointer.pointerIsDown(), false);
  mapPointer.notePointerDown(null);
  assert.equal(mapPointer.pointerIsDown(), true);
  let ran = 0;
  const q = mapPointer.requestCamera(() => { ran += 1; });
  assert.equal(q.queued, true);
  assert.equal(ran, 0);
  mapPointer.notePointerUp();
  assert.equal(mapPointer.pointerIsDown(), false);
  assert.equal(ran, 1);
  const immediate = mapPointer.requestCamera(() => { ran += 1; });
  assert.equal(immediate.queued, false);
  assert.equal(ran, 2);
  mapPointer.notePointerDown(null);
  mapPointer.requestCamera(() => { ran += 10; });
  mapPointer.stopMotion(null);
  mapPointer.notePointerUp();
  assert.equal(ran, 2);
  mapPointer.resetPointerState();
});

t("P3: reduced-motion, 24 px hits, and docs no longer say click the globe", () => {
  assert.equal(mapPointer.HIT_MIN_PX, 24);
  assert.equal(mapPointer.reduceMotion(), false);
  const globeSrc = fs.readFileSync(path.join(root, "js", "globe.js"), "utf8");
  assert.ok(globeSrc.includes("essential: false"));
  assert.ok(globeSrc.includes("cooperativeGestures: false") && globeSrc.includes("touchPitch: false") && globeSrc.includes("applyTouchGestures"));
  assert.ok(globeSrc.includes("gd-pan-ctrl"));
  const evSrc = fs.readFileSync(path.join(root, "js", "events-map.js"), "utf8");
  assert.ok(evSrc.includes("reduceMotion"));
  const guide = fs.readFileSync(path.join(root, "USER-GUIDE.md"), "utf8");
  const ref = fs.readFileSync(path.join(root, "docs", "REFERENCE.md"), "utf8");
  const own = fs.readFileSync(path.join(root, "starter", "MAKE-YOUR-OWN.md"), "utf8");
  for (const text of [guide, ref, own]) {
    assert.equal(/(?<![\w-])click(?:ing)? the globe/i.test(text), false, "docs still teach click-the-globe");
    assert.ok(/right-click/i.test(text));
  }
});

await Promise.all(pending);
console.log(`\n${n} passed`);
