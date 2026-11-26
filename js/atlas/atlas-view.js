/* Atlas view: catalogue (A-Z, Elements, Categories, By place, By year), a Globe | 3D switch, entry tabs
   (Object, Parts, Chemistry, Sources), reading-tier switch, and the Community lane when it is on.
   Reads GD.atlasData (generated, local). No network: online price and solar lookups are off.
   Globe markers are DOM markers on top of the map; the base-map style is never changed. window.GD.atlas */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const M = () => GD.atlasModel;
  const D = () => GD.atlasData;
  const UNKNOWN = "[UNKNOWN]";
  const st = {
    open: false, view: "az", mode: "globe", q: "", category: "", tier: "all", selected: null, tab: "object",
    zoom: "years", year: null, month: null, week: null, region: "US", option: "S", place: null, markers: [],
    elementsMode: null, elementZoom: null
  };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function link(url, label) {
    return /^https:\/\/[^\s"'<>]+$/i.test(String(url || "")) ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label || url) + "</a>" : esc(label || "") + " " + UNKNOWN;
  }
  const $ = (id) => global.document.getElementById(id);
  function today() { return new Date().toISOString().slice(0, 10); }
  function filters() { return { q: st.q, category: st.category, tier: st.tier }; }
  function communityOn() { return !!(GD.userLayers && GD.userLayers.communityOn && GD.userLayers.communityOn()); }

  // ---------- catalogue ----------
  function entryRow(e, label, alias) {
    const ph = e.status === "placeholder";
    return '<li role="option" class="at-row' + (st.selected === e.id ? " on" : "") + (ph ? " placeholder" : "") + '" data-at-entry="' + esc(e.id) + '" tabindex="-1" aria-selected="' + (st.selected === e.id) + '">' +
      '<span class="at-title">' + esc(label) + (alias ? ' <span class="muted small">→ ' + esc(e.title) + "</span>" : "") + "</span>" +
      '<span class="at-tags"><span class="pill">' + esc(e.kind) + '</span><span class="pill">' + esc(M().TIER_LABEL[e.tier] || e.tier) + "</span>" +
      '<span class="pill ' + (ph ? "warn" : "") + '">' + esc(e.status) + "</span>" + (e.current ? '<span class="pill ok">Now</span>' : "") + "</span></li>";
  }

  function azHtml() {
    const rows = M().azRows(D(), filters());
    const L = M().letters(rows);
    let cur = "";
    const items = rows.map((r) => { const head = r.letter !== cur ? ((cur = r.letter), '<li class="at-letter" id="atL-' + esc(r.letter) + '" role="presentation">' + esc(r.letter) + "</li>") : ""; return head + entryRow(r.entry, r.label, r.alias); }).join("");
    return '<nav class="at-jump" aria-label="Letter jump">' + L.map((l) => '<button type="button" class="mini" data-at-letter="' + esc(l) + '">' + esc(l) + "</button>").join("") + "</nav>" +
      '<ul class="at-list" role="listbox" aria-label="Atlas entries, A to Z">' + (items || '<li class="muted small">No entries match.</li>') + "</ul>";
  }

  function categoriesHtml() {
    const tree = M().tree(D());
    const comm = communityOn();
    const doc = D().community;
    return '<ul class="at-cats">' + tree.map((c) => {
      const people = comm && GD.communityCards ? GD.communityCards.contributorsFor(doc, c.id, today()) : [];
      return '<li class="at-cat' + (c.installed ? "" : " not-installed") + '"><button type="button" class="at-cat-btn" data-at-cat="' + esc(c.id) + '">' +
        '<span class="at-title">' + c.n + ". " + esc(c.title) + '</span><span class="at-tags"><span class="pill">' + c.count + ' entries</span><span class="pill ' + (c.installed ? "ok" : "warn") + '">' + (c.installed ? "pack " + esc(c.packStatus) : "pack not built yet") + '</span><span class="pill">refresh ' + esc(c.refresh) + "</span></span></button>" +
        '<p class="muted small">' + esc(c.scope) + "</p>" +
        '<p class="small at-subs">' + c.subcategories.map((s) => esc(s.title)).join(" · ") + "</p>" +
        (comm ? '<div class="at-community small"><span class="cm-badge">Community</span> Contributors: ' +
          (people.length ? "<ul>" + people.map((p) => '<li class="cm-card' + (p.stale ? " stale" : "") + '">@' + esc(p.handle) + (p.stale ? " (needs recheck)" : "") + ' <span class="muted">' + esc(p.description) + "</span> " +
            p.links.map((l) => link(l.url, l.title) + (cls(l) === "experimental" ? " " + expLabel() : "")).join(" ") + "</li>").join("") + "</ul>" : '<span class="muted">none yet</span>') + "</div>" : "") +
        "</li>";
    }).join("") + "</ul>" +
      (comm ? "" : '<p class="muted small">Contributor lists are in the Community lane. Turn on Community in Layers to see them.</p>');
  }

  function placeHtml() {
    const r = M().byPlace(D(), filters());
    const rows = r.rows.map((p) => {
      const open = st.place === p.key;
      return '<li class="at-place' + (open ? " on" : "") + '"><button type="button" class="at-cat-btn" data-at-place="' + esc(p.key) + '"><span class="at-title">' + esc(p.key) + '</span><span class="pill">' + p.count + "</span></button>" +
        (open ? Object.keys(p.groups).map((g) => { const c = M().category(D(), g); return '<div class="small at-group"><b>' + esc(c ? c.title : g) + "</b><ul class=\"at-list\">" + p.groups[g].map((id) => { const e = M().entryById(D(), id); return e ? entryRow(e, e.title) : ""; }).join("") + "</ul></div>"; }).join("") +
          (p.subdivisions.length ? '<p class="muted small">Listed under ' + esc(p.key) + " (no official point bundled for " + p.subdivisions.map((s) => esc(s.key)).join(", ") + ").</p>" : "") : "") + "</li>";
    }).join("");
    const none = r.noPlace.map((id) => { const e = M().entryById(D(), id); return e ? entryRow(e, e.title) : ""; }).join("");
    return '<p class="muted small">Coarse places only (country or region). Counts show on the globe in Globe mode.</p><ul class="at-places">' + rows + "</ul>" +
      '<details class="at-noplace"><summary>No place (' + r.noPlace.length + ")</summary><ul class=\"at-list\">" + none + "</ul></details>";
  }

  function yearHtml() {
    const m = M();
    const base = m.byYear(D(), filters(), { today: today(), zoom: st.zoom, year: st.year, month: st.month, week: st.week });
    const cy = parseInt(today().slice(0, 4), 10);
    const min = Math.min(base.range.min, cy);
    const sliderYear = st.zoom === "years" ? (st.year == null ? cy : st.year) : cy;
    const zoomBtns = st.zoom !== "years" || sliderYear === cy;
    let html = '<div class="at-timeline"><label class="small">Year <input id="atYear" type="range" min="' + min + '" max="' + cy + '" step="1" value="' + sliderYear + '" aria-label="Year"></label> <b id="atYearLabel">' + esc(m.yearLabel(sliderYear)) + "</b>" +
      ' <button type="button" class="mini" id="atAllYears">All years</button> <button type="button" class="mini" id="atThisWeek">This week</button></div>' +
      (zoomBtns ? '<div class="seg small" role="group" aria-label="Zoom in the current year"><button type="button" data-at-zoom="years" aria-pressed="' + (st.zoom === "years") + '">Year</button><button type="button" data-at-zoom="months" aria-pressed="' + (st.zoom === "months") + '">Months</button><button type="button" data-at-zoom="weeks" aria-pressed="' + (st.zoom === "weeks") + '">Weeks</button></div>' : "") +
      '<p class="muted small">Slider earliest year: ' + esc(m.yearLabel(min)) + " (from the earliest dated entry; the planned minimum is " + UNKNOWN + ").</p>";
    const row = (d) => { const e = m.entryById(D(), d.entry); if (!e) return ""; return '<li class="at-yrow"><span class="at-date">' + esc(d.date) + (d.end ? "–" + esc(d.end) : "") + (d.approximate ? " ~" : "") + ' <span class="pill">' + esc(d.precision) + "</span></span>" + '<ul class="at-list">' + entryRow(e, e.title) + "</ul></li>"; };
    if (base.zoom === "months" || base.zoom === "weeks") {
      html += '<div class="at-buckets">' + (base.buckets || []).map((b) => {
        const label = base.zoom === "months" ? new Date(Date.UTC(cy, b.month - 1, 1)).toLocaleString("en", { month: "short", timeZone: "UTC" }) : "W" + b.week;
        const on = base.zoom === "months" ? st.month === b.month : st.week === b.week;
        return '<button type="button" class="mini' + (on ? " on" : "") + (b.rows.length ? "" : " empty") + '" data-at-bucket="' + (base.zoom === "months" ? b.month : b.week) + '">' + esc(label) + " (" + b.rows.length + ")</button>";
      }).join("") + "</div>";
      if (base.yearOnly && base.yearOnly.length) html += '<p class="muted small">' + base.yearOnly.length + " entries in " + cy + " are dated to the year only.</p>";
    }
    if (base.zoom === "this-week") {
      html += '<p class="small"><b>This week</b>: ' + esc(base.week.start) + " to " + esc(base.week.end) + " (ISO week " + base.week.week + ").</p>" +
        (base.current.length ? '<p class="small">In Now: ' + base.current.map((id) => esc(id)).join(", ") + "</p>" : '<p class="muted small">Nothing in Now yet: the Now pack is not built ' + UNKNOWN + ".</p>");
    }
    html += '<ul class="at-years">' + (base.rows.map(row).join("") || '<li class="muted small">No dated entries here.</li>') + "</ul>";
    if (base.undated && base.undated.length) html += '<details class="at-noplace"><summary>Undated (' + base.undated.length + ")</summary><ul class=\"at-list\">" + base.undated.map((id) => { const e = m.entryById(D(), id); return e ? entryRow(e, e.title) : ""; }).join("") + "</ul></details>";
    return html;
  }


  function prefersReducedMotion() {
    try { return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }
  function elementsMode() {
    if (st.elementsMode === "table") return "table";
    if (st.elementsMode === "hologram" || st.elementsMode === "constellation") return "hologram";
    return prefersReducedMotion() ? "table" : "hologram";
  }
  function pt(c, r) { return (c - 0.5) + "," + (r - 0.5); }
  function configStatusLabel(s) {
    if (s === "supported") return "We have a record";
    return s || UNKNOWN;
  }
  function tileAtomSvg(s) {
    if (!s.shells || !s.shells.length) {
      return '<svg class="at-el-thumb at-el-thumb-unknown" viewBox="-24 -24 48 48" aria-hidden="true" focusable="false">' +
        '<circle class="at-el-ring at-el-ring-unknown" cx="0" cy="0" r="8"></circle>' +
        '<circle class="at-el-ring at-el-ring-unknown" cx="0" cy="0" r="14"></circle>' +
        '<circle class="at-el-ring at-el-ring-unknown" cx="0" cy="0" r="20"></circle>' +
        '<circle class="at-el-nuc" cx="0" cy="0" r="2.6"></circle>' +
        '<text class="at-el-qmark" x="0" y="3.2" text-anchor="middle">?</text></svg>';
    }
    const n = s.shells.length;
    const minR = 6, maxR = 20;
    let rings = "";
    let dots = "";
    for (let i = 0; i < n; i++) {
      const r = n === 1 ? 13 : minR + ((maxR - minR) * i) / (n - 1);
      rings += '<circle class="at-el-ring" cx="0" cy="0" r="' + r.toFixed(1) + '"></circle>';
      const count = s.shells[i];
      for (let j = 0; j < count; j++) {
        const a = (2 * Math.PI * j) / count - Math.PI / 2;
        const x = (Math.cos(a) * r).toFixed(1);
        const y = (Math.sin(a) * r).toFixed(1);
        dots += '<circle class="at-el-edot" cx="' + x + '" cy="' + y + '" r="1.15"></circle>';
      }
    }
    return '<svg class="at-el-thumb" viewBox="-24 -24 48 48" aria-hidden="true" focusable="false">' +
      rings + dots + '<circle class="at-el-nuc" cx="0" cy="0" r="2.6"></circle></svg>';
  }
  function zoomAtomSvg(s) {
    const letters = M().SHELL_LETTERS || ["K", "L", "M", "N", "O", "P", "Q"];
    if (!s.shells || !s.shells.length) {
      let rings = "";
      [38, 66, 94, 122].forEach((r) => {
        rings += '<circle class="at-el-ring at-el-ring-unknown" cx="0" cy="0" r="' + r + '"></circle>';
      });
      return '<svg class="at-el-atom at-el-atom-unknown" viewBox="-160 -160 320 320" role="img" aria-label="' + esc(s.title) + ' unknown electron shells">' +
        rings +
        '<circle class="at-el-nuc-lg" cx="0" cy="0" r="18"></circle>' +
        '<text class="at-el-nuc-txt" x="0" y="5" text-anchor="middle">' + esc(s.symbol) + "</text>" +
        '<text class="at-el-unk-lbl" x="0" y="142" text-anchor="middle">' + esc(s.configStatus + " — shells " + UNKNOWN) + "</text></svg>";
    }
    const n = s.shells.length;
    const minR = 34, maxR = 132;
    let rings = "";
    let orbits = "";
    let labels = "";
    for (let i = 0; i < n; i++) {
      const r = n === 1 ? 74 : minR + ((maxR - minR) * i) / (n - 1);
      const count = s.shells[i];
      const letter = letters[i] || String(i + 1);
      rings += '<circle class="at-el-ring" cx="0" cy="0" r="' + r.toFixed(1) + '"></circle>';
      let edots = "";
      for (let j = 0; j < count; j++) {
        const a = (2 * Math.PI * j) / count - Math.PI / 2;
        const x = (Math.cos(a) * r).toFixed(1);
        const y = (Math.sin(a) * r).toFixed(1);
        edots += '<circle class="at-el-edot-lg" cx="' + x + '" cy="' + y + '" r="3.4"></circle>';
      }
      const cls = "at-el-orbit at-el-orbit-" + (i + 1) + (i % 2 === 1 ? " at-el-orbit-rev" : "");
      orbits += '<g class="' + cls + '">' + edots + "</g>";
      // Place shell count labels staggered slightly off the vertical axis so they stay legible
      const lx = (i % 2 === 0 ? 1 : -1) * Math.min(28, 12 + i * 3);
      const ly = -r + 3.5;
      labels += '<g class="at-el-shell-tag">' +
        '<rect x="' + (lx - 18).toFixed(1) + '" y="' + (ly - 9).toFixed(1) + '" width="36" height="14" rx="7"></rect>' +
        '<text x="' + lx.toFixed(1) + '" y="' + (ly + 1.5).toFixed(1) + '" text-anchor="middle">' + esc(letter + ":" + count) + "</text></g>";
    }
    return '<svg class="at-el-atom" viewBox="-160 -160 320 320" role="img" aria-label="' + esc(s.title) + ' schematic Bohr-style electron shells">' +
      rings + orbits +
      '<circle class="at-el-nuc-lg" cx="0" cy="0" r="18"></circle>' +
      '<text class="at-el-nuc-txt" x="0" y="5" text-anchor="middle">' + esc(s.symbol) + "</text>" +
      labels + "</svg>";
  }
  function elementZoomHtml(ev) {
    const s = ev.stars.find((x) => x.id === st.elementZoom);
    if (!s) return "";
    const letters = M().SHELL_LETTERS || ["K", "L", "M", "N", "O", "P", "Q"];
    const shellsBar = s.shells && s.shells.length
      ? '<ul class="at-el-shells" aria-label="Electrons per shell">' + s.shells.map((n, i) => '<li><b>' + esc(letters[i] || String(i + 1)) + "</b> " + n + "</li>").join("") + "</ul>"
      : '<p class="small at-el-unk-note"><b>Shell occupancy:</b> ' + esc(s.configStatus === "not-proven" ? "not-proven " + UNKNOWN : UNKNOWN) + (s.configNote ? " — " + esc(s.configNote) : "") + "</p>";
    return '<div class="at-el-zoom at-fam-' + esc(s.family) + '">' +
      '<div class="at-el-zoom-bar">' +
      '<button type="button" class="mini" id="atElBack">← Back to table</button>' +
      '<span class="at-el-zoom-title"><b>' + esc(s.name) + "</b> (" + esc(s.symbol) + ", Z=" + s.z + ') <span class="pill">' + esc(s.familyLabel) + '</span> <span class="pill">' + esc(configStatusLabel(s.configStatus)) + "</span></span>" +
      '<button type="button" class="mini on" id="atElOpenCard" data-at-el-open="' + esc(s.id) + '">Open Atlas card</button>' +
      "</div>" +
      '<div class="at-el-stage">' + zoomAtomSvg(s) + "</div>" +
      '<p class="small at-el-cfg-line"><b>Ground-state configuration:</b> <code>' + esc(s.config) + "</code></p>" +
      shellsBar +
      '<p class="muted small at-el-caption">Schematic Bohr-style picture showing NIST ground-state shell counts, not a physical orbital map or electron trajectory.</p>' +
      "</div>";
  }
  function elementsHtml() {
    const ev = M().elementsView(D(), filters());
    const mode = elementsMode();
    if (st.elementZoom && mode === "hologram") {
      const zoomed = elementZoomHtml(ev);
      if (zoomed) return '<div class="at-elements">' + zoomed + "</div>";
      st.elementZoom = null;
    }
    const note = '<p class="muted small at-el-note">IUPAC 18-column layout, NIST SP 966 ground-state shells (schematic Bohr-style tiles, not a physical orbital map). Dashed fork: Group 3 is unresolved. Z=104–118 stay dashed (' + UNKNOWN + " / not-proven).</p>";
    const toggle = '<div class="seg small" role="group" aria-label="Elements presentation">' +
      '<button type="button" data-at-el-mode="hologram" aria-pressed="' + (mode === "hologram") + '">Hologram</button>' +
      '<button type="button" data-at-el-mode="table" aria-pressed="' + (mode === "table") + '">Table</button></div>';
    const legend = '<ul class="at-el-legend" aria-label="Family colours">' + ev.families.map((f) => '<li class="at-fam-' + esc(f.id) + '">' + esc(f.label) + "</li>").join("") + "</ul>";
    let body;
    if (mode === "table") {
      const rows = ev.stars.filter((s) => s.match);
      const letters = M().SHELL_LETTERS || ["K", "L", "M", "N", "O", "P", "Q"];
      body = '<div class="at-el-table-wrap"><table class="at-table at-el-table"><caption class="muted small">Chemical elements in atomic-number order. Follows the search box and category filter.</caption>' +
        "<thead><tr><th>Z</th><th>Sym</th><th>Name</th><th>Shells</th><th>Family</th></tr></thead><tbody>" +
        (rows.map((s) => {
          const on = st.selected === s.id;
          const sh = s.shells ? s.shells.map((n, i) => (letters[i] || "") + ":" + n).join(" ") : s.configStatus;
          return '<tr class="' + (on ? "on" : "") + '"><td class="at-el-z">' + s.z + "</td><td>" + esc(s.symbol) + '</td><td><button type="button" class="at-el-name" data-at-entry="' + esc(s.id) + '" aria-current="' + on + '">' + esc(s.name) + '</button></td><td class="small">' + esc(sh) + "</td><td>" + esc(s.familyLabel) + "</td></tr>";
        }).join("") || '<tr><td colspan="5" class="muted">No element records match this search or filter.</td></tr>') +
        "</tbody></table></div>";
    } else {
      const lines = ev.lines.map((l) => '<polyline class="at-el-line at-fam-' + esc(l.family) + '" fill="none" points="' + l.points.map((p) => pt(p.col, p.row)).join(" ") + '"></polyline>').join("");
      const forks = ev.forks.map((fk) => '<g class="at-el-fork"><title>' + esc(fk.label) + "</title>" + fk.paths.map((path) => '<polyline fill="none" points="' + path.map((p) => pt(p.col, p.row)).join(" ") + '"></polyline>').join("") + "</g>").join("");
      const focusId = st.selected && ev.stars.some((s) => s.id === st.selected) ? st.selected : ((ev.stars.find((s) => s.match) || ev.stars[0] || {}).id);
      const stars = ev.stars.map((s) => {
        const on = st.selected === s.id;
        const miss = !s.match;
        const unk = !s.shells;
        const aria = s.title + (s.shells ? ", shells " + s.shells.join("-") : ", shells " + s.configStatus);
        return '<button type="button" role="option" class="at-el-star at-el-tile at-fam-' + esc(s.family) + (on ? " on" : "") + (miss ? " at-el-miss" : "") + (unk ? " at-el-unk" : "") + '" data-at-el-zoom="' + esc(s.id) + '" data-at-el-c="' + s.col + '" data-at-el-r="' + s.row + '" tabindex="' + (s.id === focusId ? "0" : "-1") + '" aria-selected="' + on + '" aria-label="' + esc(aria) + '">' +
          '<span class="at-el-num" aria-hidden="true">' + s.z + '</span><span class="at-el-sym" aria-hidden="true">' + esc(s.symbol) + "</span>" +
          tileAtomSvg(s) +
          (unk ? '<span class="at-el-unk-tag" aria-hidden="true">' + esc(s.configStatus === "not-proven" ? "not-proven" : UNKNOWN) + "</span>" : "") +
          "</button>";
      }).join("");
      const missing = ev.missing.length ? '<p class="muted small">No record for Z=' + ev.missing.join(", ") + " " + UNKNOWN + ".</p>" : "";
      body = '<div class="at-el-sky" id="atElSky"><svg class="at-el-lines" viewBox="0 0 18 10" preserveAspectRatio="none" aria-hidden="true" focusable="false">' + lines + forks + "</svg>" +
        '<div class="at-el-grid" role="listbox" aria-label="Chemical elements holographic periodic table">' + stars + "</div></div>" + missing;
    }
    return '<div class="at-elements">' + toggle + note + legend + body + "</div>";
  }
  function onElementsNav(ev) {
    const k = ev.key;
    if (k !== "ArrowLeft" && k !== "ArrowRight" && k !== "ArrowUp" && k !== "ArrowDown" && k !== "Home" && k !== "End" && k !== "Enter" && k !== " ") return;
    const zoomId = ev.target && ev.target.getAttribute && ev.target.getAttribute("data-at-el-zoom");
    const entryId = ev.target && ev.target.getAttribute && ev.target.getAttribute("data-at-entry");
    if ((k === "Enter" || k === " ") && zoomId) { ev.preventDefault(); st.elementZoom = zoomId; render(); return; }
    if ((k === "Enter" || k === " ") && entryId) { ev.preventDefault(); select(entryId); return; }
    if (k === "Enter" || k === " ") return;
    ev.preventDefault();
    const evw = M().elementsView(D(), filters());
    const id = zoomId || entryId;
    const from = evw.stars.find((s) => s.id === id);
    const table = ev.currentTarget.classList && ev.currentTarget.classList.contains("at-el-table");
    const next = M().stepElement(evw.stars, from, k, { matchesOnly: !!table });
    if (!next) return;
    const sel = table ? '[data-at-entry="' + next.id + '"]' : '[data-at-el-zoom="' + next.id + '"]';
    const btn = ev.currentTarget.querySelector(sel);
    if (!btn) return;
    ev.currentTarget.querySelectorAll("[data-at-el-zoom], [data-at-entry]").forEach((b) => { b.tabIndex = -1; });
    btn.tabIndex = 0;
    if (btn.focus) btn.focus();
  }

  // ---------- entry detail ----------
  function recordOf(e) { const r = e && (e.record || (e.records || [])[0]); return r ? D().records[r] : null; }
  function isKit(r) { return !!(r && Array.isArray(r.options)); }
  function kitRecord(e) { if (!e) return null; if (e.kind === "object") { const r = recordOf(e); return isKit(r) ? r : null; } if (e.id === "bag-solar-kit-prices") return D().records["data/atlas/objects/bag-solar-kit.json"]; return null; }
  // Historic object or material record (globedesk.artifact/1): facts, parts, materials, dated timeline.
  function artRecord(e) { const r = recordOf(e); return r && r.schema === "globedesk.artifact/1" ? r : null; }
  function srcLabel(id) { const s = (D().sources || []).find((x) => x.id === id); return s ? link(s.url, s.publisher || s.title) : esc(id + " " + UNKNOWN); }
  function dateLabel(d) { return esc(d.date + (d.approximate ? " (approx.)" : "")); }
  // Bells layer records (globedesk.bell/1) and the bells overview (globedesk.bell-overview/1).
  function bellRecord(e) { const r = recordOf(e); return r && r.schema === "globedesk.bell/1" ? r : null; }
  function overviewRecord(e) { const r = recordOf(e); return r && r.schema === "globedesk.bell-overview/1" ? r : null; }
  function srcLink(id) { const s = (D().sources || []).find((x) => x.id === id); return s ? link(s.url, s.publisher || s.title) : esc(id + " " + UNKNOWN); }
  function entryLink(id) { const t = M().entryById(D(), id); return t ? '<button type="button" class="linklike" data-at-entry="' + esc(id) + '">' + esc(t.title) + "</button>" : esc(id) + ' <span class="muted">(not in this copy)</span>'; }
  function fmtNum(v, unit, digits) { return v == null ? UNKNOWN : Number(v).toLocaleString("en", { maximumFractionDigits: digits == null ? 2 : digits }) + " " + unit; }
  const STATUS_LABEL = { "in-place": "In place", museum: "Museum or display", lost: "Lost", "in-storage": "In storage", "[UNKNOWN]": "Status [UNKNOWN]" };

  function bellHtml(e, rec) {
    const row = (k, v) => "<tr><th>" + esc(k) + "</th><td>" + v + "</td></tr>";
    let h = '<h4>Bell facts</h4><table class="at-table small at-bell-facts">' +
      row("Kind", esc(rec.kind)) + row("Status", '<span class="pill ' + (rec.status === "lost" || rec.status === "[UNKNOWN]" ? "warn" : "ok") + '">' + esc(STATUS_LABEL[rec.status] || rec.status) + "</span> " + esc(rec.status_note)) +
      row("Place", esc(rec.place.label) + (rec.place.approximate ? ' <span class="pill warn">approximate pin</span>' : "") + ' <span class="muted">(' + esc(rec.place.lat.toFixed(4) + ", " + rec.place.lng.toFixed(4)) + "; " + esc(rec.place.coords_source) + ")</span>") +
      row("Region and era", esc(rec.region + " · " + rec.era)) + row("Foundry or maker", esc(rec.maker)) +
      row("Mass", esc(fmtNum(rec.mass_kg, "kg", 0)) + ' <span class="muted">' + esc(rec.mass_note) + "</span>") +
      row("Diameter", esc(fmtNum(rec.diameter_m, "m", 3))) + row("Height", esc(fmtNum(rec.height_m, "m", 3))) +
      (rec.thickness_m ? row("Wall (sound bow)", esc(fmtNum(rec.thickness_m, "m", 3))) : "") +
      row("Note", esc(rec.note || UNKNOWN)) + (rec.bells_count !== undefined ? row("Bells", esc(rec.bells_count == null ? UNKNOWN : rec.bells_count)) : "") +
      row("Alloy", entryLink(rec.alloy.entry) + " · " + esc(rec.alloy.note)) + "</table>";
    h += '<h4>Timeline</h4>' + (rec.timeline.length ? '<ol class="small at-timeline-list">' + rec.timeline.map((t) => '<li><b>' + esc(M().yearLabel(parseInt(t.date, 10)) + (t.date.length > 4 && t.date[0] !== "-" ? t.date.slice(4) : "")) + (t.end ? "–" + esc(t.end) : "") + (t.approximate ? " ~" : "") + "</b> " + esc(t.event) + ' <span class="muted">· ' + srcLink(t.source) + "</span></li>").join("") + "</ol>" : '<p class="muted small">Dated timeline ' + UNKNOWN + ".</p>");
    h += '<h4>3D model</h4><p class="small">' + esc(rec.model.label) + (rec.model.available ? ' <button type="button" class="mini" data-at-mode="3d" id="atBell3d">Show the 3D bell</button>' : "") + "</p>";
    h += '<p class="small">Official source: <b>' + esc(rec.official_status) + "</b>" + (rec.unknowns.length ? ' · Gaps: ' + rec.unknowns.map((u) => esc(u)).join("; ") : "") + "</p>";
    return h;
  }
  function overviewHtml(rec) {
    return rec.sections.map((sec) => '<section class="at-ov small"><h4>' + esc(sec.title) + "</h4><p>" + esc(sec.text) + '</p><p class="muted">Sources: ' + sec.sources.map(srcLink).join(", ") +
      (sec.bells.length ? "<br>Bells: " + sec.bells.map(entryLink).join(", ") : "") + "</p></section>").join("") +
      '<p class="muted small">Bells by region: ' + Object.keys(rec.counts).sort().map((k) => esc(k + " " + rec.counts[k])).join(" · ") + "</p>";
  }
  function priceRegions() { return Object.keys(D().records).filter((k) => /^data\/atlas\/prices\//.test(k)).map((k) => D().records[k].region).sort(); }
  function priceDoc(region) { return D().records["data/atlas/prices/" + region + ".json"] || null; }

  function objectTab(e) {
    const kit = kitRecord(e);
    const note = M().tierNote(e, st.tier);
    const art = artRecord(e);
    let h = '<p class="at-text">' + esc(M().tierText(e, st.tier)) + "</p>" + (note ? '<p class="muted small">' + esc(note) + "</p>" : "") +
      (M().tiersWritten ? '<p class="muted small at-levels">Reading levels written: ' + M().tiersWritten(e).map((t) => esc(M().TIER_LABEL[t])).join(", ") + "</p>" : "") +
      '<p class="small"><span class="pill">' + esc(e.kind) + '</span> <span class="pill">' + esc(M().TIER_LABEL[e.tier]) + '</span> <span class="pill ' + (e.status === "draft" || e.status === "placeholder" ? "warn" : "ok") + '">' + esc(e.status) + '</span> <span class="pill">confidence ' + esc(e.confidence) + '</span> <span class="pill">' + esc(e.license) + "</span> <span class=\"muted\">checked " + esc(e.checked) + "</span></p>";
    if (e.places.length) h += '<p class="small">Places: ' + e.places.map((p) => esc((p.region || UNKNOWN) + " (" + p.precision + ")" + (p.note ? " · " + p.note : ""))).join(", ") + "</p>";
    if (e.dates.length) h += '<p class="small">Dates: ' + e.dates.map((d) => esc(d.date + " (" + d.precision + (d.approximate ? ", approximate" : "") + ")")).join(", ") + "</p>";
    if (e.related.length) h += '<p class="small">Related: ' + e.related.map((r) => { const t = M().entryById(D(), r.to); return '<button type="button" class="linklike" data-at-entry="' + esc(r.to) + '">' + esc(t ? t.title : r.to) + "</button> <span class=\"muted\">(" + esc(r.type) + ")</span>"; }).join(", ") + "</p>";
    if (kit && e.kind === "object") {
      h += '<h4>Sizes</h4><div class="seg small" role="group" aria-label="Kit size">' + kit.options.map((o) => '<button type="button" data-at-option="' + esc(o.id) + '" aria-pressed="' + (st.option === o.id) + '">' + esc(o.id + " · " + o.name) + "</button>").join("") + "</div>";
      const o = kit.options.find((x) => x.id === st.option) || kit.options[0];
      const derived = (o.derived && typeof o.derived === "object") ? o.derived : {};
      const facts = (kit.facts && typeof kit.facts === "object") ? kit.facts : {};
      h += '<table class="at-table small"><tr><th>Config</th><td>' + esc(o.config) + "</td></tr><tr><th>Energy</th><td>" + esc(o.wh) + " Wh</td></tr><tr><th>Air travel (US)</th><td>" + esc(o.air_rule) + "</td></tr>" +
        Object.keys(derived).map((k) => "<tr><th>" + esc(k.replace(/_/g, " ")) + "</th><td>" + esc(derived[k]) + "</td></tr>").join("") + "</table>";
      if (Object.keys(facts).length) h += "<h4>Key facts</h4><table class=\"at-table small\">" + Object.keys(facts).map((k) => "<tr><th>" + esc(k) + "</th><td>" + esc(facts[k]) + "</td></tr>").join("") + "</table>";
      h += "<h4>Safety rules in the record</h4><ul class=\"small\">" + kit.safety.map((s) => "<li><b>" + esc(s.topic) + ":</b> " + esc(s.rule) + "</li>").join("") + "</ul>";
      h += '<p class="muted small">Draft: not built or tested. Model is an artistic layout from the parametric record, not a build drawing.</p>';
    }
    if ((e.see_also_ids || []).length) h += '<p class="small at-seealso">See also: ' + e.see_also_ids.map(entryLink).join(", ") + "</p>";
    if (art) {
      if (art.facts.length) h += '<h4>Key facts</h4><table class="at-table small at-facts">' + art.facts.map((f) => "<tr><th>" + esc(f.label) + "</th><td>" + esc(f.value) + ' <span class="muted">· ' + srcLabel(f.source) + "</span></td></tr>").join("") + "</table>";
      if (art.timeline.length) h += '<h4>Timeline</h4><ol class="small at-timeline-list">' + art.timeline.map((t) => "<li><b>" + dateLabel(t) + "</b> " + esc(t.event) + ' <span class="muted">· ' + srcLabel(t.source) + "</span></li>").join("") + "</ol>";
      if (art.unknowns.length) h += '<p class="muted small">Not known yet: ' + art.unknowns.map(esc).join("; ") + "</p>";
    }
    const bell = bellRecord(e), ov = overviewRecord(e);
    if (bell) h += bellHtml(e, bell);
    if (ov) h += overviewHtml(ov);
    return h + personalHtml(e);
  }

  function partsTab(e) {
    const kit = kitRecord(e);
    const art = artRecord(e);
    if (!kit && art && art.parts.length) return '<table class="at-table small at-parts"><thead><tr><th>Part</th><th>Material</th><th>Note</th><th>Source</th></tr></thead><tbody>' +
      art.parts.map((p) => "<tr><td><b>" + esc(p.part) + "</b></td><td>" + esc(p.material) + "</td><td>" + esc(p.note || "") + "</td><td>" + srcLabel(p.source) + "</td></tr>").join("") + "</tbody></table>" +
      '<p class="muted small">Historic object: parts and materials only where an official page states them; everything else is ' + UNKNOWN + ".</p>";
    if (!kit) return '<p class="muted">No parts list for this entry ' + UNKNOWN + ".</p>";
    const regions = priceRegions();
    const P = global.GD_ATLAS_PRICING;
    const code = P ? P.resolve(st.region, regions) : null;
    const q = P && code ? P.quote(kit, st.option, priceDoc(code)) : null;
    const line = (id) => (q ? q.lines.find((l) => l.part === id) : null);
    let h = '<p class="small">Size <b>' + esc(st.option) + '</b> · Region <select id="atRegion" aria-label="Price region">' + regions.map((r) => '<option value="' + esc(r) + '"' + (r === code ? " selected" : "") + ">" + esc(r) + "</option>").join("") + "</select>" +
      ' <span class="muted">Bundled, dated price checks only. Online price lookups are off.</span></p>';
    h += '<table class="at-table small"><thead><tr><th>Part</th><th>Qty</th><th>Lowest checked (' + esc(q ? q.currency : UNKNOWN) + ")</th><th>Ease</th></tr></thead><tbody>" +
      kit.parts.map((p) => { const l = line(p.id) || {}; return "<tr><td><b>" + esc(p.id) + "</b><br><span class=\"muted\">" + esc(p.class) + "</span></td><td>" + esc(p.qty[st.option]) + "</td><td>" +
        (l.status === "checked" ? esc(l.low) + " <span class=\"muted\">(" + esc(l.checked) + ")</span>" + (l.sources || []).map((u) => " " + link(u, "source")).join("") : l.status === "not-needed" ? '<span class="muted">not needed</span>' : UNKNOWN) +
        "</td><td>" + esc(p.ease || UNKNOWN) + "</td></tr>"; }).join("") + "</tbody></table>";
    if (q) h += '<p class="small">Known parts total (low): <b>' + esc(q.knownTotalLow) + " " + esc(q.currency) + "</b>" + (q.complete ? "" : ' <span class="pill warn">partial: ' + q.unknownParts.length + " parts " + UNKNOWN + "</span>") + "</p>";
    const pd = code ? priceDoc(code) : null;
    if (pd && pd.tax_note) h += '<p class="muted small">' + esc(pd.tax_note) + "</p>";
    return h + '<p class="muted small">Seller links are plain links with no affiliate codes; whether to show sellers at all is an open owner question.</p>';
  }

  function chemistryTab(e) {
    let chemId = e.kind === "chemistry" ? e.id : null;
    const kit = kitRecord(e);
    const own = artRecord(e);
    if (!chemId && own && own.chemistry) chemId = own.chemistry;
    const cEntry = chemId ? M().entryById(D(), chemId) : null;
    const cRec = cEntry ? recordOf(cEntry) : null;
    if ((own && own.materials.length) || (cRec && cRec.materials)) {
      const rows = (own ? own.materials : []).concat(cRec && cRec !== own && cRec.materials ? cRec.materials : []);
      return (cEntry && chemId !== e.id ? '<p class="small">Material: <button type="button" class="linklike" data-at-entry="' + esc(chemId) + '">' + esc(cEntry.title) + "</button></p>" : "") +
        '<table class="at-table small at-materials"><thead><tr><th>Material</th><th>Composition</th><th>Source</th></tr></thead><tbody>' +
        rows.map((r) => "<tr><td>" + esc(r.material) + "</td><td>" + esc(r.composition) + "</td><td>" + srcLabel(r.source) + "</td></tr>").join("") + "</tbody></table>" +
        (cEntry ? '<p class="small">' + esc(M().tierText(cEntry, st.tier)) + "</p>" : "") + '<p class="muted small">Crystal or molecule 3D models: ' + UNKNOWN + ".</p>";
    }
    if (!chemId && kit && kit.chemistry && kit.chemistry.length) chemId = kit.chemistry[0];
    const bell = bellRecord(e);
    if (!chemId && bell) chemId = bell.alloy.entry;
    const ce = chemId ? M().entryById(D(), chemId) : null;
    const rec = ce ? recordOf(ce) : null;
    if (!rec) return '<p class="muted">No chemistry record for this entry ' + UNKNOWN + ".</p>" + (ce ? "<p>" + esc(ce.summary) + "</p>" : "");
    const elCfg = rec.byId && rec.byId[ce.id];
    const letters = M().SHELL_LETTERS || ["K", "L", "M", "N", "O", "P", "Q"];
    let h = (chemId !== e.id ? '<p class="small">From <button type="button" class="linklike" data-at-entry="' + esc(chemId) + '">' + esc(ce.title) + "</button></p>" : "");
    if (elCfg) {
      const shellRows = elCfg.shells ? elCfg.shells.map((n, i) => (letters[i] || String(i + 1)) + ": " + n).join(", ") : UNKNOWN;
      h += '<table class="at-table small"><tbody>' +
        '<tr><th>Ground-state configuration</th><td><code>' + esc(elCfg.config) + "</code></td></tr>" +
        '<tr><th>Shell occupancy</th><td>' + esc(shellRows) + "</td></tr>" +
        '<tr><th>Record status</th><td>' + esc(configStatusLabel(elCfg.status)) + "</td></tr>" +
        '<tr><th>Source</th><td>' + (elCfg.source ? srcLink(elCfg.source) : UNKNOWN) + "</td></tr>" +
        "</tbody></table>" +
        (elCfg.note ? '<p class="muted small">' + esc(elCfg.note) + "</p>" : "");
    } else if (rec.properties) {
      h += '<p class="small">' + esc(M().tierText ? M().tierText(ce, st.tier) : ce.summary) + '</p><table class="at-table small"><thead><tr><th>Property</th><th>Value</th><th>Source</th></tr></thead><tbody>' +
        rec.properties.map((r) => "<tr><td>" + esc(r.property) + "</td><td>" + esc(r.value) + "</td><td>" + (r.source ? srcLink(r.source) : UNKNOWN) + "</td></tr>").join("") + "</tbody></table>";
    } else if (rec.compare) {
      h += '<table class="at-table small"><thead><tr><th>Property</th><th>LFP</th><th>NMC</th><th>Source</th></tr></thead><tbody>' +
        rec.compare.map((r) => "<tr><td>" + esc(r.property) + "</td><td>" + esc(r.lfp) + "</td><td>" + esc(r.nmc) + "</td><td>" + esc(r.source) + "</td></tr>").join("") + "</tbody></table>";
    }
    if (!rec.properties) h += '<p class="small">' + esc(rec.why_this_kit_uses_lfp || "") + "</p>" + '<p class="muted small">Reactions: ' + esc(rec.reactions) + "<br>3D molecule or crystal models: " + esc(rec.molecule_models) + "</p>";
    if (rec.note) h += '<p class="muted small">' + esc(rec.note) + "</p>";
    return h;
  }

  function expLabel() { return '<span class="pill warn exp-label">' + esc(GD.sourceClass ? GD.sourceClass.EXPERIMENTAL_LABEL : "Experimental (not an official source)") + "</span>"; }
  function cls(s) { return GD.sourceClass ? GD.sourceClass.classOf(s) : (s.class || "reference"); }

  // Sources are grouped by class. Only Official sources back a claim; experimental references never do.
  function sourcesTab(e) {
    const src = M().sourcesFor(D(), e);
    const kit = kitRecord(e);
    const rec = recordOf(e);
    const extra = ((kit && kit.citations) || (rec && rec.citations) || []).filter((c) => !src.some((s) => s.url === c.url))
      .map((c) => Object.assign({}, c, { class: ((D().sources || []).find((s) => s.url === c.url) || {}).class || "reference" }));
    const all = src.concat(extra);
    const official = all.filter((s) => cls(s) === "official");
    const refs = all.filter((s) => cls(s) === "reference");
    const outbound = (e.outbound || []).map((o) => Object.assign({}, o));
    const experimental = all.filter((s) => cls(s) === "experimental").concat(outbound.filter((o) => cls(o) === "experimental"));
    const row = (s) => "<li>" + link(s.url, s.title) + (s.publisher ? ' <span class="muted">· ' + esc(s.publisher) + "</span>" : "") + ' <span class="muted">checked ' + esc(s.checked || UNKNOWN) + "</span>" +
      (s.description ? '<br><span class="small at-src-desc">' + esc(s.description) + "</span>" : "") +
      (s.license ? '<br><span class="muted small at-src-terms">Reuse: ' + esc(s.license) + (s.terms_url ? " " + link(s.terms_url, "terms") : "") + "</span>" : "") + "</li>";
    let h = "<h4>Official sources</h4>" + (official.length ? '<ul class="small">' + official.map(row).join("") + "</ul>" : '<p class="muted small">Official source ' + UNKNOWN + ". Official means a primary or public record: government, a standards body, or a dataset with a named licence.</p>");
    h += "<h4>Other cited references</h4>" + (refs.length ? '<ul class="small">' + refs.map(row).join("") + "</ul>" : '<p class="muted small">None.</p>');
    const goDeeper = outbound.filter((o) => cls(o) !== "experimental");
    if (goDeeper.length) h += "<h4>Go deeper (outbound links)</h4><ul class=\"small\">" + goDeeper.map((o) => "<li>" + link(o.url, o.title) + "</li>").join("") + "</ul>";
    if (experimental.length) h += "<h4>Experimental references</h4><ul class=\"small exp-refs\">" + experimental.map((s) => "<li>" + link(s.url, s.title) + " " + expLabel() + "</li>").join("") + "</ul>";
    h += '<h4><span class="cm-badge">Community</span> Community links</h4>';
    if (!communityOn()) h += '<p class="muted small">The Community lane is off. Turn on Community in Layers to see contributor links. They are kept apart from official sources and never back a claim.</p>';
    else {
      const links = GD.communityCards ? GD.communityCards.linksFor(D().community, e.id) : [];
      h += links.length ? '<ul class="small cm-links">' + links.map((l) => "<li>" + link(l.url, l.title) + (cls(l) === "experimental" ? " " + expLabel() : "") + ' <span class="muted">via @' + esc(l.card) + " · " + esc(l.license) + " · checked " + esc(l.checked) + "</span></li>").join("") + "</ul>" : '<p class="muted small">No community links for this entry yet.</p>';
    }
    return h;
  }

  function personalHtml(e) {
    if (!GD.personal) return "";
    const followed = GD.personal.isFollowed(e.id);
    const notes = GD.personal.load().notes.filter((n) => n.entry === e.id);
    return '<div class="at-personal small"><h4>Your layer <span class="muted">(this device only)</span></h4>' +
      '<button type="button" class="mini" id="atFollow" aria-pressed="' + followed + '">' + (followed ? "Following" : "Follow") + "</button> " +
      '<button type="button" class="mini" id="atAddNote">Add note</button>' +
      (notes.length ? "<ul>" + notes.map((n) => "<li>" + esc(n.text) + "</li>").join("") + "</ul>" : "") + "</div>";
  }

  function detailHtml() {
    const e = st.selected ? M().entryById(D(), st.selected) : null;
    if (!e) return st.missingAtlasId ? '<p class="muted small">Entry "' + esc(st.missingAtlasId) + '" is not in this copy ' + UNKNOWN + ".</p>" : '<p class="muted small">Pick an entry to read it.</p>';
    const tabs = [["object", "Object"], ["parts", "Parts"], ["chemistry", "Chemistry"], ["sources", "Sources"]];
    const body = st.tab === "parts" ? partsTab(e) : st.tab === "chemistry" ? chemistryTab(e) : st.tab === "sources" ? sourcesTab(e) : objectTab(e);
    const three = st.mode === "3d" ? '<div id="at3d" class="at-3d" aria-label="3D model"></div><p id="at3dNote" class="muted small"></p>' : "";
    return '<h3 class="at-h">' + esc(e.title) + '</h3>' + three +
      '<div class="at-tabs" role="tablist">' + tabs.map((t) => '<button type="button" role="tab" data-at-tab="' + t[0] + '" aria-selected="' + (st.tab === t[0]) + '">' + t[1] + "</button>").join("") + "</div>" +
      '<div class="at-tabbody" role="tabpanel">' + body + "</div>";
  }

  function placeElementsSheet(root) {
    if (!root || !root.style || !root.style.setProperty) return;
    const doc = global.document;
    const win = global.window || global;
    const bar = doc && typeof doc.querySelector === "function" ? doc.querySelector(".topbar") : null;
    const narrow = !!(win.matchMedia && win.matchMedia("(max-width: 820px)").matches);
    if (narrow && bar && bar.getBoundingClientRect) { // every view: the phone sheet starts under the (wrapping) topbar
      const bottom = Math.ceil(bar.getBoundingClientRect().bottom);
      root.style.setProperty("--at-under-topbar", (bottom > 0 ? bottom : 52) + "px");
    } else if (root.style.removeProperty) {
      root.style.removeProperty("--at-under-topbar");
    }
  }

  // ---------- render ----------
  function render() {
    const root = $("atlasView");
    if (!root || !D() || !M()) return;
    const v = st.view;
    if (root.classList) {
      if (v === "elements") root.classList.add("at-showing-elements");
      else root.classList.remove("at-showing-elements");
    }
    const views = [["az", "A–Z"], ["elements", "Elements"], ["cats", "Categories"], ["place", "By place"], ["year", "By year"]];
    const cats = D().categories;
    root.innerHTML =
      '<div class="at-head"><h2>Atlas <span class="pill warn">draft</span></h2>' +
      '<div class="seg small" role="group" aria-label="Globe or 3D"><button type="button" data-at-mode="globe" aria-pressed="' + (st.mode === "globe") + '">Globe</button><button type="button" data-at-mode="3d" aria-pressed="' + (st.mode === "3d") + '">3D</button></div>' +
      '<button type="button" class="mini" id="atClose" aria-label="Close Atlas">×</button></div>' +
      '<div class="at-controls"><input id="atSearch" type="search" placeholder="Search the Atlas" aria-label="Search the Atlas" value="' + esc(st.q) + '" autocomplete="off">' +
      '<select id="atCategory" aria-label="Category"><option value="">All categories</option>' + cats.map((c) => '<option value="' + esc(c.id) + '"' + (st.category === c.id ? " selected" : "") + ">" + esc(c.title) + "</option>").join("") + "</select>" +
      '<select id="atTier" aria-label="Reading level"><option value="all">All reading levels</option>' + M().TIERS.map((t) => '<option value="' + t + '"' + (st.tier === t ? " selected" : "") + ">" + M().TIER_LABEL[t] + "</option>").join("") + "</select></div>" +
      '<div class="at-views" role="tablist" aria-label="Browse">' + views.map((x) => '<button type="button" role="tab" data-at-view="' + x[0] + '" aria-selected="' + (v === x[0]) + '">' + x[1] + "</button>").join("") + "</div>" +
      '<div class="at-body"><div class="at-browse" id="atBrowse">' + (v === "cats" ? categoriesHtml() : v === "place" ? placeHtml() : v === "year" ? yearHtml() : v === "elements" ? elementsHtml() : azHtml()) + "</div>" +
      '<div class="at-detail" id="atDetail">' + detailHtml() + "</div></div>" +
      '<p class="muted small at-foot">GlobeDesk Atlas · our own cited text, CC BY 4.0 · ' + D().index.length + " entries in " + (Object.keys(D().manifests).length - 1) + " packs · no entries about living people · online lookups off</p>";
    bind(root);
    placeElementsSheet(root);
    syncMarkers();
    if (st.mode === "3d") draw3d();
    if (st.view === "elements") {
      const active = global.document && global.document.activeElement;
      const typing = active && (active.id === "atSearch" || active.id === "atCategory" || active.id === "atTier");
      if (st.elementZoom) {
        const openBtn = root.querySelector("#atElOpenCard");
        if (!typing && openBtn && openBtn.focus) {
          try { openBtn.focus({ preventScroll: true }); } catch (e) { try { openBtn.focus(); } catch (e2) { /* ignore */ } }
        }
      } else {
        const targetId = st.selected ? String(st.selected).replace(/"/g, "") : "";
        const btn = (targetId && (root.querySelector('[data-at-el-zoom="' + targetId + '"]') || root.querySelector('[data-at-entry="' + targetId + '"]')))
          || root.querySelector(".at-el-tile:not(.at-el-miss)")
          || root.querySelector(".at-el-tile")
          || root.querySelector(".at-el-name");
        if (btn) {
          if (!typing && btn.focus) {
            try { btn.focus({ preventScroll: true }); } catch (e) { try { btn.focus(); } catch (e2) { /* ignore */ } }
          }
          const sky = root.querySelector(".at-el-sky");
          if (sky && sky.contains && sky.contains(btn)) {
            const br = sky.getBoundingClientRect();
            const sr = btn.getBoundingClientRect();
            if (sr.left < br.left) sky.scrollLeft += sr.left - br.left - 12;
            else if (sr.right > br.right) sky.scrollLeft += sr.right - br.right + 12;
            if (sr.top < br.top) sky.scrollTop += sr.top - br.top - 12;
            else if (sr.bottom > br.bottom) sky.scrollTop += sr.bottom - br.bottom + 12;
          }
        }
      }
    }
  }

  function select(id) {
    st.missingAtlasId = null;
    st.selected = id;
    const e = M().entryById(D(), id);
    if (e && st.tab === "chemistry" && e.kind !== "chemistry" && !kitRecord(e) && !artRecord(e) && !bellRecord(e)) st.tab = "object";
    render();
    if (e && st.mode === "globe") flyToEntry(e);
  }

  function bind(root) {
    const on = (sel, ev, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));
    on("[data-at-entry]", "click", (ev) => { ev.stopPropagation(); select(ev.currentTarget.getAttribute("data-at-entry")); });
    on("[data-at-view]", "click", (ev) => { st.view = ev.currentTarget.getAttribute("data-at-view"); if (st.view !== "elements") st.elementZoom = null; render(); });
    on("[data-at-el-mode]", "click", (ev) => { st.elementsMode = ev.currentTarget.getAttribute("data-at-el-mode"); st.elementZoom = null; render(); });
    on("[data-at-el-zoom]", "click", (ev) => { ev.stopPropagation(); st.elementZoom = ev.currentTarget.getAttribute("data-at-el-zoom"); render(); });
    on("[data-at-el-open]", "click", (ev) => { ev.stopPropagation(); const id = ev.currentTarget.getAttribute("data-at-el-open"); GD.atlas.select(id); const det = $("atDetail"); if (det && det.scrollIntoView && global.innerWidth <= 820) det.scrollIntoView({ block: "start" }); });
    const elBack = root.querySelector("#atElBack");
    if (elBack) elBack.addEventListener("click", () => { const prev = st.elementZoom; st.elementZoom = null; if (prev) st.selected = prev; render(); });
    const elGrid = root.querySelector(".at-el-grid");
    if (elGrid) elGrid.addEventListener("keydown", onElementsNav);
    const elTable = root.querySelector(".at-el-table");
    if (elTable) elTable.addEventListener("keydown", onElementsNav);
    on("[data-at-tab]", "click", (ev) => { st.tab = ev.currentTarget.getAttribute("data-at-tab"); render(); });
    on("[data-at-mode]", "click", (ev) => { st.mode = ev.currentTarget.getAttribute("data-at-mode"); render(); });
    on("[data-at-option]", "click", (ev) => { st.option = ev.currentTarget.getAttribute("data-at-option"); render(); });
    on("[data-at-cat]", "click", (ev) => { st.category = ev.currentTarget.getAttribute("data-at-cat"); st.view = "az"; render(); });
    on("[data-at-place]", "click", (ev) => { const k = ev.currentTarget.getAttribute("data-at-place"); st.place = st.place === k ? null : k; render(); if (st.place) flyToRegion(st.place); });
    on("[data-at-letter]", "click", (ev) => { const el = $("atL-" + ev.currentTarget.getAttribute("data-at-letter")); if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" }); });
    on("[data-at-zoom]", "click", (ev) => { st.zoom = ev.currentTarget.getAttribute("data-at-zoom"); st.month = null; st.week = null; render(); });
    on("[data-at-bucket]", "click", (ev) => { const n = parseInt(ev.currentTarget.getAttribute("data-at-bucket"), 10); if (st.zoom === "months") st.month = st.month === n ? null : n; else st.week = st.week === n ? null : n; render(); });
    const close = root.querySelector("#atClose"); if (close) close.addEventListener("click", closeView);
    let t = null;
    const s = root.querySelector("#atSearch");
    if (s) s.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { st.q = s.value; const pos = s.selectionStart; render(); const s2 = $("atSearch"); if (s2) { s2.focus(); try { s2.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } }, 120); });
    const c = root.querySelector("#atCategory"); if (c) c.addEventListener("change", () => { st.category = c.value; render(); });
    const tr = root.querySelector("#atTier"); if (tr) tr.addEventListener("change", () => { st.tier = tr.value; render(); });
    const rg = root.querySelector("#atRegion"); if (rg) rg.addEventListener("change", () => { st.region = rg.value; render(); });
    const y = root.querySelector("#atYear");
    if (y) {
      y.addEventListener("input", () => { const l = $("atYearLabel"); if (l) l.textContent = M().yearLabel(parseInt(y.value, 10)); });
      y.addEventListener("change", () => { st.year = parseInt(y.value, 10); st.zoom = "years"; render(); });
    }
    const aw = root.querySelector("#atThisWeek"); if (aw) aw.addEventListener("click", thisWeek);
    const ay = root.querySelector("#atAllYears"); if (ay) ay.addEventListener("click", () => { st.year = null; st.zoom = "years"; render(); });
    const f = root.querySelector("#atFollow"); if (f) f.addEventListener("click", () => { GD.personal.toggleFollow(st.selected); render(); });
    const n = root.querySelector("#atAddNote"); if (n) n.addEventListener("click", () => {
      const text = global.prompt ? global.prompt("Note for this entry (stays on this device):", "") : "";
      if (text && text.trim()) { GD.personal.addNote({ text: text.trim(), entry: st.selected }); render(); }
    });
  }

  function thisWeek() { st.view = "year"; st.zoom = "this-week"; st.year = null; render(); }

  // ---------- globe (DOM markers; base map untouched) ----------
  function centroid(a3) {
    const w = (global.GD_REGIONS || {}).world;
    const c = w && (w.countries || []).find((x) => x.a3 === a3);
    if (!c) return null;
    let best = null, area = -1;
    (c.polys || []).forEach((poly) => { const ring = poly[0] || []; const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]); const a = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) * (Math.max.apply(null, ys) - Math.min.apply(null, ys)); if (a > area) { area = a; best = ring; } });
    if (!best) return null;
    const xs = best.map((p) => p[0]), ys = best.map((p) => p[1]);
    return [(Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2];
  }
  function clearMarkers() { st.markers.forEach((m) => { try { m.remove(); } catch (e) { /* ignore */ } }); st.markers = []; }
  function syncMarkers() {
    clearMarkers();
    const map = GD.globe && GD.globe.st && GD.globe.st.map;
    if (!st.open || st.view !== "place" || st.mode !== "globe" || !map || !global.maplibregl) return;
    M().byPlace(D(), filters()).rows.forEach((r) => {
      const ll = centroid(r.a3);
      if (!ll) return;
      const el = global.document.createElement("button");
      el.type = "button"; el.className = "atlas-count"; el.textContent = String(r.count);
      el.setAttribute("aria-label", r.key + ": " + r.count + " Atlas entries");
      el.addEventListener("click", (ev) => { ev.stopPropagation(); st.place = r.key; render(); });
      st.markers.push(new global.maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map));
    });
  }
  function flyToRegion(key) {
    const p = M().byPlace(D(), {}).rows.find((r) => r.key === key);
    const ll = p && centroid(p.a3);
    if (ll && GD.globe && GD.globe.flyTo) { try { GD.globe.flyTo({ center: ll, zoom: 3, pitch: 0, bearing: 0, durationSec: 2 }); } catch (e) { /* ignore */ } }
  }
  // Fly to the entry's own pin when it has one (zoom by precision; an approximate site pin stops at city zoom), else to its country.
  const ZOOM = { site: 15, city: 11, subdivision: 6, country: 3 };
  function flyToEntry(e) {
    const p = (e.places || [])[0];
    if (p && typeof p.lat === "number" && typeof p.lng === "number" && GD.globe && GD.globe.flyTo) {
      const approx = /approximate/i.test(p.note || "");
      const zoom = p.precision === "site" && approx ? 11 : (ZOOM[p.precision] || 6);
      try { GD.globe.flyTo({ center: [p.lng, p.lat], zoom, pitch: p.precision === "site" && !approx ? 45 : 0, bearing: 0, durationSec: 2.5 }); } catch (err) { /* ignore */ }
      return;
    }
    if (p && p.region) flyToRegion(p.region.slice(0, 2));
  }

  // ---------- 3D ----------
  function draw3d() {
    const box = $("at3d"), note = $("at3dNote");
    if (!box) return;
    const e = st.selected ? M().entryById(D(), st.selected) : null;
    const bell = bellRecord(e);
    if (bell && GD.atlas3d) {
      if (!bell.model.available) { box.classList.add("stub"); box.textContent = bell.model.label; return; }
      const params = bell.model.params || { diameter_m: 1 };
      GD.atlas3d.show(box, "bell", params).then((r) => { if (note) note.textContent = r.ok ? bell.model.label + " Drag to turn." + (r.layout && r.layout.assumed && (r.layout.assumed.height || r.layout.assumed.thickness) ? " Assumed: " + [r.layout.assumed.height ? "height (0.8 × diameter)" : "", r.layout.assumed.thickness ? "wall (diameter ÷ 13)" : ""].filter(Boolean).join(", ") + "." : "") : "3D view unavailable here: " + r.reason; });
      return;
    }
    const kit = kitRecord(e);
    const art = artRecord(e);
    if (e && art && art.model && GD.atlas3d) {
      GD.atlas3d.show(box, art.model.id, art.model).then((r) => { if (note) note.textContent = r.ok ? "Approximate model, not a scan. " + art.model.label + ". Drag to turn." : "3D view unavailable here: " + r.reason; });
      return;
    }
    if (!e || !kit || e.kind !== "object" || !GD.atlas3d) { box.classList.add("stub"); box.textContent = "No 3D model for this entry " + UNKNOWN + "."; return; }
    const opt = kit.options.find((o) => o.id === st.option) || kit.options[0];
    const gen = kit.model && kit.model.generator;
    const modelId = ((gen && /(?:^|\/)([a-z0-9-]+)\.js$/.exec(gen)) || [])[1] || kit.id;
    const parallel = parseInt((/(\d+)P/.exec(opt.config || "") || [])[1] || "1", 10);
    GD.atlas3d.show(box, modelId, parallel).then((r) => { if (note) note.textContent = r.ok ? "Artistic layout from the parametric record (mm), size " + opt.id + ". Drag to turn. Not a build drawing." : "3D view unavailable here: " + r.reason; });
  }

  // ---------- open / close ----------
  function openView() {
    const root = $("atlasView"); if (!root) return;
    st.open = true; root.hidden = false;
    global.document.body.classList.add("atlas-open");
    const b = $("btnAtlas"); if (b) { b.setAttribute("aria-pressed", "true"); }
    render();
  }
  function closeView() {
    const root = $("atlasView"); if (!root) return;
    st.open = false; root.hidden = true; clearMarkers();
    if (GD.atlas3d) GD.atlas3d.dispose();
    global.document.body.classList.remove("atlas-open");
    const b = $("btnAtlas"); if (b) { b.setAttribute("aria-pressed", "false"); b.focus(); }
  }
  function toggle() { if (st.open) closeView(); else openView(); }

  function applyParams(params) {
    if (!params) return false;
    const rawView = params.get("atlas-view");
    const rawId = params.get("atlas");
    if (!rawView && !rawId) return false;
    const validViews = new Set(["az", "elements", "cats", "place", "year"]);
    if (rawView && validViews.has(rawView)) {
      st.view = rawView;
      st.elementZoom = null;
    }
    if (rawId) {
      const e = D() && M() ? M().entryById(D(), rawId) : null;
      if (e) {
        if (!rawView && e.category_path && e.category_path[0] === "chemistry" && e.category_path[1] === "elements") st.view = "elements";
        st.missingAtlasId = null;
        openView();
        select(e.id);
        return true;
      }
      st.selected = null;
      st.missingAtlasId = rawId;
    }
    openView();
    return true;
  }

  function wire() {
    const b = $("btnAtlas"); if (b) b.addEventListener("click", toggle);
    const root = $("atlasView");
    if (root) root.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); if (st.view === "elements" && st.elementZoom) { const prev = st.elementZoom; st.elementZoom = null; st.selected = prev; render(); } else closeView(); } });
    if (global.addEventListener) global.addEventListener("resize", () => { const r = $("atlasView"); if (r) placeElementsSheet(r); });
    if (GD.globe && GD.globe.st && GD.globe.st.onReady) GD.globe.st.onReady.push(() => syncMarkers());
    if (global.location && global.location.search && global.URLSearchParams) {
      applyParams(new global.URLSearchParams(global.location.search));
    }
  }

  GD.atlas = { st, open: openView, close: closeView, toggle, render, select, thisWeek, centroid, applyParams };
  if (global.document) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", wire); else wire(); }
})(typeof window !== "undefined" ? window : globalThis);
