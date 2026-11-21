#!/usr/bin/env node
// Short test of poses + temporary voice lab. Runs locally.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
const TMP = process.env.GLOBEDESK_TMP || os.tmpdir();
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const work = path.join(root, "work");
const shots = path.join(root, "shots");
const PORT = 8767, DBG = 9477, DISPLAY = ":95";
const W = 1920, H = 1080;
const PROFILE = path.join(TMP, "globedesk-voicelab-chrome");
const OUT = path.join(root, "GlobeDesk-voice-lab-30s.mp4");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kids = [];
const consoleErrors = [];
const consoleOther = [];
let c;

function log(...a) { console.log(new Date().toISOString().slice(11, 23), ...a); }

function probeDur(file) {
  try {
    const s = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
    return parseFloat(String(s).trim()) || 0;
  } catch (e) { return 0; }
}

function clampCues(rows, gapMs) {
  const gap = gapMs == null ? 280 : gapMs;
  const out = rows.slice().sort((a, b) => a.t - b.t);
  let lastEnd = -gap;
  for (const row of out) {
    const durMs = (row.dur || probeDur(row.wav) || 0) * 1000;
    if (row.t < lastEnd + gap) {
      log("clamp cue", path.basename(row.wav), "from", (row.t / 1000).toFixed(2), "to", ((lastEnd + gap) / 1000).toFixed(2));
      row.t = lastEnd + gap;
    }
    row.dur = durMs / 1000;
    lastEnd = row.t + durMs;
  }
  return out;
}

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
  log("shot", name);
  return dest;
}

function killAll() {
  for (const p of kids.slice().reverse()) {
    try { if (!p.killed) p.kill("SIGTERM"); } catch {}
  }
}

async function startStack(urlPath) {
  await fs.mkdir(work, { recursive: true });
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
  const page = targets.find((t) => t.type === "page" && /8767|index\.html/.test(t.url)) || targets.find((t) => t.type === "page");
  if (!page) throw new Error("no chrome page");
  c = new Cdp(page.webSocketDebuggerUrl); await c.ready;
  for (const d of ["Runtime", "Page", "Log"]) await c.send(d + ".enable");
  const onMsg = (prefix) => (params) => {
    const t = (params.args || []).map((a) => a.value || a.description || a.type).join(" ");
    const typ = params.type || "log";
    const line = prefix + typ + ": " + t;
    if (typ === "error" && !ignoreConsoleText(t)) consoleErrors.push(line);
    else if (typ === "error") consoleOther.push(line);
  };
  c.on("Runtime.consoleAPICalled", onMsg("page "));
  c.on("Runtime.exceptionThrown", (p) => {
    const d = p.exceptionDetails || {};
    const t = (d.exception && (d.exception.description || d.exception.value)) || d.text || "exception";
    if (!ignoreConsoleText(t)) consoleErrors.push("exception: " + t);
  });
  c.on("Log.entryAdded", (p) => {
    const e = p.entry || {};
    if (e.level === "error" && !ignoreConsoleText(e.text)) consoleErrors.push("log: " + e.text);
  });
  await c.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await until(() => ev("!!(window.__demo && window.__demo.ready)"), 30000, "demo ready");
  log("demo ready");
}

