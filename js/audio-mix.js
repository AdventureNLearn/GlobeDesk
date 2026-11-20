/* Sound overlays: volume, offset, loop. Mixed into playback and the local recording. window.GD.audioMix */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const mix = { els: {}, lastStory: -1 };

  function list(story) { return (story && story.audioOverlays) || []; }

  // Pure: whether an overlay is audible at story-local time lt.
  function activeAt(o, lt) {
    const at = Number(o.at) || 0;
    if (lt < at) return false;
    const dur = o.dur == null || o.dur === "" ? null : Number(o.dur);
    if (!o.loop && dur != null && lt >= at + dur) return false;
    return true;
  }

  // Position inside the source file at story-local time lt.
  function mediaTime(o, lt) {
    const at = Number(o.at) || 0;
    const off = Number(o.offset) || 0;
    let t = (lt - at) + off;
    if (t < 0) t = 0;
    const mediaDur = Number(o.mediaDur) || 0;
    if (o.loop && mediaDur > 0) t = t % mediaDur;
    return t;
  }

  function getEl(ref) {
    const url = GD.state && GD.state.blobs[ref];
    if (!url) return null;
    if (!mix.els[ref]) {
      const a = new Audio();
      a.preload = "auto";
      a.crossOrigin = "anonymous";
      a.src = url;
      mix.els[ref] = a;
      if (GD.recorder && GD.recorder.connectMedia) GD.recorder.connectMedia(a);
    }
    return mix.els[ref];
  }

  function sync(story, lt, playing) {
    if (mix.lastStory !== (story && story.id)) {
      Object.values(mix.els).forEach((a) => { try { a.pause(); } catch (e) {} });
      mix.lastStory = story && story.id;
    }
    list(story).forEach((o) => {
      const el = getEl(o.mediaRef);
      if (!el) return;
      el.volume = Math.max(0, Math.min(1, Number(o.volume) || 0));
      el.loop = !!o.loop;
      const on = activeAt(o, lt);
      if (!on || !playing) { if (!el.paused) el.pause(); return; }
      const want = mediaTime(o, lt);
      if (Math.abs((el.currentTime || 0) - want) > 0.35) {
        try { el.currentTime = want; } catch (e) {}
      }
      if (el.paused) el.play().catch(() => {});
    });
  }

  function stop() {
    Object.values(mix.els).forEach((a) => { try { a.pause(); } catch (e) {} });
  }

  function hasAudio(ep) {
    return (ep.stories || []).some((st) =>
      st.voiceover ||
      (st.audioOverlays || []).length ||
      (st.media || []).some((m) => {
        const b = (ep.mediaBin || []).find((x) => x.ref === m.mediaRef);
        return b && b.kind === "video";
      })
    );
  }

  function blank(mediaRef) {
    return {
      id: GD.model.uid("snd"),
      mediaRef: mediaRef || "",
      volume: 1,
      offset: 0,
      loop: false,
      at: 0,
      dur: null,
      mediaDur: null
    };
  }

  GD.audioMix = { list, activeAt, mediaTime, sync, stop, hasAudio, blank, _mix: mix };
})();
