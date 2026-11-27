/* Layers panel: one toolbar button that lists every base map and overlay with a toggle,
   a short plain description and a legend swatch. Show all / Hide all. First-run hint.
   Uses GD.globe.setBase / setOverlay and GD.gis, so behaviour matches the Inspector Layers tab.
   window.GD.layersPanel */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const HINT_KEY = "globedesk.hint.layers.v1";

  // Plain descriptions and legend swatches. Credits and terms still come from GD.layers.
  const BASE_INFO = {
    "sat-hybrid": { desc: "Satellite photo of the whole Earth, with streets, labels and 3D buildings when you zoom into a city. Needs internet.", legend: { kind: "fill", color: "linear-gradient(135deg,#2f5d3a,#1d4f7a 60%,#c9b27c)" } },
    offline: { desc: "Simple dark globe with coastlines and country shapes. Works with no internet.", legend: { kind: "fill", color: "#13263d", edge: "#62b6ff" } },
    "ofm-dark": { desc: "Dark street map with roads and place names. Needs internet.", legend: { kind: "fill", color: "#1b1f27", edge: "#59606b" } },
    "ofm-liberty": { desc: "Light, colourful street map. Needs internet.", legend: { kind: "fill", color: "#f2efe9", edge: "#c8b88a" } },
    "ofm-positron": { desc: "Pale paper-style street map. Needs internet.", legend: { kind: "fill", color: "#f5f5f3", edge: "#d6d6d6" } },
    "maptiler-sat": { desc: "Paid satellite map. Only works with your own MapTiler key (Menu, Optional paid).", legend: { kind: "fill", color: "linear-gradient(135deg,#355c2f,#24507a)" } }
  };
  const OVERLAY_INFO = {
    countries: { desc: "Thin white borders between countries.", legend: { kind: "line", color: "#ffffff" } },
    highlight: { desc: "Glows the focus country or area of the story you are on.", legend: { kind: "glow", color: "#5ee7ff" } },
    countryLabels: { desc: "Country names on the globe. Shows on the satellite and street maps (they carry the font).", legend: { kind: "text", color: "#ffffff" } },
    towns: { desc: "Small dots for towns from the bundled list. Appear from zoom 3; names show near the story pin.", legend: { kind: "dot", color: "#9cc9ff" } },
    pins: { desc: "A red pin for every story with a place. The current story's pin is larger.", legend: { kind: "pin", color: "#ff3b5c" } },
    arcs: { desc: "Lines that join the stories in order.", legend: { kind: "line", color: "#5ee6ff" } },
    rings: { desc: "10, 50 and 100 km circles around the current story's pin.", legend: { kind: "dash", color: "#ffd166" } },
    buildings: { desc: "3D buildings when you zoom into a city. Satellite and street maps only.", legend: { kind: "fill", color: "#3c4e6a" } },
    terrain: { desc: "3D hills and shading from zoom 11. Off by default; downloads open elevation tiles.", legend: { kind: "fill", color: "linear-gradient(135deg,#222,#777)" } },
    bluemarble: { desc: "NASA Blue Marble colour globe (public domain). Fades out as you zoom past street level. Uses your local pack if you have one.", legend: { kind: "fill", color: "linear-gradient(135deg,#0f3d6e,#2f6b3a 55%,#c2a46c)" } },
    "eox-region": { desc: "Sharp 2016 satellite photo of downtown Washington, DC only (for the sample). Uses the offline pack if present.", legend: { kind: "fill", color: "linear-gradient(135deg,#556b4a,#8a8f7a)" } },
    ohm: { desc: "Historical maps. Not available yet.", legend: { kind: "none" } }
  };
  // Show all turns these on. eox-region and bluemarble cannot stack, so Show all picks the global one.
  const SHOW_ALL_SKIP = { "eox-region": true, ohm: true };

  function info(map, id) { return map[id] || { desc: "", legend: { kind: "none" } }; }

  // Pure: rows for the panel from the layer registry and current state.
  function model(layers, st, gisRows) {
    const bases = (layers.BASES || []).map((b) => ({
      id: b.id, label: b.label, on: st.baseId === b.id, paid: !b.free, desc: info(BASE_INFO, b.id).desc, legend: info(BASE_INFO, b.id).legend, credit: b.credit || ""
    }));
    const overlays = (layers.OVERLAYS || []).map((o) => ({
      id: o.id, label: o.label, on: !!(st.overlays || {})[o.id], disabled: o.status === "unknown",
      desc: info(OVERLAY_INFO, o.id).desc, legend: info(OVERLAY_INFO, o.id).legend, credit: o.status === "unknown" ? (o.reason || "") : (o.credit || "")
    }));
    const gis = (gisRows || []).map((r) => ({ id: r.id, label: r.label, on: !!r.on, disabled: !!r.disabled, status: r.statusLabel || "", credit: r.credit || "" }));
    return { bases, overlays, gis };
  }

  // Pure: the overlay map after Show all / Hide all. Show all keeps the chosen base map:
  // on the EOX satellite base, Blue Marble stays off (it would switch the base to the offline globe).
  function showAllPlan(layers, overlays, baseId) {
    const out = Object.assign({}, overlays || {});
    const eoxBase = baseId === "sat-hybrid";
    (layers.OVERLAYS || []).forEach((o) => {
      if (o.status === "unknown") { out[o.id] = false; return; }
      if (SHOW_ALL_SKIP[o.id]) { out[o.id] = false; return; }
      if (o.id === "bluemarble" && eoxBase) { out[o.id] = false; return; }
      out[o.id] = true;
    });
    return out;
  }
  function hideAllPlan(layers, overlays) {
    const out = Object.assign({}, overlays || {});
    (layers.OVERLAYS || []).forEach((o) => { out[o.id] = false; });
    return out;
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  // Registry credits carry simple links. Rebuild them: keep only <a href="https://...">text</a>,
  // escape every other character, so no other markup or scheme can reach innerHTML.
  function creditHtml(s) {
    const src = String(s == null ? "" : s);
    const re = /<a\s[^>]*?href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
    let out = "", last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      const href = m[1].replace(/&amp;/g, "&");
      const label = m[2].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      out += /^https:\/\/[^\s"'<>@]+$/i.test(href)
        ? '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + "</a>"
        : esc(label);
      last = re.lastIndex;
    }
    return out + esc(src.slice(last));
  }

  // No inline style attributes (the page CSP forbids them); colours are applied with CSSOM after render.
  function legendHtml(l) {
    if (!l || l.kind === "none") return '<span class="lp-legend lp-legend-none" aria-hidden="true"></span>';
    const kind = /^(fill|line|dash|glow|dot|pin|text)$/.test(l.kind) ? l.kind : "fill";
    return '<span class="lp-legend lp-legend-' + kind + '" aria-hidden="true" data-lp-color="' + esc(l.color || "#fff") + '"' +
      (l.edge ? ' data-lp-edge="' + esc(l.edge) + '"' : "") + '>' + (kind === "text" ? "Aa" : "") + "</span>";
  }

  function paintLegends(root) {
    root.querySelectorAll("[data-lp-color]").forEach((el) => {
      const c = el.getAttribute("data-lp-color");
      if (el.classList.contains("lp-legend-fill")) {
        el.style.background = c;
        const e = el.getAttribute("data-lp-edge");
        if (e) el.style.boxShadow = "inset 0 0 0 1px " + e;
      } else el.style.setProperty("--c", c);
    });
  }

  const doc = () => global.document;
  const $ = (id) => doc() && doc().getElementById(id);

  function render() {
    const body = $("layersPanelBody");
    if (!body || !GD.layers || !GD.globe) return;
    const gisRows = GD.gis && GD.gis.editorRows ? GD.gis.editorRows() : [];
    const m = model(GD.layers, GD.globe.st, gisRows);
    const live = !!(GD.layers.isLiveImagery && GD.layers.isLiveImagery());
    const gisLive = !!(GD.gis && GD.gis.isLiveEnabled && GD.gis.isLiveEnabled());
    const onCount = m.overlays.filter((o) => o.on).length;
    body.innerHTML =
      '<p class="lp-summary muted small" id="layersSummary">' + onCount + " of " + m.overlays.filter((o) => !o.disabled).length + " overlays on · base: " + esc((m.bases.find((b) => b.on) || {}).label || "") + "</p>" +
      '<section class="lp-group" aria-labelledby="lpBaseH"><h3 id="lpBaseH">Base map <span class="muted">(pick one)</span></h3>' +
      m.bases.map((b) => '<label class="lp-row' + (b.on ? " on" : "") + '">' +
        '<input type="radio" name="lpBase" value="' + esc(b.id) + '"' + (b.on ? " checked" : "") + '>' + legendHtml(b.legend) +
        '<span class="lp-text"><span class="lp-name">' + esc(b.label) + (b.paid ? ' <span class="pill warn">optional paid</span>' : "") + '</span>' +
        '<span class="lp-desc">' + esc(b.desc) + '</span><span class="lp-credit">' + creditHtml(b.credit) + "</span></span></label>").join("") +
      "</section>" +
      '<section class="lp-group" aria-labelledby="lpOvH"><h3 id="lpOvH">Overlays <span class="muted">(stack as many as you like)</span></h3>' +
      m.overlays.map((o) => '<label class="lp-row' + (o.on ? " on" : "") + (o.disabled ? " disabled" : "") + '">' +
        '<input type="checkbox" role="switch" data-lp-ov="' + esc(o.id) + '"' + (o.on ? " checked" : "") + (o.disabled ? " disabled" : "") + ' aria-checked="' + (o.on ? "true" : "false") + '">' + legendHtml(o.legend) +
        '<span class="lp-text"><span class="lp-name">' + esc(o.label) + '</span><span class="lp-desc">' + esc(o.desc) + '</span><span class="lp-credit">' + creditHtml(o.credit) + "</span></span></label>").join("") +
      "</section>" +
      '<section class="lp-group" aria-labelledby="lpDatedH"><h3 id="lpDatedH">Dated imagery</h3>' +
      '<label class="lp-row' + (live ? " on" : "") + '"><input type="checkbox" role="switch" id="lpLiveImagery"' + (live ? " checked" : "") + '>' + legendHtml({ kind: "fill", color: "linear-gradient(135deg,#6ee7a8,#f5c14a)" }) +
      '<span class="lp-text"><span class="lp-name">Imagery for the data year (NASA GIBS)</span><span class="lp-desc">Satellite pictures from the year on the Data year slider in the Playback bar. Off by default; needs internet.</span></span></label>' +
      "</section>" +
      (GD.gis ? '<section class="lp-group" aria-labelledby="lpGisH"><h3 id="lpGisH">Official GIS <span class="muted">(US government maps)</span></h3>' +
        '<label class="lp-row' + (gisLive ? " on" : "") + '"><input type="checkbox" role="switch" id="lpGisLive"' + (gisLive ? " checked" : "") + '>' + legendHtml({ kind: "fill", color: "linear-gradient(135deg,#3b6ea5,#9cc9ff)" }) +
        '<span class="lp-text"><span class="lp-name">Allow official live GIS on this device</span><span class="lp-desc">Turn this on first; then pick any official layer below. Off by default.</span></span></label>' +
        m.gis.map((g) => '<label class="lp-row lp-sub' + (g.on ? " on" : "") + (g.disabled || !gisLive ? " disabled" : "") + '"><input type="checkbox" role="switch" data-lp-gis="' + esc(g.id) + '"' + (g.on ? " checked" : "") + (g.disabled || !gisLive ? " disabled" : "") + '>' +
          '<span class="lp-text"><span class="lp-name">' + esc(g.label) + ' <span class="gis-status">' + esc(g.status) + '</span></span><span class="lp-credit">' + esc(g.credit) + "</span></span></label>").join("") +
        "</section>" : "") +
      (GD.bellsLayer && GD.bellsLayer.panelHtml ? GD.bellsLayer.panelHtml() : "") +
      (GD.chemSitesLayer && GD.chemSitesLayer.panelHtml ? GD.chemSitesLayer.panelHtml() : "") +
      (GD.chemOresLayer && GD.chemOresLayer.panelHtml ? GD.chemOresLayer.panelHtml() : "") +
      (GD.userLayers && GD.userLayers.panelHtml ? GD.userLayers.panelHtml() : "") +
      '<p class="muted small lp-foot">More settings (display quality, tile cache, licence notes) are in Workspace, Inspector, Layers.</p>';
    paintLegends(body);
    bindBody(body);
    if (GD.bellsLayer && GD.bellsLayer.bind) GD.bellsLayer.bind(body, () => { render(); refreshOthers(); });
    if (GD.chemSitesLayer && GD.chemSitesLayer.bind) GD.chemSitesLayer.bind(body, () => { render(); refreshOthers(); });
    if (GD.chemOresLayer && GD.chemOresLayer.bind) GD.chemOresLayer.bind(body, () => { render(); refreshOthers(); });
    if (GD.userLayers && GD.userLayers.bind) GD.userLayers.bind(body, () => { render(); refreshOthers(); });
  }

  function refreshOthers() {
    if (GD.ui && GD.ui.renderOverlays) GD.ui.renderOverlays();
    if (GD.state && GD.state.tab === "layers" && GD.ui && GD.ui.renderInspector) GD.ui.renderInspector();
  }

  function bindBody(body) {
    body.querySelectorAll('input[name="lpBase"]').forEach((el) => el.addEventListener("change", () => {
      GD.globe.setBase(el.value); render(); refreshOthers();
    }));
    body.querySelectorAll("[data-lp-ov]").forEach((el) => el.addEventListener("change", () => {
      GD.globe.setOverlay(el.dataset.lpOv, el.checked); render(); refreshOthers();
    }));
    const live = body.querySelector("#lpLiveImagery");
    if (live) live.addEventListener("change", () => {
      if (GD.layers.setLiveImagery) GD.layers.setLiveImagery(live.checked);
      if (GD.globe.applyDatedSat) GD.globe.applyDatedSat();
      if (GD.ui && GD.ui.syncDataYearUi) GD.ui.syncDataYearUi();
      render(); refreshOthers();
    });
    const gl = body.querySelector("#lpGisLive");
    if (gl) gl.addEventListener("change", () => { if (GD.gis.setLiveEnabled) GD.gis.setLiveEnabled(gl.checked); render(); refreshOthers(); });
    body.querySelectorAll("[data-lp-gis]").forEach((el) => el.addEventListener("change", () => {
      const out = GD.gis.setOverlay ? GD.gis.setOverlay({ id: el.dataset.lpGis, on: el.checked }) : null;
      if (out && out.ok === false && GD.ui && GD.ui.toast) GD.ui.toast(out.error || "Overlay skipped");
      render(); refreshOthers();
    }));
  }

  function applyPlan(plan) {
    const cur = GD.globe.st.overlays || {};
    // Turn off first, then on, so the stacking policy sees the final wish.
    Object.keys(plan).filter((id) => !plan[id] && cur[id]).forEach((id) => GD.globe.setOverlay(id, false));
    Object.keys(plan).filter((id) => plan[id] && !GD.globe.st.overlays[id]).forEach((id) => GD.globe.setOverlay(id, true));
  }

  function showAll() {
    const onSat = GD.globe.st.baseId === "sat-hybrid";
    applyPlan(showAllPlan(GD.layers, GD.globe.st.overlays, GD.globe.st.baseId));
    if (GD.gis && GD.gis.isLiveEnabled && GD.gis.isLiveEnabled() && GD.gis.editorRows && GD.gis.setOverlay) {
      GD.gis.editorRows().filter((r) => !r.disabled && !r.on).forEach((r) => GD.gis.setOverlay({ id: r.id, on: true }));
    }
    render(); refreshOthers();
    if (GD.ui && GD.ui.toast) GD.ui.toast(onSat
      ? "All overlays that fit the satellite base are on. Blue Marble and the DC region pack need the Offline globe base (pick it above). Official GIS needs its opt-in first."
      : "All overlays are on. The DC region pack stays off because it can't stack with Blue Marble. Official GIS needs its opt-in first.");
  }
  function hideAll() {
    applyPlan(hideAllPlan(GD.layers, GD.globe.st.overlays));
    if (GD.gis && GD.gis.editorRows && GD.gis.setOverlay) GD.gis.editorRows().filter((r) => r.on).forEach((r) => GD.gis.setOverlay({ id: r.id, on: false }));
    render(); refreshOthers();
  }

  function isOpen() { const d = $("layersPanel"); return !!(d && d.open); }
  function open() {
    const d = $("layersPanel"); if (!d) return;
    dismissHint();
    render();
    if (!d.open) { try { d.show(); } catch (e) { d.setAttribute("open", ""); } }
    const b = $("btnLayers"); if (b) b.setAttribute("aria-expanded", "true");
    const first = d.querySelector("#layersShowAll"); if (first) first.focus();
  }
  function close() {
    const d = $("layersPanel"); if (!d) return;
    if (d.open) { try { d.close(); } catch (e) { d.removeAttribute("open"); } }
    const b = $("btnLayers"); if (b) { b.setAttribute("aria-expanded", "false"); }
  }
  function toggle() { if (isOpen()) close(); else open(); }

  function hintSeen() { try { return global.localStorage && global.localStorage.getItem(HINT_KEY) === "1"; } catch (e) { return true; } }
  function dismissHint() {
    try { if (global.localStorage) global.localStorage.setItem(HINT_KEY, "1"); } catch (e) { /* ignore */ }
    const h = $("layersHint"); if (h) h.hidden = true;
  }
  function maybeShowHint() {
    const h = $("layersHint"); if (!h) return false;
    if (hintSeen()) { h.hidden = true; return false; }
    h.hidden = false;
    return true;
  }

  function wire() {
    const b = $("btnLayers");
    if (b) b.addEventListener("click", toggle);
    const c = $("layersClose"); if (c) c.addEventListener("click", close);
    const sa = $("layersShowAll"); if (sa) sa.addEventListener("click", showAll);
    const ha = $("layersHideAll"); if (ha) ha.addEventListener("click", hideAll);
    const d = $("layersPanel");
    if (d) d.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); if (b) b.focus(); } });
    const hb = $("layersHintOk"); if (hb) hb.addEventListener("click", dismissHint);
    const ho = $("layersHintOpen"); if (ho) ho.addEventListener("click", open);
    maybeShowHint();
  }

  GD.layersPanel = { model, showAllPlan, hideAllPlan, render, open, close, toggle, isOpen, showAll, hideAll, maybeShowHint, dismissHint, HINT_KEY, creditHtml, BASE_INFO, OVERLAY_INFO };
  if (doc() && doc().getElementById) {
    if (doc().readyState === "loading") doc().addEventListener("DOMContentLoaded", wire); else wire();
  }
})(typeof window !== "undefined" ? window : globalThis);