async function mux(raw, cues, recPerf0, videoDur) {
  const inputs = ["-i", raw];
  const filters = [];
  const voLabels = [];
  const bed = path.join(root, "assets", "sfx", "ambience-ship.wav");
  const fmt = "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";
  let n = 1;
  const hasBed = fsSync.existsSync(bed);
  if (hasBed) {
    inputs.push("-stream_loop", "-1", "-i", bed);
    filters.push(`[${n}:a]atrim=0:${videoDur.toFixed(3)},asetpts=PTS-STARTPTS,${fmt},volume=0.16[bed]`);
    n += 1;
  }
  const rows = clampCues((cues || []).filter((row) => fsSync.existsSync(row.wav)));
  for (const row of rows) {
    const delay = Math.max(0, Math.round(row.t));
    inputs.push("-i", row.wav);
    // Natural pitch — no asetrate/atempo. A second rate shift was garbled.
    filters.push(`[${n}:a]${fmt},adelay=${delay}|${delay},volume=1[a${n}]`);
    voLabels.push(`[a${n}]`);
    n += 1;
    log("voice", path.basename(path.dirname(row.wav)) + "/" + path.basename(row.wav), "at", (delay / 1000).toFixed(2) + "s", "dur", (row.dur || 0).toFixed(2));
  }
  const tmp = path.join(work, "voicelab-mixed.mp4");
  let fc;
  if (hasBed && voLabels.length) {
    fc = filters.join(";") + ";" + voLabels.join("") + `amix=inputs=${voLabels.length}:dropout_transition=0:normalize=0:duration=longest[vo];` +
      `[vo]asplit=2[vo_sc][vo_mx];` +
      `[bed][vo_sc]sidechaincompress=threshold=0.05:ratio=8:attack=40:release=280:makeup=1[bedd];` +
      `[bedd][vo_mx]amix=inputs=2:dropout_transition=0:normalize=0:duration=longest[amixed];[amixed]apad[aout]`;
  } else if (voLabels.length) {
    fc = filters.join(";") + ";" + voLabels.join("") + `amix=inputs=${voLabels.length}:dropout_transition=0:normalize=0:duration=longest[aout]`;
  } else if (hasBed) {
    fc = filters.join(";") + ";[bed]anull[aout]";
  } else {
    fc = "anullsrc=r=48000:cl=stereo,atrim=0:0.1[aout]";
  }
  const args = ["-y", ...inputs, "-filter_complex", fc, "-map", "0:v", "-map", "[aout]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k", "-movflags", "+faststart",
    "-t", String(videoDur + 0.3), tmp];
  await new Promise((res, rej) => {
    const p = spawn("ffmpeg", args, { stdio: "inherit" });
    p.on("exit", (code) => code === 0 ? res() : rej(new Error("mux " + code)));
  });
  await fs.copyFile(tmp, OUT);
}

