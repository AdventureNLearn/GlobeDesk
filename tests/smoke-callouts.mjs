#!/usr/bin/env node
// Headless check for multi-card callouts on the globe (desktop 1920x1080 and phone 390x844).
// Opens 6 Levant / East Med cards (two share a pin) plus a tight test trio, steps zoom 1.5 -> 3 -> 6 -> 12,
// then runs one continuous zoom. Asserts: 0 console errors, 0 card overlaps (cards, blocked UI, rings),
// every ring inside its clamps, every leader ending on its own ring, no mode flicker while zooming.
// Usage: node tests/smoke-callouts.mjs   (CHROME overrides the browser; SHOTS_DIR sets where screenshots go)
import { spawn } from "node:child_process"; import fs from "node:fs/promises"; import path from "node:path"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8097, DBG = 9337;
const SHOTS = process.env.SHOTS_DIR ? path.resolve(process.env.SHOTS_DIR) : path.join(root, "shots", "callouts");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [], fails = [];
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
const chrome = spawn(process.env.CHROME || "google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", `--remote-debugging-port=${DBG}`, "--window-size=1920,1080", "--hide-scrollbars", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "about:blank"], { stdio: "ignore" });
async function until(fn, ms, label) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch {} await sleep(300); } throw new Error("timeout: " + label); }
class Cdp { constructor(u) { this.ws = new WebSocket(u); this.id = 0; this.p = new Map(); this.h = {}; this.ready = new Promise((r, j) => { this.ws.onopen = r; this.ws.onerror = j; });
  this.ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.method && this.h[m.method]) this.h[m.method](m.params); if (m.id && this.p.has(m.id)) { const { r, j } = this.p.get(m.id); this.p.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } }; }
  on(m, f) { this.h[m] = f; } send(method, params = {}) { const id = ++this.id; return new Promise((r, j) => { this.p.set(id, { r, j }); this.ws.send(JSON.stringify({ id, method, params })); }); } }
