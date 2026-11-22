#!/usr/bin/env node
// Headless check: after Show all and Hide all, the visible MapLibre layer state
// (not the panel summary text) matches the intended plan, on both bases.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.SMOKE_PORT || 8813);
const DBG = Number(process.env.SMOKE_DBG || 9448);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (msg) => { console.error("FAIL -", msg); process.exitCode = 1; };
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gd-smoke-layers-"));

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
const chrome = spawn(process.env.CHROME || "google-chrome", [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", `--remote-debugging-port=${DBG}`,
  "--window-size=1280,720", `--user-data-dir=${profile}`, "--use-gl=angle", "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader", "about:blank"
], { stdio: "ignore" });

const stateExpr = `(() => {
  const m = GD.globe.st.map;
  const vis = (id) => m.getLayer(id) ? (m.getLayoutProperty(id, "visibility") || "visible") : "missing";
  const ids = ["gd-bluemarble","gd-hillshade","gd-hl-glow","gd-hl-fill","gd-pins","gd-arcs","gd-rings","gd-countries"];
  const layers = {};
  ids.forEach((id) => { layers[id] = vis(id); });
  const terrain = !!(m.getTerrain && m.getTerrain());
  return { base: GD.globe.st.baseId, ov: Object.assign({}, GD.globe.st.overlays), layers, terrain, summary: (document.getElementById("layersSummary") || {}).textContent || "" };
})()`;

function expectOn(st, ids, label) {
  for (const id of ids) {
    if (st.layers[id] !== "visible") fail(label + ": " + id + " should be visible, got " + st.layers[id]);
  }
}
function expectOff(st, ids, label) {
  for (const id of ids) {
    if (st.layers[id] !== "none" && st.layers[id] !== "missing") fail(label + ": " + id + " should be hidden, got " + st.layers[id]);
  }
}

