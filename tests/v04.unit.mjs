// v0.4 units: project pack, media limits, content-layer base-map invariance (pure), mixer already in unit.mjs.
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path"; import assert from "node:assert/strict"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, Date, console, Uint8Array, ArrayBuffer, TextEncoder, TextDecoder, DataView, URL };
// URL in vm may need global
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "data", "land.js"), "utf8"), ctx);
for (const f of ["themes", "captions", "events-model", "sanitize", "zip", "schema", "frog-rundown", "model", "media", "audio-mix", "content-layer", "project-io", "assistant", "store"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
}
const GD = ctx.window.GD;
const J = (v) => JSON.parse(JSON.stringify(v));
assert.deepEqual = ((orig) => (a, b, m) => orig(J(a), J(b), m))(assert.deepEqual);
let n = 0; const tests = [];
const t = (name, fn) => { tests.push({ name, fn }); };

t("media.validateFile rejects huge or unknown types", () => {
  const big = { name: "x.mp4", type: "video/mp4", size: 201 * 1024 * 1024 };
  const r = GD.media.validateFile(big);
  assert.equal(r.ok, false);
  const ok = GD.media.validateFile({ name: "pic.png", type: "image/png", size: 1000 });
  assert.equal(ok.ok, true);
  assert.equal(ok.kind, "image");
  const bad = GD.media.validateFile({ name: "x.exe", type: "application/x-msdownload", size: 10 });
  assert.equal(bad.ok, false);
});

t("project pack round-trip of episode JSON", async () => {
  const ep = GD.model.demoEpisode();
  const bytes = await GD.project.buildPack(ep, {});
  const pack = await GD.project.parsePack(bytes);
  assert.equal(pack.episode.title, ep.title);
  assert.equal(pack.episode.stories.length, 50);
  assert.deepEqual(GD.schema.validate(pack.episode), []);
});

t("legacy .globedesk.json without media still validates after normalize", () => {
  const ep = GD.model.blankEpisode();
  ep.schema = "gobedesk.episode/1";
  assert.deepEqual(GD.model.validate(ep), []);
  GD.model.normalizeEpisode(ep);
  assert.equal(ep.schema, "globedesk.episode/2");
});

t("content baseSnapshot comparison is structural (load/clear must not change it)", () => {
  const a = { available: true, baseId: "sat-hybrid", sourceIds: ["sat", "openmaptiles"], sources: { sat: { type: "raster", url: null, tiles: ["https://tiles.maps.eox.at/x"] } }, layerIds: ["sat", "roads"], terrain: null };
  const b = JSON.parse(JSON.stringify(a));
  assert.equal(GD.content.sameBase(a, b), true);
  b.sourceIds = ["sat", "openmaptiles", "user-hack"];
  assert.equal(GD.content.sameBase(a, b), false);
});

t("content visibleAt respects timing and hidden flag", () => {
  const el = { visible: true, at: 2, dur: 4 };
  assert.equal(GD.content.visibleAt(el, 1), false);
  assert.equal(GD.content.visibleAt(el, 2), true);
  assert.equal(GD.content.visibleAt(el, 6), false);
  el.visible = false;
  assert.equal(GD.content.visibleAt(el, 3), false);
});

t("media requires both MIME type and extension to match", () => {
  assert.equal(GD.media.validateFile({ name: "pic.png", type: "application/x-msdownload", size: 1000 }).ok, false);
  assert.equal(GD.media.validateFile({ name: "x.exe", type: "image/png", size: 10 }).ok, false);
  assert.equal(GD.media.validateFile({ name: "pic.png", type: "", size: 1000 }).ok, true); // empty MIME filled from extension
  assert.equal(GD.media.validateFile({ name: "clip.webm", type: "video/webm", size: 1000 }).ok, true);
  assert.equal(GD.media.validateFile({ name: "clip.webm", type: "audio/webm", size: 1000 }).ok, true);
});

t("?import= rejects backslash, tab, and protocol-relative bypasses", () => {
  const base = "https://desk.example/index.html";
  const reject = ["/\\host/x.json", "/\thost/x.json", "//host/x.json", "/%5Chost/x.json", "/%09host/x.json", "/%09/host/x.json", "/episodes/../secret.json", "/other/blank.globedesk.json", "https://evil.example/episodes/x.json"];
  for (const path of reject) {
    const r = GD.assistant.safeImportUrl(path, base);
    assert.equal(r.ok, false, path + " should be rejected, got " + JSON.stringify(r));
  }
  const ok = GD.assistant.safeImportUrl("/episodes/blank.globedesk.json", base);
  assert.equal(ok.ok, true);
  assert.equal(ok.url.origin, "https://desk.example");
  assert.ok(ok.url.pathname.startsWith("/episodes/"));
});

t("postMessage import rejects null origin, foreign source, and oversized payload", () => {
  const win = { opener: { id: "opener" }, parent: { id: "parent" } };
  const loc = { origin: "https://desk.example" };
  const json = JSON.stringify(GD.model.blankEpisode());
  assert.equal(GD.assistant.messageAllowed({ origin: "https://desk.example", source: win, data: { type: "globedesk.import", json } }, loc, win), true);
  assert.equal(GD.assistant.messageAllowed({ origin: "null", source: win, data: { type: "globedesk.import", json } }, loc, win), false);
  assert.equal(GD.assistant.messageAllowed({ origin: "https://desk.example", source: win, data: { type: "globedesk.import", json } }, { origin: "null" }, win), false);
  assert.equal(GD.assistant.messageAllowed({ origin: "https://desk.example", source: { id: "other" }, data: { type: "globedesk.import", json } }, loc, win), false);
  const huge = "x".repeat(GD.schema.LIMITS.projectJson + 1);
  assert.equal(GD.assistant.messageAllowed({ origin: "https://desk.example", source: win, data: { type: "globedesk.import", json: huge } }, loc, win), false);
  const inj = JSON.parse(json);
  inj.stories[0].durationSec = "<img src=x onerror=alert(1)>";
  const r = GD.assistant.importJson(JSON.stringify(inj));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /durationSec/.test(e)));
});

