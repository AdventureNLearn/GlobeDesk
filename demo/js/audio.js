/* Ambience bed, UI stingers, and voice playback with amplitude for the frog comms window. */
(function () {
  "use strict";
  const C = () => window.DEMO;
  const state = {
    muted: false,
    ctx: null,
    analyser: null,
    freq: null,
    amb: null,
    vo: null,
    voSrc: null,
    ambSrc: null,
    master: null,
    talking: false,
    voId: null,
    playChain: Promise.resolve(),
    cutGen: 0,
    ambVol: 0.22,
    ambDuck: 0.07,
    durations: {},
    durationsByVoice: {},
    voiceId: "hfc_male",
    pitchSemitones: 0,
    speed: 1
  };

  function voices() {
    const list = (C() && C().voices) || [];
    return list.length ? list : [{ id: "hfc_male", label: "US", dir: (C().assets && C().assets.voiceDir) || "assets/vo/" }];
  }
  function voiceOf(id) {
    return voices().find(function (v) { return v.id === id; }) || voices()[0];
  }

  function sfxPath(name) {
    return (C().assets.sfxDir || "assets/sfx/") + name;
  }
  function voDir() {
    const v = voiceOf(state.voiceId);
    return (v && v.dir) || (C().assets && C().assets.voiceDir) || "assets/vo/";
  }
  function voPath(id) {
    return voDir() + id + ".wav";
  }

  function useDurationMap(voiceId) {
    const map = state.durationsByVoice[voiceId] || state.durationsByVoice.hfc_male || {};
    state.durations = map;
  }

  async function loadDurations() {
    const jobs = voices().map(async function (v) {
      try {
        const r = await fetch(v.dir + "durations.json");
        const rows = await r.json();
        const map = {};
        (rows || []).forEach(function (row) { if (row && row.id) map[row.id] = row.duration; });
        state.durationsByVoice[v.id] = map;
      } catch (e) {
        state.durationsByVoice[v.id] = {};
      }
    });
    await Promise.all(jobs);
    useDurationMap(state.voiceId);
  }

  function combinedRate() {
    const st = Number(state.pitchSemitones) || 0;
    const spd = Number(state.speed) || 1;
    return Math.max(0.4, Math.min(2.5, spd * Math.pow(2, st / 12)));
  }

  function applyLiveRate() {
    const rate = combinedRate();
    if (state.vo) {
      try { state.vo.playbackRate = rate; } catch (e) {}
    }
    return rate;
  }

  /* Voice bank switches on the next playVo() call. Pitch and speed apply live
     via HTMLMediaElement.playbackRate (also changes duration). Native Web Audio
     playbackRate / detune cannot split pitch and speed independently. */
  function setVoice(id) {
    const v = voiceOf(id);
    if (!v) return state.voiceId;
    state.voiceId = v.id;
    useDurationMap(v.id);
    return state.voiceId;
  }
  function setPitch(semitones) {
    const lab = (C() && C().tempVoiceLab) || {};
    const lo = lab.pitchMin != null ? lab.pitchMin : -6;
    const hi = lab.pitchMax != null ? lab.pitchMax : 6;
    state.pitchSemitones = Math.max(lo, Math.min(hi, Number(semitones) || 0));
    applyLiveRate();
    return state.pitchSemitones;
  }
  function setSpeed(speed) {
    const lab = (C() && C().tempVoiceLab) || {};
    const lo = lab.speedMin != null ? lab.speedMin : 0.7;
    const hi = lab.speedMax != null ? lab.speedMax : 1.3;
    state.speed = Math.max(lo, Math.min(hi, Number(speed) || 1));
    applyLiveRate();
    return state.speed;
  }
  function getLab() {
    return {
      voice: state.voiceId,
      pitchSemitones: state.pitchSemitones,
      speed: state.speed,
      rate: combinedRate()
    };
  }

  function ensureCtx() {
    if (state.ctx) return state.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      state.ctx = new AC();
      state.master = state.ctx.createGain();
      state.master.gain.value = state.muted ? 0 : 1;
      state.master.connect(state.ctx.destination);
      state.analyser = state.ctx.createAnalyser();
      state.analyser.fftSize = 256;
      state.analyser.connect(state.master);
      state.freq = new Uint8Array(state.analyser.frequencyBinCount);
    } catch (e) {
      state.ctx = null;
    }
    return state.ctx;
  }

  function resume() {
    const ctx = ensureCtx();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(function () {});
  }

  function setMuted(on) {
    state.muted = !!on;
    if (state.master) state.master.gain.value = state.muted ? 0 : 1;
    if (state.amb) state.amb.muted = state.muted;
    if (state.vo) state.vo.muted = state.muted;
    if (window.DemoRadio) DemoRadio.setMuted(state.muted);
  }

  function hookMedia(el, intoAnalyser) {
    const ctx = ensureCtx();
    if (!ctx || !el) return;
    try {
      const src = ctx.createMediaElementSource(el);
      if (intoAnalyser && state.analyser) src.connect(state.analyser);
      else src.connect(state.master || ctx.destination);
      return src;
    } catch (e) {
      return null;
    }
  }

  function duckAmbience(on) {
    if (state.amb) {
      try { state.amb.volume = on ? state.ambDuck : state.ambVol; } catch (e) {}
    }
    if (window.DemoRadio) DemoRadio.duck(on);
  }

  function startAmbience() {
    resume();
    if (!state.amb) {
      state.amb = new Audio(sfxPath("ambience-ship.wav"));
      state.amb.loop = true;
      state.amb.preload = "auto";
      state.amb.volume = state.talking ? state.ambDuck : state.ambVol;
      hookMedia(state.amb, false);
    }
    state.amb.muted = state.muted;
    duckAmbience(state.talking);
    if (!state.muted) state.amb.play().catch(function () {});
  }

  function stopAmbience() {
    if (state.amb) {
      try { state.amb.pause(); } catch (e) {}
    }
  }

  function playSfx(name, volume) {
    if (state.muted) return;
    resume();
    try {
      const a = new Audio(sfxPath(name));
      a.volume = volume == null ? 0.55 : volume;
      a.play().catch(function () {});
    } catch (e) {}
  }

  function stopVo() {
    /* Only Skip (and teardown) should cut a line. Clears the queue. */
    state.cutGen += 1;
    state.talking = false;
    state.voId = null;
    duckAmbience(false);
    if (state.vo) {
      try { state.vo.pause(); state.vo.currentTime = 0; } catch (e) {}
    }
    state.playChain = Promise.resolve();
  }

  function waitMs(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, Math.max(0, ms)); });
  }

  /* Queue lines so a new speak never cuts the one in progress. Returns a
     Promise that resolves with this line's rate-adjusted duration (seconds)
     once playback of THIS line has started (after any earlier queued lines). */
  function playVo(id) {
    resume();
    const myGen = state.cutGen;
    const run = (state.playChain || Promise.resolve()).then(function () {
      if (state.cutGen !== myGen) return 0;
      state.voId = id;
      state.talking = true;
      duckAmbience(true);
      const dur = state.durations[id] || 0;
      if (!state.muted && C().voice && C().voice.enabled) {
        try {
          if (!state.vo) {
            state.vo = new Audio();
            state.vo.preload = "auto";
            hookMedia(state.vo, true);
          }
          state.vo.src = voPath(id);
          state.vo.muted = state.muted;
          state.vo.volume = 1;
          applyLiveRate();
          state.vo.play().catch(function () {});
        } catch (e) {}
      }
      const rate = combinedRate();
      return rate > 0 ? dur / rate : dur;
    });
    state.playChain = run.then(function (dur) {
      if (!dur || state.cutGen !== myGen) return;
      return waitMs(Math.round(dur * 1000) + 80).then(function () {
        if (state.cutGen === myGen && state.voId === id) {
          state.talking = false;
          state.voId = null;
          duckAmbience(false);
        }
      });
    }).catch(function () {});
    return run;
  }

  function amplitude() {
    if (state.analyser && state.freq && state.talking) {
      state.analyser.getByteFrequencyData(state.freq);
      let sum = 0;
      for (let i = 0; i < state.freq.length; i++) sum += state.freq[i];
      const avg = sum / state.freq.length;
      if (avg > 3) return Math.max(0, Math.min(1, (avg - 3) / 70));
    }
    if (state.talking) {
      const t = performance.now();
      return 0.32 + 0.68 * Math.abs(Math.sin(t / 85) * Math.sin(t / 47));
    }
    return 0;
  }

  function voDuration(id) {
    return state.durations[id] || 0;
  }

  async function init(opts) {
    if (opts && opts.muted) setMuted(true);
    const lab = (C() && C().tempVoiceLab) || {};
    if (opts && opts.voice) setVoice(opts.voice);
    else if (lab.voice) setVoice(lab.voice);
    if (opts && opts.pitchSemitones != null) setPitch(opts.pitchSemitones);
    else if (lab.pitchSemitones != null) setPitch(lab.pitchSemitones);
    if (opts && opts.speed != null) setSpeed(opts.speed);
    else if (lab.speed != null) setSpeed(lab.speed);
    await loadDurations();
    ensureCtx();
    return true;
  }

  window.DemoAudio = {
    init, setMuted, startAmbience, stopAmbience, playSfx, playVo, stopVo, amplitude, voDuration, resume, hookMedia,
    setVoice, setPitch, setSpeed, getLab, applyLiveRate, combinedRate, voices, voiceOf,
    get muted() { return state.muted; },
    get talking() { return state.talking; },
    get voId() { return state.voId; },
    get voiceId() { return state.voiceId; }
  };
})();
