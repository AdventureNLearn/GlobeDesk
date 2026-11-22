/* Event Layers on the globe: sources/layers, pulsing markers, animated routes, glowing zones, ring ripples,
   draw tools, selection, auto-frame. All drawn into the MapLibre canvas (so recordings capture it);
   labels are painted by the shared overlay painter. window.GD.eventsMap */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const E = () => GD.events;
  const em = { map: null, mode: "select", draft: [], selected: null, raf: 0, lastData: 0, installedOn: null };
  const empty = () => ({ type: "FeatureCollection", features: [] });
  const SRC = ["gd-ev-zone", "gd-ev-line", "gd-ev-pt", "gd-ev-head", "gd-ev-ripple", "gd-ev-sel", "gd-ev-draft"];

  function layersOf() { return (GD.state.episode && GD.state.episode.eventLayers) || []; }
  function displayLayers() {
    const project = layersOf();
    const nd = GD.newsdesk && GD.newsdesk.state && GD.newsdesk.state.view === "newsdesk";
    if (!nd || !GD.records || !GD.records.newsdeskLayers) return project;
    const extra = GD.records.newsdeskLayers() || [];
    const seen = {};
    project.forEach((l) => { if (l && l.id) seen[l.id] = true; });
    return project.concat(extra.filter((l) => l && l.id && !seen[l.id]));
  }
  function colorFor(layer, f) {
    const c = E().CATEGORIES[f.properties.category];
    return layer.styleByCategory && c ? c.color : layer.color;
  }
  // Event clock: manual slider when paused; story event window during playback; null = show all.
  function clock() {
    const S = GD.state;
    if (S.eventClockMode === "all") return null;
    if (S.eventClockMode === "manual" && !S.playing) return S.eventClockManual;
    const st = S.episode.stories[S.storyIdx], w = st && st.eventWindow;
    const a = w && E().parseTime(w.start), b = w && E().parseTime(w.end);
    if (a == null) return S.eventClockMode === "manual" ? S.eventClockManual : null;
    const lt = S.t - GD.model.storyStarts(S.episode)[S.storyIdx];
    return b == null || b <= a ? a : a + (b - a) * Math.max(0, Math.min(1, lt / (st.durationSec || 1)));
  }

  function visibleFeatures() {
    const c = clock(), S = GD.state, story = S.episode.stories[S.storyIdx];
    const out = [];
    displayLayers().forEach((l, li) => {
      if (!l.visible) return;
      l.features.forEach((f) => {
        if (!f.geometry) return;
        if (l.scope === "story" && f.properties.storyId && story && f.properties.storyId !== story.id) return;
        if (!E().visibleAt(f, c)) return;
        out.push({ l, li, f, color: colorFor(l, f), progress: E().progressAt(f, c) });
      });
    });
    return out;
  }
  function unlocated() {
    const out = [];
    layersOf().forEach((l) => l.features.forEach((f) => { if (!f.geometry) out.push({ l, f }); }));
    return out;
  }

  function build(now) {
    const zone = [], line = [], pt = [], head = [], ripple = [];
    const phase = ((now || performance.now()) / 2200) % 1;
    // Draw bottom layer first: the first layer in the list is on top.
    visibleFeatures().slice().reverse().forEach(({ f, color, progress }) => {
      const p = f.properties, base = { id: f.id, color, title: p.title, sel: em.selected === f.id ? 1 : 0, disputed: p.verification === "disputed" ? 1 : 0, verified: p.verification === "verified" ? 1 : 0 };
      if (p.kind === "polygon" || p.kind === "ring") {
        zone.push({ type: "Feature", properties: Object.assign({ ring: p.kind === "ring" ? 1 : 0 }, base), geometry: E().renderGeometry(f) });
        if (p.kind === "ring") {
          const c = f.geometry.coordinates, r = Number(p.radiusKm) || 1;
          [0, 0.5].forEach((off) => { const ph = (phase + off) % 1; ripple.push({ type: "Feature", properties: { color, o: 1 - ph }, geometry: E().ringPolygon(c[0], c[1], r * (0.15 + 0.85 * ph), 48) }); });
          pt.push({ type: "Feature", properties: base, geometry: f.geometry });
        }
      } else if (p.kind === "line") {
        const coords = f.geometry.coordinates;
        const shown = progress < 1 ? E().lineAt(coords, progress) : { part: coords, head: null };
        if (shown.part.length >= 2) line.push({ type: "Feature", properties: base, geometry: { type: "LineString", coordinates: shown.part } });
        // Moving head: follows the reveal while drawing, then loops along the route.
        const h = progress < 1 ? shown.head : E().lineAt(coords, phase).head;
        if (h) head.push({ type: "Feature", properties: base, geometry: { type: "Point", coordinates: h } });
      } else {
        pt.push({ type: "Feature", properties: base, geometry: f.geometry });
      }
    });
    const fc = (a) => ({ type: "FeatureCollection", features: a });
    return { zone: fc(zone), line: fc(line), pt: fc(pt), head: fc(head), ripple: fc(ripple) };
  }

  function setData(id, d) { const s = em.map && em.map.getSource(id); if (s) s.setData(d); }

  function install(map) {
    em.map = map;
    SRC.forEach((id) => { if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: empty(), lineMetrics: id === "gd-ev-line" }); });
    const add = (spec) => { if (!map.getLayer(spec.id)) map.addLayer(spec); };
    add({ id: "ev-zone-fill", type: "fill", source: "gd-ev-zone", paint: { "fill-color": ["get", "color"], "fill-opacity": ["case", ["==", ["get", "sel"], 1], 0.32, 0.2] } });
    add({ id: "ev-zone-glow", type: "line", source: "gd-ev-zone", paint: { "line-color": ["get", "color"], "line-width": 10, "line-blur": 8, "line-opacity": 0.7 } });
    add({ id: "ev-zone-edge", type: "line", source: "gd-ev-zone", filter: ["!=", ["get", "disputed"], 1], paint: { "line-color": ["get", "color"], "line-width": 2 } });
    add({ id: "ev-zone-edge-disputed", type: "line", source: "gd-ev-zone", filter: ["==", ["get", "disputed"], 1], paint: { "line-color": ["get", "color"], "line-width": 2, "line-dasharray": [2, 2] } });
    add({ id: "ev-ripple", type: "line", source: "gd-ev-ripple", paint: { "line-color": ["get", "color"], "line-width": 1.6, "line-opacity": ["*", 0.9, ["get", "o"]] } });
    add({ id: "ev-line-glow", type: "line", source: "gd-ev-line", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 9, "line-blur": 6, "line-opacity": 0.55 } });
    add({ id: "ev-line", type: "line", source: "gd-ev-line", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": ["case", ["==", ["get", "sel"], 1], 4, 2.6] } });
    add({ id: "ev-head", type: "circle", source: "gd-ev-head", paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-color": ["get", "color"], "circle-stroke-width": 3 } });
    add({ id: "ev-pt-pulse", type: "circle", source: "gd-ev-pt", paint: { "circle-radius": 10, "circle-color": ["get", "color"], "circle-opacity": 0.35, "circle-pitch-alignment": "map" } });
    add({ id: "ev-pt", type: "circle", source: "gd-ev-pt", paint: { "circle-radius": ["case", ["==", ["get", "sel"], 1], 8, 6], "circle-color": ["get", "color"], "circle-stroke-color": ["case", ["==", ["get", "disputed"], 1], "#ffd166", "#ffffff"], "circle-stroke-width": 2 } });
    add({ id: "ev-draft-line", type: "line", source: "gd-ev-draft", paint: { "line-color": "#ffffff", "line-width": 2, "line-dasharray": [2, 1] } });
    add({ id: "ev-draft-pt", type: "circle", source: "gd-ev-draft", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 4, "circle-color": "#fff" } });
    if (em.installedOn !== map) { em.installedOn = map; wireMap(map); }
    refresh();
    if (!em.raf) em.raf = requestAnimationFrame(animate);
  }

  function refresh() {
    if (!em.map || !em.map.getSource("gd-ev-pt")) return;
    const d = build();
    setData("gd-ev-zone", d.zone); setData("gd-ev-line", d.line); setData("gd-ev-pt", d.pt); setData("gd-ev-head", d.head); setData("gd-ev-ripple", d.ripple);
    drawDraft();
  }

  function detach(map) {
    if (map && em.map && em.map !== map) return;
    if (em.raf) { cancelAnimationFrame(em.raf); em.raf = 0; }
    em.map = null;
    em.installedOn = null;
  }

  // Pulse + ripples + moving heads at ~25 fps; the map repaints, so recordings include it.
  function animate(now) {
    em.raf = requestAnimationFrame(animate);
    const m = em.map;
    if (!m || !GD.state.episode) return;
    if (GD.globe && GD.globe.st && GD.globe.st.map && GD.globe.st.map !== m) return;
    let pulse;
    try { pulse = m.getLayer("ev-pt-pulse"); } catch (e) { return; }
    if (!pulse) return;
    if (GD.mapPointer && GD.mapPointer.reduceMotion && GD.mapPointer.reduceMotion()) {
      if (!em._pulseQuiet) {
        em._pulseQuiet = true;
        try { m.setPaintProperty("ev-pt-pulse", "circle-radius", 10); m.setPaintProperty("ev-pt-pulse", "circle-opacity", 0.2); } catch (e) { /* ignore */ }
      }
      return;
    }
    em._pulseQuiet = false;
    if (now - em.lastData < 40) return;
    em.lastData = now;
    const ph = (now / 1400) % 1;
    m.setPaintProperty("ev-pt-pulse", "circle-radius", 8 + 18 * ph);
    m.setPaintProperty("ev-pt-pulse", "circle-opacity", 0.45 * (1 - ph));
    const d = build(now);
    setData("gd-ev-head", d.head); setData("gd-ev-ripple", d.ripple);
    if (GD.state.playing) { setData("gd-ev-zone", d.zone); setData("gd-ev-line", d.line); setData("gd-ev-pt", d.pt); }
  }

  // ---------- Draw tools ----------
  function setMode(mode) {
    em.mode = mode; em.draft = [];
    const m = em.map; if (!m) return;
    if (mode === "select") m.doubleClickZoom.enable(); else m.doubleClickZoom.disable();
    m.getCanvas().style.cursor = mode === "select" ? "" : "crosshair";
    drawDraft();
  }
  function drawDraft() {
    const feats = em.draft.map((c) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: c } }));
    if (em.draft.length >= 2) feats.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: em.mode === "polygon" ? em.draft.concat([em.draft[0]]) : em.draft } });
    setData("gd-ev-draft", { type: "FeatureCollection", features: feats });
  }
  function currentLayer() {
    const ls = layersOf();
    if (!ls.length) ls.push(E().createLayer("Event layer 1"));
    return ls.find((l) => l.id === GD.state.eventLayerId) || ls[0];
  }
  function commit(kind, geometry) {
    const S = GD.state, story = S.episode.stories[S.storyIdx], l = currentLayer();
    const f = E().createFeature(kind, geometry, { storyId: story ? story.id : null, category: kind === "line" ? "convoy" : kind === "polygon" ? "blockade" : kind === "ring" ? "strike" : "other",
      precisionLabel: "Precision: drawn by hand on the map" });
    l.features.push(f);
    GD.state.eventLayerId = l.id;
    select(f.id);
    if (kind !== "point" && kind !== "ring") setMode("select");
    GD.eventsUI && GD.eventsUI.changed();
    return f;
  }
  function addVertex(c) {
    const lc = [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5];
    if (em.mode === "point") return commit("point", { type: "Point", coordinates: lc });
    if (em.mode === "ring") return commit("ring", { type: "Point", coordinates: lc });
    if (em.mode === "line" || em.mode === "polygon") { em.draft.push(lc); drawDraft(); }
    return null;
  }
  function finish() {
    if (em.mode === "line" && em.draft.length >= 2) return commit("line", { type: "LineString", coordinates: em.draft.slice() });
    if (em.mode === "polygon" && em.draft.length >= 3) return commit("polygon", { type: "Polygon", coordinates: [em.draft.concat([em.draft[0]])] });
    GD.ui.toast(em.mode === "polygon" ? "A zone needs at least 3 points." : em.mode === "line" ? "A route needs at least 2 points." : "Nothing to finish.");
    return null;
  }
  function wireMap(map) {
    map.on("click", (e) => {
      // In select mode the single map-pointer dispatcher owns the click (C2).
      if (em.mode === "select") return;
      const oe = e.originalEvent || {};
      if (GD.mapPointer && !GD.mapPointer.isPrimaryClick(oe)) return;
      if ((oe.detail || 1) > 1) return;
      addVertex([e.lngLat.lng, e.lngLat.lat]);
    });
    map.on("dblclick", (e) => { if (em.mode === "line" || em.mode === "polygon") { e.preventDefault(); finish(); } });
  }

  function find(id) {
    for (const l of layersOf()) { const f = l.features.find((x) => x.id === id); if (f) return { l, f }; }
    return null;
  }
  function select(id) { em.selected = id; const hit = find(id); if (hit) GD.state.eventLayerId = hit.l.id; refresh(); }

  // ---------- Auto-frame ----------
  function frame(features, opts) {
    const m = em.map; if (!m) return null;
    const b = E().bbox(features.filter((f) => f.geometry));
    if (!b) { GD.ui.toast("Nothing on the map to frame."); return null; }
    const single = b[0] === b[2] && b[1] === b[3];
    const pad = { top: 120, bottom: 140, left: 80, right: 80 };
    const cam = single ? { center: [b[0], b[1]], zoom: 12.5 } : m.cameraForBounds([[b[0], b[1]], [b[2], b[3]]], { padding: pad, maxZoom: 14 });
    if (!cam) return null;
    const c = cam.center.lng != null ? [cam.center.lng, cam.center.lat] : cam.center;
    const kf = { center: [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5], zoom: Math.round(Math.min(14, cam.zoom) * 100) / 100, pitch: (opts && opts.pitch) != null ? opts.pitch : 45, bearing: 0, durationSec: 2, ease: "cinematic" };
    if (!(opts && opts.dry)) GD.globe.flyTo(kf);
    return kf;
  }

  // Labels for the overlay painter and the readable panel (title, time, verification, precision).
  function labels() {
    return visibleFeatures().filter(({ l }) => l.labels).map(({ f, color }) => {
      const p = f.properties, cat = E().CATEGORIES[p.category] || E().CATEGORIES.other;
      return { lngLat: E().anchor(f), icon: cat.icon, color, title: p.title, time: E().timeLabel(p), verification: p.verification, example: p.example, storyId: p.storyId || null };
    });
  }
  function readable() {
    return visibleFeatures().map(({ f }) => {
      const p = f.properties, cat = E().CATEGORIES[p.category] || E().CATEGORIES.other;
      return { title: p.title, time: E().timeLabel(p), category: cat.label, verification: p.verification, precision: p.precisionLabel, example: p.example, kind: p.kind };
    });
  }

  GD.eventsMap = { em, install, detach, refresh, setMode, finish, addVertex, select, find, frame, labels, readable, clock, unlocated, visibleFeatures, currentLayer };
})();
