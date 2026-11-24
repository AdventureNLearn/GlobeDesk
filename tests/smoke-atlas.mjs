#!/usr/bin/env node
// Atlas smoke: news desk still boots with 50 topics; Atlas view, desks, Layers user sections and 3D, 0 console errors.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.SMOKE_PORT || 8231);
const DBG = Number(process.env.SMOKE_DBG || 9451);
const W = 1280, H = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WARN_RE = /performance warning|READ-usage buffer|shadow copy that was created to accelerate readback/i;
// Isolated smoke blocks off-box hosts. Hybrid base still tries OpenFreeMap; that is not a product regression.
const EXT_NET_RE = /openfreemap\.org|tiles\.maps\.eox\.at|elevation-tiles-prod|gibs\.earthdata\.nasa\.gov|api\.maptiler\.com|ERR_NAME_NOT_RESOLVED|ERR_ABORTED/i;
const warnings = [], errors = [], allConsole = [];
const isIsolatedNet = (s) => EXT_NET_RE.test(String(s || ""));

const chromeBin = process.env.CHROME || "google-chrome";
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gd-smoke-atlas-"));
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
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text || "eval failed");
    return r.result.value;
  };

  await c.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });
  await until(() => ev("window.__globedesk && window.__globedesk.ready && GD && GD.globe && GD.globe.st && GD.globe.st.status === 'ready'"), 30000, "app ready");
  await until(() => ev("GD.newsdesk && GD.newsdesk.state && GD.newsdesk.state.loaded === true && GD.newsdesk.state.feed.topics.length === 50"), 15000, "50 topics loaded");

  const q = (expr) => ev(expr);
  const out = {};
  out.boot = await q(`({ view: document.body.className, cards: document.querySelectorAll(".nd-card").length, ver: document.getElementById("appVersion").textContent, desk: document.getElementById("deskSelect").value, desks: document.getElementById("deskSelect").options.length, atlasHidden: document.getElementById("atlasView").hidden })`);
  if (out.boot.cards !== 50 || out.boot.desk !== "news" || out.boot.desks !== 10 || !out.boot.atlasHidden) throw new Error("boot: " + JSON.stringify(out.boot));
  if (!/v1\.4\.0-draft/.test(out.boot.ver)) throw new Error("version: " + out.boot.ver);

  // Bells layer: pins (or clusters) on the globe at start, from the bundled Bells pack.
  out.bellsBoot = await q(`({ marks: document.querySelectorAll(".bl-pin, .bl-cluster").length, total: GD.bellsLayer.pins(GD.atlasData).length })`);
  if (out.bellsBoot.marks < 3 || out.bellsBoot.total < 40) throw new Error("bells at start: " + JSON.stringify(out.bellsBoot));
  // Expected counts come from the bundled data (the Bells pack adds dozens of entries and places).
  const exp = await q(`(() => { const M = GD.atlasModel, D = GD.atlasData; const pl = M.byPlace(D, {}).rows; return { az: M.azRows(D, {}).length, kids: M.azRows(D, { tier: "kids" }).length, places: pl.length, markers: pl.filter((r) => GD.atlas.centroid(r.a3)).length }; })()`);
  out.expected = exp;

  // Atlas: open, A-Z, category tree, by place markers, by year zoom, This week, tier switch, tabs.
  await q(`document.getElementById("btnAtlas").click()`);
  out.az = await q(`({ open: !document.getElementById("atlasView").hidden, rows: document.querySelectorAll("#atBrowse .at-row").length, letters: document.querySelectorAll(".at-jump button").length })`);
  if (!out.az.open || out.az.rows !== exp.az) throw new Error("A-Z: " + JSON.stringify(out.az));
  await q(`document.querySelector('[data-at-view="cats"]').click()`);
  out.cats = await q(`({ cats: document.querySelectorAll(".at-cat").length, greyed: document.querySelectorAll(".at-cat.not-installed").length })`);
  if (out.cats.cats !== 12 || out.cats.greyed !== 8) throw new Error("categories: " + JSON.stringify(out.cats));
  await q(`document.querySelector('[data-at-view="place"]').click()`);
  out.place = await q(`({ places: document.querySelectorAll(".at-place").length, markers: document.querySelectorAll(".atlas-count").length })`);
  if (out.place.places !== exp.places || out.place.markers !== exp.markers || exp.places < 20) throw new Error("by place: " + JSON.stringify(out.place));
  await q(`document.querySelector('[data-at-view="year"]').click()`);
  await q(`document.querySelector('[data-at-zoom="months"]').click()`);
  out.months = await q(`document.querySelectorAll("[data-at-bucket]").length`);
  if (out.months !== 12) throw new Error("months: " + out.months);
  await q(`document.getElementById("atThisWeek").click()`);
  out.week = await q(`(document.getElementById("atBrowse").innerText || "").match(/ISO week \\d+/)?.[0] || ""`);
  if (!/ISO week/.test(out.week)) throw new Error("this week: " + out.week);
  await q(`(() => { const s = document.getElementById("atTier"); s.value = "kids"; s.dispatchEvent(new Event("change")); document.querySelector('[data-at-view="az"]').click(); })()`);
  out.kids = await q(`document.querySelectorAll("#atBrowse .at-row").length`);
  if (out.kids !== exp.kids) throw new Error("kids tier rows: " + out.kids);
  await q(`(() => { const s = document.getElementById("atTier"); s.value = "all"; s.dispatchEvent(new Event("change")); GD.atlas.select("bag-solar-kit"); })()`);
  const tabs = {};
  for (const tab of ["object", "parts", "chemistry", "sources"]) {
    await q(`document.querySelector('[data-at-tab="${tab}"]').click()`);
    tabs[tab] = await q(`(document.querySelector(".at-tabbody").innerText || "").slice(0, 2000)`);
  }
  if (!/Carry-on day kit|S · /.test(tabs.object) || !/\[UNKNOWN\]/.test(tabs.parts) || !/LFP/.test(tabs.chemistry) || !/Official sources/.test(tabs.sources) || !/Community lane is off/.test(tabs.sources)) throw new Error("tabs: " + JSON.stringify(Object.keys(tabs).map((k) => [k, tabs[k].slice(0, 120)])));
  out.official = /FAA PackSafe/.test(tabs.sources);

  // 3D: lazy-load vendored three.js (or a labelled stub when WebGL is missing).
  await q(`document.querySelector('[data-at-mode="3d"]').click()`);
  await until(() => q(`(() => { const el = document.getElementById("at3d"); return el && (el.getAttribute("data-3d") || (el.classList.contains("stub") ? "stub" : "")); })()`), 20000, "3d view");
  out.three = await q(`({ state: document.getElementById("at3d").getAttribute("data-3d"), canvas: !!document.querySelector("#at3d canvas"), note: document.getElementById("at3dNote").textContent, THREE: typeof THREE !== "undefined" && THREE.REVISION })`);
  await q(`document.querySelector('[data-at-mode="globe"]').click()`);

  // A bell in the Atlas: Object tab facts, timeline and alloy link; Chemistry shows bell bronze; the 3D tab loads the bell model.
  await q(`(() => { GD.atlas.st.tab = "object"; GD.atlas.select("big-ben-great-bell"); })()`);
  const bt = {};
  for (const tab of ["object", "chemistry", "sources"]) {
    await q(`document.querySelector('[data-at-tab="${tab}"]').click()`);
    bt[tab] = await q(`(document.querySelector(".at-tabbody").innerText || "").slice(0, 4000)`);
  }
  if (!/Bell facts/.test(bt.object) || !/1858/.test(bt.object) || !/Bell bronze/i.test(bt.object) || !/copper/i.test(bt.chemistry) || !/UK Parliament/.test(bt.sources)) throw new Error("bell tabs: " + JSON.stringify(Object.keys(bt).map((k) => [k, bt[k].slice(0, 200)])));
  await q(`document.querySelector('[data-at-tab="object"]').click()`);
  await q(`document.querySelector('[data-at-mode="3d"]').click()`);
  await until(() => q(`(() => { const el = document.getElementById("at3d"); return el && el.getAttribute("data-model") === "bell" && (el.getAttribute("data-3d") || (el.classList.contains("stub") ? "stub" : "")); })()`), 20000, "bell 3d view");
  out.bell3d = await q(`({ state: document.getElementById("at3d").getAttribute("data-3d"), model: document.getElementById("at3d").getAttribute("data-model"), canvas: !!document.querySelector("#at3d canvas"), note: document.getElementById("at3dNote").textContent })`);
  if (out.bell3d.model !== "bell" || (out.bell3d.state === "ok" && !out.bell3d.canvas)) throw new Error("bell 3d: " + JSON.stringify(out.bell3d));
  await q(`document.querySelector('[data-at-mode="globe"]').click()`);
  await q(`document.getElementById("atClose").click()`);

  // Bells layer drill-down: zoom to Philadelphia, single pins appear; a pin click opens that bell in the Atlas.
  await q(`(() => { GD.globe.st.map.jumpTo({ center: [-75.15, 39.949], zoom: 12 }); GD.bellsLayer.sync(); })()`);
  out.bellPins = await q(`({ liberty: !!document.querySelector('.bl-pin[data-bell="liberty-bell"]'), approx: document.querySelectorAll(".bl-pin.bl-approx").length, clusters: document.querySelectorAll(".bl-cluster").length })`);
  if (!out.bellPins.liberty) throw new Error("bell pins at zoom 12: " + JSON.stringify(out.bellPins));
  await q(`document.querySelector('.bl-pin[data-bell="liberty-bell"]').click()`);
  out.bellDrill = await q(`({ open: !document.getElementById("atlasView").hidden, selected: GD.atlas.st.selected, text: (document.querySelector(".at-tabbody").innerText || "").slice(0, 600) })`);
  if (!out.bellDrill.open || out.bellDrill.selected !== "liberty-bell" || !/Whitechapel|1752/.test(out.bellDrill.text)) throw new Error("bell drill: " + JSON.stringify(out.bellDrill));
  await q(`document.getElementById("atClose").click()`);
  // Region filter: Asia only, then back to all.
  out.bellFilter = await q(`(() => { GD.bellsLayer.setFilter({ region: "Asia" }); GD.globe.st.map.jumpTo({ center: [120, 30], zoom: 10 }); GD.bellsLayer.sync(); const n = GD.bellsLayer.st.markers.length; GD.bellsLayer.setFilter({ region: "all" }); return n; })()`);

  // Desks: switch to Permits and Codes, check labels, then back to News.
  await q(`(() => { const s = document.getElementById("deskSelect"); s.value = "permits-codes"; s.dispatchEvent(new Event("change")); })()`);
  out.desk = await q(`({ shown: !document.getElementById("workDesk").hidden, cardsHidden: getComputedStyle(document.getElementById("ndCards")).display === "none", exp: (document.getElementById("workDesk").innerText.match(/Experimental \\(not an official source\\)/g) || []).length, unknown: /Official source \\[UNKNOWN\\]/.test(document.getElementById("workDesk").innerText), links: [...document.querySelectorAll("#workDesk a")].map((a) => a.href) })`);
  if (!out.desk.shown || !out.desk.cardsHidden || out.desk.exp !== 4 || !out.desk.unknown || out.desk.links.some((h) => !/^https:\/\/(github\.com\/AdventureNLearn\/|learninglab\.grok\.me\/)/.test(h))) throw new Error("desk: " + JSON.stringify(out.desk));
  await q(`(() => { const s = document.getElementById("deskSelect"); s.value = "news"; s.dispatchEvent(new Event("change")); })()`);
  out.back = await q(`({ cards: document.querySelectorAll(".nd-card").length, visible: getComputedStyle(document.getElementById("ndCards")).display !== "none" })`);
  if (out.back.cards !== 50 || !out.back.visible) throw new Error("news desk after switch: " + JSON.stringify(out.back));

  // Layers: Your layer and Community sections; Community off by default, then on shows the lane in Atlas.
  await q(`GD.layersPanel.open()`);
  out.layers = await q(`({ mine: !!document.getElementById("lpPersonal"), comm: !!document.getElementById("lpCommunity"), commOn: document.getElementById("lpCommunity").checked, bells: !!document.getElementById("lpBells") && document.getElementById("lpBells").checked, eras: document.querySelectorAll("#lpBellsEra option").length, regions: document.querySelectorAll("#lpBellsRegion option").length })`);
  if (!out.layers.mine || !out.layers.comm || out.layers.commOn || !out.layers.bells || out.layers.eras !== 8 || out.layers.regions !== 7) throw new Error("layers: " + JSON.stringify(out.layers));
  await q(`document.getElementById("lpCommunity").click()`);
  await q(`GD.layersPanel.close(); GD.atlas.open(); document.querySelector('[data-at-view="cats"]').click()`);
  out.lane = await q(`document.querySelectorAll(".at-community").length`);
  if (out.lane !== 12) throw new Error("community lane per category: " + out.lane);
  await q(`GD.userLayers.setCommunity(false); GD.atlas.close()`);
  // Personal layer round trip in the page (local storage only).
  out.personal = await q(`(() => { GD.personal.addPin({ title: "Smoke pin", lat: 10, lng: 20 }); const n = document.querySelectorAll(".ul-pin.ul-mine").length; const txt = GD.personal.exportText(GD.personal.load()); GD.personal.clearAll(); const r = GD.personal.importText(GD.personal.load(), txt); GD.personal.clearAll(); return { markers: n, ok: r.ok, pins: r.layer.pins.length }; })()`);
  if (out.personal.markers !== 1 || !out.personal.ok || out.personal.pins !== 1) throw new Error("personal: " + JSON.stringify(out.personal));

  const fatal = errors.filter((e) => !/deprecated with r150\+/.test(e));
  console.log(JSON.stringify({ smoke: "atlas", errors: fatal.length, warnings: warnings.length, out }, null, 2));
  if (fatal.length) { console.error("ERRORS:\n" + fatal.join("\n")); failed = true; }
  if (warnings.length) { console.error("WARNINGS:\n" + warnings.join("\n")); failed = true; }
  if (!failed) console.log("smoke-atlas: 0 warnings, 0 errors, atlas + desks + layers + bells ok; 3D " + out.three.state + ", bell 3D " + out.bell3d.state);
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
