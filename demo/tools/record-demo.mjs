#!/usr/bin/env node
// Headless 1920x1080 auto playthrough of the full GlobeDesk frog mission.
// Xvfb + kiosk Chrome + ffmpeg x11grab. Box only; nothing is published.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const work = path.join(root, "work");
const shots = path.join(root, "shots");
const voDir = path.join(root, "assets", "vo");
const sfxDir = path.join(root, "assets", "sfx");
const PORT = 8766, DBG = 9476, DISPLAY = ":94";
const W = 1920, H = 1080;
const PROFILE = "/tmp/globedesk-demo-chrome";
const OUT = path.join(root, "GlobeDesk-frog-mission-full.mp4");
const MAX_MS = 9 * 60 * 1000;
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
    const durMs = (row.dur || 0) * 1000;
    if (row.t < lastEnd + gap) {
      log("clamp cue", row.extra || path.basename(row.wav || ""), "from", (row.t / 1000).toFixed(2), "to", ((lastEnd + gap) / 1000).toFixed(2));
      row.t = lastEnd + gap;
    }
    lastEnd = row.t + durMs;
  }
  return out;
}


async function until(fn, ms, label) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    try { const v = await fn(); if (v) return v; last = v; } catch (e) { last = e && e.message; }
    await sleep(250);
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
  if (/abort|cancel|Download the React DevTools|favicon|youtube|nocookie|googlevideo|ytimg|ggpht|Failed to load resource: the server responded with a status of 404|play\(\) request was interrupted|AbortError|Cannot read properties of null \(reading 'getLayer'\)/i.test(s)) return true;
  return false;
}

async function shot(name) {
  const r = await c.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const dest = path.join(shots, name);
  await fs.writeFile(dest, Buffer.from(r.data, "base64"));
  log("shot", name);
  return dest;
}

async function startStack() {
  await fs.mkdir(work, { recursive: true });
  await fs.mkdir(shots, { recursive: true });
  await fs.rm(PROFILE, { recursive: true, force: true });
  try { spawnLogged("bash", ["-lc", `fuser -k ${PORT}/tcp ${DBG}/tcp >/dev/null 2>&1 || true`]); } catch {}
  await sleep(300);
  log("starting Xvfb", DISPLAY);
  spawnLogged("Xvfb", [DISPLAY, "-screen", "0", `${W}x${H}x24`, "-ac", "+extension", "GLX", "+render", "-noreset"], { stdio: "ignore" });
  await sleep(400);
  const env = { ...process.env, DISPLAY, GDK_BACKEND: "x11", XDG_SESSION_TYPE: "x11" };
  try { spawnLogged("xsetroot", ["-solid", "#000408"], { env, stdio: "ignore" }); } catch {}
  try { spawnLogged("xfwm4", ["--compositor=off", "--sm-client-disable"], { env, stdio: "ignore" }); } catch {}
  await sleep(300);
  try { spawnLogged("xset", ["-dpms", "s", "off"], { env, stdio: "ignore" }); } catch {}
  log("starting http server", PORT);
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
    `http://127.0.0.1:${PORT}/index.html?auto=1&record=1`
  ];
  log("starting chrome");
  spawnLogged(process.env.CHROME || "google-chrome", chromeArgs, { env, stdio: "ignore" });
  await until(async () => { try { return (await fetch(`http://127.0.0.1:${DBG}/json/version`)).ok; } catch { return false; } }, 20000, "chrome");
  const targets = await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json();
  const page = targets.find((t) => t.type === "page" && /8766|index\.html/.test(t.url)) || targets.find((t) => t.type === "page");
  if (!page) throw new Error("no chrome page: " + JSON.stringify(targets));
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
  await ev(`(() => {
    try {
      const w = document.getElementById("desk") && document.getElementById("desk").contentWindow;
      if (w) {
        w.addEventListener("error", (e) => {
          if (window.__demo && window.__demo.state) window.__demo.state.errors.push("iframe: " + e.message);
        });
        w.addEventListener("unhandledrejection", (e) => {
          const m = e.reason && e.reason.message ? e.reason.message : e.reason;
          if (window.__demo && window.__demo.state) window.__demo.state.errors.push("iframe-promise: " + m);
        });
      }
    } catch (err) {}
    return true;
  })()`);
  try { spawnLogged("bash", ["-lc", `DISPLAY=${DISPLAY} xdotool search --onlyvisible --class chrome windowmove 0 0 windowsize ${W} ${H} || true`], { stdio: "ignore" }); } catch {}
}

