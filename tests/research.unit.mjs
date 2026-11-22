// Unit tests for the research drawer (globedesk.research/1). No remote CMS fetch, no geocoding.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { validateSchema } from "./jsonschema-lite.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { console, window: { GD: {} }, Date, URL, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView };
ctx.window.window = ctx.window;
ctx.globalThis = ctx;
ctx.sessionStorage = { _d: {}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=String(v); } };
vm.createContext(ctx);
for (const f of ["sanitize", "schema", "outbound", "claims", "research", "newsdesk", "commands"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
}
const { schema, claims, research, newsdesk, commands } = ctx.window.GD;
const J = (v) => JSON.parse(JSON.stringify(v));
assert.deepEqual = ((orig) => (a, b, m) => orig(J(a), J(b), m))(assert.deepEqual);
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

const fixture = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/research.json"), "utf8"));
const newsdeskEp = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/topics/newsdesk-50.globedesk.json"), "utf8"));
const sections = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/sections.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/catalog.json"), "utf8"));
const claimsDoc = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/claims.json"), "utf8"));
const outboundDoc = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/outbound.json"), "utf8"));
const dc = JSON.parse(fs.readFileSync(path.join(root, "episodes", "washington-dc-demo.globedesk.json"), "utf8"));
const blank = JSON.parse(fs.readFileSync(path.join(root, "episodes/blank.globedesk.json"), "utf8"));
const chicago = newsdeskEp.stories.find((s) => s.id === "story-nd-chicago-river-reversal");
const researchSchema = JSON.parse(fs.readFileSync(path.join(root, "schema/globedesk-research.schema.json"), "utf8"));

function escapeText(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function makeDom() {
  const byId = {};
  function textNode(data) {
    return { nodeType: 3, data: String(data), childNodes: [], get textContent() { return this.data; }, set textContent(v) { this.data = String(v); } };
  }
  function serialize(n) {
    if (!n) return "";
    if (n.nodeType === 3) return escapeText(n.data);
    const tag = String(n.tagName || "div").toLowerCase();
    let attrs = "";
    if (n.id) attrs += ` id="${escapeText(n.id)}"`;
    if (n.className) attrs += ` class="${escapeText(n.className)}"`;
    if (n.hasAttribute && n.hasAttribute("hidden")) attrs += " hidden";
    for (const [k, v] of Object.entries(n._attrs || {})) {
      if (k === "id" || k === "class" || k === "hidden") continue;
      attrs += ` ${k}="${escapeText(v)}"`;
    }
    const inner = (n.childNodes || []).map(serialize).join("");
    if (tag === "input") return `<${tag}${attrs}>`;
    return `<${tag}${attrs}>${inner}</${tag}>`;
  }
  function matchOne(el, sel) {
    const m = sel.match(/^(?:([a-zA-Z][\w-]*)|)?((?:\.[A-Za-z][\w-]*)*)((?:\[[^\]]+\])*)$/);
    if (!m) return false;
    if (m[1] && String(el.tagName).toLowerCase() !== m[1].toLowerCase()) return false;
    const classes = (m[2] || "").split(".").filter(Boolean);
    const cls = String(el.className || "").split(/\s+/);
    if (classes.some((c) => !cls.includes(c))) return false;
    const re = /\[([^\]]+)\]/g;
    let a;
    while ((a = re.exec(m[3] || ""))) {
      const spec = a[1];
      const eq = spec.match(/^([^=]+)=["']?([^"']*)["']?$/);
      if (eq) { if (String(el.getAttribute(eq[1].trim())) !== eq[2]) return false; }
      else if (el.getAttribute(spec.trim()) == null) return false;
    }
    return true;
  }
  function walk(root, acc) {
    (root.childNodes || []).forEach((c) => { if (c && c.nodeType === 1) { acc.push(c); walk(c, acc); } });
  }
  function qsa(root, selector) {
    const groups = String(selector).split(",").map((s) => s.trim()).filter(Boolean);
    const nodes = [];
    walk(root, nodes);
    return nodes.filter((n) => groups.some((g) => {
      const parts = g.split(/\s+/);
      if (parts.length === 1) return matchOne(n, parts[0]);
      if (!matchOne(n, parts[parts.length - 1])) return false;
      let cur = n.parentNode, i = parts.length - 2;
      while (cur && i >= 0) { if (cur.nodeType === 1 && matchOne(cur, parts[i])) i--; cur = cur.parentNode; }
      return i < 0;
    }));
  }
  function el(tag) {
    const rec = {
      tagName: String(tag || "div").toUpperCase(), nodeType: 1, childNodes: [], parentNode: null,
      _attrs: {}, _ln: {}, hidden: false, checked: false, value: "", type: "", className: "", id: "",
      setAttribute(k, v) {
        const key = String(k), val = String(v);
        this._attrs[key] = val;
        if (key === "id") { this.id = val; byId[val] = this; }
        if (key === "class") this.className = val;
        if (key === "hidden") this.hidden = true;
      },
      getAttribute(k) {
        const key = String(k);
        if (key === "id") return this.id || null;
        if (key === "class") return this.className || null;
        if (key === "hidden") return this.hidden || Object.prototype.hasOwnProperty.call(this._attrs, "hidden") ? "" : null;
        return Object.prototype.hasOwnProperty.call(this._attrs, key) ? this._attrs[key] : null;
      },
      hasAttribute(k) { return this.getAttribute(k) != null || Object.prototype.hasOwnProperty.call(this._attrs, k); },
      removeAttribute(k) { delete this._attrs[k]; if (k === "hidden") this.hidden = false; },
      appendChild(c) {
        if (!c) return c;
        if (c.parentNode && c.parentNode.removeChild) c.parentNode.removeChild(c);
        c.parentNode = this; this.childNodes.push(c); if (c.id) byId[c.id] = c; return c;
      },
      removeChild(c) { this.childNodes = this.childNodes.filter((x) => x !== c); if (c) c.parentNode = null; return c; },
      insertBefore(c, ref) {
        if (!ref) return this.appendChild(c);
        const i = this.childNodes.indexOf(ref);
        if (c.parentNode && c.parentNode.removeChild) c.parentNode.removeChild(c);
        c.parentNode = this;
        if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c);
        if (c.id) byId[c.id] = c;
        return c;
      },
      get innerHTML() { return (this._unparsed || "") + (this.childNodes || []).map(serialize).join(""); },
      set innerHTML(v) { this.childNodes = []; this._unparsed = String(v == null ? "" : v); },
      get textContent() { return (this.childNodes || []).map((c) => c.textContent).join(""); },
      set textContent(v) { this.childNodes = []; this._unparsed = ""; if (String(v)) this.childNodes.push(textNode(String(v))); },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) { return qsa(this, sel); },
      addEventListener(type, fn) { (this._ln[type] = this._ln[type] || []).push(fn); },
      dispatchEvent(ev) { (this._ln[ev && ev.type] || []).forEach((fn) => fn(ev)); return true; },
      closest() { return null; }
    };
    return rec;
  }
  const body = { classList: { _c: new Set(), add(...a){ a.forEach((x)=>this._c.add(x)); }, remove(...a){ a.forEach((x)=>this._c.delete(x)); } }, childNodes: [], nodeType: 1, appendChild(c){ this.childNodes.push(c); return c; } };
  const known = {};
  function knownEl(id) {
    if (!known[id]) { known[id] = el("div"); known[id].id = id; known[id].setAttribute("id", id); }
    return known[id];
  }
  const document = {
    body,
    activeElement: { tagName: "BODY" },
    _ln: {},
    createElement: (tag) => el(tag),
    createTextNode: (data) => textNode(data),
    getElementById: (id) => byId[id] || null,
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) {
      const acc = Object.values(byId);
      const out = [];
      acc.forEach((node) => out.push(...qsa(node, sel)));
      return out;
    },
    addEventListener(type, fn) { (this._ln[type] = this._ln[type] || []).push(fn); },
    dispatchEvent(ev) { (this._ln[ev && ev.type] || []).forEach((fn) => fn(ev)); return true; }
  };
  ["btnViewToggle", "newsdesk", "ndSections", "ndCards", "ndMeta", "ndNotice", "ndResearch", "gdFull", "archive"].forEach(knownEl);
  document.getElementById("newsdesk").appendChild(document.getElementById("ndNotice"));
  document.getElementById("newsdesk").appendChild(document.getElementById("ndCards"));
  document.getElementById("newsdesk").appendChild(document.getElementById("ndResearch"));
  document.getElementById("ndResearch").setAttribute("hidden", "");
  return { document };
}

