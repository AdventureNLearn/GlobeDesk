/* TEMPORARY voice lab. Easy to remove:
   1) set DEMO.tempVoiceLab.enabled = false in js/config.js, or
   2) delete this file, the #voiceLab markup, and the script tag. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);

  function cfg() {
    return (window.DEMO && window.DEMO.tempVoiceLab) || { enabled: false };
  }

  function load() {
    const c = cfg();
    const out = {
      voice: c.voice || "hfc_male",
      pitchSemitones: c.pitchSemitones != null ? c.pitchSemitones : 0,
      speed: c.speed != null ? c.speed : 1
    };
    try {
      const raw = localStorage.getItem(c.storageKey || "globedesk-demo.voiceLab");
      if (!raw) return out;
      const saved = JSON.parse(raw);
      if (saved.voice) out.voice = saved.voice;
      if (saved.pitchSemitones != null) out.pitchSemitones = saved.pitchSemitones;
      if (saved.speed != null) out.speed = saved.speed;
    } catch (e) {}
    return out;
  }

  function save() {
    const c = cfg();
    if (!window.DemoAudio) return;
    const lab = DemoAudio.getLab();
    try {
      localStorage.setItem(c.storageKey || "globedesk-demo.voiceLab", JSON.stringify({
        voice: lab.voice,
        pitchSemitones: lab.pitchSemitones,
        speed: lab.speed
      }));
    } catch (e) {}
  }

  function apply(values) {
    if (!window.DemoAudio || !values) return;
    if (values.voice) DemoAudio.setVoice(values.voice);
    if (values.pitchSemitones != null) DemoAudio.setPitch(values.pitchSemitones);
    if (values.speed != null) DemoAudio.setSpeed(values.speed);
  }

  function voiceIndex(id) {
    const list = DemoAudio.voices();
    const i = list.findIndex(function (v) { return v.id === id; });
    return i < 0 ? 0 : i;
  }

  function refreshLabels() {
    if (!window.DemoAudio) return;
    const lab = DemoAudio.getLab();
    const v = DemoAudio.voiceOf(lab.voice);
    const voiceEl = $("labVoiceLabel");
    const pitchEl = $("labPitchLabel");
    const speedEl = $("labSpeedLabel");
    if (voiceEl) voiceEl.textContent = (v && v.label) || lab.voice;
    if (pitchEl) {
      const n = Number(lab.pitchSemitones) || 0;
      pitchEl.textContent = (n > 0 ? "+" : "") + n.toFixed(1) + " st";
    }
    if (speedEl) speedEl.textContent = (Number(lab.speed) || 1).toFixed(2) + "×";
    const voiceRange = $("labVoice");
    if (voiceRange) voiceRange.value = String(voiceIndex(lab.voice));
    const pitchRange = $("labPitch");
    if (pitchRange) pitchRange.value = String(lab.pitchSemitones);
    const speedRange = $("labSpeed");
    if (speedRange) speedRange.value = String(lab.speed);
  }

  function bind() {
    const c = cfg();
    const voiceRange = $("labVoice");
    const pitchRange = $("labPitch");
    const speedRange = $("labSpeed");
    if (voiceRange) {
      const list = DemoAudio.voices();
      voiceRange.min = "0";
      voiceRange.max = String(Math.max(0, list.length - 1));
      voiceRange.step = "1";
      voiceRange.addEventListener("input", function () {
        const v = list[Number(voiceRange.value) || 0];
        if (v) DemoAudio.setVoice(v.id);
        refreshLabels();
        save();
      });
    }
    if (pitchRange) {
      pitchRange.min = String(c.pitchMin != null ? c.pitchMin : -6);
      pitchRange.max = String(c.pitchMax != null ? c.pitchMax : 6);
      pitchRange.step = "0.5";
      pitchRange.addEventListener("input", function () {
        DemoAudio.setPitch(pitchRange.value);
        refreshLabels();
        save();
      });
    }
    if (speedRange) {
      speedRange.min = String(c.speedMin != null ? c.speedMin : 0.7);
      speedRange.max = String(c.speedMax != null ? c.speedMax : 1.3);
      speedRange.step = "0.05";
      speedRange.addEventListener("input", function () {
        DemoAudio.setSpeed(speedRange.value);
        refreshLabels();
        save();
      });
    }
    const preview = $("labPreview");
    if (preview) {
      preview.addEventListener("click", function () {
        const line = c.previewLine || "start";
        if (window.__demo && typeof __demo.speak === "function") __demo.speak(line);
        else if (window.DemoAudio) DemoAudio.playVo(line);
      });
    }
  }

  function init() {
    const c = cfg();
    const panel = $("voiceLab");
    if (!c.enabled) {
      if (panel) panel.hidden = true;
      return false;
    }
    if (panel) panel.hidden = false;
    apply(load());
    bind();
    refreshLabels();
    return true;
  }

  window.DemoVoiceLab = { init, load, save, apply, refreshLabels };
})();
