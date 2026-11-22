/* Event Layers: pure data helpers (no DOM, no map) so they run in Node tests too. window.GD.events
   Every feature states its precision; features with no place stay off the map
   ("Not on the map" list); nothing is invented, gaps are [UNKNOWN]. */
(function () {
  "use strict";
  const GD = (typeof window !== "undefined" ? (window.GD = window.GD || {}) : {});
  const U = "[UNKNOWN]";
  const KINDS = ["point", "line", "polygon", "ring"];
  const VERIF = ["verified", "not verified", "disputed"];
  function httpsOk(s) {
    if (GD.schema && typeof GD.schema.httpsOk === "function") return GD.schema.httpsOk(s);
    if (GD.sanitize && typeof GD.sanitize.isHttpsUrl === "function") return GD.sanitize.isHttpsUrl(s);
    if (typeof s !== "string" || !s) return false;
    if (typeof URL === "function") {
      try {
        const u = new URL(s);
        return u.protocol === "https:" && !u.username && !u.password;
      } catch (e) { return false; }
    }
    if (!/^https:\/\//i.test(s)) return false;
    const hostpart = s.slice(s.indexOf("://") + 3).split("/")[0];
    return hostpart.indexOf("@") < 0;
  }
  const CATEGORIES = {
    strike: { label: "Strike", color: "#ff3b3b", icon: "✸" },
    convoy: { label: "Convoy / shipping", color: "#ffb020", icon: "⛴" },
    blockade: { label: "Blockade / zone", color: "#ff8a1f", icon: "⛔" },
    military: { label: "Military movement", color: "#c084fc", icon: "➤" },
    missile: { label: "Missile / air track", color: "#ff5c8a", icon: "✈" },
    protest: { label: "Protest", color: "#38bdf8", icon: "✊" },
    disaster: { label: "Disaster", color: "#34d399", icon: "⚠" },
    diplomacy: { label: "Diplomacy", color: "#a3e635", icon: "✉" },
    other: { label: "Other", color: "#e5e7eb", icon: "●" }
  };
  const ICONS = ["●", "✸", "⛴", "⛔", "➤", "✈", "✊", "⚠", "✉", "★", "▲", "■"];
  let seq = 0;
  const uid = (p) => `${p}-${Date.now().toString(36)}-${(++seq).toString(36)}`;

  function createLayer(name, opts) {
    return Object.assign({ id: uid("evl"), name: name || "New event layer", color: "#ff8a1f", icon: "●", visible: true, labels: true,
      styleByCategory: true, scope: "all", note: "", features: [] }, opts || {});
  }

  function createFeature(kind, geometry, props) {
    if (!KINDS.includes(kind)) throw new Error("unknown kind " + kind);
    return {
      type: "Feature",
      id: uid("ev"),
      geometry: geometry || null,
      properties: Object.assign({
        kind, title: U, eventTime: "", eventEnd: "", timeApprox: true, datePrecision: "unknown",
        category: "other", verification: "not verified", sources: [], citation: { type: U, date: U, credit: U, license: U },
        notes: "", precisionLabel: "Precision: [UNKNOWN]", radiusKm: kind === "ring" ? 10 : null,
        cardId: null, storyId: null, example: false
      }, props || {})
    };
  }

  // --- time ---
  function parseTime(s) {
    if (!s) return null;
    const m = String(s).trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:?\d{2})?$/);
    if (!m) return null;
    const iso = `${m[1]}-${m[2]}-${m[3] || "01"}T${m[4] || "00"}:${m[5] || "00"}:${m[6] || "00"}${m[7] ? (m[7].length === 5 ? m[7].slice(0, 3) + ":" + m[7].slice(3) : m[7]) : "Z"}`;
    const t = Date.parse(iso);
    return isNaN(t) ? null : t;
  }
  function timeLabel(p) {
    if (!p.eventTime) return "Date [UNKNOWN]";
    return (p.timeApprox ? "≈ " : "") + p.eventTime.replace("T", " ") + (p.eventEnd ? " → " + p.eventEnd.replace("T", " ") : "");
  }
  // A feature is revealed once the event clock reaches its time. No time = always shown. clock null = show all.
  function visibleAt(f, clock) {
    if (clock == null) return true;
    const t = parseTime(f.properties.eventTime);
    return t == null || t <= clock;
  }
  // Route draw progress 0..1 between eventTime and eventEnd (1 if no end, or clock off).
  function progressAt(f, clock) {
    const a = parseTime(f.properties.eventTime), b = parseTime(f.properties.eventEnd);
    if (clock == null || a == null || b == null || b <= a) return 1;
    return Math.max(0, Math.min(1, (clock - a) / (b - a)));
  }
  function timeRange(layers) {
    let lo = Infinity, hi = -Infinity;
    (layers || []).forEach((l) => l.features.forEach((f) => ["eventTime", "eventEnd"].forEach((k) => { const t = parseTime(f.properties[k]); if (t != null) { lo = Math.min(lo, t); hi = Math.max(hi, t); } })));
    return lo === Infinity ? null : { start: lo, end: hi };
  }

  // --- geometry ---
  const R = 6371.0088, rad = Math.PI / 180;
  function dest(lat, lon, km, brg) {
    const d = km / R, b = brg * rad, p1 = lat * rad, l1 = lon * rad;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return [Math.round((((l2 / rad + 540) % 360) - 180) * 1e5) / 1e5, Math.round((p2 / rad) * 1e5) / 1e5];
  }
  function ringPolygon(lon, lat, km, steps) {
    const n = steps || 64, pts = [];
    for (let i = 0; i <= n; i++) pts.push(dest(lat, lon, km, (360 * i) / n));
    pts[n] = pts[0];
    return { type: "Polygon", coordinates: [pts] };
  }
  function km(a, b) {
    const h = Math.sin(((b[1] - a[1]) * rad) / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(((b[0] - a[0]) * rad) / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  // Point at fraction t along a LineString (by length) and the partial line up to it.
  function lineAt(coords, t) {
    if (!coords || coords.length < 2) return { head: coords && coords[0], part: coords || [] };
    const seg = []; let total = 0;
    for (let i = 1; i < coords.length; i++) { const d = km(coords[i - 1], coords[i]); seg.push(d); total += d; }
    let want = total * Math.max(0, Math.min(1, t)); const part = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
      if (want <= seg[i - 1] || i === coords.length - 1) {
        const f = seg[i - 1] ? Math.min(1, want / seg[i - 1]) : 1, a = coords[i - 1], b = coords[i];
        const head = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        part.push(head);
        return { head, part, totalKm: total };
      }
      want -= seg[i - 1]; part.push(coords[i]);
    }
    return { head: coords[coords.length - 1], part: coords, totalKm: total };
  }
  function anchor(f) {
    const g = f.geometry; if (!g) return null;
    if (g.type === "Point") return g.coordinates;
    if (g.type === "LineString") return lineAt(g.coordinates, 0.5).head;
    if (g.type === "Polygon") { const r = g.coordinates[0]; let x = 0, y = 0; const n = r.length - 1 || 1; for (let i = 0; i < n; i++) { x += r[i][0]; y += r[i][1]; } return [x / n, y / n]; }
    return null;
  }
  function renderGeometry(f) {
    if (f.properties.kind === "ring" && f.geometry && f.geometry.type === "Point") return ringPolygon(f.geometry.coordinates[0], f.geometry.coordinates[1], Number(f.properties.radiusKm) || 1);
    return f.geometry;
  }
  function bbox(features) {
    let w = 180, s = 90, e = -180, n = -90, any = false;
    const add = (c) => { any = true; w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]); };
    const walk = (c) => (typeof c[0] === "number" ? add(c) : c.forEach(walk));
    features.forEach((f) => { const g = renderGeometry(f); if (g) walk(g.coordinates); });
    return any ? [w, s, e, n] : null;
  }

  // --- validation (strict) ---
  function validCoord(c) { return Array.isArray(c) && c.length >= 2 && isFinite(c[0]) && isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90; }
  function validateFeature(f) {
    const e = [], p = (f && f.properties) || {};
    if (!f || f.type !== "Feature") return ["not a Feature"];
    if (!KINDS.includes(p.kind)) e.push("kind must be point|line|polygon|ring");
    if (!VERIF.includes(p.verification)) e.push("verification must be verified|not verified|disputed");
    if (!CATEGORIES[p.category]) e.push("unknown category " + p.category);
    if (p.eventTime && parseTime(p.eventTime) == null) e.push("eventTime must be ISO (YYYY-MM-DD[THH:MM])");
    if (p.eventEnd && parseTime(p.eventEnd) == null) e.push("eventEnd must be ISO");
    (p.sources || []).forEach((s) => { if (s.url && !httpsOk(s.url)) e.push("source urls must be https"); });
    if (p.verification === "verified" && !(p.sources || []).some((s) => s.url)) e.push("verified needs at least one source link");
    const g = f.geometry;
    if (g) {
      const want = { point: "Point", ring: "Point", line: "LineString", polygon: "Polygon" }[p.kind];
      if (g.type !== want) e.push(`${p.kind} needs ${want} geometry`);
      else if (g.type === "Point" && !validCoord(g.coordinates)) e.push("bad coordinate");
      else if (g.type === "LineString" && !(g.coordinates.length >= 2 && g.coordinates.every(validCoord))) e.push("line needs ≥2 valid points");
      else if (g.type === "Polygon" && !(g.coordinates[0] && g.coordinates[0].length >= 4 && g.coordinates[0].every(validCoord))) e.push("polygon needs ≥3 valid points");
      if (p.kind === "ring" && !(Number(p.radiusKm) > 0)) e.push("ring needs radiusKm > 0");
    }
    return e;
  }
  function validateLayers(layers) {
    const e = [];
    if (layers == null) return e;
    if (!Array.isArray(layers)) return ["eventLayers must be an array"];
    layers.forEach((l, i) => { if (!l.id || !Array.isArray(l.features)) e.push(`event layer ${i + 1}: id/features missing`); (l.features || []).forEach((f, j) => validateFeature(f).forEach((m) => e.push(`event layer ${i + 1} feature ${j + 1}: ${m}`))); });
    return e;
  }

  // --- import / export ---
  function toGeoJSON(layer) {
    return { type: "FeatureCollection", name: layer.name,
      globedesk_layer: { id: layer.id, name: layer.name, color: layer.color, icon: layer.icon, labels: layer.labels, styleByCategory: layer.styleByCategory, note: layer.note },
      features: layer.features.map((f) => ({ type: "Feature", id: f.id, geometry: f.geometry, properties: Object.assign({}, f.properties) })) };
  }
  // Accepts any GeoJSON FeatureCollection / Feature. Unknown properties are kept under notes; nothing is guessed.
  function fromGeoJSON(gj, name) {
    const meta = gj.globedesk_layer || gj.gobedesk_layer || {};
    const layer = createLayer(meta.name || gj.name || name || "Imported layer", { color: meta.color || "#ff8a1f", icon: meta.icon || "●", labels: meta.labels !== false, styleByCategory: meta.styleByCategory !== false, note: meta.note || "" });
    const feats = gj.type === "FeatureCollection" ? gj.features : gj.type === "Feature" ? [gj] : [];
    const skipped = [];
    feats.forEach((src, i) => {
      const g = src.geometry, p = src.properties || {};
      // No geometry = kept for the "Not on the map" list, never placed on a guessed spot.
      const byGeom = !g ? "point" : g.type === "Point" ? "point" : g.type === "LineString" ? "line" : g.type === "Polygon" ? "polygon" : null;
      const kind = p.kind && KINDS.includes(p.kind) ? p.kind : byGeom;
      if (!kind || (g && !byGeom)) { skipped.push(`#${i + 1}: unsupported geometry ${g ? g.type : "none"}`); return; }
      const f = createFeature(kind, g, {
        title: p.title || p.name || U, eventTime: p.eventTime || p.event_time || p.date || "", eventEnd: p.eventEnd || p.event_end || "",
        timeApprox: p.timeApprox !== false, datePrecision: p.datePrecision || "unknown",
        category: CATEGORIES[p.category] ? p.category : "other",
        verification: VERIF.includes(p.verification) ? p.verification : "not verified",
        sources: Array.isArray(p.sources) ? p.sources.filter((s) => s && (!s.url || httpsOk(s.url))) : (p.source_url && httpsOk(p.source_url) ? [{ label: p.source_label || U, url: p.source_url }] : []),
        citation: p.citation || { type: U, date: U, credit: U, license: U },
        notes: p.notes || p.description || "", precisionLabel: p.precisionLabel || "Precision: [UNKNOWN]",
        radiusKm: p.radiusKm != null ? Number(p.radiusKm) : (kind === "ring" ? 10 : null),
        cardId: p.cardId || null, storyId: p.storyId || null, example: !!p.example
      });
      if (src.id) f.id = String(src.id);
      const errs = validateFeature(f);
      if (errs.length) skipped.push(`#${i + 1}: ${errs[0]}`); else layer.features.push(f);
    });
    return { layer, skipped };
  }

  const CSV_COLS = ["title", "lat", "lon", "event_time", "event_end", "time_approx", "category", "verification", "source_label", "source_url", "radius_km", "notes"];
  function csvCell(v) { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
  function toCSV(layer) {
    const rows = [CSV_COLS.join(",")];
    layer.features.forEach((f) => {
      const p = f.properties, a = anchor(f) || ["", ""], s = (p.sources || [])[0] || {};
      rows.push([p.title, a[1], a[0], p.eventTime, p.eventEnd, p.timeApprox ? "yes" : "no", p.category, p.verification, s.label || "", s.url || "", p.kind === "ring" ? p.radiusKm : "", p.notes].map(csvCell).join(","));
    });
    return rows.join("\n") + "\n";
  }
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    const s = String(text).replace(/^\uFEFF/, "").replace(/\r/g, "");
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; } else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim() !== ""));
  }
  // CSV with lat/lon (or latitude/longitude) columns → point features (ring if radius_km is set).
  function fromCSV(text, name) {
    const rows = parseCSV(text); const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
    const col = (...names) => names.map((n) => head.indexOf(n)).find((i) => i >= 0);
    const iLat = col("lat", "latitude"), iLon = col("lon", "lng", "long", "longitude");
    if (iLat == null || iLon == null) throw new Error("CSV needs lat and lon columns");
    const gj = { type: "FeatureCollection", name, features: [] };
    const get = (r, ...n) => { const i = col(...n); return i == null ? "" : (r[i] || "").trim(); };
    rows.forEach((r) => {
      const blank = String(r[iLat] || "").trim() === "" || String(r[iLon] || "").trim() === "";
      const lat = Number(r[iLat]), lon = Number(r[iLon]), rk = get(r, "radius_km");
      gj.features.push({ type: "Feature", geometry: blank ? null : { type: "Point", coordinates: [lon, lat] }, properties: {
        kind: rk ? "ring" : "point", radiusKm: rk ? Number(rk) : null, title: get(r, "title", "name") || U, eventTime: get(r, "event_time", "date", "time"), eventEnd: get(r, "event_end"),
        timeApprox: !/^(no|false|0)$/i.test(get(r, "time_approx")), category: get(r, "category").toLowerCase() || "other", verification: get(r, "verification").toLowerCase() || "not verified",
        source_label: get(r, "source_label"), source_url: get(r, "source_url"), notes: get(r, "notes") } });
    });
    return fromGeoJSON(gj, name);
  }

  const xmlEsc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function toKML(layer) {
    const coords = (cs) => cs.map((c) => `${c[0]},${c[1]},0`).join(" ");
    const pm = layer.features.map((f) => {
      const p = f.properties, g = renderGeometry(f); if (!g) return "";
      const geom = g.type === "Point" ? `<Point><coordinates>${coords([g.coordinates])}</coordinates></Point>`
        : g.type === "LineString" ? `<LineString><coordinates>${coords(g.coordinates)}</coordinates></LineString>`
        : `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords(g.coordinates[0])}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
      const desc = `${timeLabel(p)} | ${p.category} | ${p.verification}${(p.sources || []).map((s) => " | " + s.url).join("")}${p.notes ? " | " + p.notes : ""}`;
      return `<Placemark><name>${xmlEsc(p.title)}</name>${p.eventTime ? `<TimeStamp><when>${xmlEsc(p.eventTime)}</when></TimeStamp>` : ""}<description>${xmlEsc(desc)}</description>${geom}</Placemark>`;
    }).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xmlEsc(layer.name)}</name>\n${pm}\n</Document></kml>\n`;
  }
  // Minimal KML reader (Placemark Point / LineString / Polygon outer ring). Regex-based so it also runs in Node.
  function fromKML(text, name) {
    const un = (s) => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
    const pc = (s) => un(s).split(/\s+/).filter(Boolean).map((t) => t.split(",").slice(0, 2).map(Number));
    const docName = (String(text).match(/<Document>[\s\S]*?<name>([\s\S]*?)<\/name>/) || [])[1];
    const gj = { type: "FeatureCollection", name: un(docName) || name, features: [] };
    (String(text).match(/<Placemark[\s\S]*?<\/Placemark>/g) || []).forEach((pm) => {
      const tag = (t) => (pm.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1];
      let g = null;
      const pt = pm.match(/<Point>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/), ln = pm.match(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/), pg = pm.match(/<Polygon>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
      if (pt) g = { type: "Point", coordinates: pc(pt[1])[0] }; else if (ln) g = { type: "LineString", coordinates: pc(ln[1]) }; else if (pg) g = { type: "Polygon", coordinates: [pc(pg[1])] };
      gj.features.push({ type: "Feature", geometry: g, properties: { title: un(tag("name")) || U, eventTime: un(tag("when")), notes: un(tag("description")) } });
    });
    return fromGeoJSON(gj, name);
  }

  // Sample layer: the episode's own approximate story locations, each linked to that
  // story's own source. Stories with a null lat/lon have no pin and are left out (never guessed).
  function demoLayers(ep) {
    const l = createLayer("Sample story places (approximate, not verified)", { color: "#e7c766", note: "Approximate story locations from the sample episode. Not event fixes." });
    (ep.stories || []).forEach((s) => {
      const loc = s.location || {};
      if (loc.lat == null || loc.lon == null) return;
      const card = (s.cards || [])[0];
      const src = (s.sources || []).filter((x) => x && x.url && /^https:\/\//i.test(x.url)).slice(0, 1).map((x) => ({ label: x.label || U, url: x.url }));
      l.features.push(createFeature("point", { type: "Point", coordinates: [loc.lon, loc.lat] }, {
        title: s.title, eventTime: ep.date, timeApprox: true, datePrecision: "day (episode date; event time [UNKNOWN])",
        category: "other", verification: "not verified", sources: src,
        citation: { type: "Map pin", date: ep.date, credit: "Approximate location, sample", license: "n/a" },
        notes: "sample, not verified. " + (loc.name || U), precisionLabel: "Precision: approximate (sample)",
        cardId: card ? card.id : null, storyId: s.id
      }));
    });
    return [l];
  }

  GD.events = { U, KINDS, VERIF, CATEGORIES, ICONS, uid, createLayer, createFeature, parseTime, timeLabel, visibleAt, progressAt, timeRange,
    ringPolygon, lineAt, anchor, renderGeometry, bbox, km, validateFeature, validateLayers, toGeoJSON, fromGeoJSON, toCSV, fromCSV, parseCSV, toKML, fromKML, demoLayers };
  if (typeof module !== "undefined") module.exports = GD.events;
})();