await t("episodes without a research sidecar still load", async () => {
  assert.deepEqual(schema.validate(dc), []);
  assert.deepEqual(schema.validate(newsdeskEp), []);
  assert.deepEqual(schema.validate(blank), []);
  assert.equal(JSON.stringify(dc).includes("globedesk.research"), false);
});

await t("the news-desk research fixture validates against the news-desk episode", async () => {
  assert.equal(fixture.schema, "globedesk.research/1");
  claims.load(J(claimsDoc), newsdeskEp);
  assert.deepEqual(schema.validateResearch(fixture, newsdeskEp), []);
  assert.deepEqual(validateSchema(researchSchema, fixture), []);
  const entry = fixture.stories.find((s) => s.storyId === "story-nd-chicago-river-reversal");
  assert.ok(entry);
  assert.ok(entry.gaps.some((g) => g.id === "gap-chicago-pin" && /\[UNKNOWN\]/.test(g.detail)));
  entry.links.forEach((link) => {
    assert.ok(schema.httpsOk(link.url), link.url);
    assert.equal(schema.urlCarriesPersonalData(link.url), false, link.url);
    assert.ok(chicago.sources.some((s) => s.url === link.url), "invented url: " + link.url);
  });
  entry.quotes.forEach((q) => {
    assert.ok(chicago.sources.some((s) => s.id === q.sourceId), q.sourceId);
  });
});

