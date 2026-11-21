// Multi-card callouts: scale clamps, collision-free placement, leaders on their own ring,
// clustering with hysteresis, no flicker on small moves. Pure logic; no browser, no network.
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path"; import assert from "node:assert/strict"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, Date, Math }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js", "callouts.js"), "utf8"), ctx);
const C = ctx.window.GD.callouts, K = C.K;
let n = 0; const tests = []; const t = (name, fn) => tests.push({ name, fn });
// Deterministic PRNG for scene fuzzing.
let seed = 1234567; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const near = (a, b, eps) => Math.abs(a - b) <= eps;

t("ring radius: grows with zoom, never below RING_MIN*u or above RING_MAX*u", () => {
  for (const u of [0.5, 1, 1.78]) for (const lat of [0, 31.9, 60, -33.9]) {
    let prev = -1;
    for (let z = 0; z <= 18; z += 0.25) {
      const r = C.ringRadius(z, lat, u, 1);
      assert.ok(r >= K.RING_MIN * u - 1e-9 && r <= K.RING_MAX * u + 1e-9, `z${z} lat${lat} r${r}`);
      assert.ok(r >= prev - 1e-9, "monotonic"); prev = r;
    }
    assert.ok(C.ringRadius(1.5, lat, u, 1) <= K.RING_MAX * u / 4, "a small ring when zoomed out, not a country-sized blob");
    assert.equal(C.ringRadius(12, lat, u, 1), K.RING_MAX * u, "clamped when zoomed in");
  }
  assert.equal(C.clampRadius(1e6, 1), K.RING_MAX); assert.equal(C.clampRadius(0, 1), K.RING_MIN); assert.equal(C.clampRadius(NaN, 1), K.RING_MIN);
});
t("ring stroke, card scale and font: within readable clamps, non-decreasing with zoom", () => {
  let ps = 0, pc = 0;
  for (let z = 0; z <= 18; z += 0.5) {
    const s = C.ringStroke(z, 1), c = C.cardScale(z);
    assert.ok(s >= K.STROKE_MIN && s <= K.STROKE_MAX); assert.ok(c >= K.SCALE_MIN && c <= K.SCALE_MAX);
    assert.ok(s >= ps && c >= pc); ps = s; pc = c;
    for (const u of [0.4, 1]) assert.ok(C.fontPx(14, z, u) >= K.FONT_MIN_PX);
  }
});
t("horizon: full near the view center, fades from FADE_START_DEG, hidden beyond HIDE_DEG", () => {
  assert.equal(C.horizonAlpha(30, 40, 30, 40), 1);
  assert.equal(C.horizonAlpha(0, 0, 0, 70), 1);
  assert.equal(C.horizonAlpha(0, 0, 0, 120), 0);
  const mid = C.horizonAlpha(0, 0, 0, (K.FADE_START_DEG + K.HIDE_DEG) / 2);
  assert.ok(mid > 0.3 && mid < 0.7);
});
t("geometry helpers: rect, circle and segment tests", () => {
  const r = { x: 10, y: 10, w: 20, h: 10 };
  assert.equal(C.rectsHit(r, { x: 31, y: 10, w: 5, h: 5 }, 0), false); assert.equal(C.rectsHit(r, { x: 31, y: 10, w: 5, h: 5 }, 2), true);
  assert.equal(C.circleHitsRect(0, 0, 5, r, 0), false); assert.equal(C.circleHitsRect(5, 15, 6, r, 0), true);
  assert.equal(C.segHitsRect(0, 0, 40, 30, r), true); assert.equal(C.segHitsRect(0, 0, 5, 40, r), false);
  const L = C.leaderFor({ x: 100, y: 0, w: 50, h: 20 }, 0, 10, 8);
  assert.ok(near(Math.hypot(L.x2, L.y2 - 10), 8, 1e-9)); assert.equal(L.x1, 100);
});

