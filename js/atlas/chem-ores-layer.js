/* Ores by country layer: for one chosen element, the countries USGS lists as producing its ore or metal
   (Mineral Commodity Summaries 2026 data release, CC0). Off by default. A pin is a reference point inside
   the country (Natural Earth), never a mine or deposit. Live deposit locations come only from the USGS
   MRDS map service in Official GIS (off by default; shown as unavailable when the host is down or blocked).
   Pins are DOM markers above the map; the base-map style, sources and tiles are never changed.
   window.GD.chemOresLayer */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const KEY = "globedesk.chemOres.v1";
  const REC = "data/atlas/chemistry/element-ores-by-country.json";
  const MRDS_ID = "usgs-mrds";
  const st = { on: false, element: "copper-element", markers: [], wired: false };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function record(data) { return (data && data.records && data.records[REC]) || null; }
  function load() {
    try {
      const v = JSON.parse(global.localStorage.getItem(KEY) || "null");
      if (v && typeof v === "object") { st.on = v.on === true; if (typeof v.element === "string") st.element = v.element; }
    } catch (e) { /* ignore */ }
  }
  function save() { try { global.localStorage.setItem(KEY, JSON.stringify({ on: st.on, element: st.element })); } catch (e) { /* ignore */ } }

  // Pure: element ids with data, in atomic-number order when the Atlas entries are present.
  function elements(data) {
    const rec = record(data);
    if (!rec || !rec.byElement) return [];
    const z = (id) => { const e = (data.entries || []).find((x) => x.id === id); const m = e && /element (\d+)\)$/.exec(e.title || ""); return m ? Number(m[1]) : 999; };
    const title = (id) => { const e = (data.entries || []).find((x) => x.id === id); return e ? e.title : id; };
    return Object.keys(rec.byElement).map((id) => ({ id, z: z(id), title: title(id) })).sort((a, b) => a.z - b.z);
  }
  // Pure: pins for one element. Rows without a country point are skipped; rows without a number keep the
  // USGS symbol as printed and get the smallest size.
  function pins(data, id) {
    const rec = record(data);
    const el = rec && rec.byElement && rec.byElement[id];
    if (!el) return [];
    const max = Math.max(1, ...el.countries.map((c) => (typeof c.n === "number" ? c.n : 0)));
    return el.countries.filter((c) => typeof c.lat === "number" && typeof c.lng === "number").map((c, i) => ({
      id: id + ":" + (c.a3 || c.country), country: c.country, value: c.value, lat: c.lat, lng: c.lng, rank: i + 1,
      size: typeof c.n === "number" ? Math.max(1, Math.min(4, Math.ceil(4 * Math.sqrt(c.n / max)))) : 1,
      unit: el.unit, year: el.year, measure: el.measure }));
  }
  function summary(data, id, n) {
    const rec = record(data);
    const el = rec && rec.byElement && rec.byElement[id];
    if (!el) return null;
    return { commodity: el.commodity, measure: el.measure, unit: el.unit, year: el.year, world_total: el.world_total, top: el.countries.slice(0, n || 5) };
  }
  function mrdsStatus() {
    const rows = GD.gis && GD.gis.editorRows ? GD.gis.editorRows() : [];
    const r = rows.find((x) => x.id === MRDS_ID);
    return r ? r.statusLabel : "[UNKNOWN]";
  }

  function data() { return GD.atlasData || null; }
  function map() { return GD.globe && GD.globe.st && GD.globe.st.map; }
  function clear() { st.markers.forEach((m) => { try { m.remove(); } catch (e) { /* ignore */ } }); st.markers = []; }
  function drill(id) {
    if (!GD.atlas) return;
    if (!GD.atlas.st.open) GD.atlas.open();
    GD.atlas.st.tab = "chemistry";
    GD.atlas.select(id);
  }
  function sync() {
    clear();
    const m = map();
    if (!st.on || !m || !global.maplibregl) return;
    pins(data(), st.element).forEach((p) => {
      const el = global.document.createElement("button");
      el.type = "button";
      el.className = "co-pin co-s" + p.size;
      el.setAttribute("data-chem-ore", p.id);
      const label = p.country + ": " + p.value + " " + p.unit + " (" + p.measure + ", " + p.year + "; USGS MCS 2026). Country point, not a mine.";
      el.setAttribute("aria-label", label);
      el.title = label;
      const s = global.document.createElement("span"); s.className = "co-glyph"; s.setAttribute("aria-hidden", "true"); s.textContent = String(p.rank); el.appendChild(s);
      el.addEventListener("click", (ev) => { ev.stopPropagation(); drill(st.element); });
      st.markers.push(new global.maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m));
    });
  }
  function attach() { sync(); }
  function setOn(on) { st.on = !!on; save(); sync(); }
  function setElement(id) { if (record(data()) && record(data()).byElement[id]) { st.element = id; save(); sync(); } }
  function show(id) { setElement(id); setOn(true); }

  function panelHtml() {
    const list = elements(data());
    if (!list.length) return "";
    if (!list.some((e) => e.id === st.element)) st.element = list[0].id;
    const sm = summary(data(), st.element, 3);
    return '<section class="lp-group" aria-labelledby="lpChemOresH"><h3 id="lpChemOresH">Ores by country <span class="muted">(Atlas: chemistry)</span></h3>' +
      '<label class="lp-row' + (st.on ? " on" : "") + '"><input type="checkbox" role="switch" id="lpChemOres"' + (st.on ? " checked" : "") + ' aria-checked="' + st.on + '"><span class="lp-legend lp-legend-pin co-swatch" aria-hidden="true"></span>' +
      '<span class="lp-text"><span class="lp-name">Producing countries for one element</span><span class="lp-desc">' +
      (sm ? esc(sm.measure) + ", " + esc(sm.year) + " (" + esc(sm.unit) + "). World total " + esc(sm.world_total) + ". " : "") +
      "Pins are country points ranked by USGS figures, not mines. Off by default.</span><span class=\"lp-credit\">USGS Mineral Commodity Summaries 2026 (CC0)</span></span></label>" +
      '<div class="lp-actions co-filters"><label class="small">Element <select id="lpChemOresEl">' +
      list.map((e) => '<option value="' + esc(e.id) + '"' + (st.element === e.id ? " selected" : "") + ">" + esc(e.title) + "</option>").join("") + "</select></label></div>" +
      '<p class="muted small co-mrds">Deposit locations: turn on "USGS Mineral Resources Data System (MRDS)" under Official GIS (live from mrdata.usgs.gov; status: ' + esc(mrdsStatus()) + "). Nothing is cached; when the host is down or blocked it shows as unavailable.</p></section>";
  }
  function bind(body, rerender) {
    const t = body.querySelector("#lpChemOres"); if (t) t.addEventListener("change", () => { setOn(t.checked); rerender(); });
    const s = body.querySelector("#lpChemOresEl"); if (s) s.addEventListener("change", () => { setElement(s.value); rerender(); });
  }
  function wire() {
    load();
    if (GD.globe && GD.globe.st && GD.globe.st.onReady) GD.globe.st.onReady.push(attach);
    if (map() && map().loaded && map().loaded()) attach();
  }

  GD.chemOresLayer = { st, KEY, REC, MRDS_ID, elements, pins, summary, panelHtml, bind, sync, setOn, setElement, show, drill };
  if (typeof module !== "undefined" && module.exports) module.exports = GD.chemOresLayer;
  if (global.document) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", wire); else wire(); }
})(typeof window !== "undefined" ? window : globalThis);
