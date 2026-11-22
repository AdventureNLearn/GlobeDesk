#!/usr/bin/env node
// P3 smoke: serve.py + headless Chrome. Command API, DC sample episode,
// pause / explore / resume, 0 console errors and 0 performance/READ-usage warnings.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.SMOKE_PORT || 8213);
const DBG = Number(process.env.SMOKE_DBG || 9433);
const W = 1280, H = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WARN_RE = /performance warning|READ-usage buffer|shadow copy that was created to accelerate readback/i;
const warnings = [], errors = [], allConsole = [];
const chromeBin = process.env.CHROME || "google-chrome";
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gd-smoke-p3-"));
const downloads = path.join(profile, "downloads");
fs.mkdirSync(downloads);
const dataDir = process.env.GLOBEDESK_DATA || path.join(root, "globedesk-data");

const server = spawn(process.env.PYTHON || "python3", ["-B", "tools/serve.py", String(PORT)], {
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
const appHeaders = { Origin: origin, "Content-Type": "application/json" };

async function postCommand(body, headers = {}) {
  const r = await fetch(`${origin}/api/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json };
}

let c, failed = false;
try {
  await until(async () => (await fetch(`http://127.0.0.1:${DBG}/json/version`)).ok, 20000, "chrome");
  await until(async () => (await fetch(`${origin}/api/tools`)).ok, 15000, "serve.py");

  const tools = await (await fetch(`${origin}/api/tools`)).json();
  const names = (tools.tools || []).map((t) => t.name);
  for (const cmd of ["flyTo", "zoom", "toggleLayer", "dropPin", "openCard", "closeCard", "play", "pause", "resume"]) {
    if (!names.includes(cmd)) throw new Error("missing tool: " + cmd);
  }

  // A MapLibre-sized burst of out-of-pack EOX tiles must not 404 or ECONNREFUSED.
  const burst = await Promise.all(Array.from({ length: 80 }, (_, i) =>
    fetch(`${origin}/tiles/eox2016/2/${i % 4}/${i % 4}.jpg`, { headers: { Origin: origin, Referer: origin + "/index.html" } })
      .then(async (r) => ({ status: r.status, source: r.headers.get("x-globedesk-tile-source"), type: r.headers.get("content-type") }))
      .catch((e) => ({ status: "refused", error: String(e) }))
  ));
  const burstBad = burst.filter((r) => r.status !== 200 || r.status === 404 || r.status === "refused");
  if (burstBad.length) throw new Error("tile burst was not quiet: " + JSON.stringify(burstBad.slice(0, 5)) + " (" + burstBad.length + ")");
  if (!burst.every((r) => r.source === "empty" || r.source === "pack" || r.source === "cache" || r.source === "local" || r.source === "upstream")) {
    throw new Error("tile burst missing source header: " + JSON.stringify(burst.slice(0, 3)));
  }

  // Two unfocused desks and no target must reject, not silently pick a window.
  const nextHeaders = { Origin: origin, Accept: "application/json" };
  await Promise.all([
    fetch(`${origin}/api/command/next?desk=desk-fake-a&focused=0&title=A&wait=0`, { headers: nextHeaders }),
    fetch(`${origin}/api/command/next?desk=desk-fake-b&focused=0&title=B&wait=0`, { headers: nextHeaders }),
  ]);
  const multi = await postCommand({ cmd: "dropPin", lat: 38.91, lon: -77.04 });
  if (multi.status !== 409 || !multi.json || multi.json.ok !== false || !String(multi.json.error || "").includes("multiple desks")) {
    throw new Error("two desks should reject an untargeted command: " + JSON.stringify(multi));
  }
  await fetch(`${origin}/api/command/next?desk=desk-fake-a&gone=1&wait=0`, { headers: nextHeaders });
  await fetch(`${origin}/api/command/next?desk=desk-fake-b&gone=1&wait=0`, { headers: nextHeaders });
  const leftover = await (await fetch(`${origin}/api/desks`)).json();
  if ((leftover.desks || []).length) throw new Error("fake desks were not dropped: " + JSON.stringify(leftover));

  const badOrigin = await postCommand({ cmd: "status" }, { Origin: "http://127.0.0.1:9" });
  if (badOrigin.status !== 403) throw new Error("cross-origin command should 403, got " + JSON.stringify(badOrigin));
  const rejected = await postCommand({ cmd: "eval", code: "1+1" });
  if (rejected.status !== 400 || !rejected.json || rejected.json.ok !== false) {
    throw new Error("unknown command should be rejected, got " + JSON.stringify(rejected));
  }

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
  await c.send("Page.navigate", { url: `${origin}/index.html?import=/episodes/washington-dc-demo.globedesk.json&base=offline` });
  const ev = async (expr) => {
    const r = await c.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  try {
    await until(() => ev("window.__globedesk && window.__globedesk.ready && GD.globe.st.status === 'ready' && GD.state && GD.state.episode && GD.state.episode.id === 'ep-washington-dc-demo'"), 30000, "dc episode ready");
  } catch (e) {
    let snap = null;
    try { snap = await ev("({ ready: !!(window.__globedesk && window.__globedesk.ready), status: GD && GD.globe && GD.globe.st && GD.globe.st.status, base: GD && GD.globe && GD.globe.st && GD.globe.st.baseId, ep: GD && GD.state && GD.state.episode && GD.state.episode.id, href: location.href })"); } catch (e2) { snap = String(e2); }
    throw new Error(e.message + " snap=" + JSON.stringify(snap) + " console=" + JSON.stringify(allConsole.slice(0, 20)));
  }

  // Scripted command run through the localhost API (the page pumps /api/command/next).
  const script = [
    { cmd: "flyTo", lat: 38.89, lon: -77.01, zoom: 8, pitch: 0, bearing: 0, durationSec: 0 },
    { cmd: "zoom", zoom: 13, durationSec: 0 },
    { cmd: "tilt", pitch: 40, durationSec: 0 },
    { cmd: "toggleLayer", id: "eox-region", on: true },
    { cmd: "dropPin", lat: 38.89, lon: -77.01 },
    { cmd: "openCard", id: "card-capitol" },
  ];
  const scriptResults = [];
  for (const body of script) {
    const r = await postCommand(body);
    scriptResults.push({ cmd: body.cmd, status: r.status, ok: r.json && r.json.ok, error: r.json && r.json.error });
    if (r.status !== 200 || !r.json || r.json.ok !== true) {
      throw new Error("scripted command failed: " + JSON.stringify(scriptResults));
    }
  }
  const afterScript = await ev("GD.commands.status()");
  if (!afterScript.ok || afterScript.result.openCards.forced.indexOf("card-capitol") < 0) {
    throw new Error("openCard did not stick: " + JSON.stringify(afterScript));
  }
  const already = await postCommand({ cmd: "openCard", id: "card-capitol" });
  if (already.status !== 200 || !already.json || already.json.ok !== true || !already.json.result || already.json.result.alreadyOpen !== true) {
    throw new Error("openCard on an already-open card should return alreadyOpen: " + JSON.stringify(already));
  }
  const pointer = await ev(`(() => {
    const P = GD.mapPointer;
    const pin = { kind: "pin", id: "sel-keep", storyIdx: 0 };
    P.setSelection(pin);
    const empty = P.apply({ type: "click" }, {});
    const pan = P.apply({ type: "pan" }, {});
    const zoom = P.apply({ type: "zoom" }, {});
    const drop = P.apply({ type: "contextmenu" }, {});
    const still = P.getSelection();
    const esc = P.apply({ type: "escape" }, {});
    return {
      longMs: P.LONG_PRESS_MS,
      empty: empty.action,
      pan: pan.action,
      zoom: zoom.action,
      drop: drop.action,
      stillId: still && still.id,
      afterEsc: P.getSelection(),
      esc: esc.action,
      clickSelect: P.actionFor({ type: "click" }, { pin }),
      tapEmpty: P.actionFor({ type: "tap" }, {}),
      eventSelect: P.actionFor({ type: "click" }, { eventFeature: { kind: "event", id: "e1" } }),
      dbl: P.actionFor({ type: "dblclick" }, { pin }),
      dblClick: P.actionFor({ type: "click", detail: 2 }, { pin }),
      hitMin: P.HIT_MIN_PX,
      noSeekPaused: P.shouldSeekOnSelect({ paused: true, playing: false }) === false,
      queued: (() => { P.resetPointerState(); P.notePointerDown(null); let n = 0; const r = P.requestCamera(() => { n++; }); P.notePointerUp(); return r.queued && n === 1; })()
    };
  })()`);
  if (pointer.longMs !== 500 || pointer.empty !== "keep" || pointer.pan !== "keep" || pointer.zoom !== "keep" || pointer.drop !== "dropPin" || pointer.stillId !== "sel-keep" || pointer.afterEsc !== null || pointer.clickSelect !== "select" || pointer.tapEmpty !== "keep" || pointer.eventSelect !== "select" || pointer.dbl !== "keep" || pointer.dblClick !== "keep" || pointer.hitMin !== 24 || !pointer.noSeekPaused || !pointer.queued) {
    throw new Error("map pointer policy failed: " + JSON.stringify(pointer));
  }
  if (Math.abs(afterScript.result.camera.zoom - 13) > 0.4) {
    throw new Error("zoom/flyTo did not reach z13: " + JSON.stringify(afterScript.result.camera));
  }
  if (Math.abs(afterScript.result.camera.pitch - 40) > 3) {
    throw new Error("tilt did not reach pitch 40: " + JSON.stringify(afterScript.result.camera));
  }
  if (!afterScript.result.overlays["eox-region"]) {
    throw new Error("toggleLayer did not enable eox-region: " + JSON.stringify(afterScript.result.overlays));
  }
  const errBeforeWorld = errors.length;
  const world = await postCommand({ cmd: "jumpTo", lat: 0, lon: 0, zoom: 2, pitch: 0, bearing: 0 });
  if (world.status !== 200 || !world.json || world.json.ok !== true) {
    throw new Error("jumpTo world for region-bounds check failed: " + JSON.stringify(world));
  }
  await sleep(1500);
  const newWorldErr = errors.slice(errBeforeWorld).filter((s) => /eox2016|ERR_CONNECTION_REFUSED|404/.test(s));
  if (newWorldErr.length) throw new Error("eox-region at world zoom flooded the console: " + newWorldErr.slice(0, 8).join("\n"));
  const offRegion = await postCommand({ cmd: "toggleLayer", id: "eox-region", on: false });
  if (offRegion.status !== 200 || !offRegion.json || offRegion.json.ok !== true) {
    throw new Error("could not turn the region overlay off before leaving DC: " + JSON.stringify(offRegion));
  }

  // Reload the sample so story checks start from the original pins and layers.
  const reloaded = await postCommand({ cmd: "loadEpisode", url: "/episodes/washington-dc-demo.globedesk.json" });
  if (reloaded.status !== 200 || !reloaded.json || reloaded.json.ok !== true) {
    throw new Error("loadEpisode failed: " + JSON.stringify(reloaded));
  }
  await until(() => ev("GD.state.episode.id === 'ep-washington-dc-demo' && GD.globe.st.baseId === 'offline' && GD.globe.st.status === 'ready'"), 15000, "reloaded offline (look.map.base applied)");

  const at3 = await ev("GD.playback.seek(3); GD.playback.storyState(3);");
  if (!at3 || at3.cards.indexOf("card-capitol") < 0 || !at3.camera || at3.camera.zoom !== 13) {
    throw new Error("story 1 at t=3 should show the Capitol card and close shot: " + JSON.stringify(at3));
  }
  const at11 = await ev("GD.playback.seek(11); GD.playback.storyState(11);");
  if (!at11 || at11.idx !== 1 || at11.cards.indexOf("card-lincoln") < 0) {
    throw new Error("story 2 at t=11 should show the Lincoln card: " + JSON.stringify(at11));
  }

  await ev("GD.playback.seek(3); true");
  await ev("GD.playback.play(); true");
  await until(() => ev("GD.state.playing === true"), 5000, "playing");
  await ev("GD.playback.pause(); true");
  await until(() => ev("GD.state.paused === true && GD.state.playing === false"), 5000, "paused");
  const paused = await ev("({ t: GD.state.t, state: GD.playback.storyState(GD.state.t), pin: JSON.parse(JSON.stringify(GD.state.episode.stories[0].location)), overlays: JSON.parse(JSON.stringify(GD.globe.st.overlays)), base: GD.globe.st.baseId, camera: GD.globe.camera() })");

  await ev("GD.globe.setOverlay('eox-region', false); GD.globe.st.map.jumpTo({center:[0,0],zoom:2,pitch:0,bearing:0}); true");
  await ev("GD.globe.setOverlay('towns', !GD.globe.st.overlays['towns']); true");
  await ev("GD.commands.dropPin({lat:10,lon:20}); true");
  await ev("GD.commands.openCard({id:'card-lincoln'}); GD.commands.openCard({id:'story-capitol'}); true");
  const explored = await ev("({ camera: GD.globe.camera(), pin: GD.state.episode.stories[0].location.lat, forced: (GD.state.forcedCards||[]).slice(), callouts: GD.callouts.state.open.slice(), overlay: !!GD.globe.st.overlays['towns'] })");
  if (Math.abs(explored.pin - 10) > 0.01) throw new Error("explore dropPin did not take: " + JSON.stringify(explored));
  if (Math.abs(explored.camera.zoom - 2) > 0.4) throw new Error("explore camera did not move: " + JSON.stringify(explored));
  const midExplore = await ev("({ t: GD.state.t, pin: GD.state.episode.stories[0].location.lat, idx: GD.state.storyIdx })");
  await ev("GD.ui.selectStory(1, { fly: true, openCard: true }); true");
  const afterSelect = await ev("({ t: GD.state.t, pin: GD.state.episode.stories[0].location.lat, idx: GD.state.storyIdx, paused: GD.state.paused, playing: GD.state.playing })");
  if (!afterSelect.paused || afterSelect.playing) throw new Error("selectStory while paused should leave explore paused: " + JSON.stringify(afterSelect));
  if (Math.abs(afterSelect.pin - 10) > 0.01) throw new Error("selectStory while paused restored the story pin: " + JSON.stringify(afterSelect));
  if (Math.abs(afterSelect.t - midExplore.t) > 0.2) throw new Error("selectStory while paused sought the clock: " + JSON.stringify({ afterSelect, midExplore }));
  if (afterSelect.idx !== 1) throw new Error("selectStory while paused did not select the other story: " + JSON.stringify(afterSelect));

  await ev("GD.playback.resume(); true");
  await until(() => ev("GD.state.playing === true"), 5000, "resumed");
  const after = await ev("({ t: GD.state.t, playing: GD.state.playing, camera: GD.globe.camera(), pin: GD.state.episode.stories[0].location, cards: (GD.state.ov.cards||[]).map((c)=>c.id), forced: (GD.state.forcedCards||[]).slice(), callouts: GD.callouts.state.open.slice(), overlay: !!GD.globe.st.overlays['towns'], base: GD.globe.st.baseId, buffer: GD.globe.isDrawingBufferPreserved() })");
  if (!after.playing) throw new Error("resume did not continue playback");
  if (Math.abs(after.pin.lat - paused.pin.lat) > 0.001 || Math.abs(after.pin.lon - paused.pin.lon) > 0.001) {
    throw new Error("resume did not restore the story pin: " + JSON.stringify(after.pin));
  }
  if (after.forced.length || after.callouts.length) {
    throw new Error("resume did not clear viewer cards: " + JSON.stringify(after));
  }
  if (paused.state.cards.some((id) => after.cards.indexOf(id) < 0)) {
    throw new Error("resume is missing story cards: " + JSON.stringify(after));
  }
  if (Math.abs(after.camera.zoom - paused.camera.zoom) > 0.5 || Math.abs(after.camera.center[0] - paused.camera.center[0]) > 0.05) {
    throw new Error("resume did not snap the camera back: " + JSON.stringify({ after: after.camera, paused: paused.camera }));
  }
  if (after.overlay !== !!paused.overlays.towns || after.base !== paused.base) {
    throw new Error("resume did not restore layers: " + JSON.stringify(after));
  }
  if (after.buffer) throw new Error("preserveDrawingBuffer should be off outside export");
  await sleep(400);
  const later = await ev("GD.state.t");
  if (!(later > after.t - 0.05)) throw new Error("clock did not continue after resume");

  const errText = errors.join("\n");
  const warnText = warnings.join("\n");
  console.log(JSON.stringify({
    ok: errors.length === 0 && warnings.length === 0,
    errors: errors.length,
    warnings: warnings.length,
    tools: names,
    scriptResults,
    at3, at11,
    pausedT: paused.t,
    after,
  }, null, 2));
  if (errors.length) { console.error("ERRORS:\n" + errText); failed = true; }
  if (warnings.length) { console.error("WARNINGS:\n" + warnText); failed = true; }
  if (!failed) console.log("smoke-p3: 0 warnings, 0 errors");
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  try { if (c) await c.send("Browser.close"); } catch {}
  try { chrome.kill("SIGKILL"); } catch {}
  try { server.kill("SIGKILL"); } catch {}
  process.exit(failed ? 1 : 0);
}