function scene(count, W, H, u, spread) {
  const cx = W / 2, cy = H / 2, items = [];
  for (let i = 0; i < count; i++) items.push({ id: "s" + i, ax: cx + (rnd() - 0.5) * spread, ay: cy + (rnd() - 0.5) * spread * 0.6, r: (K.RING_MIN + rnd() * (K.RING_MAX - K.RING_MIN)) * u,
    full: { w: 300 * u, h: (90 + rnd() * 60) * u }, chip: { w: (90 + rnd() * 90) * u, h: 30 * u } });
  return items;
}
function check(res, items, blocked, W, H, u) {
  const pad = K.PAD * u;
  res.placed.forEach((p, i) => {
    const it = items.find((x) => x.id === p.id);
    assert.ok(p.box.x >= 0 && p.box.y >= 0 && p.box.x + p.box.w <= W && p.box.y + p.box.h <= H, "inside the frame");
    blocked.forEach((b) => assert.equal(C.rectsHit(p.box, b, 0), false, "clear of blocked"));
    res.placed.forEach((q, j) => { if (i !== j) assert.equal(C.rectsHit(p.box, q.box, 0), false, "no card overlaps another"); });
    items.forEach((g) => assert.equal(C.circleHitsRect(g.ax, g.ay, g.r, p.box, 0), false, "no card covers a ring (its own included)"));
    assert.ok(near(Math.hypot(p.leader.x2 - it.ax, p.leader.y2 - it.ay), it.r, 1e-6), "leader ends on its own ring");
    res.placed.forEach((q, j) => { if (i !== j) assert.equal(C.segHitsRect(p.leader.x1, p.leader.y1, p.leader.x2, p.leader.y2, q.box), false, "leader crosses no other card"); });
    assert.ok(p.mode === "full" || p.mode === "chip");
  });
  assert.ok(pad > 0);
}
t("placement fuzz: 400 dense scenes (desktop + phone), 0 overlaps, leaders on their own rings", () => {
  for (let k = 0; k < 400; k++) {
    const phone = k % 2 === 1, W = phone ? 780 : 1920, H = phone ? 1300 : 1080, u = Math.min(W, H) / 1080;
    const items = scene(3 + (k % 6), W, H, u, phone ? 300 : 500);
    const blocked = [{ x: 0, y: 0, w: W, h: H * 0.15 }, { x: 0, y: H * 0.85, w: W, h: H * 0.15 }, phone ? { x: 30, y: H * 0.2, w: W - 60, h: 120 } : { x: W - 660, y: 182, w: 620, h: 300 }];
    const res = C.place(items, blocked, W, H, u, new Map(), 0);
    check(res, items, blocked, W, H, u);
    assert.ok(res.placed.length >= 1, "at least the first card gets a spot");
  }
});
t("collapse: when full cards cannot fit, cards become chips instead of overlapping", () => {
  const W = 640, H = 420, u = 0.39;
  const items = [0, 1, 2, 3, 4].map((i) => ({ id: "c" + i, ax: 320 + i * 12, ay: 210 + (i % 2) * 10, r: 6 * u, full: { w: 300, h: 160 }, chip: { w: 80, h: 18 } }));
  const res = C.place(items, [], W, H, u, new Map(), 0);
  check(res, items, [], W, H, u);
  assert.ok(res.placed.some((p) => p.mode === "chip"), "some cards collapse to chips");
});
t("compact mode: entered when full cards would hide one, left only after UPGRADE_MS of room", () => {
  const W = 640, H = 420, u = 0.39;
  const dense = [0, 1, 2, 3, 4].map((i) => ({ id: "c" + i, ax: 320 + i * 12, ay: 210 + (i % 2) * 10, r: 6 * u, full: { w: 300, h: 160 }, chip: { w: 80, h: 18 } }));
  const a = C.place(dense, [], W, H, u, new Map(), 0);
  assert.equal(a.compact, true); assert.equal(a.placed.length, 5, "every card is shown as a chip");
  // Zoom in: the rings spread out and full cards fit again.
  const W2 = 1920, H2 = 1080, u2 = 1;
  const wide = [0, 1].map((i) => ({ id: "c" + i, ax: 500 + i * 900, ay: 540, r: 20, full: { w: 300, h: 120 }, chip: { w: 100, h: 30 } }));
  const b = C.place(wide, [], W2, H2, u2, a.prev, 100);
  assert.equal(b.compact, true, "still compact right after");
  const c = C.place(wide, [], W2, H2, u2, b.prev, 100 + K.UPGRADE_MS);
  assert.equal(c.compact, false); assert.ok(c.placed.every((p) => p.mode === "full"));
});
t("hysteresis: a card keeps its spot on small moves, and chip->full waits UPGRADE_MS", () => {
  const W = 1920, H = 1080, u = 1;
  const items = scene(4, W, H, u, 400);
  const r0 = C.place(items, [], W, H, u, new Map(), 0);
  const moved = items.map((it) => Object.assign({}, it, { ax: it.ax + 3, ay: it.ay - 2 }));
  const r1 = C.place(moved, [], W, H, u, r0.prev, 16);
  r0.placed.forEach((p) => {
    const q = r1.placed.find((x) => x.id === p.id);
    assert.ok(q, p.id); assert.equal(q.mode, p.mode); assert.equal(r1.prev.get(p.id).cand, r0.prev.get(p.id).cand, "same candidate, no jump");
  });
  // A chip whose full card just became possible stays a chip until UPGRADE_MS has passed.
  const one = [{ id: "x", ax: 600, ay: 500, r: 10, full: { w: 300, h: 120 }, chip: { w: 100, h: 30 } }];
  const prev = new Map([["x", { mode: "chip", cand: 0, fullOkSince: null }]]);
  const a = C.place(one, [], W, H, u, prev, 1000); assert.equal(a.placed[0].mode, "chip");
  const b = C.place(one, [], W, H, u, a.prev, 1000 + K.UPGRADE_MS - 1); assert.equal(b.placed[0].mode, "chip");
  const c = C.place(one, [], W, H, u, b.prev, 1000 + K.UPGRADE_MS); assert.equal(c.placed[0].mode, "full");
  // Flicker check: oscillating 1 px back and forth never changes mode or candidate.
  let pv = r0.prev, cand = new Map([...pv].map(([k, v]) => [k, v.cand + v.mode]));
  for (let f = 0; f < 60; f++) {
    const d = f % 2 ? 1 : -1;
    const r = C.place(items.map((it) => Object.assign({}, it, { ax: it.ax + d })), [], W, H, u, pv, f * 16);
    r.placed.forEach((p) => assert.equal(r.prev.get(p.id).cand + p.mode, cand.get(p.id), "stable across frames"));
    pv = r.prev;
  }
});
t("cluster: nearby rings merge into one count badge and split with hysteresis as you zoom in", () => {
  const T = 64;
  const pts = (gap) => [{ id: "a", x: 100, y: 100 }, { id: "b", x: 100 + gap, y: 100 }, { id: "c", x: 100, y: 100 + gap }];
  const z1 = C.cluster(pts(30), T, new Map());
  assert.equal(z1.groups.length, 1); assert.equal(z1.groups[0].members.length, 3);
  const z2 = C.cluster(pts(70), T, z1.map);
  assert.equal(z2.groups.length, 1, "inside the hysteresis band the cluster holds");
  const z3 = C.cluster(pts(70), T, new Map());
  assert.equal(z3.groups.length, 3, "without history the same spacing is split");
  const z4 = C.cluster(pts(T * K.SPLIT_K + 1), T, z2.map);
  assert.equal(z4.groups.length, 3, "beyond the band it splits");
  const z5 = C.cluster(pts(70), T, z4.map);
  assert.equal(z5.groups.length, 3, "and stays split until closer than T again");
});
t("wiring: the painter runs callouts before event labels, the preview blocks the map buttons, the script loads before the recorder", () => {
  const rec = fs.readFileSync(path.join(root, "js/recorder.js"), "utf8"), ui = fs.readFileSync(path.join(root, "js/ui.js"), "utf8"), html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(rec.indexOf("GD.callouts.paint(") > 0 && rec.indexOf("GD.callouts.paint(") < rec.indexOf("paintEventLabels(ctx, W, H, u, proj, font, blocked.concat(calloutBoxes))"));
  assert.match(ui, /uiBoxes/); assert.match(ui, /data-op="pin"/); assert.match(ui, /params\.get\("callouts"\)/);
  assert.ok(html.indexOf('src="js/callouts.js"') > 0 && html.indexOf('src="js/callouts.js"') < html.indexOf('src="js/recorder.js"'));
});

for (const { name, fn } of tests) { await fn(); n++; console.log("ok -", name); }
console.log(`\n${n} passed`);
