/* Bells layer: the worldwide bells from the Atlas Bells pack as their own pins on the globe.
   Pins cluster at low zoom (screen-space grid), a cluster click zooms in, a pin click drills to the place
   and opens the bell in the Atlas (Object tab, with its 3D bell). Era and region filters live in the Layers panel.
   Pins are DOM markers above the map; the base-map style, sources and tiles are never changed.
   Every pin comes from a sourced record; approximate pins are labelled. window.GD.bellsLayer */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const KEY = "globedesk.bells.v1";
  const ERAS = [
    { id: "ancient", label: "Ancient (before 500)" }, { id: "medieval", label: "Medieval (500–1499)" },
    { id: "early-modern", label: "Early modern (1500–1799)" }, { id: "19th-century", label: "19th century" },
    { id: "20th-century", label: "20th century" }, { id: "21st-century", label: "21st century" }, { id: "[UNKNOWN]", label: "Era [UNKNOWN]" }];
  const REGIONS = ["Africa", "Asia", "Europe", "North America", "Oceania", "South America"];
  const CELL_PX = 56;      // cluster grid size in screen pixels
  const CLUSTER_BELOW = 9; // no clustering at this zoom and above
  const st = { on: true, era: "all", region: "all", markers: [], wired: false };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function load() {
    try {
      const v = JSON.parse(global.localStorage.getItem(KEY) || "null");
      if (v && typeof v === "object") {
        st.on = v.on !== false;
        st.era = ERAS.some((e) => e.id === v.era) ? v.era : "all";
        st.region = REGIONS.indexOf(v.region) >= 0 ? v.region : "all";
      }
    } catch (e) { /* ignore */ }
  }
  function save() { try { global.localStorage.setItem(KEY, JSON.stringify({ on: st.on, era: st.era, region: st.region })); } catch (e) { /* ignore */ } }

  // Pure: one pin per bells-layer entry that has a site point and a bell record.
  function pins(data) {
    if (!data || !data.entries) return [];
    return data.entries.filter((e) => e.layer === "bells" && e.kind === "object").map((e) => {
      const p = (e.places || [])[0];
      const rec = (data.records || {})[e.record] || null;
      if (!p || typeof p.lat !== "number" || typeof p.lng !== "number" || !rec) return null;
      return { id: e.id, title: e.title, lat: p.lat, lng: p.lng, approximate: /approximate/i.test(p.note || "") || !!(rec.place && rec.place.approximate),
        era: rec.era || "[UNKNOWN]", region: rec.region || "[UNKNOWN]", status: rec.status || "[UNKNOWN]", model: !!(rec.model && rec.model.available) };
    }).filter(Boolean);
  }
  function filter(list, f) {
    f = f || {};
    return list.filter((p) => (!f.era || f.era === "all" || p.era === f.era) && (!f.region || f.region === "all" || p.region === f.region));
  }
  // Web Mercator world pixels at a zoom (512 px tiles, as MapLibre).
  function project(lng, lat, zoom) {
    const size = 512 * Math.pow(2, zoom);
    const s = Math.sin(Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180);
    return { x: (lng + 180) / 360 * size, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size };
  }
  // Pure: grid clusters. Returns [{ id, count, lat, lng, pins }] with single pins as count 1.
  function cluster(list, zoom) {
    if (zoom >= CLUSTER_BELOW) return list.map((p) => ({ id: p.id, count: 1, lat: p.lat, lng: p.lng, pins: [p] }));
    const cells = new Map();
    list.forEach((p) => {
      const q = project(p.lng, p.lat, zoom);
      const k = Math.floor(q.x / CELL_PX) + ":" + Math.floor(q.y / CELL_PX);
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(p);
    });
    return Array.from(cells.entries()).map(([k, ps]) => ({
      id: ps.length === 1 ? ps[0].id : "c:" + k, count: ps.length, pins: ps,
      lat: ps.reduce((a, p) => a + p.lat, 0) / ps.length, lng: ps.reduce((a, p) => a + p.lng, 0) / ps.length }));
  }

  function data() { return GD.atlasData || null; }
  function map() { return GD.globe && GD.globe.st && GD.globe.st.map; }
  function visible() { return filter(pins(data()), { era: st.era, region: st.region }); }
  function clear() { st.markers.forEach((m) => { try { m.remove(); } catch (e) { /* ignore */ } }); st.markers = []; }

  function drill(id) {
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
        el.className = "bl-cluster";
        el.textContent = String(c.count);
        el.setAttribute("aria-label", c.count + " bells here: zoom in");
        el.title = c.pins.map((p) => p.title).join("\n");
        el.addEventListener("click", (ev) => { ev.stopPropagation(); if (GD.globe.flyTo) GD.globe.flyTo({ center: [c.lng, c.lat], zoom: Math.min(CLUSTER_BELOW, Math.floor(z) + 2), durationSec: 1.2 }); });
      } else {
        const p = c.pins[0];
        el.className = "bl-pin" + (p.approximate ? " bl-approx" : "") + (p.status === "lost" ? " bl-lost" : "");
        el.setAttribute("data-bell", p.id);
        const label = p.title + (p.approximate ? " (approximate pin)" : "") + (p.status === "lost" ? " (lost)" : "");
        el.setAttribute("aria-label", "Bell: " + label);
        el.title = label;
        const s = global.document.createElement("span"); s.className = "bl-glyph"; s.setAttribute("aria-hidden", "true"); el.appendChild(s);
        el.addEventListener("click", (ev) => { ev.stopPropagation(); drill(p.id); });
      }
      st.markers.push(new global.maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(m));
    });
  }
  function attach() {
    const m = map();
    if (m && !st.wired && typeof m.on === "function") { st.wired = true; m.on("zoomend", sync); }
    sync();
  }
  function setOn(on) { st.on = !!on; save(); sync(); }
  function setFilter(f) { if (f.era !== undefined) st.era = f.era; if (f.region !== undefined) st.region = f.region; save(); sync(); }

  function panelHtml() {
    const all = pins(data()), shown = filter(all, { era: st.era, region: st.region });
    const approx = shown.filter((p) => p.approximate).length;
    return '<section class="lp-group" aria-labelledby="lpBellsH"><h3 id="lpBellsH">Bells <span class="muted">(Atlas: 3D objects and builds)</span></h3>' +
      '<label class="lp-row' + (st.on ? " on" : "") + '"><input type="checkbox" role="switch" id="lpBells"' + (st.on ? " checked" : "") + ' aria-checked="' + st.on + '"><span class="lp-legend lp-legend-pin bl-swatch" aria-hidden="true"></span>' +
      '<span class="lp-text"><span class="lp-name">Historic bells worldwide</span><span class="lp-desc">' + shown.length + " of " + all.length + " sourced bells shown" + (approx ? ", " + approx + " with approximate pins (dashed)" : "") + ". Pins group when zoomed out; pick a bell to fly there and open it in the Atlas.</span></span></label>" +
      '<div class="lp-actions bl-filters"><label class="small">Era <select id="lpBellsEra"><option value="all">All eras</option>' +
      ERAS.map((e) => '<option value="' + esc(e.id) + '"' + (st.era === e.id ? " selected" : "") + ">" + esc(e.label) + "</option>").join("") + "</select></label> " +
      '<label class="small">Region <select id="lpBellsRegion"><option value="all">All regions</option>' +
      REGIONS.map((r) => '<option value="' + esc(r) + '"' + (st.region === r ? " selected" : "") + ">" + esc(r) + "</option>").join("") + "</select></label></div></section>";
  }
  function bind(body, rerender) {
    const t = body.querySelector("#lpBells"); if (t) t.addEventListener("change", () => { setOn(t.checked); rerender(); });
    const e = body.querySelector("#lpBellsEra"); if (e) e.addEventListener("change", () => { setFilter({ era: e.value }); rerender(); });
    const r = body.querySelector("#lpBellsRegion"); if (r) r.addEventListener("change", () => { setFilter({ region: r.value }); rerender(); });
  }

  function wire() {
    load();
    if (GD.globe && GD.globe.st && GD.globe.st.onReady) GD.globe.st.onReady.push(attach);
    if (map() && map().loaded && map().loaded()) attach();
  }

  GD.bellsLayer = { st, KEY, ERAS, REGIONS, CLUSTER_BELOW, pins, filter, cluster, project, panelHtml, bind, sync, setOn, setFilter, drill };
  if (typeof module !== "undefined" && module.exports) module.exports = GD.bellsLayer;
  if (global.document) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", wire); else wire(); }
})(typeof window !== "undefined" ? window : globalThis);
