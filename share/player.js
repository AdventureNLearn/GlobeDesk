/* GlobeDesk share pack player: read-only Play, Pause and Scrub for one promoted story set.
   Runs from a single file opened from disk. No network, no editor, no keys.
   Data: window.GD_SHARE (inlined manifest), window.GD_SHARE_TILES (optional inlined tiles). */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const D = window.GD_SHARE;
  const TILES = window.GD_SHARE_TILES || null;
  const $ = (id) => document.getElementById(id);
  const ep = D.episode;
  const stories = ep.stories || [];
  const starts = []; let total = 0;
  stories.forEach((s) => { starts.push(total); total += Number(s.durationSec) || 0; });
  total = Math.max(total, 0.1);
  const state = { t: 0, playing: false, last: 0, raf: 0, idx: -1, map: null };

  function text(el, s) { el.textContent = s == null ? "" : String(s); }
  function fmt(t) { t = Math.max(0, t); const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ":" + String(s).padStart(2, "0"); }
  function known(v) { const t = String(v == null ? "" : v).trim(); return t && t !== "[UNKNOWN]" ? t : ""; }
  function locate(t) { for (let i = stories.length - 1; i >= 0; i--) if (t >= starts[i]) return { idx: i, lt: t - starts[i] }; return { idx: 0, lt: 0 }; }

  function b64bytes(s) { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }

  function countries() {
    const w = (window.GD_REGIONS || {}).world;
    return { type: "FeatureCollection", features: (w && w.countries ? w.countries : []).map((c) => ({ type: "Feature", properties: { a3: c.a3 }, geometry: { type: "MultiPolygon", coordinates: c.polys } })) };
  }
  function pins(active) {
    return { type: "FeatureCollection", features: stories.filter((s) => s.location && s.location.lat != null).map((s) => ({ type: "Feature", properties: { active: stories.indexOf(s) === active ? 1 : 0 }, geometry: { type: "Point", coordinates: [s.location.lon, s.location.lat] } })) };
  }
  function arcs() {
    const pts = stories.filter((s) => s.location && s.location.lat != null).map((s) => [s.location.lon, s.location.lat]);
    return { type: "FeatureCollection", features: pts.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts } }] : [] };
  }
  function highlight(idx) {
    const s = stories[idx], h = s && s.highlight;
    if (!h || !h.a3) return { type: "FeatureCollection", features: [] };
    return { type: "FeatureCollection", features: countries().features.filter((f) => f.properties.a3 === h.a3) };
  }

  function style() {
    const accent = (D.look && D.look.highlight) || "#5ee7ff";
    const st = {
      version: 8, name: "GlobeDesk share pack",
      sources: {
        land: { type: "geojson", data: window.GD_LAND || { type: "FeatureCollection", features: [] } },
        countries: { type: "geojson", data: countries() },
        pins: { type: "geojson", data: pins(-1) },
        arcs: { type: "geojson", data: arcs() },
        hl: { type: "geojson", data: highlight(-1) }
      },
      layers: [
        { id: "bg", type: "background", paint: { "background-color": "#02040c" } },
        { id: "land", type: "fill", source: "land", paint: { "fill-color": "#13263d" } },
        { id: "land-edge", type: "line", source: "land", paint: { "line-color": "#62b6ff", "line-width": 0.8, "line-opacity": 0.55 } }
      ]
    };
    (D.tiles || []).forEach((t) => {
      st.sources["t-" + t.id] = { type: "raster", tiles: ["gdpack://" + t.id + "/{z}/{x}/{y}"], tileSize: 256, minzoom: t.minzoom, maxzoom: t.maxzoom, bounds: t.bounds || undefined };
      st.layers.push({ id: "t-" + t.id, type: "raster", source: "t-" + t.id, paint: t.fade ? { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 5, 1, 9, 0] } : {} });
    });
    st.layers.push(
      { id: "countries", type: "line", source: "countries", paint: { "line-color": "#ffffff", "line-width": 0.8, "line-opacity": 0.35 } },
      { id: "hl-glow", type: "line", source: "hl", paint: { "line-color": accent, "line-width": 10, "line-blur": 7, "line-opacity": 0.8 } },
      { id: "hl-line", type: "line", source: "hl", paint: { "line-color": accent, "line-width": 2.4 } },
      { id: "arcs", type: "line", source: "arcs", paint: { "line-color": "#5ee6ff", "line-width": 2, "line-opacity": 0.7 } },
      { id: "pins-halo", type: "circle", source: "pins", paint: { "circle-radius": ["case", ["==", ["get", "active"], 1], 22, 12], "circle-color": "#ff3b5c", "circle-opacity": 0.18 } },
      { id: "pins", type: "circle", source: "pins", paint: { "circle-radius": ["case", ["==", ["get", "active"], 1], 8, 6], "circle-color": "#ff3b5c", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } }
    );
    return st;
  }

  function cameraAt(t) {
    if (GD.frameExport && GD.frameExport.cameraAtTime) return GD.frameExport.cameraAtTime(ep, t, { center: [40, 28], zoom: 1.6, pitch: 0, bearing: 0 });
    return { center: [40, 28], zoom: 1.6, pitch: 0, bearing: 0 };
  }

  function renderOverlay(t) {
    const { idx, lt } = locate(t);
    const s = stories[idx] || {};
    if (idx !== state.idx && state.map && state.map.getSource("pins")) {
      state.idx = idx;
      state.map.getSource("pins").setData(pins(idx));
      state.map.getSource("hl").setData(highlight(idx));
    }
    text($("spStory"), known(s.title) || known(ep.title) || "GlobeDesk story");
    const cards = (s.cards || []).filter((c) => lt >= c.at && lt < c.at + c.dur);
    const box = $("spCards"); box.textContent = "";
    cards.forEach((c) => {
      const a = document.createElement("article"); a.className = "sp-card";
      const v = document.createElement("div"); v.className = "v " + (c.verified ? "ok" : "no"); v.textContent = c.verified ? "VERIFIED" : "UNVERIFIED";
      const h = document.createElement("h3"); h.textContent = c.title || "";
      const p = document.createElement("p"); p.textContent = c.body || "";
      a.appendChild(v); a.appendChild(h); a.appendChild(p); box.appendChild(a);
    });
    const caps = (s.captions || []).filter((c) => lt >= c.start && lt < c.end).map((c) => c.text);
    text($("spCap"), caps.join(" "));
    const src = (s.sources || []).find((x) => x && safeHref(x.url));
    const cite = $("spCite");
    cite.hidden = !src;
    if (src) text(cite, "Source: " + (known(src.label) || src.url));
    text($("spTime"), fmt(t) + " / " + fmt(total));
    $("spScrub").value = String(t);
  }

  function frame(t) {
    state.t = Math.max(0, Math.min(total, t));
    if (state.map) state.map.jumpTo(cameraAt(state.t));
    renderOverlay(state.t);
  }

  function tick(now) {
    const dt = (now - state.last) / 1000; state.last = now;
    frame(state.t + dt);
    if (state.t >= total) { pause(); return; }
    state.raf = requestAnimationFrame(tick);
  }
  function play() {
    if (state.playing) return;
    if (state.t >= total - 0.05) state.t = 0;
    state.playing = true; state.last = performance.now();
    $("spPlay").textContent = "❚❚ Pause"; $("spPlay").setAttribute("aria-label", "Pause");
    state.raf = requestAnimationFrame(tick);
  }
  function pause() {
    state.playing = false; cancelAnimationFrame(state.raf);
    $("spPlay").textContent = "▶ Play"; $("spPlay").setAttribute("aria-label", "Play");
  }

  // Only https links are rendered as links; anything else (javascript:, http:, data:) stays plain text.
  function safeHref(u) {
    if (typeof u !== "string" || !/^https:\/\//i.test(u)) return null;
    try { const x = new URL(u); return x.protocol === "https:" && x.hostname && !x.username && !x.password ? x.href : null; } catch (e) { return null; }
  }

  function credits() {
    const el = $("spCreditsBody");
    const add = (tag, txt, href) => {
      const n = document.createElement(tag);
      href = safeHref(href);
      if (href) { const a = document.createElement("a"); a.href = href; a.textContent = txt; a.target = "_blank"; a.rel = "noopener noreferrer"; n.appendChild(a); }
      else n.textContent = txt;
      el.appendChild(n); return n;
    };
    add("h2", "Content");
    add("p", (D.label || "") + " · Licence for the author's own text: " + (D.license || ""));
    stories.forEach((s, i) => {
      add("p", (i + 1) + ". " + (known(s.title) || "Story") + (s.credit ? " · Credit: " + s.credit : ""));
      (s.sources || []).filter((x) => x && safeHref(x.url)).forEach((x) => add("p", "Source: " + (known(x.label) || x.url), x.url));
    });
    add("h2", "Maps and software");
    (D.attributions || []).forEach((a) => add("p", a.text, a.url || null));
    (D.licenses || []).forEach((l) => { add("h2", l.name); const pre = document.createElement("pre"); pre.textContent = l.text; el.appendChild(pre); });
  }

  function boot() {
    text($("spTitle"), known(ep.title) || "GlobeDesk story");
    text($("spBadge"), (D.look && D.look.badge) || "GLOBEDESK");
    text($("spLabel"), D.label || "");
    $("spSample").hidden = !(ep.sample || ep.demo);
    const sc = $("spScrub"); sc.max = String(total); sc.step = "0.05";
    sc.addEventListener("input", () => { pause(); frame(Number(sc.value)); });
    $("spPlay").addEventListener("click", () => (state.playing ? pause() : play()));
    $("spCreditsBtn").addEventListener("click", () => { const c = $("spCredits"); c.hidden = !c.hidden; $("spCreditsBtn").setAttribute("aria-expanded", c.hidden ? "false" : "true"); });
    document.addEventListener("keydown", (e) => { if (e.code === "Space" && e.target === document.body) { e.preventDefault(); state.playing ? pause() : play(); } });
    credits();
    if (TILES && window.maplibregl && maplibregl.addProtocol) {
      maplibregl.addProtocol("gdpack", (params) => {
        const key = params.url.replace(/^gdpack:\/\//, "");
        const s = TILES[key];
        return Promise.resolve({ data: s ? b64bytes(s).buffer : new ArrayBuffer(0) });
      });
    }
    try {
      state.map = new maplibregl.Map({ container: "spMap", style: style(), center: [40, 28], zoom: 1.6, attributionControl: false, interactive: true, fadeDuration: 0 });
      try { state.map.on("style.load", () => { try { state.map.setProjection({ type: "globe" }); } catch (e) { /* flat fallback */ } }); } catch (e) { /* ignore */ }
      state.map.on("load", () => { frame(0); window.__gdShare = { ready: true, total, stories: stories.length }; });
    } catch (e) {
      text($("spStory"), "This browser could not start the map (WebGL). The story text is in Credits below.");
      window.__gdShare = { ready: false, error: String(e && e.message || e) };
    }
    renderOverlay(0);
  }
  GD.sharePlayer = { play, pause, frame, state: () => ({ t: state.t, playing: state.playing, total, idx: state.idx }) };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
