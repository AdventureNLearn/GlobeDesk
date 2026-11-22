/* Events tab: draw tools, layer manager, feature editor, event clock, import/export. window.GD.eventsUI */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const E = () => GD.events, M = () => GD.eventsMap, S = () => GD.state;
  const esc = (v) => GD.ui.esc(v), field = (...a) => GD.ui.field(...a);
  const U = "[UNKNOWN]";

  function changed() { GD.ui.changed(); }
  function open() { S().tab = "events"; GD.ui.renderInspector(); }
  function layers() { return S().episode.eventLayers; }
  const fmt = (ms) => (ms == null ? "all" : new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC");

  function tickClock() {
    const out = document.getElementById("evClockLabel");
    if (out) out.textContent = fmt(M().clock());
  }

  function render(root) {
    const st = S(), ep = st.episode, story = ep.stories[st.storyIdx], em = M().em;
    const cur = M().currentLayer();
    const sel = em.selected ? M().find(em.selected) : null;
    const tr = E().timeRange(layers());
    const modeBtn = (m, label) => `<button data-mode="${m}" class="${em.mode === m ? "on" : ""}" title="${label}">${label}</button>`;
    root.innerHTML = `
      <div class="item"><h3><span class="sp">Draw on the globe</span></h3>
        <div class="actions">${modeBtn("select", "Select")}${modeBtn("point", "• Point")}${modeBtn("line", "〰 Route")}${modeBtn("polygon", "▱ Zone")}${modeBtn("ring", "◎ Radius")}
          <button id="evFinish" ${em.mode === "line" || em.mode === "polygon" ? "" : "disabled"}>Finish (or double-click)</button></div>
        <p class="muted small">${{ select: "Click a feature on the globe to edit it.", point: "Click the globe to drop a point.", line: "Click points along the route, then Finish.", polygon: "Click the zone's corners, then Finish.", ring: "Click the center; set the radius below." }[em.mode]}
          New features go into <strong>${esc(cur.name)}</strong> and link to story ${st.storyIdx + 1}.</p>
        <label>Snap to a place (bundled gazetteer)<input id="evPlace" placeholder="Town or city"></label><ul id="evPlaceHits" class="suggest"></ul>
      </div>
      <div class="item"><h3><span class="sp">Event clock</span><span id="evClockLabel" class="pill">${esc(fmt(M().clock()))}</span></h3>
        <label>Mode<select id="evClockMode">
          <option value="follow" ${st.eventClockMode === "follow" ? "selected" : ""}>Follow playback (story event window)</option>
          <option value="manual" ${st.eventClockMode === "manual" ? "selected" : ""}>Manual slider (when paused)</option>
          <option value="all" ${st.eventClockMode === "all" ? "selected" : ""}>Show all events</option></select></label>
        ${tr ? `<input id="evClock" type="range" min="${tr.start}" max="${Math.max(tr.end, tr.start + 1)}" step="60000" value="${st.eventClockManual == null ? tr.end : st.eventClockManual}" aria-label="Event time">
          <p class="muted small">${esc(fmt(tr.start))} → ${esc(fmt(tr.end))}</p>` : '<p class="muted small">No dated features yet.</p>'}
        <div class="row2">${field("Story window start (ISO)", story.eventWindow.start, 'id="ewStart" placeholder="2026-11-20T06:00"')}${field("Story window end (ISO)", story.eventWindow.end, 'id="ewEnd" placeholder="2026-11-20T18:00"')}</div>
        <p class="muted small">During playback the clock sweeps this window over the story, revealing features by event date and drawing routes from start to end time.</p>
      </div>
      <div class="item"><h3><span class="sp">Event layers</span><button id="evAddLayer" class="small">+ Layer</button><label class="btn small">Import<input id="evImport" type="file" accept=".geojson,.json,.csv,.kml" hidden></label></h3>
        ${layers().map((l, i) => `<div class="item ev-layer-item${l.id === cur.id ? " on" : ""}" data-layer="${i}">
          <h3><input type="checkbox" data-lf="${i}.visible" ${l.visible ? "checked" : ""} title="Show"><span class="sp"><button data-pick="${i}" class="ghost small">${esc(l.icon)} ${esc(l.name)} (${l.features.length})</button></span>
            <button data-lop="${i}.up" class="small" title="Up">↑</button><button data-lop="${i}.down" class="small" title="Down">↓</button><button data-lop="${i}.frame" class="small">Frame</button><button data-lop="${i}.del" class="small" title="Delete">✕</button></h3>
          ${l.id === cur.id ? `${field("Name", l.name, `data-lf="${i}.name"`)}
          <div class="row3">${field("Color", l.color, `data-lf="${i}.color" type="color"`)}<label>Icon<select data-lf="${i}.icon">${E().ICONS.map((ic) => `<option ${ic === l.icon ? "selected" : ""}>${ic}</option>`).join("")}</select></label>
            <label>Scope<select data-lf="${i}.scope"><option value="all">All stories</option><option value="story" ${l.scope === "story" ? "selected" : ""}>Linked story only</option></select></label></div>
          <label><input type="checkbox" data-lf="${i}.labels" ${l.labels ? "checked" : ""}> Labels on globe</label>
          <label><input type="checkbox" data-lf="${i}.styleByCategory" ${l.styleByCategory ? "checked" : ""}> Color by category</label>
          ${field("Layer note", l.note, `data-lf="${i}.note"`)}
          <div class="actions"><button data-exp="${i}.geojson" class="small">.geojson</button><button data-exp="${i}.csv" class="small">.csv</button><button data-exp="${i}.kml" class="small">.kml</button><button data-exp="${i}.kf" class="small">+ Camera keyframe framing this layer</button></div>` : ""}
        </div>`).join("") || "<p class='muted'>No layers yet. Draw something or click + Layer.</p>"}
        <p class="muted small">Categories: ${Object.values(E().CATEGORIES).map((c) => `<span class="ev-cat" data-color="${esc(c.color)}">${c.icon} ${esc(c.label)}</span>`).join(" · ")}</p>
      </div>
      ${(GD.records && GD.records.panelHtml) ? GD.records.panelHtml() : ""}
      ${sel ? featureEditor(sel) : ""}
      ${unlocatedList()}`;
    root.querySelectorAll(".ev-cat").forEach((n) => { const c = n.getAttribute("data-color"); if (c) n.style.color = c; });
    wire(root, story, cur, sel);
    if (GD.records && GD.records.wirePanel) GD.records.wirePanel(root);
  }

  function unlocatedList() {
    const u = M().unlocated();
    if (!u.length) return "";
    return `<div class="item"><h3>Not on the map (${u.length})</h3><p class="muted small">Imported rows with no coordinates stay here; nothing is placed on a guessed spot.</p>
      <ul class="small">${u.map(({ f }) => `<li><button class="ghost small" data-sel="${esc(f.id)}">${esc(f.properties.title)}</button> — ${esc(E().timeLabel(f.properties))}</li>`).join("")}</ul></div>`;
  }

  function featureEditor({ l, f }) {
    const p = f.properties, ep = S().episode;
    const story = ep.stories.find((s) => s.id === p.storyId);
    return `<div class="item" id="evEditor"><h3><span class="sp">Edit ${esc(p.kind)}${p.example ? ' <span class="pill warn">EXAMPLE PLACEHOLDER</span>' : ""}</span><button id="evFrame" class="small">Frame</button><button id="evDel" class="small">Delete</button></h3>
      ${field("Title", p.title, 'data-ff="title"')}
      <div class="row2">${field("Event date/time (ISO)", p.eventTime, 'data-ff="eventTime" placeholder="YYYY-MM-DD or YYYY-MM-DDTHH:MM"')}${field("End (routes, optional)", p.eventEnd, 'data-ff="eventEnd" placeholder="ISO"')}</div>
      <div class="row2"><label><input type="checkbox" data-ff="timeApprox" ${p.timeApprox ? "checked" : ""}> Time is approximate</label>${field("Date precision", p.datePrecision, 'data-ff="datePrecision"')}</div>
      <div class="row2"><label>Category<select data-ff="category">${Object.entries(E().CATEGORIES).map(([k, c]) => `<option value="${k}" ${k === p.category ? "selected" : ""}>${c.icon} ${esc(c.label)}</option>`).join("")}</select></label>
        <label>Verification<select data-ff="verification">${E().VERIF.map((v) => `<option ${v === p.verification ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>
      ${p.kind === "ring" ? field("Radius (km)", p.radiusKm, 'data-ff="radiusKm" type="number" min="0.1" step="0.1"') : ""}
      ${f.geometry && f.geometry.type === "Point" ? `<div class="row2">${field("Latitude", f.geometry.coordinates[1], 'data-geo="1" type="number" step="0.00001"')}${field("Longitude", f.geometry.coordinates[0], 'data-geo="0" type="number" step="0.00001"')}</div>` : `<p class="muted small">${f.geometry ? `${f.geometry.type} with ${(f.geometry.type === "Polygon" ? f.geometry.coordinates[0].length - 1 : f.geometry.coordinates.length)} points` : "No geometry (not on the map)"}</p>`}
      ${field("Precision label", p.precisionLabel, 'data-ff="precisionLabel"')}
      <label>Sources (one per line: label | https://link)<textarea data-ff="sources">${esc((p.sources || []).map((s) => `${s.label || U} | ${s.url || ""}`).join("\n"))}</textarea></label>
      <div class="row2">${field("Citation: media type", p.citation.type, 'data-fc="type"')}${field("Citation: date", p.citation.date, 'data-fc="date"')}</div>
      <div class="row2">${field("Citation: credit", p.citation.credit, 'data-fc="credit"')}${field("Citation: license", p.citation.license, 'data-fc="license"')}</div>
      <label>Notes<textarea data-ff="notes">${esc(p.notes)}</textarea></label>
      <div class="row2"><label>Linked story<select data-ff="storyId"><option value="">None</option>${ep.stories.map((s, i) => `<option value="${esc(s.id)}" ${s.id === p.storyId ? "selected" : ""}>${i + 1}. ${esc(s.title)}</option>`).join("")}</select></label>
        <label>Linked topic card<select data-ff="cardId"><option value="">None</option>${(story ? story.cards : []).map((c) => `<option value="${esc(c.id)}" ${c.id === p.cardId ? "selected" : ""}>${esc(c.title)}</option>`).join("")}</select></label></div>
      <p class="muted small">Layer: ${esc(l.name)}. ${E().validateFeature(f).map((m) => `<span class="pill warn">${esc(m)}</span>`).join(" ")}</p></div>`;
  }

  function exportLayer(l, kind) {
    const base = (GD.ui.slug() + "-" + l.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (kind === "geojson") GD.ui.download(base + ".geojson", JSON.stringify(E().toGeoJSON(l), null, 2), "application/geo+json");
    if (kind === "csv") GD.ui.download(base + ".csv", E().toCSV(l), "text/csv");
    if (kind === "kml") GD.ui.download(base + ".kml", E().toKML(l), "application/vnd.google-earth.kml+xml");
  }

  function wire(root, story, cur, sel) {
    const st = S();
    root.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { M().setMode(b.dataset.mode); render(root); }));
    const fin = root.querySelector("#evFinish"); if (fin) fin.addEventListener("click", () => { M().finish(); render(root); });
    // Snap to place: moves a selected point/ring there, adds a vertex while drawing, or drops a point.
    const q = root.querySelector("#evPlace"), hits = root.querySelector("#evPlaceHits");
    q.addEventListener("input", () => {
      hits.innerHTML = "";
      GD.globe.searchPlaces(q.value, 6).forEach((pl) => {
        const li = document.createElement("li"), b = document.createElement("button");
        b.textContent = `${pl.name} — ${pl.a3} (${pl.lat}, ${pl.lon})`;
        b.addEventListener("click", () => {
          const c = [pl.lon, pl.lat], em = M().em, s = sel && sel.f;
          if (em.mode === "line" || em.mode === "polygon" || em.mode === "point" || em.mode === "ring") M().addVertex(c);
          else if (s && s.geometry && s.geometry.type === "Point") { s.geometry.coordinates = c; s.properties.precisionLabel = `Precision: snapped to gazetteer point for ${pl.name} (Natural Earth populated-place point, not an event fix)`; }
          else { M().setMode("point"); const f = M().addVertex(c); M().setMode("select"); if (f) f.properties.precisionLabel = `Precision: gazetteer point for ${pl.name} (Natural Earth populated-place point, not an event fix)`; }
          GD.globe.flyTo({ center: c, zoom: 11, pitch: 45, bearing: 0, durationSec: 1.6 });
          changed(); render(root);
        });
        li.appendChild(b); hits.appendChild(li);
      });
    });
    root.querySelector("#evClockMode").addEventListener("change", (e) => { st.eventClockMode = e.target.value; M().refresh(); GD.ui.renderOverlays(); tickClock(); });
    const sl = root.querySelector("#evClock");
    if (sl) sl.addEventListener("input", () => { st.eventClockMode = "manual"; root.querySelector("#evClockMode").value = "manual"; st.eventClockManual = Number(sl.value); M().refresh(); GD.ui.renderOverlays(); tickClock(); });
    const win = (k, el) => el.addEventListener("change", () => { if (el.value && E().parseTime(el.value) == null) return GD.ui.toast("Use ISO time, e.g. 2026-11-20T06:00"); story.eventWindow[k] = el.value.trim(); changed(); });
    win("start", root.querySelector("#ewStart")); win("end", root.querySelector("#ewEnd"));
    root.querySelector("#evAddLayer").addEventListener("click", () => { const l = E().createLayer(`Event layer ${layers().length + 1}`); layers().push(l); st.eventLayerId = l.id; changed(); render(root); });
    root.querySelector("#evImport").addEventListener("change", async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const text = await file.text(), nm = file.name.replace(/\.[^.]+$/, "");
        const res = /\.csv$/i.test(file.name) ? E().fromCSV(text, nm) : /\.kml$/i.test(file.name) ? E().fromKML(text, nm) : E().fromGeoJSON(JSON.parse(text), nm);
        layers().push(res.layer); st.eventLayerId = res.layer.id; changed(); render(root);
        GD.ui.toast(`Imported ${res.layer.features.length} feature(s)${res.skipped.length ? `, skipped ${res.skipped.length} (see console)` : ""}.`);
        if (res.skipped.length) console.warn("Event import skipped:", res.skipped);
      } catch (err) { GD.ui.toast("Import failed: " + err.message); }
      e.target.value = "";
    });
    root.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => { st.eventLayerId = layers()[Number(b.dataset.pick)].id; render(root); }));
    root.querySelectorAll("[data-lf]").forEach((el) => el.addEventListener("change", () => {
      const [i, k] = el.dataset.lf.split("."); const l = layers()[Number(i)];
      l[k] = el.type === "checkbox" ? el.checked : el.value; changed(); render(root);
    }));
    root.querySelectorAll("[data-lop]").forEach((b) => b.addEventListener("click", () => {
      const [i0, op] = b.dataset.lop.split("."), i = Number(i0), arr = layers();
      if (op === "up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
      if (op === "down" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
      if (op === "del" && confirm(`Delete layer "${arr[i].name}" and its ${arr[i].features.length} feature(s)?`)) arr.splice(i, 1);
      if (op === "frame") M().frame(arr[i].features);
      changed(); render(root);
    }));
    root.querySelectorAll("[data-exp]").forEach((b) => b.addEventListener("click", () => {
      const [i, k] = b.dataset.exp.split("."), l = layers()[Number(i)];
      if (k === "kf") {
        const kf = M().frame(l.features, { dry: true }); if (!kf) return;
        const lt = Math.max(0, st.t - GD.model.storyStarts(st.episode)[st.storyIdx]);
        story.camera.push(Object.assign({ id: GD.model.uid("kf"), preset: "overview", at: Math.round(lt * 10) / 10, cut: true, citation: { type: "Map", date: "auto", credit: "auto", license: "auto" } }, kf));
        story.camera.sort((a, b2) => a.at - b2.at); changed(); GD.ui.toast("Keyframe added at the playhead.");
      } else exportLayer(l, k);
    }));
    root.querySelectorAll("[data-sel]").forEach((b) => b.addEventListener("click", () => { M().select(b.dataset.sel); render(root); }));
    if (!sel) return;
    const f = sel.f, p = f.properties;
    root.querySelectorAll("[data-ff]").forEach((el) => el.addEventListener("change", () => {
      const k = el.dataset.ff;
      if (k === "timeApprox") p.timeApprox = el.checked;
      else if (k === "radiusKm") p.radiusKm = Math.max(0.1, Number(el.value) || p.radiusKm);
      else if (k === "sources") {
        const list = el.value.split("\n").map((ln) => ln.trim()).filter(Boolean).map((ln) => { const [a, b] = ln.split("|").map((x) => (x || "").trim()); return (GD.sanitize && GD.sanitize.isHttpsUrl(a)) ? { label: U, url: a } : { label: a || U, url: b || "" }; });
        if (list.some((s) => s.url && !(GD.sanitize && GD.sanitize.isHttpsUrl(s.url)))) return GD.ui.toast("Source links must be https (no userinfo).");
        p.sources = list;
      } else if ((k === "eventTime" || k === "eventEnd") && el.value && E().parseTime(el.value) == null) return GD.ui.toast("Use ISO time, e.g. 2026-11-20 or 2026-11-20T14:30");
      else if (k === "verification" && el.value === "verified" && !(p.sources || []).some((s) => s.url)) { el.value = p.verification; return GD.ui.toast("Add a source link before marking verified."); }
      else p[k] = k === "storyId" || k === "cardId" ? el.value || null : el.value;
      changed(); render(root);
    }));
    root.querySelectorAll("[data-fc]").forEach((el) => el.addEventListener("change", () => { p.citation[el.dataset.fc] = el.value; changed(); }));
    root.querySelectorAll("[data-geo]").forEach((el) => el.addEventListener("change", () => {
      const v = Number(el.value), i = Number(el.dataset.geo);
      if (!isFinite(v) || Math.abs(v) > (i ? 90 : 180)) return GD.ui.toast("Coordinate out of range.");
      f.geometry.coordinates[i] = v; changed();
    }));
    root.querySelector("#evFrame").addEventListener("click", () => M().frame([f]));
    root.querySelector("#evDel").addEventListener("click", () => { sel.l.features.splice(sel.l.features.indexOf(f), 1); M().em.selected = null; changed(); render(root); });
  }

  GD.eventsUI = { render, changed: () => { changed(); if (S().tab === "events") GD.ui.renderInspector(); }, open, tickClock };
})();
