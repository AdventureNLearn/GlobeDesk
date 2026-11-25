#!/usr/bin/env node
// Touch gestures on the phone layout and in Lite view (390x844, touch, mobile user agent):
// one-finger drag pans the globe without rotating or tilting it; a two-finger pinch zooms, and a
// twisting pinch still does not rotate; a one-finger touch drag outside the map scrolls the page; a touch
// drag inside the Layers panel scrolls the panel. Touches are real CDP touch events (Input.dispatchTouchEvent;
// Input.synthesizeScrollGesture's touch mode does not scroll in this headless Chrome, so it is not used).
// Any console error fails the run.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.SMOKE_PORT || 8261);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const MODES = { phone: "?guide=0", lite: "?lite=1&guide=0" };

async function until(fn, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); }
  throw new Error("timeout: " + label);
}
class Cdp {
  constructor(u) {
    this.ws = new WebSocket(u); this.id = 0; this.p = new Map(); this.h = {};
    this.ready = new Promise((r, j) => { this.ws.onopen = r; this.ws.onerror = j; });
    this.ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.method && this.h[m.method]) this.h[m.method](m.params); if (m.id && this.p.has(m.id)) { const { r, j } = this.p.get(m.id); this.p.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } };
  }
  on(m, f) { this.h[m] = f; }
  send(method, params = {}) { const id = ++this.id; return new Promise((r, j) => { this.p.set(id, { r, j }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}

async function runMode(name, dbg) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gd-touch-"));
  const chrome = spawn(process.env.CHROME || "google-chrome", ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-extensions",
    `--remote-debugging-port=${dbg}`, "--window-size=390,844", `--user-data-dir=${profile}`, "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1",
    "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "about:blank"], { stdio: "ignore" });
  const errors = [], res = { mode: name };
  let c;
  try {
    await until(async () => (await fetch(`http://127.0.0.1:${dbg}/json/version`)).ok, 20000, "chrome");
    const list = await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json();
    c = new Cdp((list.find((p) => p.type === "page") || list[0]).webSocketDebuggerUrl); await c.ready;
    await c.send("Runtime.enable"); await c.send("Page.enable");
    c.on("Runtime.consoleAPICalled", (p) => { if (p.type === "error") errors.push((p.args || []).map((a) => a.value ?? a.description).join(" ")); });
    c.on("Runtime.exceptionThrown", (p) => errors.push(String((p.exceptionDetails.exception || {}).description || p.exceptionDetails.text)));
    await c.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await c.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await c.send("Emulation.setUserAgentOverride", { userAgent: UA, platform: "iPhone" });
    const ev = async (expr) => { const r = await c.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + expr.slice(0, 80)); return r.result.value; };
    await c.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/${MODES[name]}` });
    await until(() => ev("!!(window.__globedesk && window.__globedesk.ready && GD.globe.st.status === 'ready')"), 45000, "ready");
    await sleep(1500);
    const cam = () => ev(`(() => { const m = GD.globe.st.map; const c = m.getCenter(); return { lng: c.lng, lat: c.lat, zoom: m.getZoom(), bearing: m.getBearing(), pitch: m.getPitch() }; })()`);
    const settle = async () => { await until(() => ev("!GD.globe.st.map.isMoving()"), 8000, "map still").catch(() => {}); await sleep(300); };
    // Map box in viewport coordinates; scroll it into view first.
    await ev(`document.getElementById("map").scrollIntoView({ block: "center" })`); await sleep(300);
    const box = await ev(`(() => { const r = document.getElementById("map").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
    res.mapBox = box;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const touch = (type, pts) => c.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i, radiusX: 4, radiusY: 4, force: 1 })) });
    const drag = async (from, to, steps = 12) => {
      await touch("touchStart", from);
      for (let i = 1; i <= steps; i++) { const f = i / steps; await touch("touchMove", from.map(([x, y], k) => [x + (to[k][0] - x) * f, y + (to[k][1] - y) * f])); await sleep(16); }
      await touch("touchEnd", []);
    };
    // Make the camera deterministic: no ongoing story motion.
    await ev(`(() => { const m = GD.globe.st.map; m.stop(); m.jumpTo({ center: [10, 20], zoom: 2, bearing: 0, pitch: 0 }); })()`); await settle();
    // 1) one finger pans
    const a0 = await cam();
    await drag([[cx - 60, cy]], [[cx + 60, cy + 30]]); await settle();
    const a1 = await cam();
    res.oneFinger = { before: a0, after: a1 };
    res.oneFingerPans = (Math.abs(a1.lng - a0.lng) > 1 || Math.abs(a1.lat - a0.lat) > 1) && Math.abs(a1.bearing - a0.bearing) < 0.5 && Math.abs(a1.pitch - a0.pitch) < 0.5 && Math.abs(a1.zoom - a0.zoom) < 0.2; // the globe projection nudges zoom with latitude while panning
    // 2) two-finger spread zooms in, no rotate or tilt
    const b0 = await cam();
    await drag([[cx - 30, cy], [cx + 30, cy]], [[cx - 110, cy], [cx + 110, cy]]); await settle();
    const b1 = await cam();
    res.pinch = { before: b0, after: b1 };
    res.pinchZooms = b1.zoom - b0.zoom > 0.3 && Math.abs(b1.bearing - b0.bearing) < 0.5 && Math.abs(b1.pitch - b0.pitch) < 0.5;
    // 3) twisting pinch (fingers rotate ~60 degrees) still does not rotate
    const t0 = await cam();
    const r = 70, ang = Math.PI / 3;
    await drag([[cx - r, cy], [cx + r, cy]], [[cx - r * Math.cos(ang), cy - r * Math.sin(ang)], [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]], 16); await settle();
    const t1 = await cam();
    res.twist = { before: t0, after: t1 };
    res.twistNoRotate = Math.abs(t1.bearing - t0.bearing) < 0.5 && Math.abs(t1.pitch - t0.pitch) < 0.5;
    // 4) two fingers moving up together (the old tilt gesture) does not tilt
    const p0 = await cam();
    await drag([[cx - 40, cy + 40], [cx + 40, cy + 40]], [[cx - 40, cy - 40], [cx + 40, cy - 40]]); await settle();
    const p1 = await cam();
    res.twoFingerUpNoTilt = Math.abs(p1.pitch - p0.pitch) < 0.5 && Math.abs(p1.bearing - p0.bearing) < 0.5;
    // 5) page scroll outside the map (phone: below the stage; lite: the page may be too short to scroll)
    await ev("window.scrollTo(0, 0)"); await sleep(200);
    const scrollable = await ev("document.documentElement.scrollHeight > innerHeight + 20");
    if (scrollable) {
      const yOut = await ev(`(() => { const r = document.getElementById("map").getBoundingClientRect(); return Math.min(innerHeight - 40, Math.max(r.bottom + 40, 60)); })()`);
      const s0 = await ev("scrollY");
      await drag([[195, yOut]], [[195, yOut - 250]], 10);
      await sleep(400);
      res.pageScroll = { before: s0, after: await ev("scrollY"), at: Math.round(yOut) };
      res.pageScrolls = res.pageScroll.after > s0 + 50;
    } else { res.pageScroll = "page fits the screen (nothing to scroll)"; res.pageScrolls = true; }
    // 6) panel scroll: Layers panel content scrolls with a touch drag
    await ev("window.scrollTo(0, 0)"); await ev(`GD.layersPanel.open()`); await sleep(500);
    const pb = await ev(`(() => { const el = document.getElementById("layersPanelBody"); const sc = [el, el.parentElement, document.getElementById("layersPanel")].find((x) => x && x.scrollHeight > x.clientHeight + 10); if (!sc) return null; sc.id = sc.id || "gdTouchScroller"; sc.scrollTop = 0; const r = sc.getBoundingClientRect(); return { id: sc.id, x: r.x + r.width / 2, y: r.y + r.height / 2, sh: sc.scrollHeight, ch: sc.clientHeight }; })()`);
    if (pb) {
      await drag([[pb.x, pb.y + 80]], [[pb.x, pb.y - 120]], 10);
      await sleep(400);
      res.panelScroll = { id: pb.id, scrollTop: await ev(`document.getElementById(${JSON.stringify(pb.id)}).scrollTop`) };
      res.panelScrolls = res.panelScroll.scrollTop > 40;
    } else { res.panelScroll = "Layers panel content fits (not scrollable)"; res.panelScrolls = false; }
    await ev(`GD.layersPanel.close()`);
    res.gestureConfig = await ev(`(() => { const m = GD.globe.st.map; return { coop: m.cooperativeGestures.isEnabled(), dragPan: m.dragPan.isEnabled(), touchZoomRotate: m.touchZoomRotate.isEnabled(), touchPitch: m.touchPitch.isEnabled() }; })()`);
  } catch (e) { res.failure = String(e && e.message || e); }
  finally { try { c && c.ws.close(); } catch {} chrome.kill("SIGKILL"); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }
  res.errors = errors;
  res.pass = !res.failure && !errors.length && ["oneFingerPans", "pinchZooms", "twistNoRotate", "twoFingerUpNoTilt", "pageScrolls", "panelScrolls"].every((k) => res[k] === true);
  return res;
}

const server = spawn(process.env.PYTHON || "python3", ["-B", "tools/serve.py", String(PORT)], { cwd: root, stdio: "ignore",
  env: { ...process.env, GLOBEDESK_NO_BROWSER: "1", GLOBEDESK_OFFLINE: "1", GLOBEDESK_DATA: fs.mkdtempSync(path.join(os.tmpdir(), "gd-touch-data-")), PYTHONDONTWRITEBYTECODE: "1" } });
let ok = true;
try {
  await until(async () => (await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok, 20000, "server");
  let dbg = 9481;
  for (const m of Object.keys(MODES)) { const r = await runMode(m, dbg++); ok = ok && r.pass; console.log(JSON.stringify(r)); console.log(`${r.pass ? "PASS" : "FAIL"} touch ${m}`); }
} finally { server.kill("SIGKILL"); }
console.log(ok ? "smoke-touch: phone and lite ok" : "smoke-touch: FAILED");
process.exit(ok ? 0 : 1);
