/* Animated frog guide: blink, idle, glow, talk-sync to voice amplitude, typewriter. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let typeTimer = 0;
  let typeResolve = null;
  let blinkTimer = 0;
  let raf = 0;
  let exprTimer = 0;
  let reduced = false;

  function comms() { return $("comms"); }
  function wrap() { return $("portraitWrap"); }

  let pose = "idle";
  let sticky = false; // salute stays through the finale

  function poseSrc(name) {
    const C = window.DEMO || {};
    const poses = (C.assets && C.assets.poses) || {};
    return poses[name] || poses.idle || C.assets.portrait;
  }

  function preloadPoses() {
    const C = window.DEMO || {};
    const poses = (C.assets && C.assets.poses) || {};
    Object.keys(poses).forEach(function (k) {
      const im = new Image();
      im.src = poses[k];
    });
  }

  function setPose(name) {
    const next = name || "idle";
    pose = next;
    const img = $("frog");
    const src = poseSrc(next);
    if (img && src && img.getAttribute("data-pose") !== next) {
      img.src = src;
      img.setAttribute("data-pose", next);
    }
  }

  function setTalk(v) {
    const n = Math.max(0, Math.min(1, v || 0));
    document.documentElement.style.setProperty("--talk", String(n));
  }

  function updateLegend() {
    const el = comms();
    const legend = document.getElementById("commsLegend");
    if (!legend || !el) return;
    const talking = !!(window.DemoAudio && DemoAudio.talking);
    let text = "";
    if (talking) text = "COMMS LIVE";
    else if (el.classList.contains("expr-success")) text = "CLEAR";
    else if (el.classList.contains("expr-hint")) text = "HINT";
    legend.textContent = text;
    legend.hidden = !text;
    legend.setAttribute("data-mode", talking ? "live" : (text ? text.toLowerCase() : "off"));
  }

  function setExpression(name) {
    const el = comms();
    if (!el) return;
    el.classList.remove("expr-success", "expr-hint", "expr-talk", "expr-salute", "talking");
    clearTimeout(exprTimer);
    updateLegend();
    if (name === "salute") {
      sticky = true;
      el.classList.add("expr-salute");
      setPose("salute");
      updateLegend();
      return;
    }
    if (name === "idle" || name === "clear") {
      sticky = false;
      setPose("idle");
      return;
    }
    if (name === "talk" || name === "talking") {
      el.classList.add("talking");
      if (!sticky) setPose("talk");
      updateLegend();
      return;
    }
    if (name === "success") {
      sticky = false;
      el.classList.add("expr-success");
      setPose("success");
      updateLegend();
      exprTimer = setTimeout(function () {
        el.classList.remove("expr-success");
        updateLegend();
        if (!sticky && !(window.DemoAudio && DemoAudio.talking)) setPose("idle");
      }, 2800);
      return;
    }
    if (name === "hint") {
      sticky = false;
      el.classList.add("expr-hint");
      setPose("hint");
      updateLegend();
      exprTimer = setTimeout(function () {
        el.classList.remove("expr-hint");
        updateLegend();
        if (!sticky && !(window.DemoAudio && DemoAudio.talking)) setPose("idle");
      }, 2800);
    }
  }

  function startTalk() {
    const el = comms();
    if (el) el.classList.add("talking");
    if (!sticky && pose !== "success" && pose !== "hint" && pose !== "salute") setPose("talk");
    updateLegend();
  }

  function stopTalk() {
    const el = comms();
    if (el) el.classList.remove("talking");
    setTalk(0);
    /* Do not stopVo here — cutting the line mid-sentence was a clarity bug.
       Skip calls DemoAudio.stopVo() directly. */
    updateLegend();
    if (sticky) setPose("salute");
    else if (pose === "success" || pose === "hint") { /* hold until exprTimer */ }
    else setPose("idle");
  }

  function resolveType() {
    if (typeTimer) { clearInterval(typeTimer); typeTimer = 0; }
    if (typeResolve) { const r = typeResolve; typeResolve = null; r(); }
  }

  function typeText(el, text) {
    resolveType();
    const C = window.DEMO || {};
    const ms = (C.timing && C.timing.typeMsPerChar) || 16;
    return new Promise(function (resolve) {
      typeResolve = resolve;
      if (!el) { resolve(); return; }
      if (reduced || !text) { el.textContent = text || ""; resolve(); return; }
      let i = 1;
      el.textContent = text.slice(0, 1);
      typeTimer = setInterval(function () {
        i += 1;
        el.textContent = text.slice(0, i);
        if (i >= text.length) resolveType();
      }, ms);
    });
  }

  function startBlinks() {
    stopBlinks();
    const C = window.DEMO || {};
    const every = (C.timing && C.timing.blinkEveryMs) || 3800;
    function tick() {
      const w = wrap();
      if (w) {
        w.classList.add("blink-on");
        setTimeout(function () { w.classList.remove("blink-on"); }, 120);
      }
      const jitter = every * (0.7 + Math.random() * 0.8);
      blinkTimer = setTimeout(tick, jitter);
    }
    blinkTimer = setTimeout(tick, every);
  }

  function stopBlinks() {
    if (blinkTimer) { clearTimeout(blinkTimer); blinkTimer = 0; }
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (reduced) { setTalk(0); return; }
    const talking = window.DemoAudio && DemoAudio.talking;
    const el = comms();
    if (talking) {
      if (el) el.classList.add("talking");
      setTalk(DemoAudio.amplitude());
    } else {
      if (el) el.classList.remove("talking");
      setTalk(0);
    }
    updateLegend();
  }

  function init(opts) {
    reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const img = $("frog");
    const C = window.DEMO;
    preloadPoses();
    if (img && C && C.assets) {
      img.src = poseSrc("idle");
      img.setAttribute("data-pose", "idle");
    }
    startBlinks();
    if (!raf) loop();
    return true;
  }

  window.DemoFrog = {
    init, typeText, startTalk, stopTalk, setExpression, setPose, setTalk, updateLegend, startBlinks, stopBlinks, resolveType,
    get pose() { return pose; }
  };
})();
