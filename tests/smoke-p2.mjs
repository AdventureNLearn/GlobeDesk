#!/usr/bin/env node
// P2 smoke: serve.py + headless Chrome. Region pack offline, origin check,
// 0 console errors and 0 performance/READ-usage warnings.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.SMOKE_PORT || 8211);
const DBG = Number(process.env.SMOKE_DBG || 9431);
const W = 1280, H = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WARN_RE = /performance warning|READ-usage buffer|shadow copy that was created to accelerate readback/i;
const warnings = [], errors = [], allConsole = [];
const chromeBin = process.env.CHROME || "google-chrome";
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gd-smoke-p2-"));
const downloads = path.join(profile, "downloads");
fs.mkdirSync(downloads);
const dataDir = path.join(root, "globedesk-data");

const server = spawn("python3", ["-B", "tools/serve.py", String(PORT)], {
  cwd: root,
  stdio: "ignore",
  env: {
    ...process.env,
    GLOBEDESK_NO_BROWSER: "1",
    GLOBEDESK_OFFLINE: "1",
    GLOBEDESK_DATA: dataDir,
    PYTHONDONTWRITEBYTECODE: "1",
  },
});
const chrome = spawn(chromeBin, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  `--remote-debugging-port=${DBG}`, `--window-size=${W},${H}`,
  `--user-data-dir=${profile}`,
  `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1`,
  "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required",
  "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "about:blank",
], { stdio: "ignore" });

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

const origin = `http://127.0.0.1:${PORT}`;
async function tile(z, x, y, headers = {}) {
  const r = await fetch(`${origin}/tiles/eox2016/${z}/${x}/${y}.jpg`, { headers });
  return { status: r.status, source: r.headers.get("x-globedesk-tile-source"), len: Number(r.headers.get("content-length") || 0) };
}

let c, failed = false;
try {
  await until(async () => (await fetch(`http://127.0.0.1:${DBG}/json/version`)).ok, 20000, "chrome");
  await until(async () => (await fetch(`${origin}/api/packs`)).ok, 15000, "serve.py");

  const packs = await (await fetch(`${origin}/api/packs`)).json();
  const dc = (packs.regions || []).find((r) => r.id === "washington-dc");
  if (!dc || dc.tiles !== 131 || dc.bytes !== 1904640 || !dc.complete) {
    throw new Error("DC pack not complete in /api/packs: " + JSON.stringify(dc));
  }
  if (packs.cache.defaultCapBytes !== 32 * 1024 * 1024 * 1024) {
    throw new Error("default cache cap is not 32 GiB");
  }

  const appHeaders = { Origin: origin, Host: `127.0.0.1:${PORT}` };
  const otherHeaders = { Origin: "http://127.0.0.1:9", Host: `127.0.0.1:${PORT}` };
  const local = await tile(14, 4687, 6268, appHeaders);
  if (local.status !== 200 || local.source !== "local") {
    throw new Error("expected local pack tile, got " + JSON.stringify(local));
  }
  const other = await tile(14, 0, 0, otherHeaders);
  if (other.status !== 404) throw new Error("cross-origin miss should 404, got " + JSON.stringify(other));
  const appMiss = await tile(14, 0, 0, appHeaders);
  if (appMiss.status !== 404) throw new Error("offline miss should 404, got " + JSON.stringify(appMiss));

  const page = await (await fetch(`http://127.0.0.1:${DBG}/json/new?about:blank`, { method: "PUT" })).json();
  c = new Cdp(page.webSocketDebuggerUrl); await c.ready;
  for (const d of ["Runtime", "Page", "Log"]) await c.send(d + ".enable");
  const note = (text, isErr) => {
    const s = String(text || "");
    allConsole.push(s);
    if (WARN_RE.test(s)) warnings.push(s);
    if (isErr) errors.push(s);
  };
  c.on("Runtime.consoleAPICalled", (p) => {
    const t = (p.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
    note(t, p.type === "error");
  });
  c.on("Runtime.exceptionThrown", (p) => note(p.exceptionDetails.exception?.description || p.exceptionDetails.text, true));
  c.on("Log.entryAdded", (p) => note(`${p.entry.text} ${p.entry.url || ""}`, p.entry.level === "error"));
  await c.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads, eventsEnabled: true }).catch(() => {});
  await c.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloads }).catch(() => {});
  await c.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await c.send("Page.navigate", { url: `${origin}/index.html?sample=1&base=offline` });
  const ev = async (expr) => {
    const r = await c.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await until(() => ev("window.__globedesk && window.__globedesk.ready && GD.globe.st.status === 'ready'"), 30000, "app ready");
  await ev("GD.globe.setBase('offline'); true");
  await until(() => ev("GD.globe.st.baseId === 'offline' && GD.globe.st.status === 'ready' && GD.globe.st.map.isStyleLoaded()"), 15000, "offline ready");
  await ev("GD.globe.st.map.jumpTo({center:[-77.01,38.89],zoom:13,pitch:0,bearing:0}); true");
  await sleep(800);
  const overlay = await ev("GD.globe.setOverlay('eox-region', true); true");
  await until(() => ev("GD.globe.st.map.getLayer('gd-eox-region') && GD.globe.st.map.getLayoutProperty('gd-eox-region','visibility') === 'visible'"), 10000, "region layer");
  await sleep(2500);
  const info = await ev(`({
    base: GD.globe.st.baseId,
    overlay: !!GD.globe.st.overlays['eox-region'],
    proxy: !!(GD.layers.usesLocalBlueMarbleProxy && GD.layers.usesLocalBlueMarbleProxy()),
    tiles: GD.layers.eoxRegionTiles && GD.layers.eoxRegionTiles(),
    status: GD.globe.st.status
  })`);
  if (info.base !== "offline" || !info.overlay || !info.proxy) {
    throw new Error("region overlay not on local proxy: " + JSON.stringify(info));
  }
  if (!String(info.tiles).includes("/tiles/eox2016/")) {
    throw new Error("region tiles are not the local proxy: " + info.tiles);
  }

  const errText = errors.join("\n");
  const warnText = warnings.join("\n");
  console.log(JSON.stringify({
    ok: errors.length === 0 && warnings.length === 0,
    errors: errors.length,
    warnings: warnings.length,
    packTiles: dc.tiles,
    packBytes: dc.bytes,
    localTile: local,
    info,
  }, null, 2));
  if (errors.length) { console.error("ERRORS:\n" + errText); failed = true; }
  if (warnings.length) { console.error("WARNINGS:\n" + warnText); failed = true; }
  if (!failed) console.log("smoke-p2: 0 warnings, 0 errors");
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  try { if (c) await c.send("Browser.close"); } catch {}
  try { chrome.kill("SIGKILL"); } catch {}
  try { server.kill("SIGKILL"); } catch {}
  process.exit(failed ? 1 : 0);
}
