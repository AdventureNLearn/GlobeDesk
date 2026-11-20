#!/usr/bin/env node
// Layout test: every script line's caption is fully visible (no clip by HINT/CONTINUE).
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outDir = "/tmp/final-qa/caption-test";
const PORT = 8769, DBG = 9479, DISPLAY = ":97";
const W = 1920, H = 1080;
const PROFILE = "/tmp/globedesk-caption-chrome";
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
  for (const p of kids.slice().reverse()) {
    try { p.kill("SIGTERM"); } catch {}
  }
}

async function shot(name) {
  const r = await c.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const dest = path.join(outDir, name);
  await fs.writeFile(dest, Buffer.from(r.data, "base64"));
  return dest;
}

const overlap = (a, b) => a && b && a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  spawn("bash", ["-lc", `fuser -k ${PORT}/tcp ${DBG}/tcp >/dev/null 2>&1 || true; pkill -f "Xvfb ${DISPLAY}" >/dev/null 2>&1 || true; pkill -f "remote-debugging-port=${DBG}" >/dev/null 2>&1 || true`]);
  await sleep(400);
  spawnLogged("Xvfb", [DISPLAY, "-screen", "0", `${W}x${H}x24`, "-ac"]);
  await sleep(400);
  spawnLogged("python3", [path.join(root, "tools", "serve.py"), "--port", String(PORT)], { stdio: "ignore" });
  await sleep(400);
  spawnLogged("google-chrome", [
    `--remote-debugging-port=${DBG}`,
    `--user-data-dir=${PROFILE}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu",
    "--window-size=" + W + "," + H, "--window-position=0,0",
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
  // Dismiss boot if still up so captions sit on the start screen / desk.
  await ev(`(function(){ const b=document.getElementById("boot"); if(b) b.classList.add("hidden"); })()`);
  await sleep(300);

  const lines = await ev(`(function () {
    const C = window.DEMO_CONFIG || window.C || (window.__demo && window.__demo.state && window.__demo.state.config);
    // config after pack merge lives as the object used by resolveLine
    const cfg = (typeof window.C === "function") ? null : null;
    return window.__demo ? true : false;
  })()`);

  const script = await ev(`(function () {
    const pack = window.DEMO_PACK || null;
    const C = (window.DemoConfig) || null;
    // After guidepack merge, texts are on the live config used by resolveLine.
    const src = (function(){
      // demo.js C() is closed over; use DOM-less access via showCaption + pack
      return window.__demo;
    })();
    const m = window.__GUIDE_PACK || window.DEMO_PACK || null;
    return { hasDemo: !!src, hasPack: !!m, keys: m ? Object.keys(m) : [] };
  })()`);
  log("script hook", JSON.stringify(script));

  const rows = await ev(`(async function () {
    const res = await fetch("guide-packs/frogpost/manifest.json");
    const m = await res.json();
    const order = ["spin","dive","open","edit","pins","media","embed","sound","captions","assist","grokme"];
    const spoken = (n) => (n && (n.text || n.spoken) || "").trim();
    const rows = [["start", spoken(m.lines.start)], ["coldopen", spoken(m.lines.coldopen)]];
    for (const id of order) {
      for (const k of ["brief","success","why"]) rows.push([id + "-" + k, spoken(m.levels[id][k])]);
    }
    rows.push(["finale", spoken(m.lines.finale)], ["debrief", spoken(m.lines.debrief)]);
    return rows;
  })()`);
  log("lines", rows.length);

  const results = [];
  let fails = 0;
  for (const [name, text] of rows) {
    const info = await ev(`(function (name, text) {
      const shown = window.__demo.showCaption(text, 8000);
      const cap = document.getElementById("caption");
      const ctrl = document.querySelector(".controls");
      const lt = document.querySelector(".lower-third");
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      const cb = box(cap), tb = box(ctrl), lb = box(lt);
      const overlaps = (a, b) => a && b && a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;
      const visible = cap && cap.textContent.trim().length > 0 && getComputedStyle(cap).display !== "none";
      const overflowY = cap ? (cap.scrollHeight - cap.clientHeight) : 0;
      const pages = (shown && shown.pages) || [text];
      const joined = pages.join(" ");
      const missing = text.split(/\\s+/).filter(Boolean).filter((w) => joined.indexOf(w) === -1);
      return {
        name, text, pages, pageCount: pages.length,
        visible, overflowY,
        overlapControls: overlaps(cb, tb),
        overlapLowerThird: overlaps(cb, lb),
        caption: cb, controls: tb,
        missing,
        shownText: cap ? cap.textContent : ""
      };
    })(${JSON.stringify(name)}, ${JSON.stringify(text)})`);

    const ok = info.visible && !info.overlapControls && !info.overlapLowerThird && info.missing.length === 0 && info.overflowY <= 2;
    if (!ok) fails++;
    results.push(info);
    log((ok ? "ok " : "FAIL") , name, "pages="+info.pageCount, "overlapCtrl="+info.overlapControls, "overlapLT="+info.overlapLowerThird, "missing="+info.missing.length, "oy="+info.overflowY);

    // screenshot the longest / any failure / a few named ones
    if (!ok || ["dive-brief","grokme-brief","assist-brief","embed-why","start","debrief"].includes(name)) {
      await shot((ok ? "ok-" : "fail-") + name + ".png");
    }
  }

  // Open the kit cheaply and shoot it (parent desk iframe has assistGrokme; use a synthetic kit if needed)
  await ev(`(async function () {
    const kit = document.getElementById("kit");
    if (!kit) return false;
    // Prefer the real renderer if the desk hook exists
    try {
      if (window.DemoDesk && window.DemoDesk.assistGrokme) { await window.DemoDesk.assistGrokme(); return true; }
    } catch (e) {}
    kit.classList.add("on");
    return true;
  })()`);
  await sleep(400);
  await shot("kit-panel.png");

  await fs.writeFile(path.join(outDir, "results.json"), JSON.stringify({ fails, results }, null, 2));
  log("DONE fails=" + fails + "/" + rows.length);
  if (fails) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => {
  killAll();
  try { spawn("pkill", ["-f", "Xvfb " + DISPLAY], { stdio: "ignore" }); } catch {}
});