await t("a quote without a valid sourceId fails, a non-https link fails, and a gap with no [UNKNOWN] and no flag fails", async () => {
  const badQuote = J(fixture);
  badQuote.stories[0].quotes[0].sourceId = "src-not-on-story";
  assert.ok(schema.validateResearch(badQuote, newsdeskEp).some((e) => /not a source/.test(e)));
  const noSrc = J(fixture);
  delete noSrc.stories[0].quotes[0].sourceId;
  assert.ok(schema.validateResearch(noSrc, newsdeskEp).some((e) => /sourceId/.test(e)));
  const badLink = J(fixture);
  badLink.stories[0].links[0].url = "http://www.mwrd.org/what-we-do/history-protecting-our-water-environment";
  assert.ok(schema.validateResearch(badLink, newsdeskEp).some((e) => /https/.test(e)));
  const badGap = J(fixture);
  badGap.stories[0].gaps[0].detail = "The lock coordinate was never written down.";
  delete badGap.stories[0].gaps[0].isGap;
  assert.ok(schema.validateResearch(badGap, newsdeskEp).some((e) => /isGap/.test(e)));
  const flagged = J(fixture);
  flagged.stories[0].gaps[0].detail = "The lock coordinate was never written down.";
  flagged.stories[0].gaps[0].isGap = true;
  assert.deepEqual(schema.validateResearch(flagged, newsdeskEp), []);
});

await t("unknown keys, empty ids, and an unknown schema fail", async () => {
  const extra = J(fixture);
  extra.secret = true;
  assert.ok(schema.validateResearch(extra, newsdeskEp).some((e) => /unknown key/.test(e)));
  const emptyId = J(fixture);
  emptyId.stories[0].gaps[0].id = "  ";
  assert.ok(schema.validateResearch(emptyId, newsdeskEp).some((e) => /must not be empty/.test(e)));
  const wrong = J(fixture);
  wrong.schema = "globedesk.claims/1";
  assert.ok(schema.validateResearch(wrong, newsdeskEp).some((e) => /schema must be/.test(e)));
});

