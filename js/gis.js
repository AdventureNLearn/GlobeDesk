/* Official-GIS connector. A declared registry, health parser, and skip-on-down
   behaviour. Live GIS is off by default and only the user can opt in. No
   geocoding. Official overlays stay off until the user opts in. Unknown entries stay undrawn and
   store no URL. A down host is a skip, not a replacement dataset. */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const PATH = "data/gis-registry.json";
  const U = "[UNKNOWN]";
  const LIVE_KEY = "globedesk.gis.live";
  const GIS_KINDS = ["raster", "raster-dem", "geojson-query", "local", "none"];
  const GIS_STATUS = ["working", "unknown"];
  const GIS_GROUPS = ["base", "terrain", "boundary", "overlay", "local"];
  const PERSONAL_FIELD = /^(owner|address|phone|email|valuation|street|occupant)([A-Z_].*)?$/i;

  const state = {
    doc: null,
    layers: [],
    errors: [],
    loaded: false,
    liveEnabled: false,
    health: {},
    overlaysOn: {},
    inflight: {},
    lastFeatures: {},
    tileErrors: {}
  };
  const TILE_ERROR_LIMIT = 6;

  const MOVEEND_DEBOUNCE_MS = 250;
  let moveendTimer = null;
  let moveendWaiters = [];

  function clearMoveend() {
    if (moveendTimer != null && typeof clearTimeout === "function") {
      try { clearTimeout(moveendTimer); } catch (e) { /* ignore */ }
    }
    moveendTimer = null;
    const waiters = moveendWaiters;
    moveendWaiters = [];
    waiters.forEach((w) => { try { w([]); } catch (e) { /* ignore */ } });
  }

  function empty() {
    clearMoveend();
    Object.keys(state.inflight).forEach((id) => abortInflight(id));
    state.doc = null;
    state.layers = [];
    state.errors = [];
    state.loaded = false;
    state.health = {};
    state.overlaysOn = {};
    state.lastFeatures = {};
    state.tileErrors = {};
  }

  function personalFieldName(k) {
    return PERSONAL_FIELD.test(String(k || ""));
  }

  function hasHttpString(v) {
    if (typeof v === "string") return /https?:\/\//i.test(v);
    if (!v || typeof v !== "object") return false;
    if (Array.isArray(v)) return v.some(hasHttpString);
    return Object.keys(v).some((k) => hasHttpString(v[k]));
  }

  function scanPersonalKeys(obj, path, errs) {
    if (!obj || typeof obj !== "object") return;
    Object.keys(obj).forEach((k) => {
      if (personalFieldName(k)) errs.push(path + ": must not carry an owner, address, phone, email, or valuation field");
      const v = obj[k];
      if (v && typeof v === "object") scanPersonalKeys(v, path, errs);
    });
  }

  function isHttpsUrl(s) {
    if (typeof s !== "string" || !s || /\s/.test(s)) return false;
    if (GD.schema && GD.schema.httpsOk) return GD.schema.httpsOk(s);
    try {
      const u = new URL(s);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch (e) { return false; }
  }

  function validateLayer(layer, i, errs) {
    const p = "gis layer " + (i + 1);
    if (!layer || typeof layer !== "object" || Array.isArray(layer)) { errs.push(p + " must be an object"); return; }
    scanPersonalKeys(layer, p, errs);
    if (!layer.id || typeof layer.id !== "string" || !String(layer.id).trim()) errs.push(p + ": id missing");
    if (!layer.label || typeof layer.label !== "string" || !String(layer.label).trim()) errs.push(p + ": label missing");
    if (GIS_GROUPS.indexOf(layer.group) < 0) errs.push(p + ".group must be " + GIS_GROUPS.join("|"));
    if (GIS_KINDS.indexOf(layer.kind) < 0) errs.push(p + ".kind must be " + GIS_KINDS.join("|"));
    if (GIS_STATUS.indexOf(layer.status) < 0) errs.push(p + ".status must be working|unknown");
    if (typeof layer.runtime !== "boolean") errs.push(p + ": runtime missing");
    const unknown = layer.status === "unknown" || layer.kind === "none";
    if (unknown) {
      if (!layer.reason || typeof layer.reason !== "string" || !String(layer.reason).trim()) {
        errs.push(p + ": an unknown layer needs a written reason");
      }
      ["sourceUrl", "queryUrl", "termsUrl", "creditUrl", "tiles", "checked"].forEach((k) => {
        if (layer[k] != null) errs.push(p + ": an unknown layer must not store " + k);
      });
      if (hasHttpString(layer)) errs.push(p + ": an unknown layer must not store a URL");
      return;
    }
    if (typeof layer.credit !== "string" || !String(layer.credit).trim()) errs.push(p + ": a working layer needs credit");
    if (typeof layer.terms !== "string" || !String(layer.terms).trim()) errs.push(p + ": a working layer needs terms");
    if (layer.runtime) {
      if (!isHttpsUrl(layer.sourceUrl) && !isHttpsUrl(layer.tiles) && !isHttpsUrl(layer.queryUrl)) {
        errs.push(p + ": a working live layer needs an https source, tiles, or query URL");
      }
      if (layer.sourceUrl && !isHttpsUrl(layer.sourceUrl)) errs.push(p + ": sourceUrl must be https");
      if (layer.tiles && !isHttpsUrl(layer.tiles) && String(layer.tiles).indexOf("{") < 0) errs.push(p + ": tiles must be https");
      if (layer.termsUrl && !isHttpsUrl(layer.termsUrl)) errs.push(p + ": termsUrl must be https");
      if (layer.creditUrl && !isHttpsUrl(layer.creditUrl)) errs.push(p + ": creditUrl must be https");
      if (layer.minzoom == null && layer.minZoom == null) { /* min zoom optional for some rasters; query needs it below */ }
    }
    if (layer.kind === "geojson-query") {
      if (!isHttpsUrl(layer.queryUrl)) errs.push(p + ": a query layer needs an https queryUrl");
      if (!layer.idField || typeof layer.idField !== "string") errs.push(p + ": a query layer needs one non-person id field");
      else if (personalFieldName(layer.idField)) errs.push(p + ": idField must not be a person, owner, address, phone, email, or valuation field");
      if (layer.maxFeatures == null || !isFinite(Number(layer.maxFeatures)) || Number(layer.maxFeatures) < 1) {
        errs.push(p + ": a query layer needs a hard maxFeatures cap");
      }
      const z = layer.minzoom != null ? layer.minzoom : layer.minZoom;
      if (z == null || !isFinite(Number(z))) errs.push(p + ": a query layer needs a min zoom");
    }
  }

  function validateRegistry(doc) {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return ["Not an object"];
    const errs = [];
    scanPersonalKeys(doc, "gis registry", errs);
    if (doc.schema !== "globedesk.gis-registry/1") errs.push("schema must be globedesk.gis-registry/1");
    if (!Array.isArray(doc.layers)) errs.push("layers[] missing");
    else {
      const seen = {};
      doc.layers.forEach((layer, i) => {
        validateLayer(layer, i, errs);
        if (layer && layer.id) {
          if (seen[layer.id]) errs.push("gis layer " + (i + 1) + ": duplicate id");
          seen[layer.id] = true;
        }
      });
    }
    return errs;
  }

  function hostnamesFrom(doc) {
    const hosts = [];
    const seen = {};
    function add(url) {
      if (typeof url !== "string") return;
      const raw = url.replace(/\{[^}]+\}/g, "0");
      if (!/^https:\/\//i.test(raw)) return;
      try {
        const h = new URL(raw).hostname.toLowerCase();
        if (h && !seen[h]) { seen[h] = true; hosts.push(h); }
      } catch (e) { /* ignore bad URL */ }
    }
    ((doc && doc.layers) || []).forEach((l) => {
      if (!l || l.status !== "working") return;
      ["sourceUrl", "queryUrl", "termsUrl", "creditUrl", "tiles"].forEach((k) => add(l[k]));
    });
    hosts.sort();
    return hosts;
  }

  function cspHosts() { return hostnamesFrom(state.doc); }

  function parseGisServiceBody(body, contentType, httpStatus) {
    const status = httpStatus == null ? 200 : Number(httpStatus);
    const type = String(contentType || "");
    const text = body == null ? "" : String(body);
    if (isFinite(status) && status >= 400) return { ok: false, reason: "HTTP " + status };
    let json = null;
    try { json = JSON.parse(text); } catch (e) { json = null; }
    if (json && typeof json === "object" && !Array.isArray(json)) {
      if (Object.prototype.hasOwnProperty.call(json, "error") && json.error != null) {
        if (typeof json.error === "object" && !Array.isArray(json.error)) {
          const code = json.error.code != null ? json.error.code : "";
          const raw = json.error.message;
          const msg = (raw != null && String(raw).trim()) ? String(raw) : "no message";
          return { ok: false, reason: "ArcGIS error " + code + ": " + msg };
        }
        return { ok: false, reason: "ArcGIS error: " + String(json.error) };
      }
      if (json.status != null && String(json.status).toLowerCase() === "error") {
        return { ok: false, reason: "service status: error" };
      }
      if (Object.keys(json).length === 0) return { ok: false, reason: "empty JSON object" };
      return { ok: true };
    }
    const looksHtml = /html/i.test(type) || /^\s*</.test(text);
    if (looksHtml) {
      if (/Could not access any server machines/i.test(text)) return { ok: false, reason: "Web Adaptor" };
      if (/not started/i.test(text)) return { ok: false, reason: "service not started" };
      const title = ((text.match(/<title[^>]*>([^<]*)/i) || [])[1] || "").trim() || "untitled";
      return { ok: false, reason: "HTML error page (" + title + ")" };
    }
    return { ok: false, reason: "non-JSON response (" + (type || "unknown") + ", " + text.length + " bytes)" };
  }

  function serviceMetadataUrl(sourceUrl) {
    const s = String(sourceUrl || "");
    if (!s) return "";
    return s.indexOf("?") >= 0 ? s + "&f=json" : s + "?f=json";
  }

  function arcgisExport(service, layers) {
    const show = layers ? "&layers=show:" + layers : "";
    return String(service).replace(/\/$/, "") + "/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image" + show;
  }

  function wmsGetMap(service, layer) {
    const sep = String(service).indexOf("?") >= 0 ? "&" : "?";
    return service + sep + "SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=" + encodeURIComponent(layer) + "&STYLES=&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true";
  }


  const TIGER_FOLDER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/";

  function rasterTileUrl(layer, opts) {
    opts = opts || {};
    if (!layer || layer.kind !== "raster" || layer.status !== "working") return null;
    const yc = (typeof GD !== "undefined" && GD.yearClock) || null;
    const y = opts.year != null ? opts.year : (yc && yc.getYear ? yc.getYear() : null);
    if (layer.yearKind === "tiger") {
      const st = yc && yc.statusFor ? yc.statusFor({ kind: "tiger", id: layer.id }, y) : null;
      if (st && st.kind === "unavailable") return null;
      const vintage = (st && st.actual) || null;
      if (vintage) return arcgisExport(TIGER_FOLDER + vintage + "/MapServer", layer.showLayers || "0,1");
      return layer.tiles || null;
    }
    if ((layer.yearKind === "current-snapshot" || layer.yearKind === "current-weather") && yc && yc.statusFor && y != null && !opts.ignoreYear) {
      const st = yc.statusFor({ kind: layer.yearKind, id: layer.id }, y);
      if (st && st.kind === "unavailable") return null;
    }
    if (layer.tiles) return layer.tiles;
    if (layer.wmsLayer && layer.sourceUrl) return wmsGetMap(layer.sourceUrl, layer.wmsLayer);
    return null;
  }

  function syncMap(map) {
    map = map || (GD.globe && GD.globe.st && GD.globe.st.map) || null;
    if (!map || !map.getSource) return;
    state.layers.forEach(function (l) {
      if (!l || l.kind !== "raster") return;
      const sid = "gd-gis-" + l.id;
      const want = !!(state.liveEnabled && state.overlaysOn[l.id] && l.status === "working" && !layerIsDown(l));
      const tiles = want ? rasterTileUrl(l) : null;
      const z0 = minZoomOf(l);
      try {
        if (tiles) {
          const src = map.getSource(sid);
          if (src && src.setTiles) {
            try { src.setTiles([tiles]); } catch (e) { /* TypeError during a failed load */ }
            if (src.attribution == null || src.attribution !== (l.credit || "")) {
              try { src.attribution = l.credit || ""; } catch (e) { /* ignore */ }
            }
          } else if (!src) {
            map.addSource(sid, { type: "raster", tiles: [tiles], tileSize: 256, minzoom: z0, attribution: l.credit || "" });
            const before = map.getLayer("gd-pins-halo") ? "gd-pins-halo" : (map.getLayer("gd-pins") ? "gd-pins" : undefined);
            if (!map.getLayer(sid)) map.addLayer({ id: sid, type: "raster", source: sid, minzoom: z0, paint: { "raster-opacity": 0.82 } }, before);
          }
          if (map.getLayer(sid)) map.setLayoutProperty(sid, "visibility", "visible");
        } else {
          if (map.getLayer(sid)) {
            try { map.removeLayer(sid); } catch (e) { /* TypeError during a failed load */ }
          }
          if (map.getSource(sid)) {
            try { map.removeSource(sid); } catch (e) { /* TypeError during a failed load */ }
          }
        }
      } catch (e) { /* style not ready or TypeError during a failed load */ }
    });
  }

  function featureQueryUrl(layer, bounds) {
    if (!layer || personalFieldName(layer.idField)) return { error: "query must not carry an owner, address, phone, email, or valuation field" };
    if (!layer.queryUrl || !layer.idField) return { error: "query layer needs queryUrl and one id field" };
    const box = (bounds || [-180, -85, 180, 85]).map(Number);
    const w = Math.max(-180, Math.min(180, Number(box[0].toFixed(5))));
    const s = Math.max(-85, Math.min(85, Number(box[1].toFixed(5))));
    const e = Math.max(-180, Math.min(180, Number(box[2].toFixed(5))));
    const n = Math.max(-85, Math.min(85, Number(box[3].toFixed(5))));
    const p = new URLSearchParams({
      where: "1=1",
      geometry: w + "," + s + "," + e + "," + n,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: String(layer.idField),
      returnGeometry: "true",
      outSR: "4326",
      geometryPrecision: "6",
      resultRecordCount: String(layer.maxFeatures || 200),
      f: "geojson"
    });
    const url = layer.queryUrl + (layer.queryUrl.indexOf("?") >= 0 ? "&" : "?") + p.toString();
    if (/resultOffset=/i.test(url)) return { error: "query must not page with resultOffset" };
    return { url: url };
  }

  function dropAttributes(fc) {
    const src = (fc && fc.features) || [];
    return {
      type: "FeatureCollection",
      features: src.map((f) => ({
        type: "Feature",
        id: f && f.id,
        geometry: f && f.geometry ? f.geometry : null,
        properties: {}
      }))
    };
  }

  function minZoomOf(layer) {
    const z = layer && (layer.minzoom != null ? layer.minzoom : layer.minZoom);
    return z == null ? 0 : Number(z);
  }

  function byId(id) {
    return state.layers.find((l) => l && l.id === id) || null;
  }

  function yearStatusFor(layer) {
    const yc = (typeof GD !== "undefined" && GD.yearClock) || null;
    if (!layer || !yc || !yc.statusFor) return null;
    const kind = layer.yearKind || layer.kind;
    if (kind !== "tiger" && kind !== "current-snapshot" && kind !== "current-weather") return null;
    const y = yc.getYear ? yc.getYear() : null;
    return yc.statusFor({ kind: kind, id: layer.id }, y);
  }

  function tokenFor(layer) {
    if (!layer) return "skipped";
    if (layer.status === "unknown" || layer.kind === "none") return "unknown";
    if (!state.liveEnabled && layer.runtime) return "off";
    const ys = yearStatusFor(layer);
    if (ys && ys.kind === "unavailable") return "unavailable";
    const h = state.health[layer.id];
    if (h && h.token) return h.token;
    if (!state.overlaysOn[layer.id]) return "off";
    return "off";
  }

  function setHealth(id, token, reason) {
    state.health[id] = { token: token, reason: reason || "", at: Date.now() };
  }

  function listed(args) {
    const storyId = args && args.storyId;
    let wanted = null;
    if (storyId) {
      const stories = ((GD.state && GD.state.episode && GD.state.episode.stories) || [])
        .concat(((GD.newsdesk && GD.newsdesk.state && GD.newsdesk.state.feed && GD.newsdesk.state.feed.episode && GD.newsdesk.state.feed.episode.stories) || []));
      const st = stories.find((s) => s && (s.id === storyId || s.slug === storyId));
      wanted = st && Array.isArray(st.gisOverlayIds) ? st.gisOverlayIds : [];
    }
    const rows = [];
    state.layers.forEach((l) => {
      if (wanted && wanted.indexOf(l.id) < 0) return;
      const token = tokenFor(l);
      rows.push({
        id: l.id,
        label: l.label,
        status: token,
        minZoom: minZoomOf(l),
        credit: l.credit || "",
        reason: (l.reason || (state.health[l.id] && state.health[l.id].reason) || (token === "unknown" ? U : ""))
      });
    });
    if (wanted) {
      wanted.forEach((id) => {
        if (rows.some((r) => r.id === id)) return;
        rows.push({ id: id, label: id, status: "unknown", minZoom: 0, credit: "", reason: U });
      });
    }
    return { liveEnabled: !!state.liveEnabled, counts: { layers: rows.length }, layers: rows };
  }

  function gisStatus(args) {
    const id = args && args.id;
    if (!id) return { ok: false, error: "gisStatus requires id" };
    const layer = byId(id);
    if (!layer) return { ok: false, error: "unknown gis layer: " + id };
    const token = tokenFor(layer);
    const reason = (state.health[id] && state.health[id].reason) || layer.reason || "";
    return { ok: true, result: { id: id, status: token, reason: reason } };
  }

  function readStoredLive() {
    try {
      if (typeof localStorage !== "undefined" && localStorage && localStorage.getItem(LIVE_KEY) === "1") return true;
    } catch (e) { /* private mode */ }
    return false;
  }

  function writeStoredLive(on) {
    try {
      if (typeof localStorage === "undefined" || !localStorage) return;
      if (on) localStorage.setItem(LIVE_KEY, "1");
      else localStorage.removeItem(LIVE_KEY);
    } catch (e) { /* private mode */ }
  }

  function setLiveEnabled(on) {
    state.liveEnabled = !!on;
    writeStoredLive(state.liveEnabled);
    if (!state.liveEnabled) {
      Object.keys(state.inflight).forEach(abortInflight);
      state.layers.forEach((l) => {
        if (l && l.runtime && l.status === "working") {
          state.overlaysOn[l.id] = false;
          setHealth(l.id, "off", "");
        }
      });
    }
    syncMap();
    return { ok: true, result: { liveEnabled: state.liveEnabled } };
  }

  function isLiveEnabled() { return !!state.liveEnabled; }

  function setOverlay(args) {
    const id = args && args.id;
    const on = !!(args && args.on);
    if (!id) return { ok: false, error: "setOverlay requires id" };
    const layer = byId(id);
    if (!layer) return null;
    if (layer.status === "unknown" || layer.kind === "none") {
      state.overlaysOn[id] = false;
      setHealth(id, "unknown", layer.reason || U);
      return { ok: false, error: "skipped: " + (layer.reason || U), reason: "skipped", result: { id: id, on: false, status: "unknown" } };
    }
    if (on && !state.liveEnabled && layer.runtime) {
      state.overlaysOn[id] = false;
      setHealth(id, "off", "live GIS is off");
      return { ok: false, error: "live GIS is off", reason: "off", result: { id: id, on: false, status: "off" } };
    }
    const last = state.health[id];
    if (on && last && (last.token === "error" || last.token === "skipped")) setHealth(id, "off", "");
    if (on) state.tileErrors[id] = 0;
    state.overlaysOn[id] = on;
    if (!on) setHealth(id, "off", "");
    syncMap();
    return { ok: true, result: { id: id, on: on, status: tokenFor(layer) } };
  }

  function abortInflight(id) {
    const ctl = state.inflight[id];
    if (ctl && ctl.abort) { try { ctl.abort(); } catch (e) { /* ignore */ } }
    delete state.inflight[id];
  }

  function applyQueryResult(layer, parsed, body) {
    if (!parsed.ok) {
      setHealth(layer.id, "error", parsed.reason || U);
      state.overlaysOn[layer.id] = false;
      return { ok: false, skipped: true, reason: parsed.reason || U, features: state.lastFeatures[layer.id] || null };
    }
    let json = null;
    try { json = JSON.parse(body); } catch (e) { json = null; }
    const clean = dropAttributes(json && json.type === "FeatureCollection" ? json : { type: "FeatureCollection", features: [] });
    state.lastFeatures[layer.id] = clean;
    setHealth(layer.id, "ok", "ok:" + clean.features.length);
    return { ok: true, result: { id: layer.id, status: "ok:" + clean.features.length, features: clean } };
  }

  function layerIsDown(layer) {
    const h = layer && state.health[layer.id];
    return !!(h && (h.token === "error" || h.token === "skipped"));
  }

  function refreshLayer(layer, view, fetcher) {
    const zoom = view && view.zoom != null ? Number(view.zoom) : 0;
    const bounds = (view && view.bounds) || [-180, -85, 180, 85];
    if (layerIsDown(layer)) {
      const h = state.health[layer.id];
      return Promise.resolve({ ok: false, skipped: true, reason: (h && h.reason) || U, features: state.lastFeatures[layer.id] || null });
    }
    abortInflight(layer.id);
    if (layer.status === "unknown" || layer.kind === "none") {
      setHealth(layer.id, "unknown", layer.reason || U);
      return Promise.resolve({ ok: false, skipped: true, reason: layer.reason || U });
    }
    if (!state.overlaysOn[layer.id]) {
      setHealth(layer.id, "off", "");
      return Promise.resolve({ ok: true, result: { id: layer.id, status: "off" } });
    }
    if (!state.liveEnabled && layer.runtime) {
      setHealth(layer.id, "off", "live GIS is off");
      return Promise.resolve({ ok: false, skipped: true, reason: "live GIS is off" });
    }
    if (zoom < minZoomOf(layer)) {
      delete state.lastFeatures[layer.id];
      setHealth(layer.id, "below-minzoom", "Shows from zoom " + minZoomOf(layer));
      return Promise.resolve({ ok: true, result: { id: layer.id, status: "below-minzoom" } });
    }
    if (layer.kind !== "geojson-query") {
      if (layer.kind === "raster" && !rasterTileUrl(layer)) {
        const ys = yearStatusFor(layer);
        const token = (ys && ys.kind === "unavailable") ? "unavailable" : "off";
        setHealth(layer.id, token, (ys && (ys.label || ys.spoken)) || "");
        return Promise.resolve({ ok: true, result: { id: layer.id, status: token } });
      }
      if (!state.health[layer.id] || state.health[layer.id].token === "off") setHealth(layer.id, "loading", "");
      return Promise.resolve({ ok: true, result: { id: layer.id, status: tokenFor(layer) } });
    }
    const built = featureQueryUrl(layer, bounds);
    if (built.error) {
      setHealth(layer.id, "error", built.error);
      return Promise.resolve({ ok: false, skipped: true, reason: built.error });
    }
    setHealth(layer.id, "loading", "");
    const get = fetcher || (typeof fetch === "function" ? fetch : null);
    if (!get) {
      setHealth(layer.id, "error", U);
      return Promise.resolve({ ok: false, skipped: true, reason: U });
    }
    const ctl = (typeof AbortController === "function") ? new AbortController() : null;
    if (ctl) state.inflight[layer.id] = ctl;
    const opts = { credentials: "omit", cache: "no-store" };
    if (ctl) opts.signal = ctl.signal;
    return Promise.resolve(get(built.url, opts)).then((res) => {
      const status = res && res.status != null ? res.status : 0;
      const type = (res && res.headers && res.headers.get) ? (res.headers.get("content-type") || "") : "";
      return Promise.resolve(res && res.text ? res.text() : "").then((text) => {
        const parsed = parseGisServiceBody(text, type, status);
        return applyQueryResult(layer, parsed, text);
      });
    }).catch((e) => {
      if (e && e.name === "AbortError") return { ok: false, skipped: true, reason: "aborted" };
      const reason = (e && e.message) ? String(e.message) : U;
      setHealth(layer.id, "error", reason);
      state.overlaysOn[layer.id] = false;
      return { ok: false, skipped: true, reason: reason, features: state.lastFeatures[layer.id] || null };
    }).finally(() => { delete state.inflight[layer.id]; });
  }

  function refresh(view, fetcher) {
    const jobs = state.layers.filter((l) => l && state.overlaysOn[l.id]).map((l) => refreshLayer(l, view || {}, fetcher));
    return Promise.all(jobs);
  }

  function currentViewFromMap() {
    try {
      const map = (typeof window !== "undefined" && window.GD && window.GD.globe && window.GD.globe.st && window.GD.globe.st.map) || null;
      if (!map) return {};
      const zoom = map.getZoom ? Number(map.getZoom()) : 0;
      const view = { zoom: isFinite(zoom) ? zoom : 0 };
      if (map.getBounds) {
        const b = map.getBounds();
        if (b && typeof b.getWest === "function") {
          view.bounds = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
        }
      }
      return view;
    } catch (e) {
      return {};
    }
  }

  function layerWantsMoveendRefresh(l) {
    return !!(l && state.overlaysOn[l.id] && l.runtime && l.status !== "unknown" && l.kind !== "none" && !layerIsDown(l));
  }


  function sourceIdOf(evt) {
    if (!evt) return "";
    if (evt.sourceId) return String(evt.sourceId);
    if (evt.source && evt.source.id) return String(evt.source.id);
    const err = evt.error || null;
    if (err && err.sourceId) return String(err.sourceId);
    const msg = (err && err.message) || (evt.message) || "";
    const m = /source[:\s]+(gd-gis-[\w-]+)\b/i.exec(msg);
    return m ? m[1] : "";
  }

  function noteTileError(evt) {
    const err = evt && evt.error;
    const msg = (err && err.message) || "";
    if (/abort|cancel/i.test(msg)) return false;
    if (err && err.name === "TypeError" && /signal|bind/i.test(msg)) return false;
    const sid = sourceIdOf(evt);
    if (!sid || sid.indexOf("gd-gis-") !== 0) return false;
    const id = sid.slice("gd-gis-".length);
    const layer = byId(id);
    if (!layer || layer.kind !== "raster") return false;
    if (layerIsDown(layer)) return true;
    state.tileErrors[id] = (state.tileErrors[id] || 0) + 1;
    if (state.tileErrors[id] >= TILE_ERROR_LIMIT) {
      setHealth(id, "error", "host is down");
      state.overlaysOn[id] = false;
      try { syncMap(); } catch (e) { /* ignore */ }
      const label = (layer && layer.label) || id;
      if (GD.ui && GD.ui.toast) GD.ui.toast(label + " is unreachable. The overlay was switched off.");
    }
    return true;
  }

  function noteSourceLoaded(evt) {
    const sid = sourceIdOf(evt);
    if (!sid || sid.indexOf("gd-gis-") !== 0) return false;
    if (evt && evt.isSourceLoaded === false) return false;
    const id = sid.slice("gd-gis-".length);
    const layer = byId(id);
    if (!layer || layerIsDown(layer) || !state.overlaysOn[id]) return false;
    setHealth(id, "ok", "");
    state.tileErrors[id] = 0;
    return true;
  }

  function onMapMoveEnd(fetcher) {
    if (!state.liveEnabled) return Promise.resolve([]);
    const wanted = state.layers.some(layerWantsMoveendRefresh);
    if (!wanted && !moveendWaiters.length && moveendTimer == null) return Promise.resolve([]);
    return new Promise((resolve) => {
      moveendWaiters.push(resolve);
      if (moveendTimer != null && typeof clearTimeout === "function") {
        try { clearTimeout(moveendTimer); } catch (e) { /* ignore */ }
      }
      const run = () => {
        moveendTimer = null;
        const waiters = moveendWaiters;
        moveendWaiters = [];
        if (!state.liveEnabled || !state.layers.some(layerWantsMoveendRefresh)) {
          waiters.forEach((w) => w([]));
          return;
        }
        Promise.resolve(refresh(currentViewFromMap(), fetcher)).then((out) => {
          waiters.forEach((w) => w(out));
        }, (err) => {
          waiters.forEach((w) => w([]));
          return err;
        });
      };
      if (typeof setTimeout === "function") moveendTimer = setTimeout(run, MOVEEND_DEBOUNCE_MS);
      else run();
    });
  }

  function classifyResponse(body, contentType, httpStatus) {
    return parseGisServiceBody(body, contentType, httpStatus);
  }

  function load(doc) {
    empty();
    if (!doc) {
      state.loaded = true;
      state.errors = ["gis registry missing"];
      return state;
    }
    const errs = validateRegistry(doc);
    state.errors = errs;
    state.loaded = true;
    if (errs.length) return state;
    state.doc = doc;
    state.layers = Array.isArray(doc.layers) ? doc.layers.slice() : [];
    state.layers.forEach((l) => {
      if (!l) return;
      if (l.status === "unknown" || l.kind === "none") setHealth(l.id, "unknown", l.reason || U);
      else setHealth(l.id, "off", "");
      state.overlaysOn[l.id] = false;
    });
    return state;
  }

  function fetchJson(url) {
    return fetch(url, { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null));
  }

  function boot(fetcher) {
    if (typeof window !== "undefined" && window.GD_GIS_REGISTRY) {
      load(window.GD_GIS_REGISTRY);
      state.liveEnabled = readStoredLive();
      return Promise.resolve(state);
    }
    const get = fetcher || fetchJson;
    return Promise.resolve(get(PATH)).then((doc) => {
      load(doc);
      state.liveEnabled = readStoredLive();
      return state;
    }).catch(() => {
      empty();
      state.loaded = true;
      state.errors = ["gis registry could not be loaded"];
      return state;
    });
  }

  function statusLabel(token) {
    if (token === "ok" || (token && String(token).indexOf("ok:") === 0)) return "ok";
    if (token === "loading") return "loading";
    if (token === "below-minzoom") return "below min zoom";
    if (token === "unavailable") return "unavailable";
    if (token === "error" || token === "skipped") return "down / skipped";
    if (token === "unknown") return "unknown";
    return "off";
  }

  function editorRows() {
    return state.layers.map((l) => {
      const token = tokenFor(l);
      return {
        id: l.id,
        label: l.label,
        status: token,
        statusLabel: statusLabel(token),
        credit: l.credit || "",
        terms: l.terms || "",
        reason: l.reason || (state.health[l.id] && state.health[l.id].reason) || "",
        disabled: l.status === "unknown" || l.kind === "none",
        on: !!state.overlaysOn[l.id],
        unknown: l.status === "unknown" || l.kind === "none"
      };
    });
  }

  function storyLayers(story) {
    const ids = story && Array.isArray(story.gisOverlayIds) ? story.gisOverlayIds : [];
    return ids.map((id) => {
      const l = byId(id);
      if (!l) return { id: id, label: id, status: "unknown", statusLabel: "unknown", credit: "", reason: U, unknown: true, on: false, disabled: true };
      const token = tokenFor(l);
      return {
        id: l.id,
        label: l.label,
        status: token,
        statusLabel: statusLabel(token),
        credit: l.credit || "",
        reason: l.reason || (state.health[l.id] && state.health[l.id].reason) || (token === "unknown" ? U : ""),
        unknown: l.status === "unknown" || l.kind === "none",
        on: !!state.overlaysOn[l.id],
        disabled: l.status === "unknown" || l.kind === "none"
      };
    });
  }

  function mountNewsdesk(parent, story) {
    if (!parent || !story) return null;
    const rows = storyLayers(story);
    if (!rows.length) { parent.textContent = ""; return parent; }
    parent.textContent = "";
    const box = document.createElement("div");
    box.className = "nd-gis";
    const h = document.createElement("p");
    h.className = "nd-gis-title";
    h.textContent = "Official GIS";
    box.appendChild(h);
    rows.forEach((r) => {
      const line = document.createElement("p");
      line.className = "nd-gis-row";
      const name = document.createElement("span");
      name.textContent = r.label + " — " + r.statusLabel;
      line.appendChild(name);
      if (r.unknown || r.reason) {
        const why = document.createElement("span");
        why.className = "nd-unknown";
        why.textContent = " " + (r.reason || U);
        line.appendChild(why);
      } else if (r.credit) {
        const cred = document.createElement("span");
        cred.className = "layer-credit";
        cred.textContent = " " + r.credit;
        line.appendChild(cred);
      }
      box.appendChild(line);
    });
    parent.appendChild(box);
    return parent;
  }

  if (GD.yearClock && GD.yearClock.onChange) {
    GD.yearClock.onChange(function () { syncMap(); });
  }

  GD.gis = {
    PATH, LIVE_KEY, state, load, boot, empty, validateRegistry, parseGisServiceBody,
    serviceMetadataUrl, arcgisExport, wmsGetMap, featureQueryUrl, dropAttributes,
    rasterTileUrl, syncMap, hostnamesFrom, cspHosts, listed, gisStatus, setOverlay, setLiveEnabled, isLiveEnabled,
    refresh, refreshLayer, onMapMoveEnd, MOVEEND_DEBOUNCE_MS, classifyResponse, byId, tokenFor, statusLabel, editorRows,
    storyLayers, mountNewsdesk, minZoomOf, yearStatusFor, noteTileError, noteSourceLoaded, TILE_ERROR_LIMIT
  };
})();