async function startCapture() {
  const raw = path.join(work, "raw.mp4");
  const logFile = path.join(work, "ffmpeg-capture.log");
  const out = fsSync.openSync(logFile, "w");
  const args = ["-y", "-hide_banner", "-thread_queue_size", "4096",
    "-f", "x11grab", "-draw_mouse", "0", "-video_size", `${W}x${H}`, "-framerate", "30",
    "-i", DISPLAY, "-an", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "17", "-pix_fmt", "yuv420p", raw];
  log("starting ffmpeg x11grab");
  const ff = spawn("ffmpeg", args, { stdio: ["pipe", out, out], env: { ...process.env, DISPLAY } });
  kids.push(ff);
  await until(() => fsSync.existsSync(raw) && fsSync.statSync(raw).size > 0, 8000, "ffmpeg file").catch(() => null);
  await sleep(300);
  return { ff, raw };
}

function stopFf(ff) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { try { ff.kill("SIGKILL"); } catch {} resolve(); }, 8000);
    ff.on("exit", () => { clearTimeout(t); resolve(); });
    try { ff.stdin.end(); } catch {}
    try { ff.kill("SIGINT"); } catch {}
  });
}

async function muxAudio(raw, cues, recPerf0, videoDur) {
  const seen = new Set();
  const lines = (cues || []).filter((x) => {
    if (x.id !== "line" || !x.extra) return false;
    if (x.t < recPerf0 - 200) return false;
    const k = x.extra + "@" + Math.round((x.t - recPerf0) / 800);
    if (seen.has(k)) return false;
    if (seen.has("start") && x.extra === "start") return false;
    seen.add(k);
    if (x.extra === "start") seen.add("start");
    return true;
  });
  const bed = path.join(sfxDir, "ambience-ship.wav");
  const radioBed = path.join(root, "work", "radio-bed", "Cool-Rock.mp3");
  const inputs = ["-i", raw];
  const filters = [];
  const voLabels = [];
  const fmt = "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";
  let n = 1;
  const hasBed = fsSync.existsSync(bed);
  if (hasBed) {
    inputs.push("-stream_loop", "-1", "-i", bed);
    filters.push(`[${n}:a]atrim=0:${videoDur.toFixed(3)},asetpts=PTS-STARTPTS,${fmt},volume=0.16[bed]`);
    n += 1;
  }
  const hasRadio = fsSync.existsSync(radioBed);
  const radioEv = (cues || []).filter((x) => x.id === "radio").map((x) => ({
    t: Math.max(0, (x.t - recPerf0) / 1000),
    on: x.extra === "on"
  })).sort((a, b) => a.t - b.t);
  const radioWins = [];
  let radOn = false, radStart = 0;
  for (const e of radioEv) {
    if (e.on && !radOn) { radStart = e.t; radOn = true; }
    else if (!e.on && radOn) { radioWins.push([radStart, Math.min(e.t, videoDur)]); radOn = false; }
  }
  if (radOn) radioWins.push([radStart, videoDur]);
  if (hasRadio && radioWins.length) {
    const fade = 0.7;
    const parts = radioWins.map(([a, b]) => {
      const a2 = a + fade, b2 = b - fade;
      const mid = (b2 > a2) ? `between(t,${a2.toFixed(3)},${b2.toFixed(3)})` : "0";
      const fadeIn = `between(t,${a.toFixed(3)},${Math.min(a + fade, b).toFixed(3)})*((t-${a.toFixed(3)})/${fade})`;
      const fadeOut = `between(t,${Math.max(b - fade, a).toFixed(3)},${b.toFixed(3)})*((${b.toFixed(3)}-t)/${fade})`;
      return `(${mid}+${fadeIn}+${fadeOut})`;
    });
    // 0.30 open; sidechain later ducks under VO toward -24..-28 LUFS.
    const expr = "0.30*(" + parts.join("+") + ")";
    inputs.push("-stream_loop", "-1", "-i", radioBed);
    filters.push(`[${n}:a]atrim=0:${videoDur.toFixed(3)},asetpts=PTS-STARTPTS,${fmt},volume=eval=frame:volume='${expr}'[radio]`);
    n += 1;
    log("radio bed windows", radioWins.map(([a,b]) => a.toFixed(2) + "-" + b.toFixed(2)).join(", "));
  }
  const prepared = [];
  for (const row of lines) {
    const wav = path.join(voDir, row.extra + ".wav");
    if (!fsSync.existsSync(wav)) { log("missing vo", row.extra); continue; }
    prepared.push({ t: Math.max(0, row.t - recPerf0), wav, extra: row.extra, dur: probeDur(wav) });
  }
  const clamped = clampCues(prepared, 280);
  for (const row of clamped) {
    const delay = Math.max(0, Math.round(row.t));
    inputs.push("-i", row.wav);
    filters.push(`[${n}:a]${fmt},adelay=${delay}|${delay},volume=1[a${n}]`);
    voLabels.push(`[a${n}]`);
    n += 1;
    log("voice", row.extra, "at", (delay / 1000).toFixed(2) + "s", "dur", (row.dur || 0).toFixed(2));
  }
  const tmp = path.join(work, "mixed.mp4");
  const dur = Math.max(videoDur, 1);
  if (voLabels.length === 0 && !hasBed) {
    log("no audio cues to mux; writing video-only");
    await new Promise((res, rej) => {
      const p = spawn("ffmpeg", ["-y", "-i", raw, "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-t", String(dur), OUT], { stdio: "inherit" });
      p.on("exit", (code) => code === 0 ? res() : rej(new Error("ffmpeg out " + code)));
    });
    return;
  }
  let fc;
  const hasRadioMix = filters.some((f) => f.endsWith("[radio]"));
  if (hasBed && hasRadioMix) {
    filters.push("[bed][radio]amix=inputs=2:dropout_transition=0:normalize=0:duration=longest[beds]");
  }
  const beds = (hasBed && hasRadioMix) ? "beds" : (hasBed ? "bed" : (hasRadioMix ? "radio" : null));
  if (beds && voLabels.length) {
    fc = filters.join(";") + ";" + voLabels.join("") + `amix=inputs=${voLabels.length}:dropout_transition=0:normalize=0:duration=longest[vo];` +
      `[vo]asplit=2[vo_sc][vo_mx];` +
      `[${beds}][vo_sc]sidechaincompress=threshold=0.05:ratio=8:attack=40:release=280:makeup=1[bedd];` +
      `[bedd][vo_mx]amix=inputs=2:dropout_transition=0:normalize=0:duration=longest[amixed];[amixed]apad[aout]`;
  } else if (voLabels.length) {
    fc = filters.join(";") + ";" + voLabels.join("") + `amix=inputs=${voLabels.length}:dropout_transition=0:normalize=0:duration=longest[aout]`;
  } else if (beds) {
    fc = filters.join(";") + `;[${beds}]anull[aout]`;
  } else {
    fc = filters.join(";") + ";[bed]anull[aout]";
  }
  const args = ["-y", ...inputs, "-filter_complex", fc, "-map", "0:v", "-map", "[aout]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k", "-movflags", "+faststart",
    "-t", String(dur + 0.4), tmp];
  await new Promise((res, rej) => {
    const p = spawn("ffmpeg", args, { stdio: "inherit" });
    p.on("exit", (code) => code === 0 ? res() : rej(new Error("ffmpeg mux " + code)));
  });
  await fs.copyFile(tmp, OUT);
}