let c;
const ev = async (expr) => { const r = await c.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const shot = async (name) => { const r = await c.send("Page.captureScreenshot", { format: "png" }); await fs.writeFile(path.join(SHOTS, name), Buffer.from(r.data, "base64")); console.log("shot", name); };
const idle = () => until(() => ev("GD.globe.st.map.loaded() && GD.globe.st.map.areTilesLoaded()"), 6000, "tiles").catch(() => console.log("note: tiles still loading at timeout"));

const LEVANT = ["syria-jordan-rail", "jordan-desal", "gaza-basin", "gaza-paper", "cyprus-aca", "cop31"];
// Checks run inside the page against the last painted frame.
const CHECK = `(() => {
  const L = GD.callouts.last(); const out = { zoom: +GD.globe.st.map.getZoom().toFixed(2), items: L.items.length, placed: 0, chips: 0, clusters: 0, bad: [] };
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const circ = (cx, cy, r, b) => { const nx = Math.max(b.x, Math.min(cx, b.x + b.w)), ny = Math.max(b.y, Math.min(cy, b.y + b.h)); return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r; };
  L.items.forEach((it, i) => {
    if (it.ring.r < L.clamps.min - 0.01 || it.ring.r > L.clamps.max + 0.01) out.bad.push("ring out of clamps " + it.id + " r=" + it.ring.r.toFixed(1));
    if (it.count > 1) out.clusters++;
    if (!it.box) return; out.placed++; if (it.mode === "chip") out.chips++;
    const b = it.box;
    if (b.x < 0 || b.y < 0 || b.x + b.w > L.W || b.y + b.h > L.H) out.bad.push("card off frame " + it.id);
    L.items.forEach((o, j) => { if (j !== i && o.box && hit(b, o.box)) out.bad.push("card overlap " + it.id + " / " + o.id); if (circ(o.ring.x, o.ring.y, o.ring.r, b)) out.bad.push("card covers ring " + o.id); });
    L.blocked.forEach((k) => { if (hit(b, k)) out.bad.push("card over UI " + it.id); });
    const d = Math.hypot(it.leader.x2 - it.ring.x, it.leader.y2 - it.ring.y);
    if (Math.abs(d - it.ring.r) > 0.5) out.bad.push("leader misses its ring " + it.id + " d=" + d.toFixed(1) + " r=" + it.ring.r.toFixed(1));
    const own = it.leader.x1 >= b.x - 0.5 && it.leader.x1 <= b.x + b.w + 0.5 && it.leader.y1 >= b.y - 0.5 && it.leader.y1 <= b.y + b.h + 0.5;
    if (!own) out.bad.push("leader not attached to its card " + it.id);
  });
  return out;
})()`;

async function scenario(device) {
  const phone = device === "mobile", W = phone ? 390 : 1920, H = phone ? 844 : 1080;
  await c.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: phone ? 2 : 1, mobile: phone });
  await c.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html?sample=1&callouts=${LEVANT.join(",")}` });
  await until(() => ev("window.__globedesk && window.__globedesk.ready && GD.globe.st.status === 'ready'"), 30000, "app ready");
  const opened = await ev("GD.callouts.state.open.length");
  if (opened !== LEVANT.length) fails.push(`${device}: ?callouts= opened ${opened}/${LEVANT.length}`);
  // A story outside the set is active so the docked story card is visible too (it must be avoided).
  const views = { 1.5: [34.5, 33], 3: [34.8, 33], 6: [35.2, 32.4], 12: [34.47, 31.5] };
  for (const z of [1.5, 3, 6, 12]) {
    await ev(`GD.globe.st.map.jumpTo({ center: [${views[z]}], zoom: ${z}, pitch: 0, bearing: 0 }); true`);
    await idle(); await sleep(900);
    const r = await ev(CHECK);
    console.log(device, "z" + z, JSON.stringify({ items: r.items, placed: r.placed, chips: r.chips, clusters: r.clusters, bad: r.bad.length }));
    r.bad.forEach((b) => fails.push(`${device} z${z}: ${b}`));
    if (r.placed < 1) fails.push(`${device} z${z}: no card placed`);
    await shot(`multi-card-zoom-${device}-z${z}.png`);
  }
  // Pitched and rotated: leaders still land on their rings.
  await ev("GD.globe.st.map.jumpTo({ center: [35.2, 32.4], zoom: 6, pitch: 50, bearing: 25 }); true");
  await idle(); await sleep(900);
  { const r = await ev(CHECK); r.bad.forEach((b) => fails.push(`${device} pitched: ${b}`)); console.log(device, "pitched", JSON.stringify({ placed: r.placed, bad: r.bad.length })); await shot(`multi-card-zoom-${device}-z6-pitched.png`); }
  // Tight trio (in memory only, never saved): three pins a few km apart, so they cluster when zoomed out and split at z12.
  await ev(`(() => {
    const ep = GD.state.episode; GD.callouts.clear();
    [["callout-test-a", 52.372, 4.893], ["callout-test-b", 52.364, 4.910], ["callout-test-c", 52.380, 4.876]].forEach(([slug, lat, lon], i) => {
      ep.stories.push({ id: "tst" + i, slug, title: "Test card " + "ABC"[i], location: { lat, lon, label: "test" }, cards: [{ body: "Synthetic test card " + (i + 1) + ", used only by this check." }], sources: [], asReported: true, cue: {} });
      GD.callouts.open("tst" + i);
    });
    return true; })()`);
  for (const z of [1.5, 3, 6, 12]) {
    await ev(`GD.globe.st.map.jumpTo({ center: [4.89, 52.372], zoom: ${z}, pitch: 0, bearing: 0 }); true`);
    await idle(); await sleep(700);
    const r = await ev(CHECK);
    console.log(device, "trio z" + z, JSON.stringify({ items: r.items, placed: r.placed, chips: r.chips, clusters: r.clusters, bad: r.bad.length }));
    r.bad.forEach((b) => fails.push(`${device} trio z${z}: ${b}`));
    if (z <= 3 && r.clusters !== 1) fails.push(`${device} trio z${z}: expected one cluster badge, got ${r.clusters}`);
    if (z >= 12 && r.items !== 3) fails.push(`${device} trio z${z}: expected 3 split cards, got ${r.items}`);
    await shot(`multi-card-zoom-${device}-trio-z${z}.png`);
  }
  // Continuous zoom 1.5 -> 12 (per-frame checks + flicker count).
  const run = await ev(`new Promise((done) => {
    const m = GD.globe.st.map; m.jumpTo({ center: [4.89, 52.372], zoom: 1.5, pitch: 0, bearing: 0 });
    const frames = [], hist = new Map(); let flips = 0;
    const tick = () => {
      const L = GD.callouts.last();
      if (L && L.items) {
        const f = (${CHECK.replace(/`/g, "\\`")}); frames.push(f.bad.length);
        L.items.forEach((it) => { const key = it.ids.join("+"); const h = hist.get(key) || []; h.push([performance.now(), it.mode]); hist.set(key, h); });
      }
      if (m.isMoving() || frames.length < 5) requestAnimationFrame(tick);
      else {
        hist.forEach((h) => { for (let i = 2; i < h.length; i++) if (h[i][1] === h[i - 2][1] && h[i][1] !== h[i - 1][1] && h[i][0] - h[i - 2][0] < 300) flips++; });
        done({ frames: frames.length, badFrames: frames.filter((x) => x > 0).length, flips });
      }
    };
    setTimeout(() => { m.easeTo({ zoom: 12, duration: 4000 }); requestAnimationFrame(tick); }, 300);
  })`);
  console.log(device, "continuous zoom", JSON.stringify(run));
  if (run.badFrames) fails.push(`${device}: ${run.badFrames} frames with overlaps during continuous zoom`);
  if (run.flips) fails.push(`${device}: ${run.flips} chip/full flickers during continuous zoom`);
}
try {
  await fs.mkdir(SHOTS, { recursive: true });
  await until(async () => (await fetch(`http://127.0.0.1:${DBG}/json/version`)).ok, 15000, "chrome");
  await until(async () => (await fetch(`http://127.0.0.1:${PORT}/`)).ok, 10000, "server");
  const page = await (await fetch(`http://127.0.0.1:${DBG}/json/new?about:blank`, { method: "PUT" })).json();
  c = new Cdp(page.webSocketDebuggerUrl); await c.ready;
  for (const d of ["Runtime", "Page", "Log"]) await c.send(d + ".enable");
  c.on("Runtime.consoleAPICalled", (p) => { if (p.type === "error") errors.push(p.args.map((a) => a.value ?? a.description ?? "").join(" ")); });
  c.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text));
  c.on("Log.entryAdded", (p) => { if (p.entry.level === "error" && p.entry.source !== "network") errors.push(p.entry.text); });
  for (const d of ["desktop", "mobile"]) await scenario(d);
} catch (e) { fails.push("crash: " + e.message); }
finally { chrome.kill(); server.kill(); }
errors.forEach((e) => console.log("console error:", e));
fails.forEach((f) => console.log("FAIL:", f));
console.log(`\ncallout smoke: ${errors.length} console errors, ${fails.length} failures`);
process.exit(errors.length || fails.length ? 1 : 0);
