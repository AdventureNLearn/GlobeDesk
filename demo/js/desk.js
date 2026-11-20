/* Same-origin GlobeDesk desk controls for the mission. */
(function () {
  "use strict";
  const C = () => window.DEMO;
  const done = {};
  const flags = { terrainOn: false, episodeLoaded: false, edited: false, kitOpen: false, validated: false };
  let streetStats = { buildings: 0, roads: 0 };
  let startBearing = 0;
  let spun = false;
  let spinHooked = false;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function deskFrame() { return document.getElementById("desk"); }
  function deskWin() {
    const f = deskFrame();
    return f && f.contentWindow;
  }
  function GD() {
    const w = deskWin();
    return w && w.GD;
  }
  function map() {
    const g = GD();
    return g && g.globe && g.globe.st && g.globe.st.map;
  }
  function story() {
    const g = GD();
    const ep = g && g.state && g.state.episode;
    return ep && ep.stories && ep.stories[g.state.storyIdx || 0];
  }

  function injectKiosk() {
    const w = deskWin();
    if (!w || !w.document || !w.document.head) return false;
    if (w.document.getElementById("gd-demo-kiosk")) {
      try { const m = map(); if (m) m.resize(); } catch (e) {}
      return true;
    }
    const link = w.document.createElement("link");
    link.id = "gd-demo-kiosk";
    link.rel = "stylesheet";
    link.href = demoRoot() + "css/kiosk.css";
    link.addEventListener("load", function () { try { const m = map(); if (m) m.resize(); } catch (e) {} });
    w.document.head.appendChild(link);
    try { if (w.GD && w.GD.state) w.GD.state.browserVoice = false; } catch (e) {}
    try { const m = map(); if (m) setTimeout(function () { m.resize(); }, 80); } catch (e) {}
    return true;
  }

  function setKioskMode(mode) {
    const w = deskWin();
    if (!w || !w.document || !w.document.documentElement) return;
    const html = w.document.documentElement;
    html.classList.remove("kiosk-globe", "kiosk-inspect", "kiosk-readable", "kiosk-kit");
    if (mode) html.classList.add("kiosk-" + mode);
    document.body.dataset.kiosk = mode || "";
    const bump = function () {
      try {
        const w = deskWin();
        if (w) w.dispatchEvent(new Event("resize"));
        const m = map();
        if (m) m.resize();
      } catch (e) {}
    };
    setTimeout(bump, 60);
    setTimeout(bump, 280);
  }

  function applyKioskLook(opts) {
    const g = GD();
    if (!g || !g.state || !g.state.episode) return;
    const cap = !!(opts && opts.captionsOn);
    g.state.episode.look = Object.assign({}, g.state.episode.look, {
      header: false,
      captionsOn: cap,
      safeArea: false,
      citations: false,
      lowerThird: false
    });
    if (g.ui && g.ui.renderOverlays) g.ui.renderOverlays();
  }

  function hookSpin() {
    if (spinHooked) return;
    const m = map();
    if (!m) return;
    spinHooked = true;
    try { startBearing = m.getBearing(); } catch (e) { startBearing = 0; }
    const mark = function () {
      try {
        const b = m.getBearing();
        if (Math.abs(((b - startBearing + 540) % 360) - 180) > 18) spun = true;
      } catch (e) {}
    };
    m.on("rotate", mark);
    m.on("dragend", mark);
    m.on("moveend", mark);
  }

  function whenMapIdle(timeoutMs) {
    const m = map();
    if (!m) return Promise.resolve(false);
    return new Promise(function (resolve) {
      let settled = false;
      const done = function () {
        if (settled) return;
        settled = true;
        try { m.off("idle", done); } catch (e) {}
        resolve(true);
      };
      try { m.once("idle", done); } catch (e) { done(); }
      setTimeout(done, timeoutMs || 8000);
    });
  }

  function countLayer(id) {
    const m = map();
    if (!m || !m.querySourceFeatures) return 0;
    try {
      const src = m.getSource(id) ? id : null;
      if (src) return m.querySourceFeatures(src).length;
      return m.queryRenderedFeatures({ layers: [id] }).length;
    } catch (e) {
      try { return m.queryRenderedFeatures({ layers: [id] }).length; } catch (e2) { return 0; }
    }
  }

  function readStreetStats() {
    const buildings = countLayer("gd-buildings") || countLayer("building") || 0;
    const roads = countLayer("roads") || countLayer("road") || countLayer("road-casing") || 0;
    streetStats = { buildings, roads };
    return streetStats;
  }

  async function waitForStreets(timeoutMs) {
    const t0 = Date.now();
    let stats = readStreetStats();
    while (Date.now() - t0 < (timeoutMs || 12000)) {
      stats = readStreetStats();
      const m = map();
      let z = 0;
      try { z = m && m.getZoom(); } catch (e) {}
      if (z >= 15.2 && stats.buildings > 20) {
        return Object.assign({ ok: true, zoom: z }, stats);
      }
      await sleep(300);
    }
    const m = map();
    let z = 0;
    try { z = m && m.getZoom(); } catch (e) {}
    return Object.assign({ ok: stats.buildings > 0, zoom: z }, readStreetStats());
  }

  function fly(kf, durationSec) {
    const g = GD();
    const m = map();
    if (!g || !m) return Promise.resolve(false);
    const dur = durationSec != null ? durationSec : (kf.durationSec || 3);
    return new Promise(function (resolve) {
      let settled = false;
      const done = function () {
        if (settled) return;
        settled = true;
        try { m.off("moveend", done); } catch (e) {}
        resolve(true);
      };
      m.once("moveend", done);
      g.globe.flyTo({
        center: kf.center,
        zoom: kf.zoom,
        pitch: kf.pitch,
        bearing: kf.bearing,
        durationSec: dur,
        ease: "cinematic"
      });
      setTimeout(done, dur * 1000 + 800);
    });
  }

  async function goOrbit() {
    const o = C().orbit;
    const m = map();
    if (m) {
      try { m.jumpTo({ center: o.center, zoom: o.zoom, pitch: o.pitch, bearing: o.bearing }); } catch (e) {}
    } else {
      await fly(o, 1.2);
    }
    startBearing = o.bearing || 0;
    spun = false;
  }

  async function warmupStreets() {
    const t = C().streetTarget;
    const m = map();
    if (!m) return { ok: false };
    m.jumpTo({ center: [t.lon, t.lat], zoom: t.zoom, pitch: t.pitch, bearing: t.bearing });
    const stats = await waitForStreets(C().timing.warmupTimeoutMs || 20000);
    await goOrbit();
    return stats;
  }

  async function waitReady() {
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      const w = deskWin();
      try { injectKiosk(); } catch (e) {}
      if (w && w.GD && w.GD.globe && w.GD.globe.st && w.GD.globe.st.map) {
        const m = w.GD.globe.st.map;
        const styled = typeof m.isStyleLoaded !== "function" || m.isStyleLoaded() || w.GD.globe.st.status === "ready";
        if (styled || Date.now() - t0 > 8000) {
          try { m.resize(); } catch (e) {}
          if (!styled) await whenMapIdle(12000);
          try { m.resize(); } catch (e) {}
          try { applyKioskLook(); } catch (e) {}
          hookSpin();
          return true;
        }
      }
      await sleep(200);
    }
    return false;
  }

  function demoRoot() {
    const path = location.pathname || "/";
    const i = path.lastIndexOf("/");
    return (i <= 0) ? "/" : path.slice(0, i + 1);
  }

  function rootUrl(url) {
    const s = String(url || "");
    if (/^https?:/i.test(s)) return s;
    const rel = s.replace(/^\.\//, "").replace(/^\//, "");
    return demoRoot() + rel;
  }

  async function addLocalFile(url, name, type) {
    const w = deskWin();
    const g = GD();
    if (!w || !g || !g.media) return { ok: false, error: "media API missing" };
    const path = rootUrl(url);
    const ctrl = new AbortController();
    const timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 8000);
    try {
      const res = await w.fetch(path, { credentials: "same-origin", signal: ctrl.signal });
      if (!res.ok) return { ok: false, error: "fetch failed " + path + " " + res.status };
      const buf = await res.arrayBuffer();
      const file = new w.File([buf], name, { type: type || res.headers.get("content-type") || "application/octet-stream" });
      return await g.media.addFile(file);
    } catch (e) {
      return { ok: false, error: (e && e.message) || String(e) };
    } finally {
      clearTimeout(timer);
    }
  }

  async function frameSite(durationSec) {
    const t = C().streetTarget;
    const m = map();
    if (!m) return false;
    let z = 0;
    try { z = m.getZoom(); } catch (e) {}
    if (z >= 14) return true;
    const dur = durationSec == null ? 3.2 : durationSec;
    return fly({
      center: [t.lon, t.lat],
      zoom: Math.max(14.5, t.zoom - 1.2),
      pitch: 50,
      bearing: t.bearing,
      durationSec: dur
    }, dur);
  }

  function refreshDesk() {
    const g = GD();
    if (!g) return;
    try { applyKioskLook(g.state && g.state.episode && g.state.episode.look && { captionsOn: !!g.state.episode.look.captionsOn }); } catch (e) {}
    try { if (g.ui && g.ui.changed) g.ui.changed(); } catch (e) {}
    try { if (g.ui && g.ui.renderOverlays) g.ui.renderOverlays(); } catch (e) {}
    try { if (g.ui && g.ui.renderInspector) g.ui.renderInspector(); } catch (e) {}
    try { if (g.content && g.content.render) g.content.render(); } catch (e) {}
    try { if (g.eventsMap && g.eventsMap.refresh) g.eventsMap.refresh(); } catch (e) {}
    try { if (g.globe && g.globe.setEpisode && g.state) g.globe.setEpisode(g.state.episode, g.state.storyIdx || 0); } catch (e) {}
    try { if (g.playback && g.playback.seek) g.playback.seek(Math.max(0.2, g.state.t || 0.2)); } catch (e) {}
  }

  async function ensureEpisode() {
    const g = GD();
    if (!g) return false;
    if (flags.episodeLoaded && g.state && g.state.episode && g.state.episode.stories && g.state.episode.stories.length) {
      return true;
    }
    return loadMissionEpisode();
  }

  async function loadMissionEpisode() {
    const g = GD();
    if (!g) return false;
    const path = C().assets.missionEpisode || "/episodes/mission.json";
    let ep = null;
    if (g.assistant && g.assistant.importSameOrigin) {
      const r = await g.assistant.importSameOrigin(path);
      if (r && r.ok) ep = r.episode;
    }
    if (!ep) {
      const w = deskWin();
      const res = await w.fetch(path, { credentials: "same-origin", redirect: "error" });
      ep = await res.json();
    }
    if (!ep) return false;
    if (g.ui && g.ui.loadEpisode) g.ui.loadEpisode(ep, "Practice episode (validated).");
    else if (g.state) g.state.episode = ep;
    flags.episodeLoaded = true;
    applyKioskLook();
    refreshDesk();
    done.open = true;
    return true;
  }

  async function assistSpin() {
    const m = map();
    const o = C().orbit;
    if (!m) return false;
    hookSpin();
    const from = (function () { try { return m.getBearing(); } catch (e) { return o.bearing || 0; } })();
    const to = from + 70;
    await fly({
      center: o.center,
      zoom: o.zoom,
      pitch: o.pitch,
      bearing: to,
      durationSec: 3.2
    }, 3.2);
    spun = true;
    done.spin = true;
    return true;
  }

  async function assistDive() {
    const t = C().streetTarget;
    const g = GD();
    await fly({
      center: [t.lon, t.lat],
      zoom: t.zoom,
      pitch: t.pitch,
      bearing: t.bearing,
      durationSec: t.diveDurationSec
    }, t.diveDurationSec);
    if (g && g.globe && g.globe.setOverlay) {
      g.globe.setOverlay("terrain", true);
      flags.terrainOn = true;
    }
    const stats = await waitForStreets(14000);
    done.dive = true;
    return stats;
  }

  async function assistOpen() {
    const ok = await loadMissionEpisode();
    setKioskMode("inspect");
    if (ok) done.open = true;
    return ok;
  }

  async function assistEdit() {
    await ensureEpisode();
    const g = GD();
    if (!g || !g.state || !g.state.episode) return false;
    const ep = g.state.episode;
    ep.title = "Desk Online — Mission 01 (edited)";
    const s = story();
    if (s && s.cards && s.cards[0]) {
      s.cards[0].title = "Practice card — tightened";
      s.cards[0].body = "Edited on the desk. Facts that are not known stay [UNKNOWN].";
      s.cards[0].why = "The editor keeps unknown facts unknown.";
    }
    if (g.state) g.state.tab = "cards";
    setKioskMode("inspect");
    refreshDesk();
    flags.edited = true;
    done.edit = true;
    return true;
  }

  async function assistPins() {
    await ensureEpisode();
    const g = GD();
    const t = C().streetTarget;
    if (!g) return false;
    const ep = g.state.episode;
    const s = story();
    s.title = s.title || "Street-level practice";
    s.location = {
      name: t.name,
      lat: t.lat,
      lon: t.lon,
      precision: "approximate",
      verified: false,
      note: "demo city, approximate"
    };
    const card = g.model.blankCard(t.lat, t.lon);
    card.title = "Mission pin";
    card.body = "Practice pin at an approximate city center. Not a news claim.";
    card.why = "Pins mark a site. Unknown facts stay [UNKNOWN].";
    card.at = 0;
    card.dur = 120;
    card.verified = false;
    s.cards = s.cards && s.cards.length ? s.cards : [card];
    if (!s.cards.some(function (c) { return c.title === "Mission pin"; })) s.cards.unshift(card);
    const item = g.content.blank("pin-popup");
    item.title = "Mission pin";
    item.caption = "Approximate city center. Practice only.";
    item.credit = "AdventureNLearn — practice pin, not a news claim";
    item.at = 0;
    item.dur = 0;
    item.visible = true;
    item.pin = { lat: t.lat, lon: t.lon };
    s.content = (s.content || []).filter(function (x) { return x.kind !== "pin-popup"; });
    s.content.push(item);
    if (!ep.eventLayers || !ep.eventLayers.length) {
      const layer = g.events.createLayer("Mission sites (demo)", {
        color: "#30A1C3",
        note: "Practice points only. Approximate."
      });
      layer.features.push(g.events.createFeature("point", {
        type: "Point",
        coordinates: [t.lon, t.lat]
      }, {
        title: "Midtown practice pin",
        verification: "not verified",
        timeApprox: true,
        notes: "Approximate city center for the mission demo.",
        precisionLabel: "Precision: approximate city center, not an event fix",
        example: true,
        category: "other"
      }));
      ep.eventLayers = [layer];
    } else {
      ep.eventLayers.forEach(function (l) { l.visible = true; });
    }
    if (g.state) g.state.tab = "events";
    setKioskMode("inspect");
    refreshDesk();
    await frameSite(3.2);
    refreshDesk();
    done.pins = true;
    return true;
  }

  async function assistMedia() {
    await ensureEpisode();
    const g = GD();
    if (!g) return false;
    const t = C().streetTarget;
    const added = await addLocalFile(C().assets.mediaStill || "/assets/a1-console.jpg", "console-still.jpg", "image/jpeg");
    if (!added || !added.ok) {
      try { if (window.__demo && window.__demo.state) window.__demo.state.errors.push("media add: " + (added && added.error || "failed")); } catch (e) {}
      return false;
    }
    const s = story();
    s.media = s.media || [];
    s.media.push({
      mediaRef: added.ref,
      role: "still",
      at: 0,
      dur: 32,
      caption: "Local console still, kept on this device.",
      citation: "AdventureNLearn — local practice still"
    });
    if (s.cards && s.cards[0]) {
      s.cards[0].mediaRef = added.ref;
    }
    const item = g.content.blank("overlay");
    item.title = "Local still";
    item.caption = "Set as a card. Never uploaded.";
    item.credit = "AdventureNLearn — local practice still";
    item.mediaRef = added.ref;
    item.at = 0;
    item.dur = 0;
    item.visible = true;
    item.overlay = { mode: "pip", x: 6, y: 14, width: 28, height: 30, opacity: 1 };
    s.content = s.content || [];
    s.content.push(item);
    if (g.state) g.state.tab = "cards";
    setKioskMode("inspect");
    refreshDesk();
    await frameSite(2.4);
    refreshDesk();
    done.media = true;
    return true;
  }

  async function assistEmbed() {
    await ensureEpisode();
    const g = GD();
    if (!g) return false;
    const emb = C().embed;
    const s = story();
    const overlay = g.content.blank("overlay");
    overlay.title = "Screen overlay";
    overlay.caption = "The globe stays the globe.";
    overlay.credit = "AdventureNLearn — practice overlay";
    overlay.at = 0;
    overlay.dur = 0;
    overlay.visible = true;
    overlay.overlay = { mode: "pip", x: 6, y: 58, width: 24, height: 22, opacity: 0.92 };
    const recording = !!(window.__demo && window.__demo.record);
    const poster = emb.poster || (C().assets && C().assets.embedPoster);
    const item = g.content.blank(recording && poster ? "overlay" : "embed");
    item.title = emb.title;
    item.caption = emb.credit;
    item.credit = emb.credit;
    item.at = 0;
    item.dur = 0;
    item.visible = true;
    if (recording && poster) {
      const added = await addLocalFile(poster, "nasa-earth-poster.jpg", "image/jpeg");
      if (added && added.ok) {
        item.kind = "overlay";
        item.mediaRef = added.ref;
        item.overlay = { mode: "pip", x: 62, y: 12, width: 34, height: 40, opacity: 1 };
      } else {
        item.kind = "embed";
        item.embedUrl = emb.url;
      }
    } else {
      item.embedUrl = emb.url;
    }
    s.content = (s.content || []).filter(function (x) { return x.kind !== "embed"; });
    s.content.push(overlay, item);
    if (g.state) g.state.tab = "place";
    setKioskMode("inspect");
    refreshDesk();
    await frameSite(2.2);
    refreshDesk();
    done.embed = true;
    return true;
  }

  async function assistSound() {
    await ensureEpisode();
    const g = GD();
    if (!g) return false;
    const added = await addLocalFile(C().assets.telemetryBed || "/assets/sfx/telemetry-bed.wav", "telemetry-bed.wav", "audio/wav");
    if (!added || !added.ok) {
      try { if (window.__demo && window.__demo.state) window.__demo.state.errors.push("sound add: " + (added && added.error || "failed")); } catch (e) {}
      return false;
    }
    const s = story();
    const ov = g.audioMix.blank(added.ref);
    ov.volume = 0.35;
    ov.loop = true;
    ov.at = 0;
    ov.dur = s.durationSec || 32;
    s.audioOverlays = [ov];
    if (g.state) g.state.tab = "sound";
    setKioskMode("inspect");
    refreshDesk();
    try { if (g.audioMix && g.audioMix.sync) g.audioMix.sync(s, g.state.t || 0.2, true); } catch (e) {}
    done.sound = true;
    return true;
  }

  async function assistCaptions() {
    await ensureEpisode();
    const g = GD();
    if (!g) return false;
    const s = story();
    const script = s.script || "This is a practice story on the desk. The pin is an approximate city center, not a precise address.";
    s.captions = g.captions.fromScript(script, s.durationSec || 32);
    g.state.episode.look.captionsOn = true;
    g.state.tab = "captions";
    setKioskMode("readable");
    applyKioskLook({ captionsOn: true });
    refreshDesk();
    applyKioskLook({ captionsOn: true });
    if (g.ui && g.ui.renderOverlays) g.ui.renderOverlays();
    done.captions = true;
    return true;
  }

  async function assistAssist() {
    await ensureEpisode();
    const g = GD();
    const w = deskWin();
    if (!g || !w) return false;
    g.state.tab = "assist";
    setKioskMode("inspect");
    if (g.ui && g.ui.renderInspector) g.ui.renderInspector();
    const path = C().assets.missionEpisode || "/episodes/mission.json";
    const res = await w.fetch(path, { credentials: "same-origin" });
    const text = await res.text();
    const paste = w.document.getElementById("asPaste");
    if (paste) paste.value = text;
    const checked = g.assistant.importJson(text);
    flags.validated = !!(checked && checked.ok);
    const btn = w.document.getElementById("asCheck");
    if (btn) btn.click();
    done.assist = flags.validated;
    return flags.validated;
  }

  async function assistGrokme() {
    const kit = document.getElementById("kit");
    if (!kit) return false;
    let manifest = null, features = "", brief = "";
    try { manifest = await (await fetch("/globedesk/grokme/manifest.json")).json(); } catch (e) {}
    try { features = await (await fetch("/globedesk/grokme/FEATURES.txt")).text(); } catch (e) {}
    try { brief = await (await fetch("/globedesk/GROK-ME-BUILD.md")).text(); } catch (e) {}
    const files = ["APP-BRIEF.txt", "BUILDER-PROMPT.txt", "FEATURES.txt", "UPDATE-PROMPT.txt", "manifest.json"];
    const count = manifest && (manifest.files || manifest.entries || manifest.items);
    const n = Array.isArray(count) ? count.length : (manifest && manifest.count) || "[UNKNOWN]";
    const unknownNote = "Official Grok.me size, history, and what “upload” means are [UNKNOWN]. This panel shows the kit in this repo, not a confirmed Grok.me manual.";
    const feat = (features || "").trim().split("\n").filter(function (l) { return l; }).slice(0, 7).join("\n");
    kit.innerHTML = "";
    const h = document.createElement("h3");
    h.textContent = "GROK.ME BUILD KIT";
    const note = document.createElement("p");
    note.className = "kit-note";
    note.textContent = unknownNote;
    const p = document.createElement("p");
    p.textContent = "A builder prompt, an update prompt, and a file manifest — enough to rebuild GlobeDesk from this repository.";
    const ul = document.createElement("ul");
    ul.className = "kit-files";
    files.forEach(function (f) {
      const li = document.createElement("li");
      li.textContent = "grokme/" + f;
      ul.appendChild(li);
    });
    const meta = document.createElement("p");
    meta.className = "kit-meta";
    const ver = (manifest && manifest.version) || "[UNKNOWN]";
    meta.textContent = "Manifest entries: " + n + "  ·  Entry page: index.html  ·  Version: " + ver;

    const pre = document.createElement("pre");
    pre.textContent = feat;
    kit.appendChild(h);
    kit.appendChild(note);
    kit.appendChild(p);
    kit.appendChild(ul);
    kit.appendChild(meta);
    kit.appendChild(pre);
    kit.classList.add("on");
    const bd = document.getElementById("kitBackdrop");
    if (bd) bd.hidden = false;
    setKioskMode("kit");
    flags.kitOpen = true;
    done.grokme = true;
    return true;
  }

  function hideKit() {
    const kit = document.getElementById("kit");
    if (kit) kit.classList.remove("on");
    const bd = document.getElementById("kitBackdrop");
    if (bd) bd.hidden = true;
  }

  function objectiveMet(id) {
    if (done[id]) return true;
    const g = GD();
    const m = map();
    if (id === "spin") {
      if (spun) { done.spin = true; return true; }
      if (m) {
        try {
          const b = m.getBearing();
          if (Math.abs(((b - startBearing + 540) % 360) - 180) > 18) {
            spun = true; done.spin = true; return true;
          }
        } catch (e) {}
      }
      return false;
    }
    if (id === "dive") {
      let z = 0;
      try { z = m && m.getZoom(); } catch (e) {}
      const stats = readStreetStats();
      const terrain = !!(g && g.globe && (g.globe.st.overlays.terrain || g.globe.st.terrainOn));
      if (z >= 15.2 && (stats.buildings > 10 || flags.terrainOn || terrain)) {
        if (terrain || flags.terrainOn) { done.dive = true; return true; }
      }
      return !!done.dive;
    }
    if (id === "open") {
      return !!(flags.episodeLoaded && g && g.state && g.state.episode && /Mission/.test(g.state.episode.title || ""));
    }
    if (id === "edit") return !!flags.edited;
    if (id === "pins") return !!done.pins;
    if (id === "media") return !!done.media;
    if (id === "embed") return !!done.embed;
    if (id === "sound") return !!done.sound;
    if (id === "captions") return !!done.captions;
    if (id === "assist") return !!done.assist;
    if (id === "grokme") return !!done.grokme;
    return false;
  }

  async function assist(id) {
    const runners = {
      spin: assistSpin,
      dive: assistDive,
      open: assistOpen,
      edit: assistEdit,
      pins: assistPins,
      media: assistMedia,
      embed: assistEmbed,
      sound: assistSound,
      captions: assistCaptions,
      assist: assistAssist,
      grokme: assistGrokme
    };
    const fn = runners[id];
    if (!fn) return false;
    try {
      var settled = false;
      const result = await Promise.race([
        fn().then(function (v) { settled = true; return v; }),
        sleep(12000).then(function () {
          if (settled) return false;
          throw new Error("assist timeout");
        })
      ]);
      return result;
    } catch (e) {
      try { if (window.__demo && window.__demo.state) window.__demo.state.errors.push("assist " + id + ": " + (e && e.message || e)); } catch (e2) {}
      return false;
    }
  }

  window.DemoDesk = {
    waitReady, injectKiosk, setKioskMode, applyKioskLook,
    fly, goOrbit, warmupStreets, waitForStreets, readStreetStats, whenMapIdle,
    hookSpin, ensureEpisode, hideKit, assist, objectiveMet,
    get done() { return done; },
    get flags() { return flags; },
    get streetStats() { return streetStats; },
    get spun() { return spun; },
    deskWin, GD, map
  };
})();