function killAll() {
  for (const p of kids.slice().reverse()) {
    try { if (!p.killed) p.kill("SIGTERM"); } catch {}
  }
}

async function main() {
  await startStack();

  const { ff, raw } = await startCapture();
  const recPerf0 = await ev("performance.now()");
  log("capture t0", recPerf0);

  const taken = {};
  const take = async (name, cond) => {
    if (taken[name]) return;
    if (!cond) return;
    await shot(name);
    taken[name] = true;
  };

  log("waiting for playthrough (warmup may finish under boot/start)");
  const tStart = Date.now();
  let lastLog = 0;
  await until(async () => {
    const st = await ev(`({
      phase: window.__demo.phase,
      done: window.__demo.done,
      buildings: window.__demo.buildingsCount,
      roads: window.__demo.roadsCount,
      lvl: window.__demo.levelId,
      idx: window.__demo.levelIndex,
      badges: window.__demo.badges,
      xp: window.__demo.xp,
      streetsWarmed: window.__demo.streetsWarmed,
      deskReady: window.__demo.deskReady,
      zoom: (function(){ try { return window.DemoDesk.map().getZoom(); } catch (e) { return 0; } })(),
      deskDone: window.DemoDesk ? Object.assign({}, window.DemoDesk.done) : {}
    })`);
    if (Date.now() - lastLog > 8000) {
      log("tick", JSON.stringify(st));
      lastLog = Date.now();
    }
    await take("01-boot.png", st.phase === "boot");
    await take("01-start.png", st.phase === "start" && Date.now() - tStart > 2500);
    await take("02-street.png", st.lvl === "dive" && st.zoom >= 15.2);
    await take("03-embed.png", !!(st.deskDone && st.deskDone.embed) || (st.badges || []).indexOf("overlay") >= 0);
    await take("04-kit.png", st.lvl === "grokme" && !!(st.deskDone && st.deskDone.grokme) || (st.badges || []).indexOf("kit") >= 0);
    await take("05-debrief.png", st.phase === "debrief" || st.done);
    if (st.done) return st;
    return false;
  }, MAX_MS, "mission complete");

  // Let the debrief hold land in the file
  await sleep(2000);
  if (!taken["05-debrief.png"]) await take("05-debrief.png", true);

  const elapsed = (await ev("performance.now()") - recPerf0) / 1000;
  log("elapsed", elapsed.toFixed(2), "s");

  const report = await ev(`({
    errors: window.__demo.errors,
    cues: window.__demo.cues,
    xp: window.__demo.xp,
    badges: window.__demo.badges,
    rank: window.__demo.rank,
    streetsWarmed: window.__demo.streetsWarmed,
    buildingsCount: window.__demo.buildingsCount,
    roadsCount: window.__demo.roadsCount,
    phase: window.__demo.phase,
    done: window.__demo.done,
    levelId: window.__demo.levelId
  })`);
  await fs.writeFile(path.join(work, "report.json"), JSON.stringify({ report, consoleErrors, elapsed, taken }, null, 2));

  await stopFf(ff);
  await muxAudio(raw, report.cues, recPerf0, elapsed);

  const probe = await new Promise((res) => {
    const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", OUT], { stdio: ["ignore", "pipe", "pipe"] });
    let s = ""; p.stdout.on("data", (d) => s += d);
    p.on("exit", () => res(parseFloat(s.trim() || "0")));
  });
  log("OUT", OUT, "duration", probe.toFixed(2), "s");
  log("console errors", consoleErrors.length, consoleErrors);
  log("page errors", report.errors);
  log("xp", report.xp, "rank", report.rank, "badges", report.badges, "buildings", report.buildingsCount, "roads", report.roadsCount);
  log("shots", taken);

  await fs.writeFile(path.join(work, "console.json"), JSON.stringify({ consoleErrors, consoleOther, page: report.errors }, null, 2));
  if (consoleErrors.length || (report.errors && report.errors.length)) {
    console.error("FAIL: console errors present");
    process.exitCode = 2;
  } else {
    log("CLEAR: 0 console errors");
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => {
  killAll();
  await sleep(500);
  try { spawn("bash", ["-lc", `pkill -f "Xvfb ${DISPLAY}" >/dev/null 2>&1 || true; pkill -f "remote-debugging-port=${DBG}" >/dev/null 2>&1 || true; fuser -k ${PORT}/tcp >/dev/null 2>&1 || true`]); } catch {}
});