try {
  let list;
  for (let i = 0; i < 75 && !list; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json(); } catch { await sleep(200); }
  }
  if (!list) throw new Error("chrome did not start");
  const page = list.find((p) => p.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const P = new Map(); const errs = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && P.has(m.id)) { P.get(m.id)(m); P.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") errs.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300));
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (x) => {
    const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "eval error");
    return r.result?.result?.value;
  };
  for (const d of ["Runtime", "Page"]) await send(d + ".enable");
  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html?sample=1&base=offline` });
  let ready = false;
  for (let i = 0; i < 150; i++) {
    ready = await ev("window.__globedesk && window.__globedesk.ready && GD.globe.st.status === 'ready'");
    if (ready) break;
    await sleep(200);
  }
  if (!ready) throw new Error("app not ready");

  const waitIdle = async () => {
    for (let i = 0; i < 40; i++) {
      const ok = await ev("GD.globe.st.map && GD.globe.st.map.isStyleLoaded && GD.globe.st.map.isStyleLoaded()");
      if (ok) return;
      await sleep(250);
    }
  };

  await ev("GD.layersPanel.open(); GD.globe.setBase('offline'); true");
  await waitIdle(); await sleep(800);
  await ev("document.getElementById('layersShowAll').click(); true");
  await waitIdle(); await sleep(1500);
  let st = await ev(stateExpr);
  console.log("offline show all", JSON.stringify(st));
  if (!st.ov.bluemarble) fail("offline Show all: state missing bluemarble");
  expectOn(st, ["gd-bluemarble", "gd-hl-glow", "gd-pins"], "offline Show all");
  await ev("document.getElementById('layersHideAll').click(); true");
  await waitIdle(); await sleep(1500);
  st = await ev(stateExpr);
  console.log("offline hide all", JSON.stringify(st));
  if (st.ov.bluemarble || st.ov.highlight || st.ov.pins) fail("offline Hide all: overlay flags still on");
  expectOff(st, ["gd-bluemarble", "gd-hl-glow", "gd-pins", "gd-arcs", "gd-rings"], "offline Hide all");
  if (!/0 of /.test(st.summary || "")) fail("offline Hide all summary: " + st.summary);

  await ev("document.querySelector('input[name=lpBase][value=\"sat-hybrid\"]').click(); true");
  await waitIdle(); await sleep(2500);
  await ev("GD.globe.st.map.jumpTo({center:[-77.01,38.89],zoom:12,pitch:40,bearing:0}); true");
  await waitIdle(); await sleep(1500);
  await ev("document.getElementById('layersShowAll').click(); true");
  await waitIdle(); await sleep(2000);
  st = await ev(stateExpr);
  console.log("sat show all", JSON.stringify(st));
  if (!st.ov.terrain) fail("sat Show all: state missing terrain");
  if (st.ov.bluemarble) fail("sat Show all: Blue Marble should stay off");
  expectOn(st, ["gd-hillshade", "gd-hl-glow", "gd-pins", "gd-arcs", "gd-rings"], "sat Show all");
  expectOff(st, ["gd-bluemarble"], "sat Show all (Blue Marble off)");
  await ev("document.getElementById('layersHideAll').click(); true");
  await waitIdle(); await sleep(2000);
  st = await ev(stateExpr);
  console.log("sat hide all", JSON.stringify(st));
  if (st.ov.terrain || st.ov.highlight || st.ov.pins) fail("sat Hide all: overlay flags still on");
  expectOff(st, ["gd-hillshade", "gd-hl-glow", "gd-pins", "gd-arcs", "gd-rings"], "sat Hide all");
  if (st.terrain) fail("sat Hide all: getTerrain() still set");

  const retryCounts = await ev(`(() => (async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const vis = (id) => {
      const m = GD.globe.st.map;
      if (!m || !m.getLayer(id)) return "missing";
      return m.getLayoutProperty(id, "visibility") || "visible";
    };
    const layerOn = (id) => vis(id) === "visible";
    const styleBound = () => !!(GD.globe.st.map && GD.globe.st.status === "ready");
    const styleTiles = () => !!(GD.globe.st.map && GD.globe.st.map.isStyleLoaded && GD.globe.st.map.isStyleLoaded());
    const waitLand = async (id, want, ms) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if (layerOn(id) === want) return true;
        await sleep(40);
      }
      return layerOn(id) === want;
    };
    const waitBound = async (ms) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if (styleBound()) return true;
        await sleep(40);
      }
      return styleBound();
    };
    const waitNotReady = async (ms) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if (styleBound() && !styleTiles()) return true;
        await sleep(10);
      }
      return styleBound() && !styleTiles();
    };
    let dirtyIv = null;
    const startDirty = () => {
      if (dirtyIv) return;
      const tick = () => {
        try {
          const m = GD.globe.st.map;
          if (!m) return;
          const ids = ["gd-pins", "gd-arcs", "gd-rings", "gd-hl-glow"];
          for (const id of ids) {
            const src = m.getSource(id);
            if (src && src.setData) {
              const data = (src._data || src.serialize && src.serialize().data) || { type: "FeatureCollection", features: [] };
              src.setData(data);
              return;
            }
          }
        } catch (e) { /* source gone during recreate */ }
      };
      tick();
      dirtyIv = setInterval(tick, 40);
    };
    const stopDirty = () => { if (dirtyIv) { clearInterval(dirtyIv); dirtyIv = null; } };

    async function runNotReadyToggles(base, nWant) {
      GD.globe.setBase(base);
      await waitBound(12000);
      if (base === "sat-hybrid") {
        try { GD.globe.st.map.jumpTo({ center: [-77.01, 38.89], zoom: 12, pitch: 40, bearing: 0 }); } catch (e) {}
        await sleep(400);
      }
      GD.globe.setOverlay("pins", true);
      await waitLand("gd-pins", true, 4000);
      startDirty();
      GD.globe.setOverlay("pins", false);
      await waitLand("gd-pins", false, 4000);
      const rec = { attempted: 0, landed: 0, missed: 0, skippedReady: 0 };
      let want = true;
      for (let i = 0; i < nWant * 8 && rec.attempted < nWant; i++) {
        const inWindow = await waitNotReady(1500);
        if (!inWindow) { rec.skippedReady++; continue; }
        GD.globe.setOverlay("pins", want);
        rec.attempted++;
        const ok = await waitLand("gd-pins", want, 3000);
        if (ok) rec.landed++; else rec.missed++;
        want = !want;
      }
      return rec;
    }

    async function toggleAroundExport(fnName, wantOn) {
      const rec = { attempted: 0, landed: 0, missed: 0 };
      await waitBound(12000);
      startDirty();
      const p = GD.globe[fnName]();
      // The new map is mid-load: this is the not-ready / unbound window.
      GD.globe.setOverlay("pins", wantOn);
      rec.attempted++;
      await p;
      await waitBound(12000);
      const ok = await waitLand("gd-pins", wantOn, 5000);
      if (ok) rec.landed++; else rec.missed++;
      rec.final = vis("gd-pins");
      rec.ov = !!GD.globe.st.overlays.pins;
      rec.status = GD.globe.st.status;
      rec.tiles = styleTiles();
      return rec;
    }

    const offline = await runNotReadyToggles("offline", 20);
    const sat = await runNotReadyToggles("sat-hybrid", 20);
    const exportStart = await toggleAroundExport("prepareForExport", true);
    const exportEnd = await toggleAroundExport("endExport", false);
    stopDirty();
    return { offline, sat, exportStart, exportEnd };
  })())()`);

  console.log("not-ready / export retry counts", JSON.stringify(retryCounts));
  if (!retryCounts) fail("retry count script returned nothing");
  else {
    const report = (label, rec, min) => {
      console.log(label, rec.landed + "/" + rec.attempted + " landed" + (rec.missed ? (" " + rec.missed + " missed") : "") + (rec.skippedReady ? (" " + rec.skippedReady + " skipped-ready") : ""));
      if (rec.attempted < min) fail(label + ": only " + rec.attempted + " not-ready toggles (wanted " + min + ")");
      if (rec.missed) fail(label + ": " + rec.missed + " of " + rec.attempted + " did not land");
    };
    report("not-ready toggles offline", retryCounts.offline, 20);
    report("not-ready toggles sat", retryCounts.sat, 20);
    report("export start", retryCounts.exportStart, 1);
    report("export end", retryCounts.exportEnd, 1);
  }

  if (errs.length) fail("exceptions: " + errs.join(" | "));
  else console.log("ok - 0 exceptions");
  ws.close();
} finally {
  try { chrome.kill(); } catch {}
  try { server.kill(); } catch {}
  await sleep(300);
  fs.rmSync(profile, { recursive: true, force: true });
}
if (!process.exitCode) console.log("layers smoke ok");
