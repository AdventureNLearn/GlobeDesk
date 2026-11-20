/* In-world ship radio. Plays a live public stream; never rehosts a song file. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = {
    index: 0,
    wanted: false,
    playing: false,
    ducked: false,
    record: false,
    muted: false,
    volume: 0.42,
    el: null,
    hooked: false,
    nowTimer: 0,
    fadeTimer: 0,
    title: "",
    failCount: 0
  };

  function cfg() { return (window.DEMO && window.DEMO.radio) || {}; }
  function stations() { return (cfg().stations || []).slice(); }
  function station() { return stations()[state.index] || null; }
  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function targetVolume() {
    if (state.record || state.muted || !state.wanted) return 0;
    const full = state.volume;
    const duck = cfg().duckVolume != null ? cfg().duckVolume : 0.11;
    return state.ducked ? Math.min(full, duck) : full;
  }

  function applyVolume(immediate) {
    if (!state.el) return;
    const dest = targetVolume();
    state.el.muted = dest <= 0.001 || state.record || state.muted || !state.wanted;
    if (immediate || reduced() || !state.el.volume || Math.abs(state.el.volume - dest) < 0.02) {
      state.el.volume = dest;
      return;
    }
    const start = state.el.volume;
    const ms = cfg().fadeMs || 700;
    const t0 = performance.now();
    if (state.fadeTimer) cancelAnimationFrame(state.fadeTimer);
    function step(now) {
      const t = Math.min(1, (now - t0) / ms);
      state.el.volume = start + (dest - start) * t;
      if (t < 1) state.fadeTimer = requestAnimationFrame(step);
    }
    state.fadeTimer = requestAnimationFrame(step);
  }

  function nowLabel() {
    const c = cfg();
    const unknown = c.unknown || "[UNKNOWN]";
    const live = c.liveLabel || "live";
    if (state.title) return state.title;
    return unknown + " / " + live;
  }

  function render() {
    const root = $("shipRadio");
    if (!root) return;
    const st = station();
    const on = state.wanted && (state.record || state.playing || !state.record);
    root.classList.toggle("on", !!state.wanted);
    root.classList.toggle("record", !!state.record);
    root.classList.toggle("standby", !state.wanted);
    root.classList.toggle("live", !!(state.wanted && (state.playing || state.record)));
    const name = $("radioName");
    const now = $("radioNow");
    const credit = $("radioCredit");
    const cap = $("radioCaption");
    const pwr = $("radioPower");
    const lamp = $("radioLamp");
    const dial = $("radioDial");
    const vol = $("radioVol");
    if (name) name.textContent = st ? st.name : (cfg().unknown || "[UNKNOWN]");
    if (now) now.textContent = state.wanted ? nowLabel() : "STANDBY";
    if (credit && st) {
      credit.textContent = st.credit || st.name;
      credit.href = st.homepage || "#";
    }
    if (cap) {
      cap.textContent = cfg().recordCaption || "Cool Rock — Kevin MacLeod (incompetech.com) · CC BY 4.0";
      cap.hidden = !state.record;
    }
    if (pwr) {
      pwr.setAttribute("aria-pressed", state.wanted ? "true" : "false");
      pwr.title = state.wanted ? "Turn ship radio off" : "Turn ship radio on";
    }
    if (lamp) lamp.setAttribute("title", state.wanted ? "RADIO RX" : "RADIO OFF");
    if (dial) dial.style.transform = "rotate(" + Math.round((state.volume / 1) * 270 - 135) + "deg)";
    if (vol && Math.abs(Number(vol.value) - state.volume) > 0.01) vol.value = String(state.volume);
    const status = $("radioStatus");
    if (status) {
      status.textContent = state.record && state.wanted ? "REC BED"
        : (!state.wanted ? "OFF"
          : (state.playing ? "RX" : "LINK"));
    }
  }

  function setTitle(text) {
    state.title = String(text || "").trim();
    render();
  }

  async function pollNowPlaying() {
    const st = station();
    const np = st && st.nowPlaying;
    if (!np || !np.url) {
      setTitle("");
      return;
    }
    try {
      const r = await fetch(np.url, { mode: "cors" });
      if (!r.ok) throw new Error("now-playing " + r.status);
      const data = await r.json();
      let title = "";
      if (np.type === "somafm" && data && data.songs && data.songs[0]) {
        const s = data.songs[0];
        title = [s.artist, s.title].filter(Boolean).join(" — ");
      } else if (np.type === "icecast-status") {
        let src = data && data.icestats && data.icestats.source;
        if (src && !Array.isArray(src)) src = [src];
        const mount = String(np.mount || "").toLowerCase();
        const list = src || [];
        let hit = null;
        for (let i = 0; i < list.length; i++) {
          const u = String(list[i].listenurl || "").toLowerCase();
          const n = String(list[i].server_name || "").toLowerCase();
          if ((mount && u.indexOf(mount) >= 0) || (mount && n.indexOf(mount) >= 0)) { hit = list[i]; break; }
        }
        if (!hit) hit = list[0];
        title = (hit && (hit["display-title"] || hit.title || hit.yp_currently_playing)) || "";
      }
      setTitle(String(title || "").trim());
    } catch (e) {
      setTitle("");
    }
  }

  function startPoll() {
    stopPoll();
    pollNowPlaying();
    state.nowTimer = setInterval(pollNowPlaying, 20000);
  }
  function stopPoll() {
    if (state.nowTimer) { clearInterval(state.nowTimer); state.nowTimer = 0; }
  }

  function hookEl() {
    if (!state.el) {
      state.el = new Audio();
      state.el.preload = "auto";
      state.el.crossOrigin = "anonymous";
      state.el.addEventListener("error", onError);
      state.el.addEventListener("playing", function () {
        state.playing = true;
        state.failCount = 0;
        render();
      });
      state.el.addEventListener("pause", function () {
        if (!state.wanted) { state.playing = false; render(); }
      });
    }
    if (!state.hooked && window.DemoAudio && DemoAudio.hookMedia) {
      DemoAudio.hookMedia(state.el, false);
      state.hooked = true;
    }
  }

  function onError() {
    if (!state.wanted || state.record) return;
    const list = stations();
    if (state.index + 1 < list.length) {
      state.index += 1;
      state.failCount += 1;
      loadCurrent();
      tryPlay();
    } else {
      state.playing = false;
      render();
    }
  }

  function loadCurrent() {
    const st = station();
    if (!st) return;
    setTitle("");
    if (state.record) { render(); return; }
    hookEl();
    try { state.el.pause(); } catch (e) {}
    state.el.src = st.url;
    applyVolume(true);
    render();
  }

  function tryPlay() {
    render();
    if (state.record || !state.wanted) return;
    hookEl();
    if (window.DemoAudio) DemoAudio.resume();
    applyVolume(true);
    const p = state.el.play();
    if (p && p.catch) p.catch(function () { /* autoplay blocked until a click */ });
  }

  function fadeIn() {
    if (cfg().enabled === false) return;
    state.wanted = true;
    loadCurrent();
    startPoll();
    tryPlay();
    render();
  }

  function fadeOut() {
    state.wanted = false;
    state.playing = false;
    applyVolume();
    if (state.el) {
      try { state.el.pause(); } catch (e) {}
    }
    stopPoll();
    render();
  }

  function toggle() {
    if (state.wanted) fadeOut();
    else fadeIn();
  }

  function duck(on) {
    state.ducked = !!on;
    applyVolume();
  }

  function setMuted(on) {
    state.muted = !!on;
    applyVolume();
    render();
  }

  function setVolume(v) {
    state.volume = Math.max(0, Math.min(1, Number(v) || 0));
    applyVolume(true);
    render();
  }

  function status() {
    const st = station();
    return {
      wanted: state.wanted,
      playing: state.playing,
      record: state.record,
      muted: state.muted,
      ducked: state.ducked,
      volume: state.el ? state.el.volume : 0,
      targetVolume: targetVolume(),
      stationId: st && st.id,
      stationName: st && st.name,
      stationUrl: st && st.url,
      nowPlaying: nowLabel(),
      title: state.title
    };
  }

  function bind() {
    const pwr = $("radioPower");
    const vol = $("radioVol");
    if (pwr) pwr.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (window.DemoAudio) DemoAudio.resume();
      toggle();
    });
    if (vol) vol.addEventListener("input", function () {
      setVolume(vol.value);
    });
  }

  function init(opts) {
    if (cfg().enabled === false) {
      const root = $("shipRadio");
      if (root) root.hidden = true;
      return false;
    }
    state.record = !!(opts && opts.record);
    state.muted = !!(opts && (opts.muted || (window.DemoAudio && DemoAudio.muted)));
    state.volume = cfg().volume != null ? cfg().volume : 0.42;
    state.index = 0;
    bind();
    render();
    return true;
  }

  window.DemoRadio = {
    init, fadeIn, fadeOut, toggle, duck, setMuted, setVolume, status, pollNowPlaying,
    get wanted() { return state.wanted; },
    get playing() { return state.playing; },
    get record() { return state.record; }
  };
})();
