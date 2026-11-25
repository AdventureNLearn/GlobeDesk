/* Globe: MapLibre globe projection, base styles, overlays, camera keyframes, spatial insight. window.GD.globe */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const HOME_VIEW = { center: [40, 28], zoom: 1.6, pitch: 0, bearing: 0 };
  const R_KM = 6371.0088;
  const TERRAIN_MIN_ZOOM = 11;
  const TOWN_LABEL_MIN_ZOOM = 6;
  const TOWN_LABEL_MIN_PX = 40;

  function pointsTooClose(a, b, minPx) {
    if (!a || !b) return false;
    const d = minPx == null ? TOWN_LABEL_MIN_PX : minPx;
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy < d * d;
  }

  function pickTownLabelPoints(candidates, blocked, minPx) {
    const taken = (blocked || []).slice();
    const out = [];
    (candidates || []).forEach(function (pt) {
      if (!pt) return;
      if (taken.some(function (q) { return pointsTooClose(pt, q, minPx); })) return;
      out.push(pt);
      taken.push(pt);
    });
    return out;
  }

  const st = { map: null, container: null, baseId: "offline", overlays: {}, onReady: [], terrainOn: false, episode: null, active: -1, labelMarkers: [], status: "init", preserveDrawingBuffer: false, recreating: false };

  function offlineStyle() {
    return {
      version: 8,
      name: "GlobeDesk offline",
      sources: {
        land: { type: "geojson", data: window.GD_LAND || { type: "FeatureCollection", features: [] }, attribution: "Made with Natural Earth" }
      },
      layers: [
        { id: "background", type: "background", paint: { "background-color": "#02040c" } },
        { id: "land", type: "fill", source: "land", paint: { "fill-color": "#13263d", "fill-opacity": 1 } },
        { id: "land-edge", type: "line", source: "land", paint: { "line-color": "#62b6ff", "line-width": 0.8, "line-opacity": 0.55 } }
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
    const hl = (look.palette && look.palette.highlight) || "#5ee7ff";
    if (!map.getLayer("gd-countries")) map.addLayer({ id: "gd-countries", type: "line", source: "gd-countries", paint: { "line-color": "#ffffff", "line-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.35, 8, 0.12], "line-width": 0.8 } });
    map.setPaintProperty("gd-countries", "line-blur", soft ? 1.2 : 0);
    map.setPaintProperty("gd-countries", "line-color", soft ? "#ffffff" : "#4d8fd0");
    setOrUpdate("gd-highlight", highlightGeoJSON());
    // The bundled outlines are coarse, so the focus glow fades out by region zoom (~z7.5)
    // instead of drawing a misplaced border over city streets.
    if (!map.getLayer("gd-hl-fill")) map.addLayer({ id: "gd-hl-fill", type: "fill", source: "gd-highlight", paint: { "fill-color": hl, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5.5, 0.22, 7.5, 0] } });
    if (!map.getLayer("gd-hl-glow")) map.addLayer({ id: "gd-hl-glow", type: "line", source: "gd-highlight", paint: { "line-color": hl, "line-width": 12, "line-blur": 8, "line-opacity": ["interpolate", ["linear"], ["zoom"], 5.5, 0.85, 7.5, 0] } });
    if (!map.getLayer("gd-hl-line")) map.addLayer({ id: "gd-hl-line", type: "line", source: "gd-highlight", paint: { "line-color": hl, "line-width": 2.6, "line-opacity": ["interpolate", ["linear"], ["zoom"], 5.5, 1, 7.5, 0] } });
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

    // Never stack GIBS Blue Marble with the EOX satellite raster.
    const showBlue = !!(ov.bluemarble && GD.render && !GD.render.rastersStacked(st.baseId, ov));
    if (showBlue) {
      const L = GD.layers.OVERLAYS.find((o) => o.id === "bluemarble");
      const tiles = (GD.layers.blueMarbleTiles && GD.layers.blueMarbleTiles()) || L.tiles;
      if (!map.getSource("gd-bluemarble")) map.addSource("gd-bluemarble", { type: "raster", tiles: [tiles], tileSize: 256, maxzoom: L.maxzoom, attribution: L.credit });
      if (!map.getLayer("gd-bluemarble")) {
        const before = map.getLayer("gd-countries") ? "gd-countries" : undefined;
        map.addLayer({ id: "gd-bluemarble", type: "raster", source: "gd-bluemarble", paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 5, 1, 9, 0] } }, before);
      }
    }
    if (map.getLayer("gd-bluemarble")) map.setLayoutProperty("gd-bluemarble", "visibility", vis(showBlue));

    const showRegion = !!(ov["eox-region"] && GD.render && !GD.render.rastersStacked(st.baseId, ov));
    if (showRegion) {
      const L = GD.layers.OVERLAYS.find((o) => o.id === "eox-region");
      const tiles = (GD.layers.eoxRegionTiles && GD.layers.eoxRegionTiles()) || (L && L.tiles);
      const bounds = (GD.layers.eoxRegionBounds && GD.layers.eoxRegionBounds()) || L.bounds;
      const src = { type: "raster", tiles: [tiles], tileSize: 256, maxzoom: L.maxzoom, attribution: L.credit };
      if (bounds && bounds.length === 4) src.bounds = bounds;
      if (!map.getSource("gd-eox-region")) map.addSource("gd-eox-region", src);
      if (!map.getLayer("gd-eox-region")) {
        const before = map.getLayer("gd-countries") ? "gd-countries" : (map.getLayer("gd-bluemarble") ? "gd-bluemarble" : undefined);
        map.addLayer({ id: "gd-eox-region", type: "raster", source: "gd-eox-region", paint: { "raster-opacity": 1 } }, before);
      }
    }
    if (map.getLayer("gd-eox-region")) map.setLayoutProperty("gd-eox-region", "visibility", vis(showRegion));

    const geo = st.episode ? episodeGeo(st.episode) : episodeGeo({ stories: [] });
    setOrUpdate("gd-rings", geo.rings);
    setOrUpdate("gd-arcs", geo.arcs);
    setOrUpdate("gd-pins", geo.pins);
    if (!map.getLayer("gd-rings")) map.addLayer({ id: "gd-rings", type: "line", source: "gd-rings", paint: { "line-color": "#ffd166", "line-dasharray": [2, 2], "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 6, 1.2, 12, 2], "line-opacity": ["case", ["==", ["get", "active"], 1], 0.85, 0.18] } });
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
    if (ov.terrain && base && base.runtime) {
      const T = GD.layers.OVERLAYS.find((o) => o.id === "terrain");
      const dem = { type: "raster-dem", tiles: [T.tiles], encoding: "terrarium", tileSize: 256, maxzoom: 15, attribution: T.credit };
      if (!map.getSource("gd-terrain")) map.addSource("gd-terrain", dem);
      if (!map.getSource("gd-hillshade")) map.addSource("gd-hillshade", Object.assign({}, dem));
      if (!map.getLayer("gd-hillshade")) {
        map.addLayer({ id: "gd-hillshade", type: "hillshade", source: "gd-hillshade", minzoom: 11, paint: { "hillshade-exaggeration": 0.3, "hillshade-shadow-color": "#000" } }, map.getLayer("gd-buildings") ? "gd-buildings" : "gd-rings");
      }
    }
    if (map.getLayer("gd-hillshade")) map.setLayoutProperty("gd-hillshade", "visibility", vis(ov.terrain));
    if (GD.eventsMap) GD.eventsMap.install(map); // Event Layers sit above story pins/rings
    if (GD.gis && GD.gis.syncMap) GD.gis.syncMap(map);
    // Don't clear the flag first: that made every addOverlays call setTerrain again
    // and left the style not-ready, so a batch of setOverlay calls could skip later layers.
    if (typeof map.getTerrain === "function") st.terrainOn = !!map.getTerrain();
    terrainForZoom();
    try {
      /* Holographic atmosphere: #62b6ff at altitude 0.2, bloom around the limb. */
      map.setSky({ "sky-color": "#02040c", "horizon-color": "#62b6ff", "fog-color": "#0a2048", "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 0.85, 7, 0] });
    } catch (e) { /* older style spec */ }
  }

  function terrainForZoom() {
    const map = st.map;
    if (!map || !map.getSource("gd-terrain")) return;
    const want = st.overlays.terrain && map.getZoom() >= TERRAIN_MIN_ZOOM;
    if (want && !st.terrainOn) { map.setTerrain({ source: "gd-terrain", exaggeration: 1.2 }); st.terrainOn = true; }
    else if (!want && st.terrainOn) { map.setTerrain(null); st.terrainOn = false; }
  }


  const SAT_OPACITY = ["interpolate", ["linear"], ["zoom"], 12, 1, 15, 0.88, 17, 0.55];

  function refreshAttrib(map) {
    const ctrls = map && map._controls;
    if (!ctrls || !ctrls.forEach) return;
    ctrls.forEach(function (ctrl) {
      if (ctrl && typeof ctrl._updateAttributions === "function") {
        try { ctrl._updateAttributions(); } catch (e) { /* ignore */ }
      }
    });
  }

  function setSourceAttribution(map, id, attribution) {
    const src = map.getSource(id);
    if (!src) return;
    try { src.attribution = attribution || ""; } catch (e) { /* ignore */ }
    if (src._options) src._options.attribution = attribution || "";
    refreshAttrib(map);
  }

  function sourceMaxzoom(src) {
    if (!src) return null;
    if (src.maxzoom != null) return Number(src.maxzoom);
    if (src._options && src._options.maxzoom != null) return Number(src._options.maxzoom);
    return null;
  }

  // True when a raster source already serves exactly this one tile URL template.
  function sameTiles(src, tiles) {
    const cur = src && ((src._options && src._options.tiles) || src.tiles);
    return !!cur && cur.length === 1 && cur[0] === tiles;
  }

  function safeRemoveLayerSource(map, id) {
    try { if (map.getLayer(id)) map.removeLayer(id); } catch (e) { /* TypeError during a failed load */ }
    try { if (map.getSource(id)) map.removeSource(id); } catch (e) { /* TypeError during a failed load */ }
  }

  function ensureSatRaster(map, id, tiles, maxzoom, attribution, beforeId) {
    if (!tiles) return;
    const wantZ = maxzoom == null ? 9 : maxzoom;
    const src = map.getSource(id);
    const curZ = sourceMaxzoom(src);
    const rebuild = !!src && curZ != null && curZ !== Number(wantZ);
    if (rebuild) safeRemoveLayerSource(map, id);
    const after = map.getSource(id);
    if (after && after.setTiles) {
      // setTiles() reloads every tile of the source even when the URL is the same; only call it on a real change.
      if (!sameTiles(after, tiles)) {
        try { after.setTiles([tiles]); } catch (e) { /* TypeError during a failed load */ }
      }
      setSourceAttribution(map, id, attribution);
    } else if (!map.getSource(id)) {
      try {
        map.addSource(id, { type: "raster", tiles: [tiles], tileSize: 256, maxzoom: wantZ, attribution: attribution || "" });
      } catch (e) { /* TypeError during a failed load */ }
    }
    if (!map.getLayer(id) && map.getSource(id)) {
      const before = beforeId && map.getLayer(beforeId) ? beforeId : (map.getLayer("road-casing") ? "road-casing" : undefined);
      try {
        map.addLayer({ id: id, type: "raster", source: id, paint: { "raster-saturation": -0.12, "raster-contrast": 0.08, "raster-opacity": 0 } }, before);
      } catch (e) { /* TypeError during a failed load */ }
    }
    refreshAttrib(map);
  }

  function hideSatBlend(map) {
    ["sat-prev", "sat-next"].forEach(function (id) {
      if (map.getLayer(id)) {
        try { map.setLayoutProperty(id, "visibility", "none"); map.setPaintProperty(id, "raster-opacity", 0); } catch (e) { /* ignore */ }
      }
    });
  }

  function applyDatedSat() {
    const map = st.map;
    if (!map || st.baseId !== "sat-hybrid") return;
    if (!map.getSource || !map.getSource("sat")) return;
    if (!GD.layers || !GD.layers.datedSatSpec) return;
    let spec;
    try { spec = GD.layers.datedSatSpec(); } catch (e) { return; }
    if (!spec) return;
    st.datedSat = spec;
    try {
      if (spec.kind === "projected" && (spec.tilesPrev || spec.tilesNext)) {
        const before = map.getLayer("road-casing") ? "road-casing" : undefined;
        if (spec.tilesPrev) ensureSatRaster(map, "sat-prev", spec.tilesPrev, spec.maxzoom, spec.credit, before);
        if (spec.tilesNext) ensureSatRaster(map, "sat-next", spec.tilesNext, spec.maxzoom, spec.credit, before);
        if (map.getLayer("sat")) map.setPaintProperty("sat", "raster-opacity", 0);
        if (map.getLayer("sat-prev")) {
          map.setLayoutProperty("sat-prev", "visibility", spec.tilesPrev ? "visible" : "none");
          map.setPaintProperty("sat-prev", "raster-opacity", spec.tilesPrev ? spec.opacityPrev : 0);
        }
        if (map.getLayer("sat-next")) {
          map.setLayoutProperty("sat-next", "visibility", spec.tilesNext ? "visible" : "none");
          map.setPaintProperty("sat-next", "raster-opacity", spec.tilesNext ? spec.opacityNext : 0);
        }
      } else if (spec.tiles) {
        const before = map.getLayer("road-casing") ? "road-casing" : undefined;
        ensureSatRaster(map, "sat", spec.tiles, spec.maxzoom, spec.credit, before);
        if (map.getLayer("sat")) {
          try { map.setPaintProperty("sat", "raster-opacity", SAT_OPACITY); } catch (e) { /* ignore */ }
        }
        hideSatBlend(map);
      } else {
        hideSatBlend(map);
      }
    } catch (e) { /* style not ready or TypeError during a failed load */ }
  }

  function styleFor(baseId) {
    const b = GD.layers.base(baseId);
    if (!b || b.kind === "local") return offlineStyle();
    if (b.kind === "hybrid") {
      const tiles = (GD.layers.eoxTiles && GD.layers.eoxTiles()) || b.satTiles;
      return hybridStyle(Object.assign({}, b, { satTiles: tiles }));
    }
    if (b.needsKey) {
      const key = GD.settings && GD.settings.key(b.needsKey);
      if (!key) return null;
      return b.styleTemplate.replace("{KEY}", encodeURIComponent(key));
    }
    return b.style;
  }

  function renderPrefs() {
    const R = GD.render;
    return {
      antialias: R ? R.readAntialias() : false,
      pixelRatioCap: R ? R.readPixelRatioCap() : 1.5
    };
  }

  function mapConstructorOptions(cam) {
    const prefs = renderPrefs();
    const R = GD.render;
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    const attrs = R
      ? R.canvasContextAttributes({ recording: st.preserveDrawingBuffer, antialias: prefs.antialias })
      : { antialias: !!prefs.antialias, preserveDrawingBuffer: !!st.preserveDrawingBuffer };
    return {
      container: st.container,
      style: styleFor(st.baseId),
      center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing,
      maxPitch: 85, maxZoom: 18.5, minZoom: 0.5,
      pixelRatio: R ? R.pixelRatio(dpr, prefs.pixelRatioCap) : Math.min(dpr, prefs.pixelRatioCap),
      attributionControl: { compact: true, customAttribution: "Made with Natural Earth" },
      canvasContextAttributes: attrs,
      // Touch: one finger pans the globe, a two-finger pinch only zooms (no twist-rotate, no two-finger
      // tilt). cooperativeGestures stays off so one finger moves the map instead of asking for two.
      cooperativeGestures: false,
      touchPitch: false
    };
  }

  function bindMapEvents(map) {
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(panControl(), "top-right");
    if (GD.mapPointer && GD.mapPointer.applyTouchGestures) GD.mapPointer.applyTouchGestures(map);
    map.on("style.load", () => {
      try { map.setProjection({ type: "globe" }); } catch (e) { /* ignore */ }
      st.tileErrors = 0;
      const finish = () => {
        try { applyDatedSat(); } catch (e) { /* ignore */ }
        addOverlays();
        st.status = "ready";
        flushStyleReady();
        kickOverlayApply();
        st.onReady.forEach((f) => f());
      };
      const probe = (GD.layers && GD.layers.probeLocalTileProxy) ? GD.layers.probeLocalTileProxy() : Promise.resolve();
      Promise.resolve(probe).then(finish, finish);
    });
    map.on("zoom", terrainForZoom);
    map.on("moveend", () => { updateLabels(); if (GD.gis && GD.gis.onMapMoveEnd) GD.gis.onMapMoveEnd(); });
    // One dispatcher in map-pointer: click selects a pin or event; it never drops a pin.
    if (GD.mapPointer && GD.mapPointer.bind) GD.mapPointer.bind(map);
    map.on("sourcedata", (e) => {
      if (GD.gis && GD.gis.noteSourceLoaded) {
        try { GD.gis.noteSourceLoaded(e); } catch (err) { /* ignore */ }
      }
    });
    map.on("error", (e) => {
      const err = e && e.error;
      const msg = (err && err.message) || "";
      if (/abort|cancel/i.test(msg)) return;
      if (GD.gis && GD.gis.noteTileError) {
        try { if (GD.gis.noteTileError(e)) return; } catch (x) { /* ignore */ }
      }
      if (GD.layers && GD.layers.noteDatedTileError) {
        try { if (GD.layers.noteDatedTileError(e)) return; } catch (x) { /* ignore */ }
      }
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
    if (GD.ui && GD.ui.attachMap) GD.ui.attachMap(map);
    return map;
  }

  function storeOverlays() {
    try { localStorage.setItem("globedesk.overlays", JSON.stringify(st.overlays)); } catch (e) { /* ignore */ }
  }

  function setBase(baseId) {
    const pol = GD.render ? GD.render.policyOnSetBase(baseId, st.overlays) : { baseId, overlays: st.overlays, toast: "" };
    st.overlays = pol.overlays;
    storeOverlays();
    const style = styleFor(pol.baseId);
    if (!style) { GD.ui && GD.ui.toast("That base map needs your own key in Settings (optional, paid). Staying on the current map."); return false; }
    const same = st.baseId === pol.baseId && st.map;
    st.baseId = pol.baseId;
    try { localStorage.setItem("globedesk.base", st.baseId); } catch (e) { /* ignore */ }
    if (same) {
      // Reloading the same style can miss style.load and leave the globe stuck on "style-loading".
      if (st.map && st.map.isStyleLoaded && st.map.isStyleLoaded()) addOverlays();
      if (pol.toast) GD.ui && GD.ui.toast(pol.toast);
      return true;
    }
    st.status = "style-loading";
    if (st.map) st.map.setStyle(style);
    if (pol.toast) GD.ui && GD.ui.toast(pol.toast);
    return true;
  }

  function init(container, opts) {
    st.container = container;
    st.preserveDrawingBuffer = false;
    st.overlays = {};
    GD.layers.OVERLAYS.forEach((o) => (st.overlays[o.id] = o.status === "unknown" ? false : o.default));
    try { Object.assign(st.overlays, JSON.parse(localStorage.getItem("globedesk.overlays") || localStorage.getItem("gobedesk.overlays") || "{}")); } catch (e) { /* ignore */ }
    st.overlays.ohm = false;
    const saved = (opts && opts.base) || localStorage.getItem("globedesk.base") || localStorage.getItem("gobedesk.base") || (navigator.onLine ? "sat-hybrid" : "offline");
    let baseId = GD.layers.base(saved) && styleFor(saved) ? saved : "offline";
    const start = GD.render ? GD.render.normalizeStartup(baseId, st.overlays) : { baseId, overlays: st.overlays };
    st.overlays = start.overlays;
    st.baseId = start.baseId;
    const map = new maplibregl.Map(mapConstructorOptions({ center: HOME_VIEW.center, zoom: HOME_VIEW.zoom, pitch: HOME_VIEW.pitch, bearing: HOME_VIEW.bearing }));
    st.map = map;
    bindMapEvents(map);
    return map;
  }

  function defaultCam() {
    return st.map ? camera() : { center: HOME_VIEW.center.slice(), zoom: HOME_VIEW.zoom, pitch: HOME_VIEW.pitch, bearing: HOME_VIEW.bearing };
  }

  const RECREATE_TIMEOUT_MS = 15000;
  function recreateMap() {
    if (!st.container) return Promise.resolve();
    if (st.recreating) return st.recreating;
    const cam = defaultCam();
    const ep = st.episode;
    const active = st.active;
    if (st.map) {
      clearOverlayWait();
      if (GD.eventsMap && GD.eventsMap.detach) GD.eventsMap.detach(st.map);
      try { st.map.remove(); } catch (e) { /* ignore */ }
      st.map = null;
    }
    st.status = "style-loading";
    const map = new maplibregl.Map(mapConstructorOptions(cam));
    st.map = map;
    bindMapEvents(map);
    // Finishes exactly once: on "load", on a style-level "error" before the style loads, or after a timeout,
    // so a map that never loads cannot leave st.recreating set (Event Layers stay paused while it is set and
    // the next recreateMap() would return the same stuck promise). st.recreating is always cleared.
    let settled = false;
    let timer = 0;
    const p = new Promise((resolve, reject) => {
      const finish = (outcome) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { map.off("load", onLoad); map.off("error", onError); } catch (e) { /* ignore */ }
        st.recreateOutcome = outcome;
        let failure = null;
        try {
          if (st.map === map) {
            try { map.jumpTo({ center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing }); } catch (e) { /* ignore */ }
            if (ep) setEpisode(ep, active);
          }
        } catch (e) {
          failure = e;
        } finally {
          st.recreating = null;
          if (failure) reject(failure); else resolve(outcome);
        }
      };
      const onLoad = () => finish("load");
      // Tile and source errors are normal while loading; only a style-level error before the style loads ends the wait.
      const onError = (e) => { if (!(e && (e.tile || e.sourceId)) && !(map.isStyleLoaded && map.isStyleLoaded())) finish("error"); };
      timer = setTimeout(() => finish("timeout"), st.recreateTimeoutMs || RECREATE_TIMEOUT_MS);
      if (map.loaded()) finish("load");
      else { map.on("load", onLoad); map.on("error", onError); }
    });
    st.recreating = settled ? null : p;
    return p;
  }

  function isDrawingBufferPreserved() {
    if (!st.map) return !!st.preserveDrawingBuffer;
    try {
      const canvas = st.map.getCanvas();
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (gl && gl.getContextAttributes) return !!gl.getContextAttributes().preserveDrawingBuffer;
    } catch (e) { /* ignore */ }
    return !!st.preserveDrawingBuffer;
  }

  function setPreserveDrawingBuffer(on) {
    on = !!on;
    if (st.preserveDrawingBuffer === on && st.map && isDrawingBufferPreserved() === on) return Promise.resolve();
    st.preserveDrawingBuffer = on;
    return recreateMap();
  }

  function prepareForExport() { return setPreserveDrawingBuffer(true); }
  function endExport() { return setPreserveDrawingBuffer(false); }

  function setRenderOptions(opts) {
    const R = GD.render;
    if (!R) return Promise.resolve();
    const o = opts || {};
    if ("antialias" in o) R.writeAntialias(!!o.antialias);
    if ("pixelRatioCap" in o && Number(o.pixelRatioCap) > 0) R.writePixelRatioCap(Number(o.pixelRatioCap));
    if (st.preserveDrawingBuffer) return Promise.resolve();
    return recreateMap();
  }

  const styleReadyWaiters = [];
  let overlaysDirty = false;
  let overlayWait = null;
  const OVERLAY_RETRY_MS = 100;
  const OVERLAY_RETRY_MAX = 50;

  function flushStyleReady() {
    const fns = styleReadyWaiters.splice(0);
    fns.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
  }

  // The style object is parsed and attached. Tiles and sources may still be
  // loading: Event Layers call setData every 40 ms, so isStyleLoaded() can
  // stay false and idle may never fire. addLayer / setLayoutProperty still work.
  function styleIsBound() {
    return !!(st.map && st.status === "ready");
  }

  function clearOverlayWait() {
    const w = overlayWait;
    overlayWait = null;
    if (!w) return;
    if (w.map) {
      try { w.map.off("idle", w.fire); } catch (e) { /* ignore */ }
      try { w.map.off("styledata", w.fire); } catch (e) { /* ignore */ }
    }
    if (w.timer != null && typeof clearTimeout === "function") clearTimeout(w.timer);
  }

  function afterStyleReady(fn) {
    const map = st.map;
    if (!map) return;
    if (styleIsBound()) { fn(); return; }
    styleReadyWaiters.push(fn);
    waitForStyleSettle();
  }

  function waitForStyleSettle() {
    const map = st.map;
    if (!map) return;
    if (overlayWait && overlayWait.map !== map) clearOverlayWait();
    if (overlayWait) return;
    const fire = () => {
      if (!overlayWait || overlayWait.map !== map) return;
      if (st.map !== map) { clearOverlayWait(); return; }
      if (!styleIsBound()) return;
      clearOverlayWait();
      flushStyleReady();
      kickOverlayApply();
    };
    const wait = { map: map, fire: fire, timer: null, tries: 0 };
    overlayWait = wait;
    map.on("idle", fire);
    map.on("styledata", fire);
    const tick = () => {
      if (overlayWait !== wait) return;
      wait.tries++;
      if (styleIsBound() || wait.tries >= OVERLAY_RETRY_MAX) {
        // Give up the timer after the bound, but leave overlaysDirty so a later style.load can still apply.
        if (styleIsBound()) fire();
        else clearOverlayWait();
        return;
      }
      wait.timer = setTimeout(tick, OVERLAY_RETRY_MS);
    };
    wait.timer = setTimeout(tick, OVERLAY_RETRY_MS);
  }

  // Coalesce a burst of setOverlay calls into one apply after this turn.
  // If the style isn't bound yet, or the apply throws, retry on a short timer
  // (and on idle / styledata) bound to the current map, not on isStyleLoaded().
  let overlayApplyQueued = false;

  function applyOverlaysWhenReady() {
    overlaysDirty = true;
    // Wait until this turn finishes so a Show all / Hide all batch is applied once, with the final state.
    if (overlayApplyQueued) return;
    overlayApplyQueued = true;
    const run = () => { overlayApplyQueued = false; kickOverlayApply(); };
    if (typeof queueMicrotask === "function") queueMicrotask(run);
    else Promise.resolve().then(run);
  }

  function kickOverlayApply() {
    if (!overlaysDirty || !st.map) return;
    if (!styleIsBound()) {
      waitForStyleSettle();
      return;
    }
    overlaysDirty = false;
    try { addOverlays(); } catch (e) {
      overlaysDirty = true;
      waitForStyleSettle();
    }
  }

  function setOverlay(id, on) {
    const pol = GD.render ? GD.render.policyOnSetOverlay(st.baseId, st.overlays, id, on) : { baseId: st.baseId, overlays: Object.assign({}, st.overlays, { [id]: !!on }), toast: "" };
    st.overlays = pol.overlays;
    storeOverlays();
    if (pol.baseId !== st.baseId) {
      const ok = setBase(pol.baseId);
      if (pol.toast) GD.ui && GD.ui.toast(pol.toast);
      return ok;
    }
    applyOverlaysWhenReady();
    if (pol.toast) GD.ui && GD.ui.toast(pol.toast);
    return true;
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
  // Hidden below zoom 6, and skipped when they sit within ~40 px of the pin or an earlier label.
  function updateLabels() {
    st.labelMarkers.forEach((m) => m.remove());
    st.labelMarkers = [];
    if (!st.map || !st.episode || st.active < 0) return;
    const s = st.episode.stories[st.active];
    if (!s || s.location.lat == null || !st.overlays.towns) return;
    if (st.map.getZoom() < TOWN_LABEL_MIN_ZOOM) return;
    const pinPt = st.map.project([s.location.lon, s.location.lat]);
    const blocked = pinPt ? [{ x: pinPt.x, y: pinPt.y }] : [];
    const nearest = insight(s.location.lat, s.location.lon, 4) || [];
    const candidates = nearest.map((p) => {
      const pt = st.map.project([p.lon, p.lat]);
      return pt ? { x: pt.x + 6, y: pt.y, name: p.name, lon: p.lon, lat: p.lat } : null;
    });
    pickTownLabelPoints(candidates, blocked, TOWN_LABEL_MIN_PX).forEach((p) => {
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

  function cameraOpts(kf, dur) {
    const reduce = GD.mapPointer && GD.mapPointer.reduceMotion ? GD.mapPointer.reduceMotion() : false;
    return {
      center: kf.center, zoom: kf.zoom, pitch: kf.pitch, bearing: kf.bearing,
      duration: reduce ? 0 : dur,
      easing: EASES[kf.ease] || EASES.cinematic,
      essential: false
    };
  }

  function jumpTo(kf) {
    if (!st.map) return;
    const run = () => st.map.jumpTo({ center: kf.center, zoom: kf.zoom, pitch: kf.pitch, bearing: kf.bearing });
    if (GD.mapPointer && GD.mapPointer.requestCamera) GD.mapPointer.requestCamera(run);
    else run();
  }

  function flyTo(kf, speedScale) {
    if (!st.map) return;
    const dur = Math.max(200, (kf.durationSec || 3) * 1000 * (speedScale || 1));
    const run = () => {
      const opts = cameraOpts(kf, dur);
      if (opts.duration === 0) st.map.jumpTo(opts);
      else st.map.flyTo(Object.assign({}, opts, { curve: 1.6 }));
    };
    if (GD.mapPointer && GD.mapPointer.requestCamera) GD.mapPointer.requestCamera(run);
    else run();
  }

  function panBy(dx, dy) {
    if (!st.map) return;
    try { st.map.panBy([dx, dy], { duration: (GD.mapPointer && GD.mapPointer.reduceMotion && GD.mapPointer.reduceMotion()) ? 0 : 200, essential: false }); } catch (e) { /* ignore */ }
  }

  function recenterOnSelection() {
    const sel = GD.mapPointer && GD.mapPointer.getSelection && GD.mapPointer.getSelection();
    const ep = st.episode || (GD.state && GD.state.episode);
    let ll = null;
    if (sel && sel.kind === "pin" && ep && ep.stories && ep.stories[sel.storyIdx] && ep.stories[sel.storyIdx].location) {
      const loc = ep.stories[sel.storyIdx].location;
      if (loc.lat != null) ll = [loc.lon, loc.lat];
    }
    if (!ll && ep && GD.state) {
      const s = ep.stories[GD.state.storyIdx];
      if (s && s.location && s.location.lat != null) ll = [s.location.lon, s.location.lat];
    }
    if (!ll) return;
    flyTo({ center: ll, zoom: Math.max(st.map.getZoom(), 8), pitch: st.map.getPitch(), bearing: st.map.getBearing(), durationSec: 0.8 });
  }

  function panControl() {
    return {
      onAdd(map) {
        const d = document.createElement("div");
        d.className = "maplibregl-ctrl gd-pan-ctrl";
        d.setAttribute("role", "group");
        d.setAttribute("aria-label", "Pan the map");
        const mk = (label, title, fn) => {
          const b = document.createElement("button");
          b.type = "button"; b.textContent = label; b.title = title; b.setAttribute("aria-label", title);
          b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
          return b;
        };
        const cell = (child) => {
          const slot = document.createElement("span");
          slot.className = "gd-pan-cell";
          if (child) slot.appendChild(child);
          d.appendChild(slot);
        };
        cell(null);
        cell(mk("↑", "Pan up", () => panBy(0, 80)));
        cell(null);
        cell(mk("←", "Pan left", () => panBy(-80, 0)));
        cell(mk("⊙", "Recenter on the selected or current story pin", recenterOnSelection));
        cell(mk("→", "Pan right", () => panBy(80, 0)));
        cell(null);
        cell(mk("↓", "Pan down", () => panBy(0, -80)));
        cell(null);
        this._map = map; this._el = d; return d;
      },
      onRemove() { if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el); this._map = null; }
    };
  }

  if (GD.yearClock && GD.yearClock.onChange && !st._yearClockBound) {
    st._yearClockBound = true;
    GD.yearClock.onChange(function () { applyDatedSat(); });
  }
  GD.globe = { st, HOME_VIEW, init, setBase, setOverlay, setEpisode, flyTo, jumpTo, panBy, recenterOnSelection, camera, insight, searchPlaces, haversine, bearingTo, towns, updateLabels, pickTownLabelPoints, pointsTooClose, TOWN_LABEL_MIN_ZOOM, TOWN_LABEL_MIN_PX, countryList, isLand, streetView, prepareForExport, endExport, isDrawingBufferPreserved, setRenderOptions, renderPrefs, applyDatedSat, refresh: () => { applyOverlaysWhenReady(); if (styleIsBound()) applyDatedSat(); } };
})();
