/* Layer registry: every base view and overlay declared once, with credit, terms and runtime flag.
   Declare first; unverified = not drawn. */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
  const OFM = '<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> © <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> ' + OSM;

  const EOX = 'Satellite: <a href="https://s2maps.eu" target="_blank" rel="noopener noreferrer">Sentinel-2 cloudless 2016 by EOX</a> (contains modified Copernicus Sentinel data 2016), CC BY 4.0';
  const BASES = [
    { id: "sat-hybrid", label: "Satellite + streets (EOX 2016 + OpenFreeMap, free)", kind: "hybrid", runtime: true, free: true,
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
    { id: "eox-region", label: "Washington, DC demo region (EOX 2016, offline pack)", default: false, runtime: true,
      credit: 'Satellite: <a href="https://s2maps.eu" target="_blank" rel="noopener noreferrer">Sentinel-2 cloudless 2016 by EOX</a> (contains modified Copernicus Sentinel data 2016), CC BY 4.0',
      tiles: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg", maxzoom: 14,
      bounds: [-77.12, 38.83, -76.94, 38.97],
      note: "A small downtown Washington, DC pack for the National Mall sample (approx. pin 38.89, -77.01). Built from EOX Sentinel-2 cloudless 2016 (CC BY 4.0) with tools/fetch_region_pack.py. Under the Python server it uses the local pack, then the disk cache, then EOX. If /tiles is missing, it uses EOX directly. Coverage is only that bbox; elsewhere the overlay is empty. Not shown at the same time as Blue Marble or the EOX hybrid base; turning this on switches to the offline globe." },
    { id: "ohm", label: "Historical map (OpenHistoricalMap) [UNKNOWN] — not wired yet", default: false, runtime: true, status: "unknown",
      reason: "OpenHistoricalMap period view: style and date filter are not wired yet.", credit: "" }
  ];

  const LOCAL_BLUEMARBLE = "/tiles/bluemarble/{z}/{x}/{y}.jpeg";
  const LOCAL_EOX = "/tiles/eox2016/{z}/{x}/{y}.jpg";
  const PACKS_API = "/api/packs";
  const PACKS_PROBE_TIMEOUT_MS = 2000;
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

  function resetLocalTileProxyProbe() {
    localProxy = false;
    localProxyPromise = null;
  }

  function probeLocalTileProxy(opts) {
    if (localProxyPromise) return localProxyPromise;
    const here = locHost();
    if (!here || typeof fetch !== "function") {
      localProxy = false;
      localProxyPromise = Promise.resolve(false);
      return localProxyPromise;
    }
    const timeoutMs = (opts && opts.timeoutMs != null) ? Number(opts.timeoutMs) : PACKS_PROBE_TIMEOUT_MS;
    const ctl = (typeof AbortController === "function") ? new AbortController() : null;
    let timer = null;
    if (ctl && timeoutMs >= 0 && isFinite(timeoutMs)) {
      timer = setTimeout(() => { try { ctl.abort(); } catch (e) { /* ignore */ } }, timeoutMs);
    }
    const optsFetch = { method: "GET", cache: "no-store" };
    if (ctl) optsFetch.signal = ctl.signal;
    localProxyPromise = fetch(PACKS_API, optsFetch)
      .then((r) => { localProxy = !!r.ok; return localProxy; })
      .catch(() => { localProxy = false; return false; })
      .finally(() => { if (timer) clearTimeout(timer); });
    return localProxyPromise;
  }

  function blueMarbleTiles(loc) {
    const L = OVERLAYS.find((o) => o.id === "bluemarble");
    const remote = L && L.tiles;
    const here = locHost(loc);
    if (localProxy && here) return here.origin + LOCAL_BLUEMARBLE;
    return remote;
  }

  function eoxTiles(loc) {
    const B = BASES.find((b) => b.id === "sat-hybrid");
    const remote = B && B.satTiles;
    const here = locHost(loc);
    if (localProxy && here) return here.origin + LOCAL_EOX;
    return remote;
  }

  function eoxRegionTiles(loc) {
    const L = OVERLAYS.find((o) => o.id === "eox-region");
    const remote = L && L.tiles;
    const here = locHost(loc);
    if (localProxy && here) return here.origin + LOCAL_EOX;
    return remote;
  }

  probeLocalTileProxy();


  const LIVE_IMAGERY_KEY = "globedesk.imagery.live";
  const EOX_NC_KEY = "globedesk.imagery.eoxNcAck";
  const GIBS_CREDIT = 'Imagery courtesy of <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener noreferrer">NASA Global Imagery Browse Services (GIBS)</a>, part of NASA EOSDIS. We acknowledge the use of imagery provided by services from NASA\'s GIBS.';
  const EOX_NC = 'Satellite: <a href="https://s2maps.eu" target="_blank" rel="noopener noreferrer">Sentinel-2 cloudless by EOX</a> (contains modified Copernicus Sentinel data), <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a>. Public commercial use of the 2018–2025 mosaics is not allowed.';
  let liveImagery = false;
  let eoxNcAck = false;
  let imageryDown = false;
  let imageryErrors = 0;
  const IMAGERY_ERROR_LIMIT = 6;
  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      liveImagery = localStorage.getItem(LIVE_IMAGERY_KEY) === "1";
      eoxNcAck = localStorage.getItem(EOX_NC_KEY) === "1";
    }
  } catch (e) { liveImagery = false; eoxNcAck = false; }

  function isLiveImagery() { return !!liveImagery; }

  function setLiveImagery(on) {
    if (on) { imageryDown = false; imageryErrors = 0; }
    liveImagery = !!on;
    try {
      if (typeof localStorage !== "undefined" && localStorage) localStorage.setItem(LIVE_IMAGERY_KEY, liveImagery ? "1" : "0");
    } catch (e) { /* private mode */ }
    if (GD.globe && GD.globe.applyDatedSat) GD.globe.applyDatedSat();
    if (GD.ui && GD.ui.syncDataYearUi) GD.ui.syncDataYearUi();
    return liveImagery;
  }

  function resetLiveImageryForTests() {
    liveImagery = false;
    eoxNcAck = false;
    imageryDown = false;
    imageryErrors = 0;
    try {
      if (typeof localStorage !== "undefined" && localStorage) {
        localStorage.removeItem(LIVE_IMAGERY_KEY);
        localStorage.removeItem(EOX_NC_KEY);
      }
    } catch (e) { /* ignore */ }
  }

  function eoxNonCommercialAck() { return !!eoxNcAck; }

  function setEoxNonCommercialAck(on) {
    eoxNcAck = !!on;
    try {
      if (typeof localStorage !== "undefined" && localStorage) localStorage.setItem(EOX_NC_KEY, eoxNcAck ? "1" : "0");
    } catch (e) { /* private mode */ }
    if (GD.globe && GD.globe.applyDatedSat) GD.globe.applyDatedSat();
    if (GD.ui && GD.ui.syncDataYearUi) GD.ui.syncDataYearUi();
    return eoxNcAck;
  }

  function eoxCredit(year) {
    if (year === 2016) return EOX;
    if (year >= 2018 && year <= 2025) {
      return 'Satellite: <a href="https://s2maps.eu" target="_blank" rel="noopener noreferrer">Sentinel-2 cloudless ' + year + " by EOX</a> (contains modified Copernicus Sentinel data " + year + '), <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a>. Not for public commercial use.';
    }
    return EOX;
  }

  function maxzoomForStatus(st) {
    if (!st) return 14;
    if (st.stack === "eox") return 14;
    if (st.stack === "weld" || (st.layerId && /WELD/.test(st.layerId))) return 12;
    if (st.stack === "gibs-daily") return 9;
    return 14;
  }

  function creditForStatus(st) {
    if (!st) return BASES[0].satCredit;
    if (st.stack === "eox") {
      const y = st.actual != null ? st.actual : st.requested;
      return eoxCredit(y);
    }
    const date = st.actual || st.requested;
    const layer = st.layerId ? (" " + st.layerId) : "";
    return GIBS_CREDIT + " Date " + date + "." + (layer ? " Layer:" + layer + "." : "");
  }

  function usesGibsUrl(url) {
    return !!(url && String(url).indexOf("gibs.earthdata.nasa.gov") >= 0);
  }


  function visibleBaseId(opts) {
    if (opts && opts.baseId) return opts.baseId;
    return (GD.globe && GD.globe.st && GD.globe.st.baseId) || "sat-hybrid";
  }

  function baseShowsDatedSatellite(id) {
    const b = BASES.find(function (x) { return x.id === id; });
    return !!(b && b.kind === "hybrid");
  }

  function datedSourceIdOf(evt) {
    if (!evt) return "";
    if (evt.sourceId) return String(evt.sourceId);
    if (evt.source && evt.source.id) return String(evt.source.id);
    const err = evt.error || null;
    if (err && err.sourceId) return String(err.sourceId);
    return "";
  }

  function noteDatedTileError(evt) {
    const err = evt && evt.error;
    const msg = (err && err.message) || "";
    if (/abort|cancel/i.test(msg)) return false;
    if (err && err.name === "TypeError" && /signal|bind/i.test(msg)) return false;
    if (!isLiveImagery() || imageryDown) return false;
    const sid = datedSourceIdOf(evt);
    if (sid && sid !== "sat" && sid !== "sat-prev" && sid !== "sat-next") return false;
    const spec = datedSatSpec();
    if (!spec || (!spec.requestsGibs && !(spec.tiles || spec.tilesPrev || spec.tilesNext))) return false;
    // Local pack URLs are not a down remote host.
    const urls = [spec.tiles, spec.tilesPrev, spec.tilesNext].filter(Boolean).join(" ");
    if (urls && urls.indexOf("/tiles/") >= 0 && urls.indexOf("gibs.earthdata") < 0 && urls.indexOf("tiles.maps.eox.at") < 0) return false;
    imageryErrors += 1;
    if (imageryErrors >= IMAGERY_ERROR_LIMIT) {
      imageryDown = true;
      setLiveImagery(false);
      if (GD.ui && GD.ui.toast) GD.ui.toast("Dated imagery is unreachable. It was switched off and will not be requested until you turn it back on.");
    }
    return true;
  }

  function datedSatSpec(opts) {
    opts = opts || {};
    const baseId = visibleBaseId(opts);
    if (!baseShowsDatedSatellite(baseId)) {
      const year = (GD.yearClock && GD.yearClock.getYear) ? GD.yearClock.getYear() : null;
      const b = BASES.find(function (x) { return x.id === baseId; }) || BASES.find(function (x) { return x.id === "offline"; });
      const credit = (b && (b.credit || (b.cite && b.cite.credit))) || "Made with Natural Earth";
      const name = baseId === "offline" ? "offline Natural Earth globe" : ((b && b.label) || "current base map");
      return {
        kind: "none",
        stack: "none",
        year: year,
        tiles: null,
        maxzoom: 0,
        credit: credit,
        requestsGibs: false,
        live: !!isLiveImagery(),
        status: {
          kind: "none",
          requested: year,
          actual: null,
          label: "",
          spoken: "The " + name + " is showing. It is not year-stamped imagery.",
          sources: []
        }
      };
    }
    const fallbackTiles = eoxTiles(opts.loc);
    const fallback = {
      kind: "recorded",
      stack: "eox",
      year: 2016,
      tiles: fallbackTiles,
      maxzoom: 14,
      credit: EOX,
      requestsGibs: false,
      live: false,
      status: {
        kind: "recorded",
        requested: (GD.yearClock && GD.yearClock.getYear) ? GD.yearClock.getYear() : 2016,
        actual: 2016,
        label: "EOX 2016 · dated imagery off",
        spoken: "Dated imagery is off. The satellite base is the recorded 2016 EOX Sentinel-2 cloudless mosaic, not year-stamped imagery.",
        sources: ["EOX 2016"],
        stack: "eox"
      }
    };
    if (!opts.forceLive && !isLiveImagery()) return fallback;
    const yc = GD.yearClock;
    if (!yc || !yc.defaultImageryStatus) return fallback;
    const ack = eoxNonCommercialAck();
    const st = yc.defaultImageryStatus(opts.year, opts.date, {
      nonCommercialAck: ack,
      showProjected: yc.isShowProjected ? yc.isShowProjected() : true
    });
    if (!st) return fallback;
    if (st.stack === "eox" && st.kind === "recorded" && (st.actual === 2016 || st.layerId === "s2cloudless_3857")) {
      return {
        kind: "recorded", stack: "eox", year: 2016, tiles: eoxTiles(opts.loc), maxzoom: 14,
        credit: EOX, requestsGibs: false, live: true, status: st
      };
    }
    if (st.kind === "projected") {
      const tilesPrev = (st.stack === "eox" && st.prev === 2016) ? eoxTiles(opts.loc) : st.prevTiles;
      const tilesNext = (st.stack === "eox" && st.next === 2016) ? eoxTiles(opts.loc) : st.nextTiles;
      const y = st.requested;
      let t = 0.5;
      if (st.prev != null && st.next != null && st.next !== st.prev) t = (y - st.prev) / (st.next - st.prev);
      else if (st.prev == null) t = 1;
      else t = 0;
      const lead = st.credit || st.spoken || ("PROJECTED view for " + y + ".");
      const credit = lead + " " + (st.stack === "eox" ? EOX : GIBS_CREDIT);
      return {
        kind: "projected", stack: st.stack, year: y,
        tilesPrev: tilesPrev || null, tilesNext: tilesNext || null,
        opacityPrev: tilesPrev ? (1 - t) : 0, opacityNext: tilesNext ? t : 0,
        maxzoom: maxzoomForStatus(st), credit: credit,
        requestsGibs: usesGibsUrl(tilesPrev) || usesGibsUrl(tilesNext),
        live: true, status: st
      };
    }
    if ((st.kind === "recorded" || st.kind === "recorded-nearest") && st.tiles) {
      return {
        kind: st.kind, stack: st.stack, year: st.requested, tiles: st.tiles,
        date: st.actual, layerId: st.layerId, maxzoom: maxzoomForStatus(st),
        credit: creditForStatus(st),
        requestsGibs: usesGibsUrl(st.tiles), live: true, status: st
      };
    }
    return fallback;
  }

  function eoxRegionBounds() { const L = OVERLAYS.find((o) => o.id === "eox-region"); return (L && L.bounds) ? L.bounds.slice() : null; }
  GD.layers = { BASES, OVERLAYS, base: (id) => BASES.find((b) => b.id === id), blueMarbleTiles, eoxTiles, eoxRegionTiles, eoxRegionBounds, datedSatSpec, isLiveImagery, setLiveImagery, resetLiveImageryForTests, eoxNonCommercialAck, setEoxNonCommercialAck, eoxCredit, noteDatedTileError, visibleBaseId, baseShowsDatedSatellite, IMAGERY_ERROR_LIMIT, LIVE_IMAGERY_KEY, EOX_NC_KEY, EOX_NC, GIBS_CREDIT, LOCAL_BLUEMARBLE, LOCAL_EOX, PACKS_PROBE_TIMEOUT_MS, probeLocalTileProxy, resetLocalTileProxyProbe, setLocalBlueMarbleProxy, usesLocalBlueMarbleProxy };
})();
