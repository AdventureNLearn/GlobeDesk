/* Personal layer: the user's own pins, notes, followed topics and links.
   Lives only on this device (browser storage) and in files the user exports. The app never sends it anywhere.
   Kept apart from the base map and from episodes. window.GD.personal */
(function (root) {
  "use strict";
  const SCHEMA = "globedesk.personal-layer/1";
  const KEY = "globedesk.personal.v1";
  const MAX = { pins: 500, notes: 500, followed: 200, links: 200 };
  const ID = /^[A-Za-z0-9_-]{1,40}$/;
  const TOPIC = /^[a-z0-9][a-z0-9-]{0,79}(\/[a-z0-9-]+)?$/;
  const HTTPS = /^https:\/\/[^\s"'<>]+$/;

  function blank() { return { schema: SCHEMA, pins: [], notes: [], followed: [], links: [] }; }
  const str = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max);
  const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
  let seq = 0;
  function uid(p) { seq += 1; return (p || "p") + "-" + Date.now().toString(36) + "-" + seq.toString(36); }

  // Pure: keep only known fields with valid values. Returns { layer, dropped } (dropped is a count of rejected items).
  function sanitize(doc) {
    const out = blank();
    let dropped = 0;
    if (!doc || typeof doc !== "object" || doc.schema !== SCHEMA) return { layer: out, dropped: -1 };
    (Array.isArray(doc.pins) ? doc.pins : []).forEach((p) => {
      const lat = num(p && p.lat, -90, 90), lng = num(p && p.lng, -180, 180), title = str(p && p.title, 120).trim();
      if (lat == null || lng == null || !title || out.pins.length >= MAX.pins) { dropped++; return; }
      const pin = { id: ID.test(String(p.id || "")) ? p.id : uid("pin"), title, lat, lng };
      if (p.note) pin.note = str(p.note, 1000);
      if (p.created) pin.created = str(p.created, 40);
      out.pins.push(pin);
    });
    (Array.isArray(doc.notes) ? doc.notes : []).forEach((n) => {
      const text = str(n && n.text, 2000).trim();
      if (!text || out.notes.length >= MAX.notes) { dropped++; return; }
      const note = { id: ID.test(String(n.id || "")) ? n.id : uid("note"), text };
      if (n.entry && TOPIC.test(String(n.entry)) && String(n.entry).indexOf("/") < 0) note.entry = n.entry;
      if (n.created) note.created = str(n.created, 40);
      out.notes.push(note);
    });
    (Array.isArray(doc.followed) ? doc.followed : []).forEach((t) => {
      if (!TOPIC.test(String(t)) || out.followed.indexOf(t) >= 0 || out.followed.length >= MAX.followed) { dropped++; return; }
      out.followed.push(String(t));
    });
    (Array.isArray(doc.links) ? doc.links : []).forEach((l) => {
      const url = String(l && l.url || ""), title = str(l && l.title, 160).trim();
      if (!HTTPS.test(url) || !title || out.links.length >= MAX.links) { dropped++; return; }
      const link = { title, url };
      if (l.topic && TOPIC.test(String(l.topic))) link.topic = String(l.topic);
      out.links.push(link);
    });
    return { layer: out, dropped };
  }

  // Pure: add the items of b to a, skipping ids, topics and urls already present.
  function merge(a, b) {
    const out = JSON.parse(JSON.stringify(a || blank()));
    const has = (list, key, v) => list.some((x) => x[key] === v);
    (b.pins || []).forEach((p) => { if (!has(out.pins, "id", p.id)) out.pins.push(p); });
    (b.notes || []).forEach((n) => { if (!has(out.notes, "id", n.id)) out.notes.push(n); });
    (b.followed || []).forEach((t) => { if (out.followed.indexOf(t) < 0) out.followed.push(t); });
    (b.links || []).forEach((l) => { if (!has(out.links, "url", l.url)) out.links.push(l); });
    return sanitize(out).layer;
  }

  function exportText(layer, now) {
    const doc = Object.assign({ schema: SCHEMA, exported: (now ? new Date(now) : new Date()).toISOString().slice(0, 10) }, sanitize(layer).layer);
    doc.schema = SCHEMA;
    return JSON.stringify(doc, null, 2) + "\n";
  }
  function importText(current, text) {
    let doc;
    try { doc = JSON.parse(text); } catch (e) { return { ok: false, error: "Not a JSON file" }; }
    const r = sanitize(doc);
    if (r.dropped < 0) return { ok: false, error: "Not a GlobeDesk personal layer file (schema " + SCHEMA + ")" };
    return { ok: true, layer: merge(current, r.layer), dropped: r.dropped, added: r.layer };
  }

  // ---- browser state (local only) ----
  const store = () => { try { return root.localStorage || null; } catch (e) { return null; } };
  let layer = null;
  const listeners = [];
  function load() {
    if (layer) return layer;
    const s = store();
    let doc = null;
    try { doc = s ? JSON.parse(s.getItem(KEY) || "null") : null; } catch (e) { doc = null; }
    layer = doc ? sanitize(doc).layer : blank();
    return layer;
  }
  function save(next) {
    layer = sanitize(next).layer;
    const s = store();
    try { if (s) s.setItem(KEY, JSON.stringify(layer)); } catch (e) { /* storage full or blocked: keep in memory */ }
    listeners.forEach((f) => { try { f(layer); } catch (e) { /* ignore */ } });
    return layer;
  }
  function onChange(f) { listeners.push(f); }
  function addPin(p) { const l = load(); return save(Object.assign({}, l, { pins: l.pins.concat([{ id: uid("pin"), title: p.title, lat: p.lat, lng: p.lng, note: p.note || undefined, created: new Date().toISOString().slice(0, 10) }]) })); }
  function removePin(id) { const l = load(); return save(Object.assign({}, l, { pins: l.pins.filter((p) => p.id !== id) })); }
  function addNote(n) { const l = load(); return save(Object.assign({}, l, { notes: l.notes.concat([{ id: uid("note"), text: n.text, entry: n.entry, created: new Date().toISOString().slice(0, 10) }]) })); }
  function isFollowed(t) { return load().followed.indexOf(t) >= 0; }
  function toggleFollow(t) { const l = load(); const f = l.followed.indexOf(t) >= 0 ? l.followed.filter((x) => x !== t) : l.followed.concat([t]); return save(Object.assign({}, l, { followed: f })); }
  function addLink(k) { const l = load(); return save(Object.assign({}, l, { links: l.links.concat([{ title: k.title, url: k.url, topic: k.topic }]) })); }
  function clearAll() { return save(blank()); }
  function download() {
    const d = root.document; if (!d) return;
    const blob = new Blob([exportText(load())], { type: "application/json" });
    const a = d.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-globedesk-layer.json";
    d.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importFile(file) {
    return file.text().then((t) => { const r = importText(load(), t); if (r.ok) save(r.layer); return r; });
  }

  const api = { SCHEMA, KEY, MAX, blank, sanitize, merge, exportText, importText, load, save, onChange, addPin, removePin, addNote, isFollowed, toggleFollow, addLink, clearAll, download, importFile };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.GD = root.GD || {}; root.GD.personal = api; }
})(typeof window !== "undefined" ? window : globalThis);
