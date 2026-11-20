#!/usr/bin/env node
// Headless smoke: serve the folder, load in Chrome, fail on console errors, save screenshots to shots/.
// Usage: node tests/smoke.mjs   (needs google-chrome; CHROME env var overrides)
import { spawn } from "node:child_process"; import fs from "node:fs/promises"; import path from "node:path"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8099, DBG = 9339, W = 1600, H = 960;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [], warnings = [], netFail = [];
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
const chrome = spawn(process.env.CHROME || "google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", `--remote-debugging-port=${DBG}`, `--window-size=${W},${H}`, "--hide-scrollbars", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", "about:blank"], { stdio: "ignore" });
async function until(fn, ms, label) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch {} await sleep(300); } throw new Error("timeout: " + label); }
class Cdp { constructor(u) { this.ws = new WebSocket(u); this.id = 0; this.p = new Map(); this.h = {}; this.ready = new Promise((r, j) => { this.ws.onopen = r; this.ws.onerror = j; });
  this.ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.method && this.h[m.method]) this.h[m.method](m.params); if (m.id && this.p.has(m.id)) { const { r, j } = this.p.get(m.id); this.p.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } }; }
  on(m, f) { this.h[m] = f; } send(method, params = {}) { const id = ++this.id; return new Promise((r, j) => { this.p.set(id, { r, j }); this.ws.send(JSON.stringify({ id, method, params })); }); } }