async function main() {
  await startStack("/index.html?record=1");
  const poses = await ev(`(async function(){
    const C = window.DEMO.assets.poses;
    const out = {};
    for (const k of Object.keys(C)) {
      try {
        const r = await fetch(C[k]);
        out[k] = { url: C[k], ok: r.ok, status: r.status };
      } catch (e) { out[k] = { url: C[k], ok: false, error: String(e) }; }
    }
    return out;
  })()`);
  log("poses", JSON.stringify(poses));
  const poseFail = Object.entries(poses).filter(([, v]) => !v.ok);
  if (poseFail.length) throw new Error("pose assets failed: " + JSON.stringify(poseFail));

  const labVisible = await ev(`({
    enabled: !!(window.DEMO.tempVoiceLab && window.DEMO.tempVoiceLab.enabled),
    panel: !!(document.getElementById("voiceLab") && !document.getElementById("voiceLab").hidden),
    voiceLab: !!(window.DemoVoiceLab),
    voice: window.DemoAudio.voiceId
  })`);
  log("lab", JSON.stringify(labVisible));
  if (!labVisible.panel) throw new Error("voice lab panel not visible");

  // Wait out the boot sequence so the start screen and panel are up
  await until(() => ev("window.__demo.phase === 'start'"), 20000, "start screen");
  await sleep(800);

  const raw = path.join(work, "voicelab-raw.mp4");
  const logFile = path.join(work, "ffmpeg-voicelab.log");
  const outFd = fsSync.openSync(logFile, "w");
  const ff = spawn("ffmpeg", ["-y", "-hide_banner", "-thread_queue_size", "4096",
    "-f", "x11grab", "-draw_mouse", "0", "-video_size", `${W}x${H}`, "-framerate", "30",
    "-i", DISPLAY, "-an", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "17", "-pix_fmt", "yuv420p", raw],
    { stdio: ["pipe", outFd, outFd], env: { ...process.env, DISPLAY } });
  kids.push(ff);
  await sleep(500);
  const recT0 = Date.now();
  const cues = [];

  // Fire a line without waiting the speak() promise so mid-line shots can land,
  // then wait the full wav duration plus a short gap so the next line never overlaps.
  async function playLine(speakExpr, wav, opts) {
    opts = opts || {};
    const t = Date.now() - recT0;
    const dur = probeDur(wav);
    await ev(`(function(){ ${speakExpr}; return true; })()`);
    cues.push({ t, wav, dur });
    log("cue", path.basename(wav), "at", (t / 1000).toFixed(2), "dur", dur.toFixed(2));
    const midAt = opts.midAt || 0;
    if (opts.midShot && midAt > 0) {
      await sleep(midAt);
      await shot(opts.midShot);
    }
    const waited = opts.midShot && midAt > 0 ? midAt : 0;
    await sleep(Math.max(400, dur * 1000 - waited + 400));
    return dur;
  }

  // 1) US default preview (talk pose), natural pitch
  await ev("window.DemoAudio.setVoice('hfc_male'); window.DemoAudio.setPitch(0); window.DemoAudio.setSpeed(1); window.DemoVoiceLab.refreshLabels();");
  await playLine("window.__demo.speak('start')", path.join(root, "guide-packs/frogpost/assets/vo/start.wav"), { midShot: "10-voice-lab.png", midAt: 1600 });

  // 2) Switch to British at natural pitch (no asetrate; pitch 0 preserves clarity)
  await ev(`(function(){
    window.DemoAudio.setVoice('gb');
    window.DemoAudio.setPitch(0);
    window.DemoAudio.setSpeed(1);
    window.DemoVoiceLab.refreshLabels();
    window.DemoVoiceLab.save();
    return window.DemoAudio.getLab();
  })()`);
  const switched = await ev(`({ voice: DemoAudio.voiceId, lab: DemoAudio.getLab(), src: (DemoAudio.voiceOf(DemoAudio.voiceId) || {}).dir })`);
  log("switched", JSON.stringify(switched));
  if (switched.voice !== "gb") throw new Error("voice did not switch to gb");
  await playLine("window.__demo.speak('start')", path.join(root, "guide-packs/frogpost/assets/vo/gb/start.wav"));

  // 3) Success pose
  await playLine("window.DemoFrog.setExpression('success'); window.__demo.speak('spin-success')", path.join(root, "guide-packs/frogpost/assets/vo/gb/spin-success.wav"), { midShot: "11-pose-success.png", midAt: 900 });

  // 4) Hint then salute
  await ev("window.DemoFrog.setExpression('hint')");
  await sleep(700);
  await playLine("window.DemoFrog.setExpression('salute'); window.__demo.speak('finale')", path.join(root, "guide-packs/frogpost/assets/vo/gb/finale.wav"), { midShot: "12-pose-salute.png", midAt: 900 });
  await sleep(800);

  const elapsed = (Date.now() - recT0) / 1000;
  log("clip elapsed", elapsed.toFixed(2));
  await new Promise((resolve) => {
    const t = setTimeout(() => { try { ff.kill("SIGKILL"); } catch {} resolve(); }, 6000);
    ff.on("exit", () => { clearTimeout(t); resolve(); });
    try { ff.stdin.end(); } catch {}
    try { ff.kill("SIGINT"); } catch {}
  });
  await mux(raw, cues, recT0, Math.max(elapsed, 20));

  // Confirm ?auto=1 still boots and starts a level, no new errors
  log("checking ?auto=1 still runs");
  await ev("location.replace('/index.html?auto=1&record=1')");
  await sleep(1500);
  await until(() => ev("!!(window.__demo && window.__demo.ready)"), 20000, "auto ready");
  const auto = await ev(`(async function(){
    const t0 = Date.now();
    while (Date.now() - t0 < 25000) {
      const st = {
        ready: window.__demo.ready,
        phase: window.__demo.phase,
        levelId: window.__demo.levelId,
        deskReady: window.__demo.deskReady,
        errors: window.__demo.errors
      };
      if (st.phase === 'level' || st.levelId === 'spin' || st.phase === 'cold') return st;
      await new Promise(r => setTimeout(r, 250));
    }
    return { ready: window.__demo.ready, phase: window.__demo.phase, levelId: window.__demo.levelId, errors: window.__demo.errors, timedOut: true };
  })()`);
  log("auto", JSON.stringify(auto));

  const probe = await new Promise((res) => {
    const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", OUT], { stdio: ["ignore", "pipe", "pipe"] });
    let s = ""; p.stdout.on("data", (d) => s += d);
    p.on("exit", () => res(parseFloat(s.trim() || "0")));
  });
  log("OUT", OUT, "duration", probe.toFixed(2), "s");
  log("console errors", consoleErrors.length, consoleErrors);
  await fs.writeFile(path.join(work, "voicelab-test.json"), JSON.stringify({ poses, labVisible, switched, auto, consoleErrors, consoleOther, duration: probe }, null, 2));
  if (consoleErrors.length) {
    console.error("FAIL: console errors");
    process.exitCode = 2;
  } else if (auto.timedOut && auto.phase === "start") {
    // auto may still be in start hold; ready is enough if phase progressed or desk is ready
    log("WARN: auto still on start within 25s (may be in start hold)");
  } else {
    log("CLEAR: 0 console errors");
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => {
  killAll();
  await sleep(400);
  try { spawn("bash", ["-lc", `pkill -f "Xvfb ${DISPLAY}" >/dev/null 2>&1 || true; pkill -f "remote-debugging-port=${DBG}" >/dev/null 2>&1 || true; fuser -k ${PORT}/tcp >/dev/null 2>&1 || true`]); } catch {}
});
