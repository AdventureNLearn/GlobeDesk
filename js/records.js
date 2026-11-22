/* GlobeDesk record-to-layer maker. Cited lists live in globedesk.records/1.
   No online geocoder, no invented coordinates, and no import of another app's files.
   A row with no printed point, no author-entered point, and no bundled gazetteer
   match stays off the map. */
(function () {
  const GD = (window.GD = window.GD || {});
  const PATH = "newsdesk/records.json";
  const U = "[UNKNOWN]";

  const state = {
    doc: null,
    catalogs: [],
    layers: [],
    errors: [],
    loaded: false
  };

  function empty() {
    state.doc = null;
    state.catalogs = [];
    state.layers = [];
    state.errors = [];
    state.loaded = false;
  }

  function recordsEpisode() {
    const stories = [];
    const seen = {};
    function add(list) {
      (list || []).forEach((st) => {
        if (!st || !st.id || seen[st.id]) return;
        seen[st.id] = true;
        stories.push(st);
      });
    }
    const ws = GD.state && GD.state.episode;
    if (ws) add(ws.stories);
    const feed = GD.newsdesk && GD.newsdesk.state && GD.newsdesk.state.feed;
    if (feed) {
      if (feed.episode) add(feed.episode.stories);
      (feed.topics || []).forEach((row) => { if (row && row.story) add([row.story]); });
    }
    return { schema: "globedesk.episode/2", stories: stories };
  }

  function load(doc) {
    empty();
    if (!doc) return state;
    const errs = (GD.schema && GD.schema.validateRecords) ? GD.schema.validateRecords(doc, recordsEpisode()) : ["schema missing"];
    state.errors = errs;
    state.loaded = true;
    if (errs.length) return state;
    state.doc = doc;
    state.catalogs = Array.isArray(doc.catalogs) ? doc.catalogs.slice() : [];
    buildNewsdeskLayers();
    return state;
  }

  function newsdeskLayers() {
    return (state.layers || []).slice();
  }

  function buildNewsdeskLayers() {
    state.layers = [];
    if (!state.catalogs.length) return;
    state.catalogs.forEach((c) => {
      if (!c || !c.layerId) return;
      const built = materializeLayer(c, { layerId: c.layerId, name: c.name });
      if (built && built.layer) state.layers.push(built.layer);
    });
  }

  function reload() {
    if (state.doc) load(state.doc);
    return state;
  }

  function fetchJson(url) {
    return fetch(url, { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null));
  }

  function boot(fetcher) {
    const get = fetcher || fetchJson;
    return Promise.resolve(get(PATH)).then((doc) => {
      load(doc);
      return state;
    }).catch(() => {
      empty();
      state.loaded = true;
      state.errors = ["records sidecar could not be loaded"];
      return state;
    });
  }

  function townsList() {
    const raw = (typeof window !== "undefined" && window.GD_REGIONS && window.GD_REGIONS["towns-index"]) || null;
    const rows = (raw && raw.towns) || [];
    return rows.map((t) => ({
      name: t[0], a3: t[1], adm1: t[2], lat: t[3], lon: t[4], kind: t[5], pop: t[6]
    }));
  }

  function lookupPlace(place) {
    if (!place || typeof place !== "string") return null;
    if (String(place).indexOf(U) >= 0) return null;
    const raw = String(place).replace(/\s+/g, " ").trim();
    if (!raw) return null;
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    const name = parts[0] || "";
    if (!name) return null;
    const region = (parts[1] || "").toLowerCase();
    let hits = townsList().filter((t) => t && t.name && t.name.toLowerCase() === name.toLowerCase());
    if (region) {
      const narrow = hits.filter((t) => {
        const adm = String(t.adm1 || "").toLowerCase();
        const a3 = String(t.a3 || "").toLowerCase();
        return adm === region || a3 === region;
      });
      if (narrow.length === 1) hits = narrow;
      else return null;
    } else if (hits.length !== 1) {
      return null;
    }
    const hit = hits[0];
    if (!hit || hit.lat == null || hit.lon == null) return null;
    return hit;
  }

  function citationIsReal(c) {
    if (!c || c.label == null) return false;
    const t = String(c.label).trim();
    if (!t) return false;
    if (t === U) return false;
    if (!t.replace(/\[UNKNOWN\]/g, "").trim()) return false;
    return true;
  }

  function citationsOk(row) {
    return !!(row && Array.isArray(row.citations) && row.citations.some(citationIsReal));
  }

  function placeIsUnknown(place) {
    const t = String(place || "").trim();
    if (!t) return true;
    return t.indexOf(U) >= 0;
  }

  function precisionIsUnknown(row) {
    return String(row && row.precision || "").trim().toLowerCase() === "unknown";
  }

  function resolveRecord(row) {
    if (!row) return { row: null, onMap: false, reason: "missing record" };
    if (!citationsOk(row)) return { row, onMap: false, lat: null, lon: null, how: null, gazetteer: null, reason: "missing citation" };
    if (placeIsUnknown(row.place)) return { row, onMap: false, lat: null, lon: null, how: null, gazetteer: null, reason: "unknown place" };
    if (precisionIsUnknown(row)) return { row, onMap: false, lat: null, lon: null, how: null, gazetteer: null, reason: "unknown precision" };
    const printed = row.lat != null && row.lon != null && isFinite(row.lat) && isFinite(row.lon);
    let lat = printed ? row.lat : null;
    let lon = printed ? row.lon : null;
    let how = printed ? "printed" : null;
    let gazetteer = null;
    if (!printed) {
      gazetteer = lookupPlace(row.place);
      if (gazetteer) {
        lat = gazetteer.lat;
        lon = gazetteer.lon;
        how = "gazetteer";
      }
    }
    const onMap = lat != null && lon != null;
    const reason = onMap ? (how === "gazetteer" ? "gazetteer" : "printed")
      : (gazetteer === null && !printed ? "no usable place" : "not on the map");
    return { row, onMap, lat, lon, how, gazetteer, reason };
  }

  function catalogById(id) {
    return state.catalogs.find((c) => c && (c.id === id || c.layerId === id)) || null;
  }

  function catalogsFor(args) {
    const all = state.catalogs.slice();
    if (!args) return all;
    return all.filter((c) => {
      if (args.recordCatalogId && c.id !== args.recordCatalogId) return false;
      if (args.layerId && c.layerId !== args.layerId && c.id !== args.layerId) return false;
      if (args.storyId && c.storyId !== args.storyId && !(c.records || []).some((r) => r && r.storyId === args.storyId)) return false;
      return true;
    });
  }

  function listed(args) {
    const cats = catalogsFor(args);
    const onMap = [], offMap = [];
    cats.forEach((c) => {
      (c.records || []).forEach((row) => {
        const resolved = resolveRecord(row);
        const item = { id: row.id, catalogId: c.id, layerId: c.layerId || "", storyId: row.storyId || c.storyId || "", onMap: resolved.onMap };
        if (resolved.onMap) onMap.push(item);
        else offMap.push(item);
      });
    });
    return {
      counts: { catalogs: cats.length, onMap: onMap.length, offMap: offMap.length, records: onMap.length + offMap.length },
      onMapIds: onMap.map((x) => x.id),
      offMapIds: offMap.map((x) => x.id),
      catalogs: cats.map((c) => ({ id: c.id, layerId: c.layerId || "", storyId: c.storyId || "", name: c.name }))
    };
  }

  function projectLayers(create) {
    const ep = GD.state && GD.state.episode;
    if (!ep) return null;
    if (!Array.isArray(ep.eventLayers)) {
      if (!create) return [];
      ep.eventLayers = [];
    }
    return ep.eventLayers;
  }

  function isoDate(s) {
    if (!s) return "";
    if (GD.schema && GD.schema.isIsoDate && GD.schema.isIsoDate(s)) return s;
    return "";
  }

  function featureFrom(row, resolved, catalog) {
    const E = GD.events;
    const credit = row.credit || catalog.credit || U;
    const license = row.license || catalog.license || U;
    const sources = (row.citations || []).map((c) => ({
      id: c.id || "",
      label: c.label,
      url: c.url || "",
      note: c.note || ""
    })).filter((s) => !s.url || (GD.schema && GD.schema.httpsOk(s.url)));
    const precisionLabel = row.precisionLabel
      || (resolved.how === "gazetteer"
        ? ("Precision: Natural Earth populated-place point for " + (resolved.gazetteer && resolved.gazetteer.name) + ", not an event fix")
        : (resolved.how === "printed" ? "Precision: official printed values, not a surveyed fix" : "Precision: [UNKNOWN]"));
    const props = {
      kind: "point",
      title: row.title,
      eventTime: isoDate(row.date),
      eventEnd: isoDate(row.dateEnd),
      timeApprox: !isoDate(row.date),
      datePrecision: isoDate(row.date) ? "day" : "unknown",
      category: "other",
      verification: "not verified",
      sources: sources,
      citation: { type: "official", date: row.date || U, credit: credit, license: license },
      notes: row.note || "",
      precisionLabel: precisionLabel,
      cardId: null,
      storyId: row.storyId || catalog.storyId || null,
      example: false
    };
    const geom = { type: "Point", coordinates: [resolved.lon, resolved.lat] };
    const f = E && E.createFeature ? E.createFeature("point", geom, props) : { type: "Feature", id: row.id, geometry: geom, properties: props };
    f.id = row.id;
    return f;
  }

  function materializeLayer(catalog, args) {
    const resolved = (catalog.records || []).map((row) => resolveRecord(row));
    const onMap = resolved.filter((r) => r.onMap);
    const offMap = resolved.filter((r) => !r.onMap);
    const layerId = (args && args.layerId) || catalog.layerId || ("evl-" + catalog.id);
    const name = (args && args.name) || catalog.name || "Records layer";
    const note = [catalog.credit, catalog.license, catalog.terms].filter(Boolean).join(" ");
    const layer = (GD.events && GD.events.createLayer)
      ? GD.events.createLayer(name, { id: layerId, color: "#38bdf8", icon: "★", note: note, scope: catalog.storyId ? "story" : "all" })
      : { id: layerId, name: name, color: "#38bdf8", icon: "★", visible: true, labels: true, styleByCategory: true, scope: catalog.storyId ? "story" : "all", note: note, features: [] };
    if (!layer.id) layer.id = layerId;
    layer.name = name;
    layer.note = note;
    layer.features = onMap.map((r) => featureFrom(r.row, r, catalog));
    return {
      ok: true,
      layer: layer,
      result: {
        catalogId: catalog.id,
        layerId: layer.id,
        name: layer.name,
        onMap: onMap.length,
        offMap: offMap.length,
        onMapIds: onMap.map((r) => r.row.id),
        offMapIds: offMap.map((r) => r.row.id)
      }
    };
  }

  function buildLayer(args) {
    const catalog = catalogById((args && args.recordCatalogId) || (args && args.layerId) || "");
    if (!catalog) return { ok: false, error: "unknown records catalog" };
    const layers = projectLayers(true);
    if (!layers) return { ok: false, error: "no episode is loaded" };
    const built = materializeLayer(catalog, args);
    let layer = layers.find((l) => l && l.id === built.layer.id);
    if (!layer) {
      layers.push(built.layer);
      layer = built.layer;
    } else {
      layer.name = built.layer.name;
      layer.note = built.layer.note;
      layer.features = built.layer.features;
    }
    if (GD.eventsMap && GD.eventsMap.refresh) GD.eventsMap.refresh();
    if (GD.ui && GD.ui.changed) GD.ui.changed();
    return { ok: true, result: built.result };
  }

  function clampCam(kf) {
    const lim = (GD.commands && GD.commands.LIMITS) || { lat: [-90, 90], lon: [-180, 180], zoom: [0, 24], pitch: [0, 85], bearing: [-360, 360], durationSec: [0, 120] };
    function clip(v, range, fallback) {
      const n = Number(v);
      if (!isFinite(n)) return fallback;
      return Math.min(range[1], Math.max(range[0], n));
    }
    const lon = clip(kf.center && kf.center[0], lim.lon, 0);
    const lat = clip(kf.center && kf.center[1], lim.lat, 0);
    return {
      center: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5],
      zoom: Math.round(Math.min(14, clip(kf.zoom, lim.zoom, 6)) * 100) / 100,
      pitch: clip(kf.pitch, lim.pitch, 45),
      bearing: clip(kf.bearing, lim.bearing, 0),
      durationSec: clip(kf.durationSec, lim.durationSec, 2),
      ease: kf.ease || "cinematic"
    };
  }

  function frameLayer(args) {
    const id = args && args.id;
    if (!id) return { ok: false, error: "frameLayer requires id" };
    const project = projectLayers(false) || [];
    const layer = project.find((l) => l && l.id === id) || newsdeskLayers().find((l) => l && l.id === id) || null;
    if (!layer) return { ok: false, error: "unknown layer: " + id };
    const features = (layer.features || []).filter((f) => f && f.geometry);
    if (GD.eventsMap && GD.eventsMap.frame) {
      const used = GD.eventsMap.frame(features);
      if (used) return { ok: true, result: { id: layer.id, camera: used } };
    }
    const b = GD.events && GD.events.bbox ? GD.events.bbox(features) : null;
    if (!b) return { ok: false, error: "nothing on the map to frame" };
    const single = b[0] === b[2] && b[1] === b[3];
    const kf = clampCam({
      center: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2],
      zoom: single ? 12.5 : 6,
      pitch: 45,
      bearing: 0,
      durationSec: 2,
      ease: "cinematic"
    });
    if (GD.globe && GD.globe.flyTo) GD.globe.flyTo(kf);
    return { ok: true, result: { id: layer.id, camera: kf } };
  }

  function parseCsv(text) {
    const lines = String(text || "").split(/\r?\n/).filter((ln) => ln.trim());
    if (!lines.length) return { error: "CSV is empty" };
    const cells = (ln) => {
      const out = [];
      let cur = "", q = false;
      for (let i = 0; i < ln.length; i++) {
        const ch = ln[i];
        if (q) {
          if (ch === '"' && ln[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') q = false;
          else cur += ch;
        } else if (ch === '"') q = true;
        else if (ch === ",") { out.push(cur); cur = ""; }
        else cur += ch;
      }
      out.push(cur);
      return out;
    };
    const header = cells(lines[0]).map((h) => h.trim().toLowerCase());
    const idx = (name) => header.indexOf(name);
    const need = ["title", "place"];
    if (need.some((n) => idx(n) < 0)) return { error: "CSV needs title and place columns" };
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const row = cells(lines[i]);
      const get = (n) => (idx(n) >= 0 ? row[idx(n)] : "");
      const rec = {
        id: get("id") || ("rec-csv-" + i),
        title: get("title"),
        kind: get("kind") || "event",
        place: get("place"),
        date: get("date") || U,
        citations: [],
        confidence: get("confidence") || "low",
        reconstruction: String(get("reconstruction")).toLowerCase() === "true"
      };
      if (get("lat") !== "" && get("lon") !== "") {
        rec.lat = Number(get("lat"));
        rec.lon = Number(get("lon"));
      }
      if (get("precisionlabel")) rec.precisionLabel = get("precisionlabel");
      if (get("credit")) rec.credit = get("credit");
      if (get("license")) rec.license = get("license");
      if (get("citation_label") || get("citation_url")) {
        rec.citations.push({ label: get("citation_label") || "Source", url: get("citation_url") || undefined });
      }
      records.push(rec);
    }
    return { records };
  }

  function ingest(text, opts) {
    const raw = String(text || "").trim();
    if (!raw) return { ok: false, error: "nothing to import" };
    let doc = null;
    if (raw.charAt(0) === "{" || raw.charAt(0) === "[") {
      try { doc = JSON.parse(raw); } catch (e) { return { ok: false, error: "JSON could not be parsed" }; }
      if (Array.isArray(doc)) doc = { schema: "globedesk.records/1", catalogs: [{ id: (opts && opts.id) || "records-imported", name: (opts && opts.name) || "Imported records", records: doc }] };
      else if (doc && Array.isArray(doc.records) && !doc.catalogs) {
        doc = { schema: "globedesk.records/1", catalogs: [{ id: doc.id || (opts && opts.id) || "records-imported", name: doc.name || (opts && opts.name) || "Imported records", kind: doc.kind, credit: doc.credit, license: doc.license, storyId: doc.storyId, layerId: doc.layerId, records: doc.records }] };
      }
    } else {
      const csv = parseCsv(raw);
      if (csv.error) return { ok: false, error: csv.error };
      doc = { schema: "globedesk.records/1", catalogs: [{ id: (opts && opts.id) || "records-imported", name: (opts && opts.name) || "Imported records", records: csv.records }] };
    }
    const errs = (GD.schema && GD.schema.validateRecords) ? GD.schema.validateRecords(doc, recordsEpisode()) : ["schema missing"];
    if (errs.length) return { ok: false, error: errs[0], errors: errs };
    load({ schema: "globedesk.records/1", catalogs: state.catalogs.concat(doc.catalogs) });
    if (state.errors.length) return { ok: false, error: state.errors[0], errors: state.errors.slice() };
    return { ok: true, result: { catalogs: doc.catalogs.map((c) => c.id) } };
  }

  function esc(v) {
    if (GD.sanitize && GD.sanitize.esc) return GD.sanitize.esc(v);
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function markUnknown(s) {
    return esc(s).replace(/\[UNKNOWN\]/g, '<span class="nd-unknown">[UNKNOWN]</span>');
  }

  function panelHtml() {
    const cats = state.catalogs;
    const options = cats.map((c, i) => `<option value="${esc(c.id)}"${i === 0 ? " selected" : ""}>${esc(c.name)} (${esc(c.id)})</option>`).join("");
    const first = cats[0];
    const listedFirst = first ? listed({ recordCatalogId: first.id }) : { counts: { onMap: 0, offMap: 0 }, offMapIds: [] };
    const off = first ? offMapRows(first.id) : [];
    return `<div class="item" id="evRecords"><h3><span class="sp">Build layer from records</span></h3>
      <p class="muted small">Paste or open a cited list (JSON or CSV matching globedesk.records/1). Only rows with a cited, usable place are written into an event layer. Off-map rows stay in the list. Nothing is geocoded online, and no coordinate is invented.</p>
      <label>Catalog<select id="evRecCatalog">${options || "<option value=\"\">No catalogs loaded</option>"}</select></label>
      <p class="small" id="evRecCounts">On the map: ${listedFirst.counts.onMap} · Not on the map: ${listedFirst.counts.offMap}</p>
      <div class="row2"><label>Credit<input id="evRecCredit" value="${esc(first && first.credit || "")}"></label><label>License<input id="evRecLicense" value="${esc(first && first.license || "")}"></label></div>
      <div class="row2"><label>Layer id<input id="evRecLayerId" value="${esc(first && first.layerId || "")}"></label><label>Layer name<input id="evRecName" value="${esc(first && first.name || "")}"></label></div>
      <label>Paste a cited list<textarea id="evRecPaste" rows="5" placeholder='{"schema":"globedesk.records/1","catalogs":[]}'></textarea></label>
      <div class="actions"><label class="btn small">Open file<input id="evRecFile" type="file" accept=".json,.csv,application/json,text/csv" hidden></label>
        <button type="button" id="evRecIngest" class="small">Add pasted list</button>
        <button type="button" id="evRecBuild" class="small" ${first ? "" : "disabled"}>Build layer</button></div>
      <div id="evRecOff">${offMapHtml(off)}</div>
    </div>`;
  }

  function offMapRows(catalogId) {
    const c = catalogById(catalogId);
    if (!c) return [];
    return (c.records || []).map((row) => ({ row, resolved: resolveRecord(row) })).filter((x) => !x.resolved.onMap);
  }

  function offMapHtml(rows) {
    if (!rows.length) return "<p class='muted small'>No off-map rows in this catalog.</p>";
    return `<h4>Not on the map (${rows.length})</h4><ul class="small ev-rec-off">${rows.map((x) => `<li><strong>${esc(x.row.title)}</strong> — ${markUnknown(x.row.place)}</li>`).join("")}</ul>`;
  }

  function fillPanel(root, catalogId) {
    const cat = catalogById(catalogId) || state.catalogs[0];
    if (!root || !cat) return;
    const counts = listed({ recordCatalogId: cat.id });
    const cEl = root.querySelector("#evRecCounts");
    if (cEl) cEl.textContent = "On the map: " + counts.counts.onMap + " · Not on the map: " + counts.counts.offMap;
    const set = (id, v) => { const n = root.querySelector(id); if (n) n.value = v || ""; };
    set("#evRecCredit", cat.credit);
    set("#evRecLicense", cat.license);
    set("#evRecLayerId", cat.layerId);
    set("#evRecName", cat.name);
    const off = root.querySelector("#evRecOff");
    if (off) off.innerHTML = offMapHtml(offMapRows(cat.id));
  }

  function wirePanel(root) {
    if (!root) return;
    const sel = root.querySelector("#evRecCatalog");
    if (sel && !sel._recWired) {
      sel._recWired = true;
      sel.addEventListener("change", function () { fillPanel(root, sel.value); });
    }
    const build = root.querySelector("#evRecBuild");
    if (build && !build._recWired) {
      build._recWired = true;
      build.addEventListener("click", function () {
        const id = sel && sel.value;
        const cat = catalogById(id);
        if (!cat) return;
        const credit = (root.querySelector("#evRecCredit") || {}).value;
        const license = (root.querySelector("#evRecLicense") || {}).value;
        if (credit != null) cat.credit = credit;
        if (license != null) cat.license = license;
        const out = buildLayer({
          recordCatalogId: cat.id,
          layerId: (root.querySelector("#evRecLayerId") || {}).value || cat.layerId,
          name: (root.querySelector("#evRecName") || {}).value || cat.name
        });
        if (GD.ui && GD.ui.toast) GD.ui.toast(out.ok ? ("Wrote " + out.result.onMap + " on-map feature(s); " + out.result.offMap + " stayed off the map.") : out.error);
        if (out.ok && GD.eventsUI && GD.eventsUI.changed) GD.eventsUI.changed();
      });
    }
    const ingestBtn = root.querySelector("#evRecIngest");
    if (ingestBtn && !ingestBtn._recWired) {
      ingestBtn._recWired = true;
      ingestBtn.addEventListener("click", function () {
        const area = root.querySelector("#evRecPaste");
        const out = ingest(area && area.value);
        if (GD.ui && GD.ui.toast) GD.ui.toast(out.ok ? "Added the pasted catalog." : out.error);
        if (out.ok && GD.eventsUI && GD.eventsUI.changed) GD.eventsUI.changed();
      });
    }
    const file = root.querySelector("#evRecFile");
    if (file && !file._recWired) {
      file._recWired = true;
      file.addEventListener("change", function () {
        const f = file.files && file.files[0];
        if (!f || !f.text) return;
        f.text().then((text) => {
          const out = ingest(text, { name: f.name });
          if (GD.ui && GD.ui.toast) GD.ui.toast(out.ok ? "Added the file catalog." : out.error);
          if (out.ok && GD.eventsUI && GD.eventsUI.changed) GD.eventsUI.changed();
        });
      });
    }
  }

  function mountOffMap(parent, story) {
    if (!parent) return null;
    const storyId = story && (story.id || story.slug);
    const rows = [];
    catalogsFor(storyId ? { storyId: storyId } : null).forEach((c) => {
      offMapRows(c.id).forEach((x) => {
        if (!storyId || x.row.storyId === storyId || c.storyId === storyId) rows.push({ catalog: c, row: x.row });
      });
    });
    if (!rows.length) return null;
    const box = (typeof document !== "undefined") ? document.createElement("section") : parent;
    box.className = "nd-offmap";
    const h = document.createElement("h4");
    h.textContent = "Not on the map (" + rows.length + ")";
    box.appendChild(h);
    const p = document.createElement("p");
    p.className = "muted small";
    p.textContent = "These cited records have no usable place, so they are not pinned.";
    box.appendChild(p);
    const ul = document.createElement("ul");
    ul.className = "small";
    rows.forEach((x) => {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = x.row.title || x.row.id;
      li.appendChild(strong);
      li.appendChild(document.createTextNode(" — "));
      const place = document.createElement("span");
      const parts = String(x.row.place || "").split(/(\[UNKNOWN\])/);
      parts.forEach((part) => {
        if (part === U) {
          const mark = document.createElement("span");
          mark.className = "nd-unknown";
          mark.textContent = U;
          place.appendChild(mark);
        } else if (part) place.appendChild(document.createTextNode(part));
      });
      li.appendChild(place);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    parent.appendChild(box);
    return box;
  }

  function layerCreditFor(story) {
    const storyId = story && (story.id || story.slug);
    if (!storyId) return [];
    const out = [];
    const seen = {};
    catalogsFor({ storyId: storyId }).forEach((c) => {
      const layers = (projectLayers(false) || []).concat(newsdeskLayers());
      const layer = layers.find((l) => l && l.id === c.layerId) || null;
      if (seen[c.id]) return;
      seen[c.id] = true;
      out.push({ catalogId: c.id, layerId: c.layerId, name: (layer && layer.name) || c.name, credit: c.credit || "", visible: !!(layer && layer.features && layer.features.length) });
    });
    return out;
  }

  function mountStrip(parent, story) {
    if (!parent || !story) return null;
    parent.textContent = "";
    const credits = layerCreditFor(story);
    if (credits.length) {
      credits.forEach((c) => {
        const p = document.createElement("p");
        p.className = "nd-layer-credit";
        p.textContent = (c.visible ? "Event layer: " : "Records catalog: ") + c.name + (c.credit ? " · " + c.credit : "");
        parent.appendChild(p);
      });
    }
    mountOffMap(parent, story);
    return parent;
  }

  GD.records = {
    PATH, state, load, boot, reload, empty, listed, lookupPlace, resolveRecord,
    catalogById, buildLayer, frameLayer, ingest, parseCsv, panelHtml, wirePanel,
    mountOffMap, mountStrip, layerCreditFor, catalogsFor, newsdeskLayers, recordsEpisode
  };
})();
