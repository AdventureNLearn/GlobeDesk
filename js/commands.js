/* Allowlisted command API. window.GD.commands (optional alias window.globe).
   Validates every argument, logs each command, and pumps POST /api/command from the local server. */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});

  const LIMITS = {
    lat: [-90, 90], lon: [-180, 180], zoom: [0, 24], pitch: [0, 85],
    bearing: [-360, 360], durationSec: [0, 120], t: [0, 24 * 3600]
  };
  const ID_LEN = 200;
  const COMMANDS = {
    flyTo: ["lat", "lon", "zoom", "pitch", "bearing", "durationSec"],
    jumpTo: ["lat", "lon", "zoom", "pitch", "bearing"],
    zoom: ["zoom", "by", "durationSec"],
    tilt: ["pitch", "by", "durationSec"],
    rotate: ["bearing", "by", "durationSec"],
    camera: [],
    search: ["q"],
    setBase: ["id"],
    setOverlay: ["id", "on"],
    toggleLayer: ["id", "on"],
    dropPin: ["lat", "lon", "label"],
    setLocation: ["lat", "lon", "label"],
    openCard: ["id"],
    closeCard: ["id"],
    closeAllCards: [],
    highlight: ["a3"],
    loadEpisode: ["url"],
    setStory: ["index", "id"],
    play: [],
    pause: [],
    resume: [],
    seek: ["t"],
    status: [],
    listOutbound: ["storyId"],
    listClaims: ["storyId"],
    setClaim: ["storyId", "cardId", "factIndex", "factLabel", "claimStatus", "sourceIds", "disagree"],
    openClaims: ["storyId"],
    openResearch: ["storyId"],
    listResearch: ["storyId"],
    addGap: ["storyId", "id", "label", "detail", "isGap"],
    closeGap: ["storyId", "id", "label", "note"],
    listRecords: ["layerId", "storyId", "recordCatalogId"],
    buildLayer: ["recordCatalogId", "layerId", "name"],
    frameLayer: ["id"],
    listGis: ["storyId"],
    gisStatus: ["id"]
  };
  const REQUIRED = {
    flyTo: ["lat", "lon"], jumpTo: ["lat", "lon"], zoom: [], tilt: [], rotate: [],
    camera: [], search: ["q"], setBase: ["id"], setOverlay: ["id", "on"], toggleLayer: ["id"],
    dropPin: ["lat", "lon"], setLocation: ["lat", "lon"], openCard: ["id"], closeCard: ["id"],
    closeAllCards: [], highlight: [], loadEpisode: ["url"], setStory: [],
    play: [], pause: [], resume: [], seek: ["t"], status: [],
    listOutbound: [],
    listClaims: [],
    setClaim: ["storyId", "cardId", "claimStatus"],
    openClaims: ["storyId"],
    openResearch: ["storyId"],
    listResearch: ["storyId"],
    addGap: ["storyId"],
    closeGap: ["storyId", "note"],
    listRecords: [],
    buildLayer: [],
    frameLayer: ["id"],
    listGis: [],
    gisStatus: ["id"]
  };

  const ring = [];
  function logArgs(cmd, args) {
    const raw = args && typeof args === "object" && !Array.isArray(args) ? args : {};
    if (cmd === "setClaim") {
      const out = {};
      ["storyId", "cardId", "factIndex", "claimStatus", "sourceIds"].forEach((key) => {
        if (raw[key] != null) out[key] = raw[key];
      });
      if (Array.isArray(raw.disagree)) {
        out.disagree = raw.disagree.map((g) => ({ sourceIds: ((g && g.sourceIds) || []).slice() }));
      }
      return out;
    }
    if (cmd === "addGap" || cmd === "closeGap" || cmd === "listResearch") {
      const out = {};
      ["storyId", "id", "label", "isGap"].forEach((key) => {
        if (raw[key] != null) out[key] = raw[key];
      });
      return out;
    }
    return raw;
  }

  function logRow(row) {
    const copy = Object.assign({}, row);
    copy.args = logArgs(copy.cmd, copy.args);
    ring.push(copy);
    if (ring.length > 200) ring.shift();
  }
  function recentLog() { return ring.slice(); }

  function isNum(v) { return typeof v === "number" && Number.isFinite(v); }
  function inRange(v, lo, hi) { return isNum(v) && v >= lo && v <= hi; }

  function episodeUrlOk(url) {
    return typeof url === "string" && url.startsWith("/episodes/") && url.indexOf("..") < 0
      && url !== "/episodes/" && (url.endsWith(".json") || url.endsWith(".globedesk.json"))
      && url.split("/").length === 3;
  }

  function unpackIdList(val, name) {
    if (!Array.isArray(val)) return { error: name + " must be an array of short strings" };
    const out = [];
    for (let i = 0; i < val.length; i++) {
      const id = val[i];
      if (typeof id !== "string" || !id.trim() || id.length > ID_LEN) return { error: name + " must be an array of short strings" };
      out.push(id);
    }
    return { value: out };
  }

  function unpackDisagree(val) {
    if (!Array.isArray(val)) return { error: "disagree must be an array of groups" };
    const out = [];
    for (let i = 0; i < val.length; i++) {
      const g = val[i];
      if (!g || typeof g !== "object" || Array.isArray(g)) return { error: "disagree group must be an object" };
      const keys = Object.keys(g);
      for (let k = 0; k < keys.length; k++) {
        if (keys[k] !== "sourceIds" && keys[k] !== "position") return { error: "unknown field: " + keys[k] };
      }
      const ids = unpackIdList(g.sourceIds == null ? [] : g.sourceIds, "disagree.sourceIds");
      if (ids.error) return ids;
      if (g.position == null || typeof g.position !== "string" || !g.position.trim() || g.position.length > 8000) {
        return { error: "disagree position must be a non-empty string" };
      }
      out.push({ sourceIds: ids.value, position: g.position });
    }
    return { value: out };
  }

  function unpack(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { error: "command must be a JSON object" };
    const body = Object.assign({}, payload);
    const cmd = body.cmd || body.command;
    delete body.cmd; delete body.command;
    if (!cmd || typeof cmd !== "string") return { error: "missing cmd" };
    if (!COMMANDS[cmd]) return { error: "unknown command: " + cmd };
    let args = body;
    if (Object.prototype.hasOwnProperty.call(body, "args")) {
      args = body.args == null ? {} : body.args;
      const rest = Object.assign({}, body); delete rest.args;
      if (Object.keys(rest).length) return { error: "unknown field: " + Object.keys(rest)[0] };
      if (!args || typeof args !== "object" || Array.isArray(args)) return { error: "args must be an object" };
    }
    const allowed = COMMANDS[cmd];
    for (const key of Object.keys(args)) {
      if (allowed.indexOf(key) < 0) return { error: "unknown field: " + key };
    }
    const out = {};
    for (const key of allowed) {
      if (args[key] == null) continue;
      const val = args[key];
      if (LIMITS[key]) {
        const [lo, hi] = LIMITS[key];
        if (!inRange(val, lo, hi)) return { error: key + " must be a number between " + lo + " and " + hi };
        out[key] = val;
      } else if (key === "by") {
        if (!isNum(val) || Math.abs(val) > 360) return { error: "by is out of range" };
        out[key] = val;
      } else if (key === "index") {
        if (!isNum(val) || val < 0 || val > 79 || val !== Math.floor(val)) return { error: "index must be an integer from 0 to 79" };
        out[key] = val;
      } else if (key === "on") {
        if (typeof val !== "boolean") return { error: "on must be a boolean" };
        out[key] = val;
      } else if (key === "id" || key === "storyId" || key === "recordCatalogId" || key === "layerId") {
        if (typeof val !== "string" || !val.trim() || val.length > ID_LEN) return { error: key + " must be a short string" };
        out[key] = val;
      } else if (key === "q") {
        if (typeof val !== "string" || val.length > 500) return { error: "q must be a short string" };
        out[key] = val;
      } else if (key === "label" || key === "name") {
        if (typeof val !== "string" || val.length > 500) return { error: key + " must be a short string" };
        out[key] = val;
      } else if (key === "url") {
        if (!episodeUrlOk(val)) return { error: "url must be an allowlisted /episodes/ JSON path" };
        out[key] = val;
      } else if (key === "a3") {
        if (typeof val !== "string" || val.length > 8) return { error: "a3 must be a short string" };
        out[key] = val.toUpperCase();
      } else if (key === "cardId" || key === "factLabel") {
        if (typeof val !== "string" || !val.trim() || val.length > ID_LEN) return { error: key + " must be a short string" };
        out[key] = val;
      } else if (key === "factIndex") {
        if (!isNum(val) || val < 0 || val > 399 || val !== Math.floor(val)) return { error: "factIndex must be an integer from 0 to 399" };
        out[key] = val;
      } else if (key === "claimStatus") {
        const allowedStatus = (GD.schema && GD.schema.CLAIM_STATUS) || ["supported", "not-proven", "disputed", "people-disagree"];
        if (typeof val !== "string" || allowedStatus.indexOf(val) < 0) return { error: "claimStatus must be " + allowedStatus.join("|") };
        out[key] = val;
      } else if (key === "sourceIds") {
        const ids = unpackIdList(val, "sourceIds");
        if (ids.error) return ids;
        out[key] = ids.value;
      } else if (key === "disagree") {
        const groups = unpackDisagree(val);
        if (groups.error) return groups;
        out[key] = groups.value;
      } else if (key === "note" || key === "detail") {
        if (typeof val !== "string" || !val.trim() || val.length > 8000) return { error: key + " must be a non-empty string" };
        out[key] = val;
      } else if (key === "isGap") {
        if (typeof val !== "boolean") return { error: "isGap must be a boolean" };
        out[key] = val;
      }
    }
    for (const req of REQUIRED[cmd]) {
      if (out[req] == null) return { error: "missing " + req };
    }
    if (cmd === "zoom" && out.zoom == null && out.by == null) return { error: "zoom requires zoom or by" };
    if (cmd === "tilt" && out.pitch == null && out.by == null) return { error: "tilt requires pitch or by" };
    if (cmd === "rotate" && out.bearing == null && out.by == null) return { error: "rotate requires bearing or by" };
    if (cmd === "setStory" && out.index == null && out.id == null) return { error: "setStory requires index or id" };
    if (cmd === "setClaim" && out.factIndex == null && !out.factLabel) return { error: "setClaim requires factIndex or factLabel" };
    if (cmd === "addGap" && !out.id && !out.label) return { error: "addGap requires id or label" };
    if (cmd === "closeGap" && !out.id && !out.label) return { error: "closeGap requires id or label" };
    if (cmd === "buildLayer" && !out.recordCatalogId && !out.layerId) return { error: "buildLayer requires recordCatalogId or layerId" };
    return { cmd, args: out };
  }

  function cam() {
    return (GD.globe && GD.globe.st && GD.globe.st.map && GD.globe.camera) ? GD.globe.camera() : null;
  }

  function knownLayer(id) {
    const bases = (GD.layers && GD.layers.BASES) || [];
    const ovs = (GD.layers && GD.layers.OVERLAYS) || [];
    if (bases.some((b) => b.id === id)) return { kind: "base" };
    const o = ovs.find((x) => x.id === id);
    if (o && o.status !== "unknown") return { kind: "overlay" };
    return null;
  }

  function findStory(id) {
    const ep = GD.state && GD.state.episode;
    if (!ep) return null;
    return ep.stories.find((s) => s.id === id || s.slug === id) || null;
  }
  function findCard(id) {
    const ep = GD.state && GD.state.episode;
    if (!ep) return null;
    for (const s of ep.stories) {
      const c = (s.cards || []).find((x) => x.id === id);
      if (c) return { story: s, card: c };
    }
    return null;
  }

  function currentCamera() {
    const c = cam();
    if (c) return { lon: c.center[0], lat: c.center[1], zoom: c.zoom, pitch: c.pitch, bearing: c.bearing };
    return { lon: 0, lat: 0, zoom: 1.6, pitch: 0, bearing: 0 };
  }

  function flyOrJump(args, jump) {
    if (!GD.globe || !GD.globe.st || !GD.globe.st.map) return { ok: false, error: "globe is not ready" };
    const cur = currentCamera();
    const kf = {
      center: [args.lon != null ? args.lon : cur.lon, args.lat != null ? args.lat : cur.lat],
      zoom: args.zoom != null ? args.zoom : cur.zoom,
      pitch: args.pitch != null ? args.pitch : cur.pitch,
      bearing: args.bearing != null ? args.bearing : cur.bearing,
      durationSec: jump ? 0 : (args.durationSec != null ? args.durationSec : 1.2)
    };
    if (jump || kf.durationSec === 0) {
      if (GD.globe.jumpTo) GD.globe.jumpTo(kf);
      else GD.globe.st.map.jumpTo({ center: kf.center, zoom: kf.zoom, pitch: kf.pitch, bearing: kf.bearing });
    } else GD.globe.flyTo(kf);
    return { ok: true, result: { center: kf.center, zoom: kf.zoom, pitch: kf.pitch, bearing: kf.bearing } };
  }

  function setForced(id, on) {
    const S = GD.state;
    S.forcedCards = S.forcedCards || [];
    const i = S.forcedCards.indexOf(id);
    if (on && i < 0) S.forcedCards.push(id);
    if (!on && i >= 0) S.forcedCards.splice(i, 1);
  }

  function refreshCards() {
    if (GD.playback && GD.playback.evaluate && GD.state) GD.playback.evaluate(GD.state.t);
    if (GD.ui && GD.ui.renderOverlays) GD.ui.renderOverlays();
    if (GD.ui && GD.ui.renderRundown) GD.ui.renderRundown();
  }

  function openCardsNow() {
    const S = GD.state || {};
    const cards = ((S.ov && S.ov.cards) || []).map((c) => c.id);
    const callouts = (GD.callouts && GD.callouts.state && GD.callouts.state.open) ? GD.callouts.state.open.slice() : [];
    return { cards, callouts, forced: (S.forcedCards || []).slice() };
  }

  const handlers = {
    flyTo: (a) => flyOrJump(a, false),
    jumpTo: (a) => flyOrJump(a, true),
    zoom: (a) => {
      const cur = currentCamera();
      const z = a.zoom != null ? a.zoom : cur.zoom + a.by;
      if (!inRange(z, LIMITS.zoom[0], LIMITS.zoom[1])) return { ok: false, error: "zoom is out of range" };
      return flyOrJump({ lat: cur.lat, lon: cur.lon, zoom: z, pitch: cur.pitch, bearing: cur.bearing, durationSec: a.durationSec != null ? a.durationSec : 0.6 }, false);
    },
    tilt: (a) => {
      const cur = currentCamera();
      const p = a.pitch != null ? a.pitch : cur.pitch + a.by;
      if (!inRange(p, LIMITS.pitch[0], LIMITS.pitch[1])) return { ok: false, error: "pitch is out of range" };
      return flyOrJump({ lat: cur.lat, lon: cur.lon, zoom: cur.zoom, pitch: p, bearing: cur.bearing, durationSec: a.durationSec != null ? a.durationSec : 0.6 }, false);
    },
    rotate: (a) => {
      const cur = currentCamera();
      let b = a.bearing != null ? a.bearing : cur.bearing + a.by;
      if (!inRange(b, LIMITS.bearing[0], LIMITS.bearing[1])) return { ok: false, error: "bearing is out of range" };
      return flyOrJump({ lat: cur.lat, lon: cur.lon, zoom: cur.zoom, pitch: cur.pitch, bearing: b, durationSec: a.durationSec != null ? a.durationSec : 0.6 }, false);
    },
    camera: () => {
      const c = cam();
      if (!c) return { ok: false, error: "globe is not ready" };
      return { ok: true, result: c };
    },
    search: (a) => {
      if (!GD.globe || !GD.globe.searchPlaces) return { ok: false, error: "search is not available" };
      return { ok: true, result: GD.globe.searchPlaces(a.q) || [] };
    },
    setBase: (a) => {
      const kind = knownLayer(a.id);
      if (!kind || kind.kind !== "base") return { ok: false, error: "unknown layer: " + a.id };
      if (!GD.globe) return { ok: false, error: "globe is not ready" };
      const ok = GD.globe.setBase(a.id);
      return ok ? { ok: true, result: { id: a.id } } : { ok: false, error: "could not set base " + a.id };
    },
    setOverlay: (a) => {
      if (GD.gis && GD.gis.byId && GD.gis.byId(a.id) && GD.gis.setOverlay) {
        const layer = GD.gis.byId(a.id);
        const health = GD.gis.state && GD.gis.state.health && GD.gis.state.health[a.id];
        if (a.on && layer && (layer.status === "unknown" || layer.kind === "none")) {
          return { ok: false, error: "skipped: " + (layer.reason || "[UNKNOWN]"), reason: "skipped", result: { id: a.id, on: false, status: "unknown" } };
        }
        if (a.on && health && (health.token === "error" || health.token === "skipped")) {
          return { ok: false, error: "skipped: " + (health.reason || "[UNKNOWN]"), reason: "skipped", result: { id: a.id, on: false, status: "skipped" } };
        }
        const out = GD.gis.setOverlay(a);
        if (out) return out;
      }
      const kind = knownLayer(a.id);
      if (!kind || kind.kind !== "overlay") return { ok: false, error: "unknown layer: " + a.id };
      if (!GD.globe) return { ok: false, error: "globe is not ready" };
      GD.globe.setOverlay(a.id, a.on);
      return { ok: true, result: { id: a.id, on: !!a.on } };
    },
    toggleLayer: (a) => {
      const kind = knownLayer(a.id);
      if (!kind) return { ok: false, error: "unknown layer: " + a.id };
      if (!GD.globe) return { ok: false, error: "globe is not ready" };
      if (kind.kind === "base") {
        if (a.on === false) return { ok: false, error: "cannot turn a base off; set another base instead" };
        const ok = GD.globe.setBase(a.id);
        return ok ? { ok: true, result: { id: a.id, kind: "base" } } : { ok: false, error: "could not set base " + a.id };
      }
      const cur = !!(GD.globe.st.overlays && GD.globe.st.overlays[a.id]);
      const on = a.on != null ? a.on : !cur;
      GD.globe.setOverlay(a.id, on);
      return { ok: true, result: { id: a.id, kind: "overlay", on } };
    },
    dropPin: (a) => {
      const S = GD.state, s = S && S.episode && S.episode.stories[S.storyIdx];
      if (!s || !s.location) return { ok: false, error: "no current story pin" };
      s.location.lat = Math.round(a.lat * 1e5) / 1e5;
      s.location.lon = Math.round(a.lon * 1e5) / 1e5;
      if (s.location.precision === "unset") s.location.precision = "approximate";
      if (a.label) s.location.name = a.label;
      if (GD.globe && GD.globe.setEpisode) GD.globe.setEpisode(S.episode, S.storyIdx);
      if (GD.ui && GD.ui.renderInspector) GD.ui.renderInspector();
      return { ok: true, result: { lat: s.location.lat, lon: s.location.lon } };
    },
    setLocation: (a) => handlers.dropPin(a),
    openCard: (a) => {
      const story = findStory(a.id);
      if (story && GD.callouts) {
        const alreadyOpen = !!GD.callouts.isOpen(story.id);
        if (!alreadyOpen) GD.callouts.open(story.id);
        if (GD.ui && GD.ui.renderRundown) GD.ui.renderRundown();
        return { ok: true, result: { id: story.id, kind: "callout", alreadyOpen } };
      }
      const found = findCard(a.id);
      if (!found) return { ok: false, error: "unknown card: " + a.id };
      const S = GD.state || {};
      const alreadyOpen = (S.forcedCards || []).indexOf(found.card.id) >= 0
        || ((S.ov && S.ov.cards) || []).some((c) => c.id === found.card.id);
      if (!alreadyOpen) setForced(found.card.id, true);
      refreshCards();
      return { ok: true, result: { id: found.card.id, kind: "card", alreadyOpen } };
    },
    closeCard: (a) => {
      const story = findStory(a.id);
      if (story && GD.callouts) {
        GD.callouts.close(story.id);
        if (GD.ui && GD.ui.renderRundown) GD.ui.renderRundown();
        return { ok: true, result: { id: story.id, kind: "callout" } };
      }
      const found = findCard(a.id);
      if (!found) return { ok: false, error: "unknown card: " + a.id };
      setForced(found.card.id, false);
      refreshCards();
      return { ok: true, result: { id: found.card.id, kind: "card" } };
    },
    closeAllCards: () => {
      const S = GD.state;
      if (S) S.forcedCards = [];
      if (GD.callouts) GD.callouts.clear();
      refreshCards();
      return { ok: true, result: { closed: true } };
    },
    highlight: (a) => {
      const S = GD.state, s = S && S.episode && S.episode.stories[S.storyIdx];
      if (!s) return { ok: false, error: "no current story" };
      s.highlight = a.a3 ? { a3: a.a3, geojson: null } : { a3: "", geojson: null };
      if (GD.globe && GD.globe.setEpisode) GD.globe.setEpisode(S.episode, S.storyIdx);
      return { ok: true, result: { a3: a.a3 || "" } };
    },
    loadEpisode: async (a) => {
      if (!GD.assistant || !GD.assistant.importSameOrigin || !GD.ui) return { ok: false, error: "loadEpisode is not available" };
      const r = await GD.assistant.importSameOrigin(a.url);
      if (!r || !r.ok) return { ok: false, error: (r && r.errors && r.errors[0]) || "episode rejected" };
      const ok = GD.ui.loadEpisode(r.episode, "Loaded episode.");
      return ok ? { ok: true, result: { id: r.episode.id, url: a.url } } : { ok: false, error: "episode not loaded" };
    },
    setStory: (a) => {
      const ep = GD.state && GD.state.episode;
      if (!ep || !GD.ui) return { ok: false, error: "no episode" };
      let idx = a.index;
      if (idx == null) {
        idx = ep.stories.findIndex((s) => s.id === a.id || s.slug === a.id);
        if (idx < 0) return { ok: false, error: "unknown story: " + a.id };
      }
      if (idx < 0 || idx >= ep.stories.length) return { ok: false, error: "story index out of range" };
      GD.ui.selectStory(idx, { fly: false });
      return { ok: true, result: { index: idx, id: ep.stories[idx].id } };
    },
    play: () => { if (!GD.playback) return { ok: false, error: "playback is not available" }; GD.playback.play(); return { ok: true, result: { playing: true } }; },
    pause: () => { if (!GD.playback) return { ok: false, error: "playback is not available" }; GD.playback.pause(); return { ok: true, result: { paused: true, t: GD.state.t } }; },
    resume: () => { if (!GD.playback) return { ok: false, error: "playback is not available" }; GD.playback.resume(); return { ok: true, result: { playing: true, t: GD.state.t } }; },
    seek: (a) => { if (!GD.playback) return { ok: false, error: "playback is not available" }; GD.playback.seek(a.t); return { ok: true, result: { t: GD.state.t } }; },
    status: () => {
      const S = GD.state || {};
      const g = GD.globe && GD.globe.st;
      return {
        ok: true,
        result: {
          base: g ? g.baseId : null,
          overlays: g ? Object.assign({}, g.overlays) : {},
          t: S.t || 0,
          storyIdx: S.storyIdx || 0,
          playing: !!S.playing,
          paused: !!S.paused,
          camera: cam(),
          openCards: openCardsNow(),
          desk: (typeof sessionStorage !== "undefined" && sessionStorage.getItem("gd-desk-id")) || api._deskId || null,
          drawingBufferPreserved: !!(GD.globe && GD.globe.isDrawingBufferPreserved && GD.globe.isDrawingBufferPreserved())
        }
      };
    },
    listOutbound: (a) => {
      if (!GD.outbound) return { ok: false, error: "outbound allowlist is not available" };
      if (a.storyId) {
        let story = findStory(a.storyId);
        if (!story && GD.newsdesk && GD.newsdesk.state && GD.newsdesk.state.feed) {
          const topic = (GD.newsdesk.state.feed.topics || []).find((t) => {
            const st = t.story || {};
            return t.id === a.storyId || t.slug === a.storyId || st.id === a.storyId || st.slug === a.storyId;
          });
          if (topic && GD.newsdesk.topicAsStory) story = GD.newsdesk.topicAsStory(topic);
          else if (topic) {
            story = {
              id: (topic.story && topic.story.id) || topic.id,
              slug: topic.slug || "",
              sectionId: topic.sectionId || topic.section || "",
              openIn: topic.openIn || (topic.story && topic.story.openIn) || []
            };
          }
        }
        if (!story) return { ok: false, error: "unknown story: " + a.storyId };
        return { ok: true, result: { storyId: story.id || a.storyId, targets: GD.outbound.listed(story) } };
      }
      const targets = GD.outbound.allTargets().map((tg) => ({
        id: tg.id,
        label: tg.label,
        url: GD.outbound.isLinkable(tg) ? tg.url : "",
        enabled: GD.outbound.isLinkable(tg),
        status: tg.status || "",
        credit: tg.credit || "",
        reason: tg.reason || ""
      }));
      return { ok: true, result: { targets } };
    },
    listClaims: (a) => {
      if (!GD.claims) return { ok: false, error: "claims sidecar is not available" };
      if (a.storyId) {
        const listed = GD.claims.listed(a.storyId);
        if (listed && listed.error) return { ok: false, error: listed.error };
        return { ok: true, result: listed };
      }
      return { ok: true, result: GD.claims.listed() };
    },
    setClaim: (a) => {
      if (!GD.claims) return { ok: false, error: "claims sidecar is not available" };
      return GD.claims.setClaim(a);
    },
    openClaims: (a) => {
      if (!GD.claims || !GD.claims.openFor) return { ok: false, error: "claims sidecar is not available" };
      return GD.claims.openFor(a.storyId);
    },
    openResearch: (a) => {
      if (!GD.research || !GD.research.openFor) return { ok: false, error: "research sidecar is not available" };
      return GD.research.openFor(a.storyId);
    },
    listResearch: (a) => {
      if (!GD.research) return { ok: false, error: "research sidecar is not available" };
      const listed = GD.research.listed(a.storyId);
      if (listed && listed.error) return { ok: false, error: listed.error };
      return { ok: true, result: listed };
    },
    addGap: (a) => {
      if (!GD.research) return { ok: false, error: "research sidecar is not available" };
      return GD.research.addGap(a);
    },
    closeGap: (a) => {
      if (!GD.research) return { ok: false, error: "research sidecar is not available" };
      return GD.research.closeGap(a);
    },
    listRecords: (a) => {
      if (!GD.records) return { ok: false, error: "records sidecar is not available" };
      return { ok: true, result: GD.records.listed(a) };
    },
    buildLayer: (a) => {
      if (!GD.records) return { ok: false, error: "records sidecar is not available" };
      return GD.records.buildLayer(a);
    },
    frameLayer: (a) => {
      if (!GD.records) return { ok: false, error: "records sidecar is not available" };
      return GD.records.frameLayer(a);
    },
    listGis: (a) => {
      if (!GD.gis) return { ok: false, error: "official GIS connector is not available" };
      return { ok: true, result: GD.gis.listed(a) };
    },
    gisStatus: (a) => {
      if (!GD.gis) return { ok: false, error: "official GIS connector is not available" };
      return GD.gis.gisStatus(a);
    }
  };

  async function run(payload) {
    const parsed = unpack(payload);
    if (parsed.error) {
      const row = { ts: Date.now(), cmd: (payload && payload.cmd) || null, ok: false, error: parsed.error, args: {} };
      logRow(row);
      return { ok: false, error: parsed.error };
    }
    let out;
    try {
      out = handlers[parsed.cmd](parsed.args);
      if (out && typeof out.then === "function") out = await out;
    } catch (e) {
      out = { ok: false, error: (e && e.message) || String(e) };
    }
    if (!out) out = { ok: false, error: "command failed" };
    logRow({ ts: Date.now(), cmd: parsed.cmd, ok: !!out.ok, error: out.error || null, args: parsed.args });
    return out;
  }

  function list() {
    return Object.keys(COMMANDS);
  }

  function cardsAt(story, lt) {
    return (story.cards || []).filter((c) => lt >= c.at && lt < c.at + c.dur);
  }
  function cameraAt(story, lt) {
    const kfs = (story.camera || []).filter((k) => k.at <= lt).sort((a, b) => a.at - b.at);
    return kfs.length ? kfs[kfs.length - 1] : ((story.camera || [])[0] || null);
  }
  function cloneLocations(ep) {
    return (ep.stories || []).map((s) => ({ id: s.id, location: JSON.parse(JSON.stringify(s.location || {})) }));
  }
  function restoreLocations(ep, snapshot) {
    if (!ep || !snapshot) return;
    const map = new Map(snapshot.map((x) => [x.id, x.location]));
    (ep.stories || []).forEach((s) => {
      if (map.has(s.id)) s.location = JSON.parse(JSON.stringify(map.get(s.id)));
    });
  }

  function deskId() {
    if (typeof sessionStorage === "undefined") return api._deskId || (api._deskId = "desk-" + Math.random().toString(36).slice(2, 10));
    let id = sessionStorage.getItem("gd-desk-id");
    if (!id) {
      id = "desk-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
      sessionStorage.setItem("gd-desk-id", id);
    }
    return id;
  }
  function deskFocused() {
    try { return !!(typeof document !== "undefined" && document.hasFocus() && document.visibilityState !== "hidden"); }
    catch (e) { return false; }
  }
  function deskTitle() {
    try { return (GD.state && GD.state.episode && GD.state.episode.title) || (document && document.title) || ""; }
    catch (e) { return ""; }
  }

  async function pumpOnce(waitSec) {
    const q = "wait=" + (waitSec == null ? 20 : waitSec)
      + "&desk=" + encodeURIComponent(deskId())
      + "&focused=" + (deskFocused() ? "1" : "0")
      + "&title=" + encodeURIComponent(deskTitle());
    const r = await fetch("/api/command/next?" + q, { headers: { "Accept": "application/json" } });
    if (r.status === 204 || !r.ok) return false;
    const msg = await r.json();
    if (!msg || !msg.id || !msg.cmd) return false;
    const out = await run({ cmd: msg.cmd, args: msg.args || {} });
    await fetch("/api/command/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: msg.id, ok: !!out.ok, result: out.result, error: out.error || null, desk: deskId() })
    });
    return true;
  }

  let pumping = false;
  function connect() {
    if (pumping) return;
    if (typeof location === "undefined") return;
    if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return;
    if (typeof fetch !== "function") return;
    pumping = true;
    if (typeof window !== "undefined") {
      const ping = () => { try { pumpOnce(0); } catch (e) { /* ignore */ } };
      window.addEventListener("focus", ping);
      window.addEventListener("blur", ping);
      document.addEventListener("visibilitychange", ping);
      window.addEventListener("pagehide", () => {
        try { fetch("/api/command/next?desk=" + encodeURIComponent(deskId()) + "&gone=1&wait=0", { keepalive: true }); } catch (e) { /* ignore */ }
      });
    }
    const loop = async () => {
      try { await pumpOnce(20); } catch (e) { /* server optional */ }
      if (pumping) setTimeout(loop, 80);
    };
    loop();
  }

  function disconnect() { pumping = false; }

  const api = {
    COMMANDS, REQUIRED, LIMITS, unpack, run, list, log: recentLog,
    cardsAt, cameraAt, cloneLocations, restoreLocations, connect, disconnect, pumpOnce, deskId,
    flyTo: (a) => run({ cmd: "flyTo", args: a }),
    jumpTo: (a) => run({ cmd: "jumpTo", args: a }),
    zoom: (a) => run({ cmd: "zoom", args: a }),
    tilt: (a) => run({ cmd: "tilt", args: a }),
    rotate: (a) => run({ cmd: "rotate", args: a }),
    camera: () => run({ cmd: "camera" }),
    search: (a) => run({ cmd: "search", args: typeof a === "string" ? { q: a } : a }),
    setBase: (a) => run({ cmd: "setBase", args: typeof a === "string" ? { id: a } : a }),
    setOverlay: (a) => run({ cmd: "setOverlay", args: a }),
    toggleLayer: (a) => run({ cmd: "toggleLayer", args: a }),
    dropPin: (a) => run({ cmd: "dropPin", args: a }),
    setLocation: (a) => run({ cmd: "setLocation", args: a }),
    openCard: (a) => run({ cmd: "openCard", args: typeof a === "string" ? { id: a } : a }),
    closeCard: (a) => run({ cmd: "closeCard", args: typeof a === "string" ? { id: a } : a }),
    closeAllCards: () => run({ cmd: "closeAllCards" }),
    highlight: (a) => run({ cmd: "highlight", args: typeof a === "string" ? { a3: a } : a }),
    loadEpisode: (a) => run({ cmd: "loadEpisode", args: typeof a === "string" ? { url: a } : a }),
    setStory: (a) => run({ cmd: "setStory", args: a }),
    play: () => run({ cmd: "play" }),
    pause: () => run({ cmd: "pause" }),
    resume: () => run({ cmd: "resume" }),
    seek: (a) => run({ cmd: "seek", args: typeof a === "number" ? { t: a } : a }),
    status: () => run({ cmd: "status" }),
    listOutbound: (a) => run({ cmd: "listOutbound", args: a }),
    listClaims: (a) => run({ cmd: "listClaims", args: a }),
    setClaim: (a) => run({ cmd: "setClaim", args: a }),
    openClaims: (a) => run({ cmd: "openClaims", args: typeof a === "string" ? { storyId: a } : a }),
    openResearch: (a) => run({ cmd: "openResearch", args: typeof a === "string" ? { storyId: a } : a }),
    listResearch: (a) => run({ cmd: "listResearch", args: a }),
    addGap: (a) => run({ cmd: "addGap", args: a }),
    closeGap: (a) => run({ cmd: "closeGap", args: a }),
    listRecords: (a) => run({ cmd: "listRecords", args: a }),
    buildLayer: (a) => run({ cmd: "buildLayer", args: a }),
    frameLayer: (a) => run({ cmd: "frameLayer", args: typeof a === "string" ? { id: a } : a }),
    listGis: (a) => run({ cmd: "listGis", args: a }),
    gisStatus: (a) => run({ cmd: "gisStatus", args: typeof a === "string" ? { id: a } : a })
  };
  GD.commands = api;
  window.globe = api;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", connect);
    else connect();
  }
})();
