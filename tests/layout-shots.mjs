#!/usr/bin/env node
// Headless screenshots of each layout template at three window sizes.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Never default to the sibling shots folder — a plain run must not overwrite it.
// Set SHOT_DIR to an explicit directory, or omit it to write into a fresh temp dir.
const outDir = process.env.SHOT_DIR
  ? path.resolve(process.env.SHOT_DIR)
  : fs.mkdtempSync(path.join(os.tmpdir(), "gd-layout-shots-out-"));
const PORT = Number(process.env.SMOKE_PORT || 8261);
const DBG = Number(process.env.SMOKE_DBG || 9451);
const TEMPLATES = ["edit", "present", "research", "compact"];
const SIZES = [[1024, 768], [1280, 800], [1920, 1080]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chromeBin = process.env.CHROME || "google-chrome";
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gd-layout-shots-"));
const profile = path.join(tmpRoot, "profile");
const dataDir = process.env.GLOBEDESK_DATA || path.join(tmpRoot, "data");
fs.mkdirSync(profile, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const server = spawn(process.env.PYTHON || "python3", ["-B", "tools/serve.py", String(PORT)], {
  cwd: root,
  stdio: "ignore",
  env: { ...process.env, GLOBEDESK_NO_BROWSER: "1", GLOBEDESK_OFFLINE: "1", GLOBEDESK_DATA: dataDir, PYTHONDONTWRITEBYTECODE: "1" },
});
const chrome = spawn(chromeBin, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  `--remote-debugging-port=${DBG}`, "--window-size=1920,1080",
  `--user-data-dir=${profile}`,
  "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1",
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
const collisions = [];
try {
  await until(async () => (await fetch(`http://127.0.0.1:${DBG}/json/version`)).ok, 20000, "chrome");
  await until(async () => (await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok, 20000, "server");
  const list = await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json();
  const page = list.find((p) => p.type === "page") || list[0];
  c = new Cdp(page.webSocketDebuggerUrl); await c.ready;
  await c.send("Runtime.enable");
  await c.send("Page.enable");
  const ev = async (expr) => {
    const r = await c.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text || "eval failed");
    return r.result.value;
  };

  await c.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await c.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/?import=/episodes/washington-dc-demo.globedesk.json` });
  await until(() => ev("!!(window.__globedesk && window.__globedesk.ready && GD && GD.layout && GD.ui && GD.state && GD.state.episode && GD.state.episode.id === 'ep-washington-dc-demo' && GD.globe && GD.globe.st && GD.globe.st.status === 'ready')"), 30000, "dc sample ready");
  await ev("(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('on'); return true; })()");

  const inspect = `(() => {
    const hit = (a, b) => !!(a && b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom));
    const topbar = document.querySelector(".topbar");
    const desk = document.getElementById("desk");
    const insp = document.getElementById("inspectorPanel");
    const tools = document.getElementById("toolsEssential");
    const stage = document.getElementById("stage");
    const tb = topbar && topbar.getBoundingClientRect();
    const db = desk && desk.getBoundingClientRect();
    const ib = insp && !insp.hidden && insp.getBoundingClientRect();
    const ob = tools && tools.getBoundingClientRect();
    const sr = stage && stage.getBoundingClientRect();
    const issues = [];
    if (tb && db && tb.bottom > db.top + 2) issues.push("topbar overflows into desk by " + Math.round(tb.bottom - db.top));
    if (tb && ib && hit(tb, ib)) issues.push("inspector overlaps topbar");
    if (ob && ib && hit(ob, ib)) issues.push("inspector overlaps essential toolbar");
    if (tools) {
      const br = tools.getBoundingClientRect();
      if (br.right > (window.innerWidth + 1) || br.bottom > (tb ? tb.bottom + 2 : 54)) issues.push("essential tools overflow the topbar");
    }
    const nav = document.querySelector(".stage .maplibregl-ctrl-top-right, .maplibregl-ctrl-top-right");
    if (nav && ib && insp && !insp.hidden && insp.classList.contains("is-floating") === false) {
      const nb = nav.getBoundingClientRect();
      if (hit(nb, ib)) issues.push("inspector overlaps map controls");
    }
    if (nav && sr) {
      const L = (window.GD && GD.state && GD.state.episode && GD.state.episode.look) || {};
      const headerPct = L.header ? (Number(L.headerHeightPct) || 15) : 0;
      const headerBottom = sr.top + sr.height * (headerPct / 100);
      const nb = nav.getBoundingClientRect();
      const plus = document.querySelector("#stage .maplibregl-ctrl-zoom-in, .stage .maplibregl-ctrl-zoom-in");
      const pb = plus && plus.getBoundingClientRect();
      if (nb.top + 1 < headerBottom) issues.push("map controls clipped under stage title band");
      if (pb && pb.width && pb.top + 1 < headerBottom) issues.push("zoom + button clipped under stage title band");
    }
    const menu = document.getElementById("btnMenu");
    const brand = document.querySelector(".brand-name");
    const visibleButtons = (root) => [...(root ? root.querySelectorAll("button") : [])].filter((b) => b.offsetWidth && b.offsetHeight);
    const hasFace = (b) => {
      const icon = b.querySelector(".maplibregl-ctrl-icon");
      const bg = icon ? (getComputedStyle(icon).backgroundImage || "") : "";
      const text = (b.textContent || "").trim();
      return text.length > 0 || (bg && bg !== "none");
    };
    document.querySelectorAll("#stage .maplibregl-ctrl-group, #stage .gd-pan-ctrl").forEach((g) => {
      const r = g.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const empty = visibleButtons(g).filter((b) => !hasFace(b));
      if (empty.length) issues.push("empty map control buttons: " + empty.length);
    });
    const pan = document.querySelector("#stage .gd-pan-ctrl");
    if (pan && sr) {
      const pr = pan.getBoundingClientRect();
      if (pr.height > sr.height * 0.4) issues.push("pan control too tall vs the globe");
      const faceless = visibleButtons(pan).filter((b) => !hasFace(b));
      if (faceless.length) issues.push("pan control has buttons without icons");
    }
    const attrib = document.querySelector("#stage .maplibregl-ctrl-attrib");
    if (attrib && sr && attrib.offsetWidth) {
      const ar = attrib.getBoundingClientRect();
      if (ar.left < sr.left - 2 || ar.right > sr.right + 2 || ar.top < sr.top - 2 || ar.bottom > sr.bottom + 2) issues.push("attribution escapes the stage");
      const acx = (ar.left + ar.right) / 2, acy = (ar.top + ar.bottom) / 2;
      if (acx < sr.left + sr.width * 0.5) issues.push("attribution not on the right of the stage");
      if (acy < sr.top + sr.height * 0.5) issues.push("attribution not at the bottom of the stage");
      const cx = sr.left + sr.width / 2, cy = sr.top + sr.height / 2;
      if (ar.left <= cx && ar.right >= cx && ar.top <= cy && ar.bottom >= cy) issues.push("attribution covers the globe center");
      if (!attrib.classList.contains("maplibregl-compact")) issues.push("attribution is not compact");
      if (ar.width > 36 || ar.height > 36) issues.push("attribution is too large to be compact");
    }
    const canvas = document.querySelector("#stage .maplibregl-canvas, #stage canvas.maplibregl-canvas, #stage canvas");
    if (canvas && sr) {
      const cr = canvas.getBoundingClientRect();
      if (Math.abs(cr.width - sr.width) > 4 || Math.abs(cr.height - sr.height) > 4) issues.push("map canvas does not fill the stage");
      if (Math.abs(cr.left - sr.left) > 4 || Math.abs(cr.top - sr.top) > 4) issues.push("map canvas is not aligned to the stage");
      const expected = (stage.dataset.aspect === "9:16") ? (9 / 16) : (16 / 9);
      if (Math.abs((sr.width / sr.height) - expected) > 0.08) issues.push("stage aspect is not the chosen frame");
    }
    const boxes = [];
    const addBox = (name, el) => {
      if (!el || el.hidden || el.classList.contains("is-hidden-panel")) return;
      const cs = getComputedStyle(el);
      if (!cs || cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      boxes.push({ name, left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    };
    addBox("topbar", topbar);
    addBox("rundown", document.getElementById("rundownPanel"));
    addBox("bin", document.getElementById("binPanel"));
    addBox("inspector", insp);
    addBox("readable", document.getElementById("readablePanel"));
    addBox("transport", document.getElementById("transportBar"));
    addBox("newsdesk", document.getElementById("newsdesk"));
    const toastEl = document.getElementById("toast");
    if (toastEl && toastEl.classList.contains("on")) addBox("toast", toastEl);
    document.querySelectorAll(".gd-panel-scale-pop").forEach((pop, i) => { if (!pop.hidden) addBox("scale-pop-" + i, pop); });
    document.querySelectorAll(".suggest").forEach((ul, i) => { if (ul.offsetWidth && ul.offsetHeight && ul.children.length) addBox("suggest-" + i, ul); });
    const appMenu = document.getElementById("appMenu");
    if (appMenu && (appMenu.open || appMenu.hasAttribute("open"))) addBox("app-menu", appMenu);
    const boxHit = (a, b) => !(a.right <= b.left + 1 || a.left >= b.right - 1 || a.bottom <= b.top + 1 || a.top >= b.bottom - 1);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (boxHit(boxes[i], boxes[j])) issues.push(boxes[i].name + " overlaps " + boxes[j].name);
      }
    }
    boxes.forEach((b) => {
      if (b.left < -2 || b.top < -2 || b.right > window.innerWidth + 2 || b.bottom > window.innerHeight + 2) {
        issues.push(b.name + " is clipped by the viewport");
      }
    });
    const transport = document.getElementById("transportBar");
    const stageCol = document.getElementById("stageCol");
    if (transport && stageCol && !transport.hidden && !transport.classList.contains("is-hidden-panel") && !transport.classList.contains("is-floating")) {
      const tr = transport.getBoundingClientRect();
      const cr = stageCol.getBoundingClientRect();
      if (tr.right > cr.right + 2 || tr.left < cr.left - 2) issues.push("transport escapes the stage column");
    }
    if (transport && !transport.hidden && !transport.classList.contains("is-hidden-panel")) {
      const title = transport.querySelector(".gd-panel-title");
      const text = title && (title.textContent || "").trim();
      if (!title || !title.offsetWidth || !title.offsetHeight || !text) issues.push("transport is missing a visible Playback label");
      else if (!/playback/i.test(text)) issues.push("transport label is not Playback");
    }

    return {
      issues,
      template: (GD.layout && GD.layout.state && GD.layout.state().template) || "",
      episode: (GD.state && GD.state.episode && (GD.state.episode.title || GD.state.episode.id)) || "",
      menuLeftOfBrand: !!(menu && brand && menu.getBoundingClientRect().left <= brand.getBoundingClientRect().left),
      topbar: tb && { top: tb.top, bottom: tb.bottom, height: tb.height, right: tb.right },
      inspector: ib && { top: ib.top, left: ib.left, height: ib.height, hidden: !!insp.hidden },
      tools: ob && { top: ob.top, bottom: ob.bottom, right: ob.right }
    };
  })()`;

  for (const [w, h] of SIZES) {
    await c.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await ev("window.dispatchEvent(new Event('resize')); true");
    await sleep(250);
    for (const name of TEMPLATES) {
      await ev(`(() => { GD.layout.applyTemplate(${JSON.stringify(name)}); const av = (GD.newsdesk && GD.newsdesk.applyView); if (av) { try { av("workspace"); } catch (e) {} } document.body.classList.add("view-workspace"); document.body.classList.remove("view-newsdesk"); const cam = document.getElementById("tab-camera"); if (cam) cam.click(); const toast = document.getElementById("toast"); if (toast) toast.classList.remove("on"); if (GD.layout.apply) GD.layout.apply(); if (GD.layout.resizeStage) GD.layout.resizeStage(); return true; })()`);
      await until(() => ev(`(() => { const s = document.getElementById("stage"); const c = document.querySelector("#stage .maplibregl-canvas"); if (!s || !c) return false; const sr = s.getBoundingClientRect(), cr = c.getBoundingClientRect(); return Math.abs(sr.width - cr.width) < 4 && Math.abs(sr.height - cr.height) < 4 && sr.width > 40 && sr.height > 40; })()`), 6000, "map canvas fills stage for " + name + " " + w + "x" + h);
      await sleep(300);
      const info = await ev(inspect);
      const file = `${name}-${w}x${h}.png`;
      const shot = await c.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      fs.writeFileSync(path.join(outDir, file), Buffer.from(shot.data, "base64"));
      const bad = (info && info.issues) || [];
      console.log((bad.length ? "COLLISION" : "ok") + " - " + file + (bad.length ? " " + bad.join("; ") : ""));
      if (bad.length) { collisions.push(file + ": " + bad.join("; ")); failed = true; }
      if (info && info.menuLeftOfBrand === false) { collisions.push(file + ": menu not left of brand"); failed = true; }
    }
  }

  if (process.env.EXTRA_SHOTS) {
    await c.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await ev("window.dispatchEvent(new Event('resize')); true");
    await ev(`(() => { GD.layout.applyTemplate("edit"); document.body.classList.add("view-workspace"); document.body.classList.remove("view-newsdesk"); const cam = document.getElementById("tab-camera"); if (cam) cam.click(); const toast = document.getElementById("toast"); if (toast) toast.classList.remove("on"); if (GD.layout.apply) GD.layout.apply(); if (GD.layout.resizeStage) GD.layout.resizeStage(); return true; })()`);
    await sleep(400);
    const extraShot = async (file) => {
      const shot = await c.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      fs.writeFileSync(path.join(outDir, file), Buffer.from(shot.data, "base64"));
      console.log("ok - " + file);
    };
    await extraShot("edit-1280x800-data-year-slider.png");
    await ev(`(() => { const b = document.getElementById("tab-layers") || document.querySelector('[data-tab="layers"]'); if (b) b.click(); return true; })()`);
    await sleep(300);
    await extraShot("edit-1280x800-layers-tab.png");
    await ev(`(() => { const cam = document.getElementById("tab-camera"); if (cam) cam.click(); const yr = document.getElementById("dataYear"); if (yr) { yr.value = "1995"; yr.dispatchEvent(new Event("input", { bubbles: true })); yr.dispatchEvent(new Event("change", { bubbles: true })); } return true; })()`);
    await sleep(500);
    await extraShot("edit-1280x800-projected-1995.png");
  }
} catch (e) {
  failed = true;
  console.error(e && e.stack || e);
} finally {
  try { if (c && c.ws) c.ws.close(); } catch {}
  try { chrome.kill("SIGKILL"); } catch {}
  try { server.kill("SIGKILL"); } catch {}
  // Leave the temp profile and default output dir in place; do not rm.
}
if (collisions.length) {
  console.error("\nCollisions:\n" + collisions.map((s) => " - " + s).join("\n"));
}
if (failed) process.exit(1);
console.log("\nWrote screenshots under " + outDir);
