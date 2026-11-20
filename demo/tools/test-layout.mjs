#!/usr/bin/env node
// Bounding-box audit of demo + desk chrome at 1920x1080 and 1280x800.
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outDir = "/tmp/final-qa/layout/after";
const PORT = 8770, DBG = 9480, DISPLAY = ":98";
const PROFILE = "/tmp/globedesk-layout-chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kids = [];
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
  return p;
}
function killAll() {
  for (const p of kids.slice().reverse()) { try { p.kill("SIGTERM"); } catch {} }
}

const SELS = ["#missionBar", "#railLeft", "#log", "#shipRadio", "#comms", "#objective",
  "#caption", ".controls", ".lower-third", "#kit", "#kitBackdrop", "#voiceLab",
  "#screen-start", "#debrief"];

const ALLOW = new Set([
  "kit|kitBackdrop", "kitBackdrop|kit",
  // kit modal may cover rails/globe on purpose
  "kit|railLeft", "railLeft|kit", "kit|log", "log|kit", "kit|shipRadio", "shipRadio|kit",
  "kit|comms", "comms|kit", "kit|caption", "caption|kit",
  "kitBackdrop|railLeft", "railLeft|kitBackdrop", "kitBackdrop|log", "log|kitBackdrop",
  "kitBackdrop|shipRadio", "shipRadio|kitBackdrop", "kitBackdrop|comms", "comms|kitBackdrop",
  "kitBackdrop|caption", "caption|kitBackdrop", "kitBackdrop|objective", "objective|kitBackdrop",
  "kit|objective", "objective|kit",
  // rail contains its children
  "railLeft|log", "log|railLeft", "railLeft|shipRadio", "shipRadio|railLeft",
  "railLeft|comms", "comms|railLeft",
  // start art is a backdrop behind rails
  "screen-start|railLeft", "railLeft|screen-start", "screen-start|log", "log|screen-start",
  "screen-start|shipRadio", "shipRadio|screen-start", "screen-start|comms", "comms|screen-start",
  "screen-start|caption", "caption|screen-start", "screen-start|objective", "objective|screen-start",
  "screen-start|controls", "controls|screen-start",
  // debrief card may sit in the center over the globe art, not over rails
  "debrief|screen-start", "screen-start|debrief",
  "kit|desk:colright", "desk:colright|kit", "kit|desk:tabs", "desk:tabs|kit",
  "kit|desk:topbar", "desk:topbar|kit", "kit|desk:colleft", "desk:colleft|kit",
  "kitBackdrop|desk:colright", "desk:colright|kitBackdrop", "kitBackdrop|desk:tabs", "desk:tabs|kitBackdrop",
  "kitBackdrop|desk:topbar", "desk:topbar|kitBackdrop", "kitBackdrop|desk:colleft", "desk:colleft|kitBackdrop",
  "kitBackdrop|controls", "controls|kitBackdrop", "kitBackdrop|lower-third", "lower-third|kitBackdrop",
]);

function pairKey(a, b) { return a < b ? a + "|" + b : b + "|" + a; }
function overlaps(A, B) {
  return A.right > B.left + 2 && A.left < B.right - 2 && A.bottom > B.top + 2 && A.top < B.bottom - 2;
}
function contains(A, B) {
  return A.left <= B.left + 2 && A.right >= B.right - 2 && A.top <= B.top + 2 && A.bottom >= B.bottom - 2;
}

async function shot(name) {
  const r = await c.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const dest = path.join(outDir, name);
  await fs.writeFile(dest, Buffer.from(r.data, "base64"));
  return dest;
}

async function measure(tag) {
  return ev(`(function (sels) {
    function vis(el) {
      if (!el) return false;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
      if (el.hidden) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    }
    function box(el) {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    }
    const out = [];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!vis(el)) continue;
      const id = (el.id || sel.replace(/[#.]/g, "")) ;
      out.push({ id, sel, box: box(el) });
    }
    // desk iframe chrome
    try {
      const f = document.getElementById("desk");
      const doc = f && f.contentDocument;
      if (doc) {
        for (const sel of [".topbar", ".col.left", ".col.right", ".tabs", ".readable", ".gd-full"]) {
          const el = doc.querySelector(sel);
          if (!vis(el)) continue;
          const r = el.getBoundingClientRect();
          const fr = f.getBoundingClientRect();
          const b = { left: r.left + fr.left, right: r.right + fr.left, top: r.top + fr.top, bottom: r.bottom + fr.top, width: r.width, height: r.height };
          // iframe element rect already in parent coords if same-origin getBoundingClientRect on inner is viewport of iframe...
          // Use iframe offset:
          const ib = el.getBoundingClientRect();
          out.push({ id: "desk:" + sel.replace(/[.#]/g, ""), sel: "iframe " + sel, box: {
            left: fr.left + ib.left, right: fr.left + ib.right,
            top: fr.top + ib.top, bottom: fr.top + ib.bottom,
            width: ib.width, height: ib.height
          }});
        }
      }
    } catch (e) {}
    return out;
  })(${JSON.stringify(SELS)})`).then((items) => {
    const hits = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (!overlaps(items[i].box, items[j].box)) continue;
        const a = items[i], b = items[j];
        if (contains(a.box, b.box) || contains(b.box, a.box)) continue;
        const key = pairKey(a.id, b.id);
        const allow = ALLOW.has(key) || ALLOW.has(a.id + "|" + b.id) || ALLOW.has(b.id + "|" + a.id);
        const startBackdrop = (a.id === "screen-start" || b.id === "screen-start");
        if (allow || startBackdrop) continue;
        hits.push({ a: a.id, b: b.id, allow: false });
      }
    }
    return { tag, items, hits };
  });
}

