// Unit checks for the pieces built here: model, captions, camera path, validation. No browser, no network.
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path"; import assert from "node:assert/strict"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, Date, URL, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView, console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "data", "land.js"), "utf8"), ctx);
for (const f of ["themes", "captions", "events-model", "sanitize", "zip", "schema", "model", "layers", "audio-mix", "recorder"]) vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
const { model, captions, themes, recorder, sanitize, zip, schema, layers, audioMix } = ctx.window.GD;
const land = ctx.window.GD_LAND;
const J = (v) => JSON.parse(JSON.stringify(v));
assert.deepEqual = ((orig) => (a, b, m) => orig(J(a), J(b), m))(assert.deepEqual);
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("demo has 3 stories, CTD look, outro, unverified approximate locations", () => {
  const ep = model.demoEpisode();
  assert.equal(ep.stories.length, 3);
  assert.equal(ep.look.theme, "ctd");
  assert.equal(ep.look.lowerThird, false);
  assert.equal(ep.outro.line1, "Full brief on the channel");
  for (const s of ep.stories) {
    assert.equal(s.location.verified, false);
    assert.equal(s.location.note, "demo, not verified");
    assert.ok(s.sources.every((x) => x.status === "unverified"));
    assert.ok(s.sources.every((x) => !x.url || /^https:\/\/x\.com\/TheCriticalDri1\/status\//.test(x.url)), "only crit's posts linked");
  }
  assert.deepEqual(model.validate(ep), []);
});
t("auto camera path: orbit, dive, street, cinematic with two cuts ~8 s apart", () => {
  const p = model.autoCameraPath(50.45, 30.56, 8);
  assert.deepEqual(p.map((k) => k.preset), ["orbit", "dive", "street", "cinematic"]);
  assert.deepEqual(p.filter((k) => k.cut).map((k) => k.at), [0, 8]);
  assert.ok(p[2].zoom >= 16 && p[3].pitch >= 70);
});
t("land check: Kyiv and Riyadh are land; Hormuz pin is water", () => {
  assert.equal(model.pointInLand(50.45, 30.56, land), true);
  assert.equal(model.pointInLand(24.71, 46.68, land), true);
  assert.equal(model.pointInLand(26.57, 56.25, land), false);
});
t("water pin without a land look target stays at a regional close, no street zoom", () => {
  const p = model.autoCameraPathForLocation({ lat: 26.57, lon: 56.25, name: "Strait of Hormuz (approx. center)" }, 8, land);
  assert.ok(p.every((k) => k.preset !== "street" && k.zoom < 12));
  assert.ok(p.some((k) => k.preset === "close" && k.zoom >= 6 && k.zoom < 9));
});
t("separate look target: street keyframes use the land target, pin stays on the story", () => {
  const loc = { lat: 26.57, lon: 56.25, look: { lat: 27.18, lon: 56.28, name: "Bandar Abbas (gazetteer, approx.)" } };
  // Bandar Abbas-ish coast should be land; if the coarse land pack misses it, skip the on-land assertion's path via explicit coords
  const p = model.autoCameraPath(loc.lat, loc.lon, 8, { lookLat: loc.look.lat, lookLon: loc.look.lon, onLand: true });
  const street = p.filter((k) => k.preset === "street" || k.preset === "cinematic");
  assert.equal(street.length, 2);
  street.forEach((k) => { assert.equal(k.center[0], 56.28); assert.equal(k.center[1], 27.18); assert.ok(k.zoom >= 15); });
  assert.deepEqual(p[0].center, [56.25, 26.57]); // orbit stays on the pin
});
t("lookTarget falls back to the pin when look is unset", () => {
  const t = model.lookTarget({ lat: 50.45, lon: 30.56, name: "Kyiv" });
  assert.equal(t.from, "pin");
  assert.equal(t.lat, 50.45);
});
t("citation layout: title starts to the right of the badge and stays inside the header", () => {
  const ctx = { font: "", measureText: (t) => ({ width: String(t).length * 8 }) };
  const font = (w, px) => `${w} ${px}px sans-serif`;
  const lay = recorder.layoutHeader(1920, 1080, { headerHeightPct: 15 }, 1, ctx, font, "NOW COVERING", "Three major Kyiv bridges damaged, as reported");
  assert.ok(lay.titleX >= lay.badgeX + lay.badgeW, "title must start after the badge");
  assert.ok(lay.titleY0 + (lay.titleLines.length - 1) * lay.titleLineH < lay.lowerBarTop, "title stays above the lower header bar");
  assert.ok(lay.headerBottom <= 1080 * 0.16);
  assert.ok(lay.titleLines.length >= 1);
});
t("pacing: demo is ~6 shots in ~48 s plus outro", () => {
  const ep = model.demoEpisode();
  const shots = ep.stories.reduce((a, s) => a + s.camera.filter((k) => k.cut).length, 0);
  assert.equal(shots, 6);
  assert.equal(model.storiesDuration(ep), 48);
  assert.equal(model.totalDuration(ep), 53);
});
t("captions: SRT and VTT round trip", () => {
  const cues = [{ start: 0, end: 1.5, text: "Hello" }, { start: 1.5, end: 3.25, text: "World line" }];
  assert.deepEqual(captions.parse(captions.toSRT(cues)), cues);
  assert.deepEqual(captions.parse(captions.toVTT(cues)), cues);
});
t("captions: auto from script stays inside duration and ≤12 words per cue", () => {
  const c = captions.fromScript("One two three. Four five six seven eight nine ten eleven twelve thirteen fourteen.", 10);
  assert.ok(c.length >= 2 && c[c.length - 1].end <= 10);
  assert.ok(c.every((x) => x.text.split(" ").length <= 12));
});
t("validation rejects non-https sources and bad status", () => {
  const ep = model.blankEpisode();
  ep.stories[0].sources[0].url = "http://example.com"; ep.stories[0].sources[0].status = "maybe";
  assert.equal(model.validate(ep).length, 2);
});
t("citation line format", () => {
  assert.equal(model.citationLine({ type: "File photo", date: "Apr 2026", credit: "Photo: X", license: "Public domain" }), "File photo (Apr 2026) / Photo: X; Public domain");
});
t("9:16 safe zones match header/caption bands", () => { assert.equal(themes.SAFE["9:16"].top, 0.15); assert.equal(themes.SAFE["9:16"].bottom, 0.15); });
t("no secrets / personal data patterns in shipped text files", () => {
  const files = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) { if (![".git", "shots", "vendor", "node_modules"].includes(e.name)) walk(p); } else if (/\.(js|mjs|json|html|css|md)$/.test(e.name)) files.push(p); });
  walk(root);
  const bad = [/sk-[A-Za-z0-9]{20,}/, /xai-[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/, /[A-Za-z0-9._%+-]+@(?:gmail|yahoo|outlook|hotmail)\.com/i, /\/home\/[a-z]+\//, /C:\\\\Users\\\\/];

  for (const f of files) { const s = fs.readFileSync(f, "utf8"); for (const r of bad) assert.ok(!r.test(s), `${path.relative(root, f)} matches ${r}`); }
});

t("v0.4 schema is globedesk.episode/2 and still reads /1", () => {
  assert.equal(model.SCHEMA, "globedesk.episode/2");
  const ep = model.blankEpisode();
  assert.equal(ep.schema, "globedesk.episode/2");
  assert.equal(ep.stories[0].asReported, true);
  assert.deepEqual(model.validate(ep), []);
  const old = model.demoEpisode();
  old.schema = "globedesk.episode/1";
  assert.deepEqual(model.validate(old), []);
  model.normalizeEpisode(old);
  assert.equal(old.schema, "globedesk.episode/2");
  assert.equal(old.sample, true);
});
t("terrain is opt-in (default off)", () => {
  const terr = layers.OVERLAYS.find((o) => o.id === "terrain");
  assert.equal(terr.default, false);
});
t("sanitize escapes HTML and allows only https / allowlisted embeds", () => {
  assert.equal(sanitize.esc('<img src="x" onerror="alert(1)">'), "&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(sanitize.isHttpsUrl("http://example.com"), false);
  assert.equal(sanitize.isHttpsUrl("https://example.com/a"), true);
  assert.ok(sanitize.embedInfo("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
  assert.equal(sanitize.embedSrc("https://youtu.be/dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(sanitize.embedInfo("https://evil.example/embed"), null);
});
t("zip store round-trip", () => {
  const bytes = zip.write([{ name: "project.json", data: '{"ok":true}' }, { name: "media/a/hi.txt", data: "hello" }]);
  const files = zip.read(bytes);
  assert.equal(zip.readText(files, "project.json"), '{"ok":true}');
  assert.equal(new TextDecoder().decode(files["media/a/hi.txt"]), "hello");
});
t("audio overlay timing: offset, window, loop mediaTime", () => {
  const o = { at: 2, offset: 1.5, dur: 4, loop: false };
  assert.equal(audioMix.activeAt(o, 1.9), false);
  assert.equal(audioMix.activeAt(o, 2), true);
  assert.equal(audioMix.activeAt(o, 6), false);
  assert.equal(audioMix.mediaTime(o, 3), 2.5);
  const looped = { at: 0, offset: 0, loop: true, mediaDur: 4 };
  assert.equal(audioMix.mediaTime(looped, 5), 1);
});
t("duplicate story gets new ids", () => {
  const a = model.blankStory(1); a.title = "Alpha";
  const b = model.duplicateStory(a);
  assert.notEqual(a.id, b.id);
  assert.ok(b.title.includes("copy"));
  assert.notEqual(a.cards[0].id, b.cards[0].id);
});
t("content embed requires credit and allowlisted https", () => {
  const ep = model.blankEpisode();
  ep.stories[0].content = [{ id: "ct-1", kind: "embed", embedUrl: "https://example.com/nope", credit: "" }];
  const errs = model.validate(ep);
  assert.ok(errs.some((e) => /embedUrl|credit/.test(e)));
  ep.stories[0].content = [{ id: "ct-1", kind: "embed", embedUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa", credit: "@someone" }];
  assert.deepEqual(model.validate(ep), []);
});
t("truncated header layout still keeps title to the right of the badge", () => {
  const ctx = { font: "", measureText: (t) => ({ width: String(t).length * 8 }) };
  const font = (w, px) => `${w} ${px}px sans-serif`;
  const long = "A very long headline that should wrap and mark truncation when it exceeds two lines of the header band in 16:9";
  const lay = recorder.layoutHeader(1920, 1080, { headerHeightPct: 15 }, 1, ctx, font, "NOW COVERING", long);
  assert.equal(typeof lay.titleFull, "string");
  assert.equal(lay.titleFull, long);
});

t("isHttpsUrl rejects userinfo", () => {
  assert.equal(sanitize.isHttpsUrl("https://user@evil.example/"), false);
  assert.equal(sanitize.isHttpsUrl("https://user:pass@evil.example/x"), false);
  assert.equal(sanitize.isHttpsUrl("https://example.com/ok"), true);
});

t("validation rejects unknown keys, oversize titles, and non-numeric duration", () => {
  const ep = model.blankEpisode();
  assert.deepEqual(model.validate(ep), []);
  ep.notAField = 1;
  assert.ok(model.validate(ep).some((e) => /unknown key/.test(e)));
  const ep2 = model.blankEpisode();
  ep2.stories[0].title = "x".repeat(schema.LIMITS.str.short + 1);
  assert.ok(model.validate(ep2).some((e) => /title|longer/.test(e)));
  const ep3 = model.blankEpisode();
  ep3.stories[0].durationSec = "<img src=x onerror=alert(1)>";
  assert.ok(model.validate(ep3).some((e) => /durationSec/.test(e)));
  const ep4 = model.blankEpisode();
  ep4.stories[0].cards = { title: "nope" };
  assert.ok(model.validate(ep4).some((e) => /cards/.test(e)));
  const ep5 = model.demoEpisode();
  assert.deepEqual(model.validate(ep5), []);
});

t("numeric HTML interpolation is coerced and escaped", () => {
  const payload = "<img src=x onerror=alert(1)>";
  const html = "• " + sanitize.esc(Number(payload)) + "s";
  assert.equal(/<img/.test(html), false);
  assert.equal(html.includes("NaN"), true);
  const h = "Header (top " + sanitize.esc(Number('"><a href="https://evil.example/">')) + "%)";
  assert.equal(/<a /.test(h), false);
});

t("CSP in index.html, serve.py and serve.ps1 is the same policy", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const py = fs.readFileSync(path.join(root, "tools", "serve.py"), "utf8");
  const ps = fs.readFileSync(path.join(root, "tools", "serve.ps1"), "utf8");
  const take = (text, re) => {
    const m = text.match(re);
    if (!m) return "";
    return m[1].replace(/;+\s*$/, "").replace(/\s+/g, " ").trim();
  };
  const h = take(html, /http-equiv="Content-Security-Policy" content="([^"]+)"/);
  const y = take(py, /send_header\("Content-Security-Policy",\s*"([^"]+)"/);
  const w = take(ps, /Headers\.Add\("Content-Security-Policy", "([^"]+)"/);
  assert.ok(h, "index CSP missing");
  assert.equal(h, y);
  assert.equal(h, w);
  assert.ok(h.includes("frame-src https://www.youtube-nocookie.com"));
  assert.equal(/youtube\.com(?!-nocookie)/.test(h), false);
  assert.equal(/api\.x\.ai/.test(h), false);
  assert.equal(/unsafe-inline/.test(h), false);
  assert.ok(h.includes("https://s3.amazonaws.com/elevation-tiles-prod/"));
  assert.equal(/s3\.amazonaws\.com(?!\/elevation-tiles-prod\/)/.test(h), false);
});


console.log(`\n${n} passed`);
