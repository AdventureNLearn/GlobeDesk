#!/usr/bin/env node
// Event Layers smoke (v0.2): one load, draw tools, rendering, round trips, clock, frame.
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
  await c.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
  await until(() => ev("window.__globedesk && window.__globedesk.ready && GD.globe.st.status === 'ready'"), 30000, "app ready");
  console.log("base:", await ev("GD.globe.st.baseId"), "recorder supported:", await ev("GD.recorder.supported()"));
  // --- Event Layers (v0.2) ---
  const n0 = await ev("GD.state.episode.eventLayers.reduce((a, l) => a + l.features.length, 0)");
  await ev("document.querySelector('[data-tab=events]').click(); GD.globe.st.map.jumpTo({center:[56.25,26.57],zoom:7.2,pitch:40,bearing:-15}); true");
  // Real click on the globe in point mode drops a feature.
  await ev("GD.eventsMap.setMode('point'); true");
  const pt = await ev("(() => { const r = document.getElementById('map').getBoundingClientRect(); return [r.left + r.width * 0.62, r.top + r.height * 0.6]; })()");
  for (const type of ["mousePressed", "mouseReleased"]) await c.send("Input.dispatchMouseEvent", { type, x: pt[0], y: pt[1], button: "left", clickCount: 1 });
  await sleep(400);
  // Route + zone + ring through the same tool API the clicks use.
  await ev(`(() => { const M = GD.eventsMap; M.setMode('line'); [[55.6,26.1],[56.0,26.4],[56.5,26.55],[57.0,26.3]].forEach(c => M.addVertex(c)); M.finish();
    M.setMode('polygon'); [[56.1,26.8],[56.6,26.85],[56.7,26.5],[56.2,26.45]].forEach(c => M.addVertex(c)); M.finish();
    M.setMode('ring'); M.addVertex([56.9,26.0]); M.setMode('select'); return true; })()`);
  const n1 = await ev("GD.state.episode.eventLayers.reduce((a, l) => a + l.features.length, 0)");
  console.log("event features:", n0, "->", n1);
  if (n1 !== n0 + 4) errors.push(`expected 4 new event features (click point, route, zone, ring), got ${n1 - n0}`);
  await sleep(1500); await idle(); await sleep(800);
  const rendered = await ev("(() => { const m = GD.globe.st.map; const q = (l) => m.queryRenderedFeatures({ layers: [l] }).length; return { pt: q('ev-pt'), line: q('ev-line'), zone: q('ev-zone-fill'), ripple: q('ev-ripple'), head: q('ev-head'), labels: GD.eventsMap.labels().length, readable: document.querySelectorAll('#readable li').length }; })()");
  console.log("rendered:", JSON.stringify(rendered));
  ["pt", "line", "zone", "ripple", "head"].forEach((k) => { if (!(rendered[k] > 0)) errors.push("no rendered " + k); });
  if (!(rendered.readable > 0)) errors.push("readable panel lists no events");
  await shot("07-event-layers-draw-hormuz.png");
  // Strict validation of the new features + GeoJSON/CSV/KML round trip in the page.
  const rt = await ev(`(() => { const E = GD.events, l = GD.eventsMap.currentLayer(); const v = GD.model.validate(GD.state.episode);
    const g = E.fromGeoJSON(JSON.parse(JSON.stringify(E.toGeoJSON(l)))).layer.features.length, csv = E.fromCSV(E.toCSV(l)).layer.features.length, kml = E.fromKML(E.toKML(l)).layer.features.length;
    return { errs: v, n: l.features.length, g, csv, kml }; })()`);
  console.log("round trip:", JSON.stringify(rt));
  if (rt.errs.length) errors.push("episode validation: " + rt.errs[0]);
  if (rt.g !== rt.n || rt.kml !== rt.n || rt.csv !== rt.n) errors.push("export/import round trip lost features");
  // Event clock: manual time before the demo date hides dated features.
  const hid = await ev("(() => { GD.state.eventClockMode = 'manual'; GD.state.eventClockManual = Date.UTC(2026, 9, 1); const a = GD.eventsMap.visibleFeatures().length; GD.state.eventClockMode = 'follow'; GD.state.eventClockManual = null; const b = GD.eventsMap.visibleFeatures().length; GD.eventsMap.refresh(); return [a, b]; })()");
  console.log("clock reveal (before, follow):", hid);
  if (!(hid[1] > hid[0])) errors.push("event clock did not hide earlier-dated features");
  // Auto-frame the demo layer, 9:16, then select a demo pin to show the editor.
  await ev("document.getElementById('asp916').click(); GD.eventsMap.frame(GD.state.episode.eventLayers[0].features); GD.eventsMap.select(GD.state.episode.eventLayers[0].features[1].id); GD.ui.renderInspector(); true");
  await sleep(2600); await idle(); await sleep(800);
  await shot("08-event-layers-frame-9x16-editor.png");
  await ev("document.getElementById('asp169').click(); GD.ui.selectStory(1); GD.playback.seek(16 + 9); true");
  await sleep(1500); await idle(); await sleep(800);
  await shot("09-event-label-street-16x9.png");
} catch (e) { errors.push("SMOKE: " + e.message); }
finally {
  console.log("warnings:", warnings.length, warnings.slice(0, 5));
  console.log("network errors:", netFail.length, netFail.slice(0, 5));
  console.log("console errors:", errors.length); errors.forEach((e) => console.log("  ", e));
  chrome.kill(); server.kill();
  process.exit(errors.length ? 1 : 0);
}
