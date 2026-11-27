/* Atlas card for the disasters layer: renders a disaster record (globedesk.disaster/1) or the disasters
   overview (globedesk.disaster-overview/1) inside the Atlas Object tab. atlas-view.js passes its own
   escape and link helpers, so links and "(not in this copy)" behave the same as everywhere else.
   Every row shows its source; claims show their status (supported / not proven / people disagree).
   window.GD.disastersCard */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const STATUS = { supported: ["ok", "Supported"], "not-proven": ["warn", "Not proven"], "people-disagree": ["warn", "People disagree"] };
  const HAZARD = { eruption: "Volcanic eruption", earthquake: "Earthquake" };

  function claimHtml(c, h) {
    const s = STATUS[c.status] || ["warn", c.status];
    return '<li><span class="pill ' + s[0] + '">' + h.esc(s[1]) + "</span> " + h.esc(c.text) + ' <span class="muted">· ' + c.sources.map(h.srcLink).join(", ") + "</span>" +
      (c.positions ? '<ul class="dl-positions">' + c.positions.map((p) => "<li>" + h.esc(p.text) + ' <span class="muted">· ' + h.srcLink(p.source) + "</span></li>").join("") + "</ul>" : "") + "</li>";
  }
  function recordHtml(rec, h) {
    const row = (k, v) => "<tr><th>" + h.esc(k) + "</th><td>" + v + "</td></tr>";
    let out = '<h4>Event facts</h4><table class="at-table small dl-facts">' +
      row("Type", h.esc(HAZARD[rec.hazard] || rec.hazard)) +
      row("Date", h.esc(rec.date.label + ": " + rec.date.date) + ' <span class="muted">· ' + h.srcLink(rec.date.source) + "</span>") +
      row("Place", h.esc(rec.place.label) + ' <span class="pill warn">approximate pin</span> <span class="muted">(' + h.esc(rec.place.lat + ", " + rec.place.lng) + "; " + h.esc(rec.place.coords_source) + ")</span>") +
      rec.measures.map((m) => row(m.label, h.esc(m.value) + ' <span class="muted">· ' + h.srcLink(m.source) + "</span>")).join("") + "</table>";
    if (rec.facts.length) out += '<h4>What the sources say</h4><ul class="small dl-list">' + rec.facts.map((f) => "<li>" + h.esc(f.text) + ' <span class="muted">· ' + h.srcLink(f.source) + "</span></li>").join("") + "</ul>";
    if (rec.claims.length) out += '<h4>Claims</h4><ul class="small dl-claims">' + rec.claims.map((c) => claimHtml(c, h)).join("") + "</ul>";
    out += '<p class="small">Official source: <b>' + h.esc(rec.official_status) + "</b>" + (rec.unknowns.length ? " · Gaps: " + rec.unknowns.map(h.esc).join("; ") : "") + "</p>";
    return out;
  }
  function overviewHtml(rec, h) {
    const byHazard = (hz) => rec.members.filter((m) => m.hazard === hz);
    let out = rec.hazards.map((hz) => '<p class="small"><b>' + h.esc(hz.label) + ":</b> " + byHazard(hz.id).map((m) => h.entryLink(m.id) + (m.linked ? ' <span class="muted">(existing Atlas event)</span>' : "")).join(", ") + "</p>").join("");
    if (rec.linked.length) out += '<h4>More on the linked events</h4><ul class="small dl-list">' + rec.linked.map((l) => "<li>" + h.entryLink(l.id) + ": " + l.facts.map((f) => h.esc(f.text) + ' <span class="muted">· ' + h.srcLink(f.source) + "</span>").join(" ") + "</li>").join("") + "</ul>";
    out += rec.stories.map((s) => '<section class="at-ov small dl-story" data-dl-story="' + h.esc(s.id) + '"><h4>Story: ' + h.esc(s.title) + '</h4><ol class="dl-steps">' +
      s.steps.map((x) => "<li>" + h.esc(x.text) + ' <span class="muted">· ' + x.sources.map(h.srcLink).join(", ") + "</span> " + h.entryLink(x.entry) + "</li>").join("") + "</ol></section>").join("");
    out += '<p class="muted small">Not used: ' + rec.excluded.map((x) => h.esc(x.name + " (" + x.reason + ")")).join("; ") + "</p>";
    return out;
  }
  function html(rec, h) {
    if (!rec || !h) return "";
    if (rec.schema === "globedesk.disaster/1") return recordHtml(rec, h);
    if (rec.schema === "globedesk.disaster-overview/1") return overviewHtml(rec, h);
    return "";
  }
  GD.disastersCard = { html, recordHtml, overviewHtml };
  if (typeof module !== "undefined" && module.exports) module.exports = GD.disastersCard;
})(typeof window !== "undefined" ? window : globalThis);