async function setViewport(w, h) {
  await c.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  try { spawn("bash", ["-lc", `DISPLAY=${DISPLAY} xdotool search --onlyvisible --class Chrome windowsize %@ ${w} ${h} windowmove %@ 0 0`], { stdio: "ignore" }); } catch {}
  await sleep(250);
}

async function states() {
  const results = [];
  // start (after boot hidden) — reset leftovers from a previous size
  await ev(`(function(){
    const b=document.getElementById("boot"); if(b) b.classList.add("hidden");
    document.body.classList.remove("booting");
    if (window.DemoDesk && window.DemoDesk.hideKit) window.DemoDesk.hideKit();
    ["screen-cold","screen-complete"].forEach(function(id){ const el=document.getElementById(id); if(el) el.classList.add("hidden"); });
    const st=document.getElementById("screen-start"); if(st) st.classList.remove("hidden");
    if (window.DemoDesk) window.DemoDesk.setKioskMode("globe");
    window.__demo && window.__demo.showCaption && window.__demo.showCaption("GM frens. Desk is online. This is mission control. Ready when you are.");
  })()`);
  await sleep(200);
  results.push(await measure("start"));
  await shot(currentSize + "-start.png");

  // inspect-like: show caption + objective + log
  await ev(`(async function(){
    const st = document.getElementById("screen-start");
    if (st) st.classList.add("hidden");
    if (window.DemoDesk && window.DemoDesk.setKioskMode) window.DemoDesk.setKioskMode("inspect");
    const obj = document.getElementById("objective");
    if (obj) { obj.classList.remove("empty"); obj.textContent = "OBJECTIVE · PLACE A SCREEN OVERLAY"; }
    if (window.__demo && window.__demo.showCaption) window.__demo.showCaption("Overlay your media, or embed a credited YouTube window. The globe stays the globe.");
  })()`);
  await sleep(400);
  results.push(await measure("inspect"));
  await shot(currentSize + "-inspect.png");

  // kit modal
  await ev(`(async function(){
    if (window.DemoDesk && window.DemoDesk.assistGrokme) { try { await window.DemoDesk.assistGrokme(); } catch(e) {} }
    else {
      const kit = document.getElementById("kit");
      const bd = document.getElementById("kitBackdrop");
      if (kit) kit.classList.add("on");
      if (bd) bd.hidden = false;
    }
    if (window.__demo && window.__demo.showCaption) window.__demo.showCaption("This is the Grok.me build kit — brief, prompts, and a file manifest. Rebuild the desk from the repo.");
  })()`);
  await sleep(500);
  results.push(await measure("kit"));
  await shot(currentSize + "-kit.png");

  // hide kit, debrief
  await ev(`(function(){
    if (window.DemoDesk && window.DemoDesk.hideKit) window.DemoDesk.hideKit();
    if (window.__demo && window.__demo.enterDebriefPreview) window.__demo.enterDebriefPreview();
  })()`);
  await sleep(400);
  results.push(await measure("debrief"));
  await shot(currentSize + "-debrief.png");
  return results;
}

let currentSize = "1920x1080";

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  spawn("bash", ["-lc", `fuser -k ${PORT}/tcp ${DBG}/tcp >/dev/null 2>&1 || true; pkill -f "Xvfb ${DISPLAY}" >/dev/null 2>&1 || true; pkill -f "remote-debugging-port=${DBG}" >/dev/null 2>&1 || true`]);
  await sleep(400);
  spawnLogged("Xvfb", [DISPLAY, "-screen", "0", "1920x1080x24", "-ac"]);
  await sleep(400);
  spawnLogged("python3", [path.join(root, "tools", "serve.py"), "--port", String(PORT)], { stdio: "ignore" });
  await sleep(500);
  spawnLogged("google-chrome", [
    `--remote-debugging-port=${DBG}`, `--user-data-dir=${PROFILE}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu",
    "--window-size=1920,1080", "--window-position=0,0",
    `http://127.0.0.1:${PORT}/?record=1`,
  ], { env: { ...process.env, DISPLAY } });
  const ws = await until(async () => {
    const r = await fetch(`http://127.0.0.1:${DBG}/json/list`);
    const list = await r.json();
    const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    return page && page.webSocketDebuggerUrl;
  }, 15000, "chrome");
  c = new Cdp(ws);
  await c.ready;
  await c.send("Page.enable");
  await until(() => ev("!!(window.__demo && window.__demo.ready)"), 30000, "demo ready");
  await ev(`(function(){ const b=document.getElementById("boot"); if(b) b.classList.add("hidden"); document.body.classList.remove("booting"); })()`);

  const all = {};
  let fails = 0;
  for (const [w, h, label] of [[1920, 1080, "1920x1080"], [1280, 800, "1280x800"]]) {
    currentSize = label;
    await setViewport(w, h);
    const rows = await states();
    all[label] = rows;
    for (const row of rows) {
      const n = row.hits.length;
      if (n) fails += n;
      log((n ? "FAIL" : "ok  "), label, row.tag, "unintended=" + n, n ? JSON.stringify(row.hits) : "");
    }
  }
  await fs.writeFile(path.join(outDir, "intersections.json"), JSON.stringify({ fails, all }, null, 2));
  log("DONE unintended=" + fails);
  if (fails) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => {
  killAll();
  try { spawn("pkill", ["-f", "Xvfb " + DISPLAY], { stdio: "ignore" }); } catch {}
});
