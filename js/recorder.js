/* Recorder: composites the globe canvas + overlays into an output canvas at 1920x1080 (16:9)
   or 1080x1920 (9:16), captures it with captureStream + MediaRecorder, mixes dropped-in audio,
   and downloads a local WebM. Nothing is uploaded. window.GD.recorder */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const SIZES = { "16:9": [1920, 1080], "9:16": [1080, 1920] };
  const rec = { mr: null, chunks: [], raf: 0, canvas: null, ctx: null, audioCtx: null, dest: null, sources: new WeakMap() };

  function supported() {
    return typeof MediaRecorder !== "undefined" && !!HTMLCanvasElement.prototype.captureStream;
  }

  function mime(withAudio) {
    const c = withAudio ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"] : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    return c.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
  }

  // Route an <audio>/<video> element into the recording mix (and still to the speakers).
  function connectMedia(el) {
    if (!rec.audioCtx || !el || rec.sources.has(el)) return;
    try {
      const src = rec.audioCtx.createMediaElementSource(el);
      src.connect(rec.dest);
      src.connect(rec.audioCtx.destination);
      rec.sources.set(el, src);
    } catch (e) { console.warn("audio route failed", e && e.message); }
  }

  function wrap(ctx, text, maxW) {
    const words = String(text || "").split(/\s+/), lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // Paints the theme overlays for the current playback state. Shared shape with the DOM preview.
  // proj(lngLat) -> [x, y] in this canvas's pixels, or null (off-screen / far side of the globe).
  // Greedy label placement: each label tries four spots around its anchor and is kept only
  // where it overlaps no earlier label and no blocked box (header, captions, cards, citations).
  // Items earlier in the list win, so the active story's label goes first. Pure; unit-tested.
  function placeLabels(items, blocked, W, H, pad) {
    const g = pad || 4;
    const hit = (a, b) => a.x < b.x + b.w + g && b.x < a.x + a.w + g && a.y < b.y + b.h + g && b.y < a.y + a.h + g;
    const placed = [];
    items.forEach((it) => {
      const off = it.off || 12;
      const cands = [
        { x: it.ax + off, y: it.ay - it.h - off },
        { x: it.ax - it.w - off, y: it.ay - it.h - off },
        { x: it.ax + off, y: it.ay + off },
        { x: it.ax - it.w - off, y: it.ay + off }
      ];
      for (const c of cands) {
        const r = { x: c.x, y: c.y, w: it.w, h: it.h };
        if (r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > H) continue;
        if (blocked.some((b) => hit(r, b)) || placed.some((p) => hit(r, p.box))) continue;
        placed.push({ item: it, box: r });
        return;
      }
    });
    return placed;
  }

  function paintEventLabels(ctx, W, H, u, proj, font, blocked) {
    if (!proj || !GD.eventsMap) return;
    const map = GD.globe.st.map, z = map.getZoom(), c = map.getCenter();
    let bounds = null; try { bounds = map.getBounds(); } catch (e) { bounds = null; }
    const S = GD.state, cur = S.episode && S.episode.stories[S.storyIdx];
    const items = [];
    GD.eventsMap.labels().forEach((lb) => {
      if (!lb.lngLat) return;
      if (z < 5 && GD.globe.haversine(c.lat, c.lng, lb.lngLat[1], lb.lngLat[0]) > 7000) return; // hidden behind the globe
      if (z >= 3 && bounds && !bounds.contains(lb.lngLat)) return; // far side of the globe can still project on-screen when zoomed in
      const xy = proj(lb.lngLat); if (!xy) return;
      const [x, y] = xy; if (x < 0 || y < 0 || x > W || y > H) return;
      const tag = lb.verification === "verified" ? "VERIFIED" : lb.verification === "disputed" ? "DISPUTED" : "NOT VERIFIED";
      ctx.font = font(700, 22);
      const t1 = `${lb.icon} ${lb.title}`.slice(0, 60), w1 = ctx.measureText(t1).width;
      ctx.font = font(500, 17);
      const t2 = `${lb.time} • ${tag}${lb.example ? " • EXAMPLE" : ""}`, w2 = ctx.measureText(t2).width;
      items.push({ lb, t1, t2, ax: x, ay: y, w: Math.max(w1, w2) + 24 * u, h: 58 * u, off: 12 * u, active: !!(cur && lb.storyId === cur.id) });
    });
    items.sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));
    placeLabels(items, blocked || [], W, H, 4 * u).forEach(({ item, box }) => {
      const lb = item.lb, { x: bx, y: by, w: bw, h: bh } = box;
      ctx.strokeStyle = lb.color; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(item.ax, item.ay);
      ctx.lineTo(bx < item.ax ? bx + bw : bx, by < item.ay ? by + bh : by); ctx.stroke();
      ctx.fillStyle = "rgba(12,12,14,0.78)"; roundRect(ctx, bx, by, bw, bh, 6 * u); ctx.fill();
      ctx.fillStyle = lb.color; ctx.fillRect(bx, by, 4 * u, bh);
      ctx.fillStyle = "#fff"; ctx.font = font(700, 22); ctx.fillText(item.t1, bx + 12 * u, by + 25 * u);
      ctx.fillStyle = lb.verification === "verified" ? "#6ee7a8" : "#ffd166"; ctx.font = font(500, 17); ctx.fillText(item.t2, bx + 12 * u, by + 48 * u);
    });
    rec.labelsPlaced = items.length;
  }

  // Card boxes for the active cards (shared by the label blocker and the painter).
  function cardBoxes(ctx, W, H, u, font, cards, headerBottom, reserveRight) {
    return cards.map((c, i) => {
      const cw = W > H ? Math.min(620 * u, W * 0.34) : W - 96 * u;
      const right = W > H ? Math.max(48 * u, reserveRight || 0) : 48 * u;
      const x = W > H ? W - cw - right : 48 * u, y = Math.max(headerBottom + 20 * u, 120 * u) + (W > H ? 0 : 150 * u) + i * 300 * u;
      ctx.font = font(400, 24);
      const lines = wrap(ctx, c.body, cw - 48 * u).slice(0, 5);
      const ch = (110 + lines.length * 32) * u;
      return { c, x, y, w: cw, h: ch, lines };
    });
  }

  // Citation boxes, top-left under the header.
  function citationBoxes(ctx, W, u, font, citations, headerBottom) {
    let y = headerBottom + 16 * u;
    return citations.filter((c) => c && String(c).trim()).map((c) => {
      ctx.font = font(500, 20);
      const all = wrap(ctx, c, Math.min(W * 0.52, 640 * u));
      const lines = all.slice(0, 3);
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28 * u, h = lines.length * 26 * u + 18 * u;
      const box = { c, all, lines, x: 28 * u, y, w, h };
      y += h + 10 * u;
      return box;
    });
  }

  // Title starts to the right of the "NOW COVERING" badge, inside the header band only.
  // Returned box is used by paintOverlays (and unit-tested) so citations never cover the headline.
  function layoutHeader(W, H, L, u, ctx, font, badge, title) {
    const hh = H * (L.headerHeightPct || 15) / 100;
    const badgeX = 36 * u, badgeY = hh * 0.10, badgeH = 40 * u;
    ctx.font = font(800, 26);
    const badgeW = ctx.measureText(badge).width + 36 * u;
    const titleX = badgeX + badgeW + 14 * u;
    const titleMaxW = Math.max(80 * u, W - titleX - 36 * u);
    const titleSize = titleMaxW < 420 * u ? 32 : 40;
    ctx.font = font(800, titleSize);
    const titleAll = wrap(ctx, title || "", titleMaxW);
    const titleLines = titleAll.slice(0, 2);
    const titleTruncated = titleAll.length > 2;
    const titleLineH = (titleSize + 6) * u;
    const lowerBarTop = hh * 0.68;
    // Vertically center the title block with the badge, but keep it above the lower bar.
    let titleY0 = badgeY + 29 * u;
    if (titleLines.length > 1) {
      titleY0 = Math.min(badgeY + 22 * u, lowerBarTop - 8 * u - titleLineH);
    }
    return { hh, badge, badgeX, badgeY, badgeW, badgeH, titleX, titleMaxW, titleSize, titleLines, titleY0, titleLineH, lowerBarTop, headerBottom: hh, titleFull: title || "", titleTruncated };
  }

  // Dark ink on light accents, white on dark accents (badge text contrast).
  function badgeInk(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return "#fff";
    const n = parseInt(m[1], 16), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    const Lm = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    return (1.05 / (Lm + 0.05)) >= 4.5 ? "#fff" : "#07140c";
  }

  function paintOverlays(ctx, W, H, proj, opts) {
    opts = opts || {};
    const S = GD.state, ep = S.episode, story = ep.stories[S.storyIdx], L = ep.look || {}, P = L.palette || {};
    const u = Math.min(W, H) / 1080;
    const font = (w, px) => `${w} ${px * u}px Inter, "Helvetica Neue", Arial, sans-serif`;
    rec.hits = { title: null, citations: [] };
    if (S.ov.outro) {
      const o = ep.outro;
      ctx.fillStyle = P.outroBg || "#0b1530"; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center"; ctx.fillStyle = "#fff";
      ctx.font = font(800, 64); wrap(ctx, o.line1, W - 160 * u).forEach((l, k) => ctx.fillText(l, W / 2, H * 0.42 + k * 76 * u));
      ctx.font = font(500, 36); ctx.fillStyle = "#cfd6e4"; ctx.fillText(o.link, W / 2, H * 0.55);
      ctx.font = font(800, 44); ctx.fillStyle = "#fff"; ctx.fillText(`${o.showXLogo ? "𝕏  " : ""}${o.handle}`, W / 2, H * 0.63);
      ctx.textAlign = "left";
      return;
    }
    const headerOn = !!(L.header && story);
    const hhPre = headerOn ? H * (L.headerHeightPct || 15) / 100 : 0;
    const cits = L.citations !== false && S.ov.citations ? citationBoxes(ctx, W, u, font, S.ov.citations, hhPre) : [];
    const cards = cardBoxes(ctx, W, H, u, font, S.ov.cards || [], hhPre, opts.reserveRight || 0);
    const zone = H * (L.captionZonePct || 15) / 100;
    const blocked = [{ x: 0, y: 0, w: W, h: hhPre }, { x: 0, y: H - zone, w: W, h: zone }]
      .concat(cits.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })), cards.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })));
    // Multi-card callouts go first (they win over event labels), then event labels avoid them.
    if (opts.uiBoxes) opts.uiBoxes.forEach((b) => blocked.push(b));
    const calloutBoxes = GD.callouts ? GD.callouts.paint(ctx, W, H, u, proj, blocked) : [];
    paintEventLabels(ctx, W, H, u, proj, font, blocked.concat(calloutBoxes));
    // Header layout: title sits to the right of the badge so a left-side citation box
    // cannot clip the first letters. Citations always start below the header band.
    let headerBottom = 0;
    if (headerOn) {
      const lay = layoutHeader(W, H, L, u, ctx, font, L.headerBadge || "FROGPOST", story.title);
      headerBottom = lay.hh;
      ctx.fillStyle = "rgba(12,12,14,0.86)"; ctx.fillRect(0, 0, W, lay.lowerBarTop);
      ctx.fillStyle = "rgba(40,41,44,0.92)"; ctx.fillRect(0, lay.lowerBarTop, W, lay.hh - lay.lowerBarTop);
      ctx.fillStyle = P.accent || "#3dbe6a"; roundRect(ctx, lay.badgeX, lay.badgeY, lay.badgeW, lay.badgeH, 6 * u); ctx.fill();
      ctx.fillStyle = badgeInk(P.accent || "#3dbe6a"); ctx.font = font(800, 26); ctx.fillText(lay.badge, lay.badgeX + 18 * u, lay.badgeY + 29 * u);
      ctx.font = font(800, lay.titleSize); ctx.fillStyle = "#fff";
      lay.titleLines.forEach((l, k) => ctx.fillText(l, lay.titleX, lay.titleY0 + k * lay.titleLineH));
      rec.hits = rec.hits || { title: null, citations: [] };
      rec.hits.title = { full: story.title || "", truncated: !!lay.titleTruncated, x: lay.titleX, y: lay.titleY0 - 32 * u, w: lay.titleMaxW, h: lay.titleLines.length * lay.titleLineH + 16 * u };
      ctx.font = font(600, 24); ctx.fillStyle = "#e6e6e6";
      const lead = `${ep.show}   •   ${ep.date}   •   `, by = lay.lowerBarTop + (lay.hh - lay.lowerBarTop) * 0.68;
      ctx.fillText(lead + (ep.handle || ""), 36 * u, by);
      if (ep.handle) {
        const hx = 36 * u + ctx.measureText(lead).width, hw = ctx.measureText(ep.handle).width;
        rec.hits.handle = { text: ep.handle, x: hx, y: lay.lowerBarTop, w: hw, h: lay.hh - lay.lowerBarTop };
      }
    }
    if (cits.length) {
      rec.hits = rec.hits || { title: null, citations: [] };
      rec.hits.citations = [];
      cits.forEach((b) => {
        ctx.font = font(500, 20);
        ctx.fillStyle = P.panel || "rgba(70,72,76,0.62)"; roundRect(ctx, b.x, b.y, b.w, b.h, 6 * u); ctx.fill();
        ctx.fillStyle = "#f2f2f2"; b.lines.forEach((l, k) => ctx.fillText(l, 42 * u, b.y + (30 + k * 26) * u));
        rec.hits.citations.push({ full: b.c, truncated: b.all.length > 3, x: b.x, y: b.y, w: b.w, h: b.h });
      });
    }
    if (L.lowerThird && story) {
      const y0 = H - (S.ov.captions.length ? 360 : 220) * u;
      ctx.fillStyle = "rgba(5,14,30,0.82)"; roundRect(ctx, 48 * u, y0, W - 96 * u, 120 * u, 14 * u); ctx.fill();
      ctx.fillStyle = P.accent || "#ff3b5c"; ctx.fillRect(48 * u, y0, 10 * u, 120 * u);
      ctx.fillStyle = "#9fc3ff"; ctx.font = font(600, 24); ctx.fillText(`${ep.show}  •  ${S.storyIdx + 1}/${ep.stories.length}`, 76 * u, y0 + 38 * u);
      ctx.fillStyle = "#fff"; ctx.font = font(700, 38); ctx.fillText(wrap(ctx, story.title, W - 160 * u)[0] || "", 76 * u, y0 + 90 * u);
    }
    cards.forEach(({ c, x, y, w: cw, h: ch, lines }) => {
      ctx.fillStyle = "rgba(14,15,17,0.84)"; roundRect(ctx, x, y, cw, ch, 12 * u); ctx.fill();
      ctx.fillStyle = P.accent || "#3dbe6a"; ctx.fillRect(x, y, 6 * u, ch);
      ctx.fillStyle = c.verified ? "#6ee7a8" : "#ffd166"; ctx.font = font(700, 18); ctx.fillText(c.verified ? "VERIFIED" : "UNVERIFIED", x + 24 * u, y + 34 * u);
      ctx.fillStyle = "#fff"; ctx.font = font(700, 30); ctx.fillText(wrap(ctx, c.title, cw - 48 * u)[0] || "", x + 24 * u, y + 74 * u);
      ctx.fillStyle = "#e4e4e4"; ctx.font = font(400, 24); lines.forEach((l, k) => ctx.fillText(l, x + 24 * u, y + (112 + k * 32) * u));
    });
    rec.cardBoxes = cards.map(({ x, y, w, h }) => ({ x, y, w, h }));
    if (L.captionsOn !== false && S.ov.captions.length) {
      const size = { small: 40, medium: 50, large: 60 }[L.captionSize] || 60;
      ctx.font = font(800, size);
      const lines = wrap(ctx, S.ov.captions.join(" "), W - 140 * u).slice(0, L.captionLines || 2);
      const lh = size * 1.18 * u, zone = H * (L.captionZonePct || 15) / 100;
      const top = H - zone + (zone - lines.length * lh) / 2;
      ctx.textAlign = "center";
      if (L.captionStyle === "box") {
        ctx.fillStyle = "rgba(0,0,0,0.78)"; roundRect(ctx, 70 * u, top - 10 * u, W - 140 * u, lines.length * lh + 20 * u, 12 * u); ctx.fill();
      } else { ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 10 * u; ctx.shadowOffsetY = 3 * u; }
      ctx.fillStyle = "#fff";
      lines.forEach((l, k) => ctx.fillText(l, W / 2, top + (k + 0.82) * lh));
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.textAlign = "left";
    }
    if (ep.demo || ep.sample) {
      ctx.fillStyle = "rgba(255,209,102,0.95)"; ctx.font = font(700, 18);
      ctx.fillText("SAMPLE • LOCATIONS APPROXIMATE • NOT VERIFIED", 28 * u, H - (H * (L.captionZonePct || 15) / 100) - 14 * u);
    }
  }

  // Draw one output frame from the live map canvas and the current overlay state.
  function drawFrame() {
    const { canvas: out, ctx } = rec;
    const W = out.width, H = out.height;
    const src = GD.globe.st.map.getCanvas();
    const sr = src.width / src.height, dr = W / H;
    let sw = src.width, sh = src.height, sx = 0, sy = 0;
    if (sr > dr) { sw = sh * dr; sx = (src.width - sw) / 2; } else { sh = sw / dr; sy = (src.height - sh) / 2; }
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, W, H);
    const map = GD.globe.st.map, dpr = src.width / (map.getContainer().clientWidth || src.width);
    const proj = (ll) => { const p = map.project(ll); return [(p.x * dpr - sx) * (W / sw), (p.y * dpr - sy) * (H / sh)]; };
    // File media shots (b-roll / stills) cover the map while active.
    (GD.state.mediaEls || []).forEach((el) => {
      const ew = el.videoWidth || el.naturalWidth, eh = el.videoHeight || el.naturalHeight;
      if (!ew || !eh) return;
      const k = Math.max(W / ew, H / eh), dw = ew * k, dh = eh * k;
      try { ctx.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) { /* not ready */ }
    });
    paintOverlays(ctx, W, H, proj);
    rec.raf = requestAnimationFrame(drawFrame);
  }

  async function start(aspect) {
    if (!supported()) throw new Error("MediaRecorder canvas capture is not supported in this browser.");
    try {
    if (GD.globe && GD.globe.prepareForExport) await GD.globe.prepareForExport();
    const [w, h] = SIZES[aspect] || SIZES["16:9"];
    rec.canvas = document.createElement("canvas");
    rec.canvas.width = w; rec.canvas.height = h;
    rec.ctx = rec.canvas.getContext("2d");
    rec.audioCtx = rec.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    rec.dest = rec.dest || rec.audioCtx.createMediaStreamDestination();
    const fps = (GD.state.episode.output && GD.state.episode.output.fps) || 30;
    const stream = rec.canvas.captureStream(fps);
    // Audio only when the AudioContext runs (a click on Record counts as the user gesture).
    // A suspended context yields a silent track that stalls the muxer, so record video-only then.
    if (rec.audioCtx.state !== "running") { try { await Promise.race([rec.audioCtx.resume(), new Promise((r) => setTimeout(r, 400))]); } catch (e) { /* ignore */ } }
    const ep = GD.state.episode;
    const hasAudio = GD.audioMix ? GD.audioMix.hasAudio(ep) : ep.stories.some((st) => st.voiceover || (st.media || []).some((m) => { const b = ep.mediaBin.find((x) => x.ref === m.mediaRef); return b && b.kind === "video"; }));
    rec.withAudio = hasAudio && rec.audioCtx.state === "running";
    if (rec.withAudio) rec.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    else if (hasAudio) console.warn("Recording video only: audio is blocked until you click in the page.");
    rec.chunks = [];
    rec.mr = new MediaRecorder(stream, { mimeType: mime(rec.withAudio) || undefined, videoBitsPerSecond: 12e6 });
    rec.mr.ondataavailable = (e) => e.data && e.data.size && rec.chunks.push(e.data);
    rec.mr.start(1000);
    drawFrame();
    } catch (err) {
      if (GD.globe && GD.globe.endExport) {
        try { await GD.globe.endExport(); } catch (e) { /* ignore */ }
      }
      throw err;
    }
  }

  function stop(filename, opts) {
    const download = !(opts && opts.download === false);
    return new Promise((resolve) => {
      if (!rec.mr) return resolve(null);
      cancelAnimationFrame(rec.raf);
      rec.mr.onstop = () => {
        const blob = new Blob(rec.chunks, { type: "video/webm" });
        if (download) {
          const a = document.createElement("a");
          const url = URL.createObjectURL(blob);
          a.href = url;
          a.download = filename || "globedesk-episode.webm";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ } }, 2000);
        }
        rec.mr = null;
        const finish = () => resolve(blob);
        if (GD.globe && GD.globe.endExport) {
          Promise.resolve(GD.globe.endExport()).then(finish, finish);
        } else finish();
      };
      rec.mr.stop();
    });
  }

  GD.recorder = { supported, start, stop, connectMedia, paintOverlays, layoutHeader, placeLabels, badgeInk, SIZES, _rec: rec, hits: () => rec.hits || { title: null, citations: [] } };
})();
