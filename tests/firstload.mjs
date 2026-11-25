#!/usr/bin/env node
// Empty-cache first-load check. Each mode gets a fresh Chrome profile with the HTTP cache disabled and
// service workers bypassed, then loads GlobeDesk with no saved state, exactly like a first visit.
// Modes: desktop (1280x800), phone (390x844, touch, mobile user agent) and lite (?lite=1 on the phone
// viewport). Every console error and warning is recorded and none is filtered; map-library ones
// (messages or stacks from vendor/maplibre-gl.js or naming MapLibre) are counted separately.
// The globe must load, have tiles drawn and paint a non-blank canvas. Screenshots go to FIRSTLOAD_SHOTS.
// Network is live by default (real first visit). FIRSTLOAD_OFFLINE=1 blocks every off-box host.
// Extensions are off (--disable-extensions): this box's managed Chrome force-installs a password manager
// and a WebAuthn proxy extension, and with them every in-flight fetch of the page is cancelled about
// 0.9 s after load (the sample JSON, the command poll and the street-map TileJSON at once, with no
// navigation and no AbortController involved). chrome-headless-shell and Chrome with extensions off do
// not do this. FIRSTLOAD_KEEP_EXTENSIONS=1 keeps them on to reproduce it.
// It also checks the first-open experience: the start guide shows, the sample is not loaded, Skip hides
// the guide and is remembered after a reload, Help reopens it, and ?lite=1 turns on Lite view.
// Usage: node tests/firstload.mjs [desktop phone lite]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.SMOKE_PORT || 8251);
const SHOTS = process.env.FIRSTLOAD_SHOTS || path.join(os.tmpdir(), "gd-firstload");
const OFFLINE = process.env.FIRSTLOAD_OFFLINE === "1";
const SETTLE_MS = Number(process.env.FIRSTLOAD_SETTLE_MS || 8000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const MODES = {
  desktop: { w: 1280, h: 800, query: "" },
  phone: { w: 390, h: 844, query: "", mobile: true },
  lite: { w: 390, h: 844, query: "?lite=1", mobile: true },
};
const want = process.argv.slice(2).filter((m) => MODES[m]);
const modes = want.length ? want : Object.keys(MODES);
fs.mkdirSync(SHOTS, { recursive: true });

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

const isMapLib = (text, urls) => /maplibre/i.test(text) || urls.some((u) => /maplibre-gl/.test(u));

async function runMode(name, dbg) {
  const M = MODES[name];
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gd-firstload-" + name + "-"));
  const args = ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", `--remote-debugging-port=${dbg}`,
    `--window-size=${M.w},${M.h}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "--disk-cache-size=1", ...(process.env.FIRSTLOAD_KEEP_EXTENSIONS === "1" ? [] : ["--disable-extensions"]),
    "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "about:blank"];
  if (OFFLINE) args.splice(5, 0, "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1");
  const chrome = spawn(process.env.CHROME || "google-chrome", args, { stdio: "ignore" });
  const out = { mode: name, url: "", viewport: `${M.w}x${M.h}`, touch: !!M.mobile, errors: [], warnings: [], maplibErrors: [], maplibWarnings: [], netFailures: [], shots: {} };
  let c;
  try {
    await until(async () => (await fetch(`http://127.0.0.1:${dbg}/json/version`)).ok, 20000, "chrome");
    const list = await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json();
    c = new Cdp((list.find((p) => p.type === "page") || list[0]).webSocketDebuggerUrl); await c.ready;
    for (const d of ["Runtime", "Log", "Page", "Network"]) await c.send(d + ".enable");
    await c.send("Network.setCacheDisabled", { cacheDisabled: true });
    await c.send("Network.setBypassServiceWorker", { bypass: true });
    await c.send("Network.clearBrowserCache"); await c.send("Network.clearBrowserCookies");
    if (M.mobile) {
      await c.send("Emulation.setDeviceMetricsOverride", { width: M.w, height: M.h, deviceScaleFactor: 3, mobile: true });
      await c.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      await c.send("Emulation.setUserAgentOverride", { userAgent: PHONE_UA, platform: "iPhone" });
    } else {
      await c.send("Emulation.setDeviceMetricsOverride", { width: M.w, height: M.h, deviceScaleFactor: 1, mobile: false });
    }
    const record = (level, text, urls) => {
      const item = { level, text: String(text).slice(0, 400), urls: urls.slice(0, 3) };
      const err = /error|assert/i.test(level);
      (err ? out.errors : out.warnings).push(item);
      if (isMapLib(text, urls)) (err ? out.maplibErrors : out.maplibWarnings).push(item);
    };
    const frames = (st) => ((st && st.callFrames) || []).map((f) => f.url).filter(Boolean);
    c.on("Log.entryAdded", (p) => { const e = p.entry || {}; if (/error|warning/.test(e.level) && e.source !== "network") record(e.level, `${e.source}: ${e.text}`, [e.url || "", ...frames(e.stackTrace)]); });
    c.on("Runtime.consoleAPICalled", (p) => { if (/error|assert|warning/.test(p.type)) record(p.type, (p.args || []).map((a) => a.value ?? a.description ?? a.type).join(" "), frames(p.stackTrace)); });
    c.on("Runtime.exceptionThrown", (p) => { const d = p.exceptionDetails || {}; record("error", "exception " + ((d.exception && d.exception.description) || d.text), [d.url || "", ...frames(d.stackTrace)]); });
    const reqUrl = new Map();
    c.on("Network.requestWillBeSent", (p) => reqUrl.set(p.requestId, p.request.url));
    c.on("Network.loadingFailed", (p) => { if (process.env.FIRSTLOAD_NETLOG) console.log("net fail", p.canceled ? "canceled" : "", p.errorText, p.blockedReason || p.corsErrorStatus && JSON.stringify(p.corsErrorStatus) || "", reqUrl.get(p.requestId)); if (!p.canceled) out.netFailures.push(`${p.errorText} ${String(reqUrl.get(p.requestId) || "").slice(0, 120)}`); });
    const ev = async (expr) => { const r = await c.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
    out.url = `http://127.0.0.1:${PORT}/${M.query}`;
    await c.send("Page.navigate", { url: out.url });
    await until(() => ev("!!(window.__globedesk && window.__globedesk.ready && GD.globe.st.status === 'ready')"), 45000, "app ready");
    // Wait for the map to settle: style loaded, all tiles loaded (or SETTLE_MS more at most).
    const t0 = Date.now();
    await until(() => ev("(() => { const m = GD.globe.st.map; return !!(m && m.isStyleLoaded() && m.areTilesLoaded()); })()"), 30000, "tiles loaded").catch(() => {});
    await sleep(Math.max(1500, SETTLE_MS - (Date.now() - t0)));
    out.settle = await until(() => ev("(() => { const m = GD.globe.st.map; return !!(m && m.isStyleLoaded() && m.areTilesLoaded()); })()"), 20000, "settled").then(() => "settled", () => "not settled after 20 s");
    out.state = await ev(`(() => { const m = GD.globe.st.map; const st = m.style; const tms = st.tileManagers || st.sourceCaches || {};
      let tiles = 0, withData = 0; Object.values(tms).forEach((tm) => { tiles += tm.getIds ? tm.getIds().length : 0; withData += tm.getRenderableIds ? tm.getRenderableIds().length : 0; });
      const cv = m.getCanvas();
      return { base: GD.globe.st.baseId, projection: (m.getProjection && m.getProjection() || {}).type || null, styleLoaded: m.isStyleLoaded(), tilesLoaded: m.areTilesLoaded(),
        tiles, tilesWithData: withData, canvas: cv.width + "x" + cv.height, lite: document.body.classList.contains("lite"),
        guide: !!(document.getElementById("startGuide") && !document.getElementById("startGuide").hidden),
        guideStep: GD.startGuide && GD.startGuide.st.step, layersHintHidden: !!(document.getElementById("layersHint") || {}).hidden,
        episode: GD.state && GD.state.episode && GD.state.episode.id, show: GD.state && GD.state.episode && GD.state.episode.show || null,
        title: GD.state && GD.state.episode && GD.state.episode.title, view: document.body.className }; })()`);
    const shot = async (label) => {
      const r = await c.send("Page.captureScreenshot", { format: "png" });
      const f = path.join(SHOTS, `${name}-${label}.png`); fs.writeFileSync(f, Buffer.from(r.data, "base64")); out.shots[label] = f;
      return r.data.length;
    };
    await shot("first-open");
    // Non-blank globe: a screenshot of the map area alone must not be a flat colour (a flat PNG is tiny).
    const rect = await ev(`(() => { const r = document.getElementById("map").getBoundingClientRect(); return { x: r.x, y: r.y, width: Math.max(1, r.width), height: Math.max(1, r.height) }; })()`);
    const mapPng = await c.send("Page.captureScreenshot", { format: "png", clip: { ...rect, scale: 1 } });
    out.mapPngBytes = Buffer.from(mapPng.data, "base64").length;
    out.globeDrawn = !!(out.state.styleLoaded && out.state.tilesWithData > 0 && out.mapPngBytes > 15000);
    // First-open experience.
    const fo = { guideOnFirstOpen: out.state.guide && out.state.guideStep === 0, sampleNotDefault: out.state.show !== "washington-dc-demo" && !/washington/i.test(out.state.title || ""), liteOk: out.state.lite === (name === "lite") };
    fo.mainButtons = await ev(`["btnReset","btnLayers","btnAtlas","btnHelp","btnLiteToggle"].map((id) => { const b = document.getElementById(id); const r = b && b.getBoundingClientRect(); return { id, label: b ? b.textContent.trim() : null, visible: !!(r && r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight) }; })`);
    fo.noSideScroll = await ev(`document.documentElement.scrollWidth <= innerWidth + 1`);
    fo.allLabelled = fo.mainButtons.every((b) => b.visible && b.label && /[A-Za-z]{3,}/.test(b.label));
    await ev(`document.getElementById("sgSkip").click()`); await sleep(400);
    fo.skipHides = await ev(`document.getElementById("startGuide").hidden && localStorage.getItem("globedesk.guide.v1") === "done"`);
    await shot("globe-after-skip");
    await c.send("Page.reload", { ignoreCache: true });
    await until(() => ev("!!(window.__globedesk && window.__globedesk.ready && GD.globe.st.status === 'ready')"), 45000, "app ready after reload");
    await sleep(1500);
    fo.rememberedAfterReload = await ev(`document.getElementById("startGuide").hidden`);
    fo.liteKept = await ev(`document.body.classList.contains("lite")`) === (name === "lite");
    await ev(`document.getElementById("btnHelp").click()`); await sleep(300);
    fo.helpReopens = await ev(`!document.getElementById("startGuide").hidden && GD.startGuide.st.step === 0`);
    await shot("help-reopened");
    await ev(`document.getElementById("sgSkip").click()`);
    fo.homeWorks = await ev(`(() => { const m = GD.globe.st.map; m.jumpTo({ center: [100, -30], zoom: 4 }); document.getElementById("btnReset").click(); return new Promise((r) => setTimeout(() => { const c = m.getCenter(); r(Math.abs(c.lng - 100) > 20 || Math.abs(c.lat + 30) > 10); }, 2500)); })()`);
    out.firstOpen = fo;
    out.firstOpenPass = Object.values(fo).every((v) => v === true || Array.isArray(v));
  } catch (e) {
    out.failure = String(e && e.message || e);
  } finally {
    try { c && c.ws.close(); } catch {}
    chrome.kill("SIGKILL");
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
  out.pass = !out.failure && out.maplibErrors.length === 0 && out.maplibWarnings.length === 0 && out.errors.length === 0 && out.globeDrawn && out.firstOpenPass !== false;
  return out;
}

const server = spawn(process.env.PYTHON || "python3", ["-B", "tools/serve.py", String(PORT)], {
  cwd: root, stdio: "ignore",
  env: { ...process.env, GLOBEDESK_NO_BROWSER: "1", GLOBEDESK_DATA: fs.mkdtempSync(path.join(os.tmpdir(), "gd-firstload-data-")), PYTHONDONTWRITEBYTECODE: "1" },
});
let allPass = true;
const results = [];
try {
  await until(async () => (await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok, 20000, "server");
  let dbg = Number(process.env.SMOKE_DBG || 9461);
  for (const m of modes) { const r = await runMode(m, dbg++); results.push(r); allPass = allPass && r.pass; }
} finally { server.kill("SIGKILL"); }
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"} ${r.mode}: console errors ${r.errors.length}, warnings ${r.warnings.length}, map-library errors ${r.maplibErrors.length}, map-library warnings ${r.maplibWarnings.length}, globe drawn ${r.globeDrawn} (${JSON.stringify(r.state || {})}, map png ${r.mapPngBytes} bytes)${r.failure ? " failure: " + r.failure : ""}`);
  for (const x of [...r.errors, ...r.warnings]) console.log(`  ${x.level}: ${x.text} ${x.urls.filter(Boolean).join(" ")}`);
  if (r.firstOpen) console.log(`  first open: ${JSON.stringify(r.firstOpen)}`);
  console.log(`  network failures (not console messages): ${r.netFailures.length}${r.netFailures.length ? " e.g. " + r.netFailures.slice(0, 3).join(" | ") : ""}`);
  console.log(`  screenshots: ${Object.values(r.shots).join(", ")}`);
}
fs.writeFileSync(path.join(SHOTS, "firstload-results.json"), JSON.stringify(results, null, 2));
process.exit(allPass ? 0 : 1);
