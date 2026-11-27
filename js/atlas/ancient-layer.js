/* Ancient World layer: the 13 ancient sites from the Atlas ancient-world pack as their own pins on the globe.
   Pins cluster at low zoom (screen-space grid), a cluster click zooms in, a pin click flies there and opens the
   site in the Atlas. Every pin is approximate (an official UNESCO World Heritage point, or for Pompeii a
   Pleiades site centre) and is drawn dashed.
   Myths (Atlantis, El Dorado, Shangri-La) are never pinned: the panel lists them as Atlas links only.
   Pins are DOM markers above the map; the base-map style, sources and tiles are never changed. Off by default.
   Optional polity outlines (Cliopatria, CC BY 4.0, a simplified subset): loaded from js/atlas/ancient-extents-data.js
   only when switched on, drawn dashed as one added GeoJSON source and two layers, one snapshot year at a time.
   window.GD.ancientLayer */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const KEY = "globedesk.ancient.v1";
  const ERAS = [
    { id: "before-3000-bce", label: "Before 3000 BCE" }, { id: "3000-1001-bce", label: "3000–1001 BCE" }, { id: "1000-1-bce", label: "1000–1 BCE" },
    { id: "1-1000-ce", label: "1–1000 CE" }, { id: "after-1000-ce", label: "After 1000 CE" }];
  const CELL_PX = 56, CLUSTER_BELOW = 6;
  const st = { on: false, era: "all", markers: [], wired: false, outlines: false, outlineYear: -500, loading: false };
  const EXT_INDEX = "data/atlas/ancient/extents-index.json", EXT_FILE = "js/atlas/ancient-extents-data.js";
  const EXT_SRC = "gd-ancient-extents", EXT_FILL = "gd-ancient-extents-fill", EXT_LINE = "gd-ancient-extents-line";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function load() {
    try {
      const v = JSON.parse(global.localStorage.getItem(KEY) || "null");
      if (v && typeof v === "object") {
        st.on = v.on === true; st.era = ERAS.some((e) => e.id === v.era) ? v.era : "all";
        st.outlines = v.outlines === true; if (Number.isInteger(v.outlineYear)) st.outlineYear = v.outlineYear;
      }
    } catch (e) { /* ignore */ }
  }
  function save() { try { global.localStorage.setItem(KEY, JSON.stringify({ on: st.on, era: st.era, outlines: st.outlines, outlineYear: st.outlineYear })); } catch (e) { /* ignore */ } }

  const recOf = (data, e) => (data.records || {})[e.record] || null;
  // Pure: one pin per ancient site that has a lat/lng place and a globedesk.ancient/1 site record. Myths never pin.
  function pins(data) {
    if (!data || !data.entries) return [];
    return data.entries.filter((e) => e.layer === "ancient").map((e) => {
      const rec = recOf(data, e), p = (e.places || [])[0];
      if (!rec || rec.schema !== "globedesk.ancient/1" || rec.kind !== "site" || !p || typeof p.lat !== "number" || typeof p.lng !== "number") return null;
      return { id: e.id, title: e.title, lat: p.lat, lng: p.lng, approximate: true, era: rec.era || "[UNKNOWN]", status: rec.status || "[UNKNOWN]", sensitive: !!rec.sensitive };
    }).filter(Boolean);
  }
  // Pure: sites whose pin is held for the owner's YES (sacred, Indigenous, burial or ritual sites): listed, never pinned.
  function held(data) {
    if (!data || !data.entries) return [];
    return data.entries.filter((e) => e.layer === "ancient").filter((e) => { const r = recOf(data, e); return r && r.kind === "site" && r.place && r.place.pin === "held"; }).map((e) => ({ id: e.id, title: e.title }));
  }
  // Pure: myth entries (no pins), for the panel list.
  function myths(data) {
    if (!data || !data.entries) return [];
    return data.entries.filter((e) => e.layer === "ancient").filter((e) => { const r = recOf(data, e); return r && r.kind === "myth"; }).map((e) => ({ id: e.id, title: e.title }));
  }
  function filter(list, f) { f = f || {}; return list.filter((p) => !f.era || f.era === "all" || p.era === f.era); }
  function project(lng, lat, zoom) {
    const size = 512 * Math.pow(2, zoom);
    const s = Math.sin(Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180);
    return { x: (lng + 180) / 360 * size, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size };
  }
  function cluster(list, zoom) {
    if (zoom >= CLUSTER_BELOW) return list.map((p) => ({ id: p.id, count: 1, lat: p.lat, lng: p.lng, pins: [p] }));
    const cells = new Map();
    list.forEach((p) => { const q = project(p.lng, p.lat, zoom); const k = Math.floor(q.x / CELL_PX) + ":" + Math.floor(q.y / CELL_PX); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(p); });
    return Array.from(cells.entries()).map(([k, ps]) => ({ id: ps.length === 1 ? ps[0].id : "c:" + k, count: ps.length, pins: ps,
      lat: ps.reduce((a, p) => a + p.lat, 0) / ps.length, lng: ps.reduce((a, p) => a + p.lng, 0) / ps.length }));
  }

  // ---- polity outlines (Cliopatria subset) ----
  function extIndex(d) { return (d && d.records && d.records[EXT_INDEX]) || null; }
  function yearName(y) { return y < 0 ? -y + " BCE" : y + " CE"; } // Cliopatria years: negative = BCE (no year 0)
  // Pure: the outline features for one snapshot year, each flagged approximate.
  function outlinesFor(fc, year) {
    if (!fc || !Array.isArray(fc.features)) return { type: "FeatureCollection", features: [] };
    return { type: "FeatureCollection", features: fc.features.filter((f) => f.properties && f.properties.year === year)
      .map((f) => ({ type: "Feature", geometry: f.geometry, properties: { name: f.properties.name, from: f.properties.from, to: f.properties.to, approximate: true } })) };
  }
  function loadExtents(done) {
    if (GD.ancientExtents) { done(); return; }
    if (st.loading || !global.document) return;
    st.loading = true;
    const s = global.document.createElement("script");
    s.src = EXT_FILE; s.async = true;
    s.onload = () => { st.loading = false; done(); };
    s.onerror = () => { st.loading = false; if (GD.ui && GD.ui.toast) GD.ui.toast("Polity outlines could not load"); };
    global.document.head.appendChild(s);
  }
  function removeOutlines(m) {
    try { if (m.getLayer(EXT_LINE)) m.removeLayer(EXT_LINE); if (m.getLayer(EXT_FILL)) m.removeLayer(EXT_FILL); if (m.getSource(EXT_SRC)) m.removeSource(EXT_SRC); } catch (e) { /* ignore */ }
  }
  function applyOutlines() {
    const m = map();
    if (!m || typeof m.addSource !== "function") return;
    if (!st.outlines) { removeOutlines(m); return; }
    loadExtents(() => {
      const mm = map(); if (!mm || !st.outlines) return;
      const gj = outlinesFor(GD.ancientExtents, st.outlineYear);
      try {
        if (mm.getSource(EXT_SRC)) mm.getSource(EXT_SRC).setData(gj);
        else {
          mm.addSource(EXT_SRC, { type: "geojson", data: gj, attribution: (GD.ancientExtents && GD.ancientExtents.credit) || "" });
          mm.addLayer({ id: EXT_FILL, type: "fill", source: EXT_SRC, paint: { "fill-color": "#d9a45e", "fill-opacity": 0.08 } });
          mm.addLayer({ id: EXT_LINE, type: "line", source: EXT_SRC, paint: { "line-color": "#f2d49b", "line-width": 1.2, "line-opacity": 0.85, "line-dasharray": [2, 2] } });
        }
        // Click a polity for its name; wired once, after the layer exists, and ignored while outlines are off.
        if (!st.clickWired) {
          st.clickWired = true;
          mm.on("click", (ev) => {
            if (!st.outlines || !mm.getLayer(EXT_FILL)) return;
            const f = mm.queryRenderedFeatures(ev.point, { layers: [EXT_FILL] })[0];
            if (f && GD.ui && GD.ui.toast) GD.ui.toast(f.properties.name + " (approximate border, " + yearName(st.outlineYear) + "; Cliopatria)");
          });
        }
      } catch (e) { /* style not ready; retried on style.load */ }
    });
  }
  function setOutlines(on, year) { st.outlines = !!on; if (Number.isInteger(year)) st.outlineYear = year; save(); applyOutlines(); }

  function data() { return GD.atlasData || null; }
  function map() { return GD.globe && GD.globe.st && GD.globe.st.map; }
  function visible() { return filter(pins(data()), { era: st.era }); }
  function clear() { st.markers.forEach((m) => { try { m.remove(); } catch (e) { /* ignore */ } }); st.markers = []; }

  function open(id) {
    if (!GD.atlas) return;
    if (!GD.atlas.st.open) GD.atlas.open();
    GD.atlas.st.view = GD.atlas.st.view === "place" ? "az" : GD.atlas.st.view;
    GD.atlas.st.mode = "globe";
    GD.atlas.st.tab = "object";
    GD.atlas.select(id);
  }
  function sync() {
    clear();
    const m = map();
    if (!st.on || !m || !global.maplibregl) return;
    const z = typeof m.getZoom === "function" ? m.getZoom() : 2;
    cluster(visible(), Math.floor(z)).forEach((c) => {
      const el = global.document.createElement("button");
      el.type = "button";
      if (c.count > 1) {
        el.className = "aw-cluster";
        el.textContent = String(c.count);
        el.setAttribute("aria-label", c.count + " ancient sites here: zoom in");
        el.title = c.pins.map((p) => p.title).join("\n");
        el.addEventListener("click", (ev) => { ev.stopPropagation(); if (GD.globe.flyTo) GD.globe.flyTo({ center: [c.lng, c.lat], zoom: Math.min(CLUSTER_BELOW, Math.floor(z) + 2), durationSec: 1.2 }); });
      } else {
        const p = c.pins[0];
        el.className = "aw-pin" + (p.sensitive ? " aw-danger" : "");
        el.setAttribute("data-ancient", p.id);
        const label = p.title + " (approximate pin)" + (p.sensitive ? " · " + p.status : "");
        el.setAttribute("aria-label", "Ancient site: " + label);
        el.title = label;
        const s = global.document.createElement("span"); s.className = "aw-glyph"; s.setAttribute("aria-hidden", "true"); el.appendChild(s);
        el.addEventListener("click", (ev) => { ev.stopPropagation(); open(p.id); });
      }
      st.markers.push(new global.maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(m));
    });
  }
  function attach() {
    const m = map();
    if (m && !st.wired && typeof m.on === "function") {
      st.wired = true; m.on("zoomend", sync); m.on("style.load", applyOutlines);
    }
    sync(); applyOutlines();
  }
  function setOn(on) { st.on = !!on; save(); sync(); }
  function setFilter(f) { if (f.era !== undefined) st.era = f.era; save(); sync(); }

  function panelHtml() {
    const all = pins(data()), shown = filter(all, { era: st.era }), ms = myths(data()), hs = held(data());
    return '<section class="lp-group" aria-labelledby="lpAncientH"><h3 id="lpAncientH">Ancient World <span class="muted">(Atlas: History and places)</span></h3>' +
      '<label class="lp-row' + (st.on ? " on" : "") + '"><input type="checkbox" role="switch" id="lpAncient"' + (st.on ? " checked" : "") + ' aria-checked="' + st.on + '"><span class="lp-legend lp-legend-pin aw-swatch" aria-hidden="true"></span>' +
      '<span class="lp-text"><span class="lp-name">Ancient sites and lost cities</span><span class="lp-desc">' + shown.length + " of " + all.length +
      " pinned sites shown" + (hs.length ? "; " + hs.length + " more held for owner review (text only, listed below)" : "") + ". Every pin is approximate (dashed): a site centre, not a boundary. Pick a site to fly there and open it in the Atlas.</span>" +
      '<span class="lp-credit">Pins: Pleiades (CC BY 3.0) and Wikidata (CC0). Dates: UNESCO World Heritage pages and Pleiades.</span></span></label>' +
      '<div class="lp-actions aw-filters"><label class="small">Earliest cited date <select id="lpAncientEra"><option value="all">All eras</option>' +
      ERAS.map((e) => '<option value="' + esc(e.id) + '"' + (st.era === e.id ? " selected" : "") + ">" + esc(e.label) + "</option>").join("") + "</select></label></div>" +
      outlinesHtml() +
      (hs.length ? '<p class="small aw-myths">Pins held for owner review <span class="muted">(sacred, Indigenous, burial or ritual sites; text only)</span>: ' +
        hs.map((m) => '<button type="button" class="linklike" data-aw-entry="' + esc(m.id) + '">' + esc(m.title) + "</button>").join(" · ") + "</p>" : "") +
      (ms.length ? '<p class="small aw-myths">Myths and legends <span class="muted">(no pins; story source cited, real place not proven)</span>: ' +
        ms.map((m) => '<button type="button" class="linklike" data-aw-entry="' + esc(m.id) + '">' + esc(m.title.replace(/^Myth: /, "")) + "</button>").join(" · ") + "</p>" : "") +
      "</section>";
  }
  function outlinesHtml() {
    const idx = extIndex(data());
    if (!idx) return "";
    const yr = idx.years.find((y) => y.year === st.outlineYear) || idx.years[0];
    return '<label class="lp-row lp-sub' + (st.outlines ? " on" : "") + '"><input type="checkbox" role="switch" id="lpAncientOutlines"' + (st.outlines ? " checked" : "") + ' aria-checked="' + st.outlines + '"><span class="lp-legend aw-outline-swatch" aria-hidden="true"></span>' +
      '<span class="lp-text"><span class="lp-name">Polity outlines (approximate)</span><span class="lp-desc">Dashed borders of past states for one year: ' + esc(yr.polities) + " outlines in " + esc(yearName(yr.year)) +
      ". Borders are approximate and are one version of past territory; none before 3400 BCE.</span>" +
      '<span class="lp-credit aw-credit">' + esc(idx.attribution) + "</span></span></label>" +
      '<div class="lp-actions aw-filters"><label class="small">Outline year <select id="lpAncientYear">' +
      idx.years.map((y) => '<option value="' + y.year + '"' + (y.year === st.outlineYear ? " selected" : "") + ">" + esc(yearName(y.year)) + "</option>").join("") + "</select></label></div>";
  }
  function bind(body, rerender) {
    const o = body.querySelector("#lpAncientOutlines"); if (o) o.addEventListener("change", () => { setOutlines(o.checked); rerender(); });
    const y = body.querySelector("#lpAncientYear"); if (y) y.addEventListener("change", () => { setOutlines(true, parseInt(y.value, 10)); rerender(); });
    const t = body.querySelector("#lpAncient"); if (t) t.addEventListener("change", () => { setOn(t.checked); rerender(); });
    const e = body.querySelector("#lpAncientEra"); if (e) e.addEventListener("change", () => { setFilter({ era: e.value }); rerender(); });
    body.querySelectorAll("[data-aw-entry]").forEach((b) => b.addEventListener("click", () => open(b.getAttribute("data-aw-entry"))));
  }

  function wire() {
    load();
    if (GD.globe && GD.globe.st && GD.globe.st.onReady) GD.globe.st.onReady.push(attach);
    if (map() && map().loaded && map().loaded()) attach();
  }

  GD.ancientLayer = { st, KEY, ERAS, CLUSTER_BELOW, EXT_FILE, outlinesFor, setOutlines, applyOutlines, pins, held, myths, filter, cluster, project, panelHtml, bind, sync, setOn, setFilter, open };
  if (typeof module !== "undefined" && module.exports) module.exports = GD.ancientLayer;
  if (global.document) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", wire); else wire(); }
})(typeof window !== "undefined" ? window : globalThis);
