/* Multi-card callouts on the globe. Several stories can have a card open on the globe at once.
   Each open card gets a ring at its place, a leader line from the card to that ring, and a
   smart placement that keeps cards off each other, off every ring and off the header,
   captions and docked panels through fluid zoom, rotation and pitch.

   - Ring radius and stroke scale with zoom, clamped (a dot when zoomed out, never a blob).
   - Card size and font scale with zoom within readable limits.
   - When a full card has no free spot it collapses to a compact chip (hover or tap expands it).
   - Nearby rings merge into one count badge at low zoom and split as you zoom in.
   - Leaders are re-routed every frame; card + leader fade near the horizon and hide behind it.
   - No jitter: a card keeps its spot while that spot stays valid (hysteresis), and upgrades
     (chip to full, cluster to split) wait until they have been possible for UPGRADE_MS.

   The geometry is pure and unit-tested (tests/callouts.unit.mjs). Sizes are in 1080p units
   ("u"), so the preview and the 1920x1080 / 1080x1920 recording lay out the same way.
   window.GD.callouts */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});

  const K = {
    RING_KM: 60,            // geographic radius the ring stands for, before clamping
    RING_MIN: 6, RING_MAX: 46,          // ring radius clamp, u
    STROKE_MIN: 1.2, STROKE_MAX: 3.2,   // ring stroke clamp, u
    SCALE_MIN: 0.72, SCALE_MAX: 1,      // card scale clamp
    FONT_MIN_PX: 11,                    // smallest card font in output pixels
    GAPS: [16, 44, 90, 150, 230],                 // card distance from its ring, u
    CLUSTER_PX: 64,                     // merge rings closer than this (u) ...
    SPLIT_K: 1.35,                      // ... and split only beyond CLUSTER_PX * SPLIT_K
    UPGRADE_MS: 220,
    FADE_START_DEG: 78, HIDE_DEG: 88,   // angular distance from the view center
    PAD: 6                              // clearance between any two placed things, u
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Scale (pure) ----------
  // Web-Mercator pixels per km at this zoom and latitude (MapLibre 512 px tiles), in CSS px.
  function pxPerKm(zoom, lat) {
    return (512 * Math.pow(2, zoom)) / (40075.016 * Math.max(0.05, Math.cos((lat || 0) * Math.PI / 180)));
  }
  // Ring radius in output px: geographic size at this zoom, clamped to [RING_MIN, RING_MAX] * u.
  function ringRadius(zoom, lat, u, k) {
    const raw = K.RING_KM * pxPerKm(zoom, lat) * (k || 1);
    return clamp(raw, K.RING_MIN * u, K.RING_MAX * u);
  }
  // Clamp a measured (projected) radius to [RING_MIN, RING_MAX] * u.
  function clampRadius(raw, u) { return clamp(Number.isFinite(raw) ? raw : 0, K.RING_MIN * u, K.RING_MAX * u); }
  function ringStroke(zoom, u) {
    return clamp(K.STROKE_MIN + (zoom - 1) * ((K.STROKE_MAX - K.STROKE_MIN) / 9), K.STROKE_MIN, K.STROKE_MAX) * u;
  }
  function cardScale(zoom) {
    return clamp(K.SCALE_MIN + (zoom - 2) * 0.045, K.SCALE_MIN, K.SCALE_MAX);
  }
  // Font size in output px for a nominal 1080p size, never below FONT_MIN_PX.
  function fontPx(nominal, zoom, u) {
    return Math.max(K.FONT_MIN_PX, nominal * cardScale(zoom) * u);
  }
  // 1 when well inside the visible hemisphere, 0 behind the horizon, linear fade between.
  function angularDeg(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const c = Math.sin(lat1 * r) * Math.sin(lat2 * r) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
    return Math.acos(clamp(c, -1, 1)) / r;
  }
  function horizonAlpha(lat, lon, cLat, cLon) {
    const d = angularDeg(lat, lon, cLat, cLon);
    return clamp((K.HIDE_DEG - d) / (K.HIDE_DEG - K.FADE_START_DEG), 0, 1);
  }

  // ---------- Geometry (pure) ----------
  function rectsHit(a, b, pad) {
    const g = pad || 0;
    return a.x < b.x + b.w + g && b.x < a.x + a.w + g && a.y < b.y + b.h + g && b.y < a.y + a.h + g;
  }
  function nearestOnRect(px, py, r) {
    return [clamp(px, r.x, r.x + r.w), clamp(py, r.y, r.y + r.h)];
  }
  function circleHitsRect(cx, cy, cr, r, pad) {
    const [nx, ny] = nearestOnRect(cx, cy, r);
    return Math.hypot(cx - nx, cy - ny) < cr + (pad || 0);
  }
  // Segment / rectangle intersection (Liang–Barsky).
  function segHitsRect(x1, y1, x2, y2, r) {
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    const p = [-dx, dx, -dy, dy], q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return t1 - t0 > 1e-6;
  }
  // Leader from the box edge nearest the ring center to the point on the ring facing the box.
  function leaderFor(box, ax, ay, r) {
    const [bx, by] = nearestOnRect(ax, ay, box);
    const d = Math.hypot(bx - ax, by - ay) || 1;
    return { x1: bx, y1: by, x2: ax + (bx - ax) / d * r, y2: ay + (by - ay) / d * r };
  }
  // Candidate spots around a ring: 8 directions x 3 distances.
  function candidates(it, w, h, u) {
    const out = [];
    K.GAPS.forEach((g0) => {
      const g = it.r + g0 * u, d = g * 0.7071;
      [
        [it.ax + d, it.ay - d - h], [it.ax - d - w, it.ay - d - h], [it.ax + d, it.ay + d], [it.ax - d - w, it.ay + d],
        [it.ax + g, it.ay - h / 2], [it.ax - g - w, it.ay - h / 2], [it.ax - w / 2, it.ay - g - h], [it.ax - w / 2, it.ay + g]
      ].forEach(([x, y]) => out.push({ x, y, w, h }));
    });
    return out;
  }

  // Greedy placement with hysteresis. items: [{id, ax, ay, r, full:{w,h}, chip:{w,h}}] in priority
  // order. blocked: rects. prev: Map id -> {mode, cand, fullOkSince}. now: ms.
  // Returns {placed:[{id, mode, box, leader}], prev}. Every returned box is inside the canvas and
  // clear of every other box, every ring and every blocked rect; every leader ends on its own
  // ring and crosses no other box.
  // Two strategies, both greedy and collision-free by construction:
  //   "full":    every card tries its full size first, then a chip.
  //   "compact": every card starts as a chip; chips upgrade to full only where that still fits.
  // "full" is used while it places every card. When it would hide one, "compact" takes over
  // if it places more. Going back to "full" waits UPGRADE_MS so a zoom wobble cannot flicker.
  function place(items, blocked, W, H, u, prev, now) {
    const pad = K.PAD * u, edge = 4 * u;
    const rings = items.map((it) => ({ id: it.id, x: it.ax, y: it.ay, r: it.r }));
    const P = prev || new Map();
    const meta = P.get("__mode") || { compact: false, since: null };
    const fits = (it, box, placed) => {
      if (box.x < edge || box.y < edge || box.x + box.w > W - edge || box.y + box.h > H - edge) return null;
      if (blocked.some((b) => rectsHit(box, b, pad))) return null;
      if (placed.some((p) => p.id !== it.id && rectsHit(box, p.box, pad))) return null;
      if (rings.some((g) => circleHitsRect(g.x, g.y, g.r, box, pad))) return null;
      const L = leaderFor(box, it.ax, it.ay, it.r);
      if (placed.some((p) => p.id !== it.id && segHitsRect(L.x1, L.y1, L.x2, L.y2, p.box))) return null;
      if (placed.some((p) => p.id !== it.id && segHitsRect(p.leader.x1, p.leader.y1, p.leader.x2, p.leader.y2, box))) return null;
      return L;
    };
    const tryMode = (it, size, first, placed) => {
      if (!size) return null;
      const cs = candidates(it, size.w, size.h, u);
      const order = first != null && first >= 0 && first < cs.length ? [first].concat(cs.map((_, i) => i).filter((i) => i !== first)) : cs.map((_, i) => i);
      for (const i of order) { const L = fits(it, cs[i], placed); if (L) return { cand: i, box: cs[i], leader: L }; }
      return null;
    };
    const run = (compact) => {
      const placed = [], next = new Map();
      items.forEach((it) => {
        const p = P.get(it.id) || { mode: "full", cand: -1, fullOkSince: null };
        let res = null, mode = "hidden", fullOkSince = null;
        if (!compact) {
          const full = tryMode(it, it.full, p.mode === "full" ? p.cand : -1, placed);
          if (full) fullOkSince = p.fullOkSince != null ? p.fullOkSince : now;
          const ready = p.mode === "full" || (fullOkSince != null && now - fullOkSince >= K.UPGRADE_MS);
          if (full && ready) { res = full; mode = "full"; }
        }
        if (!res) { const chip = tryMode(it, it.chip, p.mode === "chip" ? p.cand : -1, placed); if (chip) { res = chip; mode = "chip"; } }
        next.set(it.id, { mode, cand: res ? res.cand : -1, fullOkSince });
        if (res) placed.push({ id: it.id, mode, box: res.box, leader: res.leader });
      });
      if (compact) {
        // Upgrade chips in place where a full card still fits around everyone else (debounced).
        placed.forEach((q, idx) => {
          const it = items.find((x) => x.id === q.id), p = P.get(q.id) || {};
          const full = tryMode(it, it.full, p.mode === "full" ? p.cand : -1, placed);
          const n = next.get(q.id);
          if (!full) { n.fullOkSince = null; return; }
          n.fullOkSince = p.fullOkSince != null ? p.fullOkSince : now;
          if (p.mode === "full" || now - n.fullOkSince >= K.UPGRADE_MS) { placed[idx] = { id: q.id, mode: "full", box: full.box, leader: full.leader }; n.mode = "full"; n.cand = full.cand; }
        });
      }
      return { placed, next };
    };
    const A = run(false);
    let use = A, compact = false, since = null;
    if (A.placed.length < items.length || meta.compact) {
      const B = run(true);
      if (meta.compact) {
        // Leave compact only after "full" has placed everything for UPGRADE_MS.
        const allFit = A.placed.length === items.length && A.placed.length >= B.placed.length;
        since = allFit ? (meta.since != null ? meta.since : now) : null;
        if (allFit && now - since >= K.UPGRADE_MS) { use = A; compact = false; since = null; } else { use = B; compact = true; }
      } else if (B.placed.length > A.placed.length) { use = B; compact = true; }
    }
    use.next.set("__mode", { compact, since });
    return { placed: use.placed, prev: use.next, compact };
  }

  // Screen-space clustering with hysteresis. pts: [{id, x, y}]. prevGroup: Map id -> group key.
  // Two points join when closer than T, or closer than T * SPLIT_K if they were together before.
  function cluster(pts, T, prevGroup) {
    const parent = pts.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      const was = prevGroup && prevGroup.get(pts[i].id) != null && prevGroup.get(pts[i].id) === prevGroup.get(pts[j].id);
      if (d < T || (was && d < T * K.SPLIT_K)) parent[find(i)] = find(j);
    }
    const groups = new Map();
    pts.forEach((p, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(p); });
    const out = [...groups.values()].map((m) => ({ key: m.map((p) => p.id).sort().join("+"), members: m }));
    const map = new Map(); out.forEach((g) => g.members.forEach((p) => map.set(p.id, g.key)));
    return { groups: out, map };
  }

  // ---------- State ----------
  const S = { open: [], hover: null, expanded: null, prevPlace: new Map(), prevGroup: new Map(), last: null };
  function storyById(id) { const ep = GD.state && GD.state.episode; return ep ? ep.stories.find((s) => s.id === id) : null; }
  function changedView() { try { if (GD.globe && GD.globe.st.map) GD.globe.st.map.triggerRepaint(); } catch (e) { /* ignore */ } }
  function isOpen(id) { return S.open.includes(id); }
  function open(id) { if (id && !isOpen(id)) S.open.push(id); changedView(); }
  function close(id) { S.open = S.open.filter((x) => x !== id); S.prevPlace.delete(id); changedView(); }
  function toggle(id) { isOpen(id) ? close(id) : open(id); return isOpen(id); }
  function clear() { S.open = []; S.prevPlace = new Map(); S.prevGroup = new Map(); changedView(); }
  function openSlugs(slugs) {
    const ep = GD.state && GD.state.episode; if (!ep) return 0;
    (slugs || []).forEach((sl) => { const s = ep.stories.find((x) => x.slug === sl); if (s) open(s.id); });
    return S.open.length;
  }

  // ---------- Painter ----------
  function wrapText(ctx, text, maxW, maxLines) {
    const words = String(text || "").split(/\s+/).filter(Boolean), lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; if (lines.length === maxLines) break; } else line = t;
    }
    if (line && lines.length < maxLines) lines.push(line);
    const used = lines.join(" ").split(/\s+/).length;
    if (used < words.length && lines.length) {
      let l = lines[lines.length - 1];
      while (l && ctx.measureText(l + "…").width > maxW) l = l.slice(0, -1);
      lines[lines.length - 1] = l + "…";
    }
    return lines;
  }

  // Lays out and paints the open callouts. Returns the boxes it used so later layers avoid them.
  function paint(ctx, W, H, u, proj, blocked, opts) {
    S.last = { W, H, u, items: [], rings: [], clamps: { min: K.RING_MIN * u, max: K.RING_MAX * u } };
    if (!proj || !S.open.length || !GD.globe || !GD.globe.st.map) return [];
    const map = GD.globe.st.map, z = map.getZoom(), c = map.getCenter();
    const k = (opts && opts.k) || 1;
    const now = (opts && opts.now) || (typeof performance !== "undefined" ? performance.now() : Date.now());
    const P = (GD.state.episode.look && GD.state.episode.look.palette) || {};
    const accent = P.highlight || "#d6f25c";
    const fontF = (wt, px) => `${wt} ${px}px Inter, "Helvetica Neue", Arial, sans-serif`;
    const sc = cardScale(z);
    // Visible anchors.
    const pts = [];
    S.open.forEach((id) => {
      const s = storyById(id);
      if (!s || !s.location || s.location.lat == null) return;
      const a = horizonAlpha(s.location.lat, s.location.lon, c.lat, c.lng);
      if (a <= 0) return;
      const xy = proj([s.location.lon, s.location.lat]); if (!xy) return;
      const [x, y] = xy;
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) return;
      // True on-screen size of RING_KM at this zoom, pitch and globe curvature, then clamped.
      const lat = s.location.lat, lon = s.location.lon;
      const e = proj([lon + K.RING_KM / (111.32 * Math.max(0.05, Math.cos(lat * Math.PI / 180))), lat]);
      const r = e ? clampRadius(Math.hypot(e[0] - x, e[1] - y), u) : ringRadius(z, lat, u, k);
      pts.push({ id, s, x, y, a, r });
    });
    const cl = cluster(pts, K.CLUSTER_PX * u, S.prevGroup);
    S.prevGroup = cl.map;
    // One item per group (a single story or a cluster badge).
    const titleF = fontPx(22, z, u), bodyF = fontPx(17, z, u), metaF = fontPx(14, z, u);
    const items = cl.groups.map((g) => {
      const m = g.members;
      const ax = m.reduce((t, p) => t + p.x, 0) / m.length, ay = m.reduce((t, p) => t + p.y, 0) / m.length;
      const a = Math.max(...m.map((p) => p.a));
      const spread = Math.max(0, ...m.map((p) => Math.hypot(p.x - ax, p.y - ay)));
      const r = m.length > 1 ? clamp(Math.max(...m.map((p) => p.r)) + spread * 0.5, K.RING_MIN * u, K.RING_MAX * u) : m[0].r;
      const cardW = 300 * sc * u, padX = 12 * sc * u;
      let lines, title, meta;
      if (m.length > 1) {
        title = `${m.length} stories`;
        ctx.font = fontF(500, bodyF);
        lines = m.slice(0, 4).map((p) => wrapText(ctx, p.s.title, cardW - 2 * padX, 1)[0] || "");
        if (m.length > 4) lines.push(`+${m.length - 4} more`);
        meta = "Zoom in to split";
      } else {
        const s = m[0].s, card = (s.cards || [])[0];
        title = s.title; meta = (s.credit || (s.sources && s.sources[0] && s.sources[0].label) || "") + (s.asReported !== false ? " · as reported" : "");
        ctx.font = fontF(400, bodyF);
        lines = card && card.body ? wrapText(ctx, card.body, cardW - 2 * padX, 3) : [];
      }
      ctx.font = fontF(700, titleF);
      const tLines = wrapText(ctx, title, cardW - 2 * padX, 2);
      const fullH = padX + tLines.length * titleF * 1.2 + lines.length * bodyF * 1.3 + metaF * 1.4 + padX;
      const chipTitle = m.length > 1 ? `● ${m.length} stories` : (wrapText(ctx, title, 190 * sc * u, 1)[0] || "");
      ctx.font = fontF(700, metaF + 1);
      const chipW = Math.min(cardW, ctx.measureText(chipTitle).width + 2 * padX);
      return { id: g.key, members: m, ax, ay, r, a, title, tLines, lines, meta, chipTitle, padX,
        full: { w: cardW, h: fullH }, chip: { w: chipW, h: (metaF + 1) * 1.25 + padX } };
    });
    // Stable priority: the active story first, then the order cards were opened.
    const cur = GD.state.episode.stories[GD.state.storyIdx];
    const rank = (it) => (it.members.some((p) => cur && p.id === cur.id) ? -1 : Math.min(...it.members.map((p) => S.open.indexOf(p.id))));
    items.sort((a, b) => rank(a) - rank(b));
    const res = place(items, blocked || [], W, H, u, S.prevPlace, now);
    S.prevPlace = res.prev;
    const byId = new Map(res.placed.map((p) => [p.id, p]));
    // Paint: rings, leaders, cards.
    items.forEach((it) => {
      ctx.globalAlpha = it.a;
      ctx.strokeStyle = accent; ctx.lineWidth = ringStroke(z, u);
      ctx.beginPath(); ctx.arc(it.ax, it.ay, it.r, 0, Math.PI * 2); ctx.stroke();
      if (it.members.length > 1) {
        const br = Math.max(9 * u, it.r * 0.55);
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(it.ax, it.ay, br, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#07140c"; ctx.font = fontF(800, Math.max(K.FONT_MIN_PX, br * 1.1)); ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(it.members.length), it.ax, it.ay + 0.5); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      } else {
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(it.ax, it.ay, Math.max(2, 3 * u), 0, Math.PI * 2); ctx.fill();
      }
    });
    const drawCard = (it, p, expanded) => {
      const b = p.box, mode = expanded ? "full" : p.mode;
      ctx.globalAlpha = it.a;
      ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1, 1.6 * u);
      ctx.beginPath(); ctx.moveTo(p.leader.x1, p.leader.y1); ctx.lineTo(p.leader.x2, p.leader.y2); ctx.stroke();
      let bx = b.x, by = b.y, bw = b.w, bh = b.h;
      if (expanded) { bw = it.full.w; bh = it.full.h; bx = clamp(b.x, 4 * u, W - bw - 4 * u); by = clamp(b.y, 4 * u, H - bh - 4 * u); }
      ctx.fillStyle = "rgba(10,14,12,0.9)";
      const rr = 8 * u;
      ctx.beginPath(); ctx.moveTo(bx + rr, by); ctx.arcTo(bx + bw, by, bx + bw, by + bh, rr); ctx.arcTo(bx + bw, by + bh, bx, by + bh, rr); ctx.arcTo(bx, by + bh, bx, by, rr); ctx.arcTo(bx, by, bx + bw, by, rr); ctx.closePath(); ctx.fill();
      ctx.fillStyle = accent; ctx.fillRect(bx, by, 3 * u, bh);
      if (mode === "chip") {
        ctx.fillStyle = "#fff"; ctx.font = fontF(700, metaF + 1); ctx.fillText(it.chipTitle, bx + it.padX, by + bh / 2 + (metaF + 1) * 0.36);
      } else {
        let y = by + it.padX;
        ctx.fillStyle = "#fff"; ctx.font = fontF(700, titleF);
        it.tLines.forEach((l) => { y += titleF * 1.05; ctx.fillText(l, bx + it.padX, y); y += titleF * 0.15; });
        ctx.fillStyle = "#e4e4e4"; ctx.font = fontF(it.members.length > 1 ? 500 : 400, bodyF);
        it.lines.forEach((l) => { y += bodyF * 1.15; ctx.fillText(l, bx + it.padX, y); y += bodyF * 0.15; });
        ctx.fillStyle = "#ffd166"; ctx.font = fontF(600, metaF); y += metaF * 1.25;
        ctx.fillText(wrapText(ctx, it.meta, bw - 2 * it.padX, 1)[0] || "", bx + it.padX, y);
      }
    };
    items.forEach((it) => { const p = byId.get(it.id); if (p && !(S.expanded === it.id || S.hover === it.id)) drawCard(it, p, false); });
    // A hovered or tapped chip expands on top (a deliberate, temporary overlap).
    items.forEach((it) => { const p = byId.get(it.id); if (p && (S.expanded === it.id || S.hover === it.id)) drawCard(it, p, p.mode === "chip"); });
    ctx.globalAlpha = 1;
    S.last.items = items.map((it) => {
      const p = byId.get(it.id);
      return { id: it.id, ids: it.members.map((m) => m.id), slugs: it.members.map((m) => m.s.slug), count: it.members.length, alpha: it.a,
        ring: { x: it.ax, y: it.ay, r: it.r }, mode: p ? p.mode : "hidden", box: p ? p.box : null, leader: p ? p.leader : null };
    });
    S.last.zoom = z; S.last.blocked = (blocked || []).slice();
    // Cards and rings are both returned so later labels (event labels) keep clear of them.
    return res.placed.map((p) => p.box).concat(items.map((it) => ({ x: it.ax - it.r, y: it.ay - it.r, w: 2 * it.r, h: 2 * it.r })));
  }

  // Leaving a callout clears the hover even when the hit buttons were rebuilt under the pointer.
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("pointermove", (e) => { if (S.hover && !(e.target && e.target.closest && e.target.closest(".gd-hit-callout"))) setHover(null); }, { passive: true });
  }
  // Click / hover targets for the DOM preview (see ui.syncHits).
  function hits() { return (S.last && S.last.items || []).filter((i) => i.box); }
  function setHover(id) { if (S.hover !== id) { S.hover = id; changedView(); } }
  function tap(id) {
    const it = hits().find((h) => h.id === id); if (!it) return;
    if (it.mode === "chip") { S.expanded = S.expanded === id ? null : id; changedView(); return; }
    const ep = GD.state.episode, i = ep.stories.findIndex((s) => s.id === it.ids[0]);
    if (it.count === 1 && i >= 0 && GD.ui) GD.ui.selectStory(i, { fly: true });
  }

  GD.callouts = { K, pxPerKm, ringRadius, clampRadius, ringStroke, cardScale, fontPx, angularDeg, horizonAlpha,
    rectsHit, circleHitsRect, segHitsRect, leaderFor, candidates, place, cluster,
    open, close, toggle, clear, isOpen, openSlugs, paint, hits, setHover, tap, state: S, last: () => S.last };
})();
