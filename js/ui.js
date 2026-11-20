/* GlobeDesk editor UI. Classic script; wires panels, inspector tabs, media bin, export. window.GD.ui */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const U = "[UNKNOWN]";
  const escNum = (v) => esc(Number(v));
  const httpsOk = (v) => (GD.sanitize && GD.sanitize.isHttpsUrl) ? GD.sanitize.isHttpsUrl(v) : false;

  function revokeLater(url) {
    if (!url || String(url).indexOf("blob:") !== 0) return;
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ } }, 2000);
  }

  GD.state = { episode: null, storyIdx: 0, t: 0, playing: false, recording: false, tab: "story", blobs: {}, browserVoice: false,
    eventClockMode: "follow", eventClockManual: null, eventLayerId: null,
    ov: { cards: [], captions: [], media: [], citations: [], outro: false } };
  const S = GD.state;
  const story = () => S.episode.stories[S.storyIdx];
  const fmtT = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toast._h); toast._h = setTimeout(() => t.classList.remove("on"), 2600);
  }

  // ---------- Episode lifecycle ----------
  function loadEpisode(ep, why) {
    if (GD.model.normalizeEpisode) GD.model.normalizeEpisode(ep);
    const errs = (GD.schema && GD.schema.validate) ? GD.schema.validate(ep) : GD.model.validate(ep);
    if (errs.length) { toast("Episode not loaded: " + errs[0]); console.warn("validate:", errs); return false; }
    // Fill look/outro defaults for older files.
    ep.look = Object.assign(GD.themes.lookFor((ep.look && ep.look.theme) || "ctd"), ep.look || {});
    ep.outro = Object.assign({ enabled: true, durationSec: 5, line1: "Full brief on the channel", link: "[channel link]", handle: "@[handle]", showXLogo: true }, ep.outro || {});
    ep.mediaBin = ep.mediaBin || [];
    ep.eventLayers = ep.eventLayers || [];
    ep.stories.forEach((st) => { st.eventWindow = st.eventWindow || { start: "", end: "" }; });
    S.episode = ep; S.storyIdx = 0; S.t = 0;
    GD.globe.st.active = 0;
    S.eventLayerId = ep.eventLayers[0] ? ep.eventLayers[0].id : null;
    if (GD.eventsMap) { GD.eventsMap.em.selected = null; GD.eventsMap.setMode("select"); }
    GD.globe.setEpisode(ep, 0);
    GD.globe.refresh();
    renderAll();
    GD.playback.seek(0);
    if (!(ep.stories[0].camera || []).length && GD.globe.st.map) GD.globe.st.map.jumpTo({ center: [40, 28], zoom: 1.6, pitch: 0, bearing: 0 });
    if (GD.content) { GD.content.clear(); GD.content.render(); }
    if (GD.store) GD.store.schedule(ep);
    if (why) toast(why);
    return true;
  }

  function download(name, text, type) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(new Blob([text], { type: type || "application/json" }));
    a.href = url;
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    revokeLater(url);
  }
  const slug = () => (S.episode.date || "episode") + "-" + String(S.episode.show || "globedesk").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // ---------- Rendering ----------
  function renderAll() {
    $("epTitle").value = S.episode.title;
    renderRundown(); renderBin(); renderInspector(); renderTransport(); applyAspect(S.episode.output.aspect || "16:9"); renderOverlays();
  }

  function renderRundown() {
    const ol = $("rundown"); ol.innerHTML = "";
    S.episode.stories.forEach((s, i) => {
      const li = document.createElement("li");
      li.className = i === S.storyIdx ? "on" : "";
      li.innerHTML = `<span class="ops"><button data-op="up" title="Move up">↑</button><button data-op="down" title="Move down">↓</button><button data-op="dup" title="Duplicate">⧉</button><button data-op="del" title="Delete">✕</button></span>
        <span class="n">${escNum(i + 1)}</span><strong title="${esc(s.title)}">${esc(s.title)}</strong>
        <div class="meta" title="${esc(s.location.name)}">${esc(s.location.name)} • ${escNum(s.durationSec)}s • ${escNum((s.cards || []).length)} card(s) • ${escNum((s.camera || []).filter((k) => k.cut !== false).length)} shot(s)
        ${s.location.verified ? '<span class="pill ok">location verified</span>' : '<span class="pill warn">not verified</span>'}
        ${s.asReported !== false ? '<span class="pill warn">as reported</span>' : ""}</div>`;
      li.addEventListener("click", (e) => {
        const op = e.target.dataset && e.target.dataset.op;
        if (op) { e.stopPropagation(); return storyOp(op, i); }
        selectStory(i, { fly: true });
      });
      ol.appendChild(li);
    });
  }

  function storyOp(op, i) {
    const arr = S.episode.stories;
    if (op === "up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    if (op === "down" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    if (op === "dup") { arr.splice(i + 1, 0, GD.model.duplicateStory(arr[i])); S.storyIdx = i + 1; changed(); return; }
    if (op === "del") { if (arr.length === 1) return toast("An episode needs at least one story."); arr.splice(i, 1); }
    S.storyIdx = Math.min(S.storyIdx, arr.length - 1);
    changed();
  }

  function selectStory(i, opts) {
    S.storyIdx = i;
    const start = GD.model.storyStarts(S.episode)[i];
    GD.playback.seek(start + 0.01);
    if (opts && opts.fly) {
      const s = story(), kf = (s.camera || [])[0];
      if (kf) GD.globe.flyTo(Object.assign({}, kf, { durationSec: 2.2 }));
    }
    renderRundown(); renderInspector(); renderTransport();
  }

  function changed() {
    GD.globe.setEpisode(S.episode);
    if (GD.eventsMap) GD.eventsMap.refresh();
    renderRundown(); renderInspector(); renderTransport(); renderOverlays();
    if (GD.content) GD.content.render();
    if (GD.store) GD.store.schedule(S.episode);
  }

  function renderTransport() {
    const total = GD.model.totalDuration(S.episode);
    $("time").textContent = `${fmtT(S.t)} / ${fmtT(total)}`;
    const sc = $("scrub"); sc.max = String(total); sc.value = String(S.t);
    $("btnPlay").textContent = S.playing ? "❚❚" : "▶";
    $("btnPlay").setAttribute("aria-label", S.playing ? "Pause" : "Play");
    const seg = $("segments"); seg.innerHTML = "";
    S.episode.stories.forEach((s, i) => {
      const d = document.createElement("div");
      d.style.flex = String(s.durationSec || 1);
      d.className = i === S.storyIdx && !S.ov.outro ? "on" : "";
      d.title = `${i + 1}. ${s.title}`;
      (s.camera || []).filter((k) => k.cut !== false && k.at > 0).forEach((k) => {
        const tick = document.createElement("i"); tick.style.left = `${(k.at / s.durationSec) * 100}%`; tick.title = "cut"; d.appendChild(tick);
      });
      seg.appendChild(d);
    });
    if (S.episode.outro.enabled) { const d = document.createElement("div"); d.className = "outro"; d.style.flex = String(S.episode.outro.durationSec); d.title = "Outro card"; seg.appendChild(d); }
  }

  // Preview overlay uses the same painter as the recorder, so what you see is what records.
  function renderOverlays() {
    const cv = $("ov"), r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    const map = GD.globe.st.map, k = map ? cv.width / (map.getContainer().clientWidth || cv.width) : 1;
    const proj = map ? (ll) => { const p = map.project(ll); return [p.x * k, p.y * k]; } : null;
    if (cv.width && S.episode) GD.recorder.paintOverlays(ctx, cv.width, cv.height, proj);
    renderMediaLayer();
    if (GD.content) GD.content.render();
    syncHits();
    // Readable (DOM) view: cards + captions as real text. Full title and citations (no truncation).
    const box = $("readable"), s = story();
    if (S.ov.outro) { const o = S.episode.outro; box.innerHTML = `<p><strong>${esc(o.line1)}</strong><br>${esc(o.link)}<br>${esc(o.handle)}</p>`; }
    else box.innerHTML = `<p class="muted small">${esc(S.episode.look.headerBadge || "")} — <span title="${esc(s.title)}">${esc(s.title)}</span>${S.episode.sample || S.episode.demo ? ' <span class="pill warn">Sample</span>' : ""}</p>` +
      S.ov.citations.map((c) => `<p class="small" title="${esc(c)}">Source box: ${esc(c)}</p>`).join("") +
      S.ov.cards.map((c) => `<article><strong>${esc(c.title)}</strong> <span class="pill ${c.verified ? "ok" : "warn"}">${c.verified ? "verified" : "unverified"}</span><p>${esc(c.body)}</p>${c.why && c.why !== U ? `<p><em>Why it matters:</em> ${esc(c.why)}</p>` : ""}</article>`).join("") +
      (S.ov.captions.length ? `<p class="cap">${esc(S.ov.captions.join(" "))}</p>` : "") +
      (GD.eventsMap ? (() => { const r = GD.eventsMap.readable(); return r.length ? `<p class="small"><strong>Events on the globe (${r.length}):</strong></p><ul class="small">${r.map((e) => `<li>${esc(e.title)} — ${esc(e.time)} — ${esc(e.category)} — <strong>${esc(e.verification)}</strong> — ${esc(e.precision)}${e.example ? " — EXAMPLE PLACEHOLDER" : ""}</li>`).join("")}</ul>` : ""; })() : "");
    if (S.playing) { const sc = $("scrub"); sc.value = String(S.t); $("time").textContent = `${fmtT(S.t)} / ${fmtT(GD.model.totalDuration(S.episode))}`; }
    if (renderOverlays._idx !== S.storyIdx) {
      renderOverlays._idx = S.storyIdx; renderRundown(); renderTransport();
      if (!$("inspector").contains(document.activeElement)) renderInspector();
    }
  }

  const mediaEls = {};
  function renderMediaLayer() {
    const layer = $("mediaLayer");
    const want = (S.ov.media || []).map((m) => m.mediaRef).filter((ref) => S.blobs[ref]);
    Array.from(layer.children).forEach((el) => { if (!want.includes(el.dataset.ref)) { if (el.pause) el.pause(); el.remove(); } });
    want.forEach((ref) => {
      if (layer.querySelector(`[data-ref="${CSS.escape(ref)}"]`)) return;
      const bin = S.episode.mediaBin.find((b) => b.ref === ref);
      const el = document.createElement(bin && bin.kind === "video" ? "video" : "img");
      el.dataset.ref = ref; el.src = S.blobs[ref];
      if (el.tagName === "VIDEO") { el.muted = false; el.playsInline = true; GD.recorder.connectMedia(el); if (S.playing) el.play().catch(() => {}); }
      el.alt = bin ? bin.name : "";
      layer.appendChild(el);
      mediaEls[ref] = el;
    });
    S.mediaEls = want.map((r) => mediaEls[r]).filter(Boolean);
  }

  // ---------- Inspector ----------
  function field(label, value, attrs) {
    return `<label>${esc(label)}<input ${attrs || ""} value="${esc(value)}"></label>`;
  }

  function renderInspector() {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === S.tab));
    const el = $("inspector"), s = story();
    const R = { story: tabStory, camera: tabCamera, cards: tabCards, sources: tabSources, captions: tabCaptions, shots: tabShots, look: tabLook, layers: tabLayers, events: (root) => GD.eventsUI.render(root), sound: tabSound, place: (root, st) => GD.content.tab(root, st), assist: (root) => GD.assistant.tab(root) }[S.tab];
    el.innerHTML = "";
    R(el, s);
  }

  function bind(root, sel, fn, ev) { root.querySelectorAll(sel).forEach((n) => n.addEventListener(ev || "change", (e) => fn(e.target, e))); }
  const num = (v, d) => (v === "" || v == null || isNaN(Number(v)) ? d : Number(v));

  function tabStory(el, s) {
    const loc = s.location, ins = GD.globe.insight(loc.lat, loc.lon, 5);
    const countries = GD.globe.countryList();
    el.innerHTML = `
      ${field("Story title", s.title, 'data-k="title"')}
      <label>Summary / body<textarea data-k="summary">${esc(s.summary || "")}</textarea></label>
      <div class="row2">${field("Story date", s.date || "", 'data-k="date" placeholder="YYYY-MM-DD"')}${field("Duration (s)", s.durationSec, 'data-k="durationSec" type="number" min="2" step="0.5"')}</div>
      ${field("Creator credit (required for other people's work)", s.credit || "", 'data-k="credit"')}
      ${field("Credit link (https)", s.creditUrl || "", 'data-k="creditUrl" type="url" placeholder="https://"')}
      <label class="row"><input type="checkbox" data-k="asReported" ${s.asReported !== false ? "checked" : ""}> As reported, not independently verified</label>
      <label>Location verified<select data-k="verified"><option value="0">No (approximate)</option><option value="1" ${loc.verified ? "selected" : ""}>Yes, checked</option></select></label>
      ${field("Story pin label", loc.name, 'data-k="name"')}
      <label>Find a place (bundled gazetteer, offline)<input id="placeQ" placeholder="Type a town or city"></label><ul id="placeHits" class="suggest"></ul>
      <div class="row2">${field("Pin latitude", loc.lat == null ? "" : loc.lat, 'data-k="lat" type="number" step="0.0001"')}${field("Pin longitude", loc.lon == null ? "" : loc.lon, 'data-k="lon" type="number" step="0.0001"')}</div>
      ${field("Location note", loc.note, 'data-k="note"')}
      <p class="muted small">Drop a pin by clicking the globe, entering coordinates, or searching the bundled town gazetteer (offline). There is no online address lookup. The story pin marks the place on the globe. The camera / street-level target can be a different land point, so a water or regional pin can still dive to streets nearby. Street zoom (about z16–17, pitched) only runs when that target is on land.</p>
      ${field("Street-level target label", (loc.look && loc.look.name) || "", 'data-k="lookName"')}
      <div class="row2">${field("Target latitude", loc.look && loc.look.lat != null ? loc.look.lat : "", 'data-k="lookLat" type="number" step="0.0001"')}${field("Target longitude", loc.look && loc.look.lon != null ? loc.look.lon : "", 'data-k="lookLon" type="number" step="0.0001"')}</div>
      ${field("Target note", (loc.look && loc.look.note) || "", 'data-k="lookNote"')}
      <label>Focus-region glow (country)<select data-k="a3"><option value="">None</option>${countries.map((c) => `<option value="${esc(c.a3)}" ${s.highlight && s.highlight.a3 === c.a3 ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
      <div class="actions"><label class="btn small">Glow a custom polygon (.geojson)<input id="hlFile" type="file" accept=".geojson,.json" hidden></label>${s.highlight && s.highlight.geojson ? '<button id="hlClear" class="small">Clear polygon</button>' : ""}</div>
      <label>Script (voiceover text; drives auto-captions and the free browser voice)<textarea data-k="script">${esc(s.script)}</textarea></label>
      <div class="actions"><button id="useView">Set pin from map center</button><button id="useViewLook">Set street target from map center</button><button id="lookSame">Street target = pin</button><button id="autoPath">Auto camera path</button><button id="goStreet">Go to street level</button></div>
      <div class="insight"><strong>Spatial insight</strong> <span class="muted">(computed from bundled Natural Earth towns; distances are straight-line)</span>
        ${ins ? `<ul>${ins.map((p) => `<li>${esc(p.name)} (${esc(p.a3)}${p.adm1 ? ", " + esc(p.adm1) : ""}) — ${p.km} km, bearing ${p.bearing}°</li>`).join("")}</ul>` : "<p>Set a location to see nearby mapped places.</p>"}</div>`;
    bind(el, "[data-k]", (t) => {
      const k = t.dataset.k;
      if (k === "title" || k === "script" || k === "summary" || k === "date" || k === "credit") s[k] = t.value;
      else if (k === "creditUrl") {
        if (t.value && !httpsOk(t.value)) { toast("Links must be https (no userinfo)."); return; }
        s.creditUrl = t.value;
      } else if (k === "asReported") s.asReported = t.checked;
      else if (k === "durationSec") s.durationSec = Math.max(2, num(t.value, s.durationSec));
      else if (k === "verified") loc.verified = t.value === "1";
      else if (k === "lat" || k === "lon") loc[k] = t.value === "" ? null : num(t.value, null);
      else if (k === "lookLat" || k === "lookLon" || k === "lookName" || k === "lookNote") {
        loc.look = loc.look || { lat: null, lon: null, name: "", note: "" };
        if (k === "lookLat") loc.look.lat = t.value === "" ? null : num(t.value, null);
        else if (k === "lookLon") loc.look.lon = t.value === "" ? null : num(t.value, null);
        else if (k === "lookName") loc.look.name = t.value;
        else loc.look.note = t.value;
        if (loc.look.lat == null && loc.look.lon == null && !loc.look.name && !loc.look.note) delete loc.look;
      }
      else if (k === "a3") { s.highlight = s.highlight || {}; s.highlight.a3 = t.value || null; }
      else loc[k] = t.value;
      if ((k === "lat" || k === "lon" || k === "lookLat" || k === "lookLon") && loc.lat != null && loc.lon != null && !(s.camera || []).length) {
        s.camera = GD.model.autoCameraPathForLocation(loc, S.episode.look.shotSec, window.GD_LAND);
      }
      changed();
    });
    const q = el.querySelector("#placeQ"), hits = el.querySelector("#placeHits");
    q.addEventListener("input", () => {
      hits.innerHTML = "";
      GD.globe.searchPlaces(q.value, 8).forEach((p) => {
        const li = document.createElement("li"), b = document.createElement("button");
        b.textContent = `${p.name} — ${p.a3}${p.adm1 ? ", " + p.adm1 : ""} (${p.lat}, ${p.lon})`;
        b.addEventListener("click", () => {
          Object.assign(loc, { name: p.name + " (gazetteer point)", lat: p.lat, lon: p.lon, precision: "town point" });
          s.highlight = s.highlight || {}; if (!s.highlight.a3) s.highlight.a3 = p.a3;
          s.camera = GD.model.autoCameraPathForLocation(s.location, S.episode.look.shotSec, window.GD_LAND);
          changed(); selectStory(S.storyIdx, { fly: true });
        });
        li.appendChild(b); hits.appendChild(li);
      });
    });
    el.querySelector("#useView").addEventListener("click", () => { const c = GD.globe.camera(); loc.lat = c.center[1]; loc.lon = c.center[0]; changed(); });
    el.querySelector("#useViewLook").addEventListener("click", () => {
      const c = GD.globe.camera();
      loc.look = loc.look || {};
      loc.look.lat = c.center[1]; loc.look.lon = c.center[0];
      if (!loc.look.name) loc.look.name = "Street-level target (from map)";
      changed();
    });
    el.querySelector("#lookSame").addEventListener("click", () => {
      if (loc.lat == null) return toast("Set a story pin first.");
      loc.look = { lat: loc.lat, lon: loc.lon, name: loc.name || "", note: "same as pin" };
      changed();
    });
    el.querySelector("#autoPath").addEventListener("click", () => {
      if (loc.lat == null) return toast("Set a story pin first.");
      s.camera = GD.model.autoCameraPathForLocation(loc, S.episode.look.shotSec, window.GD_LAND);
      changed();
      const hasStreet = (s.camera || []).some((k) => k.preset === "street");
      toast(hasStreet ? "Camera path: orbit → dive → street → cinematic (street target is on land)." : "Camera path: orbit → regional close. Street zoom needs a land pin or a land street-level target.");
    });
    el.querySelector("#goStreet").addEventListener("click", () => {
      const sv = GD.globe.streetView(s);
      if (!sv) return toast("Street level needs a land pin or a land street-level target. Water pins stay at a regional view.");
      GD.globe.flyTo(sv);
    });
    el.querySelector("#hlFile").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { s.highlight = s.highlight || {}; s.highlight.geojson = JSON.parse(await f.text()); changed(); toast("Custom polygon glow set."); } catch (err) { toast("Not valid GeoJSON."); }
    });
    const hc = el.querySelector("#hlClear"); if (hc) hc.addEventListener("click", () => { s.highlight.geojson = null; changed(); });
  }

  function citationFields(prefix, c) {
    return `<div class="row2">${field("Media type", c.type, `data-c="${prefix}.type"`)}${field("Date", c.date, `data-c="${prefix}.date"`)}</div>
      ${field("Credit", c.credit, `data-c="${prefix}.credit"`)}${field("License", c.license, `data-c="${prefix}.license"`)}`;
  }
  function bindCitations(el, list) {
    bind(el, "[data-c]", (t) => { const [i, k] = t.dataset.c.split("."); list[Number(i)].citation = list[Number(i)].citation || GD.model.blankCitation(); list[Number(i)].citation[k] = t.value; changed(); });
  }

  function tabCamera(el, s) {
    const P = GD.model.PRESETS;
    el.innerHTML = `<p class="muted small">Keyframes fire at their start time. A <strong>cut</strong> starts a new shot (CTD pacing: 7–9 s per shot, cut on topic shifts). Each shot carries its own source-citation box. The street-level preset (about z16–17, pitched) is used only when the story's street-level target — or the pin, if no target is set — is on land.</p>
      <div class="actions"><button id="kfAdd">+ Keyframe from current view</button><button id="kfAuto">Auto path</button><button id="kfStreet">Go to street level</button></div>
      ${(s.camera || []).map((k, i) => `<div class="item"><h3><span class="sp">${i + 1}. ${esc((P[k.preset] || {}).label || k.preset)}</span><button data-go="${i}" class="small">Preview</button><button data-set="${i}" class="small">Set = view</button><button data-del="${i}" class="small">✕</button></h3>
        <div class="row3">${field("At (s)", k.at, `data-f="${i}.at" type="number" step="0.1"`)}${field("Move (s)", k.durationSec, `data-f="${i}.durationSec" type="number" step="0.1"`)}
        <label>Preset<select data-f="${i}.preset">${Object.keys(P).map((p) => `<option ${p === k.preset ? "selected" : ""}>${p}</option>`).join("")}</select></label></div>
        <div class="row3">${field("Zoom", k.zoom, `data-f="${i}.zoom" type="number" step="0.1"`)}${field("Pitch", k.pitch, `data-f="${i}.pitch" type="number"`)}${field("Bearing", k.bearing, `data-f="${i}.bearing" type="number"`)}</div>
        <label><input type="checkbox" data-f="${i}.cut" ${k.cut !== false ? "checked" : ""}> Cut (new shot)</label>
        <label>Ease<select data-f="${i}.ease">${["cinematic", "smooth", "linear"].map((e) => `<option ${e === k.ease ? "selected" : ""}>${e}</option>`).join("")}</select></label>
        ${citationFields(i, k.citation || GD.model.blankCitation())}</div>`).join("") || "<p>No keyframes yet. Set a location, then Auto path.</p>"}`;
    bind(el, "[data-f]", (t) => {
      const [i, key] = t.dataset.f.split("."); const k = s.camera[Number(i)];
      if (key === "cut") k.cut = t.checked;
      else if (key === "preset") { const p = P[t.value]; Object.assign(k, { preset: t.value, zoom: p.zoom, pitch: p.pitch, durationSec: p.durationSec }); }
      else if (key === "ease") k.ease = t.value;
      else k[key] = num(t.value, k[key]);
      changed();
    });
    bindCitations(el, s.camera);
    bind(el, "[data-go]", (t) => GD.globe.flyTo(s.camera[Number(t.dataset.go)]), "click");
    bind(el, "[data-set]", (t) => { Object.assign(s.camera[Number(t.dataset.set)], GD.globe.camera()); changed(); }, "click");
    bind(el, "[data-del]", (t) => { s.camera.splice(Number(t.dataset.del), 1); changed(); }, "click");
    el.querySelector("#kfAdd").addEventListener("click", () => {
      const lt = S.t - GD.model.storyStarts(S.episode)[S.storyIdx];
      const k = Object.assign({ id: GD.model.uid("kf"), preset: "street", at: Math.max(0, Math.round(lt * 10) / 10), durationSec: 3, ease: "cinematic", cut: true, citation: (GD.model.mapCitation && GD.model.mapCitation()) || GD.model.blankCitation() }, GD.globe.camera());
      s.camera.push(k); s.camera.sort((a, b) => a.at - b.at); changed();
    });
    el.querySelector("#kfAuto").addEventListener("click", () => {
      if (s.location.lat == null) return toast("Set a story pin first.");
      s.camera = GD.model.autoCameraPathForLocation(s.location, S.episode.look.shotSec, window.GD_LAND);
      changed();
    });
    el.querySelector("#kfStreet").addEventListener("click", () => {
      const sv = GD.globe.streetView(s);
      if (!sv) return toast("Street level needs a land pin or a land street-level target.");
      GD.globe.flyTo(sv);
    });
  }

  function tabCards(el, s) {
    el.innerHTML = `<p class="muted small">Topic cards pin to the story location. Unknown facts stay <code>[UNKNOWN]</code>; nothing is filled in for you.</p>
      <div class="actions"><button id="cardAdd">+ Card</button><button id="cardInsight">+ Spatial insight card</button><button id="cardSuggest">Suggest from script (local)</button></div>
      ${s.cards.map((c, i) => `<div class="item"><h3><span class="sp">${i + 1}. ${esc(c.kind)}</span><button data-del="${i}" class="small">✕</button></h3>
        ${field("Title", c.title, `data-f="${i}.title"`)}
        <label>Body<textarea data-f="${i}.body">${esc(c.body)}</textarea></label>
        ${field("Why it matters", c.why, `data-f="${i}.why"`)}
        <label>Key facts (one per line, "label: value")<textarea data-f="${i}.facts">${esc((c.facts || []).map((f) => `${f.label}: ${f.value}`).join("\n"))}</textarea></label>
        <div class="row3">${field("At (s)", c.at, `data-f="${i}.at" type="number" step="0.1"`)}${field("For (s)", c.dur, `data-f="${i}.dur" type="number" step="0.1"`)}
        <label>Kind<select data-f="${i}.kind">${["topic", "stat", "quote", "timeline", "insight"].map((k) => `<option ${k === c.kind ? "selected" : ""}>${k}</option>`).join("")}</select></label></div>
        <label>Sources<select multiple data-f="${i}.sourceIds">${s.sources.map((src) => `<option value="${esc(src.id)}" ${(c.sourceIds || []).includes(src.id) ? "selected" : ""}>${esc(src.label)} (${esc(src.status)})</option>`).join("")}</select></label>
        <label><input type="checkbox" data-f="${i}.verified" ${c.verified ? "checked" : ""}> Content verified</label></div>`).join("")}`;
    bind(el, "[data-f]", (t) => {
      const [i, key] = t.dataset.f.split("."); const c = s.cards[Number(i)];
      if (key === "verified") c.verified = t.checked;
      else if (key === "facts") c.facts = t.value.split("\n").filter(Boolean).map((l) => { const j = l.indexOf(":"); return j < 0 ? { label: l.trim(), value: U } : { label: l.slice(0, j).trim(), value: l.slice(j + 1).trim() || U }; });
      else if (key === "sourceIds") c.sourceIds = Array.from(t.selectedOptions).map((o) => o.value);
      else if (key === "at" || key === "dur") c[key] = num(t.value, c[key]);
      else c[key] = t.value;
      changed();
    });
    bind(el, "[data-del]", (t) => { s.cards.splice(Number(t.dataset.del), 1); changed(); }, "click");
    el.querySelector("#cardAdd").addEventListener("click", () => { s.cards.push(GD.model.blankCard(s.location.lat, s.location.lon)); changed(); });
    el.querySelector("#cardInsight").addEventListener("click", () => {
      const ins = GD.globe.insight(s.location.lat, s.location.lon, 3);
      if (!ins) return toast("Set a location first.");
      const c = GD.model.blankCard(s.location.lat, s.location.lon);
      c.kind = "insight"; c.title = "Where this is";
      c.body = "Nearest mapped places: " + ins.map((p) => `${p.name} ${p.km} km`).join(", ") + ".";
      c.facts = [{ label: "Computed from", value: "Natural Earth towns (public domain), straight-line distance" }];
      c.verified = false; c.at = 1; c.dur = 6;
      s.cards.push(c); changed();
    });
    el.querySelector("#cardSuggest").addEventListener("click", () => {
      // Local, rule-based: each script sentence becomes a draft card body. No network, no AI.
      const sents = String(s.script || "").match(/[^.!?]+[.!?]?/g) || [];
      if (!sents.length) return toast("Write a script first.");
      sents.slice(0, 3).forEach((t, k) => { const c = GD.model.blankCard(s.location.lat, s.location.lon); c.title = "Draft: " + t.trim().split(/\s+/).slice(0, 5).join(" ") + "…"; c.body = t.trim(); c.at = 1 + k * 5; c.dur = 5; s.cards.push(c); });
      changed(); toast("Draft cards added. Edit and check them.");
    });
  }

  function tabSources(el, s) {
    el.innerHTML = `<p class="muted small">Every source carries a status. Only mark <em>verified</em> after you check it. Links must be https.</p>
      <div class="actions"><button id="srcAdd">+ Source</button></div>
      ${s.sources.map((src, i) => `<div class="item"><h3><span class="sp">${i + 1}.</span><span class="pill ${src.status === "verified" ? "ok" : "warn"}">${esc(src.status)}</span><button data-del="${i}" class="small">✕</button></h3>
        ${field("Label", src.label, `data-f="${i}.label"`)}${field("Link (https)", src.url, `data-f="${i}.url" type="url" placeholder="https://"`)}
        <label>Status<select data-f="${i}.status"><option value="unverified">unverified</option><option value="verified" ${src.status === "verified" ? "selected" : ""}>verified</option></select></label>
        ${field("Note", src.note, `data-f="${i}.note"`)}
        ${src.url && httpsOk(src.url) ? `<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer" class="small">Open link</a>` : ""}</div>`).join("")}`;
    bind(el, "[data-f]", (t) => {
      const [i, key] = t.dataset.f.split(".");
      if (key === "url" && t.value && !httpsOk(t.value)) { toast("Links must be https (no userinfo)."); return; }
      s.sources[Number(i)][key] = t.value; changed();
    });
    bind(el, "[data-del]", (t) => { s.sources.splice(Number(t.dataset.del), 1); changed(); }, "click");
    el.querySelector("#srcAdd").addEventListener("click", () => { s.sources.push(GD.model.blankSource()); changed(); });
  }

  function tabCaptions(el, s) {
    el.innerHTML = `<p class="muted small">Captions are on by default (CTD style: bottom center, bold white, drop shadow). Times are seconds from the story start.</p>
      <div class="actions"><button id="capAuto">Auto from script</button><label class="btn">Import SRT/VTT<input id="capFile" type="file" accept=".srt,.vtt,text/vtt" hidden></label><button id="capAdd">+ Cue</button><button id="capClear">Clear</button></div>
      ${(s.captions || []).map((c, i) => `<div class="item"><div class="row3">${field("Start", c.start, `data-f="${i}.start" type="number" step="0.05"`)}${field("End", c.end, `data-f="${i}.end" type="number" step="0.05"`)}<button data-del="${i}" class="small">✕</button></div>
        <label>Text<input data-f="${i}.text" value="${esc(c.text)}"></label></div>`).join("") || "<p>No cues.</p>"}`;
    bind(el, "[data-f]", (t) => { const [i, k] = t.dataset.f.split("."); s.captions[Number(i)][k] = k === "text" ? t.value : num(t.value, 0); changed(); });
    bind(el, "[data-del]", (t) => { s.captions.splice(Number(t.dataset.del), 1); changed(); }, "click");
    el.querySelector("#capAuto").addEventListener("click", () => { s.captions = GD.captions.fromScript(s.script, s.durationSec); changed(); });
    el.querySelector("#capAdd").addEventListener("click", () => { s.captions.push({ start: 0, end: 2, text: U }); changed(); });
    el.querySelector("#capClear").addEventListener("click", () => { s.captions = []; changed(); });
    el.querySelector("#capFile").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const cues = GD.captions.parse(await f.text());
      if (!cues.length) return toast("No cues found in that file.");
      s.captions = cues; changed(); toast(`${cues.length} cues imported.`);
    });
  }

  function tabShots(el, s) {
    const bin = S.episode.mediaBin;
    el.innerHTML = `<p class="muted small">Drop files into the bin, then add them here (or drag a bin item onto the stage). Each shot has its own citation box. Voiceover plays from the story start; music is off in the CTD look.</p>
      <label>Voiceover for this story<select id="vo"><option value="">None (silent / browser voice)</option>${bin.filter((b) => b.kind === "audio").map((b) => `<option value="${esc(b.ref)}" ${s.voiceover === b.ref ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select></label>
      ${(s.media || []).map((m, i) => { const b = bin.find((x) => x.ref === m.mediaRef); return `<div class="item"><h3><span class="sp">${esc(b ? b.name : m.mediaRef)}</span>${S.blobs[m.mediaRef] ? "" : '<span class="pill warn">relink file</span>'}<button data-del="${i}" class="small">✕</button></h3>
        <div class="row3">${field("At (s)", m.at, `data-f="${i}.at" type="number" step="0.1"`)}${field("For (s)", m.dur, `data-f="${i}.dur" type="number" step="0.1"`)}
        <label>Role<select data-f="${i}.role">${["broll", "still", "music"].map((r) => `<option ${r === m.role ? "selected" : ""}>${r}</option>`).join("")}</select></label></div>
        ${citationFields(i, m.citation || GD.model.blankCitation())}</div>`; }).join("") || "<p>No media shots in this story. Map shots are on the Camera tab.</p>"}`;
    el.querySelector("#vo").addEventListener("change", (e) => { s.voiceover = e.target.value || null; changed(); });
    bind(el, "[data-f]", (t) => { const [i, k] = t.dataset.f.split("."); s.media[Number(i)][k] = k === "role" ? t.value : num(t.value, 0); changed(); });
    bindCitations(el, s.media);
    bind(el, "[data-del]", (t) => { s.media.splice(Number(t.dataset.del), 1); changed(); }, "click");
  }


  function tabSound(el, s) {
    s.audioOverlays = s.audioOverlays || [];
    const bin = (S.episode.mediaBin || []).filter((b) => b.kind === "audio");
    el.innerHTML = `<p class="muted small">Your own audio tracks for this story. Volume (0–1), offset into the file, and loop. Tracks mix into playback and into the local WebM recording. Drop audio in the media bin first. Pre-recorded voiceover is still set on the Shots tab. The browser voice is a free preview and is not captured in recordings.</p>
      <div class="actions"><button id="sndAdd">+ Sound overlay</button></div>
      ${(s.audioOverlays).map((o, i) => `<div class="item"><h3><span class="sp">Track ${i + 1}</span><button data-del="${i}" class="small">✕</button></h3>
        <label>Audio file<select data-f="${i}.mediaRef">${bin.map((b) => `<option value="${esc(b.ref)}" ${o.mediaRef === b.ref ? "selected" : ""}>${esc(b.name)}</option>`).join("") || "<option value=\"\">(drop audio into the bin)</option>"}</select></label>
        <div class="row3">${field("Volume", o.volume == null ? 1 : o.volume, `data-f="${i}.volume" type="number" min="0" max="1" step="0.05"`)}
          ${field("Offset (s)", o.offset || 0, `data-f="${i}.offset" type="number" step="0.1"`)}
          <label class="row">Loop <input type="checkbox" data-f="${i}.loop" ${o.loop ? "checked" : ""}></label></div>
        <div class="row2">${field("Start at (s)", o.at || 0, `data-f="${i}.at" type="number" step="0.1"`)}${field("Play for (s, blank = all)", o.dur == null ? "" : o.dur, `data-f="${i}.dur" type="number" step="0.1"`)}</div>
      </div>`).join("") || "<p>No sound overlays yet.</p>"}`;
    bind(el, "[data-f]", (t) => {
      const [i, k] = t.dataset.f.split(".");
      const o = s.audioOverlays[Number(i)];
      if (k === "loop") o.loop = t.checked;
      else if (k === "mediaRef") o.mediaRef = t.value;
      else if (k === "dur") o.dur = t.value === "" ? null : num(t.value, null);
      else o[k] = num(t.value, 0);
      changed();
    });
    bind(el, "[data-del]", (t) => { s.audioOverlays.splice(Number(t.dataset.del), 1); changed(); }, "click");
    el.querySelector("#sndAdd").addEventListener("click", () => {
      s.audioOverlays.push((GD.audioMix && GD.audioMix.blank(bin[0] && bin[0].ref)) || { id: GD.model.uid("snd"), mediaRef: (bin[0] && bin[0].ref) || "", volume: 1, offset: 0, loop: false, at: 0, dur: null });
      changed();
    });
  }

  function tabLook(el) {
    const ep = S.episode, L = ep.look, o = ep.outro, P = L.palette || {};
    el.innerHTML = `
      <label>Theme preset<select id="theme">${Object.entries(GD.themes.THEMES).map(([id, t]) => `<option value="${id}" ${L.theme === id ? "selected" : ""}>${esc(t.label)}</option>`).join("")}</select></label>
      <div class="actions"><button id="applyTheme">Apply preset (resets look)</button></div>
      <div class="row2">${field("Show name", ep.show, 'data-e="show"')}${field("Date", ep.date, 'data-e="date" type="date"')}</div>
      ${field("Handle", ep.handle, 'data-e="handle"')}
      <label>Lede / post text<textarea data-e="lede">${esc(ep.lede)}</textarea></label>
      ${field("Call to action", ep.cta, 'data-e="cta"')}
      <div class="item"><h3>Header (top ${escNum(L.headerHeightPct)}%)</h3>
        <label><input type="checkbox" data-l="header" ${L.header ? "checked" : ""}> Show persistent header</label>
        ${field("Badge text", L.headerBadge, 'data-l="headerBadge"')}</div>
      <div class="item"><h3>Captions</h3>
        <label><input type="checkbox" data-l="captionsOn" ${L.captionsOn !== false ? "checked" : ""}> Captions on (recommended: always)</label>
        <div class="row2"><label>Size<select data-l="captionSize">${["small", "medium", "large"].map((z) => `<option ${z === L.captionSize ? "selected" : ""}>${z}</option>`).join("")}</select></label>
        <label>Style<select data-l="captionStyle">${["shadow", "box"].map((z) => `<option ${z === L.captionStyle ? "selected" : ""}>${z}</option>`).join("")}</select></label></div></div>
      <div class="item"><h3>Overlays</h3>
        <label><input type="checkbox" data-l="citations" ${L.citations !== false ? "checked" : ""}> Source citation boxes</label>
        <label><input type="checkbox" data-l="lowerThird" ${L.lowerThird ? "checked" : ""}> Lower third (off in CTD)</label>
        ${field("Default shot length (s)", L.shotSec, 'data-l="shotSec" type="number" step="0.5"')}
        <div class="row3">${field("Accent", P.accent, 'data-p="accent" type="color"')}${field("Map highlight", P.highlight, 'data-p="highlight" type="color"')}${field("Outro bg", P.outroBg, 'data-p="outroBg" type="color"')}</div></div>
      <div class="item"><h3>Outro card</h3>
        <label><input type="checkbox" data-o="enabled" ${o.enabled ? "checked" : ""}> Show outro</label>
        ${field("Line", o.line1, 'data-o="line1"')}${field("Channel link", o.link, 'data-o="link"')}${field("Handle", o.handle, 'data-o="handle"')}
        <div class="row2">${field("Seconds", o.durationSec, 'data-o="durationSec" type="number" step="0.5"')}<label><input type="checkbox" data-o="showXLogo" ${o.showXLogo ? "checked" : ""}> X mark</label></div></div>
      <p class="muted small">9:16 safe zones: ${esc(GD.themes.SAFE["9:16"].note)}</p>`;
    bind(el, "[data-e]", (t) => { ep[t.dataset.e] = t.value; changed(); });
    bind(el, "[data-l]", (t) => { const k = t.dataset.l; L[k] = t.type === "checkbox" ? t.checked : (k === "shotSec" ? num(t.value, L.shotSec) : t.value); changed(); });
    bind(el, "[data-p]", (t) => { L.palette[t.dataset.p] = t.value; GD.globe.refresh(); changed(); });
    bind(el, "[data-o]", (t) => { const k = t.dataset.o; o[k] = t.type === "checkbox" ? t.checked : (k === "durationSec" ? num(t.value, o.durationSec) : t.value); changed(); });
    el.querySelector("#applyTheme").addEventListener("click", () => {
      const id = el.querySelector("#theme").value; ep.look = GD.themes.lookFor(id);
      if (ep.look.map && ep.look.map.base) GD.globe.setBase(ep.look.map.base);
      GD.globe.refresh(); changed(); toast("Look preset applied.");
    });
  }

  function tabLayers(el) {
    const st = GD.globe.st;
    el.innerHTML = `<h3 class="small">Base map (one at a time)</h3>
      ${GD.layers.BASES.map((b) => `<label><input type="radio" name="base" value="${b.id}" ${st.baseId === b.id ? "checked" : ""}> ${esc(b.label)} ${b.free ? '<span class="pill ok">free</span>' : '<span class="pill warn">optional paid</span>'}</label>
        <div class="layer-credit">${b.credit}${b.note ? "<br>" + esc(b.note) : ""}${b.streetLevel ? "" : "<br>No street detail in this view."}</div>`).join("")}
      <h3 class="small">Overlays</h3>
      ${GD.layers.OVERLAYS.map((o) => `<label><input type="checkbox" data-ov="${o.id}" ${st.overlays[o.id] ? "checked" : ""} ${o.status === "unknown" ? "disabled" : ""}> ${esc(o.label)}</label>
        <div class="layer-credit">${o.status === "unknown" ? esc(o.reason) : o.credit}</div>`).join("")}`;
    bind(el, "input[name=base]", (t) => { if (!GD.globe.setBase(t.value)) renderInspector(); });
    bind(el, "[data-ov]", (t) => GD.globe.setOverlay(t.dataset.ov, t.checked));
  }

  // ---------- Media bin ----------
  async function addFiles(files) {
    for (const f of Array.from(files)) {
      if (GD.media) {
        const r = await GD.media.addFile(f);
        if (!r.ok) toast(`Skipped ${f.name}: ${r.error}`);
      } else {
        const kind = f.type.startsWith("audio") ? "audio" : f.type.startsWith("video") ? "video" : f.type.startsWith("image") ? "image" : null;
        if (!kind) { toast(`Skipped ${f.name}: not audio, video or image.`); continue; }
        const ref = GD.model.uid("media");
        S.blobs[ref] = URL.createObjectURL(f);
        S.episode.mediaBin.push({ ref, name: f.name, kind, local: true, size: f.size });
      }
    }
    renderBin();
    changed();
  }

  function addShot(ref) {
    const b = S.episode.mediaBin.find((x) => x.ref === ref), s = story();
    if (!b) return;
    if (b.kind === "audio") { s.voiceover = ref; toast("Set as this story's voiceover."); }
    else {
      const lt = Math.max(0, S.t - GD.model.storyStarts(S.episode)[S.storyIdx]);
      const c = GD.model.blankCitation(); c.type = b.kind === "video" ? "File video" : "File photo";
      s.media.push({ mediaRef: ref, role: b.kind === "video" ? "broll" : "still", at: Math.round(lt * 10) / 10, dur: S.episode.look.shotSec || 8, citation: c });
      toast("Shot added at the playhead. Fill in its citation on the Shots tab.");
    }
    changed();
  }

  function renderBin() {
    const ul = $("bin"); ul.innerHTML = "";
    S.episode.mediaBin.forEach((b) => {
      const li = document.createElement("li");
      li.draggable = !!S.blobs[b.ref];
      li.innerHTML = `<span class="k">${esc(b.kind)}</span><span class="nm" title="${esc(b.name)}">${esc(b.name)}</span>${S.blobs[b.ref] ? '<button data-add>Use</button>' : '<span class="pill warn">empty slot</span>'}`;
      li.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/globedesk-ref", b.ref));
      const btn = li.querySelector("[data-add]"); if (btn) btn.addEventListener("click", () => addShot(b.ref));
      ul.appendChild(li);
    });
  }


  function showFull(label, text) {
    const p = $("gdFull"); if (!p) return;
    p.hidden = false;
    p.replaceChildren();
    const h = document.createElement("strong"); h.textContent = label; p.appendChild(h);
    const body = document.createElement("div"); body.textContent = text; p.appendChild(body);
    const b = document.createElement("button"); b.type = "button"; b.textContent = "Close";
    b.addEventListener("click", () => { p.hidden = true; });
    p.appendChild(b);
  }
  function syncHits() {
    const host = $("gdHits"); if (!host || !GD.recorder || !GD.recorder.hits) return;
    host.replaceChildren();
    const hits = GD.recorder.hits();
    const cv = $("ov"); if (!cv || !cv.width) return;
    const r = cv.getBoundingClientRect();
    const sx = r.width / cv.width, sy = r.height / cv.height;
    const box = (h, label) => {
      if (!h || !h.full) return;
      const d = document.createElement("button");
      d.type = "button";
      d.className = "gd-hit";
      d.style.left = (h.x * sx) + "px";
      d.style.top = (h.y * sy) + "px";
      d.style.width = Math.max(12, h.w * sx) + "px";
      d.style.height = Math.max(12, h.h * sy) + "px";
      d.title = h.full;
      d.setAttribute("aria-label", label + (h.truncated ? " (full text)" : "") + ": " + h.full);
      d.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); showFull(label, h.full); });
      host.appendChild(d);
    };
    if (hits.title) box(hits.title, "Title");
    (hits.citations || []).forEach((c) => box(c, "Citation"));
  }

  // ---------- Aspect / stage sizing ----------
  function applyAspect(a) {
    S.episode.output.aspect = a;
    $("asp169").classList.toggle("on", a === "16:9"); $("asp916").classList.toggle("on", a === "9:16");
    const wrap = $("stageWrap"), stg = $("stage"), r = wrap.getBoundingClientRect();
    const ar = a === "9:16" ? 9 / 16 : 16 / 9;
    let w = r.width - 24, h = w / ar;
    if (h > r.height - 24) { h = r.height - 24; w = h * ar; }
    stg.style.width = `${Math.floor(w)}px`; stg.style.height = `${Math.floor(h)}px`; stg.dataset.aspect = a;
    const z = GD.themes.SAFE[a];
    stg.style.setProperty("--safe-top", z.top * 100 + "%"); stg.style.setProperty("--safe-bottom", z.bottom * 100 + "%"); stg.style.setProperty("--safe-side", z.side * 100 + "%");
    if (GD.globe.st.map) GD.globe.st.map.resize();
    renderOverlays();
  }

  // ---------- Wiring ----------
  function wire() {
    $("epTitle").addEventListener("change", (e) => { S.episode.title = e.target.value; changed(); });
    $("btnNew").addEventListener("click", () => loadEpisode(GD.model.blankEpisode(), "New blank episode."));
    $("btnDemo").addEventListener("click", () => loadEpisode(GD.model.demoEpisode(), "Sample loaded. Removable. Locations approximate, not verified."));
    $("fileOpen").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const ep = GD.project ? await GD.project.importFile(f) : JSON.parse(await f.text());
        loadEpisode(ep, /\.globedesk$/i.test(f.name) && !/\.json$/i.test(f.name) ? "Project opened (media stayed on this device)." : "Episode opened. Re-drop media files if they were not in the pack.");
      } catch (err) { toast("Could not open that file: " + (err.message || err)); }
      e.target.value = "";
    });
    $("btnSave").addEventListener("click", () => download(slug() + ".globedesk.json", JSON.stringify(S.episode, null, 2)));
    const sp = $("btnSaveProject");
    if (sp) sp.addEventListener("click", async () => {
      try { await GD.project.exportProject(slug() + ".globedesk"); toast("Project saved to your Downloads (.globedesk, JSON + media). Nothing was uploaded."); }
      catch (err) { toast("Could not save the project: " + (err.message || err)); }
    });
    $("btnVtt").addEventListener("click", () => download(slug() + ".vtt", GD.captions.toVTT(GD.captions.episodeCues(S.episode)), "text/vtt"));
    $("btnSrt").addEventListener("click", () => download(slug() + ".srt", GD.captions.toSRT(GD.captions.episodeCues(S.episode)), "text/plain"));
    $("asp169").addEventListener("click", () => applyAspect("16:9"));
    $("asp916").addEventListener("click", () => applyAspect("9:16"));
    $("btnPlay").addEventListener("click", () => (S.playing ? GD.playback.stop() : GD.playback.play()));
    $("scrub").addEventListener("input", (e) => { GD.playback.seek(Number(e.target.value)); renderTransport(); renderRundown(); });
    $("browserVoice").addEventListener("change", (e) => (S.browserVoice = e.target.checked));
    $("showSafe").addEventListener("change", (e) => $("safe").classList.toggle("on", e.target.checked));
    $("safe").classList.add("on");
    $("addStory").addEventListener("click", () => { S.episode.stories.push(GD.model.blankStory(S.episode.stories.length + 1)); S.storyIdx = S.episode.stories.length - 1; changed(); });
    document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => { S.tab = b.dataset.tab; renderInspector(); }));
    $("btnSettings").addEventListener("click", () => { GD.settings.render($("settingsBody")); $("settings").showModal(); });
    $("btnRecord").addEventListener("click", toggleRecord);
    const drop = $("drop");
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
    drop.addEventListener("drop", (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
    $("fileMedia").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
    const stg = $("stage");
    stg.addEventListener("dragover", (e) => e.preventDefault());
    stg.addEventListener("drop", (e) => { e.preventDefault(); const ref = e.dataTransfer.getData("text/globedesk-ref") || e.dataTransfer.getData("text/gobedesk-ref"); if (ref) addShot(ref); else if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
    window.addEventListener("resize", () => applyAspect(S.episode.output.aspect));
    document.addEventListener("keydown", (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (e.code === "Space") { e.preventDefault(); $("btnPlay").click(); }
    });
    GD.globe.st.map.on("render", () => { if (!S.playing) renderOverlays(); });
    // Keep MapLibre attribution expanded and sitting above the caption band (see CSS).
    const revealAttrib = () => {
      const a = document.querySelector(".maplibregl-ctrl-attrib");
      if (!a) return;
      a.classList.remove("maplibregl-compact");
      a.classList.add("maplibregl-compact-show");
      a.setAttribute("open", "");
    };
    GD.globe.st.map.on("load", revealAttrib); GD.globe.st.map.on("styledata", revealAttrib);
  }

  async function toggleRecord() {
    const btn = $("btnRecord");
    if (S.recording) {
      GD.playback.stop(); S.recording = false; btn.textContent = "● Record WebM";
      await GD.recorder.stop(`${slug()}-${S.episode.output.aspect.replace(":", "x")}.webm`);
      return toast("Recording saved to your Downloads (local WebM).");
    }
    if (!GD.recorder.supported()) return toast("[UNKNOWN] This browser cannot record canvas video. Try Chrome, Edge or Firefox.");
    try {
      GD.playback.stop(); GD.playback.seek(0);
      S.recording = true; btn.textContent = "■ Stop & save";
      await GD.recorder.start(S.episode.output.aspect);
      GD.playback.play();
    } catch (err) { S.recording = false; btn.textContent = "● Record WebM"; toast(String(err.message || err)); }
  }

  function onPlaybackEnd() { if (S.recording) toggleRecord(); renderTransport(); }

  async function boot() {
    const params = new URLSearchParams(location.search);
    GD.globe.init("map", { base: params.get("base") || undefined });
    S.episode = GD.model.blankEpisode();
    wire();
    if (GD.assistant && GD.assistant.listen) GD.assistant.listen();
    let ep = null;
    if (params.get("blank")) ep = GD.model.blankEpisode();
    else if (params.get("sample")) ep = GD.model.demoEpisode();
    else if (GD.store) {
      try { ep = await GD.store.loadEpisode(); } catch (e) { ep = null; }
      if (ep) {
        const errs = (GD.schema && GD.schema.validate) ? GD.schema.validate(ep) : (GD.model.validate ? GD.model.validate(ep) : []);
        if (errs && errs.length) {
          try { if (GD.store.keepRejected) await GD.store.keepRejected(ep, errs); } catch (e) { /* still tell the user */ }
          toast("The saved episode did not pass validation (" + errs[0] + "). A backup was kept and has not been overwritten.");
          ep = null;
        }
      }
      if (ep && GD.media) { try { await GD.media.hydrateBlobs(); } catch (e) { /* ignore */ } }
    }
    if (!ep) ep = GD.model.demoEpisode();
    loadEpisode(ep);
    const imp = params.get("import");
    if (imp && GD.assistant) {
      try {
        const r = await GD.assistant.importSameOrigin(imp);
        if (r && r.ok) loadEpisode(r.episode, "Imported (same-origin, validated).");
        else toast("Import rejected: " + ((r && r.errors && r.errors[0]) || "invalid path"));
      } catch (e) {
        toast("Import failed.");
      }
    }
    if (params.get("aspect")) applyAspect(params.get("aspect"));
    if (params.get("t")) GD.playback.seek(Number(params.get("t")));
    GD.globe.st.onReady.push(() => { GD.globe.setEpisode(S.episode); renderOverlays(); });
    window.__globedesk = window.__gobedesk = { ready: true }; // smoke-test hook (legacy alias kept)
  }

  GD.ui = { toast, selectStory, renderOverlays, renderTransport, onPlaybackEnd, loadEpisode, changed, renderInspector, download, esc, field, num, slug, addFiles, showFull };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
