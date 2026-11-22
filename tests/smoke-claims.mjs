#!/usr/bin/env node
// Claims smoke: real boot with the workspace episode already loaded, then the news-desk claims sidecar.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.SMOKE_PORT || 8256);
const DBG = Number(process.env.SMOKE_DBG || 9446);
const W = 1280, H = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WARN_RE = /performance warning|READ-usage buffer|shadow copy that was created to accelerate readback/i;
// Isolated smoke blocks off-box hosts. Hybrid base still tries OpenFreeMap; that is not a product regression.
const EXT_NET_RE = /openfreemap\.org|tiles\.maps\.eox\.at|elevation-tiles-prod|gibs\.earthdata\.nasa\.gov|api\.maptiler\.com|ERR_NAME_NOT_RESOLVED|ERR_ABORTED/i;
const warnings = [], errors = [], allConsole = [];
const isIsolatedNet = (s) => EXT_NET_RE.test(String(s || ""));

const chromeBin = process.env.CHROME || "google-chrome";
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gd-smoke-claims-"));
const profile = path.join(tmpRoot, "profile");
const dataDir = process.env.GLOBEDESK_DATA || path.join(tmpRoot, "data");
const downloadDir = path.join(tmpRoot, "downloads");
fs.mkdirSync(profile, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(downloadDir, { recursive: true });

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
  await c.send("Network.enable");
  try { await c.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir }); }
  catch { try { await c.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir, eventsEnabled: true }); } catch {} }
  const netRequests = [];
  const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ""; } };
  c.on("Network.requestWillBeSent", (p) => {
    const url = (p.request && p.request.url) || "";
    netRequests.push(url);
  });
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

  await c.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.addEventListener('securitypolicyviolation', (e) => { window.__cspViolations = window.__cspViolations || []; window.__cspViolations.push({ blocked: e.blockedURI, directive: e.violatedDirective }); });" });
  await c.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });
  await until(() => ev("window.__globedesk && window.__globedesk.ready && GD && GD.globe && GD.globe.st && GD.globe.st.status === 'ready'"), 30000, "app ready");
  await until(() => ev("GD.newsdesk && GD.newsdesk.state && GD.newsdesk.state.loaded === true && GD.newsdesk.state.feed.topics.length === 50"), 15000, "50 topics loaded");
  await until(() => ev("GD.claims && GD.claims.state && GD.claims.state.loaded === true && GD.research && GD.research.state && GD.research.state.loaded === true && GD.records && GD.records.state && GD.records.state.loaded === true"), 15000, "claims, research and records loaded");

  const before = await ev(`({
    stories: GD.state && GD.state.episode && (GD.state.episode.stories || []).length,
    epId: GD.state && GD.state.episode && GD.state.episode.id,
    claims: (GD.claims && GD.claims.state && GD.claims.state.claims || []).length,
    claimErrors: (GD.claims && GD.claims.state && GD.claims.state.errors) || [],
    cards: document.querySelectorAll(".nd-card").length
  })`);
  if (before.stories > 2) throw new Error("workspace episode should stay blank or DC: " + JSON.stringify(before));
  if (before.claimErrors.length) throw new Error("claims sidecar errors: " + before.claimErrors.join("; "));
  if (before.claims !== 3) throw new Error("expected 3 claims loaded, got " + JSON.stringify(before));
  if (before.cards !== 50) throw new Error("expected 50 cards, got " + before.cards);

  const chicago = await ev(`(async () => {
    GD.newsdesk.selectTopic("story-nd-chicago-river-reversal", { silent: true });
    const chips = document.querySelectorAll(".claim-chip");
    const cols = document.querySelectorAll(".claim-disagree-col");
    const strip = document.querySelector(".nd-claims");
    const setOut = await GD.commands.setClaim({
      storyId: "story-nd-chicago-river-reversal",
      cardId: "card-nd-chicago-river",
      factIndex: 2,
      claimStatus: "supported",
      sourceIds: ["src-mwrd-history"]
    });
    return {
      chips: chips.length,
      chipClasses: Array.from(chips).map((n) => n.className),
      cols: cols.length,
      hasStrip: !!strip,
      authorNote: !!(strip && /Scores are set by the author, not by GlobeDesk/.test(strip.textContent || "")),
      jan2: !!(strip && /2 January 1900/.test(strip.textContent || "")),
      jan17: !!(strip && /17 January 1900/.test(strip.textContent || "")),
      setOk: !!(setOut && setOut.ok),
      setError: setOut && setOut.error,
      workspaceStories: (GD.state.episode.stories || []).length
    };
  })()`);

  if (!chicago.hasStrip) throw new Error("Chicago strip missing: " + JSON.stringify(chicago));
  if (chicago.chips !== 3) throw new Error("expected 3 chips, got " + JSON.stringify(chicago));
  if (chicago.cols !== 2) throw new Error("expected 2 disagree columns, got " + JSON.stringify(chicago));
  if (!chicago.authorNote || !chicago.jan2 || !chicago.jan17) throw new Error("strip text missing: " + JSON.stringify(chicago));
  if (!chicago.setOk) throw new Error("setClaim failed on a news-desk story: " + JSON.stringify(chicago));
  if (chicago.workspaceStories > 2) throw new Error("setClaim changed the workspace episode: " + JSON.stringify(chicago));

  const research = await ev(`(async () => {
    const opened = await GD.commands.openResearch({ storyId: "story-nd-chicago-river-reversal" });
    const listed = await GD.commands.listResearch({ storyId: "story-nd-chicago-river-reversal" });
    const drawer = document.getElementById("ndResearch");
    const text = (drawer && drawer.textContent) || "";
    return {
      openOk: !!(opened && opened.ok),
      listOk: !!(listed && listed.ok),
      gapLabels: (listed && listed.result && listed.result.gaps || []).map((g) => g.label),
      gapCount: listed && listed.result && listed.result.counts && listed.result.counts.gaps,
      hasQuoteText: !!(listed && listed.result && JSON.stringify(listed.result).includes("initial inflow of water")),
      drawerGap: /Surveyed lock coordinate/.test(text),
      drawerUnknown: /\[UNKNOWN\]/.test(text),
      hidden: !!(drawer && drawer.hidden)
    };
  })()`);
  if (!research.openOk || !research.listOk) throw new Error("research commands failed: " + JSON.stringify(research));
  if (research.gapCount !== 1 || !research.gapLabels.includes("Surveyed lock coordinate")) throw new Error("fixture gaps missing: " + JSON.stringify(research));
  if (research.hasQuoteText) throw new Error("listResearch returned quote text: " + JSON.stringify(research));
  if (!research.drawerGap || !research.drawerUnknown) throw new Error("drawer missing fixture gap: " + JSON.stringify(research));

  const recs = await ev(`(async () => {
    const listed = await GD.commands.listRecords({ storyId: "story-nd-chicago-river-reversal" });
    const strip = document.querySelector(".nd-records-slot, .nd-offmap");
    const text = (strip && strip.textContent) || "";
    return {
      listOk: !!(listed && listed.ok),
      onMap: listed && listed.result && listed.result.counts && listed.result.counts.onMap,
      offMap: listed && listed.result && listed.result.counts && listed.result.counts.offMap,
      offIds: (listed && listed.result && listed.result.offMapIds) || [],
      hasOffMap: /Not on the map/.test(text),
      hasUnknown: /\[UNKNOWN\]/.test(text)
    };
  })()`);
  if (!recs.listOk || recs.onMap !== 2 || recs.offMap !== 2) throw new Error("records list missing fixture rows: " + JSON.stringify(recs));
  if (!recs.offIds.includes("rec-sample-deepening-stretch")) throw new Error("SAMPLE deepening stretch should stay off the map: " + JSON.stringify(recs));
  if (!recs.hasOffMap || !recs.hasUnknown) throw new Error("news-desk off-map list missing: " + JSON.stringify(recs));

  const pageCsp = await ev(`window.__cspViolations || []`);
  const allCsp = pageCsp;
  const badNet = netRequests.filter((u) => {
    if (u.startsWith("data:") || u.startsWith("blob:")) return false;
    const host = hostOf(u);
    if (!host || host === "127.0.0.1" || host === "localhost") return false;
    if (EXT_NET_RE.test(u)) return false;
    return true;
  });
  if (allCsp.length) throw new Error("CSP violations: " + JSON.stringify(allCsp));
  if (badNet.length) throw new Error("non-localhost requests: " + badNet.join(", "));

  console.log(JSON.stringify({ smoke: "claims", errors: errors.length, warnings: warnings.length, before, chicago, research, records: recs, net: netRequests.length, csp: allCsp.length }, null, 2));
  if (errors.length) { console.error("ERRORS:\n" + errors.join("\n")); failed = true; }
  if (warnings.length) { console.error("WARNINGS:\n" + warnings.join("\n")); failed = true; }
  if (!failed) console.log("smoke-claims: 0 warnings, 0 errors, 3 claims, 3 chips, 2 columns, research drawer ok, localhost-only network");
} catch (e) {
  failed = true;
  console.error(e);
  if (errors.length) console.error("ERRORS so far:\n" + errors.join("\n"));
} finally {
  try { if (c) await c.send("Browser.close"); } catch {}
  try { chrome.kill("SIGKILL"); } catch {}
  try { server.kill("SIGKILL"); } catch {}
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  process.exit(failed ? 1 : 0);
}
