/* Atlas card for the wonders layer: renders a wonder record (globedesk.wonder/1) or the wonders
   overview (globedesk.wonders-overview/1) inside the Atlas Object tab. atlas-view.js passes its own
   escape and link helpers, so links and "(not in this copy)" behave the same as everywhere else.
   The vote is always labelled unofficial at the top. Every row shows its source; claims show their
   status (supported / not proven / people disagree / myth). A wonder with no pin says so and why.
   No logos or images. window.GD.wondersCard */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const STATUS = { supported: ["ok", "Supported"], "not-proven": ["warn", "Not proven"], "people-disagree": ["warn", "People disagree"], myth: ["red", "Myth"] };

  function claimHtml(c, h) {
    const s = STATUS[c.status] || ["warn", c.status];
    return '<li><span class="pill ' + s[0] + '">' + h.esc(s[1]) + "</span> " + h.esc(c.text) + ' <span class="muted">· ' + c.sources.map(h.srcLink).join(", ") + "</span>" +
      (c.positions ? '<ul class="wd-positions">' + c.positions.map((p) => "<li>" + h.esc(p.text) + ' <span class="muted">· ' + h.srcLink(p.source) + "</span></li>").join("") + "</ul>" : "") + "</li>";
  }
  function banner(rec, h) { return '<p class="small wd-unofficial"><span class="pill warn">Unofficial vote</span> ' + h.esc(rec.vote_label) + "</p>"; }
  function recordHtml(rec, h) {
    const row = (k, v) => "<tr><th>" + h.esc(k) + "</th><td>" + v + "</td></tr>";
    const where = rec.place.pinned
      ? h.esc(rec.place.label) + ' <span class="pill warn">approximate pin</span> <span class="muted">(' + h.esc(rec.place.coords_text) + "; " + h.srcLink(rec.place.coords_source_id) + ")</span>"
      : h.esc(rec.place.label) + ' <span class="pill warn">no map pin</span> <span class="muted">(' + h.esc(rec.place.basis) + ")</span>";
    let out = banner(rec, h) + '<h4>Site facts</h4><table class="at-table small wd-facts">' + row("Place", where) +
      rec.measures.map((m) => row(m.label, h.esc(m.value) + ' <span class="muted">· ' + h.srcLink(m.source) + "</span>")).join("") + "</table>";
    out += '<h4>What the sources say</h4><ul class="small wd-list">' + rec.facts.map((f) => "<li>" + h.esc(f.text) + ' <span class="muted">· ' + h.srcLink(f.source) + "</span></li>").join("") + "</ul>";
    if (rec.claims.length) out += '<h4>Claims</h4><ul class="small wd-claims">' + rec.claims.map((c) => claimHtml(c, h)).join("") + "</ul>";
    out += '<p class="small">Official source: <b>' + h.esc(rec.official_status) + "</b>" + (rec.unknowns.length ? " · Gaps: " + rec.unknowns.map(h.esc).join("; ") : "") + "</p>";
    return out;
  }
  function overviewHtml(rec, h) {
    let out = banner(rec, h) + '<h4>The seven, as the vote named them</h4><ol class="small wd-vote">' + rec.vote.map((v) => "<li>" + (v.entry ? h.entryLink(v.entry) : h.esc(v.name) + " · " + h.entryLink(v.deferred_link) + ' <span class="muted">(Ancient layer)</span>') + ' <span class="muted">· ' + h.srcLink(v.source) + "</span></li>").join("") + "</ol>";
    out += '<h4>What the sources say</h4><ul class="small wd-list">' + rec.facts.map((f) => "<li>" + h.esc(f.text) + ' <span class="muted">· ' + h.srcLink(f.source) + "</span></li>").join("") + "</ul>";
    if (rec.claims.length) out += '<h4>Claims</h4><ul class="small wd-claims">' + rec.claims.map((c) => claimHtml(c, h)).join("") + "</ul>";
    out += rec.stories.map((s) => '<section class="at-ov small wd-story" data-wd-story="' + h.esc(s.id) + '"><h4>Story: ' + h.esc(s.title) + '</h4><ol class="wd-steps">' +
      s.steps.map((x) => "<li>" + h.esc(x.text) + ' <span class="muted">· ' + x.sources.map(h.srcLink).join(", ") + "</span> " + h.entryLink(x.entry) + "</li>").join("") + "</ol></section>").join("");
    out += '<p class="small">Gaps: ' + rec.unknowns.map(h.esc).join("; ") + '</p><p class="muted small">Not used: ' + rec.excluded.map((x) => h.esc(x.name + " (" + x.reason + ")")).join("; ") + "</p>";
    return out;
  }
  function html(rec, h) {
    if (!rec || !h) return "";
    if (rec.schema === "globedesk.wonder/1") return recordHtml(rec, h);
    if (rec.schema === "globedesk.wonders-overview/1") return overviewHtml(rec, h);
    return "";
  }
  GD.wondersCard = { html, recordHtml, overviewHtml };
  if (typeof module !== "undefined" && module.exports) module.exports = GD.wondersCard;
})(typeof window !== "undefined" ? window : globalThis);
