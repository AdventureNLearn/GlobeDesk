// v1.0.0 Official Release: Frogpost default show (release acceptance checks), the archive
// rule (every story ever added keeps a card and can be brought back), and the layout fixes
// that are testable without a browser. No network.
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path"; import assert from "node:assert/strict"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, Date, URL, console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "data", "land.js"), "utf8"), ctx);
for (const f of ["themes", "captions", "events-model", "sanitize", "schema", "frog-rundown", "model", "archive", "store", "recorder", "version"]) vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
const GD = ctx.window.GD;
const { model, themes, archive, recorder } = GD;
const ROWS = GD.frogRundown;
const J = (v) => JSON.parse(JSON.stringify(v));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const BUCKETS = ["Build it", "Globe encyclopedia", "Water and works", "Receipts", "Frogpost"];
const CTD_RE = /TheCriticalDri1|CTD's Geopolitics/;
// v1.0.0: school-river and bangkok-clay were dropped (no backing source / owner privacy rule).
const EXPECTED = 48;
let n = 0; const tests = []; const t = (name, fn) => tests.push({ name, fn });

// ---------- Release acceptance: Frogpost default show ----------
t("empty save opens Frogpost: badge FROGPOST, handle @AdventureNLearn, 48 stories, theme frog", () => {
  const ep = model.demoEpisode();
  assert.equal(ep.show, "Frogpost");
  assert.equal(ep.title, "Frogpost");
  assert.equal(ep.handle, "@AdventureNLearn");
  assert.equal(ep.outro.handle, "@AdventureNLearn");
  assert.equal(ep.look.theme, "frog");
  assert.equal(ep.look.headerBadge, "FROGPOST");
  assert.equal(ep.stories.length, EXPECTED);
  assert.equal(ep.lede, "The rundown is a sample. Locations are approximate. Claims are as reported, not verified.");
  assert.deepEqual(J(model.validate(ep)), []);
  // Boot path: an empty save (null) or a saved CTD sample both fall through to demoEpisode().
  const ui = read("js/ui.js");
  assert.match(ui, /if \(!ep\) \{ ep = GD\.model\.demoEpisode\(\);/);
  assert.match(ui, /isLegacyCtdSample\(ep\)/);
  assert.equal(model.isLegacyCtdSample(archive.ctdEpisode()), true);
  assert.equal(model.isLegacyCtdSample(ep), false);
});
t("frog look: palette, first in the list, the fallback, and on blankEpisode()/demoEpisode()", () => {
  assert.equal(Object.keys(themes.THEMES)[0], "frog");
  assert.equal(themes.lookFor("no-such-theme").theme, "frog");
  const L = themes.THEMES.frog;
  assert.deepEqual(J(L.palette), { bg: "#0c1610", ink: "#f3f7ef", accent: "#3dbe6a", highlight: "#d6f25c", panel: "rgba(16,42,28,0.78)", outroBg: "#07140c" });
  assert.equal(L.header, true); assert.equal(L.headerBadge, "FROGPOST");
  assert.equal(L.captionsOn, true); assert.equal(L.captionStyle, "shadow"); assert.equal(L.captionSize, "large"); assert.equal(L.captionLines, 2); assert.equal(L.captionZonePct, 15);
  assert.equal(L.lowerThird, false); assert.equal(L.music, false); assert.equal(L.shotSec, 8); assert.equal(L.map.base, "sat-hybrid");
  for (const ep of [model.blankEpisode(), model.demoEpisode()]) { assert.notEqual(ep.look.theme, "ctd"); assert.equal(ep.look.theme, "frog"); }
  const b = model.blankEpisode();
  assert.equal(b.show, "Frogpost"); assert.equal(b.handle, "@AdventureNLearn");
  assert.ok(themes.THEMES.ctd, "ctd stays as an optional look");
  assert.doesNotMatch(themes.THEMES.ctd.label, /default/i);
  assert.ok(JSON.parse(read("schema/globedesk-story.schema.json")) && /"frog"/.test(read("schema/globedesk-story.schema.json")));
});
t("no TheCriticalDri1 / CTD's Geopolitics in the default show, README, Frogpost file or rundown", () => {
  const ep = model.demoEpisode();
  assert.doesNotMatch(JSON.stringify(ep), CTD_RE);
  for (const s of ep.stories) { assert.doesNotMatch(s.title, CTD_RE); assert.doesNotMatch(s.script, CTD_RE); }
  for (const f of ["README.md", "episodes/frogpost-2026-11-20.globedesk.json", "episodes/blank.globedesk.json", "js/frog-rundown.js", "USER-GUIDE.md", "docs/STORY-FORMAT.md", "index.html"]) assert.doesNotMatch(read(f), CTD_RE, f);
  const m = read("js/model.js"); const body = m.slice(m.indexOf("function demoEpisode()"), m.indexOf("function isLegacyCtdSample"));
  assert.doesNotMatch(body, /CTD|Hormuz|Kyiv|Riyadh/);
});
t("stories with null coordinates have no pin, no camera, and are absent from the event layer", () => {
  const ep = model.demoEpisode();
  const nopin = ep.stories.filter((s) => s.location.lat == null);
  assert.deepEqual(J(nopin.map((s) => s.slug).sort()), ["builder-streak", "frog-narrator", "meme-skin", "open-maps", "paid-attention", "shill-map"]);
  nopin.forEach((s) => { assert.equal(s.location.lon, null); assert.equal(s.camera.length, 0); assert.equal(s.cards[0].pin, null); });
  const feats = ep.eventLayers.flatMap((l) => l.features);
  const ids = new Set(feats.map((f) => f.properties.storyId));
  nopin.forEach((s) => assert.equal(ids.has(s.id), false, s.slug));
  assert.equal(feats.length, 42);
  feats.forEach((f) => { const s = ep.stories.find((x) => x.id === f.properties.storyId); assert.deepEqual(J(f.geometry.coordinates), [s.location.lon, s.location.lat]); });
});
t("no new facts, no new buckets, no rewritten card copy; [UNKNOWN] kept; 16 s, unverified, asReported", () => {
  const ep = model.demoEpisode();
  assert.equal(ROWS.length, EXPECTED);
  const counts = {};
  ep.stories.forEach((s, i) => {
    const [slug, bucket, title, place, lat, lon, a3, url, label, body] = ROWS[i];
    assert.ok(BUCKETS.includes(bucket), bucket);
    counts[bucket] = (counts[bucket] || 0) + 1;
    assert.equal(s.slug, slug); assert.equal(s.title, title); assert.equal(s.location.name, place);
    assert.equal(s.location.lat, lat); assert.equal(s.location.lon, lon);
    assert.equal(s.cards.length, 1);
    assert.equal(s.cards[0].body, body, slug + " card body is the row body");
    assert.ok(s.cards[0].title === bucket || s.cards[0].title === bucket + " · source missing");
    assert.equal(s.cards[0].verified, false);
    assert.equal(s.durationSec, 16);
    assert.equal(s.asReported, true);
    assert.equal(s.summary, bucket + ", as reported. Not verified.");
    if (/\[UNKNOWN\]/.test(body)) assert.match(s.cards[0].body, /\[UNKNOWN\]/);
    if (url) {
      assert.equal(s.sources.length, 1); assert.equal(s.sources[0].url, url); assert.equal(s.sources[0].label, label); assert.equal(s.sources[0].status, "unverified");
      assert.equal(s.creditUrl, url);
    } else {
      assert.equal(s.sources.length, 0, slug + " has no blank source box");
      assert.match(s.cards[0].title, /source missing/);
      assert.ok(s.cards[0].facts.some((f) => /Missing \[UNKNOWN\]/.test(f.value)));
    }
    if (a3) assert.equal(s.location.a3, a3); else assert.equal(s.location.a3, undefined);
  });
  assert.deepEqual(J(counts), { "Build it": 10, "Globe encyclopedia": 10, "Water and works": 9, "Receipts": 10, "Frogpost": 9 });
  // The bundled Frogpost file matches the code.
  const file = JSON.parse(read("episodes/frogpost-2026-11-20.globedesk.json"));
  assert.deepEqual(file.stories.map((s) => s.cards[0].body), J(ROWS.map((r) => r[9])));
});
t("page chrome: title, brand, frog-rundown.js loads before model.js, archive.js after", () => {
  const html = read("index.html");
  assert.match(html, /<title>Frogpost — GlobeDesk<\/title>/);
  assert.match(html, /🐸<\/span> <span class="brand-name">Frogpost<\/span>/);
  assert.match(html, /href="https:\/\/x\.com\/AdventureNLearn"/);
  const a = html.indexOf('src="js/frog-rundown.js"'), b = html.indexOf('src="js/model.js"'), c = html.indexOf('src="js/archive.js"');
  assert.ok(a > 0 && a < b && b < c);
  assert.match(read("css/app.css"), /--accent:#3dbe6a/);
});

t("Florida stories share one state-level pin; no town names; school-river is gone", () => {
  const ep = model.demoEpisode();
  const fl = ep.stories.filter((s) => s.location.lat != null && s.location.lat > 24 && s.location.lat < 31.1 && s.location.lon > -87.7 && s.location.lon < -79.8);
  assert.deepEqual(J(fl.map((s) => s.slug).sort()), ["florida-bridge", "florida-soils", "fort-lauderdale", "neighbor-boats", "st-johns"]);
  fl.forEach((s) => { assert.equal(s.location.name, "Florida (state-level, approx.)"); assert.equal(s.location.lat, 28.0); assert.equal(s.location.lon, -81.7); });
  assert.equal(ep.stories.some((s) => s.slug === "school-river"), false);
  const towns = /Melbourne|Edgewater|Palm Bay|Merritt Island|Cocoa|Brevard|Volusia/;
  for (const f of ["js/frog-rundown.js", "episodes/frogpost-2026-11-20.globedesk.json", "episodes/layers/frogpost-sample-story-places-approximate-not-verified.geojson"]) {
    const txt = read(f).replace(/https:\/\/[^"\s]+/g, ""); // source URLs are kept as published
    assert.doesNotMatch(txt, towns, f); assert.doesNotMatch(txt, /school-river/, f);
  }
});
t("sourced claims (v1.0.0): every card except the open-maps opinion card has an https source; dropped cards are gone", () => {
  const ep = model.demoEpisode();
  assert.deepEqual(J(ep.stories.filter((s) => !s.sources.length).map((s) => s.slug)), ["open-maps"]);
  for (const gone of ["school-river", "bangkok-clay", "seafloor-lease"]) {
    assert.equal(ep.stories.some((s) => s.slug === gone), false, gone);
    for (const f of ["js/frog-rundown.js", "episodes/frogpost-2026-11-20.globedesk.json", "episodes/layers/frogpost-sample-story-places-approximate-not-verified.geojson"]) assert.doesNotMatch(read(f), new RegExp(gone), f);
  }
  const by = (slug) => ep.stories.find((s) => s.slug === slug);
  assert.equal(by("iowa-plant").sources[0].url, "https://x.com/SecArmy/status/2123574872559493304");
  assert.equal(by("robocalls").sources[0].url, "https://x.com/Shaughnessy119/status/2118504294290780434");
  assert.match(by("robocalls").sources[0].label, /unofficial/); assert.match(by("robocalls").cards[0].body, /not checked/);
  const sc = by("socal-lease-call");
  assert.equal(sc.title, "Southern California offshore lease call");
  assert.match(sc.sources[0].url, /^https:\/\/www\.federalregister\.gov\/documents\/2026\/01\/27\/2026-01568\//);
  assert.match(sc.cards[0].body, /not a final decision to lease/); assert.doesNotMatch(sc.cards[0].body, /auction/i);
  assert.equal(sc.location.precision, "approximate");
  ROWS.forEach((r) => assert.doesNotMatch(r[9], /\b(Your|You called)\b/, r[0]));
});

// ---------- Archive rule: every story ever added keeps a card and can be brought back ----------
t("archive: every story in every bundled show and every /episodes file has a card", () => {
  const all = archive.all(null);
  const cards = archive.list(all);
  assert.equal(archive.list(all, "frogpost-2026-11-20").length, EXPECTED);
  assert.equal(archive.list(all, "ctd-geopolitics-2026-11-20").length, 3);
  const slugs = new Set(cards.map((c) => c.slug));
  for (const f of fs.readdirSync(path.join(root, "episodes"))) {
    if (!/\.globedesk\.json$/.test(f) || f === "blank.globedesk.json") continue;
    const ep = JSON.parse(read("episodes/" + f));
    ep.stories.forEach((s) => assert.ok(slugs.has(s.slug), f + ": " + s.slug + " has no archive card"));
    assert.ok(archive.SHOWS.some((sh) => sh.file === "episodes/" + f), f + " is listed as an archive show");
  }
  archive.SHOWS.forEach((sh) => assert.ok(fs.existsSync(path.join(root, sh.file)), sh.file));
});
t("archive: the CTD show stays, credited and linked to its creator; it is not the default", () => {
  const sh = archive.show("ctd-geopolitics-2026-11-20");
  assert.equal(sh.isDefault, false); assert.equal(sh.handle, "@TheCriticalDri1"); assert.equal(sh.handleUrl, "https://x.com/TheCriticalDri1");
  const cards = archive.list(archive.all(null), sh.id);
  cards.forEach((c) => { assert.equal(c.credit, "@TheCriticalDri1"); assert.match(c.creditUrl, /^https:\/\/x\.com\/TheCriticalDri1\/status\/\d+$/); });
  assert.equal(archive.SHOWS.filter((s) => s.isDefault).map((s) => s.id).join(), "frogpost-2026-11-20");
  const file = JSON.parse(read("episodes/demo-2026-11-20.globedesk.json"));
  file.stories.forEach((s) => { assert.equal(s.credit, "@TheCriticalDri1"); assert.equal(s.creditUrl, s.sources[0].url); assert.ok(s.sources.every((x) => x.url)); });
  const r = archive.openShow("ctd-geopolitics-2026-11-20/kyiv-bridges", archive.all(null));
  assert.equal(r.episode.stories[r.storyIdx].slug, "kyiv-bridges");
  assert.deepEqual(J(model.validate(r.episode)), []);
});
t("archive: append-only — deleting a story keeps its card; bring back restores it exactly", () => {
  const ep = model.blankEpisode();
  ep.stories[0].title = "My first story"; ep.stories[0].slug = "mine-1";
  const s2 = model.blankStory(2); s2.title = "My second story"; s2.slug = "mine-2"; ep.stories.push(s2);
  let idx = archive.remember(archive.blankIndex(), ep, ep.id, 1);
  assert.equal(archive.list(idx).length, 2);
  const gone = ep.stories.splice(1, 1)[0];          // user deletes story 2 from the rundown
  idx = archive.remember(idx, ep, ep.id, 2);
  assert.equal(archive.list(idx).length, 2, "deleting from the rundown never prunes the archive");
  idx = archive.merge(idx, archive.blankIndex());
  assert.equal(archive.list(idx).length, 2, "merging with an empty index never prunes");
  const key = archive.keyFor(ep.id, gone);
  const i = archive.bringBack(idx, key, ep);
  assert.equal(i, 1);
  assert.deepEqual(J(ep.stories[1]), J(gone));
  assert.equal(archive.bringBack(idx, key, ep), 1, "bringing back twice selects, does not duplicate");
  assert.deepEqual(J(model.validate(ep)), []);
  assert.equal(archive.bringBack(idx, "no/such", ep), -1);
});
t("archive: saves merge with what is stored (never replace) and clearAll keeps the archive", async () => {
  archive._mem.index = null;
  const a = model.blankEpisode(); a.stories[0].slug = "a1";
  const b = model.blankEpisode(); b.stories[0].slug = "b1";
  await archive.rememberEpisode(a, "show-a");
  await archive.rememberEpisode(b, "show-b");
  const got = await archive.load();
  assert.deepEqual(J(Object.keys(got.cards).sort()), ["show-a/a1", "show-b/b1"]);
  const st = read("js/store.js"); const clr = st.slice(st.indexOf("function clearAll"), st.indexOf("let timer"));
  assert.doesNotMatch(clr, /\.clear\(\)\s*;[\s\S]*kv|objectStore\("kv"\)\.clear/, "clearAll must not wipe the kv store (archive lives there)");
});
t("archive: the UI has an Archive page with open / bring-back actions", () => {
  const html = read("index.html"), ui = read("js/ui.js");
  assert.match(html, /id="btnArchive"/); assert.match(html, /<dialog id="archive"/);
  assert.match(ui, /data-back=/); assert.match(ui, /GD\.archive\.bringBack\(/); assert.match(ui, /data-open=/);
  assert.match(ui, /rememberSoon\(\);/, "every change is remembered");
});

// ---------- Layout and release fixes ----------
t("version is 1.0.1 · Official Release everywhere and shown in the UI", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(GD.version.APP, "1.0.1"); assert.equal(pkg.version, "1.0.1");
  assert.equal(GD.version.EDITION, "Official Release");
  assert.match(read("index.html"), /id="appVersion"[^>]*>v1\.0\.1 · Official Release</);
  assert.equal(JSON.parse(read("grokme/manifest.json")).version, "1.0.1");
  assert.match(read("README.md"), /v1\.0\.1 · Official Release/); assert.match(read("CHANGELOG.md"), /1\.0\.1/); assert.match(read("CHANGELOG.md"), /1\.0\.0.*Official Release/);
});
t("inspector: 12 tabs with role=tab / aria-selected, in a 4 x 3 grid instead of a hidden sideways scroll", () => {
  const html = read("index.html");
  const tabs = html.match(/<button role="tab"[^>]*>/g) || [];
  assert.equal(tabs.length, 12);
  tabs.forEach((b) => { assert.match(b, /aria-selected="(true|false)"/); assert.match(b, /aria-controls="inspector"/); });
  assert.match(html, /id="inspector" class="inspector" role="tabpanel"/);
  const css = read("css/app.css"); const rule = css.match(/\n\.tabs \{[^}]*\}/)[0];
  assert.match(rule, /display:grid; grid-template-columns:repeat\(4,/); assert.doesNotMatch(rule, /overflow-x:auto|flex-wrap:nowrap/);
});
t("event labels never overlap each other or blocked boxes", () => {
  const items = []; for (let i = 0; i < 30; i++) items.push({ ax: 400 + (i % 6) * 20, ay: 300 + Math.floor(i / 6) * 15, w: 220, h: 58, off: 12 });
  const blocked = [{ x: 0, y: 0, w: 1920, h: 162 }, { x: 0, y: 918, w: 1920, h: 162 }, { x: 1250, y: 182, w: 620, h: 300 }];
  const placed = recorder.placeLabels(items, blocked, 1920, 1080, 4);
  assert.ok(placed.length >= 1 && placed.length < items.length);
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  placed.forEach((p, i) => {
    blocked.forEach((b) => assert.equal(hit(p.box, b), false));
    placed.forEach((q, j) => { if (i !== j) assert.equal(hit(p.box, q.box), false); });
  });
  assert.equal(placed[0].item, items[0], "first (active story) label always gets a spot when there is room");
});
t("contrast: Record button and the FROGPOST badge text are ≥ 4.5:1", () => {
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0); };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const css = read("css/app.css");
  const rec = css.match(/--rec:(#[0-9a-f]{6})/i)[1];
  assert.match(css, /button\.rec \{[^}]*background:var\(--rec\)[^}]*color:#fff/);
  assert.ok(cr(rec, "#ffffff") >= 4.5, "record " + cr(rec, "#ffffff").toFixed(2));
  const ink = recorder.badgeInk("#3dbe6a");
  assert.ok(cr("#3dbe6a", ink) >= 4.5, "badge " + cr("#3dbe6a", ink).toFixed(2));
});
t("phone layout rules exist: single column, globe first, menu for top-bar buttons, collapsible panels", () => {
  const css = read("css/app.css"); const m = css.slice(css.indexOf("@media (max-width: 760px)"));
  assert.match(m, /\.desk \{ display:flex; flex-direction:column;/);
  assert.match(m, /\.col\.center \{ order:1; \}/);
  assert.match(m, /body\.menu-open \.tools \{ display:flex; \}/);
  assert.match(m, /\.panel\.closed > :not\(h2\) \{ display:none; \}/);
  assert.match(read("index.html"), /id="btnMenu"[^>]*aria-expanded="false"/);
});
t("phone map credits: in-stage box hidden under 760 px and mirrored into a line under the globe", () => {
  const css = read("css/app.css"); const m = css.slice(css.indexOf("@media (max-width: 760px)"));
  assert.match(m, /\.stage \.maplibregl-ctrl-attrib \{ display:none; \}/);
  assert.match(m, /\.stage-credit \{ display:block;[^}]*font-size:11px/);
  assert.match(css, /\n\.stage-credit \{ display:none; \}/, "desktop keeps the in-stage credit");
  const html = read("index.html");
  assert.ok(html.indexOf('id="stageCredit"') > html.indexOf('id="stageWrap"') && html.indexOf('id="stageCredit"') < html.indexOf('class="transport"'));
  assert.match(read("js/ui.js"), /maplibregl-ctrl-attrib-inner[\s\S]*stageCredit[\s\S]*replaceChildren/);
});
t("toast is fully hidden when idle (no invisible overlap)", () => {
  const css = read("css/app.css");
  assert.match(css, /\.toast \{[^}]*visibility:hidden/);
});
t("grokme manifest leaves out tests/, tools/, starter/, .gitignore, START-GLOBEDESK.bat, OPEN-ITEMS.md and demo/; it serves callouts.js", () => {
  const m = JSON.parse(read("grokme/manifest.json"));
  const paths = m.files.map((f) => f.path);
  assert.ok(paths.includes("index.html") && paths.includes("js/frog-rundown.js") && paths.includes("js/archive.js"));
  for (const p of paths) assert.doesNotMatch(p, /^(tests\/|tools\/|demo\/|starter\/|\.gitignore$|START-GLOBEDESK\.bat$|OPEN-ITEMS\.md$)/, p);
  assert.ok(paths.includes("js/callouts.js") && paths.includes("LICENSE") && paths.includes("LICENSE-CONTENT"));
});
t("demo voices and sounds: British = Piper en_GB-vctk-medium (CC BY 4.0 data), US labeled non-commercial, sfx synthesized by our script; no alan, no CC0 claim", () => {
  const pack = JSON.parse(read("demo/guide-packs/frogpost/manifest.json"));
  const ids = pack.voices.map((v) => v.id);
  assert.deepEqual(ids, ["hfc_male", "gb"]);
  const gb = pack.voices.find((v) => v.id === "gb");
  assert.equal(gb.dir, "assets/vo/gb/"); assert.match(gb.name, /en_GB-vctk-medium/);
  assert.match(pack.voices[0].license, /Non-commercial/);
  const vo = path.join(root, "demo/guide-packs/frogpost/assets/vo");
  assert.equal(fs.existsSync(path.join(vo, "alan")), false, "alan bank removed");
  const dur = JSON.parse(read("demo/guide-packs/frogpost/assets/vo/gb/durations.json"));
  assert.equal(dur.length, 50);
  dur.forEach((r) => assert.ok(fs.statSync(path.join(vo, "gb", r.file)).size > 1000, r.file));
  const gbSrc = read("demo/guide-packs/frogpost/assets/vo/gb/SOURCE.txt");
  assert.match(gbSrc, /datashare\.ed\.ac\.uk\/handle\/10283\/3443/); assert.match(gbSrc, /openslr\.org\/109/); assert.match(gbSrc, /CC BY 4\.0/);
  const usSrc = read("demo/guide-packs/frogpost/assets/vo/SOURCE.txt");
  assert.match(usSrc, /NON-COMMERCIAL/); assert.match(usSrc, /CC BY-NC-SA 4\.0/); assert.match(usSrc, /Blizzard 2013/);
  for (const f of ["CREDITS.md", "README.md"]) { const t = read(f); assert.match(t, /CC BY-NC-SA 4\.0/, f); assert.match(t, /lessac/, f); assert.match(t, /non-commercial/i, f); }
  for (const d of ["demo/assets/sfx", "demo/guide-packs/frogpost/assets/sfx"]) {
    const src = read(d + "/SOURCES.txt");
    assert.match(src, /make-sfx\.py/); assert.match(src, /CC BY 4\.0/); assert.doesNotMatch(src, /CC0|UNKNOWN/);
  }
  const sfxScript = read("demo/tools/make-sfx.py");
  for (const f of fs.readdirSync(path.join(root, "demo/assets/sfx")).filter((x) => x.endsWith(".wav"))) assert.ok(sfxScript.includes(`"${f}"`), "make-sfx.py makes " + f);
  const all = ["CREDITS.md", "README.md", "LICENSE-CONTENT", "demo/README.md", "demo/CREDITS.md", "demo/guide-packs/frogpost/README.md", "demo/guide-packs/frogpost/manifest.json"].map(read).join("\n");
  assert.doesNotMatch(all, /en_GB-alan|mimic3|Treat as CC0/);
});
t("license files and starter kit: MIT + CC BY 4.0, a valid blank episode template, guide-pack template matches the demo template", () => {
  assert.match(read("LICENSE"), /MIT License/); assert.match(read("LICENSE"), /AdventureNLearn/);
  const lc = read("LICENSE-CONTENT"); assert.match(lc, /Attribution 4\.0 International/); assert.match(lc, /AdventureNLearn/);
  assert.match(lc, /NON-COMMERCIAL/); assert.match(lc, /en_GB-vctk-medium/);
  const st = JSON.parse(read("starter/episode-template.globedesk.json"));
  assert.deepEqual(J(model.validate(st)), []);
  assert.doesNotMatch(JSON.stringify(st), /AdventureNLearn|Frogpost|frogpost/);
  const lay = JSON.parse(read("starter/layer-template.geojson"));
  assert.equal(lay.type, "FeatureCollection"); assert.ok(lay.features.length >= 3 && lay.features.every((f) => f.properties.example === true));
  assert.deepEqual(JSON.parse(read("starter/guide-pack-template/manifest.json")), JSON.parse(read("demo/guide-packs/template/manifest.json")));
});

for (const { name, fn } of tests) { await fn(); n++; console.log("ok -", name); }
console.log(`\n${n} passed`);