await t("closing a gap keeps the row and adds an update entry", async () => {
  ctx.window.GD.state = { episode: newsdeskEp };
  research.load(J(fixture), newsdeskEp);
  const before = research.entryFor("story-nd-chicago-river-reversal");
  const gapCount = before.gaps.length;
  const updateCount = before.updates.length;
  const out = research.closeGap({
    storyId: "story-nd-chicago-river-reversal",
    id: "gap-chicago-pin",
    note: "Still unknown; logged only to prove close keeps the row."
  });
  assert.equal(out.ok, true, out.error);
  const after = research.entryFor("story-nd-chicago-river-reversal");
  assert.equal(after.gaps.length, gapCount);
  const gap = after.gaps.find((g) => g.id === "gap-chicago-pin");
  assert.ok(gap.closed);
  assert.match(gap.detail, /\[UNKNOWN\]/);
  assert.equal(after.updates.length, updateCount + 1);
  assert.match(after.updates[after.updates.length - 1].note, /keeps the row/);
});

await t("the news-desk drawer shows the same gaps as the sidecar for the fixture story", async () => {
  const { document } = makeDom();
  ctx.document = document;
  ctx.window.document = document;
  ctx.window.GD.state = { episode: J(blank) };
  claims.load(J(claimsDoc), newsdeskEp);
  research.load(J(fixture), newsdeskEp);
  newsdesk.applyView("newsdesk");
  newsdesk.state.feed = newsdesk.mergeFeeds([newsdesk.parseFeed(sections), newsdesk.parseFeed(catalog), newsdesk.parseFeed(newsdeskEp)]);
  newsdesk.state.loaded = true;
  newsdesk.state.sectionId = "all";
  newsdesk.selectTopic("story-nd-chicago-river-reversal", { silent: true });
  const opened = research.openFor("story-nd-chicago-river-reversal");
  assert.equal(opened.ok, true, opened.error);
  const drawer = document.getElementById("ndResearch");
  const html = drawer.innerHTML;
  const text = drawer.textContent;
  const entry = fixture.stories[0];
  entry.gaps.filter((g) => !g.closed).forEach((g) => {
    assert.ok(text.includes(g.label), "missing gap " + g.label);
    assert.ok(text.includes("[UNKNOWN]"));
  });
  assert.match(html, /nd-unknown/);
  entry.links.forEach((link) => {
    assert.ok(html.includes(link.url), link.url);
    assert.match(html, /noopener noreferrer/);
  });
  assert.match(text, /SAMPLE\. A fictional caption that stands in for a cited official excerpt\./);
  assert.match(text, /SAMPLE\. A second fictional excerpt used only to demonstrate a research gap\./);
  const listed = research.listed("story-nd-chicago-river-reversal");
  assert.equal(listed.counts.gaps, entry.gaps.length);
  assert.deepEqual(listed.gaps.map((g) => g.label), entry.gaps.map((g) => g.label));
  const blob = JSON.stringify(listed);
  assert.equal(blob.includes("fictional caption that stands in"), false);
  assert.equal(blob.includes("second fictional excerpt"), false);
  assert.equal("text" in (listed.quotes && listed.quotes[0] || {}), false);
});

