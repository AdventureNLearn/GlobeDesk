/* User-content layers in the Layers panel: "Your layer" (personal pins, this device only, import/export)
   and "Community" (contributor cards, community links and pins; off by default, own pin style and badge).
   Pins are DOM markers above the map; the base-map style, sources and tiles are never changed. window.GD.userLayers */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const KEY = "globedesk.community.v1";
  const PKEY = "globedesk.personal.show.v1";
  const st = { community: false, personal: true, markers: [] };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function get(k, d) { try { const v = global.localStorage.getItem(k); return v == null ? d : v === "1"; } catch (e) { return d; } }
  function put(k, v) { try { global.localStorage.setItem(k, v ? "1" : "0"); } catch (e) { /* ignore */ } }
  st.community = get(KEY, false);
  st.personal = get(PKEY, true);

  function communityDoc() { return (GD.atlasData && GD.atlasData.community) || { cards: [], links: [], pins: [] }; }
  function communityOn() { return st.community; }
  function setCommunity(on) { st.community = !!on; put(KEY, st.community); syncMarkers(); if (GD.atlas && GD.atlas.st && GD.atlas.st.open) GD.atlas.render(); }
  function setPersonal(on) { st.personal = !!on; put(PKEY, st.personal); syncMarkers(); }

  function panelHtml() {
    const layer = GD.personal ? GD.personal.load() : { pins: [], notes: [], followed: [], links: [] };
    const doc = communityDoc();
    return '<section class="lp-group" aria-labelledby="lpMineH"><h3 id="lpMineH">Your layer <span class="muted">(this device only)</span></h3>' +
      '<label class="lp-row' + (st.personal ? " on" : "") + '"><input type="checkbox" role="switch" id="lpPersonal"' + (st.personal ? " checked" : "") + '><span class="lp-legend lp-legend-pin ul-mine-swatch" aria-hidden="true"></span>' +
      '<span class="lp-text"><span class="lp-name">My pins</span><span class="lp-desc">' + layer.pins.length + " pins, " + layer.notes.length + " notes, " + layer.followed.length + " followed, " + layer.links.length + " links. Saved in this browser only; never sent anywhere.</span></span></label>" +
      '<div class="lp-actions"><button type="button" class="mini" id="lpAddPin">Pin map centre</button> <button type="button" class="mini" id="lpExportMine">Export</button> ' +
      '<label class="btn mini">Import<input id="lpImportMine" type="file" accept=".json,application/json" hidden></label></div></section>' +
      '<section class="lp-group" aria-labelledby="lpCommH"><h3 id="lpCommH">Community <span class="cm-badge">Community</span></h3>' +
      '<label class="lp-row' + (st.community ? " on" : "") + '"><input type="checkbox" role="switch" id="lpCommunity"' + (st.community ? " checked" : "") + ' aria-checked="' + st.community + '"><span class="lp-legend lp-legend-pin ul-comm-swatch" aria-hidden="true"></span>' +
      '<span class="lp-text"><span class="lp-name">Community lane</span><span class="lp-desc">Contributor cards, community links and pins, shown apart from official entries and primary sources. Off by default. ' +
      doc.cards.length + " cards, " + doc.links.length + " links, " + doc.pins.length + " pins in this copy.</span></span></label></section>";
  }

  function bind(body, rerender) {
    const p = body.querySelector("#lpPersonal"); if (p) p.addEventListener("change", () => { setPersonal(p.checked); rerender(); });
    const c = body.querySelector("#lpCommunity"); if (c) c.addEventListener("change", () => { setCommunity(c.checked); rerender(); });
    const a = body.querySelector("#lpAddPin"); if (a) a.addEventListener("click", () => {
      const map = GD.globe && GD.globe.st && GD.globe.st.map; if (!map || !GD.personal) return;
      const ctr = map.getCenter();
      const title = global.prompt ? global.prompt("Name this pin (stays on this device):", "My pin") : "My pin";
      if (!title || !title.trim()) return;
      GD.personal.addPin({ title: title.trim(), lat: Math.round(ctr.lat * 1e4) / 1e4, lng: Math.round(ctr.lng * 1e4) / 1e4 });
      syncMarkers(); rerender();
    });
    const x = body.querySelector("#lpExportMine"); if (x) x.addEventListener("click", () => GD.personal && GD.personal.download());
    const i = body.querySelector("#lpImportMine"); if (i) i.addEventListener("change", () => {
      const f = i.files && i.files[0]; if (!f || !GD.personal) return;
      GD.personal.importFile(f).then((r) => {
        if (GD.ui && GD.ui.toast) GD.ui.toast(r.ok ? "Imported your layer" + (r.dropped ? " (" + r.dropped + " items skipped)" : "") : r.error);
        syncMarkers(); rerender();
      });
    });
  }

  function clear() { st.markers.forEach((m) => { try { m.remove(); } catch (e) { /* ignore */ } }); st.markers = []; }
  function marker(map, cls, ll, label, badge) {
    const el = global.document.createElement("div");
    el.className = "ul-pin " + cls;
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", badge + ": " + label);
    el.title = badge + ": " + label;
    const b = global.document.createElement("span"); b.className = "ul-badge"; b.textContent = badge; el.appendChild(b);
    st.markers.push(new global.maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map));
  }
  function syncMarkers() {
    clear();
    const map = GD.globe && GD.globe.st && GD.globe.st.map;
    if (!map || !global.maplibregl) return;
    if (st.personal && GD.personal) GD.personal.load().pins.forEach((p) => marker(map, "ul-mine", [p.lng, p.lat], p.title, "Mine"));
    if (st.community) communityDoc().pins.forEach((p) => marker(map, "ul-comm", [p.lng, p.lat], p.title + " (@" + p.card + ")", "Community"));
  }

  function wire() {
    if (GD.globe && GD.globe.st && GD.globe.st.onReady) GD.globe.st.onReady.push(syncMarkers);
    if (GD.personal && GD.personal.onChange) GD.personal.onChange(syncMarkers);
  }

  GD.userLayers = { st, panelHtml, bind, communityOn, setCommunity, setPersonal, syncMarkers, KEY };
  if (global.document) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", wire); else wire(); }
})(typeof window !== "undefined" ? window : globalThis);