let c;
const ev = async (expr) => { const r = await c.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const shot = async (name) => { const r = await c.send("Page.captureScreenshot", { format: "png" }); await fs.writeFile(path.join(root, "shots", name), Buffer.from(r.data, "base64")); console.log("shot", name); };
const idle = () => until(() => ev("GD.globe.st.map.loaded() && GD.globe.st.map.areTilesLoaded()"), 45000, "tiles").catch(() => console.log("note: tiles still loading at timeout"));
try {
  await fs.mkdir(path.join(root, "shots"), { recursive: true });
  await until(async () => (await fetch(`http://127.0.0.1:${DBG}/json/version`)).ok, 15000, "chrome");
  await until(async () => (await fetch(`http://127.0.0.1:${PORT}/`)).ok, 10000, "server");
  const page = await (await fetch(`http://127.0.0.1:${DBG}/json/new?about:blank`, { method: "PUT" })).json();
  c = new Cdp(page.webSocketDebuggerUrl); await c.ready;
  for (const d of ["Runtime", "Page", "Log", "Network"]) await c.send(d + ".enable");
  c.on("Runtime.consoleAPICalled", (p) => { const t = p.args.map((a) => a.value ?? a.description ?? "").join(" "); if (p.type === "error") errors.push(t); if (p.type === "warning") warnings.push(t); });
  c.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text));
  c.on("Log.entryAdded", (p) => { if (p.entry.level === "error") (p.entry.source === "network" ? netFail : errors).push(`${p.entry.text} ${p.entry.url || ""}`); });
  await c.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await c.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html?sample=1` });
  await until(() => ev("window.__globedesk && window.__globedesk.ready && GD.globe.st.status === 'ready'"), 30000, "app ready");
  console.log("base:", await ev("GD.globe.st.baseId"), "recorder supported:", await ev("GD.recorder.supported()"));
  await idle(); await sleep(1500); await shot("01-desk-globe-16x9.png");
  // Street-level cinematic shot of story 2 (Kyiv), via seek (jumps camera to that keyframe).
  await ev("GD.ui.selectStory(1); GD.playback.seek(16 + 13); true");
  await idle(); await sleep(2500); await shot("02-street-cinematic-16x9.png");
  // Dedicated street-level still of the Kyiv land pin (about z16–17, pitched).
  const street = await ev(`(() => {
    const s = GD.state.episode.stories[1];
    const sv = GD.globe.streetView(s);
    if (!sv) return { ok: false };
    GD.ui.selectStory(1);
    GD.globe.st.map.jumpTo({ center: sv.center, zoom: sv.zoom, pitch: sv.pitch, bearing: sv.bearing });
    return { ok: true, zoom: GD.globe.st.map.getZoom(), land: GD.globe.isLand(s.location.lat, s.location.lon) };
  })()`);
  console.log("street kyiv:", JSON.stringify(street));
  if (!street || !street.ok || !(street.zoom >= 16) || street.land !== true) errors.push("Kyiv street-level camera failed: " + JSON.stringify(street));
  await idle(); await sleep(8000); await shot("10-street-level-kyiv-bridges-16x9.png");
  const feats = await ev(`(() => {
    const m = GD.globe.st.map;
    const layers = ["roads", "road-casing", "road-labels", "place-labels", "gd-buildings"].filter((id) => !!m.getLayer(id));
    return { layers, n: m.queryRenderedFeatures({ layers }).length, zoom: Number(m.getZoom().toFixed(2)) };
  })()`);
  console.log("street features:", JSON.stringify(feats));
  await ev("document.getElementById('asp916').click(); GD.playback.seek(1.2); true");
  await ev("GD.globe.st.map.jumpTo({center:[56.25,26.57],zoom:4.6,pitch:30,bearing:-10}); true");
  await idle(); await sleep(1500); await shot("03-vertical-9x16-header-citation.png");
  const hl = await ev("({active: GD.globe.st.active, a3: GD.state.episode.stories[GD.globe.st.active].highlight.a3, feats: GD.globe.st.map.querySourceFeatures('gd-highlight').length, layer: !!GD.globe.st.map.getLayer('gd-hl-glow'), vis: GD.globe.st.map.getLayoutProperty('gd-hl-glow','visibility')})");
  console.log("highlight:", JSON.stringify(hl));
  if (!(hl.feats > 0)) errors.push("focus-region highlight has no features");
  await ev("GD.playback.seek(50); true"); await sleep(600); await shot("04-outro-9x16.png");
  // Short real playback run (camera fly, cards, captions), then stop.
  await ev("document.getElementById('asp169').click(); GD.playback.seek(0); GD.playback.play(); true");
  await sleep(4000);
  const play = await ev("({t: GD.state.t, playing: GD.state.playing, caps: GD.state.ov.captions.length, cards: GD.state.ov.cards.length, cites: GD.state.ov.citations.length})");
  console.log("playback:", JSON.stringify(play));
  if (!(play.t > 2 && play.playing)) errors.push("playback clock did not advance");
  await ev("GD.playback.stop(); true");
  // Record path: start + stop a 2 s capture and check bytes are produced.
  const recBytes = await ev(`(async () => { await GD.recorder.start('16:9'); await new Promise(r => setTimeout(r, 2000)); const rec = GD.recorder._rec; cancelAnimationFrame(rec.raf); return await new Promise(res => { rec.mr.onstop = () => res(rec.chunks.reduce((a, b) => a + b.size, 0)); rec.mr.stop(); rec.mr = null; }); })()`);
  console.log("recorder bytes (2 s):", recBytes);
  if (!(recBytes > 0)) errors.push("recorder produced no data");
  await ev("GD.ui.loadEpisode(GD.model.blankEpisode()); true"); await sleep(800); await shot("05-blank-template.png");
  await ev("document.querySelector('[data-tab=layers]').click(); true"); await sleep(300); await shot("06-layers-panel.png");

  // v0.4: create a story with pin, image, audio overlay, caption; place overlay + geo panel;
  // confirm base map unchanged; export/reimport; record 2s.
  const v04 = await ev(`(async () => {
    const before = GD.content.baseSnapshot();
    const png = await new Promise((res) => { const c = document.createElement("canvas"); c.width = 160; c.height = 90; const g = c.getContext("2d"); g.fillStyle = "#e0242f"; g.fillRect(0,0,160,90); g.fillStyle = "#fff"; g.font = "16px sans-serif"; g.fillText("overlay", 40, 52); c.toBlob(res, "image/png"); });
    const rate = 8000, n = rate * 1, data = new Int16Array(n);
    for (let i = 0; i < n; i++) data[i] = Math.floor(Math.sin(2 * Math.PI * 440 * i / rate) * 6000);
    const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, "data"); v.setUint32(40, n * 2, true);
    new Int16Array(buf, 44).set(data);
    const wav = new Blob([buf], { type: "audio/wav" });
    const loadedBlank = GD.ui.loadEpisode(GD.model.blankEpisode(), "");
    const img = await GD.media.addFile(new File([png], "overlay.png", { type: "image/png" }));
    const aud = await GD.media.addFile(new File([wav], "beep.wav", { type: "audio/wav" }));
    const ep = GD.state.episode;
    ep.title = "v0.4 smoke story";
    const st = ep.stories[0];
    st.title = "A smoke-test story with a reasonably long headline for hover text";
    st.summary = "Created in the smoke test.";
    st.credit = "AdventureNLearn (test)";
    st.asReported = true;
    st.location = { name: "Kyiv (approx.)", lat: 50.45, lon: 30.56, precision: "approximate", verified: false, note: "smoke" };
    st.camera = GD.model.autoCameraPathForLocation(st.location, 8, window.GD_LAND);
    st.durationSec = 12;
    st.captions = [{ start: 0, end: 8, text: "Smoke-test caption: as reported, not verified." }];
    st.audioOverlays = [Object.assign(GD.audioMix.blank(aud.ref), { volume: 0.8, offset: 0, loop: false, at: 0, dur: 2 })];
    st.content = [
      Object.assign(GD.content.blank("overlay"), { mediaRef: img.ref, title: "Overlay image", caption: "Test overlay caption", at: 0, dur: 12, overlay: { mode: "pip", x: 66, y: 22, width: 28, height: 24, opacity: 1 } }),
      Object.assign(GD.content.blank("geo-panel"), { mediaRef: img.ref, title: "Geo panel", caption: "Anchored at the pin", at: 0, dur: 12, pin: { lat: 50.45, lon: 30.56 } })
    ];
    if (GD.events) {
      const layer = GD.events.createLayer("Smoke layer");
      layer.features.push(GD.events.createFeature("point", { type: "Point", coordinates: [30.56, 50.45] }, { title: "Smoke pin", verification: "not verified", precisionLabel: "approximate" }));
      ep.eventLayers = [layer];
    }
    const loaded = loadedBlank && GD.ui.loadEpisode(ep, "");
    const mid = GD.content.baseSnapshot();
    GD.content.render();
    const afterRender = GD.content.baseSnapshot();
    GD.content.clear();
    const afterClear = GD.content.baseSnapshot();
    GD.content.render();
    const bytes = await GD.project.buildPack(GD.state.episode, GD.state.blobs);
    const pack = await GD.project.parsePack(bytes);
    const reerrs = GD.schema.validate(pack.episode);
    await GD.project.absorbMedia(pack.media);
    const reloaded = GD.ui.loadEpisode(pack.episode, "");
    return {
      loaded, img: img.ok, aud: aud.ok,
      sameAfterAdd: GD.content.sameBase(before, mid),
      sameAfterRender: GD.content.sameBase(before, afterRender),
      sameAfterClear: GD.content.sameBase(before, afterClear),
      packBytes: bytes.length, reerrs, reloaded,
      overlays: pack.episode.stories[0].audioOverlays.length,
      content: pack.episode.stories[0].content.length,
      captions: pack.episode.stories[0].captions.length,
      baseId: mid.baseId
    };
  })()`);
  console.log("v0.4 flow:", JSON.stringify(v04));
  if (!v04 || !v04.loaded || !v04.img || !v04.aud) errors.push("v0.4 create failed: " + JSON.stringify(v04));
  if (!v04 || v04.sameAfterRender !== true || v04.sameAfterClear !== true) errors.push("base map changed after load/clear of user content: " + JSON.stringify(v04 && { r: v04.sameAfterRender, c: v04.sameAfterClear }));
  if (!v04 || (v04.reerrs && v04.reerrs.length) || !v04.reloaded) errors.push("v0.4 export/reimport failed: " + JSON.stringify(v04));

  await ev("GD.ui.selectStory(0); GD.playback.seek(1); document.querySelector('[data-tab=story]').click(); true");
  await idle(); await sleep(800); await shot("11-editor.png");
  await ev("document.querySelector('[data-tab=sound]').click(); true"); await sleep(300); await shot("12-sound-panel.png");
  await ev("document.querySelector('[data-tab=assist]').click(); true"); await sleep(300); await shot("13-assistant-panel.png");
  await ev("document.querySelector('[data-tab=place]').click(); GD.playback.seek(1); true");
  await idle(); await sleep(800); await shot("14-overlay.png");
  // Geo-anchored panel at street-ish zoom so it sits on Kyiv
  await ev(`(() => { const m = GD.globe.st.map; m.jumpTo({ center: [30.56, 50.45], zoom: 6.5, pitch: 20, bearing: 0 }); return true; })()`);
  await idle(); await sleep(1200); await shot("15-geo-panel.png");

  const rec2 = await ev(`(async () => { await GD.recorder.start('16:9'); await new Promise(r => setTimeout(r, 2000)); const rec = GD.recorder._rec; cancelAnimationFrame(rec.raf); return await new Promise(res => { rec.mr.onstop = () => res(rec.chunks.reduce((a, b) => a + b.size, 0)); rec.mr.stop(); rec.mr = null; }); })()`);
  console.log("recorder bytes after reimport (2 s):", rec2);
  if (!(rec2 > 0)) errors.push("recorder after reimport produced no data");
} catch (e) { errors.push("SMOKE: " + e.message); }
finally {
  console.log("warnings:", warnings.length, warnings.slice(0, 5));
  console.log("network errors:", netFail.length, netFail.slice(0, 5));
  console.log("console errors:", errors.length); errors.forEach((e) => console.log("  ", e));
  chrome.kill(); server.kill();
  process.exit(errors.length ? 1 : 0);
}
