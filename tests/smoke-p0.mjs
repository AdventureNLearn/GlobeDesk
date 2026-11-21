#!/usr/bin/env node
// P0 smoke: load the globe in headless Chrome, count 'performance warning' console/log
// messages, and check that a short WebM export produces frames.
// Usage: node tests/smoke-p0.mjs
import { spawn } from "node:child_process"; import path from "node:path"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8101, DBG = 9341, W = 1280, H = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WARN_RE = /performance warning|READ-usage buffer|shadow copy that was created to accelerate readback/i;
const warnings = [], allConsole = [], errors = [];
const chromeBin = process.env.CHROME || "google-chrome";
const chromeFlags = [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  `--remote-debugging-port=${DBG}`, `--window-size=${W},${H}`,
  "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required",
  "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "about:blank"
];
// SwiftShader (same as tests/smoke.mjs) so this can run on a box with no GPU.
// Desktop-GPU READ-usage warnings may not appear here; counts are still reported.
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
const chrome = spawn(chromeBin, chromeFlags, { stdio: "ignore" });
async function until(fn, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); }
  throw new Error("timeout: " + label);
}
class Cdp {
  constructor(u) {
    this.ws = new WebSocket(u); this.id = 0; this.p = new Map(); this.h = {};
    this.ready = new Promise((r, j) => { this.ws.onopen = r; this.ws.onerror = j; });
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.method && this.h[m.method]) this.h[m.method](m.params);
      if (m.id && this.p.has(m.id)) { const { r, j } = this.p.get(m.id); this.p.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); }
    };
  }
  on(m, f) { this.h[m] = f; }
  send(method, params = {}) { const id = ++this.id; return new Promise((r, j) => { this.p.set(id, { r, j }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
let c;
const ev = async (expr) => {
  const r = await c.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
const noteWarn = (text) => {
  const t = String(text || "");
  allConsole.push(t);
  if (WARN_RE.test(t)) warnings.push(t);
};
try {
  await until(async () => (await fetch(`http://127.0.0.1:${DBG}/json/version`)).ok, 20000, "chrome");
  await until(async () => (await fetch(`http://127.0.0.1:${PORT}/`)).ok, 10000, "server");
  const page = await (await fetch(`http://127.0.0.1:${DBG}/json/new?about:blank`, { method: "PUT" })).json();
  c = new Cdp(page.webSocketDebuggerUrl); await c.ready;
  for (const d of ["Runtime", "Page", "Log"]) await c.send(d + ".enable");
  c.on("Runtime.consoleAPICalled", (p) => {
    const t = (p.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
    if (p.type === "error") errors.push(t);
    noteWarn(t);
  });
  c.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text));
  c.on("Log.entryAdded", (p) => { noteWarn(`${p.entry.text} ${p.entry.url || ""}`); if (p.entry.level === "error") errors.push(p.entry.text); });
  await c.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: false });
  await c.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html?sample=1` });
  await until(() => ev("window.__globedesk && window.__globedesk.ready && GD.globe.st.status === 'ready'"), 30000, "app ready");
  const base = await ev("GD.globe.st.baseId");
  await ev("GD.globe.st.map.jumpTo({center:[40,28],zoom:1.8,pitch:45,bearing:20}); true");
  await sleep(4000);
  const warnBeforeExport = warnings.length;
  const pdbIdle = await ev(`(() => {
    if (GD.globe && GD.globe.isDrawingBufferPreserved) return GD.globe.isDrawingBufferPreserved();
    const canvas = GD.globe.st.map.getCanvas();
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("webgl2", { preserveDrawingBuffer: true }) || canvas.getContext("webgl", { preserveDrawingBuffer: true });
    return !!(gl && gl.getContextAttributes && gl.getContextAttributes().preserveDrawingBuffer);
  })()`);
  const rec = await ev(`(async () => {
    await GD.recorder.start("16:9");
    const pdbDuring = (GD.globe && GD.globe.isDrawingBufferPreserved)
      ? GD.globe.isDrawingBufferPreserved()
      : (() => {
          const canvas = GD.globe.st.map.getCanvas();
          const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
          return !!(gl && gl.getContextAttributes && gl.getContextAttributes().preserveDrawingBuffer);
        })();
    await new Promise((r) => setTimeout(r, 2000));
    const rec = GD.recorder._rec;
    const out = rec.canvas;
    const ctx = rec.ctx;
    const sample = ctx.getImageData(Math.floor(out.width / 2), Math.floor(out.height / 2), 1, 1).data;
    const pixelSum = sample[0] + sample[1] + sample[2] + sample[3];
    // Prefer official stop (no download). Fall back to a raw MediaRecorder stop.
    let bytes = 0, pdbAfter = null;
    if (GD.recorder.stop) {
      const blob = await GD.recorder.stop("p0-smoke.webm", { download: false });
      bytes = blob && blob.size || 0;
      if (GD.globe && GD.globe.isDrawingBufferPreserved) pdbAfter = GD.globe.isDrawingBufferPreserved();
    } else {
      cancelAnimationFrame(rec.raf);
      bytes = await new Promise((res) => { rec.mr.onstop = () => res(rec.chunks.reduce((a, b) => a + b.size, 0)); rec.mr.stop(); rec.mr = null; });
    }
    return { bytes, pixelSum, pdbDuring, pdbAfter, w: out.width, h: out.height };
  })()`);
  const stacked = await ev(`(() => {
    const base = GD.globe.st.baseId;
    const bm = !!GD.globe.st.overlays.bluemarble;
    const policy = GD.render && GD.render.rastersStacked ? GD.render.rastersStacked(base, GD.globe.st.overlays) : null;
    return { base, bluemarble: bm, stacked: policy };
  })()`);
  await sleep(500);
  const result = {
    base,
    pdbIdle,
    warnIdle: warnBeforeExport,
    warnTotal: warnings.length,
    warnSamples: warnings.slice(0, 5),
    rec,
    stacked,
    errors: errors.slice(0, 8)
  };
  console.log("P0_SMOKE " + JSON.stringify(result));
  console.log("P0_WARN_COUNT " + warnings.length);
  if (rec && !(rec.bytes > 0)) {
    console.error("export produced no bytes");
    process.exitCode = 1;
  }
  if (rec && !(rec.pixelSum > 0)) {
    console.error("export canvas sample was empty");
    process.exitCode = 1;
  }
} catch (e) {
  console.error("P0 smoke failed:", e && e.stack || e);
  process.exitCode = 1;
} finally {
  try { if (c && c.ws) c.ws.close(); } catch {}
  try { chrome.kill("SIGKILL"); } catch {}
  try { server.kill("SIGKILL"); } catch {}
  setTimeout(() => process.exit(process.exitCode || 0), 400);
}
