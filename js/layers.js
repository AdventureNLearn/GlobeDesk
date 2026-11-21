/* Layer registry: every base view and overlay declared once, with credit, terms and runtime flag.
   Declare first; unverified = not drawn. */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
  const OFM = '<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> © <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> ' + OSM;

  const EOX = 'Satellite: <a href="https://s2maps.eu" target="_blank" rel="noopener noreferrer">Sentinel-2 cloudless 2016 by EOX</a> (contains modified Copernicus Sentinel data 2016), CC BY 4.0';
  const BASES = [
    { id: "sat-hybrid", label: "Satellite + streets (EOX 2016 + OpenFreeMap, free) — CTD default", kind: "hybrid", runtime: true, free: true,
      satTiles: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg", satMaxzoom: 14,
      vector: "https://tiles.openfreemap.org/planet", glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      satCredit: EOX, vectorCredit: OFM,
      cite: { date: "imagery 2016", credit: "Sentinel-2 cloudless by EOX (modified Copernicus Sentinel data 2016) / OpenFreeMap / OpenMapTiles / OpenStreetMap contributors", license: "CC BY 4.0; ODbL" },
      credit: EOX + "; " + OFM, terms: "EOX 2016 layer is CC BY 4.0 (attribution required, fair use, no SLA). OpenFreeMap public tiles are free, no key, provided as-is with no uptime guarantee (see openfreemap.org/tos).", streetLevel: true,
      note: "Satellite is ~10 m imagery; at street zoom the OSM roads and 3D buildings carry the detail." },
    { id: "offline", label: "Offline globe (bundled Natural Earth)", kind: "local", runtime: false, free: true,
      cite: { date: "n/a", credit: "Natural Earth", license: "Public domain" },
      credit: "Made with Natural Earth (public domain)", terms: "Public domain", streetLevel: false,
      note: "Works with no network. Coastlines, countries and towns only; no streets." },
    { id: "ofm-dark", label: "Street map, dark (OpenFreeMap)", kind: "style", runtime: true, free: true,
      style: "https://tiles.openfreemap.org/styles/dark", cite: { date: "live", credit: "OpenFreeMap / OpenMapTiles / OpenStreetMap contributors", license: "ODbL" }, credit: OFM, terms: "Free, no key. ODbL data.", streetLevel: true },
    { id: "ofm-liberty", label: "Street map, light (OpenFreeMap Liberty)", kind: "style", runtime: true, free: true,
      style: "https://tiles.openfreemap.org/styles/liberty", cite: { date: "live", credit: "OpenFreeMap / OpenMapTiles / OpenStreetMap contributors", license: "ODbL" }, credit: OFM, terms: "Free, no key. ODbL data.", streetLevel: true },
    { id: "ofm-positron", label: "Street map, paper (OpenFreeMap Positron)", kind: "style", runtime: true, free: true,
      style: "https://tiles.openfreemap.org/styles/positron", cite: { date: "live", credit: "OpenFreeMap / OpenMapTiles / OpenStreetMap contributors", license: "ODbL" }, credit: OFM, terms: "Free, no key. ODbL data.", streetLevel: true },
    { id: "maptiler-sat", label: "Satellite (MapTiler, OPTIONAL PAID key)", kind: "style", runtime: true, free: false, needsKey: "maptiler",
      styleTemplate: "https://api.maptiler.com/maps/hybrid/style.json?key={KEY}",
      cite: { date: "[UNKNOWN]", credit: "MapTiler / OpenStreetMap contributors", license: "MapTiler terms; ODbL" },
      credit: '© <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> ' + OSM,
      terms: "Your own MapTiler account and key; their terms apply.", streetLevel: true }
  ];

  const OVERLAYS = [
    { id: "countries", label: "Country outlines (bundled)", default: true, runtime: false, credit: "Natural Earth (public domain)" },
    { id: "highlight", label: "Focus-region glow (country / polygon)", default: true, runtime: false, credit: "Natural Earth outlines (public domain) or your polygon" },
    { id: "countryLabels", label: "Flat white country labels (online styles; needs glyphs)", default: true, runtime: true, credit: "Names: Natural Earth; font: OpenFreeMap glyphs" },
    { id: "towns", label: "Town dots (bundled gazetteer)", default: true, runtime: false, credit: "Natural Earth (public domain)" },
    { id: "pins", label: "Story pins", default: true, runtime: false, credit: "Episode data" },
    { id: "arcs", label: "Story-to-story arcs", default: true, runtime: false, credit: "Computed from episode" },
    { id: "rings", label: "Range rings (10 / 50 / 100 km)", default: true, runtime: false, credit: "Computed (great-circle)" },
    { id: "buildings", label: "3D buildings (street styles)", default: true, runtime: true, credit: OFM },
    { id: "terrain", label: "3D terrain + hillshade (from zoom 11, opt-in)", default: false, runtime: true,
      credit: 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener noreferrer">Tilezen/Mapzen terrain tiles on AWS Open Data</a> (see README for full source credit)',
      tiles: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png" },
    { id: "bluemarble", label: "NASA Blue Marble imagery (local pack, then GIBS)", default: false, runtime: true,
      credit: 'Imagery: <a href="https://earthobservatory.nasa.gov/features/BlueMarble" target="_blank" rel="noopener noreferrer">NASA Blue Marble</a> (August 2004, shaded relief and bathymetry; Earth Observatory / MODIS, public domain), via <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener noreferrer">NASA GIBS</a>',
      tiles: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg", maxzoom: 8,
      note: "When the Python server is running, uses a local z0–8 MBTiles pack under ./globedesk-data if present, then a size-capped disk cache, then GIBS. If /tiles is unavailable, this overlay uses NASA GIBS directly. Not shown at the same time as the EOX satellite base; turning this on switches to the offline globe." },
    { id: "ohm", label: "Historical map (OpenHistoricalMap) [UNKNOWN] — not wired yet", default: false, runtime: true, status: "unknown",
      reason: "OpenHistoricalMap period view: style and date filter are not wired yet.", credit: "" }
  ];

  const LOCAL_BLUEMARBLE = "/tiles/bluemarble/{z}/{x}/{y}.jpeg";
  const PACKS_API = "/api/packs";
  let localProxy = false;
  let localProxyPromise = null;

  function locHost(loc) {
    try {
      const here = loc || (typeof location !== "undefined" ? location : null);
      return here && /^https?:$/.test(here.protocol) && (here.hostname === "127.0.0.1" || here.hostname === "localhost") ? here : null;
    } catch (e) { return null; }
  }

  function usesLocalBlueMarbleProxy() { return localProxy; }

  function setLocalBlueMarbleProxy(on) {
    localProxy = !!on;
    if (!localProxyPromise) localProxyPromise = Promise.resolve(localProxy);
  }

  function probeLocalTileProxy() {
    if (localProxyPromise) return localProxyPromise;
    const here = locHost();
    if (!here || typeof fetch !== "function") {
      localProxy = false;
      localProxyPromise = Promise.resolve(false);
      return localProxyPromise;
    }
    localProxyPromise = fetch(PACKS_API, { method: "GET", cache: "no-store" })
      .then((r) => { localProxy = !!r.ok; return localProxy; })
      .catch(() => { localProxy = false; return false; });
    return localProxyPromise;
  }

  function blueMarbleTiles(loc) {
    const L = OVERLAYS.find((o) => o.id === "bluemarble");
    const remote = L && L.tiles;
    const here = locHost(loc);
    if (localProxy && here) return here.origin + LOCAL_BLUEMARBLE;
    return remote;
  }

  probeLocalTileProxy();

  GD.layers = { BASES, OVERLAYS, base: (id) => BASES.find((b) => b.id === id), blueMarbleTiles, LOCAL_BLUEMARBLE, probeLocalTileProxy, setLocalBlueMarbleProxy, usesLocalBlueMarbleProxy };
})();
