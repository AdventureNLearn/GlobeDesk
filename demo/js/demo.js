/* GlobeDesk full mission: boot, sectors, player-driven levels, auto-fly only with ?auto=1. */
(function () {
  "use strict";
  const C = window.DEMO;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const auto = params.has("auto") && params.get("auto") !== "0";
  const record = params.has("record") && params.get("record") !== "0";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const state = {
    ready: false,
    deskReady: false,
    streetsWarmed: false,
    buildingsCount: 0,
    roadsCount: 0,
    phase: "boot",
    done: false,
    errors: [],
    cues: [],
    xp: 0,
    badges: [],
    rank: (C.ranks && C.ranks[0] && C.ranks[0].label) || "RECRUIT",
    muted: params.has("muted"),
    skip: false,
    levelIndex: -1,
    levelId: "",
    speaking: false,
    startedAt: 0,
    completedAt: 0,
    missionStarted: false,
    hinted: {},
    continueWait: null,
    continueResolve: null
  };

  function logError(msg, src) {
    state.errors.push((src ? src + ": " : "") + msg);
    try { console.error("[demo]", src || "", msg); } catch (e) {}
  }

  function cue(id, extra) {
    state.cues.push({ t: performance.now(), id: id, extra: extra || null, phase: state.phase, level: state.levelId });
  }

  function applyColors() {
    const root = document.documentElement;
    const c = C.colors || {};
    Object.keys(c).forEach(function (k) {
      // colors are already in CSS :root; keep a hook for live edits
      root.style.setProperty("--" + k.replace(/[A-Z]/g, function (m) { return "-" + m.toLowerCase(); }), c[k]);
    });
  }

  function currentRank() {
    const ranks = C.ranks || [];
    let r = ranks[0] || { label: "RECRUIT", id: "recruit" };
    ranks.forEach(function (row) { if (state.xp >= row.minXp) r = row; });
    return r;
  }

  function renderBar() {
    const lvl = C.levels[state.levelIndex];
    $("lvlLabel").textContent = state.phase === "complete" || state.phase === "debrief"
      ? "MISSION COMPLETE"
      : (lvl ? ("LVL " + lvl.num + " · " + lvl.title) : (state.phase === "boot" ? "BOOT" : "MISSION STANDBY"));
    $("xpLabel").textContent = "XP " + String(state.xp).padStart(4, "0");
    const rank = currentRank();
    const el = $("rankLabel");
    if (rank.label !== state.rank) {
      state.rank = rank.label;
      el.classList.add("up");
      if (window.DemoAudio) DemoAudio.playSfx("rank-up.wav", 0.7);
      setTimeout(function () { el.classList.remove("up"); }, 900);
    }
    el.textContent = rank.label;
    const row = $("badgeRow");
    row.innerHTML = "";
    C.levels.forEach(function (level) {
      const b = document.createElement("span");
      b.className = "badge" + (state.badges.indexOf(level.badge.id) >= 0 ? " on" : "");
      b.textContent = level.badge.label;
      row.appendChild(b);
    });
    $("ltMission").textContent = lvl ? lvl.sector : (state.phase === "complete" ? "COMPLETE" : "STANDBY");
  }

  function radioOn() {
    if (window.DemoRadio) DemoRadio.fadeIn();
    cue("radio", "on");
  }
  function radioOff() {
    if (window.DemoRadio) DemoRadio.fadeOut();
    cue("radio", "off");
  }

  function renderLog() {
    const ol = $("logList");
    const box = $("log");
    ol.innerHTML = "";
    C.levels.forEach(function (level, i) {
      const li = document.createElement("li");
      const got = state.badges.indexOf(level.badge.id) >= 0;
      li.textContent = String(level.num).padStart(2, "0") + "  " + level.title;
      if (!got && i !== state.levelIndex) li.className = "pending";
      if (i === state.levelIndex) li.style.color = "var(--cyan-glow)";
      if (got) li.style.color = "var(--green)";
      ol.appendChild(li);
    });
    if (box) box.classList.toggle("empty", !ol.childElementCount);
  }

  function showScreen(id) {
    ["screen-start", "screen-cold", "screen-complete"].forEach(function (s) {
      const el = $(s);
      if (!el) return;
      if (s === id) el.classList.remove("hidden");
      else el.classList.add("hidden");
    });
  }

  function setButtons(opts) {
    opts = opts || {};
    $("btnHint").disabled = !opts.hint;
    $("btnAssist").disabled = !opts.assist;
    $("btnContinue").disabled = !opts.cont;
  }

  function waitContinue() {
    return new Promise(function (resolve) {
      state.continueResolve = resolve;
    });
  }

  function requestContinue() {
    if (state.continueResolve) {
      const r = state.continueResolve;
      state.continueResolve = null;
      r();
    }
  }

  function resolveLine(key) {
    if (C.lines && C.lines[key]) return { key: key, text: C.lines[key].text, spoken: C.lines[key].spoken };
    const m = String(key).match(/^([a-z0-9]+)-(brief|hint|success|why)$/i);
    if (m) {
      const lvl = C.levels.find(function (l) { return l.id === m[1]; });
      if (lvl && lvl[m[2]]) return { key: key, text: lvl[m[2]].text, spoken: lvl[m[2]].spoken };
    }
    return { key: key, text: key, spoken: key };
  }

  function poseFor(key) {
    const map = C.poseMap || {};
    if (map[key]) return map[key];
    if (/-success$/.test(key)) return map.success || "success";
    if (/-hint$/.test(key)) return map.hint || "hint";
    if (key === "finale" || key === "debrief") return map.finale || map.debrief || "salute";
    return map.default || "talk";
  }

  let captionPager = null;

  function stopCaptionPages() {
    if (!captionPager) return;
    (captionPager.timers || []).forEach(function (id) { clearTimeout(id); });
    captionPager = null;
  }

  function captionPagesFor(text) {
    const el = $("caption");
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (!el || !words.length) return [];
    const probe = el.cloneNode(false);
    probe.removeAttribute("id");
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.height = "auto";
    probe.style.maxHeight = "none";
    probe.style.overflow = "visible";
    el.parentNode.appendChild(probe);
    const cs = getComputedStyle(probe);
    let lh = parseFloat(cs.lineHeight);
    if (!lh || Number.isNaN(lh)) lh = (parseFloat(cs.fontSize) || 22) * 1.3;
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const maxH = lh * 2 + padY + 1;
    const pages = [];
    let i = 0;
    while (i < words.length) {
      let fit = i + 1;
      for (let j = i + 1; j <= words.length; j++) {
        probe.textContent = words.slice(i, j).join(" ");
        if (probe.scrollHeight > maxH) break;
        fit = j;
      }
      pages.push(words.slice(i, fit).join(" "));
      i = fit;
    }
    probe.remove();
    return pages;
  }

  function showCaption(text, durationMs) {
    stopCaptionPages();
    const el = $("caption");
    const full = String(text || "");
    if (!el) return { pages: [] };
    if (!full) { el.textContent = ""; return { pages: [] }; }
    el.textContent = full;
    const pages = captionPagesFor(full);
    if (pages.length <= 1) {
      el.textContent = full;
      return { pages: pages };
    }
    const weights = pages.map(function (p) { return Math.max(1, p.length); });
    const total = weights.reduce(function (a, b) { return a + b; }, 0);
    const budget = Math.max(Number(durationMs) || 0, pages.length * 1400);
    el.textContent = pages[0];
    const timers = [];
    let t = 0;
    for (let i = 1; i < pages.length; i++) {
      t += budget * (weights[i - 1] / total);
      timers.push(setTimeout((function (page) {
        return function () { el.textContent = page; };
      })(pages[i]), t));
    }
    captionPager = { timers: timers, pages: pages };
    return { pages: pages, budget: budget };
  }

  async function speak(key) {

    const line = resolveLine(key);
    const text = line.text || "";
    cue("line", key);
    $("speech").textContent = text;
    state.speaking = true;
    // Queue: wait until this line actually starts (never cut the previous one).
    const dur = await DemoAudio.playVo(key);
    showCaption(text, dur ? dur * 1000 : 0);
    if (state.skip) {
      DemoFrog.stopTalk();
      state.speaking = false;
      return;
    }
    DemoFrog.setExpression(poseFor(key));
    DemoFrog.startTalk();
    const typed = DemoFrog.typeText($("speech"), text);
    const typeBudget = Math.min(2200, (text.length || 8) * ((C.timing && C.timing.typeMsPerChar) || 16) + 200);
    await Promise.race([typed, sleep(typeBudget)]);
    $("speech").textContent = text;
    // Don't stall on audio onended (often silent in headless). Wait the full
    // computed duration so a long line is never cut off when the next starts.
    const remain = state.skip ? 0 : Math.max(0, (dur ? dur * 1000 - typeBudget : 500));
    if (remain > 0) await sleep(remain);
    DemoFrog.stopTalk();
    state.speaking = false;
  }

  async function playBoot() {
    state.phase = "boot";
    cue("boot");
    const boot = $("boot");
    const list = $("bootLines");
    const bar = $("bootBar");
    boot.classList.remove("hidden");
    document.body.classList.add("booting");
    radioOn();
    list.innerHTML = "";
    const lines = C.bootLines || ["COMMS LINK ……………… ONLINE"];
    lines.forEach(function (t) {
      const li = document.createElement("li");
      li.textContent = t;
      list.appendChild(li);
    });
    DemoAudio.playSfx("ui-boot.wav", 0.6);
    speak("boot").catch(function () {});
    const items = list.querySelectorAll("li");
    const total = (C.timing && C.timing.bootSec) || 6.5;
    const step = (total * 1000 - 400) / Math.max(1, items.length);
    for (let i = 0; i < items.length; i++) {
      if (state.skip) break;
      items.forEach(function (li) { li.classList.remove("run"); });
      items[i].classList.add("on", "run");
      bar.style.width = String(Math.round(((i + 1) / items.length) * 100)) + "%";
      DemoAudio.playSfx("ui-blip.wav", 0.35);
      await sleep(step);
    }
    items.forEach(function (li) { li.classList.add("on"); li.classList.remove("run"); });
    bar.style.width = "100%";
    await sleep(280);
    boot.classList.add("hidden");
    document.body.classList.remove("booting");
    state.skip = false;
    if (window.DemoDesk) DemoDesk.setKioskMode("globe");
  }

  async function sectorTransition(level) {
    state.phase = "sector";
    cue("sector", level.id);
    DemoAudio.playSfx("sector-whoosh.wav", 0.55);
    const wipe = $("wipe");
    const sec = $("sector");
    $("sectorId").textContent = level.sector;
    $("sectorTitle").textContent = level.title;
    wipe.classList.remove("on");
    void wipe.offsetWidth;
    wipe.classList.add("on");
    sec.classList.add("on");
    await sleep(state.skip ? 200 : 1200);
    sec.classList.remove("on");
    setTimeout(function () { wipe.classList.remove("on"); }, 700);
  }

  function award(level) {
    const prev = currentRank();
    state.xp += level.xp || 0;
    if (level.badge && state.badges.indexOf(level.badge.id) < 0) state.badges.push(level.badge.id);
    cue("award", level.id);
    DemoAudio.playSfx("success-chime.wav", 0.65);
    DemoFrog.setExpression("success");
    const next = currentRank();
    renderBar();
    renderLog();
    return next.id !== prev.id;
  }

  async function runLevel(index) {
    const level = C.levels[index];
    state.levelIndex = index;
    state.levelId = level.id;
    state.phase = "level";
    state.skip = false;
    state.hinted[level.id] = false;
    DemoDesk.hideKit();
    DemoDesk.setKioskMode(level.kiosk || "globe");
    try { DemoDesk.applyKioskLook({ captionsOn: level.id === "captions" }); } catch (e) {}
    $("objective").classList.remove("empty");
    $("objective").textContent = "OBJECTIVE · " + level.objective;
    renderBar();
    renderLog();
    cue("level", level.id);
    await sectorTransition(level);
    state.phase = "level";
    setButtons({ hint: true, assist: true, cont: false });
    const briefKey = level.id + "-brief";
    const briefP = speak(briefKey);

    let hintTimer = 0;
    let assistTimer = 0;
    const clearTimers = function () {
      if (hintTimer) clearTimeout(hintTimer);
      if (assistTimer) clearTimeout(assistTimer);
      hintTimer = 0;
      assistTimer = 0;
    };

    hintTimer = setTimeout(function () {
      if (DemoDesk.objectiveMet(level.id) || state.skip) return;
      state.hinted[level.id] = true;
      DemoFrog.setExpression("hint");
      DemoAudio.playSfx("hint-tick.wav", 0.5);
      speak(level.id + "-hint").catch(function () {});
    }, C.timing.hintAfterMs || 12000);

    if (auto) {
      assistTimer = setTimeout(function () {
        if (!DemoDesk.objectiveMet(level.id) && !state.skip) {
          cue("autoAssist", level.id);
          DemoDesk.assist(level.id);
        }
      }, C.timing.autoAssistAfterMs || 1800);
    }

    await briefP.catch(function () {});

    const t0 = Date.now();
    const hardCap = 90000;
    while (!state.skip && Date.now() - t0 < hardCap) {
      if (DemoDesk.objectiveMet(level.id)) break;
      await sleep(120);
    }
    clearTimers();
    if (!DemoDesk.objectiveMet(level.id)) {
      cue("assist", level.id);
      await speak("assist").catch(function () {});
      await DemoDesk.assist(level.id);
      const t1 = Date.now();
      while (!state.skip && Date.now() - t1 < 8000 && !DemoDesk.objectiveMet(level.id)) await sleep(120);
    }

    if (DemoDesk.objectiveMet(level.id)) award(level);
    if (window.DemoDesk && DemoDesk.streetStats) {
      state.buildingsCount = DemoDesk.streetStats.buildings || state.buildingsCount;
      state.roadsCount = DemoDesk.streetStats.roads || state.roadsCount;
    }
    setButtons({ hint: false, assist: false, cont: true });
    const hold = (level.autoHoldSec || C.timing.autoHoldSec || 10) * 1000;
    const vo = (async function () {
      await speak(level.id + "-success").catch(function () {});
      await speak(level.id + "-why").catch(function () {});
    })();
    if (auto) {
      const tHold = Date.now();
      while (!state.skip && Date.now() - tHold < hold) await sleep(120);
      await vo;
    } else {
      await vo;
      await waitContinue();
      state.skip = false;
    }
    setButtons({ hint: false, assist: false, cont: false });
    state.skip = false;
  }

  async function playColdOpen() {
    state.phase = "cold";
    cue("cold");
    showScreen("screen-cold");
    const v = $("v1");
    v.currentTime = 0;
    v.muted = state.muted;
    const play = v.play();
    if (play && play.catch) play.catch(function () {});
    speak("coldopen").catch(function () {});
    const hold = (C.timing.coldOpen || 6.5) * 1000;
    const t0 = Date.now();
    while (!state.skip && Date.now() - t0 < hold) await sleep(80);
    try { v.pause(); } catch (e) {}
    showScreen(null);
    state.skip = false;
  }

  function renderDebrief() {
    const box = $("debrief");
    const sec = state.completedAt && state.startedAt ? Math.round((state.completedAt - state.startedAt) / 1000) : 0;
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    box.innerHTML = "";
    const h = document.createElement("h3");
    h.textContent = "MISSION DEBRIEF";
    box.appendChild(h);
    const dl = document.createElement("dl");
    const rows = [
      ["Time on desk", mm + ":" + ss],
      ["XP", String(state.xp)],
      ["Rank", currentRank().label],
      ["Sectors cleared", String(state.badges.length) + " / " + String(C.levels.length)],
      ["3D buildings (cached)", String(state.buildingsCount || DemoDesk.streetStats.buildings || 0)],
      ["Road features (cached)", String(state.roadsCount || DemoDesk.streetStats.roads || 0)]
    ];
    rows.forEach(function (pair) {
      const dt = document.createElement("dt"); dt.textContent = pair[0];
      const dd = document.createElement("dd"); dd.textContent = pair[1];
      dl.appendChild(dt); dl.appendChild(dd);
    });
    box.appendChild(dl);
    const row = document.createElement("div");
    row.className = "badge-row";
    state.badges.forEach(function (id) {
      const lvl = C.levels.find(function (l) { return l.badge.id === id; });
      const s = document.createElement("span");
      s.className = "badge on";
      s.textContent = lvl ? lvl.badge.label : id;
      row.appendChild(s);
    });
    box.appendChild(row);
    box.classList.add("on");
    $("completeTag").textContent = C.brand.completeLine1 + " — " + C.brand.completeLine2;
  }

  async function playFinale() {
    state.phase = "finale";
    cue("finale");
    radioOn();
    DemoDesk.hideKit();
    DemoDesk.setKioskMode("globe");
    try { await DemoDesk.goOrbit(); } catch (e) {}
    DemoFrog.setExpression("salute");
    await speak("finale").catch(function () {});
    state.xp += 200;
    cue("award", "finale");
    renderBar();
    state.phase = "complete";
    state.completedAt = performance.now();
    showScreen("screen-complete");
    renderDebrief();
    state.phase = "debrief";
    cue("debrief");
    renderBar();
    await speak("debrief").catch(function () {});
    setButtons({ hint: false, assist: false, cont: false });
    if (auto) await sleep(state.skip ? 400 : 5000);
    state.done = true;
    cue("done");
  }

  async function runMission() {
    state.startedAt = performance.now();
    cue("mission");
    await playColdOpen();
    radioOff();
    for (let i = 0; i < C.levels.length; i++) {
      if (state.done) break;
      await runLevel(i);
    }
    await playFinale();
  }

  function begin() {
    if (state.missionStarted) return;
    state.missionStarted = true;
    cue("begin");
    DemoAudio.resume();
    DemoAudio.playSfx("ui-click.wav", 0.5);
    radioOn();
    showScreen(null);
    runMission().catch(function (e) { logError(e && e.message || e, "runMission"); });
  }

  function skip() {
    state.skip = true;
    stopCaptionPages();
    DemoFrog.resolveType();
    if (window.DemoAudio) DemoAudio.stopVo();
    DemoAudio.playSfx("ui-click.wav", 0.4);
    requestContinue();
    cue("skip");
  }

  function toggleMute() {
    state.muted = !state.muted;
    DemoAudio.setMuted(state.muted);
    const v = $("v1");
    if (v) v.muted = state.muted;
    $("btnMute").setAttribute("aria-pressed", state.muted ? "true" : "false");
    $("btnMute").textContent = state.muted ? "Unmute" : "Mute";
    cue("mute", state.muted);
  }

  function replay() {
    const q = [];
    if (auto) q.push("auto=1");
    if (record) q.push("record=1");
    if (state.muted) q.push("muted=1");
    location.href = location.pathname + (q.length ? "?" + q.join("&") : "");
  }

  function publishHook() {
    window.__demo = {
      get ready() { return state.ready; },
      get deskReady() { return state.deskReady; },
      get streetsWarmed() { return state.streetsWarmed; },
      get buildingsCount() { return state.buildingsCount; },
      get roadsCount() { return state.roadsCount; },
      get phase() { return state.phase; },
      get done() { return state.done; },
      get errors() { return state.errors.slice(); },
      get cues() { return state.cues.slice(); },
      get xp() { return state.xp; },
      get badges() { return state.badges.slice(); },
      get rank() { return currentRank().label; },
      get levelId() { return state.levelId; },
      get levelIndex() { return state.levelIndex; },
      begin, skip, toggleMute, speak, replay, showCaption, captionPagesFor,
      record,
      enterDebriefPreview: function () {
        state.phase = "debrief";
        const line = resolveLine("finale");
        $("speech").textContent = (line && line.text) || "";
        showCaption((line && line.text) || "");
        showScreen("screen-complete");
        renderDebrief();
        if (window.DemoDesk) DemoDesk.setKioskMode("globe");
        DemoFrog.setExpression("salute");
        DemoFrog.stopTalk();
        radioOn();
        renderBar();
      },
      radioStatus: function () { return window.DemoRadio ? DemoRadio.status() : null; },
      state
    };
  }

  async function boot() {
    if (window.DEMO_PACK_READY) await window.DEMO_PACK_READY;
    applyColors();
    $("frog").src = C.assets.portrait;
    $("screen-start").style.backgroundImage = "url(" + C.assets.startStill + ")";
    $("screen-complete").style.backgroundImage = "url(" + C.assets.completeStill + ")";
    $("completeTag").textContent = C.brand.completeLine1 + " — " + C.brand.completeLine2;
    $("v1").src = C.assets.coldOpen;
    $("v1").muted = state.muted;
    if (state.muted) {
      $("btnMute").setAttribute("aria-pressed", "true");
      $("btnMute").textContent = "Unmute";
    }
    renderBar();
    renderLog();
    setButtons({ hint: false, assist: false, cont: false });
    publishHook();

    $("btnBegin").addEventListener("click", begin);
    $("btnSkip").addEventListener("click", skip);
    $("btnMute").addEventListener("click", toggleMute);
    $("btnReplay").addEventListener("click", replay);
    $("btnHint").addEventListener("click", function () {
      const level = C.levels[state.levelIndex];
      if (!level) return;
      DemoAudio.playSfx("hint-tick.wav", 0.5);
      DemoFrog.setExpression("hint");
      speak(level.id + "-hint").catch(function () {});
    });
    $("btnAssist").addEventListener("click", function () {
      const level = C.levels[state.levelIndex];
      if (!level) return;
      DemoAudio.playSfx("ui-click.wav", 0.45);
      cue("assist", level.id);
      speak("assist").then(function () { return DemoDesk.assist(level.id); }).catch(function () {});
    });
    $("btnContinue").addEventListener("click", function () {
      DemoAudio.playSfx("ui-click.wav", 0.45);
      requestContinue();
    });

    await DemoAudio.init({ muted: state.muted });
    if (window.DemoRadio) DemoRadio.init({ muted: state.muted, record: record });
    if (window.DemoVoiceLab) DemoVoiceLab.init();
    DemoFrog.init();

    const deskP = DemoDesk.waitReady().then(async function (ok) {
      state.deskReady = !!ok;
      if (ok) {
        cue("deskReady");
        const stats = await DemoDesk.warmupStreets();
        state.streetsWarmed = !!(stats && (stats.ok || stats.buildings > 0));
        state.buildingsCount = (stats && stats.buildings) || 0;
        state.roadsCount = (stats && stats.roads) || 0;
        cue("warmup", stats);
      } else {
        logError("GlobeDesk iframe did not become ready in time", "waitDesk");
      }
    }).catch(function (e) { logError(e && e.message || e, "desk"); });

    state.ready = true;
    cue("ready");

    await playBoot();
    state.phase = "start";
    showScreen("screen-start");
    DemoAudio.startAmbience();
    speak("start").catch(function () {});
    cue("startScreen");

    if (auto) {
      await deskP;
      const hold = ((C.timing && C.timing.startHoldAuto) || 6.5) * 1000;
      const t0 = Date.now();
      while (!state.missionStarted && !state.skip && Date.now() - t0 < hold) await sleep(80);
      begin();
    }
    await deskP;
  }


  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
