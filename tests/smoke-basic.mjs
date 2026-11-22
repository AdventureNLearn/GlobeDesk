#!/usr/bin/env node
// Basic GlobeDesk smoke: news-desk view, 50 wired topics, blank episode, 0 console errors.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.SMOKE_PORT || 8221);
const DBG = Number(process.env.SMOKE_DBG || 9441);
const W = 1280, H = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WARN_RE = /performance warning|READ-usage buffer|shadow copy that was created to accelerate readback/i;
// Isolated smoke blocks off-box hosts. Hybrid base still tries OpenFreeMap; that is not a product regression.
const EXT_NET_RE = /openfreemap\.org|tiles\.maps\.eox\.at|elevation-tiles-prod|gibs\.earthdata\.nasa\.gov|api\.maptiler\.com|ERR_NAME_NOT_RESOLVED|ERR_ABORTED/i;
const warnings = [], errors = [], allConsole = [];
const isIsolatedNet = (s) => EXT_NET_RE.test(String(s || ""));

const chromeBin = process.env.CHROME || "google-chrome";
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gd-smoke-basic-"));
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

let c, failed = false;
try {
  await until(async () => (await fetch(`http://127.0.0.1:${DBG}/json/version`)).ok, 20000, "chrome");
  await until(async () => (await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok, 20000, "server");
  const list = await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json();
  const page = list.find((p) => p.type === "page") || list[0];
  c = new Cdp(page.webSocketDebuggerUrl); await c.ready;
  await c.send("Runtime.enable");
  await c.send("Log.enable");
  await c.send("Page.enable");
  const isErrLevel = (l) => /error|assert/i.test(String(l || ""));
  c.on("Log.entryAdded", (p) => {
    const e = p.entry || {};
    const s = [e.level, e.source, e.text].filter(Boolean).join(" ");
    allConsole.push(s);
    if (isIsolatedNet(s)) { /* blocked streaming tiles */ }
    else if (WARN_RE.test(s)) warnings.push(s);
    else if (isErrLevel(e.level)) errors.push(s);
  });
  c.on("Runtime.consoleAPICalled", (p) => {
    const s = (p.args || []).map((a) => a.value ?? a.description ?? a.type).join(" ");
    allConsole.push((p.type || "log") + " " + s);
    if (isIsolatedNet(s)) { /* blocked streaming tiles */ }
    else if (WARN_RE.test(s)) warnings.push(s);
    else if (p.type === "error" || p.type === "assert") errors.push(s);
  });
  c.on("Runtime.exceptionThrown", (p) => {
    const d = p.exceptionDetails || {};
    const s = (d.exception && (d.exception.description || d.exception.value)) || d.text || "exception";
    errors.push(String(s));
    allConsole.push("exception " + s);
  });
  const ev = async (expr) => {
    const r = await c.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || "eval failed");
    return r.result.value;
  };

  await c.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });
  await until(() => ev("window.__globedesk && window.__globedesk.ready && GD && GD.globe && GD.globe.st && GD.globe.st.status === 'ready'"), 30000, "app ready");
  await until(() => ev("GD.newsdesk && GD.newsdesk.state && GD.newsdesk.state.loaded === true && GD.newsdesk.state.feed.topics.length === 50"), 15000, "50 topics loaded");

  const snap = await ev(`({
    view: document.body.className,
    hidden: document.getElementById("newsdesk") && document.getElementById("newsdesk").hidden,
    cards: document.querySelectorAll(".nd-card").length,
    unknown: document.querySelectorAll(".nd-unknown").length,
    notes: document.querySelectorAll(".nd-note").length,
    approx: (document.getElementById("ndCards").innerText || "").includes("Approximate pin"),
    meta: (document.getElementById("ndMeta") && document.getElementById("ndMeta").textContent) || "",
    sections: document.querySelectorAll(".nd-tab").length,
    ep: GD.state && GD.state.episode && GD.state.episode.id,
    show: GD.state && GD.state.episode && GD.state.episode.show,
    theme: GD.state && GD.state.episode && GD.state.episode.look && GD.state.episode.look.theme,
    stories: GD.state && GD.state.episode && (GD.state.episode.stories || []).length,
    topics: GD.newsdesk.state.feed.topics.length,
    sectionCount: GD.newsdesk.state.feed.sections.length,
    toggle: (document.getElementById("btnViewToggle") && document.getElementById("btnViewToggle").textContent) || ""
  })`);

  if (!/view-newsdesk/.test(snap.view)) throw new Error("expected news-desk view: " + JSON.stringify(snap));
  if (snap.hidden) throw new Error("news desk should be visible");
  if (snap.cards !== 50) throw new Error("expected 50 cards, got " + snap.cards);
  if (snap.topics !== 50 || snap.sectionCount !== 10) throw new Error("feed not 50/10: " + JSON.stringify(snap));
  if (!snap.unknown) throw new Error("consumer cards are missing [UNKNOWN] marks: " + JSON.stringify(snap));
  if (!snap.notes) throw new Error("consumer cards are missing pin notes: " + JSON.stringify(snap));
  if (!snap.approx) throw new Error("consumer cards are missing Approximate pin: " + JSON.stringify(snap));
  if (snap.toggle !== "Workspace") throw new Error("toggle should offer Workspace: " + snap.toggle);
  if (snap.stories > 2) throw new Error("boot should not preload the 50-story episode: " + JSON.stringify(snap));

  console.log(JSON.stringify({ smoke: "basic", errors: errors.length, warnings: warnings.length, snap }, null, 2));
  if (errors.length) { console.error("ERRORS:\n" + errors.join("\n")); failed = true; }
  if (warnings.length) { console.error("WARNINGS:\n" + warnings.join("\n")); failed = true; }
  if (!failed) console.log("smoke-basic: 0 warnings, 0 errors, 50 topics");
} catch (e) {
  failed = true;
  console.error(e);
  if (errors.length) console.error("ERRORS so far:\n" + errors.join("\n"));
} finally {
  try { if (c) await c.send("Browser.close"); } catch {}
  try { chrome.kill("SIGKILL"); } catch {}
  try { server.kill("SIGKILL"); } catch {}
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(failed ? 1 : 0);
}
