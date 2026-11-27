/* Work desks: a desk switcher at the top of the news desk column. "News" is the existing news desk,
   unchanged. The nine work desks show a scope, reading-tier notes, official sources (or [UNKNOWN]) and
   experimental references (maintainer repos and Learning Lab cards, labelled, never backing a claim).
   Generic sample desks with no public link yet show as "Sample desk: … (link pending)" with no link. window.GD.workDesks */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const KEY = "globedesk.desk.v1";
  const UNKNOWN = "[UNKNOWN]";
  const st = { desk: "news" };
  const PUBLIC_URL = /^https:\/\/(github\.com\/AdventureNLearn\/[A-Za-z0-9._-]+|learninglab\.grok\.me\/)$/;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function desks() { return (GD.atlasData && GD.atlasData.desks && GD.atlasData.desks.desks) || []; }

  const EXP = "Experimental (not an official source)";
  function isOwner(url) { return GD.sourceClass ? GD.sourceClass.isOwnerUrl(url) : PUBLIC_URL.test(String(url || "")); }

  // Pure: one backing row as HTML. Maintainer repos and Learning Lab cards are experimental references, always labelled.
  function backingHtml(b) {
    const depth = '<span class="pill">' + esc(b.depth || UNKNOWN) + "</span>";
    const exp = ' <span class="pill warn exp-label">' + EXP + "</span>";
    if (b.kind === "sample-pending") return '<li class="wd-pending">' + esc(b.label) + " " + depth + ' <span class="pill warn">link pending</span>' + exp + "</li>";
    if ((b.kind === "repo" || b.kind === "lab-card") && PUBLIC_URL.test(String(b.url || ""))) {
      return "<li>" + '<a href="' + esc(b.url) + '" target="_blank" rel="noopener noreferrer">' + esc(b.label) + "</a> " + depth + exp + (b.note ? ' <span class="muted small">' + esc(b.note) + "</span>" : "") + "</li>";
    }
    if (b.kind === "atlas") return '<li><button type="button" class="linklike" data-wd-atlas="' + esc(b.entry) + '">' + esc(b.label) + "</button> " + depth + "</li>";
    if (b.kind === "news-section") return '<li><button type="button" class="linklike" data-wd-section="' + esc(b.section) + '">' + esc(b.label) + "</button> " + depth + "</li>";
    return "<li>" + esc(b.label) + (b.path ? ' <span class="muted small">(' + esc(b.path) + ")</span>" : "") + " " + depth + "</li>";
  }
  function officialHtml(d) {
    const list = (d.official_sources || []).filter((o) => o.class === "official" && !isOwner(o.url));
    if (!list.length) return '<p class="small wd-official-unknown"><b>Official source ' + UNKNOWN + ".</b> " + esc(d.official_note || "This desk has only experimental references so far. Official means a primary or public record (government, a standards body, or a dataset with a named licence).") + "</p>";
    return '<ul class="small wd-official">' + list.map((o) => '<li><a href="' + esc(o.url) + '" target="_blank" rel="noopener noreferrer">' + esc(o.label) + '</a> <span class="muted">· ' + esc(o.publisher) + " · checked " + esc(o.checked) + "</span></li>").join("") + "</ul>";
  }

  function deskHtml(d) {
    const tiers = ["kids", "everyday", "student", "professional"];
    const cats = (GD.atlasData && GD.atlasData.categories) || [];
    const exp = d.backing.filter((b) => b.class === "experimental");
    const internal = d.backing.filter((b) => b.class !== "experimental");
    return '<section class="panel wd-desk" aria-label="' + esc(d.title) + ' desk">' +
      "<h3>" + esc(d.title) + ' <span class="pill warn">draft</span></h3>' +
      "<p>" + esc(d.scope) + "</p>" +
      '<p class="small"><b>Reading levels.</b> ' + esc(d.tier_note) + "</p>" +
      '<table class="at-table small wd-tiers">' + tiers.map((t) => "<tr><th>" + esc(t) + "</th><td>" + esc(d.tiers[t]) + "</td></tr>").join("") + "</table>" +
      '<h4 class="small">Official sources</h4>' + officialHtml(d) +
      (internal.length ? '<h4 class="small">In GlobeDesk</h4><ul class="small wd-internal">' + internal.map(backingHtml).join("") + "</ul>" : "") +
      (exp.length ? '<h4 class="small">Experimental references <span class="muted">(not official sources, never a record backing a claim)</span></h4><ul class="small wd-backing">' + exp.map(backingHtml).join("") + "</ul>" : "") +
      (d.atlas_categories.length ? '<p class="small">Atlas: ' + d.atlas_categories.map((id) => { const c = cats.find((x) => x.id === id); return '<button type="button" class="linklike" data-wd-cat="' + esc(id) + '">' + esc(c ? c.title : id) + "</button>"; }).join(" · ") + (d.id === "energy-materials" ? ' · <button type="button" class="mini" data-wd-atlas-view="elements">Elements periodic table</button>' : "") + "</p>" : "") +
      "</section>";
  }

  function render() {
    const doc = global.document;
    const sel = doc.getElementById("deskSelect");
    const box = doc.getElementById("workDesk");
    const nd = doc.getElementById("newsdesk");
    if (!sel || !box || !nd) return;
    const list = desks();
    if (!sel.options.length) list.forEach((d) => { const o = doc.createElement("option"); o.value = d.id; o.textContent = d.n + ". " + d.title; sel.appendChild(o); });
    if (!list.some((d) => d.id === st.desk)) st.desk = "news";
    sel.value = st.desk;
    const work = st.desk !== "news";
    nd.classList.toggle("wd-active", work);
    box.hidden = !work;
    box.innerHTML = work ? deskHtml(list.find((d) => d.id === st.desk)) : "";
    box.querySelectorAll("[data-wd-atlas]").forEach((el) => el.addEventListener("click", () => { if (GD.atlas) { GD.atlas.open(); GD.atlas.select(el.getAttribute("data-wd-atlas")); } }));
    box.querySelectorAll("[data-wd-cat]").forEach((el) => el.addEventListener("click", () => { if (GD.atlas) { GD.atlas.st.category = el.getAttribute("data-wd-cat"); GD.atlas.st.view = "az"; GD.atlas.open(); } }));
    box.querySelectorAll("[data-wd-atlas-view]").forEach((el) => el.addEventListener("click", () => { if (GD.atlas) { GD.atlas.st.view = el.getAttribute("data-wd-atlas-view"); GD.atlas.st.elementZoom = null; GD.atlas.open(); } }));
    box.querySelectorAll("[data-wd-section]").forEach((el) => el.addEventListener("click", () => { setDesk("news"); const tab = doc.querySelector('.nd-tab[data-section="' + el.getAttribute("data-wd-section") + '"]'); if (tab) tab.click(); }));
  }

  function setDesk(id) {
    st.desk = id;
    try { global.localStorage.setItem(KEY, id); } catch (e) { /* ignore */ }
    render();
  }

  function wire() {
    try { st.desk = global.localStorage.getItem(KEY) || "news"; } catch (e) { st.desk = "news"; }
    const sel = global.document.getElementById("deskSelect");
    if (sel) sel.addEventListener("change", () => setDesk(sel.value));
    render();
  }

  GD.workDesks = { st, render, setDesk, backingHtml, deskHtml, officialHtml, PUBLIC_URL, KEY, EXP };
  if (global.document) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", wire); else wire(); }
})(typeof window !== "undefined" ? window : globalThis);
