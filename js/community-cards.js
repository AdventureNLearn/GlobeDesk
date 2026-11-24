/* Contributor cards and the community lane: pure checks shared by the app and the Node tests.
   A card is a credit (handle, 1-2 line description, topics, up to 3 public links, checked date).
   It never carries an email, phone, real name, address or location. window.GD.communityCards */
(function (root) {
  "use strict";
  const SCHEMA = "globedesk.contributor-card/1";
  const ALLOWED = ["schema", "handle", "description", "topics", "links", "checked", "license"];
  // Keys that would identify or locate a person. The promote tool strips the same set.
  const CONTACT_KEY = /^(e-?mail|emails?|phone|tel|telephone|mobile|fax|address|street|city|zip|postcode|postal|location|lat|lng|lon|latitude|longitude|geo|coords?|real_?name|full_?name|first_?name|last_?name|surname|name|birth\w*|dob|age|owner\w*|occupant\w*|contact\w*)$/i;
  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
  const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
  function hasPhone(s) { return (String(s).match(PHONE) || []).some((m) => m.replace(/\D/g, "").length >= 10); }
  const HANDLE = /^[a-z0-9][a-z0-9_-]{1,31}$/;
  const LINK = /^https:\/\/[^\s"'<>@]+$/;
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  const STALE_DAYS = 365;

  function days(a, b) { return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000); }
  function todayIso(now) { const d = now ? new Date(now) : new Date(); return d.toISOString().slice(0, 10); }

  // Returns { ok, errors, stale }. ctx.categories: [{ id, subcategories: [{ id }] }]; ctx.today: YYYY-MM-DD.
  function validateCard(card, ctx) {
    ctx = ctx || {};
    const errors = [];
    if (!card || typeof card !== "object" || Array.isArray(card)) return { ok: false, errors: ["card must be an object"], stale: false };
    Object.keys(card).forEach((k) => {
      if (CONTACT_KEY.test(k)) errors.push("contact or location field not allowed: " + k);
      else if (ALLOWED.indexOf(k) < 0) errors.push("unknown field: " + k);
    });
    if (card.schema !== SCHEMA) errors.push("schema must be " + SCHEMA);
    if (!HANDLE.test(String(card.handle || ""))) errors.push("handle must be 2-32 lowercase letters, digits, - or _");
    const desc = String(card.description == null ? "" : card.description);
    if (!desc.trim()) errors.push("description is required");
    if (desc.length > 240) errors.push("description is longer than 240 characters");
    if (desc.split("\n").length > 2) errors.push("description must be one or two lines");
    const text = JSON.stringify(card);
    if (EMAIL.test(text)) errors.push("an email address is not allowed anywhere on a card");
    if (hasPhone(desc)) errors.push("a phone number is not allowed in the description");
    const topics = Array.isArray(card.topics) ? card.topics : null;
    if (!topics || !topics.length || topics.length > 6) errors.push("topics: 1 to 6 Atlas categories");
    if (topics && ctx.categories) topics.forEach((t) => {
      const [c, s] = String(t).split("/");
      const cat = ctx.categories.find((x) => x.id === c);
      if (!cat) errors.push("unknown Atlas category: " + t);
      else if (s && !(cat.subcategories || []).some((x) => x.id === s)) errors.push("unknown Atlas subcategory: " + t);
    });
    const links = Array.isArray(card.links) ? card.links : null;
    if (!links) errors.push("links must be a list (it may be empty)");
    else {
      if (links.length > 3) errors.push("at most 3 links");
      links.forEach((l, i) => {
        if (!l || typeof l !== "object") { errors.push("link " + (i + 1) + " must be an object"); return; }
        Object.keys(l).forEach((k) => { if (k !== "title" && k !== "url") errors.push("link " + (i + 1) + ": unknown field " + k); });
        if (!String(l.title || "").trim()) errors.push("link " + (i + 1) + ": title is required");
        if (!LINK.test(String(l.url || ""))) errors.push("link " + (i + 1) + ": must be a public https link");
        if (/^mailto:|^tel:/i.test(String(l.url || ""))) errors.push("link " + (i + 1) + ": mail and phone links are not allowed");
      });
    }
    if (!DAY.test(String(card.checked || ""))) errors.push("checked must be a date (YYYY-MM-DD)");
    if (!/^CC BY 4\.0/.test(String(card.license || ""))) errors.push("license must be CC BY 4.0");
    const today = ctx.today || todayIso();
    const stale = DAY.test(String(card.checked || "")) && days(card.checked, today) > STALE_DAYS;
    return { ok: errors.length === 0, errors, stale };
  }

  // Remove contact and location fields (top level and inside links). Returns { card, removed }.
  function stripContacts(card) {
    const removed = [];
    const out = {};
    Object.keys(card || {}).forEach((k) => {
      if (CONTACT_KEY.test(k)) { removed.push(k); return; }
      out[k] = card[k];
    });
    if (Array.isArray(out.links)) out.links = out.links.filter((l) => {
      if (l && /^(mailto|tel):/i.test(String(l.url || ""))) { removed.push("links[" + String(l.url).split(":")[0] + "]"); return false; }
      return true;
    }).map((l) => ({ title: l.title, url: l.url }));
    return { card: out, removed };
  }

  // Validates the whole community file. ctx: { categories, entryIds:Set, today }.
  function validateCommunity(doc, ctx) {
    ctx = ctx || {};
    const errors = [];
    if (!doc || doc.schema !== "globedesk.community/1") return { ok: false, errors: ["schema must be globedesk.community/1"] };
    const handles = new Set();
    (doc.cards || []).forEach((c) => {
      const r = validateCard(c, ctx);
      r.errors.forEach((e) => errors.push("card " + (c && c.handle) + ": " + e));
      if (c && handles.has(c.handle)) errors.push("duplicate handle " + c.handle);
      if (c) handles.add(c.handle);
    });
    (doc.links || []).forEach((l, i) => {
      if (!handles.has(l.card)) errors.push("link " + (i + 1) + ": card " + l.card + " is not listed");
      if (ctx.entryIds && !ctx.entryIds.has(l.entry)) errors.push("link " + (i + 1) + ": unknown Atlas entry " + l.entry);
      if (!LINK.test(String(l.url || ""))) errors.push("link " + (i + 1) + ": must be https");
      if (!String(l.license || "").trim()) errors.push("link " + (i + 1) + ": license is required");
    });
    (doc.pins || []).forEach((p, i) => {
      if (!handles.has(p.card)) errors.push("pin " + (i + 1) + ": card " + p.card + " is not listed");
      if (!(p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180)) errors.push("pin " + (i + 1) + ": bad coordinates");
      if (!LINK.test(String(p.source || ""))) errors.push("pin " + (i + 1) + ": needs a public https source");
    });
    return { ok: errors.length === 0, errors };
  }

  // Cards that list a category (or one of its subcategories). Stale cards are kept but marked.
  function contributorsFor(doc, categoryId, today) {
    return ((doc && doc.cards) || []).filter((c) => (c.topics || []).some((t) => String(t).split("/")[0] === categoryId))
      .map((c) => ({ handle: c.handle, description: c.description, links: c.links || [], checked: c.checked, stale: days(c.checked, today || todayIso()) > STALE_DAYS }))
      .sort((a, b) => a.handle.localeCompare(b.handle));
  }
  function linksFor(doc, entryId) { return ((doc && doc.links) || []).filter((l) => l.entry === entryId); }

  const api = { SCHEMA, CONTACT_KEY, STALE_DAYS, validateCard, stripContacts, validateCommunity, contributorsFor, linksFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.GD = root.GD || {}; root.GD.communityCards = api; }
})(typeof window !== "undefined" ? window : globalThis);
