/* Load the swappable guide pack named in DEMO.guidePack.
   The frog pack is only an example — users may edit or replace it. */
(function () {
  "use strict";
  const DEMO = (window.DEMO = window.DEMO || {});

  function packBase(id) {
    return "guide-packs/" + encodeURI(id) + "/";
  }
  function resolve(base, p) {
    if (p == null || p === "") return p;
    if (/^(https?:|data:|blob:)/i.test(p)) return p;
    if (p.charAt(0) === "/") return p;
    return base + p.replace(/^\.\//, "");
  }

  function applyTheme(theme, lamps) {
    const root = document.documentElement;
    const all = Object.assign({}, theme || {});
    if (lamps) {
      if (lamps.live) all.lampLive = lamps.live;
      if (lamps.liveGlow) all.lampLiveGlow = lamps.liveGlow;
      if (lamps.clear) all.lampClear = lamps.clear;
      if (lamps.hint) all.lampHint = lamps.hint;
      if (lamps.radio) all.lampRadio = lamps.radio;
    }
    Object.keys(all).forEach(function (k) {
      const css = k.replace(/[A-Z]/g, function (m) { return "-" + m.toLowerCase(); });
      root.style.setProperty("--" + css, all[k]);
    });
  }

  function mergeLines(pack) {
    DEMO.lines = Object.assign({}, pack.lines || {});
    const lvlScripts = pack.levels || {};
    const asObj = Array.isArray(lvlScripts)
      ? lvlScripts.reduce(function (acc, row) { if (row && row.id) acc[row.id] = row; return acc; }, {})
      : lvlScripts;
    (DEMO.levels || []).forEach(function (lv) {
      const row = asObj[lv.id] || {};
      ["brief", "hint", "success", "why"].forEach(function (field) {
        if (row[field]) lv[field] = row[field];
      });
    });
  }

  function applyPack(pack, id) {
    const base = packBase(id);
    DEMO.guide = pack;
    DEMO.guidePackId = id;
    DEMO.guidePackBase = base;
    if (pack.theme) DEMO.colors = pack.theme;
    if (pack.lamps) DEMO.lamps = pack.lamps;
    applyTheme(pack.theme, pack.lamps);
    if (pack.bootLines) DEMO.bootLines = pack.bootLines;
    if (pack.radio) DEMO.radio = pack.radio;
    if (pack.voice) DEMO.voice = pack.voice;
    if (pack.voices) {
      DEMO.voices = pack.voices.map(function (v) {
        const copy = Object.assign({}, v);
        if (copy.dir) copy.dir = resolve(base, copy.dir);
        if (copy.dir && copy.dir.slice(-1) !== "/") copy.dir += "/";
        return copy;
      });
    }
    if (pack.poseMap) DEMO.poseMap = pack.poseMap;
    const A = DEMO.assets || (DEMO.assets = {});
    const PA = pack.assets || {};
    const ch = pack.character || {};
    if (ch.portrait || PA.portrait) A.portrait = resolve(base, ch.portrait || PA.portrait);
    if (ch.poses) {
      A.poses = {};
      Object.keys(ch.poses).forEach(function (k) { A.poses[k] = resolve(base, ch.poses[k]); });
    }
    ["startStill", "completeStill", "coldOpen", "telemetryBed", "mediaStill", "embedPoster"].forEach(function (k) {
      if (PA[k]) A[k] = resolve(base, PA[k]);
    });
    if (pack.voiceDir) A.voiceDir = resolve(base, pack.voiceDir);
    if (pack.sfxDir) A.sfxDir = resolve(base, pack.sfxDir);
    if (A.voiceDir && A.voiceDir.slice(-1) !== "/") A.voiceDir += "/";
    if (A.sfxDir && A.sfxDir.slice(-1) !== "/") A.sfxDir += "/";
    if (pack.embed) {
      DEMO.embed = Object.assign({}, DEMO.embed || {}, pack.embed);
      if (DEMO.embed.poster) DEMO.embed.poster = resolve(base, DEMO.embed.poster);
    }
    mergeLines(pack);
    const who = document.querySelector(".comms .who");
    if (who && ch.commsWho) who.textContent = ch.commsWho;
    const tag = document.getElementById("commsTag");
    if (tag && ch.commsTag) tag.textContent = ch.commsTag;
    return pack;
  }

  async function load() {
    const id = DEMO.guidePack || "frogpost";
    const url = packBase(id) + "manifest.json";
    const r = await fetch(url);
    if (!r.ok) throw new Error("Guide pack not found: " + url + " (" + r.status + ")");
    const pack = await r.json();
    applyPack(pack, id);
    return pack;
  }

  window.DEMO_PACK_READY = load().catch(function (e) {
    console.error(e);
    throw e;
  });
  window.DemoGuidePack = { load, applyPack, resolve, packBase };
})();
