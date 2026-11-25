// Desk-server CSP: /videos.html is exempt (exact path only); index still has the original policy.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pySrc = fs.readFileSync(path.join(root, "tools", "serve.py"), "utf8");
const psSrc = fs.readFileSync(path.join(root, "tools", "serve.ps1"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

const take = (text, re) => {
  const m = text.match(re);
  if (!m) return "";
  return m[1].replace(/;+\s*$/, "").replace(/\s+/g, " ").trim();
};
const deskCsp = take(indexHtml, /http-equiv="Content-Security-Policy" content="([^"]+)"/);
const norm = (s) => String(s || "").replace(/;+\s*$/, "").replace(/\s+/g, " ").trim();

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("serve.py and serve.ps1 still ship the original desk CSP string", () => {
  assert.ok(deskCsp, "index CSP missing");
  assert.equal(take(pySrc, /send_header\("Content-Security-Policy",\s*"([^"]+)"/), deskCsp);
  assert.equal(take(psSrc, /Headers\.Add\("Content-Security-Policy", "([^"]+)"/), deskCsp);
  assert.equal(/unsafe-inline/.test(deskCsp), false);
});

t("serve.py exempts /videos.html by exact path, not a prefix", () => {
  assert.match(pySrc, /path == "\/videos\.html"/);
  assert.doesNotMatch(pySrc, /path\.startswith\("\/videos\.html/);
  assert.doesNotMatch(pySrc, /path\.startswith\('\/videos\.html/);
});

t("serve.ps1 exempts /videos.html by exact path, not a prefix (static; pwsh is not available)", () => {
  assert.match(psSrc, /\$urlPath -ine "\/videos\.html"/);
  assert.doesNotMatch(psSrc, /StartsWith\(\s*"\/videos\.html/);
  assert.doesNotMatch(psSrc, /-like\s+"\/videos\.html\*/);
  assert.doesNotMatch(psSrc, /\.StartsWith\(\s*"\/videos\.html/);
});

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
    s.on("error", reject);
  });
}

async function waitOk(url, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url, { method: "GET" });
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("timeout waiting for " + url);
}

async function get(origin, path) {
  const r = await fetch(origin + path, { method: "GET", redirect: "manual" });
  return { status: r.status, csp: r.headers.get("content-security-policy") };
}

const port = await freePort();
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gd-serve-csp-"));
const proc = spawn(process.env.PYTHON || "python3", ["-B", "tools/serve.py", String(port)], {
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
const origin = `http://127.0.0.1:${port}`;
try {
  await waitOk(origin + "/", 15000);

  const videos = await get(origin, "/videos.html");
  const videosQ = await get(origin, "/videos.html?t=20");
  const rootPage = await get(origin, "/");
  const indexPage = await get(origin, "/index.html");
  const htmlx = await get(origin, "/videos.htmlx");
  const bak = await get(origin, "/videos.html.bak");

  t("GET /videos.html has no desk CSP header", () => {
    assert.equal(videos.status, 200);
    assert.equal(videos.csp, null);
  });
  t("GET /videos.html?query is also exempt", () => {
    assert.equal(videosQ.status, 200);
    assert.equal(videosQ.csp, null);
  });
  t("GET / and /index.html still send the original desk CSP", () => {
    assert.equal(rootPage.status, 200);
    assert.equal(indexPage.status, 200);
    assert.equal(norm(rootPage.csp), deskCsp);
    assert.equal(norm(indexPage.csp), deskCsp);
  });
  t("prefix lookalikes /videos.htmlx and /videos.html.bak are not exempted", () => {
    assert.equal(norm(htmlx.csp), deskCsp);
    assert.equal(norm(bak.csp), deskCsp);
  });
} finally {
  proc.kill();
  try { await new Promise((r, j) => proc.once("exit", r).once("error", j)); } catch {}
  fs.rmSync(dataDir, { recursive: true, force: true });
}

console.log(`${n} serve-csp tests ok`);