t("overlay css values are clamped as numbers", () => {
  const c = GD.content.clampOverlay({
    mode: "pip",
    x: "6;background:url(https://s3.amazonaws.com/x)",
    y: -20,
    width: 250,
    height: "z-index:99",
    opacity: "2"
  });
  assert.equal(c.x, 0);
  assert.equal(c.y, 0);
  assert.equal(c.width, 100);
  assert.equal(c.height, 30);
  assert.equal(c.opacity, 1);
  const full = GD.content.clampOverlay({ mode: "full", opacity: 0.4 });
  assert.equal(full.mode, "full");
  assert.equal(full.opacity, 0.4);
});

t("auto map citations use auto credit, not [UNKNOWN]", () => {
  const path = GD.model.autoCameraPath(50.45, 30.56, 8, { onLand: true });
  assert.ok(path.length);
  for (const k of path) {
    assert.equal(k.citation.type, "Map");
    assert.equal(k.citation.date, "auto");
    assert.equal(k.citation.credit, "auto");
    assert.equal(k.citation.license, "auto");
  }
});

t("safeImportUrl rejects encoded slashes, backslashes and dots", () => {
  const base = "https://desk.example/index.html";
  const reject = [
    "/episodes/..%2fx.json", "/episodes/%2e%2e/x.json", "/episodes/%2E%2e%2Fx.json",
    "/episodes/foo%5cx.json", "/episodes/foo%5Cx.json", "/episodes/%2F%2Fhost/x.json",
    "/episodes/bar%2ejson"
  ];
  for (const path of reject) {
    const r = GD.assistant.safeImportUrl(path, base);
    assert.equal(r.ok, false, path + " should be rejected, got " + JSON.stringify(r));
  }
  assert.equal(GD.assistant.safeImportUrl("/episodes/blank.globedesk.json", base).ok, true);
});

t("acceptFetchedUrl re-checks a redirected final URL", () => {
  const base = "https://desk.example/index.html";
  assert.equal(GD.assistant.acceptFetchedUrl("https://desk.example/zz/evil.json", base).ok, false);
  assert.equal(GD.assistant.acceptFetchedUrl("https://s3.amazonaws.com/other-bucket/x.json", base).ok, false);
  assert.equal(GD.assistant.acceptFetchedUrl("https://evil.example/episodes/x.json", base).ok, false);
  const ok = GD.assistant.acceptFetchedUrl("https://desk.example/episodes/blank.globedesk.json", base);
  assert.equal(ok.ok, true);
});

t("postMessage rejects a null source even when opener is null", () => {
  const win = { opener: null, parent: { id: "parent" } };
  const loc = { origin: "https://desk.example" };
  const json = JSON.stringify(GD.model.blankEpisode());
  const ev = { origin: "https://desk.example", source: null, data: { type: "globedesk.import", json } };
  assert.equal(GD.assistant.messageAllowed(ev, loc, win), false);
  ev.source = win;
  assert.equal(GD.assistant.messageAllowed(ev, loc, win), true);
});

t("rejected restore is kept under a backup key and autosave does not overwrite it", async () => {
  assert.notEqual(GD.store.EPISODE_KEY, GD.store.REJECTED_KEY);
  const bad = GD.model.blankEpisode();
  bad.notAField = 1;
  const errs = GD.schema.validate(bad);
  assert.ok(errs.some((e) => /unknown key/.test(e)));
  const review = GD.store.reviewRestore(bad, errs);
  assert.equal(review.ok, false);
  assert.equal(review.episode, null);
  assert.equal(review.backup.episode, bad);
  assert.ok(review.backup.errors.length);
  await GD.store.keepRejected(bad, errs);
  const good = GD.model.blankEpisode();
  await GD.store.saveEpisode(good);
  const cur = await GD.store.loadEpisode();
  const bak = await GD.store.loadRejected();
  assert.equal(cur.title, good.title);
  assert.equal(Object.prototype.hasOwnProperty.call(cur, "notAField"), false);
  assert.equal(bak.episode.notAField, 1);
  assert.ok(Array.isArray(bak.errors) && bak.errors.length);
});

for (const { name, fn } of tests) {
  await fn();
  n++;
  console.log("ok -", name);
}
console.log(`\n${n} passed`);