await t("the shareable research fixture carries no email or phone", async () => {
  const raw = fs.readFileSync(path.join(root, "newsdesk/research.json"), "utf8");
  const emailRe = new RegExp("[A-Za-z0-9._%+-]+" + String.fromCharCode(64) + "[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
  assert.equal(emailRe.test(raw), false);
  assert.equal(/\btel:/i.test(raw), false);
  fixture.stories.forEach((row) => {
    (row.links || []).forEach((link) => assert.equal(schema.urlCarriesPersonalData(link.url), false, link.url));
  });
});

await t("openResearch is a no-op success when the drawer is already open, and Escape closes it", async () => {
  const { document } = makeDom();
  ctx.document = document;
  ctx.window.document = document;
  ctx.window.GD.state = { episode: newsdeskEp };
  research.load(J(fixture), newsdeskEp);
  newsdesk.applyView("newsdesk");
  newsdesk.state.feed = newsdesk.mergeFeeds([newsdesk.parseFeed(sections), newsdesk.parseFeed(catalog), newsdesk.parseFeed(newsdeskEp)]);
  newsdesk.state.loaded = true;
  newsdesk.selectTopic("story-nd-chicago-river-reversal", { silent: true });
  const first = await commands.run({ cmd: "openResearch", storyId: "story-nd-chicago-river-reversal" });
  assert.equal(first.ok, true, first.error);
  const again = await commands.run({ cmd: "openResearch", storyId: "story-nd-chicago-river-reversal" });
  assert.equal(again.ok, true);
  assert.equal(J(again.result).alreadyOpen, true);
  newsdesk.selectTopic(null, { silent: true });
  assert.equal(research.isOpen(), false);
});

await t("addGap and closeGap go through the command API, and extra keys are rejected", async () => {
  ctx.window.GD.state = { episode: newsdeskEp };
  research.load(J(fixture), newsdeskEp);
  const added = await commands.run({
    cmd: "addGap",
    storyId: "story-nd-chicago-river-reversal",
    label: "Second pin check",
    detail: "A surveyed midpoint is still [UNKNOWN] in this note."
  });
  assert.equal(added.ok, true, added.error);
  const closed = await commands.run({
    cmd: "closeGap",
    storyId: "story-nd-chicago-river-reversal",
    label: "Second pin check",
    note: "Closed in the test; the row must remain."
  });
  assert.equal(closed.ok, true, closed.error);
  const row = research.entryFor("story-nd-chicago-river-reversal");
  assert.ok(row.gaps.some((g) => g.label === "Second pin check" && g.closed));
  const extra = commands.unpack({ cmd: "addGap", storyId: "story-nd-chicago-river-reversal", label: "x", detail: "[UNKNOWN] y", url: "https://example.com/" });
  assert.match(extra.error, /unknown field/);
  const missing = commands.unpack({ cmd: "closeGap", storyId: "story-nd-chicago-river-reversal", note: "n" });
  assert.match(missing.error, /id or label/);
  const noQuote = commands.unpack({ cmd: "pasteQuote", storyId: "story-nd-chicago-river-reversal" });
  assert.match(noQuote.error, /unknown command/);
});

await t("fixture quotes are not copies of story source notes", async () => {
  const entry = fixture.stories.find((row) => row.storyId === "story-nd-chicago-river-reversal");
  assert.ok(entry && entry.quotes && entry.quotes.length);
  const notes = (chicago.sources || []).map((src) => src && src.note).filter(Boolean);
  assert.ok(notes.length);
  entry.quotes.forEach((q) => {
    notes.forEach((note) => {
      const qt = String(q.text).toLowerCase();
      const nt = String(note).toLowerCase();
      assert.notEqual(qt, nt, "quote copies a source note: " + q.id);
      assert.equal(nt.includes(qt), false, "quote is a slice of a source note: " + q.id);
    });
  });
});

await t("the validator rejects personal data in quote, gap and note text, non-ISO dates, and padded link URLs", async () => {
  const emailQuote = J(fixture);
  emailQuote.stories[0].quotes[0].text = "Write to desk" + String.fromCharCode(64) + "example.com for the caption.";
  assert.ok(schema.validateResearch(emailQuote, newsdeskEp).some((e) => /email or phone/.test(e)));
  const phoneGap = J(fixture);
  phoneGap.stories[0].gaps[0].detail = "The surveyed lock number is 415-555-0100 [UNKNOWN].";
  assert.ok(schema.validateResearch(phoneGap, newsdeskEp).some((e) => /email or phone/.test(e)));
  const phoneNote = J(fixture);
  phoneNote.stories[0].updates[0].note = "Call +14155550100 before closing this gap.";
  assert.ok(schema.validateResearch(phoneNote, newsdeskEp).some((e) => /email or phone/.test(e)));
  const badRetrieved = J(fixture);
  badRetrieved.stories[0].quotes[0].retrieved = "21 Nov 2026";
  assert.ok(schema.validateResearch(badRetrieved, newsdeskEp).some((e) => /ISO date/.test(e)));
  const badClosed = J(fixture);
  badClosed.stories[0].gaps[0].closed = "11/21/2026";
  assert.ok(schema.validateResearch(badClosed, newsdeskEp).some((e) => /ISO date/.test(e)));
  const badAt = J(fixture);
  badAt.stories[0].updates[0].at = "2026/11/21";
  assert.ok(schema.validateResearch(badAt, newsdeskEp).some((e) => /ISO date/.test(e)));
  const lead = J(fixture);
  lead.stories[0].links[0].url = " https://www.mwrd.org/what-we-do/history-protecting-our-water-environment";
  assert.ok(schema.validateResearch(lead, newsdeskEp).some((e) => /spaces/.test(e)));
  const trail = J(fixture);
  trail.stories[0].links[0].url = "https://www.mwrd.org/what-we-do/history-protecting-our-water-environment ";
  assert.ok(schema.validateResearch(trail, newsdeskEp).some((e) => /spaces/.test(e)));
  const inner = J(fixture);
  inner.stories[0].links[0].url = "https://www.mwrd.org/a b";
  assert.ok(schema.validateResearch(inner, newsdeskEp).some((e) => /spaces/.test(e) || /https/.test(e)));
  const years = J(fixture);
  years.stories[0].quotes[0].text = "Construction of the canal was a 1892-1900 project.";
  assert.deepEqual(schema.validateResearch(years, newsdeskEp).filter((e) => /email or phone/.test(e)), []);
  const coords = J(fixture);
  coords.stories[0].quotes[0].text = "A named town center sits at 41.832 -87.752 in the gazetteer.";
  assert.deepEqual(schema.validateResearch(coords, newsdeskEp).filter((e) => /email or phone/.test(e)), []);
  const isbn = J(fixture);
  isbn.stories[0].updates[0].note = "Background reading is ISBN 978-0-306-40615-7.";
  assert.deepEqual(schema.validateResearch(isbn, newsdeskEp).filter((e) => /email or phone/.test(e)), []);
  const isbn10 = J(fixture);
  isbn10.stories[0].updates[0].note = "Background reading is ISBN 0-306-40615-2.";
  assert.deepEqual(schema.validateResearch(isbn10, newsdeskEp).filter((e) => /email or phone/.test(e)), []);
  assert.equal(schema.textCarriesPersonalData("ISBN 0-306-40615-2"), false);
  assert.equal(schema.textCarriesPersonalData("0-306-40615-2"), true);
  assert.equal(schema.textCarriesPersonalData("ISBN 0-8044-2957-X"), false);
  assert.equal(schema.textCarriesPersonalData("ISBN 0-226-01234-X"), true);
  ["312-5551212", "3125-551212", "31255-51212", "312555-1212", "Call 312-5551212", "3125551218", "312-5551218"].forEach((sample) => {
    assert.equal(schema.textCarriesPersonalData(sample), true, sample);
  });
  assert.equal(schema.urlCarriesPersonalData("https://www.mwrd.org/?p=312-5551212"), true);
  assert.equal(schema.urlCarriesPersonalData("https://www.mwrd.org/?p=3125551218"), true);
  const dotted = J(fixture);
  dotted.stories[0].quotes[0].text = "The desk number was 312.555.1212 on the memo.";
  assert.ok(schema.validateResearch(dotted, newsdeskEp).some((e) => /email or phone/.test(e)));
  const dottedGap = J(fixture);
  dottedGap.stories[0].gaps[0].label = "Call 312.555.1212";
  dottedGap.stories[0].gaps[0].detail = "Leave this gap open [UNKNOWN].";
  assert.ok(schema.validateResearch(dottedGap, newsdeskEp).some((e) => /email or phone/.test(e)));
  fixture.stories.forEach((row) => {
    (row.quotes || []).forEach((q) => {
      assert.equal(schema.textCarriesPersonalData(q.text), false, q.id);
      if (q.retrieved) assert.equal(schema.isIsoDate(q.retrieved), true, q.retrieved);
    });
    (row.gaps || []).forEach((g) => {
      assert.equal(schema.textCarriesPersonalData(g.detail), false, g.id);
      if (g.closed) assert.equal(schema.isIsoDate(g.closed), true, g.closed);
    });
    (row.updates || []).forEach((u) => {
      assert.equal(schema.textCarriesPersonalData(u.note), false, u.id);
      assert.equal(schema.isIsoDate(u.at), true, u.at);
    });
  });
});

await t("closing an already-closed gap is a no-op, and addGap rejects a duplicate label", async () => {
  ctx.window.GD.state = { episode: newsdeskEp };
  research.load(J(fixture), newsdeskEp);
  const first = research.closeGap({
    storyId: "story-nd-chicago-river-reversal",
    id: "gap-chicago-pin",
    note: "Closed once in the duplicate-close test."
  });
  assert.equal(first.ok, true, first.error);
  const afterFirst = research.entryFor("story-nd-chicago-river-reversal");
  const updateCount = afterFirst.updates.length;
  const closedAt = afterFirst.gaps.find((g) => g.id === "gap-chicago-pin").closed;
  const again = research.closeGap({
    storyId: "story-nd-chicago-river-reversal",
    id: "gap-chicago-pin",
    note: "A second close must not append another update."
  });
  assert.equal(again.ok, true, again.error);
  const after = research.entryFor("story-nd-chicago-river-reversal");
  assert.equal(after.updates.length, updateCount);
  assert.equal(after.gaps.find((g) => g.id === "gap-chicago-pin").closed, closedAt);
  assert.equal(after.updates.some((u) => /second close must not/.test(u.note)), false);
  const dup = research.addGap({
    storyId: "story-nd-chicago-river-reversal",
    label: "Surveyed lock coordinate",
    detail: "A second row with this label is not allowed [UNKNOWN]."
  });
  assert.equal(dup.ok, false);
  assert.match(dup.error, /duplicate gap label/);
});

await t("Escape closes the research drawer and does not clear the news-desk selection in workspace, fullscreen, or the archive", async () => {
  const { document } = makeDom();
  ctx.document = document;
  ctx.window.document = document;
  ctx.window.GD.state = { episode: newsdeskEp };
  research.load(J(fixture), newsdeskEp);
  newsdesk.applyView("newsdesk");
  newsdesk.state.feed = newsdesk.mergeFeeds([newsdesk.parseFeed(sections), newsdesk.parseFeed(catalog), newsdesk.parseFeed(newsdeskEp)]);
  newsdesk.state.loaded = true;
  newsdesk.state.sectionId = "all";
  newsdesk.wire();
  newsdesk.selectTopic("story-nd-chicago-river-reversal", { silent: true });
  const opened = research.openFor("story-nd-chicago-river-reversal");
  assert.equal(opened.ok, true, opened.error);
  assert.equal(research.isOpen(), true);
  const selected = newsdesk.state.selectedId;
  document.dispatchEvent({ key: "Escape", code: "Escape", type: "keydown", preventDefault() {} });
  assert.equal(research.isOpen(), false);
  assert.equal(newsdesk.state.selectedId, selected);
  newsdesk.applyView("workspace");
  document.dispatchEvent({ key: "Escape", code: "Escape", type: "keydown", preventDefault() {} });
  assert.equal(newsdesk.state.selectedId, selected);
  const full = document.getElementById("gdFull");
  full.hidden = false;
  document.dispatchEvent({ key: "Escape", code: "Escape", type: "keydown", preventDefault() {} });
  assert.equal(newsdesk.state.selectedId, selected);
  full.hidden = true;
  const archive = document.getElementById("archive");
  archive.open = true;
  document.dispatchEvent({ key: "Escape", code: "Escape", type: "keydown", preventDefault() {} });
  assert.equal(newsdesk.state.selectedId, selected);
});

await t("research.js does not fetch cited pages, auto-score, or geocode", async () => {
  const src = fs.readFileSync(path.join(root, "js/research.js"), "utf8");
  assert.match(src, /No remote CMS fetch/);
  assert.equal(/function\s+autoScore|nominatim|XMLHttpRequest|WebSocket/.test(src), false);
  assert.equal(src.includes("newsdesk/research.json"), true);
});

await Promise.resolve();

await t("2000 random 10-digit phone numbers are flagged as personal data", async () => {
  let seed = 20261121 >>> 0;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const missed = [];
  for (let i = 0; i < 2000; i++) {
    let n = "";
    for (let d = 0; d < 10; d++) n += String(Math.floor(rand() * 10));
    if (!schema.textCarriesPersonalData(n)) missed.push(n);
    if (!schema.textCarriesPersonalData("Call " + n)) missed.push("Call " + n);
    if (!schema.urlCarriesPersonalData("https://www.mwrd.org/?p=" + n)) missed.push("?p=" + n);
  }
  assert.equal(missed.length, 0, "missed " + missed.slice(0, 12).join(", "));
});

console.log("\n" + n + " tests passed");
