#!/usr/bin/env node
// Share-pack smoke: build a pack from a synthetic SAMPLE episode with the CLI, open it from
// disk (file://, no server, every host blocked), play, pause and scrub, and check that it made
// no network requests and logged no errors.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DBG = Number(process.env.SMOKE_DBG || 9447);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gd-smoke-share-"));
const fail = (msg) => { console.error("FAIL -", msg); process.exitCode = 1; };

const episode = {
  schema: "globedesk.episode/1", title: "Sample Share Pack Smoke", date: "2026-01-01", show: "Sample",
  stories: [
    { id: "sample-a", title: "Sample: Capitol", durationSec: 5, sources: [{ label: "Sample source", url: "https://www.aoc.gov/" }],
      camera: [{ at: 0, durationSec: 3, center: [-77.009, 38.889], zoom: 12, pitch: 30, bearing: 0 }], captions: [{ at: 0, text: "Sample caption A" }] },
    { id: "sample-b", title: "Sample: Lincoln Memorial", durationSec: 5, sources: [{ label: "Sample source", url: "https://www.nps.gov/linc/" }],
      camera: [{ at: 0, durationSec: 3, center: [-77.050, 38.889], zoom: 13, pitch: 45, bearing: 30 }], captions: [{ at: 0, text: "Sample caption B" }] }
  ]
};
const epFile = path.join(tmp, "sample.globedesk.json");
const pat = path.join(tmp, "patterns.json");
const out = path.join(tmp, "sample.globedesk.html");
fs.writeFileSync(epFile, JSON.stringify(episode));
fs.writeFileSync(pat, JSON.stringify(["Smoke Placeholder Name"]));
const b = spawnSync(process.env.PYTHON || "python3", ["-B", "tools/export_share_pack.py", "--episode", epFile, "--label", "PUBLIC", "--license", "CC BY 4.0",
  "--patterns", pat, "--data", tmp, "--out", out, "--yes"], { cwd: root, encoding: "utf8" });
if (b.status !== 0 || !fs.existsSync(out)) { console.error(b.stdout, b.stderr); fail("share pack CLI"); process.exit(1); }
console.log("ok - built", path.basename(out), fs.statSync(out).size, "bytes");

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gd-smoke-share-prof-"));
const chrome = spawn(process.env.CHROME || "google-chrome", ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", `--remote-debugging-port=${DBG}`,
  "--window-size=1280,720", `--user-data-dir=${profile}`, "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--host-resolver-rules=MAP * ~NOTFOUND", "about:blank"], { stdio: "ignore" });
try {
  let list;
  for (let i = 0; i < 75 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json(); } catch { await sleep(200); } }
  const page = list.find((p) => p.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const P = new Map(); const errs = []; const reqs = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && P.has(m.id)) { P.get(m.id)(m); P.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") errs.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errs.push(m.params.args.map((a) => a.value || a.description).join(" "));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errs.push(m.params.entry.text);
    if (m.method === "Network.requestWillBeSent") reqs.push(m.params.request.url.slice(0, 100));
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
  for (const d of ["Runtime", "Log", "Network", "Page"]) await send(d + ".enable");
  await send("Page.navigate", { url: "file://" + out });
  let ready = null;
  for (let i = 0; i < 100; i++) { ready = await ev("window.__gdShare && window.__gdShare.ready ? JSON.stringify(window.__gdShare) : ''"); if (ready) break; await sleep(200); }
  if (!ready) fail("player did not become ready"); else console.log("ok - opened from disk", ready);
  await ev("GD.sharePlayer.play()"); await sleep(1500);
  const playing = JSON.parse(await ev("JSON.stringify(GD.sharePlayer.state())"));
  if (!(playing.t > 0)) fail("play did not advance: " + JSON.stringify(playing)); else console.log("ok - plays", playing.t.toFixed(2));
  await ev("GD.sharePlayer.pause(); GD.sharePlayer.frame(7)"); await sleep(600);
  const st = JSON.parse(await ev("JSON.stringify(Object.assign(GD.sharePlayer.state(),{story:document.getElementById('spStory').textContent}))"));
  if (Math.abs(st.t - 7) > 0.01 || !/Lincoln/.test(st.story)) fail("scrub: " + JSON.stringify(st)); else console.log("ok - pause and scrub to 7 s:", st.story);
  const net = reqs.filter((u) => !/^(file|data|blob|gdpack):/.test(u));
  if (net.length) fail("network requests: " + net.join(", ")); else console.log("ok - no network requests");
  if (errs.length) fail("console errors: " + errs.join(" | ")); else console.log("ok - 0 console errors");
  ws.close();
} finally {
  chrome.kill();
  await sleep(300);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(profile, { recursive: true, force: true });
}
if (!process.exitCode) console.log("share-pack smoke ok");
