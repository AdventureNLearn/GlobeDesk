/* Frame-accurate MP4 export. Renders playback frame by frame (t = n / fps) onto the
   1920x1080 or 1080x1920 output canvas, then muxes with the vendored Mediabunny (MPL-2.0,
   unmodified, vendor/mediabunny-1.66.2.min.js) over the browser's WebCodecs encoders.
   Order: (1) WebCodecs H.264 + AAC in MP4. (2) If the browser cannot encode that pair and
   the local server reports ffmpeg, encode WebM in the browser and transcode on loopback
   (/api/export/mp4, fixed command line). (3) WebM as the last resort. No ffmpeg.wasm.
   Nothing leaves this device. window.GD.frameExport */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const SIZES = { "16:9": [1920, 1080], "9:16": [1080, 1920] };
  const MAX_SECONDS = 15 * 60;          // plan cap: 15 minutes per encode
  const MAX_BYTES = 2 * 1024 * 1024 * 1024; // plan cap: 2 GiB output
  const SAMPLE_RATE = 48000;
  const IDLE_TIMEOUT_MS = 2500;
  const HOME = { center: [40, 28], zoom: 1.6, pitch: 0, bearing: 0 };
  const EASES = {
    cinematic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    linear: (t) => t,
    smooth: (t) => t * t * (3 - 2 * t)
  };

  // ---------- Pure helpers (unit-tested) ----------
  function sizeFor(aspect) { return (SIZES[aspect] || SIZES["16:9"]).slice(); }

  function clampFps(fps) {
    const n = Math.round(Number(fps) || 30);
    return Math.max(1, Math.min(60, n));
  }

  // Frame plan: count and exact timestamps for a span, so frame n always sits at n / fps.
  function framePlan(durationSec, fps, startSec) {
    const f = clampFps(fps);
    const dur = Math.max(0, Math.min(MAX_SECONDS, Number(durationSec) || 0));
    const count = Math.max(1, Math.ceil(dur * f - 1e-9));
    const start = Math.max(0, Number(startSec) || 0);
    return { fps: f, count, frameDur: 1 / f, start, duration: count / f, at: (n) => start + n / f, ts: (n) => n / f };
  }

  function lerp(a, b, k) { return a + (b - a) * k; }
  function lerpAngle(a, b, k) {
    let d = ((b - a) % 360 + 540) % 360 - 180;
    return (a + d * k + 360) % 360;
  }
  function lerpLon(a, b, k) {
    let d = ((b - a) % 360 + 540) % 360 - 180;
    let x = a + d * k;
    if (x > 180) x -= 360; if (x < -180) x += 360;
    return x;
  }
  function camOf(k) { return { center: [Number(k.center[0]), Number(k.center[1])], zoom: Number(k.zoom), pitch: Number(k.pitch) || 0, bearing: Number(k.bearing) || 0 }; }

  function storyStarts(ep) {
    const out = []; let t = 0;
    (ep.stories || []).forEach((s) => { out.push(t); t += Number(s.durationSec) || 0; });
    return out;
  }

  // Deterministic camera at episode time t: each keyframe eases from the previous camera
  // (previous keyframe, the last camera of the earlier story, or the home view) over its duration.
  function cameraAtTime(ep, t, home) {
    const starts = storyStarts(ep);
    let prev = camOf(home || HOME);
    for (let i = 0; i < (ep.stories || []).length; i++) {
      const s = ep.stories[i];
      const kfs = (s.camera || []).filter((k) => k && Array.isArray(k.center)).slice().sort((a, b) => a.at - b.at);
      const lt = t - starts[i];
      const last = i === ep.stories.length - 1;
      const inStory = lt >= 0 && (last || t < starts[i] + (Number(s.durationSec) || 0));
      for (let j = 0; j < kfs.length; j++) {
        const k = kfs[j];
        if (!inStory || lt >= k.at) {
          if (inStory) {
            const dur = Math.max(0.2, Number(k.durationSec) || 3);
            const p = Math.max(0, Math.min(1, (lt - k.at) / dur));
            if (p < 1) {
              const e = (EASES[k.ease] || EASES.cinematic)(p), to = camOf(k);
              return {
                center: [lerpLon(prev.center[0], to.center[0], e), lerp(prev.center[1], to.center[1], e)],
                zoom: lerp(prev.zoom, to.zoom, e), pitch: lerp(prev.pitch, to.pitch, e), bearing: lerpAngle(prev.bearing, to.bearing, e)
              };
            }
          }
          prev = camOf(k);
        } else break;
      }
      if (inStory) return prev;
    }
    return prev;
  }

  // Which encoder path to use. caps: { h264, aac, webmVideo, opus, ffmpeg, mediaRecorder }
  function choosePath(caps, needAudio) {
    const c = caps || {};
    if (c.h264 && (c.aac || !needAudio)) return { path: "mp4", audio: c.aac ? "aac" : "none", note: c.aac ? "Browser encoder: H.264 + AAC in MP4." : "Browser encoder: H.264 in MP4 (no sound in this episode; AAC unavailable)." };
    if (c.ffmpeg && c.webmVideo) return { path: "ffmpeg", audio: needAudio ? (c.opus ? "opus" : "none") : "none", note: "This browser cannot encode H.264 + AAC. Encoding WebM here, then your local ffmpeg makes the MP4 (on this device)." };
    if (c.webmVideo) return { path: "webm", audio: c.opus ? "opus" : "none", note: "MP4 is not available here (no H.264/AAC encoder and no local ffmpeg). Saving WebM instead." };
    if (c.mediaRecorder) return { path: "webm-realtime", audio: "none", note: "Frame export is not supported in this browser. Use ● Record for a real-time WebM." };
    return { path: "none", audio: "none", note: "[UNKNOWN] This browser cannot encode video. Try a current Chrome or Edge." };
  }

  function needsAudio(ep) {
    return (ep.stories || []).some((s) => s.voiceover || (s.audioOverlays || []).length);
  }

  function fileName(ep, aspect, ext) {
    const slug = String((ep && (ep.date || "episode")) + "-" + ((ep && ep.show) || "globedesk")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return slug + "-" + String(aspect).replace(":", "x") + "." + ext;
  }

  // ---------- Browser capability probe ----------
  async function probe(aspect) {
    const M = global.Mediabunny;
    const [w, h] = sizeFor(aspect);
    const caps = { h264: false, aac: false, webmVideo: null, opus: false, ffmpeg: false, mediaRecorder: typeof MediaRecorder !== "undefined", webcodecs: typeof VideoEncoder !== "undefined", mediabunny: !!M };
    if (M && caps.webcodecs) {
      try { caps.h264 = await M.canEncodeVideo("avc", { width: w, height: h, frameRate: 30 }); } catch (e) { caps.h264 = false; }
      try { caps.aac = typeof AudioEncoder !== "undefined" && await M.canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: SAMPLE_RATE }); } catch (e) { caps.aac = false; }
      try { caps.webmVideo = await M.getFirstEncodableVideoCodec(["vp9", "vp8"], { width: w, height: h }); } catch (e) { caps.webmVideo = null; }
      try { caps.opus = typeof AudioEncoder !== "undefined" && await M.canEncodeAudio("opus", { numberOfChannels: 2, sampleRate: SAMPLE_RATE }); } catch (e) { caps.opus = false; }
    }
    caps.ffmpeg = await ffmpegAvailable();
    return caps;
  }

  async function ffmpegAvailable() {
    try {
      const here = global.location;
      if (!here || !/^https?:$/.test(here.protocol) || !/^(127\.0\.0\.1|localhost)$/.test(here.hostname)) return false;
      const r = await fetch("/api/export/mp4", { method: "GET", cache: "no-store" });
      if (!r.ok) return false;
      const j = await r.json();
      return !!(j && j.ffmpeg);
    } catch (e) { return false; }
  }

  // ---------- Audio: offline mix of voiceover and sound overlays ----------
  async function decodeRef(ctx, ref, cache) {
    if (cache[ref] !== undefined) return cache[ref];
    const url = GD.state && GD.state.blobs && GD.state.blobs[ref];
    if (!url) { cache[ref] = null; return null; }
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      cache[ref] = await ctx.decodeAudioData(buf);
    } catch (e) { cache[ref] = null; }
    return cache[ref];
  }

  async function mixAudio(ep, startSec, durationSec) {
    const len = Math.max(1, Math.ceil(durationSec * SAMPLE_RATE));
    const OAC = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    if (!OAC) return null;
    const ctx = new OAC(2, len, SAMPLE_RATE);
    const cache = {};
    const starts = storyStarts(ep);
    const end = startSec + durationSec;
    for (let i = 0; i < (ep.stories || []).length; i++) {
      const s = ep.stories[i], s0 = starts[i], s1 = s0 + (Number(s.durationSec) || 0);
      if (s1 <= startSec || s0 >= end) continue;
      const place = async (ref, atStory, offset, dur, gainV, loop) => {
        const b = await decodeRef(ctx, ref, cache); if (!b) return;
        const src = ctx.createBufferSource(); src.buffer = b; src.loop = !!loop;
        const g = ctx.createGain(); g.gain.value = gainV; src.connect(g); g.connect(ctx.destination);
        let when = s0 + atStory - startSec, off = Math.max(0, offset || 0);
        if (when < 0) { off += -when; when = 0; }
        const stopAt = Math.min(s1, dur != null ? s0 + atStory + dur : s1) - startSec;
        if (stopAt <= when) return;
        if (loop && b.duration > 0) off = off % b.duration;
        src.start(when, Math.min(off, Math.max(0, b.duration - 0.001)));
        src.stop(stopAt);
      };
      if (s.voiceover) await place(s.voiceover, 0, 0, null, 1, false);
      for (const o of (s.audioOverlays || [])) {
        const dur = o.dur == null || o.dur === "" ? null : Number(o.dur);
        await place(o.mediaRef, Number(o.at) || 0, Number(o.offset) || 0, o.loop ? null : dur, Math.max(0, Math.min(1, Number(o.volume) || 0)), !!o.loop);
      }
    }
    return ctx.startRendering();
  }

  // Slice a long AudioBuffer into 1 s buffers so the encoder sees steady chunks.
  function* audioChunks(buf) {
    const step = SAMPLE_RATE;
    for (let i = 0; i < buf.length; i += step) {
      const n = Math.min(step, buf.length - i);
      const out = new AudioBuffer({ numberOfChannels: buf.numberOfChannels, length: n, sampleRate: buf.sampleRate });
      for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(i, i + n), c);
      yield out;
    }
  }

  // ---------- Frame stepping ----------
  // Wait until the frame for this camera is drawn: tiles for the view are in and the map is still.
  // MapLibre's "idle" can wait forever when an unrelated source keeps failing (offline), so poll
  // areTilesLoaded() each animation frame with a hard timeout instead.
  function waitIdle(map) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      let frames = 0;
      const step = () => {
        frames++;
        let ready = false;
        try { ready = map.isStyleLoaded() && map.areTilesLoaded() && !map.isMoving(); } catch (e) { ready = true; }
        if ((ready && frames >= 1) || performance.now() - t0 > IDLE_TIMEOUT_MS) { resolve(); return; }
        requestAnimationFrame(step);
      };
      try { map.triggerRepaint(); } catch (e) { /* ignore */ }
      requestAnimationFrame(step);
    });
  }

  async function seekMedia(t) {
    const S = GD.state;
    const { idx, lt } = GD.playback.locate(t);
    const s = S.episode.stories[idx];
    const waits = [];
    (S.mediaEls || []).forEach((el) => {
      if (el.tagName !== "VIDEO") return;
      const m = (s.media || []).find((x) => x.mediaRef === el.dataset.ref);
      if (!m) return;
      try { el.pause(); } catch (e) { /* ignore */ }
      const want = Math.max(0, lt - (Number(m.at) || 0));
      if (Math.abs((el.currentTime || 0) - want) < 1 / 120) return;
      waits.push(new Promise((r) => { const tm = setTimeout(r, 1500); el.addEventListener("seeked", () => { clearTimeout(tm); r(); }, { once: true }); el.currentTime = want; }));
    });
    await Promise.all(waits);
  }

  async function renderAt(t, ctx, W, H, lastIdx) {
    const S = GD.state, map = GD.globe.st.map;
    const { idx } = GD.playback.evaluate(t);
    S.t = t;
    if (idx !== lastIdx) { GD.globe.st.active = idx; GD.globe.setEpisode(S.episode); }
    const cam = cameraAtTime(S.episode, t, GD.globe.HOME_VIEW);
    map.jumpTo({ center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing });
    if (GD.ui && GD.ui.renderOverlays) GD.ui.renderOverlays();
    await seekMedia(t);
    await waitIdle(map);
    ctx.clearRect(0, 0, W, H);
    GD.recorder.composeFrame(ctx, W, H);
    return idx;
  }

  const job = { running: false, cancel: false };

  function download(blob, name) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ } }, 4000);
  }

  // opts: { aspect, seconds (null = whole), onProgress(fraction, text), download (default true), forcePath }
  async function exportVideo(opts) {
    opts = opts || {};
    if (job.running) throw new Error("An export is already running.");
    const M = global.Mediabunny;
    const S = GD.state, ep = S.episode;
    const aspect = SIZES[opts.aspect] ? opts.aspect : ((ep.output && ep.output.aspect) || "16:9");
    const total = GD.model.totalDuration(ep);
    const span = Math.min(total, opts.seconds ? Number(opts.seconds) : total);
    if (span > MAX_SECONDS) throw new Error("Episodes longer than 15 minutes are not exported in one go (cap).");
    const plan = framePlan(span, (ep.output && ep.output.fps) || 30, 0);
    const caps = opts.caps || await probe(aspect);
    const choice = opts.forcePath ? Object.assign(choosePath(caps, needsAudio(ep)), { path: opts.forcePath }) : choosePath(caps, needsAudio(ep));
    const progress = opts.onProgress || (() => {});
    if (choice.path === "none" || choice.path === "webm-realtime" || !M) throw new Error(choice.note);
    job.running = true; job.cancel = false;
    const prevAspect = (ep.output && ep.output.aspect) || "16:9";
    const prevT = S.t;
    let wasPlaying = S.playing;
    try {
      if (wasPlaying) GD.playback.pause();
      if (GD.ui && GD.ui.applyAspect && prevAspect !== aspect) GD.ui.applyAspect(aspect);
      if (GD.globe.prepareForExport) await GD.globe.prepareForExport();
      const [W, H] = sizeFor(aspect);
      const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      const mp4 = choice.path === "mp4";
      const format = mp4 ? new M.Mp4OutputFormat({ fastStart: "in-memory" }) : new M.WebMOutputFormat();
      const target = new M.BufferTarget();
      const output = new M.Output({ format, target });
      const vcodec = mp4 ? "avc" : (caps.webmVideo || "vp9");
      const video = new M.CanvasSource(canvas, { codec: vcodec, bitrate: 12e6, keyFrameInterval: 2 });
      output.addVideoTrack(video, { frameRate: plan.fps });
      let audio = null;
      if (choice.audio === "aac" || choice.audio === "opus") {
        audio = new M.AudioBufferSource({ codec: choice.audio, bitrate: 160e3 });
        output.addAudioTrack(audio);
      }
      await output.start();
      progress(0, choice.note);
      let lastIdx = -2;
      for (let n = 0; n < plan.count; n++) {
        if (job.cancel) { await output.cancel(); throw new Error("Export cancelled."); }
        lastIdx = await renderAt(plan.at(n), ctx, W, H, lastIdx);
        await video.add(plan.ts(n), plan.frameDur);
        if (n % 5 === 0 || n === plan.count - 1) progress((n + 1) / plan.count * (audio ? 0.92 : 1), "Frame " + (n + 1) + " of " + plan.count);
      }
      video.close();
      if (audio) {
        progress(0.94, "Mixing sound…");
        const mixed = await mixAudio(ep, 0, plan.duration);
        if (mixed) for (const chunk of audioChunks(mixed)) await audio.add(chunk);
        audio.close();
      }
      await output.finalize();
      let bytes = target.buffer;
      if (!bytes || !bytes.byteLength) throw new Error("The encoder produced an empty file.");
      if (bytes.byteLength > MAX_BYTES) throw new Error("Output is over the 2 GiB cap.");
      let blob = new Blob([bytes], { type: mp4 ? "video/mp4" : "video/webm" });
      let ext = mp4 ? "mp4" : "webm", method = mp4 ? "webcodecs" : "webm";
      if (choice.path === "ffmpeg") {
        progress(0.97, "Local ffmpeg is making the MP4…");
        const r = await fetch("/api/export/mp4", { method: "POST", headers: { "Content-Type": "video/webm" }, body: blob });
        if (r.ok) { blob = new Blob([await r.arrayBuffer()], { type: "video/mp4" }); ext = "mp4"; method = "ffmpeg"; }
        else { method = "webm"; progress(0.98, "Local ffmpeg failed; saving the WebM instead."); }
      }
      const name = fileName(ep, aspect, ext);
      if (opts.download !== false) download(blob, name);
      progress(1, "Saved " + name);
      return { ok: true, name, bytes: blob.size, method, path: choice.path, frames: plan.count, fps: plan.fps, aspect, width: W, height: H, audio: choice.audio, blob: opts.keepBlob ? blob : undefined };
    } finally {
      job.running = false;
      try { if (GD.globe.endExport) await GD.globe.endExport(); } catch (e) { /* ignore */ }
      if (GD.ui && GD.ui.applyAspect && prevAspect !== aspect) GD.ui.applyAspect(prevAspect);
      try { GD.playback.seek(prevT); } catch (e) { /* ignore */ }
    }
  }

  function cancel() { if (job.running) job.cancel = true; }

  GD.frameExport = { SIZES, MAX_SECONDS, MAX_BYTES, sizeFor, clampFps, framePlan, cameraAtTime, choosePath, needsAudio, fileName, probe, exportVideo, cancel, mixAudio, isRunning: () => job.running };
})(typeof window !== "undefined" ? window : globalThis);
