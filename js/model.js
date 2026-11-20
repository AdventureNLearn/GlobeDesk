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
  // shotSec sets the cut length (CTD style: 7-9 s per shot, cuts on topic shifts).
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

  // Per-shot source citation box (CTD style): media type + date / credit / license.
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
      show: U,
      title: U,
      date: new Date().toISOString().slice(0, 10),
      lede: U,
      cta: U,
      links: [],
      demo: false,
      sample: false,
      look: GD.themes ? GD.themes.lookFor("ctd") : { theme: "ctd" },
      handle: "@[handle]",
      outro: { enabled: true, durationSec: 5, line1: "Full brief on the channel", link: "[channel link]", handle: "@[handle]", showXLogo: true },
      output: { aspect: "16:9", fps: 30 },
      stories: [blankStory(1)],
      eventLayers: [], // Event Layers builder (see js/events-model.js); each layer exports as GeoJSON
      mediaBin: [] // descriptors only; local file bytes are never stored in the JSON
    };
  }

  // Demo episode. Structure only: claims are restated from the creator's public post and
  // are NOT independently verified. Locations are approximate city/strait centers.
  function demoEpisode() {
    const POST = "https://x.com/TheCriticalDri1/status/2123762612571886024";
    const POST2 = "https://x.com/TheCriticalDri1/status/2123762859985277078";
    const creatorSrc = (label, url) => ({
      id: uid("src"),
      label,
      url,
      status: "unverified",
      note: "Creator's own public post. Not independently checked. Primary sources [UNKNOWN]."
    });
    const mk = (n, slug, title, loc, cardTitle, cardBody, script) => {
      const s = blankStory(n);
      s.slug = slug;
      s.title = title;
      s.location = Object.assign({ precision: "approximate", verified: false, note: "demo, not verified" }, loc);
      s.camera = autoCameraPathForLocation(loc, 8, (typeof window !== 'undefined' && window.GD_LAND) || null);
      s.durationSec = 16;
      s.highlight = { a3: loc.a3 || null, geojson: null };
      // Map-shot citation reflects the default free base map (see README for licenses).
      // "auto" fills credit/license from whichever base map is on (see globe.baseCitation).
      s.camera.forEach((k) => { k.citation = { type: "Map", date: "auto", credit: "auto", license: "auto" }; });
      const c = blankCard(loc.lat, loc.lon);
      c.title = cardTitle;
      c.body = cardBody;
      c.why = U;
      c.facts = [
        { label: "Claim status", value: "As stated in creator's post; not verified" },
        { label: "Exact site", value: U },
        { label: "Primary source", value: U }
      ];
      c.at = 2;
      c.dur = 12;
      s.sources = [creatorSrc("CTD's Geopolitics Update post (X)", POST), blankSource()];
      c.sourceIds = [s.sources[0].id];
      s.cards = [c];
      s.script = script;
      s.captions = GD.captions ? GD.captions.fromScript(script, s.durationSec) : [];
      return s;
    };
    const ep = blankEpisode();
    ep.demo = true;
    ep.sample = true;
    ep.show = "CTD's Geopolitics Update";
    ep.title = "🌍 CTD's Geopolitics Update, Fri Nov 20 '26";
    ep.date = "2026-11-20";
    ep.lede = "Three stories from the creator's post: an Iran tanker convoy vs a U.S. blockade in Hormuz; Russia hits three Kyiv bridges after Kerch strikes; a Houthi missile hits Riyadh's tallest tower. DEMO STRUCTURE ONLY: claims are not verified here.";
    ep.cta = "Full 16-min brief 👇 Follow for daily updates.";
    ep.handle = "@TheCriticalDri1";
    ep.outro.handle = "@TheCriticalDri1";
    ep.outro.link = "[channel link — UNKNOWN]";
    ep.links = [
      { label: "Creator post", url: POST },
      { label: "Creator post (brief link)", url: POST2 }
    ];
    ep.stories = [
      mk(1, "hormuz", "Iran tanker convoy vs U.S. blockade in Hormuz",
        { name: "Strait of Hormuz (approx. center)", lat: 26.57, lon: 56.25, a3: "IRN" },
        "Tanker convoy vs blockade",
        "Placeholder card. The creator's post reports an Iranian tanker convoy facing a U.S. blockade in the Strait of Hormuz. Details, vessels and positions: [UNKNOWN].",
        "Story one. The creator reports an Iranian tanker convoy facing a U.S. blockade in the Strait of Hormuz. This is demo structure only. Details are unknown and not verified."),
      mk(2, "kyiv-bridges", "Russia hits three Kyiv bridges after Kerch strikes",
        { name: "Kyiv, Dnipro river crossings (approx.)", lat: 50.45, lon: 30.56, a3: "UKR" },
        "Three Kyiv bridges",
        "Placeholder card. The creator's post reports Russian strikes on three Kyiv bridges following Kerch strikes. Which bridges, and damage: [UNKNOWN].",
        "Story two. The creator reports that Russia hit three bridges in Kyiv after strikes on Kerch. Which bridges were hit is unknown here. Not verified."),
      mk(3, "riyadh-tower", "Houthi missile hits Riyadh's tallest tower",
        { name: "Riyadh (city, approx.; exact tower not pinned)", lat: 24.71, lon: 46.68, a3: "SAU" },
        "Riyadh strike claim",
        "Placeholder card. The creator's post reports a Houthi missile hitting Riyadh's tallest tower. The building is not pinned here; exact site: [UNKNOWN].",
        "Story three. The creator reports a Houthi missile strike on Riyadh's tallest tower. The exact building is not pinned in this demo. Not verified.")
    ];
    if (GD.events) ep.eventLayers = GD.events.demoLayers(ep);
    ep.mediaBin = [
      { ref: "placeholder-brief-16x9", name: "Full brief 16:9 (16 min) — drop file", kind: "video", local: false, note: "Placeholder slot" },
      { ref: "placeholder-vertical-9x16", name: "Vertical cut 9:16 (47 s) — drop file", kind: "video", local: false, note: "Placeholder slot" }
    ];
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
  function totalDuration(ep) {
    const o = ep.outro && ep.outro.enabled ? Number(ep.outro.durationSec) || 0 : 0;
    return storiesDuration(ep) + o;
  }

  GD.model = { SCHEMA, SCHEMA_LEGACY, U, PRESETS, uid, keyframe, autoCameraPath, autoCameraPathForLocation, pointInLand, lookTarget, blankEpisode, blankStory, blankCard, blankSource, demoEpisode, validate, normalizeStory, normalizeEpisode, duplicateStory, storyStarts, totalDuration, storiesDuration, blankCitation, mapCitation, citationLine };
})();
