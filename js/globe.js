/* Globe: MapLibre globe projection, base styles, overlays, camera keyframes, spatial insight. window.GD.globe */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const R_KM = 6371.0088;
  const TERRAIN_MIN_ZOOM = 11;
  const st = { map: null, baseId: "offline", overlays: {}, onReady: [], terrainOn: false, episode: null, active: -1, labelMarkers: [], status: "init" };

  function offlineStyle() {
    return {
      version: 8,
      name: "GlobeDesk offline",
      sources: {
        land: { type: "geojson", data: window.GD_LAND || { type: "FeatureCollection", features: [] }, attribution: "Made with Natural Earth" }
      },
      layers: [
        { id: "background", type: "background", paint: { "background-color": "#04101f" } },
        { id: "land", type: "fill", source: "land", paint: { "fill-color": "#13263d", "fill-opacity": 1 } },
        { id: "land-edge", type: "line", source: "land", paint: { "line-color": "#2f5b84", "line-width": 0.8 } }
      ]
    };
  }

  // Free hybrid: EOX satellite at low zoom, OpenFreeMap vector streets / labels / (buildings via overlay) fading in at high zoom.
  // No API key. Attribution is on the sources so MapLibre shows it. Terms: OpenFreeMap ToS (free, as-is, no SLA); OSM ODbL; OpenMapTiles CC-BY; EOX CC BY 4.0.
  function hybridStyle(b) {
    const nameField = ["coalesce", ["get", "name:en"], ["get", "name"]];
    const fadeIn = (z0, z1) => ["interpolate", ["linear"], ["zoom"], z0, 0, z1, 1];
    return {
      version: 8,
      name: "GlobeDesk satellite hybrid",
      glyphs: b.glyphs,
      sources: {
        sat: { type: "raster", tiles: [b.satTiles], tileSize: 256, maxzoom: b.satMaxzoom, attribution: b.satCredit || b.credit },
        openmaptiles: { type: "vector", url: b.vector, attribution: b.vectorCredit || "" }
      },
      layers: [
        { id: "background", type: "background", paint: { "background-color": "#0b0c0e" } },
        { id: "sat", type: "raster", source: "sat",
          paint: { "raster-saturation": -0.12, "raster-contrast": 0.08,
            "raster-opacity": ["interpolate", ["linear"], ["zoom"], 12, 1, 15, 0.88, 17, 0.55] } },
        { id: "road-casing", type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom: 12,
          filter: ["!", ["in", ["get", "class"], ["literal", ["pier", "ferry"]]]],
          paint: { "line-color": "#1a1c20", "line-opacity": fadeIn(12, 14.5),
            "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.2, 18, 8] } },
        { id: "roads", type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom: 11,
          filter: ["!", ["in", ["get", "class"], ["literal", ["pier", "ferry"]]]],
          paint: { "line-color": "#f3f1ea",
            "line-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0.12, 13, 0.45, 16, 0.95],
            "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 11, 0.4, 14, 1.4, 18, 6] } },
        { id: "road-labels", type: "symbol", source: "openmaptiles", "source-layer": "transportation_name", minzoom: 14,
          layout: { "text-field": nameField, "text-font": ["Noto Sans Regular"],
            "symbol-placement": "line", "text-size": ["interpolate", ["linear"], ["zoom"], 14, 9, 17, 13],
            "text-max-angle": 32, "text-padding": 2, "text-keep-upright": true },
          paint: { "text-color": "#f7f7f7", "text-halo-color": "rgba(0,0,0,0.75)", "text-halo-width": 1.2,
            "text-opacity": fadeIn(14, 15.2) } },
        { id: "place-labels", type: "symbol", source: "openmaptiles", "source-layer": "place", minzoom: 5,
          filter: ["in", ["get", "class"], ["literal", ["city", "town", "village", "suburb", "neighbourhood", "hamlet"]]],
          layout: { "text-field": nameField, "text-font": ["Noto Sans Regular"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11, 10, 13, 16, 16],
            "text-padding": 4, "text-optional": true },
          paint: { "text-color": "#ffffff", "text-halo-color": "rgba(0,0,0,0.7)", "text-halo-width": 1.2 } }
      ]
    };
  }

  function isLand(lat, lon) {
    return !!(GD.model && GD.model.pointInLand(lat, lon, window.GD_LAND));
  }

  // Street-level camera for a story: look target if set, else the pin. Only when that point is on land.
  function streetView(story) {
    const t = GD.model.lookTarget(story && story.location);
    if (!t) return null;
    if (window.GD_LAND && !isLand(t.lat, t.lon)) return null;
    const p = GD.model.PRESETS.street;
    return { center: [t.lon, t.lat], zoom: p.zoom, pitch: p.pitch, bearing: (p.bearingOffset + 360) % 360, durationSec: p.durationSec, ease: "cinematic", preset: "street" };
  }

  function countryLabelPoints() {
    const w = (window.GD_REGIONS || {}).world;
    const out = [];
    (w && w.countries ? w.countries : []).forEach((c) => {
      // Label at the bbox center of the largest outer ring (approximate, display only).
      let best = null, bestA = -1;
      (c.polys || []).forEach((poly) => {
        const ring = poly[0] || [];
        let a = 0;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
        a = Math.abs(a);
        if (a > bestA) { bestA = a; best = ring; }
      });
      if (!best || !best.length) return;
      const xs = best.map((p) => p[0]), ys = best.map((p) => p[1]);
      out.push({ type: "Feature", properties: { name: c.name, a3: c.a3, area: bestA }, geometry: { type: "Point", coordinates: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] } });
    });
    return { type: "FeatureCollection", features: out };
  }

  // Focus-region glow: an ISO A3 country from the bundled outlines, or a custom GeoJSON polygon.
  function highlightGeoJSON() {
    const ep = st.episode, s = ep && st.active >= 0 ? ep.stories[st.active] : null;
    const h = s && s.highlight;
    if (!h) return { type: "FeatureCollection", features: [] };
    if (h.geojson && h.geojson.type) return h.geojson.type === "FeatureCollection" ? h.geojson : { type: "FeatureCollection", features: [h.geojson.type === "Feature" ? h.geojson : { type: "Feature", properties: {}, geometry: h.geojson }] };
    if (!h.a3) return { type: "FeatureCollection", features: [] };
    return { type: "FeatureCollection", features: countriesGeoJSON().features.filter((f) => f.properties.a3 === h.a3) };
  }
  function countryList() {
    const w = (window.GD_REGIONS || {}).world;
    return (w && w.countries ? w.countries : []).map((c) => ({ a3: c.a3, name: c.name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  function countriesGeoJSON() {
    const w = (window.GD_REGIONS || {}).world;
    const features = (w && w.countries ? w.countries : []).map((c) => ({
      type: "Feature", properties: { name: c.name, a3: c.a3 }, geometry: { type: "MultiPolygon", coordinates: c.polys }
    }));
    return { type: "FeatureCollection", features };
  }

  let townsCache = null;
  function towns() {
    if (townsCache) return townsCache;
    const t = (window.GD_REGIONS || {})["towns-index"];
    townsCache = t && t.towns ? t.towns.map((r) => ({ name: r[0], a3: r[1], adm1: r[2], lat: r[3], lon: r[4], kind: r[5], pop: r[6] })) : [];
    return townsCache;
  }
  function townsGeoJSON() {
    return { type: "FeatureCollection", features: towns().map((t) => ({ type: "Feature", properties: { name: t.name, pop: t.pop || 0 }, geometry: { type: "Point", coordinates: [t.lon, t.lat] } })) };
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
    return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  function bearingTo(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r);
    const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
    return (Math.atan2(y, x) / r + 360) % 360;
  }
  function destination(lat, lon, km, brg) {
    const r = Math.PI / 180, d = km / R_KM, b = brg * r, p1 = lat * r, l1 = lon * r;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return [((l2 / r + 540) % 360) - 180, p2 / r];
  }
  function ring(lat, lon, km) {
    const pts = [];
    for (let b = 0; b <= 360; b += 6) pts.push(destination(lat, lon, km, b));
    return pts;
  }
  function greatCircle(a, b, n) {
    // Simple interpolation along the great circle (slerp).
    const r = Math.PI / 180;
    const toV = (lat, lon) => [Math.cos(lat * r) * Math.cos(lon * r), Math.cos(lat * r) * Math.sin(lon * r), Math.sin(lat * r)];
    const A = toV(a[1], a[0]), B = toV(b[1], b[0]);
    const dot = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
    const w = Math.acos(dot);
    if (w < 1e-6) return [a, b];
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, s1 = Math.sin((1 - t) * w) / Math.sin(w), s2 = Math.sin(t * w) / Math.sin(w);
      const v = [A[0] * s1 + B[0] * s2, A[1] * s1 + B[1] * s2, A[2] * s1 + B[2] * s2];
      out.push([Math.atan2(v[1], v[0]) / r, Math.atan2(v[2], Math.hypot(v[0], v[1])) / r]);
    }
    return out;
  }

  // Spatial insight from bundled data only: nearest mapped towns, distance + bearing, country code.
  function insight(lat, lon, n) {
    if (lat == null || lon == null) return null;
    const list = towns().map((t) => ({ t, km: haversine(lat, lon, t.lat, t.lon) })).sort((a, b) => a.km - b.km).slice(0, n || 5);
    return list.map(({ t, km }) => ({ name: t.name, a3: t.a3, adm1: t.adm1, kind: t.kind, km: Math.round(km), bearing: Math.round(bearingTo(lat, lon, t.lat, t.lon)), lat: t.lat, lon: t.lon }));
  }

  function searchPlaces(q, limit) {
    q = String(q || "").trim().toLowerCase();
    if (q.length < 2) return [];
    return towns().filter((t) => t.name.toLowerCase().includes(q)).sort((a, b) => (b.pop || 0) - (a.pop || 0)).slice(0, limit || 8);
  }

  function episodeGeo(ep) {
    const pins = [], arcs = [], rings = [];
    const located = ep.stories.map((s, i) => ({ s, i })).filter(({ s }) => s.location && s.location.lat != null && s.location.lon != null);
    located.forEach(({ s, i }) => {
      pins.push({ type: "Feature", properties: { idx: i, title: s.title, n: String(i + 1), active: i === st.active ? 1 : 0 }, geometry: { type: "Point", coordinates: [s.location.lon, s.location.lat] } });
      [10, 50, 100].forEach((km) => rings.push({ type: "Feature", properties: { km, active: i === st.active ? 1 : 0 }, geometry: { type: "LineString", coordinates: ring(s.location.lat, s.location.lon, km) } }));
    });
    for (let k = 1; k < located.length; k++) {
      const a = located[k - 1].s.location, b = located[k].s.location;
      arcs.push({ type: "Feature", properties: { km: Math.round(haversine(a.lat, a.lon, b.lat, b.lon)) }, geometry: { type: "LineString", coordinates: greatCircle([a.lon, a.lat], [b.lon, b.lat], 64) } });
    }
    const fc = (f) => ({ type: "FeatureCollection", features: f });
    return { pins: fc(pins), arcs: fc(arcs), rings: fc(rings) };
  }

  function setOrUpdate(id, data) {
    const src = st.map.getSource(id);
    if (src) src.setData(data);
    else st.map.addSource(id, { type: "geojson", data });
  }

  function addOverlays() {
    const map = st.map;
    const ov = st.overlays;
    const vis = (on) => (on ? "visible" : "none");
    setOrUpdate("gd-countries", countriesGeoJSON());
    const look = (st.episode && st.episode.look) || {};
    const soft = !look.map || look.map.softBorders !== false;
    const hl = (look.palette && look.palette.highlight) || "#ff8a1f";
    if (!map.getLayer("gd-countries")) map.addLayer({ id: "gd-countries", type: "line", source: "gd-countries", paint: { "line-color": "#ffffff", "line-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.35, 8, 0.12], "line-width": 0.8 } });
    map.setPaintProperty("gd-countries", "line-blur", soft ? 1.2 : 0);
    map.setPaintProperty("gd-countries", "line-color", soft ? "#ffffff" : "#4d8fd0");
    setOrUpdate("gd-highlight", highlightGeoJSON());
    if (!map.getLayer("gd-hl-fill")) map.addLayer({ id: "gd-hl-fill", type: "fill", source: "gd-highlight", paint: { "fill-color": hl, "fill-opacity": 0.22 } });
    if (!map.getLayer("gd-hl-glow")) map.addLayer({ id: "gd-hl-glow", type: "line", source: "gd-highlight", paint: { "line-color": hl, "line-width": 12, "line-blur": 8, "line-opacity": 0.85 } });
    if (!map.getLayer("gd-hl-line")) map.addLayer({ id: "gd-hl-line", type: "line", source: "gd-highlight", paint: { "line-color": hl, "line-width": 2.6, "line-opacity": 1 } });
    ["gd-hl-fill"].forEach((id) => map.setPaintProperty(id, "fill-color", hl));
    ["gd-hl-glow", "gd-hl-line"].forEach((id) => map.setPaintProperty(id, "line-color", hl));
    ["gd-hl-fill", "gd-hl-glow", "gd-hl-line"].forEach((id) => map.setLayoutProperty(id, "visibility", vis(ov.highlight !== false)));
    // Flat white country labels need glyphs, which only the online styles carry.
    if (map.getStyle().glyphs) {
      setOrUpdate("gd-country-labels", countryLabelPoints());
      if (!map.getLayer("gd-country-labels")) map.addLayer({ id: "gd-country-labels", type: "symbol", source: "gd-country-labels", maxzoom: 7,
        filter: [">", ["get", "area"], 6],
        layout: { "text-field": ["upcase", ["get", "name"]], "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 1, 10, 5, 16], "text-letter-spacing": 0.08, "text-pitch-alignment": "map", "text-rotation-alignment": "map" },
        paint: { "text-color": "#ffffff", "text-opacity": 0.92, "text-halo-color": "rgba(0,0,0,0.35)", "text-halo-width": 0.6 } });
      map.setLayoutProperty("gd-country-labels", "visibility", vis(ov.countryLabels !== false));
    }
    setOrUpdate("gd-towns", townsGeoJSON());
    if (!map.getLayer("gd-towns")) map.addLayer({ id: "gd-towns", type: "circle", source: "gd-towns", minzoom: 3, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 10, 3.5], "circle-color": "#9cc9ff", "circle-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 12, 0.2] } });

    if (ov.bluemarble && !map.getSource("gd-bluemarble")) {
      const L = GD.layers.OVERLAYS.find((o) => o.id === "bluemarble");
      map.addSource("gd-bluemarble", { type: "raster", tiles: [L.tiles], tileSize: 256, maxzoom: L.maxzoom, attribution: L.credit });
      const before = map.getLayer("gd-countries") ? "gd-countries" : undefined;
      map.addLayer({ id: "gd-bluemarble", type: "raster", source: "gd-bluemarble", paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 5, 1, 9, 0] } }, before);
    }
    if (map.getLayer("gd-bluemarble")) map.setLayoutProperty("gd-bluemarble", "visibility", vis(ov.bluemarble));

    const geo = st.episode ? episodeGeo(st.episode) : episodeGeo({ stories: [] });
    setOrUpdate("gd-rings", geo.rings);
    setOrUpdate("gd-arcs", geo.arcs);
    setOrUpdate("gd-pins", geo.pins);
    if (!map.getLayer("gd-rings")) map.addLayer({ id: "gd-rings", type: "line", source: "gd-rings", paint: { "line-color": "#ffd166", "line-dasharray": [2, 2], "line-width": 1.2, "line-opacity": ["case", ["==", ["get", "active"], 1], 0.85, 0.18] } });
    if (!map.getLayer("gd-arcs")) map.addLayer({ id: "gd-arcs", type: "line", source: "gd-arcs", paint: { "line-color": "#5ee6ff", "line-width": 2, "line-opacity": 0.7, "line-blur": 0.5 } });
    if (!map.getLayer("gd-pins-halo")) map.addLayer({ id: "gd-pins-halo", type: "circle", source: "gd-pins", paint: { "circle-radius": ["case", ["==", ["get", "active"], 1], 22, 12], "circle-color": "#ff3b5c", "circle-opacity": 0.18, "circle-pitch-alignment": "map" } });
    if (!map.getLayer("gd-pins")) map.addLayer({ id: "gd-pins", type: "circle", source: "gd-pins", paint: { "circle-radius": ["case", ["==", ["get", "active"], 1], 8, 6], "circle-color": "#ff3b5c", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });

    map.setLayoutProperty("gd-countries", "visibility", vis(ov.countries));
    map.setLayoutProperty("gd-towns", "visibility", vis(ov.towns));
    map.setLayoutProperty("gd-rings", "visibility", vis(ov.rings));
    map.setLayoutProperty("gd-arcs", "visibility", vis(ov.arcs));
    map.setLayoutProperty("gd-pins", "visibility", vis(ov.pins));
    map.setLayoutProperty("gd-pins-halo", "visibility", vis(ov.pins));

    // Street styles: 3D buildings (and optional terrain).
    if (map.getSource("openmaptiles") && !map.getLayer("gd-buildings")) {
      map.addLayer({ id: "gd-buildings", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14,
        filter: ["!", ["has", "hide_3d"]],
        paint: {
          "fill-extrusion-color": "#3c4e6a",
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 8],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.35, 15.5, 0.88]
        } }, "gd-rings");
    }
    if (map.getLayer("gd-buildings")) map.setLayoutProperty("gd-buildings", "visibility", vis(ov.buildings));
    const base = GD.layers.base(st.baseId);
    if (ov.terrain && base && base.runtime && !map.getSource("gd-terrain")) {
      const T = GD.layers.OVERLAYS.find((o) => o.id === "terrain");
      const dem = { type: "raster-dem", tiles: [T.tiles], encoding: "terrarium", tileSize: 256, maxzoom: 15, attribution: T.credit };
      map.addSource("gd-terrain", dem);
      map.addSource("gd-hillshade", Object.assign({}, dem));
      map.addLayer({ id: "gd-hillshade", type: "hillshade", source: "gd-hillshade", minzoom: 11, paint: { "hillshade-exaggeration": 0.3, "hillshade-shadow-color": "#000" } }, map.getLayer("gd-buildings") ? "gd-buildings" : "gd-rings");
    }
    if (map.getLayer("gd-hillshade")) map.setLayoutProperty("gd-hillshade", "visibility", vis(ov.terrain));
    if (GD.eventsMap) GD.eventsMap.install(map); // Event Layers sit above story pins/rings
    st.terrainOn = false;
    terrainForZoom();
    try {
      map.setSky({ "sky-color": "#061226", "horizon-color": "#1b3a63", "fog-color": "#0a1830", "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] });
    } catch (e) { /* older style spec */ }
  }

  function terrainForZoom() {
    const map = st.map;
    if (!map || !map.getSource("gd-terrain")) return;
    const want = st.overlays.terrain && map.getZoom() >= TERRAIN_MIN_ZOOM;
    if (want && !st.terrainOn) { map.setTerrain({ source: "gd-terrain", exaggeration: 1.2 }); st.terrainOn = true; }
    else if (!want && st.terrainOn) { map.setTerrain(null); st.terrainOn = false; }
  }

  function styleFor(baseId) {
    const b = GD.layers.base(baseId);
    if (!b || b.kind === "local") return offlineStyle();
    if (b.kind === "hybrid") return hybridStyle(b);
    if (b.needsKey) {
      const key = GD.settings && GD.settings.key(b.needsKey);
      if (!key) return null;
      return b.styleTemplate.replace("{KEY}", encodeURIComponent(key));
    }
    return b.style;
  }

  function setBase(baseId) {
    const style = styleFor(baseId);
    if (!style) { GD.ui && GD.ui.toast("That base map needs your own key in Settings (optional, paid). Staying on the current map."); return false; }
    st.baseId = baseId;
    st.status = "style-loading";
    localStorage.setItem("globedesk.base", baseId);
    st.map.setStyle(style);
    return true;
  }

  function init(container, opts) {
    st.overlays = {};
    GD.layers.OVERLAYS.forEach((o) => (st.overlays[o.id] = o.status === "unknown" ? false : o.default));
    try { Object.assign(st.overlays, JSON.parse(localStorage.getItem("globedesk.overlays") || localStorage.getItem("gobedesk.overlays") || "{}")); } catch (e) { /* ignore */ }
    st.overlays.ohm = false;
    const saved = (opts && opts.base) || localStorage.getItem("globedesk.base") || localStorage.getItem("gobedesk.base") || (navigator.onLine ? "sat-hybrid" : "offline");
    st.baseId = GD.layers.base(saved) && styleFor(saved) ? saved : "offline";
    const map = new maplibregl.Map({
      container,
      style: styleFor(st.baseId),
      center: [40, 28], zoom: 1.6, pitch: 0, bearing: 0,
      maxPitch: 85, maxZoom: 18.5, minZoom: 0.5,
      attributionControl: { compact: false, customAttribution: "Made with Natural Earth" },
      canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true }
    });
    st.map = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.on("style.load", () => {
      try { map.setProjection({ type: "globe" }); } catch (e) { /* ignore */ }
      addOverlays();
      st.tileErrors = 0;
      st.status = "ready";
      st.onReady.forEach((f) => f());
    });
    map.on("zoom", terrainForZoom);
    map.on("click", "gd-pins", (e) => {
      if (GD.eventsMap && GD.eventsMap.em.mode !== "select") return; // drawing, not picking
      const f = e.features && e.features[0];
      if (f && GD.ui) GD.ui.selectStory(Number(f.properties.idx), { fly: true });
    });
    // Click an empty point on the globe to drop or move the current story pin.
    // No online geocoder is used; this is a coordinate pick (plus the bundled gazetteer in the Story tab).
    map.on("click", (e) => {
      if (GD.eventsMap && GD.eventsMap.em && GD.eventsMap.em.mode !== "select") return;
      if (map.getLayer("gd-pins")) {
        const hits = map.queryRenderedFeatures(e.point, { layers: ["gd-pins"] });
        if (hits && hits.length) return;
      }
      const ep = GD.state && GD.state.episode;
      const s = ep && ep.stories[GD.state.storyIdx];
      if (!s || !s.location) return;
      const lat = Math.round(e.lngLat.lat * 1e5) / 1e5;
      const lon = Math.round(e.lngLat.lng * 1e5) / 1e5;
      s.location.lat = lat;
      s.location.lon = lon;
      if (s.location.precision === "unset") s.location.precision = "approximate";
      if (GD.ui && GD.ui.changed) GD.ui.changed();
      if (GD.ui && GD.ui.toast) GD.ui.toast("Pin set to the clicked coordinates (no address lookup).");
    });
    map.on("error", (e) => {
      const msg = (e && e.error && e.error.message) || "";
      if (/abort|cancel/i.test(msg)) return;
      // A street or satellite *style* that fails to load falls back to the bundled globe.
      if (st.status === "style-loading" && st.baseId !== "offline") {
        console.warn("Base style failed, falling back to offline globe:", msg);
        st.baseId = "offline";
        map.setStyle(offlineStyle());
        GD.ui && GD.ui.toast("Street map unreachable. Using the offline globe.");
        return;
      }
      // Runtime tile/source failures (style already loaded): do not auto-wipe the view;
      // ask the user to switch to the offline globe.
      if (st.status === "ready" && st.baseId !== "offline") {
        st.tileErrors = (st.tileErrors || 0) + 1;
        if (st.tileErrors === 8) {
          GD.ui && GD.ui.toast("Map tiles are unreachable. Use Layers → Offline globe to keep working without the network.");
        }
      }
      console.warn("map warning:", msg);
    });
    return map;
  }

  function setOverlay(id, on) {
    st.overlays[id] = !!on;
    localStorage.setItem("globedesk.overlays", JSON.stringify(st.overlays));
    if (st.map && st.map.isStyleLoaded()) addOverlays();
  }

  function setEpisode(ep, activeIdx) {
    st.episode = ep;
    if (activeIdx != null) st.active = activeIdx;
    if (st.map && st.map.getSource("gd-pins")) {
      const g = episodeGeo(ep);
      st.map.getSource("gd-pins").setData(g.pins);
      st.map.getSource("gd-arcs").setData(g.arcs);
      st.map.getSource("gd-rings").setData(g.rings);
      if (st.map.getSource("gd-highlight")) st.map.getSource("gd-highlight").setData(highlightGeoJSON());
    }
    updateLabels();
  }

  // Small DOM labels for the nearest bundled towns around the active story (works offline, no glyphs needed).
  function updateLabels() {
    st.labelMarkers.forEach((m) => m.remove());
    st.labelMarkers = [];
    if (!st.map || !st.episode || st.active < 0) return;
    const s = st.episode.stories[st.active];
    if (!s || s.location.lat == null || !st.overlays.towns) return;
    (insight(s.location.lat, s.location.lon, 4) || []).forEach((p) => {
      const el = document.createElement("div");
      el.className = "gd-town-label";
      el.textContent = p.name;
      st.labelMarkers.push(new maplibregl.Marker({ element: el, anchor: "left", offset: [6, 0] }).setLngLat([p.lon, p.lat]).addTo(st.map));
    });
  }

  function camera() {
    const m = st.map;
    const c = m.getCenter();
    return { center: [Number(c.lng.toFixed(5)), Number(c.lat.toFixed(5))], zoom: Number(m.getZoom().toFixed(2)), pitch: Math.round(m.getPitch()), bearing: Math.round(m.getBearing()) };
  }

  const EASES = {
    cinematic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    linear: (t) => t,
    smooth: (t) => t * t * (3 - 2 * t)
  };

  function flyTo(kf, speedScale) {
    const dur = Math.max(200, (kf.durationSec || 3) * 1000 * (speedScale || 1));
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches && !(GD.state && GD.state.recording);
    const opts = { center: kf.center, zoom: kf.zoom, pitch: kf.pitch, bearing: kf.bearing, duration: reduce ? 0 : dur, easing: EASES[kf.ease] || EASES.cinematic, essential: true };
    if (reduce) st.map.jumpTo(opts);
    else st.map.flyTo(Object.assign(opts, { curve: 1.6 }));
  }

  GD.globe = { st, init, setBase, setOverlay, setEpisode, flyTo, camera, insight, searchPlaces, haversine, bearingTo, towns, updateLabels, countryList, isLand, streetView, refresh: () => st.map && st.map.isStyleLoaded() && addOverlays() };
})();
