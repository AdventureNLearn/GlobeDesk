/* Opt-in address search. Photon (worldwide) from the browser; US Census only
   through the local serve.py proxy. Off by default. Queries are not written to
   the episode or to command logs. window.GD.geocode */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const LIVE_KEY = "globedesk.geocode.live";
  const CENSUS_KEY = "globedesk.geocode.census";
  const PHOTON = "https://photon.komoot.io/api/";
  const CENSUS_PROXY = "/api/geocode/census";
  const LIMIT = 5;
  const MIN_QUERY = 3;
  const cache = [];
  const CACHE_MAX = 20;
  let live = false;
  let censusOn = false;
  let inflight = null;
  let inflightCtl = null;

  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      live = localStorage.getItem(LIVE_KEY) === "1";
      censusOn = localStorage.getItem(CENSUS_KEY) === "1";
    }
  } catch (e) { live = false; censusOn = false; }

  function writeFlag(key, on) {
    try {
      if (typeof localStorage !== "undefined" && localStorage) localStorage.setItem(key, on ? "1" : "0");
    } catch (e) { /* private mode */ }
  }

  function isLive() { return !!live; }
  function isCensusEnabled() { return !!censusOn; }
  function setLive(on) { live = !!on; writeFlag(LIVE_KEY, live); return live; }
  function setCensusEnabled(on) { censusOn = !!on; writeFlag(CENSUS_KEY, censusOn); return censusOn; }
  function abortInflight() {
    if (inflightCtl && inflightCtl.abort) {
      try { inflightCtl.abort(); } catch (e) { /* ignore */ }
    }
    inflightCtl = null;
    inflight = null;
  }

  function resetForTests() {
    abortInflight();
    live = false; censusOn = false; inflight = null; inflightCtl = null; cache.length = 0;
    try {
      if (typeof localStorage !== "undefined" && localStorage) {
        localStorage.removeItem(LIVE_KEY); localStorage.removeItem(CENSUS_KEY);
      }
    } catch (e) { /* ignore */ }
  }

  function photonUrl(q, limit) {
    const query = String(q || "").trim();
    if (!query) return null;
    const n = limit == null ? LIMIT : Number(limit);
    return PHOTON + "?q=" + encodeURIComponent(query) + "&limit=" + (isFinite(n) && n > 0 ? Math.min(10, Math.floor(n)) : LIMIT);
  }

  function censusProxyUrl(q) {
    const query = String(q || "").trim();
    if (!query) return null;
    return CENSUS_PROXY + "?address=" + encodeURIComponent(query);
  }

  function parsePhoton(doc) {
    const feats = (doc && doc.features) || [];
    const out = [];
    for (let i = 0; i < feats.length && out.length < LIMIT; i++) {
      const f = feats[i] || {};
      const c = f.geometry && f.geometry.coordinates;
      if (!c || c.length < 2) continue;
      const p = f.properties || {};
      const parts = [p.name, p.street, p.housenumber, p.city, p.state, p.country].filter(Boolean);
      const name = parts.filter(function (x, idx, arr) { return arr.indexOf(x) === idx; }).join(", ");
      out.push({
        name: name || "Photon result",
        lat: Number(c[1]),
        lon: Number(c[0]),
        source: "photon",
        credit: "OpenStreetMap contributors (ODbL), via Photon"
      });
    }
    return out;
  }

  function parseCensus(doc) {
    function matchesOf(d) {
      if (!d || typeof d !== "object") return [];
      if (Array.isArray(d.addressMatches)) return d.addressMatches;
      if (d.result) return matchesOf(d.result);
      return [];
    }
    const matches = matchesOf(doc);
    const out = [];
    for (let i = 0; i < matches.length && out.length < LIMIT; i++) {
      const m = matches[i] || {};
      const xy = m.coordinates || {};
      if (xy.y == null || xy.x == null) continue;
      out.push({
        name: m.matchedAddress || "Census match",
        lat: Number(xy.y),
        lon: Number(xy.x),
        source: "census",
        credit: "This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau."
      });
    }
    return out;
  }

  function cacheGet(key) {
    for (let i = 0; i < cache.length; i++) if (cache[i].key === key) return cache[i].hits;
    return null;
  }
  function cachePut(key, hits) {
    cache.unshift({ key: key, hits: hits });
    if (cache.length > CACHE_MAX) cache.pop();
  }

  function searchOnline(q, opts) {
    opts = opts || {};
    const query = String(q || "").trim();
    if (!query) return Promise.resolve({ hits: [], reason: "empty" });
    if (query.length < MIN_QUERY) return Promise.resolve({ hits: [], reason: "short" });
    const wantPhoton = isLive() || !!opts.forceLive;
    const wantCensus = isCensusEnabled() || !!opts.census;
    if (!wantPhoton && !wantCensus) return Promise.resolve({ hits: [], reason: "off" });
    const key = query.toLowerCase() + "|" + (wantPhoton ? "p" : "") + (wantCensus ? "c" : "");
    const cached = cacheGet(key);
    if (cached) return Promise.resolve({ hits: cached, reason: "cache" });
    const get = opts.fetcher || (typeof fetch === "function" ? fetch : null);
    if (!get) return Promise.resolve({ hits: [], reason: "no-fetch" });
    abortInflight();
    const ctl = (typeof AbortController === "function") ? new AbortController() : null;
    inflightCtl = ctl;
    const token = ctl || {};
    inflight = token;
    const jobs = [];
    if (wantPhoton) {
      const url = photonUrl(query);
      if (url) {
        const popts = { credentials: "omit", cache: "no-store" };
        if (ctl) popts.signal = ctl.signal;
        jobs.push(Promise.resolve(get(url, popts)).then(function (r) {
          return Promise.resolve(r && r.json ? r.json() : null).then(function (j) { return parsePhoton(j); });
        }).catch(function () { return []; }));
      }
    }
    if (wantCensus) {
      const cu = censusProxyUrl(query);
      if (cu) {
        const copts = { credentials: "same-origin", cache: "no-store" };
        if (ctl) copts.signal = ctl.signal;
        jobs.push(Promise.resolve(get(cu, copts)).then(function (r) {
          if (!r || !r.ok) return [];
          return Promise.resolve(r.json ? r.json() : null).then(function (j) { return parseCensus(j); });
        }).catch(function () { return []; }));
      }
    }
    if (!jobs.length) return Promise.resolve({ hits: [], reason: "empty" });
    return Promise.all(jobs).then(function (parts) {
      if (inflight !== token) return { hits: [], reason: "superseded" };
      const hits = [];
      const seen = {};
      parts.forEach(function (list) {
        (list || []).forEach(function (h) {
          const k = (h.source || "") + ":" + h.lat + "," + h.lon;
          if (seen[k]) return;
          seen[k] = true;
          hits.push(h);
        });
      });
      cachePut(key, hits);
      return { hits: hits, reason: "ok" };
    });
  }

  GD.geocode = {
    LIVE_KEY: LIVE_KEY,
    CENSUS_KEY: CENSUS_KEY,
    PHOTON: PHOTON,
    LIMIT: LIMIT,
    MIN_QUERY: MIN_QUERY,
    abortInflight: abortInflight,
    isLive: isLive,
    setLive: setLive,
    isCensusEnabled: isCensusEnabled,
    setCensusEnabled: setCensusEnabled,
    resetForTests: resetForTests,
    photonUrl: photonUrl,
    censusProxyUrl: censusProxyUrl,
    parsePhoton: parsePhoton,
    parseCensus: parseCensus,
    searchOnline: searchOnline
  };
})();
