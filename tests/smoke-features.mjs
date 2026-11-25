#!/usr/bin/env node
// Feature check: runs each GlobeDesk feature once in headless Chrome and records what it did. The
// tutorial's Live / Coming soon labels (js/tutorial-features.js) come from this run plus the named smokes;
// a feature is Live only when its check here (or its smoke) passes, and Coming soon when the app itself
// says it is not wired yet. The run fails if a label disagrees with the result, or on any console error.
// Offline checks block every off-box host; the online pass (FEATURES_ONLINE=1, default on) uses the live
// network for dated imagery and official GIS. Writes FEATURES_OUT (JSON evidence).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.SMOKE_PORT || 8271);
const OUT = process.env.FEATURES_OUT || path.join(os.tmpdir(), "gd-features.json");
const ONLINE = process.env.FEATURES_ONLINE !== "0";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms, label) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); } throw new Error("timeout: " + label); }
class Cdp {
  constructor(u) { this.ws = new WebSocket(u); this.id = 0; this.p = new Map(); this.h = {}; this.ready = new Promise((r, j) => { this.ws.onopen = r; this.ws.onerror = j; });
    this.ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.method && this.h[m.method]) this.h[m.method](m.params); if (m.id && this.p.has(m.id)) { const { r, j } = this.p.get(m.id); this.p.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } }; }
  on(m, f) { this.h[m] = f; }
  send(method, params = {}) { const id = ++this.id; return new Promise((r, j) => { this.p.set(id, { r, j }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}

// Labels shipped in the tutorial.
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, "js/tutorial-features.js"), "utf8"), ctx);
const FEATURES = ctx.window.GD.tutorialFeatures;

