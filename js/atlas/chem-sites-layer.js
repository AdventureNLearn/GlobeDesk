/* Element places layer: discovery sites, discovering laboratories and namesake places for the chemical
   elements, from Wikidata (CC0). Off by default; the user turns it on in the Layers panel.
   Pins are DOM markers above the map; the base-map style, sources and tiles are never changed.
   Each pin is the place's own Wikidata coordinate. Scale says how exact it is: site (lab, mine, building),
   city (a town's reference point) or area (a country or region's reference point; dashed).
   People are never pinned. window.GD.chemSitesLayer */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const KEY = "globedesk.chemSites.v1";
  const REC = "data/atlas/chemistry/element-sites.json";
  const RELS = [
    { id: "namesake", label: "Named after the place" },
    { id: "discovery-location", label: "Discovery location" },
    { id: "discoverer", label: "Discovering lab or institution" }];
  const SCALES = [{ id: "site", label: "Site (lab, mine, building)" }, { id: "city", label: "City or town" }, { id: "area", label: "Country or region (dashed)" }];
  const CELL_PX = 56;
  const CLUSTER_BELOW = 6;
  const st = { on: false, rel: "all", scale: "all", markers: [], wired: false, openId: null };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function load() {
    try {
      const v = JSON.parse(global.localStorage.getItem(KEY) || "null");
      if (v && typeof v === "object") {
        st.on = v.on === true;
        st.rel = RELS.some((r) => r.id === v.rel) ? v.rel : "all";
        st.scale = SCALES.some((r) => r.id === v.scale) ? v.scale : "all";
      }
    } catch (e) { /* ignore */ }
  }
  function save() { try { global.localStorage.setItem(KEY, JSON.stringify({ on: st.on, rel: st.rel, scale: st.scale })); } catch (e) { /* ignore */ } }

  // Pure: pins from the bundled record. Drops anything without a numeric coordinate.
  function pins(data) {
    const rec = data && data.records && data.records[REC];
    if (!rec || !Array.isArray(rec.places)) return [];
    return rec.places.filter((p) => typeof p.lat === "number" && typeof p.lng === "number" && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && Array.isArray(p.links) && p.links.length)
      .map((p) => ({ id: p.id, qid: p.qid, title: p.label, lat: p.lat, lng: p.lng, scale: p.scale, url: p.url, links: p.links }));
  }
  function filter(list, f) {
    f = f || {};
    return list.map((p) => {
      if (f.scale && f.scale !== "all" && p.scale !== f.scale) return null;
      const links = (!f.rel || f.rel === "all") ? p.links : p.links.filter((l) => l.rel === f.rel);
      return links.length ? Object.assign({}, p, { links }) : null;
    }).filter(Boolean);
  }
  function project(lng, lat, zoom) {
    const size = 512 * Math.pow(2, zoom);
    const s = Math.sin(Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180);
    return { x: (lng + 180) / 360 * size, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size };
  }
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
  function relLabel(id) { const r = RELS.find((x) => x.id === id); return r ? r.label : id; }
  function scaleNote(s) { return s === "area" ? "country or region reference point, not a site" : s === "city" ? "town or city reference point" : "site"; }

  function data() { return GD.atlasData || null; }
  function map() { return GD.globe && GD.globe.st && GD.globe.st.map; }
  function visible() { return filter(pins(data()), { rel: st.rel, scale: st.scale }); }
  function clear() { st.markers.forEach((m) => { try { m.remove(); } catch (e) { /* ignore */ } }); st.markers = []; }

  function drill(id) {
    if (!GD.atlas) return;
    if (!GD.atlas.st.open) GD.atlas.open();
    GD.atlas.st.tab = "chemistry";
    GD.atlas.select(id);
  }
  // A small list on the pin: place, scale, Wikidata link, and one button per element. No inline styles.
  function popover(p) {
    const box = global.document.createElement("div");
    box.className = "cs-pop";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", p.title);
    const h = global.document.createElement("p"); h.className = "cs-pop-title"; h.textContent = p.title; box.appendChild(h);
    const m = global.document.createElement("p"); m.className = "cs-pop-meta"; m.textContent = "Pin: " + scaleNote(p.scale) + ". Coordinate: Wikidata " + p.qid + " (CC0)."; box.appendChild(m);
    const ul = global.document.createElement("ul");
    p.links.forEach((l) => {
      const li = global.document.createElement("li");
      const b = global.document.createElement("button");
      b.type = "button"; b.className = "cs-pop-el";
      b.textContent = l.symbol + " (Z=" + l.z + ") — " + relLabel(l.rel);
      b.addEventListener("click", (ev) => { ev.stopPropagation(); drill(l.id); });
      li.appendChild(b); ul.appendChild(li);
    });
    box.appendChild(ul);
    return box;
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
        el.className = "cs-cluster";
        el.textContent = String(c.count);
        el.setAttribute("aria-label", c.count + " element places here: zoom in");
        el.title = c.pins.map((p) => p.title).join("\n");
        el.addEventListener("click", (ev) => { ev.stopPropagation(); if (GD.globe.flyTo) GD.globe.flyTo({ center: [c.lng, c.lat], zoom: Math.min(CLUSTER_BELOW, Math.floor(z) + 2), durationSec: 1.2 }); });
      } else {
        const p = c.pins[0];
        el.className = "cs-pin cs-" + p.scale;
        el.setAttribute("data-chem-site", p.id);
        const syms = p.links.map((l) => l.symbol).filter((v, i, a) => a.indexOf(v) === i).join(", ");
        const label = p.title + ": " + syms + " (" + scaleNote(p.scale) + ")";
        el.setAttribute("aria-label", "Element place: " + label);
        el.setAttribute("aria-expanded", String(st.openId === p.id));
        el.title = label;
        const s = global.document.createElement("span"); s.className = "cs-glyph"; s.setAttribute("aria-hidden", "true"); s.textContent = p.links[0].symbol; el.appendChild(s);
        el.addEventListener("click", (ev) => { ev.stopPropagation(); st.openId = st.openId === p.id ? null : p.id; sync(); });
        if (st.openId === p.id) {
          const wrap = global.document.createElement("div"); wrap.className = "cs-wrap";
          wrap.appendChild(el); wrap.appendChild(popover(p));
          st.markers.push(new global.maplibregl.Marker({ element: wrap, anchor: "top-left" }).setLngLat([c.lng, c.lat]).addTo(m));
          return;
        }
      }
      st.markers.push(new global.maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(m));
    });
  }
  function attach() {
    const m = map();
    if (m && !st.wired && typeof m.on === "function") { st.wired = true; m.on("zoomend", sync); }
    sync();
  }
  function setOn(on) { st.on = !!on; if (!st.on) st.openId = null; save(); sync(); }
  function setFilter(f) { if (f.rel !== undefined) st.rel = f.rel; if (f.scale !== undefined) st.scale = f.scale; st.openId = null; save(); sync(); }

  function panelHtml() {
    const all = pins(data());
    if (!all.length) return "";
    const shown = filter(all, { rel: st.rel, scale: st.scale });
    const by = (k) => shown.filter((p) => p.scale === k).length;
    const parts = [[by("site"), "exact sites"], [by("city"), "towns or cities"], [by("area"), "country or region points (dashed)"]].filter((x) => x[0]).map((x) => x[0] + " " + x[1]);
    return '<section class="lp-group" aria-labelledby="lpChemSitesH"><h3 id="lpChemSitesH">Element places <span class="muted">(Atlas: chemistry)</span></h3>' +
      '<label class="lp-row' + (st.on ? " on" : "") + '"><input type="checkbox" role="switch" id="lpChemSites"' + (st.on ? " checked" : "") + ' aria-checked="' + st.on + '"><span class="lp-legend lp-legend-pin cs-swatch" aria-hidden="true"></span>' +
      '<span class="lp-text"><span class="lp-name">Discovery sites and namesake places</span><span class="lp-desc">' + shown.length + " of " + all.length + " places, no people" + (parts.length ? ": " + parts.join(", ") : "") + ". Off by default. Pick a pin to list its elements.</span>" +
      '<span class="lp-credit">Wikidata (CC0)</span></span></label>' +
      '<div class="lp-actions cs-filters"><label class="small">Link <select id="lpChemSitesRel"><option value="all">All links</option>' +
      RELS.map((r) => '<option value="' + esc(r.id) + '"' + (st.rel === r.id ? " selected" : "") + ">" + esc(r.label) + "</option>").join("") + "</select></label> " +
      '<label class="small">Scale <select id="lpChemSitesScale"><option value="all">All scales</option>' +
      SCALES.map((r) => '<option value="' + esc(r.id) + '"' + (st.scale === r.id ? " selected" : "") + ">" + esc(r.label) + "</option>").join("") + "</select></label></div></section>";
  }
  function bind(body, rerender) {
    const t = body.querySelector("#lpChemSites"); if (t) t.addEventListener("change", () => { setOn(t.checked); rerender(); });
    const r = body.querySelector("#lpChemSitesRel"); if (r) r.addEventListener("change", () => { setFilter({ rel: r.value }); rerender(); });
    const s = body.querySelector("#lpChemSitesScale"); if (s) s.addEventListener("change", () => { setFilter({ scale: s.value }); rerender(); });
  }
  function wire() {
    load();
    if (GD.globe && GD.globe.st && GD.globe.st.onReady) GD.globe.st.onReady.push(attach);
    if (map() && map().loaded && map().loaded()) attach();
  }

  GD.chemSitesLayer = { st, KEY, REC, RELS, SCALES, CLUSTER_BELOW, pins, filter, cluster, panelHtml, bind, sync, setOn, setFilter, drill };
  if (typeof module !== "undefined" && module.exports) module.exports = GD.chemSitesLayer;
  if (global.document) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", wire); else wire(); }
})(typeof window !== "undefined" ? window : globalThis);
