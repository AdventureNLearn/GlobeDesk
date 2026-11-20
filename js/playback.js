/* Playback engine: one clock drives camera keyframes, cards, captions, media and voiceover. window.GD.playback */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const pb = { raf: 0, last: 0, fired: new Set(), audioEl: null, audioStory: -1, mediaEls: {}, spoken: -1 };

  function locate(t) {
    const ep = GD.state.episode, starts = GD.model.storyStarts(ep);
    for (let i = ep.stories.length - 1; i >= 0; i--) if (t >= starts[i]) return { idx: i, lt: t - starts[i], start: starts[i] };
    return { idx: 0, lt: 0, start: 0 };
  }

  function mediaUrl(ref) {
    const m = (GD.state.episode.mediaBin || []).find((x) => x.ref === ref);
    return m && GD.state.blobs[ref] ? { url: GD.state.blobs[ref], m } : null;
  }

  // Evaluate overlays for time t (pure; used for scrubbing, playback and recording).
  function evaluate(t) {
    const S = GD.state, { idx, lt } = locate(t), s = S.episode.stories[idx];
    S.storyIdx = idx;
    const ep = S.episode;
    S.ov.outro = !!(ep.outro && ep.outro.enabled && t >= GD.model.storiesDuration(ep));
    if (S.ov.outro) { S.ov.cards = []; S.ov.captions = []; S.ov.media = []; S.ov.citations = []; return { idx, lt, s }; }
    const kfs = (s.camera || []).filter((k) => k.at <= lt).sort((a, b) => a.at - b.at);
    // A map shot's citation holds from its cut until the next cut.
    const cutKf = kfs.filter((k) => k.cut !== false).pop() || kfs[kfs.length - 1];
    S.ov.cards = (s.cards || []).filter((c) => lt >= c.at && lt < c.at + c.dur);
    S.ov.captions = (s.captions || []).filter((c) => lt >= c.start && lt < c.end).map((c) => c.text);
    S.ov.media = (s.media || []).filter((m) => m.role !== "voiceover" && m.role !== "music" && lt >= m.at && lt < m.at + m.dur);
    S.ov.citations = [];
    S.ov.media.forEach((m) => m.citation && S.ov.citations.push(GD.model.citationLine(m.citation)));
    if (!S.ov.media.length && cutKf && cutKf.citation) {
      const b = GD.layers.base(GD.globe.st.baseId), auto = (b && b.cite) || {};
      const c = Object.assign({}, cutKf.citation);
      ["date", "credit", "license"].forEach((k) => { if (c[k] === "auto") c[k] = auto[k] || "[UNKNOWN]"; });
      S.ov.citations.push(GD.model.citationLine(c));
    }
    return { idx, lt, s };
  }

  function syncCamera(idx, lt, jump) {
    const s = GD.state.episode.stories[idx];
    const kfs = (s.camera || []).slice().sort((a, b) => a.at - b.at);
    if (!kfs.length) return;
    if (jump) {
      const past = kfs.filter((k) => k.at <= lt);
      const k = past[past.length - 1] || kfs[0];
      GD.globe.st.map.jumpTo({ center: k.center, zoom: k.zoom, pitch: k.pitch, bearing: k.bearing });
      kfs.forEach((x) => { if (x.at <= lt) pb.fired.add(s.id + x.id); });
      return;
    }
    kfs.forEach((k) => {
      const key = s.id + k.id;
      if (lt >= k.at && !pb.fired.has(key)) { pb.fired.add(key); GD.globe.flyTo(k); }
    });
  }

  function syncAudio(idx, lt, playing) {
    const s = GD.state.episode.stories[idx];
    const vo = s.voiceover ? mediaUrl(s.voiceover) : null;
    if (!pb.audioEl) { pb.audioEl = new Audio(); pb.audioEl.crossOrigin = "anonymous"; }
    const a = pb.audioEl;
    if (pb.audioStory !== idx) {
      a.pause();
      pb.audioStory = idx;
      if (vo) { a.src = vo.url; a.currentTime = lt; } else a.removeAttribute("src");
    }
    if (vo && GD.recorder) GD.recorder.connectMedia(a);
    if (vo && playing && a.paused) { a.currentTime = lt; a.play().catch(() => {}); }
    if (!playing) a.pause();
    if (GD.audioMix) GD.audioMix.sync(s, lt, playing);
    // Free, built-in browser voice (preview only; it is not captured in recordings).
    if (!vo && playing && GD.state.browserVoice && pb.spoken !== idx && "speechSynthesis" in window && s.script) {
      pb.spoken = idx;
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(s.script));
    }
  }

  function tick(now) {
    const S = GD.state;
    const dt = (now - pb.last) / 1000;
    pb.last = now;
    const prevIdx = S.storyIdx;
    S.t = Math.min(GD.model.totalDuration(S.episode), S.t + dt);
    const { idx, lt } = evaluate(S.t);
    if (idx !== prevIdx) { pb.spoken = -1; GD.globe.st.active = idx; GD.globe.setEpisode(S.episode); }
    syncCamera(idx, lt, false);
    syncAudio(idx, lt, true);
    GD.ui.renderOverlays();
    if (GD.content) GD.content.render();
    if (GD.eventsUI) GD.eventsUI.tickClock();
    if (S.t >= GD.model.totalDuration(S.episode)) { stop(); GD.ui.onPlaybackEnd(); return; }
    pb.raf = requestAnimationFrame(tick);
  }

  function play() {
    const S = GD.state;
    if (S.playing) return;
    if (S.t >= GD.model.totalDuration(S.episode) - 0.05) seek(0);
    S.playing = true;
    pb.fired.clear();
    const { idx, lt } = evaluate(S.t);
    // Mark moves already past so resume does not replay them; then fire the current one.
    const s = S.episode.stories[idx];
    (s.camera || []).forEach((k) => { if (k.at < lt - 0.25) pb.fired.add(s.id + k.id); });
    pb.audioStory = -1;
    pb.last = performance.now();
    pb.raf = requestAnimationFrame(tick);
    GD.ui.renderTransport();
  }

  function stop() {
    const S = GD.state;
    S.playing = false;
    cancelAnimationFrame(pb.raf);
    if (pb.audioEl) pb.audioEl.pause();
    if (GD.audioMix) GD.audioMix.stop();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    GD.ui.renderTransport();
  }

  function seek(t) {
    const S = GD.state;
    S.t = Math.max(0, Math.min(GD.model.totalDuration(S.episode), t));
    pb.fired.clear();
    pb.audioStory = -1;
    pb.spoken = -1;
    const { idx, lt } = evaluate(S.t);
    GD.globe.st.active = idx;
    GD.globe.setEpisode(S.episode);
    syncCamera(idx, lt, true);
    if (GD.eventsMap) GD.eventsMap.refresh();
    if (S.playing) syncAudio(idx, lt, true);
    else if (GD.audioMix) GD.audioMix.sync(S.episode.stories[idx], lt, false);
    GD.ui.renderOverlays();
    if (GD.content) GD.content.render();
  }

  GD.playback = { play, stop, seek, evaluate, locate };
})();