async function browser(online, dbg) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gd-feat-"));
  const dl = fs.mkdtempSync(path.join(os.tmpdir(), "gd-feat-dl-"));
  const args = ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-extensions", `--remote-debugging-port=${dbg}`, "--window-size=1440,900",
    `--user-data-dir=${profile}`, "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required", "about:blank"];
  if (!online) args.splice(5, 0, "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1");
  const chrome = spawn(process.env.CHROME || "google-chrome", args, { stdio: "ignore" });
  await until(async () => (await fetch(`http://127.0.0.1:${dbg}/json/version`)).ok, 20000, "chrome");
  const list = await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json();
  const c = new Cdp((list.find((p) => p.type === "page") || list[0]).webSocketDebuggerUrl); await c.ready;
  await c.send("Runtime.enable"); await c.send("Page.enable"); await c.send("DOM.enable");
  await c.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dl }).catch(() => c.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: dl }));
  const errors = [];
  c.on("Runtime.consoleAPICalled", (p) => { if (p.type === "error") errors.push((p.args || []).map((a) => a.value ?? a.description).join(" ").slice(0, 300)); });
  c.on("Runtime.exceptionThrown", (p) => errors.push(String((p.exceptionDetails.exception || {}).description || p.exceptionDetails.text).slice(0, 300)));
  const ev = async (expr) => { const r = await c.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text); return r.result.value; };
  const load = async (q) => { await c.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/${q || ""}` }); await until(() => ev("!!(window.__globedesk && window.__globedesk.ready && GD.globe.st.status === 'ready')"), 45000, "ready"); await sleep(800); };
  const files = () => fs.readdirSync(dl).filter((f) => !f.endsWith(".crdownload"));
  return { c, ev, load, errors, dl, files, close: () => { try { c.ws.close(); } catch {} chrome.kill("SIGKILL"); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} } };
}

// Each check returns { ok, detail }. ok=false with notWired=true means the app itself says "not wired".
const OFFLINE_CHECKS = {
  globe: async (b) => { await until(() => b.ev("GD.globe.st.map.isStyleLoaded()"), 20000, "style"); const d = await b.ev(`({ projection: GD.globe.st.map.getProjection().type, styleLoaded: GD.globe.st.map.isStyleLoaded(), canvas: GD.globe.st.map.getCanvas().width })`); return { ok: d.projection === "globe" && d.styleLoaded && d.canvas > 0, detail: d }; },
  home: async (b) => { const d = await b.ev(`(() => { const m = GD.globe.st.map; m.jumpTo({ center: [120, -40], zoom: 5 }); document.getElementById("btnReset").click(); return new Promise((r) => setTimeout(() => { const c = m.getCenter(); r({ lng: c.lng, lat: c.lat, zoom: m.getZoom(), home: GD.globe.HOME_VIEW }); }, 3000)); })()`); return { ok: Math.abs(d.lng - d.home.center[0]) < 5 && Math.abs(d.lat - d.home.center[1]) < 5, detail: d }; },
  layers: async (b) => { const d = await b.ev(`(() => { GD.layersPanel.open(); const rows = document.querySelectorAll("#layersPanelBody input[type=checkbox], #layersPanelBody input[type=radio]").length; const open = document.getElementById("layersPanel").open; GD.layersPanel.close(); return { open, rows }; })()`); return { ok: d.open && d.rows >= 8, detail: d }; },
  atlas: async (b) => { const d = await b.ev(`(() => { document.getElementById("btnAtlas").click(); const v = document.getElementById("atlasView"); const r = { visible: !!v && !v.hidden, entries: GD.atlasData.entries.length, text: (v.innerText || "").length }; document.getElementById("btnAtlas").click(); return r; })()`); return { ok: d.visible && d.entries >= 100 && d.text > 200, detail: d }; },
  newsdesk: async (b) => { await until(() => b.ev("GD.newsdesk.state.loaded === true"), 15000, "feed"); const d = await b.ev(`(() => { const cards = document.querySelectorAll(".nd-card"); const m = GD.globe.st.map; const before = m.getCenter(); cards[3].click(); return new Promise((r) => setTimeout(() => { const a = m.getCenter(); r({ topics: GD.newsdesk.state.feed.topics.length, cards: cards.length, moved: Math.abs(a.lng - before.lng) + Math.abs(a.lat - before.lat) }); }, 3500)); })()`); return { ok: d.topics === 50 && d.cards > 0 && d.moved > 0.5, detail: d }; },
  desks: async (b) => { const d = await b.ev(`(() => { const s = document.getElementById("deskSelect"); const n = s.options.length; s.value = s.options[2].value; s.dispatchEvent(new Event("change")); const wd = document.getElementById("workDesk"); const r = { options: n, picked: s.value, workDeskShown: !wd.hidden, text: (wd.innerText || "").slice(0, 80) }; s.value = s.options[0].value; s.dispatchEvent(new Event("change")); return r; })()`); return { ok: d.options >= 2 && d.workDeskShown && d.text.length > 10, detail: d }; },
  sample: async (b) => { await b.ev(`document.getElementById("btnDemo").click()`); await sleep(1500); const d = await b.ev(`({ show: GD.state.episode.show, title: GD.state.episode.title, stories: GD.state.episode.stories.length })`); return { ok: d.stories >= 2 && /washington|dc/i.test(d.title + " " + d.show), detail: d }; },
  workspace: async (b) => { const d = await b.ev(`(() => { document.getElementById("btnViewToggle").click(); const r = { cls: document.body.className, rundownVisible: document.getElementById("rundownPanel").getBoundingClientRect().width > 0 }; return r; })()`); return { ok: /view-workspace/.test(d.cls) && d.rundownVisible, detail: d }; },
  stories: async (b) => { const d = await b.ev(`(() => { const n = GD.state.episode.stories.length; document.getElementById("addStory").click(); return { before: n, after: GD.state.episode.stories.length }; })()`); return { ok: d.after === d.before + 1, detail: d }; },
  pins: async (b) => { const r = await b.ev(`(() => { const rc = document.getElementById("map").getBoundingClientRect(); return { x: rc.x + rc.width / 2, y: rc.y + rc.height / 2 }; })()`); const before = await b.ev(`JSON.stringify(GD.state.episode.stories[GD.state.storyIdx].location || {})`);
    await b.c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x, y: r.y }); await b.c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: r.x, y: r.y, button: "right", clickCount: 1 }); await b.c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: r.x, y: r.y, button: "right", clickCount: 1 }); await sleep(800);
    const after = await b.ev(`JSON.stringify(GD.state.episode.stories[GD.state.storyIdx].location || {})`); return { ok: after !== before && /"lat":-?\d/.test(after), detail: { before: before.slice(0, 120), after: after.slice(0, 160) } }; },
  gazetteer: async (b) => { const d = await b.ev(`GD.globe.searchPlaces("Paris", 3)`); return { ok: Array.isArray(d) && d.length > 0 && /Paris/.test(d[0].name), detail: d.slice(0, 2) }; },
  media: async (b) => { const d = await b.ev(`(async () => { const c = document.createElement("canvas"); c.width = 8; c.height = 8; const blob = await new Promise((r) => c.toBlob(r, "image/png")); const f = new File([blob], "dot.png", { type: "image/png" }); const n = document.querySelectorAll("#bin li").length; await GD.ui.addFiles([f]); await new Promise((r) => setTimeout(r, 500)); return { before: n, after: document.querySelectorAll("#bin li").length }; })()`); return { ok: d.after > d.before, detail: d }; },
  place: async (b) => { const d = await b.ev(`(() => { document.getElementById("tab-place").click(); const t = document.getElementById("inspector").innerText; return { len: t.length, card: /card/i.test(t), overlay: /overlay/i.test(t), embed: /embed|YouTube/i.test(t) }; })()`); return { ok: d.card && d.overlay, detail: d }; },
  playback: async (b) => { const d = await b.ev(`(() => { GD.playback.seek(0); document.getElementById("btnPlay").click(); return new Promise((r) => setTimeout(() => { const t = GD.state.t; GD.playback.pause(); r({ t, playing: true }); }, 2000)); })()`); return { ok: d.t > 0.5, detail: d }; },
  dataYear: async (b) => { const d = await b.ev(`(() => { const el = document.getElementById("dataYear"); el.value = "2018"; el.dispatchEvent(new Event("input")); const y = GD.yearClock.getYear(); el.value = el.max; el.dispatchEvent(new Event("input")); return { set: 2018, got: y, label: document.getElementById("dataYearVal").textContent }; })()`); return { ok: d.got === 2018, detail: d }; },
  assist: async (b) => { const d = await b.ev(`(() => { document.getElementById("tab-assist").click(); const paste = document.getElementById("asPaste"); paste.value = "{not json"; document.getElementById("asCheck").click(); const bad = document.getElementById("asErr").textContent; paste.value = JSON.stringify(GD.model.sampleEpisode()); document.getElementById("asCheck").click(); return { bad, good: document.getElementById("asErr").textContent, prompt: document.getElementById("asPrompt").value.length }; })()`); return { ok: d.good === "Valid episode." && d.bad && d.bad !== "Valid episode." && d.prompt > 100, detail: d }; },
  saveJson: async (b) => { const n = b.files().length; await b.ev(`document.getElementById("btnSave").click()`); await until(() => b.files().length > n, 8000, "download").catch(() => {}); const f = b.files().find((x) => x.endsWith(".globedesk.json")); return { ok: !!f && fs.statSync(path.join(b.dl, f)).size > 200, detail: { file: f, bytes: f && fs.statSync(path.join(b.dl, f)).size } }; },
  open: async (b) => { const f = b.files().find((x) => x.endsWith(".globedesk.json")); if (!f) return { ok: false, detail: "no saved file to open" };
    await b.ev(`GD.ui.loadEpisode(GD.model.blankEpisode(), "blank")`); const doc = await b.c.send("DOM.getDocument", { depth: -1 }); const q = await b.c.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#fileOpen" });
    await b.c.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [path.join(b.dl, f)] }); await sleep(1500); const d = await b.ev(`({ stories: GD.state.episode.stories.length, title: GD.state.episode.title })`); return { ok: d.stories >= 2, detail: d }; },
  saveProject: async (b) => { const n = b.files().length; await b.ev(`document.getElementById("btnSaveProject").click()`); await until(() => b.files().some((x) => /\.globedesk$/.test(x)), 10000, "project").catch(() => {}); const f = b.files().find((x) => /\.globedesk$/.test(x)); return { ok: !!f, detail: { file: f, bytes: f && fs.statSync(path.join(b.dl, f)).size } }; },
  captions: async (b) => { await b.ev(`document.getElementById("btnVtt").click()`); await sleep(800); await b.ev(`document.getElementById("btnSrt").click()`); await until(() => b.files().some((x) => x.endsWith(".srt")) && b.files().some((x) => x.endsWith(".vtt")), 8000, "captions").catch(() => {});
    const vtt = b.files().find((x) => x.endsWith(".vtt")), srt = b.files().find((x) => x.endsWith(".srt")); const head = vtt ? fs.readFileSync(path.join(b.dl, vtt), "utf8").slice(0, 6) : ""; return { ok: !!vtt && !!srt && head === "WEBVTT", detail: { vtt, srt, head } }; },
  archive: async (b) => { await b.ev(`document.getElementById("btnArchive").click()`); await sleep(1200); const d = await b.ev(`(() => { const r = { open: document.getElementById("archive").open, cards: document.querySelectorAll("#archiveBody .arch-card").length }; document.getElementById("archive").close(); return r; })()`); return { ok: d.open && d.cards > 0, detail: d }; },
  layouts: async (b) => { const d = await b.ev(`(() => { GD.layout.applyTemplate("present"); const a = GD.layout.state().template; GD.layout.setLockAll(true); const locked = document.body.classList.contains("shell-lock-all"); GD.layout.setLockAll(false); GD.layout.applyTemplate("edit"); return { template: a, locked }; })()`); return { ok: d.template === "present" && d.locked, detail: d }; },
  menu: async (b) => { const d = await b.ev(`(() => { document.getElementById("btnMenu").click(); const open = document.getElementById("appMenu").open; const s = document.getElementById("appMenuSearch"); s.value = "sample"; s.dispatchEvent(new Event("input")); const items = Array.from(document.querySelectorAll("#appMenuBody [role=option], #appMenuBody button")).filter((x) => x.offsetParent).map((x) => x.textContent.trim()); GD.layout.closeMenu(); return { open, items: items.slice(0, 5) }; })()`); return { ok: d.open && d.items.some((x) => /Sample/.test(x)), detail: d }; },
  shortcuts: async (b) => { await b.ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur(); GD.globe.st.map.jumpTo({ center: [120, -40], zoom: 5 }); true`); await b.c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "l", code: "KeyL", text: "l" }); await b.c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "l", code: "KeyL" }); await sleep(400);
    const lOpen = await b.ev(`document.getElementById("layersPanel").open`); await b.ev(`GD.layersPanel.close(); document.activeElement && document.activeElement.blur && document.activeElement.blur()`);
    await b.c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "h", code: "KeyH", text: "h" }); await b.c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "h", code: "KeyH" }); await sleep(3000);
    const c = await b.ev(`(() => { const c = GD.globe.st.map.getCenter(); return { lng: c.lng, lat: c.lat, home: GD.globe.HOME_VIEW.center }; })()`); return { ok: lOpen && Math.abs(c.lng - c.home[0]) < 5, detail: { lOpen, c } }; },
  lite: async (b) => { const d = await b.ev(`(() => { document.getElementById("btnLiteToggle").click(); const on = document.body.classList.contains("lite"); const nd = document.getElementById("newsdesk").getBoundingClientRect().width; document.getElementById("btnLiteToggle").click(); return { on, newsdeskWidthInLite: nd, off: !document.body.classList.contains("lite") }; })()`); return { ok: d.on && d.newsdeskWidthInLite === 0 && d.off, detail: d }; },
  tutorial: async (b) => { const d = await b.ev(`(() => { document.getElementById("btnHelp").click(); const open = !document.getElementById("startGuide").hidden; const n = GD.startGuide.st.steps.length; document.getElementById("sgSkip").click(); return { open, steps: n, closed: document.getElementById("startGuide").hidden }; })()`); return { ok: d.open && d.closed && d.steps > 20, detail: d }; },
  paidOptions: async (b) => { const d = await b.ev(`(() => { document.getElementById("btnSettings").click(); const body = document.getElementById("settingsBody").innerText; const r = { open: document.getElementById("settings").open, maptiler: /MapTiler/.test(body) }; document.getElementById("settings").close(); return r; })()`); return { ok: false, unverified: true, detail: { ...d, note: "the panel opens; MapTiler imagery itself needs the user's own paid key, so it was not run" } }; },
  cloudVoice: async (b) => { const d = await b.ev(`(() => { document.getElementById("btnSettings").click(); const fs = Array.from(document.querySelectorAll("#settingsBody fieldset")).find((f) => /text-to-speech/i.test(f.innerText)); const r = { stub: !!fs && /stub/i.test(fs.innerText), notWired: !!fs && /not wired/i.test(fs.innerText) }; document.getElementById("settings").close(); return r; })()`); return { ok: false, notWired: d.stub && d.notWired, detail: d }; },
  cloudAi: async (b) => { const d = await b.ev(`(() => { document.getElementById("btnSettings").click(); const fs = Array.from(document.querySelectorAll("#settingsBody fieldset")).find((f) => /AI summarize/i.test(f.innerText)); const r = { stub: !!fs && /stub/i.test(fs.innerText), notWired: !!fs && /not wired/i.test(fs.innerText) }; document.getElementById("settings").close(); return r; })()`); return { ok: false, notWired: d.stub && d.notWired, detail: d }; },
  historicalMap: async (b) => { const d = await b.ev(`(() => { GD.layersPanel.open(); const t = document.getElementById("layersPanelBody").innerText; GD.layersPanel.close(); const line = t.split("\\n").find((l) => /OpenHistoricalMap/.test(l)) || ""; return { line, notWired: /not wired/i.test(line) }; })()`); return { ok: false, notWired: d.notWired, detail: d }; },
  browserVoice: async (b) => { const d = await b.ev(`({ api: typeof speechSynthesis !== "undefined", voices: typeof speechSynthesis !== "undefined" ? speechSynthesis.getVoices().length : 0 })`); return { ok: false, unverified: true, detail: { ...d, note: "speech output cannot be heard in headless Chrome" } }; },
  historyVideo: async (b) => { const d = await b.ev(`(() => { const i = GD.startGuide.st.steps.findIndex((s) => s.id === "history-video"); GD.startGuide.open(i); const v = document.getElementById("sgVideo"); const r = { shown: !v.hidden, text: v.innerText, media: v.querySelectorAll("video, iframe, a, source").length }; GD.startGuide.close(); return r; })()`); return { ok: false, notWired: d.shown && /placeholder/i.test(d.text) && d.media === 0, detail: d }; },
  mp4: async (b) => { const d = await b.ev(`(async () => { try { const res = await Promise.race([GD.frameExport.exportVideo({ aspect: "16:9", seconds: 2, onProgress: () => {} }), new Promise((_, j) => setTimeout(() => j(new Error("timeout 240 s")), 240000))]); return { ok: true, name: res.name, bytes: res.bytes, frames: res.frames, fps: res.fps, size: res.width + "x" + res.height, path: res.path || res.mode || null }; } catch (e) { return { ok: false, error: String(e && e.message || e) }; } })()`); return { ok: !!(d.ok && d.bytes > 1000 && d.frames > 0), detail: d }; },
};
const ONLINE_CHECKS = {
  datedImagery: async (b) => { const d = await b.ev(`(() => { const y = GD.yearClock; return { years: (y.EOX_NC_YEARS || []).slice(-3), chip: (document.getElementById("stageYearBadge") || {}).innerText || null }; })()`);
    // Opt in the way a user does: Layers → "dated imagery" switch, then the Data year slider.
    const optIn = await b.ev(`(() => { GD.layersPanel.open(); const live = document.getElementById("lpLiveImagery"); const had = !!live; if (live && !live.checked) live.click(); GD.layersPanel.close(); return { switchFound: had, live: GD.layers.isLiveImagery() }; })()`);
    await b.ev(`(() => { const el = document.getElementById("dataYear"); el.value = "2020"; el.dispatchEvent(new Event("input")); })()`); await sleep(9000);
    const e = await b.ev(`(() => { const m = GD.globe.st.map; const src = Object.keys(m.style.tileManagers || {}).filter((k) => /sat|eox/i.test(k)); const tiles = src.map((k) => ({ k, url: String((m.getSource(k) || {}).tiles || "").slice(0, 120), tiles: m.style.tileManagers[k].getRenderableIds().length })); return { year: GD.yearClock.getYear(), tiles, badge: (document.getElementById("stageYearBadge") || {}).innerText || "" }; })()`);
    return { ok: optIn.live && e.year === 2020 && e.tiles.some((t) => t.tiles > 0 && !/eox2016|s2cloudless-2016|s2cloudless_3857/.test(t.url)) && !/dated imagery off/.test(e.badge), detail: { ...d, optIn, ...e } }; },
  officialGis: async (b) => { await until(() => b.ev("GD.gis.state.loaded === true"), 15000, "gis registry").catch(() => {});
    const pick = await b.ev(`(() => { const l = GD.gis.state.layers.find((x) => /raster|tile|export|wms/i.test(JSON.stringify(x.kind || x.type || x.service || "")) ) || GD.gis.state.layers[0]; return l ? { id: l.id, label: l.label || l.title, count: GD.gis.state.layers.length } : null; })()`);
    if (!pick) return { ok: false, detail: "no GIS layers in the registry" };
    // Dated imagery may have left the clock on a past year; current official layers then stay off
    // ("not year-specific"). Reset the year, opt in live GIS the way a user does, fly to a US view, and
    // wait for the layer's own tiles to appear (the first full run sometimes took longer than 10 s).
    await b.ev(`(() => { if (document.body.classList.contains("lite")) document.getElementById("btnLiteToggle").click(); const el = document.getElementById("dataYear"); if (el) { el.value = el.max; el.dispatchEvent(new Event("input")); } GD.layersPanel.open(); const gl = document.getElementById("lpGisLive"); if (gl && !gl.checked) gl.click(); GD.layersPanel.close(); GD.gis.setOverlay({ id: ${JSON.stringify(pick.id)}, on: true }); GD.globe.st.map.jumpTo({ center: [-77.03, 38.9], zoom: 9 }); return true; })()`);
    const inspect = `(() => { const m = GD.globe.st.map; const tms = m.style.tileManagers || {}; const map = Object.keys(tms).filter((k) => k.includes(${JSON.stringify(pick.id)})).map((k) => ({ k, url: String((m.getSource(k) || {}).tiles || "").slice(0, 110), renderable: tms[k].getRenderableIds().length, visible: (m.getStyle().layers || []).filter((l) => l.source === k).map((l) => m.getLayoutProperty(l.id, "visibility") || "visible") })); return { year: GD.yearClock.getYear(), live: GD.gis.isLiveEnabled(), status: GD.gis.gisStatus({ id: ${JSON.stringify(pick.id)} }), map }; })()`;
    let seen = await b.ev(inspect);
    const t0 = Date.now();
    while (!seen.map.some((x) => x.renderable > 0 && x.visible.includes("visible")) && Date.now() - t0 < 20000) { await sleep(1000); seen = await b.ev(inspect); }
    return { ok: seen.map.some((x) => x.renderable > 0 && x.visible.includes("visible")), detail: { pick, ...seen } }; },
};

