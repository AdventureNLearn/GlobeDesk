/* Disasters layer (Volcanoes, earthquakes and disasters): historic eruptions and earthquakes from the
   Atlas earth/natural-hazards records as their own pins on the globe. Same pattern as the Bells layer
   (js/atlas/bells-layer.js): DOM markers above the map, screen-grid clusters at low zoom (Bells' cluster()
   is reused), a pin click drills to the place and opens the event in the Atlas. Members come from the
   disasters overview record, so existing Atlas events (Mount St. Helens 1980, San Francisco 1906) are
   pinned from their own entries, never copied. Every pin is NOAA NCEI's published point or the existing
   entry's pin (the Vesuvius 79 link uses Pompeii's Pleiades point) and is labelled approximate. Off by default. window.GD.disastersLayer */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const KEY = "globedesk.disasters.v1";
  const OVERVIEW = "data/atlas/disasters/disasters-overview.json";
  const HAZARDS = [{ id: "eruption", label: "Volcanic eruptions" }, { id: "earthquake", label: "Earthquakes" }];
  const st = { on: false, hazard: "all", markers: [], wired: false };
  const BL = () => GD.bellsLayer || (typeof require === "function" ? require("./bells-layer.js") : null);

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function load() {
    try {
      const v = JSON.parse(global.localStorage.getItem(KEY) || "null");
      if (v && typeof v === "object") { st.on = v.on === true; st.hazard = HAZARDS.some((h) => h.id === v.hazard) ? v.hazard : "all"; }
    } catch (e) { /* ignore */ }
  }
  function save() { try { global.localStorage.setItem(KEY, JSON.stringify({ on: st.on, hazard: st.hazard })); } catch (e) { /* ignore */ } }

  // Pure: one pin per overview member that has a lat/lng place (new records and cross-linked entries).
  function pins(data) {
    if (!data || !data.entries) return [];
    const ov = (data.records || {})[OVERVIEW];
    if (!ov || !Array.isArray(ov.members)) return [];
    const byId = new Map(data.entries.map((e) => [e.id, e]));
    return ov.members.map((m) => {
      const e = byId.get(m.id);
      const p = e && (e.places || []).find((q) => typeof q.lat === "number" && typeof q.lng === "number");
      if (!p) return null;
      const d = (e.dates || [])[0];
      return { id: e.id, title: e.title, lat: p.lat, lng: p.lng, hazard: m.hazard, linked: !!m.linked, year: d ? parseInt(d.date, 10) : null, approximate: true };
    }).filter(Boolean);
  }
  function filter(list, f) { f = f || {}; return list.filter((p) => !f.hazard || f.hazard === "all" || p.hazard === f.hazard); }

  function data() { return GD.atlasData || null; }
  function map() { return GD.globe && GD.globe.st && GD.globe.st.map; }
  function visible() { return filter(pins(data()), { hazard: st.hazard }); }
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
    const m = map(), bl = BL();
    if (!st.on || !m || !global.maplibregl || !bl) return;
    const z = typeof m.getZoom === "function" ? m.getZoom() : 2;
    bl.cluster(visible(), Math.floor(z)).forEach((c) => {
      const el = global.document.createElement("button");
      el.type = "button";
      if (c.count > 1) {
        el.className = "dl-cluster";
        el.textContent = String(c.count);
        el.setAttribute("aria-label", c.count + " disasters here: zoom in");
        el.title = c.pins.map((p) => p.title).join("\n");
        el.addEventListener("click", (ev) => { ev.stopPropagation(); if (GD.globe.flyTo) GD.globe.flyTo({ center: [c.lng, c.lat], zoom: Math.min(bl.CLUSTER_BELOW, Math.floor(z) + 2), durationSec: 1.2 }); });
      } else {
        const p = c.pins[0];
        el.className = "dl-pin dl-" + p.hazard;
        el.setAttribute("data-disaster", p.id);
        const label = p.title + " (approximate pin)";
        el.setAttribute("aria-label", (p.hazard === "earthquake" ? "Earthquake: " : "Eruption: ") + label);
        el.title = label;
        const s = global.document.createElement("span"); s.className = "dl-glyph"; s.setAttribute("aria-hidden", "true"); el.appendChild(s);
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
  function setFilter(f) { if (f.hazard !== undefined) st.hazard = f.hazard; save(); sync(); }

  function panelHtml() {
    const all = pins(data()), shown = filter(all, { hazard: st.hazard });
    if (!all.length) return "";
    return '<section class="lp-group" aria-labelledby="lpDisastersH"><h3 id="lpDisastersH">Volcanoes, earthquakes and disasters <span class="muted">(Atlas: Earth)</span></h3>' +
      '<label class="lp-row' + (st.on ? " on" : "") + '"><input type="checkbox" role="switch" id="lpDisasters"' + (st.on ? " checked" : "") + ' aria-checked="' + st.on + '"><span class="lp-legend lp-legend-pin dl-swatch" aria-hidden="true"></span>' +
      '<span class="lp-text"><span class="lp-name">Historic eruptions and earthquakes</span><span class="lp-desc">' + shown.length + " of " + all.length + " events shown. Pins are NOAA NCEI published points, so they are approximate, except the Vesuvius 79 link, which uses Pompeii's Pleiades point. Pick one to fly there and open it in the Atlas.</span>" +
      '<span class="lp-credit">NOAA NCEI significant volcano and earthquake databases; USGS.</span></span></label>' +
      '<div class="lp-actions dl-filters"><label class="small">Type <select id="lpDisastersHazard"><option value="all">All types</option>' +
      HAZARDS.map((h) => '<option value="' + esc(h.id) + '"' + (st.hazard === h.id ? " selected" : "") + ">" + esc(h.label) + "</option>").join("") + "</select></label></div></section>";
  }
  function bind(body, rerender) {
    const t = body.querySelector("#lpDisasters"); if (t) t.addEventListener("change", () => { setOn(t.checked); rerender(); });
    const h = body.querySelector("#lpDisastersHazard"); if (h) h.addEventListener("change", () => { setFilter({ hazard: h.value }); rerender(); });
  }

  function wire() {
    load();
    if (GD.globe && GD.globe.st && GD.globe.st.onReady) GD.globe.st.onReady.push(attach);
    if (map() && map().loaded && map().loaded()) attach();
  }

  GD.disastersLayer = { st, KEY, HAZARDS, pins, filter, panelHtml, bind, sync, setOn, setFilter, drill };
  if (typeof module !== "undefined" && module.exports) module.exports = GD.disastersLayer;
  if (global.document) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", wire); else wire(); }
})(typeof window !== "undefined" ? window : globalThis);
