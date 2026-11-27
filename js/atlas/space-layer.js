/* Space layer (Space race and launch sites): launch sites on Earth as their own pins on the globe. Same
   pattern as the Bells and Disasters layers: DOM markers above the map, screen-grid clusters at low zoom
   (Bells' cluster() is reused), a pin click drills to the place and opens the site in the Atlas. Only the
   overview's own Earth sites are pinned (pinned: true). The Moon landing sites carry lunar coordinates in
   their records, not an Earth pin, and the cross-linked Apollo 11 event keeps its one existing pin, so
   nothing is drawn twice. Every pin is one approximate point (a spaceport covers many square kilometres).
   Off by default. window.GD.spaceLayer */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const KEY = "globedesk.space.v1";
  const OVERVIEW = "data/atlas/space/space-overview.json";
  const st = { on: false, markers: [], wired: false };
  const BL = () => GD.bellsLayer || (typeof require === "function" ? require("./bells-layer.js") : null);

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function load() {
    try {
      const v = JSON.parse(global.localStorage.getItem(KEY) || "null");
      if (v && typeof v === "object") st.on = v.on === true;
    } catch (e) { /* ignore */ }
  }
  function save() { try { global.localStorage.setItem(KEY, JSON.stringify({ on: st.on })); } catch (e) { /* ignore */ } }

  // Pure: one pin per overview member the layer pins itself (Earth launch sites with a lat/lng place).
  function pins(data) {
    if (!data || !data.entries) return [];
    const ov = (data.records || {})[OVERVIEW];
    if (!ov || !Array.isArray(ov.members)) return [];
    const byId = new Map(data.entries.map((e) => [e.id, e]));
    return ov.members.filter((m) => m.pinned === true && !m.linked).map((m) => {
      const e = byId.get(m.id);
      const p = e && (e.places || []).find((q) => typeof q.lat === "number" && typeof q.lng === "number");
      return p ? { id: e.id, title: e.title, lat: p.lat, lng: p.lng, approximate: true } : null;
    }).filter(Boolean);
  }

  function data() { return GD.atlasData || null; }
  function map() { return GD.globe && GD.globe.st && GD.globe.st.map; }
  function visible() { return pins(data()); }
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
        el.className = "sp-cluster";
        el.textContent = String(c.count);
        el.setAttribute("aria-label", c.count + " launch sites here: zoom in");
        el.title = c.pins.map((p) => p.title).join("\n");
        el.addEventListener("click", (ev) => { ev.stopPropagation(); if (GD.globe.flyTo) GD.globe.flyTo({ center: [c.lng, c.lat], zoom: Math.min(bl.CLUSTER_BELOW, Math.floor(z) + 2), durationSec: 1.2 }); });
      } else {
        const p = c.pins[0];
        el.className = "sp-pin";
        el.setAttribute("data-space", p.id);
        const label = p.title + " (approximate pin)";
        el.setAttribute("aria-label", "Launch site: " + label);
        el.title = label;
        const s = global.document.createElement("span"); s.className = "sp-glyph"; s.setAttribute("aria-hidden", "true"); el.appendChild(s);
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
  
  function panelHtml() {
    const all = pins(data());
    if (!all.length) return "";
    return '<section class="lp-group" aria-labelledby="lpSpaceH"><h3 id="lpSpaceH">Space race and launch sites <span class="muted">(Atlas: Science)</span></h3>' +
      '<label class="lp-row' + (st.on ? " on" : "") + '"><input type="checkbox" role="switch" id="lpSpace"' + (st.on ? " checked" : "") + ' aria-checked="' + st.on + '"><span class="lp-legend lp-legend-pin sp-swatch" aria-hidden="true"></span>' +
      '<span class="lp-text"><span class="lp-name">Launch sites</span><span class="lp-desc">' + all.length + " launch sites on Earth. Each pin is one approximate point for a whole spaceport. The Moon landing sites are in the Atlas (they have no Earth pin). Pick a pin to fly there and open it in the Atlas.</span>" +
      '<span class="lp-credit">NASA NSSDCA; IAU Gazetteer; agency pages; Wikidata (CC0) points.</span></span></label></section>';
  }
  function bind(body, rerender) {
    const t = body.querySelector("#lpSpace"); if (t) t.addEventListener("change", () => { setOn(t.checked); rerender(); });
  }

  function wire() {
    load();
    if (GD.globe && GD.globe.st && GD.globe.st.onReady) GD.globe.st.onReady.push(attach);
    if (map() && map().loaded && map().loaded()) attach();
  }

  GD.spaceLayer = { st, KEY, pins, panelHtml, bind, sync, setOn, drill };
  if (typeof module !== "undefined" && module.exports) module.exports = GD.spaceLayer;
  if (global.document) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", wire); else wire(); }
})(typeof window !== "undefined" ? window : globalThis);