const server = spawn(process.env.PYTHON || "python3", ["-B", "tools/serve.py", String(PORT)], { cwd: root, stdio: "ignore",
  env: { ...process.env, GLOBEDESK_NO_BROWSER: "1", GLOBEDESK_DATA: fs.mkdtempSync(path.join(os.tmpdir(), "gd-feat-data-")), PYTHONDONTWRITEBYTECODE: "1" } });
const results = {}; let consoleErrors = [];
try {
  await until(async () => (await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok, 20000, "server");
  const b = await browser(false, 9491);
  try {
    await b.load("?guide=0");
    for (const [id, fn] of Object.entries(OFFLINE_CHECKS)) {
      if (process.env.FEATURES_ONLY && !process.env.FEATURES_ONLY.split(",").includes(id)) continue;
      try { results[id] = { ...(await fn(b)), pass: "offline" }; } catch (e) { results[id] = { ok: false, error: String(e.message || e).slice(0, 300) }; }
      console.log(id, results[id].ok ? "ok" : results[id].notWired ? "not wired" : results[id].unverified ? "unverified" : "FAILED", JSON.stringify(results[id].detail || results[id].error || "").slice(0, 300));
    }
  } finally { consoleErrors = consoleErrors.concat(b.errors.map((e) => "offline: " + e)); b.close(); }
  if (ONLINE) {
    const o = await browser(true, 9492);
    try {
      await o.load("?guide=0"); await sleep(3000);
      for (const [id, fn] of Object.entries(ONLINE_CHECKS)) {
        if (process.env.FEATURES_ONLY && !process.env.FEATURES_ONLY.split(",").includes(id)) continue;
        try { results[id] = { ...(await fn(o)), pass: "online" }; } catch (e) { results[id] = { ok: false, error: String(e.message || e).slice(0, 300) }; }
        console.log(id, results[id].ok ? "ok" : "FAILED", JSON.stringify(results[id].detail || results[id].error || "").slice(0, 400));
      }
    } finally { consoleErrors = consoleErrors.concat(o.errors.map((e) => "online: " + e)); o.close(); }
  }
} finally { server.kill("SIGKILL"); }

// Compare with the shipped labels.
const mismatches = [];
for (const f of FEATURES) {
  if (!f.check) continue;
  const r = results[f.check];
  if (!r) { if (!process.env.FEATURES_ONLY) mismatches.push(`${f.id}: no result for check ${f.check}`); continue; }
  const expect = r.ok ? "Live" : "Coming soon";
  if (f.status !== expect) mismatches.push(`${f.id}: label ${f.status} but check ${f.check} says ${expect}${r.unverified ? " (unverified)" : ""}`);
}
fs.writeFileSync(OUT, JSON.stringify({ results, consoleErrors, mismatches }, null, 2));
console.log("console errors:", consoleErrors.length, consoleErrors.slice(0, 5));
console.log("label mismatches:", mismatches.length, mismatches);
console.log("evidence written to", OUT);
process.exit(consoleErrors.length || mismatches.length ? 1 : 0);
