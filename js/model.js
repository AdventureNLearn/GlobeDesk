/* GlobeDesk episode model, templates and helpers. Classic script; exposes window.GD.model. */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const U = "[UNKNOWN]";
  const SCHEMA = "globedesk.episode/2";
  const SCHEMA_LEGACY = ["globedesk.episode/1", "gobedesk.episode/1"];

  function httpsOk(s) {
    if (GD.schema && typeof GD.schema.httpsOk === "function") return GD.schema.httpsOk(s);
    if (GD.sanitize && typeof GD.sanitize.isHttpsUrl === "function") return GD.sanitize.isHttpsUrl(s);
    if (typeof s !== "string" || !s) return false;
    if (typeof URL === "function") {
      try {
        const u = new URL(s);
        return u.protocol === "https:" && !u.username && !u.password;
      } catch (e) { return false; }
    }
    if (!/^https:\/\//i.test(s)) return false;
    const hostpart = s.slice(s.indexOf("://") + 3).split("/")[0];
    return hostpart.indexOf("@") < 0;
  }

  let seq = 0;
  function uid(prefix) {
    seq += 1;
    return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
  }

  // Camera keyframe presets. Each story gets an auto path: orbit -> dive -> street -> cinematic.
  const PRESETS = {
    orbit: { label: "Orbit (space)", zoom: 1.7, pitch: 0, bearingOffset: -25, durationSec: 3.5 },
    dive: { label: "Dive (region)", zoom: 8.5, pitch: 35, bearingOffset: 0, durationSec: 4 },
    street: { label: "Street level", zoom: 16.4, pitch: 62, bearingOffset: 20, durationSec: 4.5 },
    cinematic: { label: "Cinematic tilt", zoom: 15.6, pitch: 76, bearingOffset: -55, durationSec: 5 },
    overview: { label: "Overview (country)", zoom: 5.2, pitch: 20, bearingOffset: 0, durationSec: 3.5 }
  };

  function keyframe(preset, lat, lon, at, baseBearing, zoomOverride, pitchOverride) {
    const p = PRESETS[preset] || PRESETS.dive;
    return {
      id: uid("kf"),
      preset,
      at, // seconds from story start when this move begins
      center: [round(lon, 5), round(lat, 5)],
      zoom: zoomOverride != null ? zoomOverride : p.zoom,
      pitch: pitchOverride != null ? pitchOverride : p.pitch,
      bearing: ((baseBearing || 0) + p.bearingOffset + 360) % 360,
      durationSec: p.durationSec,
      ease: "cinematic"
    };
  }

  // Point-in-polygon against a GeoJSON FeatureCollection (Natural Earth land, or any polygons).
  function pointInRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      const denom = (yj - yi) || 1e-16;
      const intersect = ((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi) / denom + xi));
      if (intersect) inside = !inside;
    }
    return inside;
  }
  function pointInLand(lat, lon, fc) {
    if (lat == null || lon == null || !fc || !fc.features) return false;
    for (let i = 0; i < fc.features.length; i++) {
      const f = fc.features[i], g = f.geometry, bbox = f.bbox;
      if (!g) continue;
      if (bbox && (lon < bbox[0] || lat < bbox[1] || lon > bbox[2] || lat > bbox[3])) continue;
      const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
      for (let p = 0; p < polys.length; p++) {
        const poly = polys[p];
        if (!pointInRing(lon, lat, poly[0] || [])) continue;
        let hole = false;
        for (let k = 1; k < poly.length; k++) if (pointInRing(lon, lat, poly[k])) hole = true;
        if (!hole) return true;
      }
    }
    return false;
  }

  // Camera / street-level target: location.look if set, otherwise the story pin.
  function lookTarget(loc) {
    if (!loc || loc.lat == null || loc.lon == null) return null;
    const look = loc.look;
    if (look && look.lat != null && look.lon != null) {
      return { lat: look.lat, lon: look.lon, name: look.name || "", from: "look" };
    }
    return { lat: loc.lat, lon: loc.lon, name: loc.name || "", from: "pin" };
  }

  // Auto path: orbit -> dive over the story pin, then street -> cinematic over the
  // look target when that target is on land (about z16–17, pitched). Water pins
  // with no land look target stay at a regional close (no empty-sea street zoom).
  // shotSec sets the cut length (7-9 s per shot, cuts on topic shifts).
  // opts: { lookLat, lookLon, onLand }
  function autoCameraPath(lat, lon, shotSec, opts) {
    const shot = Number(shotSec) || 8;
    opts = opts || {};
    const hasLook = opts.lookLat != null && opts.lookLon != null;
    const streetLat = hasLook ? opts.lookLat : lat;
    const streetLon = hasLook ? opts.lookLon : lon;
    const allowStreet = opts.onLand !== false;
    const plan = allowStreet
      ? [["orbit", lat, lon, 0, true], ["dive", lat, lon, 0.8, false],
         ["street", streetLat, streetLon, shot, true], ["cinematic", streetLat, streetLon, shot + shot * 0.55, false]]
      : [["orbit", lat, lon, 0, true], ["close", lat, lon, Math.max(1, shot * 0.35), true]];
    return plan.map(([name, klat, klon, at, cut]) => {
      const preset = name === "close" ? "dive" : name;
      const kf = keyframe(preset, klat, klon, round(at, 2), 0,
        name === "close" ? 6.8 : null,
        name === "close" ? 38 : null);
      if (name === "close") kf.preset = "close";
      kf.cut = cut;
      if (name === "dive") kf.durationSec = Math.max(2, shot - 1.4);
      if (name === "street") kf.durationSec = Math.max(2, shot * 0.5);
      if (name === "close") kf.durationSec = Math.max(2.5, shot * 0.7);
      kf.citation = mapCitation();
      return kf;
    });
  }

  function autoCameraPathForLocation(loc, shotSec, landFC) {
    if (!loc || loc.lat == null || loc.lon == null) return [];
    const t = lookTarget(loc);
    const onLand = landFC ? pointInLand(t.lat, t.lon, landFC) : true; // no land data: keep street (unknown)
    return autoCameraPath(loc.lat, loc.lon, shotSec, {
      lookLat: t.from === "look" ? t.lat : null,
      lookLon: t.from === "look" ? t.lon : null,
      onLand
    });
  }

  // Per-shot source citation box: media type + date / credit / license.
  function blankCitation() {
    return { type: U, date: U, credit: U, license: U };
  }
  // Map shots fill credit from the active base (playback expands "auto").
  function mapCitation() {
    return { type: "Map", date: "auto", credit: "auto", license: "auto" };
  }
  function citationLine(c) {
    if (!c) return "";
    return `${c.type || U} (${c.date || U}) / ${c.credit || U}; ${c.license || U}`;
  }

  function round(v, d) {
    const m = Math.pow(10, d);
    return Math.round(Number(v) * m) / m;
  }

  function blankSource() {
    return { id: uid("src"), label: U, url: "", status: "unverified", note: U };
  }

  function blankCard(lat, lon) {
    return {
      id: uid("card"),
      kind: "topic",
      title: U,
      body: U,
      why: U,
      facts: [{ label: U, value: U }],
      sourceIds: [],
      pin: lat == null ? null : { lat, lon },
      at: 2,
      dur: 8,
      position: "right",
      verified: false
    };
  }

  function blankStory(n) {
    // Blank stories have no location: the globe stays in orbit until a place is set.
    return {
      id: uid("story"),
      slug: `story-${n}`,
      title: U,
      durationSec: 24,
      location: { name: U, lat: null, lon: null, precision: "unset", verified: false, note: U },
      camera: [],
      cards: [blankCard(null, null)],
      sources: [blankSource()],
      script: "",
      captions: [],
      summary: "",
      date: "",
      credit: "",
      creditUrl: "",
      asReported: true, // "as reported, not independently verified"
      media: [], // shots from the bin: { mediaRef, role: broll|still|voiceover|music, at, dur, citation, caption }
      audioOverlays: [], // { id, mediaRef, volume, offset, loop, at, dur }
      content: [], // user content-layer placements; never mutates the base map
      highlight: { a3: null, geojson: null }, // focus country (ISO A3) or a custom polygon to glow
      voiceover: null, // mediaRef in the bin
      eventWindow: { start: "", end: "" } // event clock sweep for this story (ISO); blank = show all events
    };
  }

  function blankEpisode() {
    return {
      schema: SCHEMA,
      id: uid("ep"),
      show: "GlobeDesk",
      title: U,
      date: new Date().toISOString().slice(0, 10),
      lede: U,
      cta: U,
      links: [],
      demo: false,
      sample: false,
      look: GD.themes ? GD.themes.lookFor("globedesk") : { theme: "globedesk" },
      handle: "@AdventureNLearn",
      outro: { enabled: true, durationSec: 5, line1: "Full brief on the channel", link: "https://x.com/AdventureNLearn", handle: "@AdventureNLearn", showXLogo: true },
      output: { aspect: "16:9", fps: 30 },
      stories: [blankStory(1)],
      eventLayers: [], // Event Layers builder (see js/events-model.js); each layer exports as GeoJSON
      mediaBin: [] // descriptors only; local file bytes are never stored in the JSON
    };
  }

  const SAMPLE_ID = "washington-dc-demo";
  const SAMPLE_FILE = "episodes/washington-dc-demo.globedesk.json";

  // Neutral bundled sample (Washington, DC). Data is set by setSampleEpisode()
  // after the JSON is read (tests) or fetched (the app). Until then this
  // returns a stamped copy of a blank episode flagged as the sample slot.
  function setSampleEpisode(ep) {
    if (ep && typeof ep === "object") GD.sampleEpisodeData = ep;
    return GD.sampleEpisodeData || null;
  }

  function sampleEpisode() {
    const src = GD.sampleEpisodeData;
    if (src) {
      const ep = JSON.parse(JSON.stringify(src));
      return normalizeEpisode(ep);
    }
    const ep = blankEpisode();
    ep.id = "ep-washington-dc-demo";
    ep.show = "GlobeDesk";
    ep.title = "Washington, DC demo — the National Mall";
    ep.sample = true;
    ep.demo = true;
    if (GD.themes) ep.look = GD.themes.lookFor("globedesk");
    if (ep.look && ep.look.map) ep.look.map.base = "offline";
    return ep;
  }

  function validate(ep) {
    const errs = [];
    if (!ep || typeof ep !== "object") return ["Not an object"];
    if (ep.schema !== SCHEMA && !SCHEMA_LEGACY.includes(ep.schema)) errs.push(`schema must be ${SCHEMA} (or legacy globedesk.episode/1 / gobedesk.episode/1)`);
    if (!Array.isArray(ep.stories)) errs.push("stories[] missing");
    (ep.stories || []).forEach((s, i) => {
      if (!s.id) errs.push(`story ${i + 1}: id missing`);
      if (!s.location) errs.push(`story ${i + 1}: location missing`);
      (s.sources || []).forEach((src) => {
        if (!["verified", "unverified"].includes(src.status)) errs.push(`story ${i + 1}: source status must be verified|unverified`);
        if (src.url && !httpsOk(src.url)) errs.push(`story ${i + 1}: source url must be https`);
      });
      if (!Array.isArray(s.camera)) errs.push(`story ${i + 1}: camera[] missing`);
    });
    (ep.stories || []).forEach((st, i) => {
      if (st.creditUrl && !httpsOk(st.creditUrl)) errs.push(`story ${i + 1}: credit URL must be https`);
    });
    if (GD.schema) GD.schema.extraValidate(ep).forEach((m) => { if (errs.indexOf(m) < 0) errs.push(m); });
    if (GD.events) GD.events.validateLayers(ep.eventLayers).forEach((m) => errs.push(m));
    return errs;
  }

  function normalizeStory(st) {
    if (!st || typeof st !== "object") return st;
    if (st.summary == null) st.summary = "";
    if (st.credit == null) st.credit = "";
    if (st.creditUrl == null) st.creditUrl = "";
    if (st.asReported == null) st.asReported = true;
    if (st.date == null) st.date = "";
    st.audioOverlays = st.audioOverlays || [];
    st.content = st.content || [];
    st.media = st.media || [];
    st.captions = st.captions || [];
    return st;
  }

  function normalizeEpisode(ep) {
    if (!ep || typeof ep !== "object") return ep;
    if (SCHEMA_LEGACY.includes(ep.schema)) ep.schema = SCHEMA;
    ep.sample = !!(ep.sample || ep.demo);
    ep.mediaBin = ep.mediaBin || [];
    ep.eventLayers = ep.eventLayers || [];
    if (ep.look && GD.themes) {
      const id = ep.look.theme;
      if (!GD.themes.knownTheme(id)) {
        const base = (ep.look.map && ep.look.map.base) || null;
        ep.look = GD.themes.lookFor(GD.themes.DEFAULT);
        if (base) ep.look.map.base = base;
      }
    }
    (ep.stories || []).forEach(normalizeStory);
    return ep;
  }

  function duplicateStory(st) {
    const copy = JSON.parse(JSON.stringify(st || blankStory(1)));
    copy.id = uid("story");
    copy.slug = (copy.slug || "story") + "-copy";
    copy.title = (copy.title || "Story") + " (copy)";
    (copy.cards || []).forEach((c) => { c.id = uid("card"); });
    (copy.sources || []).forEach((c) => { c.id = uid("src"); });
    (copy.camera || []).forEach((c) => { c.id = uid("kf"); });
    (copy.audioOverlays || []).forEach((c) => { c.id = uid("snd"); });
    (copy.content || []).forEach((c) => { c.id = uid("ct"); });
    return copy;
  }

  function storyStarts(ep) {
    let t = 0;
    return ep.stories.map((s) => {
      const start = t;
      t += Number(s.durationSec) || 0;
      return start;
    });
  }

  function storiesDuration(ep) {
    return ep.stories.reduce((a, s) => a + (Number(s.durationSec) || 0), 0);
  }
  // True when playing the episode would change what is on screen: a camera move,
  // a caption, a placed shot or a voiceover, or a card someone has written.
  // A blank episode has none of these, so its clock would run over a still globe.
  function hasTimeline(ep) {
    return !!(ep && (ep.stories || []).some((s) => (s.camera || []).length || (s.captions || []).length ||
      (s.media || []).length || (s.audioOverlays || []).length || s.voiceover ||
      (s.cards || []).some((c) => c && c.title && c.title !== U)));
  }
  function totalDuration(ep) {
    const o = ep.outro && ep.outro.enabled ? Number(ep.outro.durationSec) || 0 : 0;
    return storiesDuration(ep) + o;
  }

  GD.model = { SCHEMA, SCHEMA_LEGACY, U, PRESETS, uid, keyframe, autoCameraPath, autoCameraPathForLocation, pointInLand, lookTarget, blankEpisode, blankStory, blankCard, blankSource, sampleEpisode, setSampleEpisode, SAMPLE_ID, SAMPLE_FILE, validate, normalizeStory, normalizeEpisode, duplicateStory, storyStarts, totalDuration, storiesDuration, hasTimeline, blankCitation, mapCitation, citationLine };
})();
