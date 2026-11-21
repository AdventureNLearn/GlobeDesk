#!/usr/bin/env node
// Local test: ship radio + comms lights. No MP4 capture of live radio.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
const TMP = process.env.GLOBEDESK_TMP || os.tmpdir();
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const shots = path.join(root, "shots");
const PORT = 8768, DBG = 9478, DISPLAY = ":96";
const W = 1920, H = 1080;
const PROFILE = path.join(TMP, "globedesk-radio-chrome");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kids = [];
const consoleErrors = [];
let c;

function log(...a) { console.log(new Date().toISOString().slice(11, 23), ...a); }

async function until(fn, ms, label) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    try { const v = await fn(); if (v) return v; last = v; } catch (e) { last = e && e.message; }
    await sleep(200);
  }
  throw new Error("timeout: " + label + (last ? " (" + last + ")" : ""));
}

class Cdp {
  constructor(u) {
    this.ws = new WebSocket(u); this.id = 0; this.p = new Map(); this.h = {};
    this.ready = new Promise((r, j) => { this.ws.onopen = r; this.ws.onerror = j; });
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.method && this.h[m.method]) this.h[m.method](m.params);
      if (m.id && this.p.has(m.id)) {
        const { r, j } = this.p.get(m.id); this.p.delete(m.id);
        m.error ? j(new Error(m.error.message)) : r(m.result);
      }
    };
  }
  on(m, f) { this.h[m] = f; }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((r, j) => { this.p.set(id, { r, j }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
}

const ev = async (expr) => {
  const r = await c.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

function spawnLogged(cmd, args, opts = {}) {
  const p = spawn(cmd, args, { ...opts, stdio: opts.stdio || "ignore" });
  kids.push(p);
  p.on("exit", (code, sig) => { if (code && code !== 0) log("exit", cmd, code, sig || ""); });
  return p;
}

function ignoreConsoleText(t) {
  const s = String(t || "");
  if (/abort|cancel|favicon|youtube|nocookie|googlevideo|ytimg|Failed to load resource: the server responded with a status of 404|play\(\) request was interrupted|AbortError/i.test(s)) return true;
  return false;
}

async function shot(name) {
  const r = await c.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const dest = path.join(shots, name);
  await fs.writeFile(dest, Buffer.from(r.data, "base64"));
  log("shot", dest);
  return dest;
}

function killAll() {
  for (const p of kids.slice().reverse()) {
    try { if (!p.killed) p.kill("SIGTERM"); } catch {}
  }
  try { spawn("bash", ["-lc", `pkill -f "Xvfb ${DISPLAY}" >/dev/null 2>&1 || true; pkill -f "remote-debugging-port=${DBG}" >/dev/null 2>&1 || true; fuser -k ${PORT}/tcp >/dev/null 2>&1 || true`]); } catch {}
}

function verifyStream(name, url) {
  const script = `
import urllib.request, ssl, sys
url = sys.argv[1]
ctx = ssl.create_default_context()
req = urllib.request.Request(url, headers={"User-Agent": "GlobeDeskDemo/1.0", "Icy-MetaData": "1", "Accept": "*/*"})
with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
    data = r.read(32768)
    ct = r.info().get("content-type", "")
    print(r.status, len(data), ct, r.geturl())
    sys.exit(0 if r.status == 200 and len(data) >= 2048 else 2)
`;
  const tmp = path.join(TMP, "radio-verify.py");
  fsSync.writeFileSync(tmp, script);
  const out = execFileSync("python3", [tmp, url], { encoding: "utf8", timeout: 15000 }).trim();
  log("stream", name, out);
  const [status, bytes] = out.split(" ");
  if (Number(status) !== 200 || Number(bytes) < 2048) throw new Error("stream failed: " + name + " " + out);
  return out;
}

async function startStack(urlPath) {
  await fs.mkdir(shots, { recursive: true });
  await fs.rm(PROFILE, { recursive: true, force: true });
  try { spawnLogged("bash", ["-lc", `fuser -k ${PORT}/tcp ${DBG}/tcp >/dev/null 2>&1 || true`]); } catch {}
  await sleep(300);
  spawnLogged("Xvfb", [DISPLAY, "-screen", "0", `${W}x${H}x24`, "-ac", "+extension", "GLX", "+render", "-noreset"], { stdio: "ignore" });
  await sleep(400);
  const env = { ...process.env, DISPLAY, GDK_BACKEND: "x11", XDG_SESSION_TYPE: "x11" };
  try { spawnLogged("xsetroot", ["-solid", "#000408"], { env, stdio: "ignore" }); } catch {}
  try { spawnLogged("xfwm4", ["--compositor=off", "--sm-client-disable"], { env, stdio: "ignore" }); } catch {}
  await sleep(200);
  spawnLogged("python3", [path.join(here, "serve.py"), "--port", String(PORT), "--bind", "127.0.0.1"], { stdio: "ignore" });
  await until(async () => (await fetch(`http://127.0.0.1:${PORT}/`)).ok, 10000, "server");
  const chromeArgs = [
    "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
    `--remote-debugging-port=${DBG}`, "--remote-debugging-address=127.0.0.1",
    `--window-size=${W},${H}`, "--window-position=0,0", "--hide-scrollbars",
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
    "--no-first-run", "--no-default-browser-check", "--disable-sync", "--disable-extensions",
    "--disable-default-apps", "--disable-session-crashed-bubble", "--disable-infobars",
    "--disable-features=Translate,TranslateUI,InfiniteSessionRestore,MediaRouter",
    "--disable-background-networking", "--start-fullscreen", "--kiosk",
    `--user-data-dir=${PROFILE}`,
    `http://127.0.0.1:${PORT}${urlPath}`
  ];
  spawnLogged(process.env.CHROME || "google-chrome", chromeArgs, { env, stdio: "ignore" });
  await until(async () => { try { return (await fetch(`http://127.0.0.1:${DBG}/json/version`)).ok; } catch { return false; } }, 20000, "chrome");
  const targets = await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json();
  const page = targets.find((t) => t.type === "page") || targets[0];
  c = new Cdp(page.webSocketDebuggerUrl);
  await c.ready;
  await c.send("Runtime.enable");
  await c.send("Page.enable");
  c.on("Runtime.consoleAPICalled", (p) => {
    const text = (p.args || []).map((a) => a.value || a.description || "").join(" ");
    if (p.type === "error" && !ignoreConsoleText(text)) consoleErrors.push(text);
  });
  c.on("Runtime.exceptionThrown", (p) => {
    const text = p.exceptionDetails && (p.exceptionDetails.exception?.description || p.exceptionDetails.text);
    if (text && !ignoreConsoleText(text)) consoleErrors.push(String(text));
  });
  await until(() => ev("!!(window.__demo && window.__demo.ready)"), 30000, "demo ready");
  log("demo ready");
}

async function main() {
  log("verifying live streams (curl-equivalent)");
  verifyStream("Exclusively CCR", "https://streaming.exclusive.radio/er/creedence/icecast.audio");
  verifyStream("0 N Classic Rock", "https://0n-classicrock.radionetz.de/0n-classicrock.aac");
  verifyStream("SomaFM Left Coast 70s", "https://ice2.somafm.com/seventies-128-mp3");

  await startStack("/index.html?record=1");
  await until(() => ev("window.__demo.phase === 'start'"), 25000, "start screen");
  log("start screen; turning radio on for screenshot");
  await ev("window.DemoRadio.fadeIn()");
  await ev("window.DemoAudio && DemoAudio.playVo('start')");
  await sleep(900);
  const startInfo = await ev(`({
    phase: window.__demo.phase,
    radio: document.getElementById("shipRadio") && getComputedStyle(document.getElementById("shipRadio")).display,
    radioOn: document.getElementById("shipRadio").className,
    caption: !document.getElementById("radioCaption").hidden,
    captionText: document.getElementById("radioCaption").textContent,
    name: document.getElementById("radioName").textContent,
    legend: document.getElementById("commsLegend").textContent,
    legendHidden: document.getElementById("commsLegend").hidden,
    talking: !!(window.DemoAudio && DemoAudio.talking),
    talkingClass: document.getElementById("comms").className,
    status: window.__demo.radioStatus()
  })`);
  log("start info", JSON.stringify(startInfo));
  if (startInfo.radio === "none") throw new Error("radio widget hidden at start");
  if (!startInfo.caption) throw new Error("record caption missing at start");
  if (!startInfo.talking || startInfo.legendHidden || startInfo.legend !== "COMMS LIVE") {
    throw new Error("COMMS LIVE not shown while VO playing: " + JSON.stringify(startInfo));
  }
  await shot("13-radio-start.png");

  log("jumping to finale/debrief preview");
  await ev("window.__demo.skip()");
  await sleep(800);
  await ev("window.__demo.enterDebriefPreview()");
  await ev(`(function(){ const t = "Mission complete. That's the whole desk, fren. Now go build."; const s = document.getElementById("speech"); const c = document.getElementById("caption"); if (s) s.textContent = t; if (c) c.textContent = t; DemoFrog.stopTalk(); DemoFrog.setExpression("salute"); return true; })()`);
  await sleep(500);
  const fin = await ev(`({
    phase: window.__demo.phase,
    screen: !document.getElementById("screen-complete").classList.contains("hidden"),
    radioOn: document.getElementById("shipRadio").classList.contains("on"),
    caption: !document.getElementById("radioCaption").hidden,
    name: document.getElementById("radioName").textContent,
    talking: !!(window.DemoAudio && DemoAudio.talking),
    legendHidden: document.getElementById("commsLegend").hidden,
    commsClass: document.getElementById("comms").className,
    status: window.__demo.radioStatus()
  })`);
  log("finale info", JSON.stringify(fin));
  if (!fin.screen || !fin.radioOn) throw new Error("radio/finale not visible");
  await shot("14-radio-finale.png");

  const recErrors = await ev("window.__demo.errors");
  log("record-page errors", JSON.stringify(recErrors));

  // Fresh load without record=1: stream + duck + auto=1
  log("reloading for live stream + duck test");
  await ev("location.replace('/index.html')");
  await sleep(800);
  await until(() => ev("!!(window.__demo && window.__demo.ready)"), 30000, "live ready");
  await until(() => ev("window.__demo.phase === 'start'"), 25000, "live start");
  await ev("(function(){ DemoAudio.resume(); DemoRadio.fadeIn(); return true; })()");
  await sleep(2500);
  const live = await ev(`({
    status: window.__demo.radioStatus(),
    readyState: document.querySelector("#shipRadio") && (window.DemoRadio.status())
  })`);
  log("live radio", JSON.stringify(live));
  const volBefore = live.status && live.status.volume;
  await ev("DemoAudio.playVo('spin-success')");
  await sleep(400);
  const ducked = await ev(`({
    talking: DemoAudio.talking,
    status: DemoRadio.status(),
    legend: document.getElementById("commsLegend").textContent,
    hidden: document.getElementById("commsLegend").hidden
  })`);
  log("ducked", JSON.stringify(ducked));
  if (!ducked.talking) throw new Error("VO did not set talking");
  if (!ducked.status.ducked) throw new Error("radio did not duck under VO");
  if (ducked.hidden || ducked.legend !== "COMMS LIVE") throw new Error("COMMS LIVE missing during duck test");
  if (!(ducked.status.volume < (volBefore || 0.42) - 0.05 || ducked.status.targetVolume <= 0.12)) {
    throw new Error("duck volume not lowered: " + JSON.stringify({ volBefore, ducked }));
  }

  // hint / clear lamps
  await ev("DemoAudio.stopVo()");
  await ev("DemoFrog.setExpression('hint')");
  const hint = await ev(`({ legend: document.getElementById("commsLegend").textContent, hidden: document.getElementById("commsLegend").hidden, cls: document.getElementById("comms").className, talk: DemoAudio.talking })`);
  log("hint lamp", JSON.stringify(hint));
  if (hint.talk || hint.hidden || hint.legend !== "HINT") throw new Error("hint lamp failed: " + JSON.stringify(hint));
  await ev("DemoFrog.setExpression('success')");
  const clear = await ev(`({ legend: document.getElementById("commsLegend").textContent, hidden: document.getElementById("commsLegend").hidden, cls: document.getElementById("comms").className })`);
  log("clear lamp", JSON.stringify(clear));
  if (clear.hidden || clear.legend !== "CLEAR") throw new Error("clear lamp failed: " + JSON.stringify(clear));
  await ev("DemoFrog.setExpression('idle')");
  const idle = await ev(`({ legendHidden: document.getElementById("commsLegend").hidden, cls: document.getElementById("comms").className, talk: getComputedStyle(document.documentElement).getPropertyValue('--talk') })`);
  log("idle lamp", JSON.stringify(idle));
  if (!idle.legendHidden) throw new Error("idle still showing a legend");

  log("checking ?auto=1 still runs");
  await ev("location.replace('/index.html?auto=1')");
  await sleep(1000);
  await until(() => ev("!!(window.__demo && window.__demo.ready)"), 30000, "auto ready");
  await until(() => ev("window.__demo.phase === 'start' || window.__demo.phase === 'cold' || window.__demo.phase === 'level'"), 25000, "auto progressed");
  const auto = await ev(`({ phase: window.__demo.phase, ready: window.__demo.ready, errors: window.__demo.errors, radio: !!document.getElementById("shipRadio") })`);
  log("auto", JSON.stringify(auto));
  if (!auto.ready || !auto.radio) throw new Error("auto=1 failed");
  const autoErrors = (auto.errors || []).concat(consoleErrors);
  if (autoErrors.length) throw new Error("console errors: " + JSON.stringify(autoErrors));

  log("CLEAR: radio + comms lights ok, 0 console errors");
  process.exitCode = 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
}).finally(() => {
  killAll();
  setTimeout(() => process.exit(process.exitCode || 0), 400);
});
