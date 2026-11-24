// Unit tests for author-applied claim scores (globedesk.claims/1). No auto-scoring, no network, no geocoding.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { console, window: { GD: {} }, Date, URL, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView };
ctx.window.window = ctx.window;
ctx.globalThis = ctx;
ctx.sessionStorage = { _d: {}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=String(v); } };
vm.createContext(ctx);
for (const f of ["sanitize", "schema", "outbound", "claims", "newsdesk", "commands"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
}
const { schema, claims, newsdesk, commands } = ctx.window.GD;
const J = (v) => JSON.parse(JSON.stringify(v));
assert.deepEqual = ((orig) => (a, b, m) => orig(J(a), J(b), m))(assert.deepEqual);
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

const fixture = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/claims.json"), "utf8"));
const newsdeskEp = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/topics/newsdesk-50.globedesk.json"), "utf8"));
const sections = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/sections.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/catalog.json"), "utf8"));
const dc = JSON.parse(fs.readFileSync(path.join(root, "episodes", "washington-dc-demo.globedesk.json"), "utf8"));
const chicago = newsdeskEp.stories.find((s) => s.id === "story-nd-chicago-river-reversal");

const EPISODES = [
  "episodes/blank.globedesk.json",
  "episodes/washington-dc-demo.globedesk.json",
  "newsdesk/episodes/newsdesk-chokepoints.globedesk.json",
  "newsdesk/episodes/newsdesk-civic.globedesk.json",
  "newsdesk/episodes/newsdesk-memory.globedesk.json",
  "newsdesk/episodes/newsdesk-science.globedesk.json",
  "newsdesk/topics/newsdesk-50.globedesk.json",
  "starter/episode-template.globedesk.json"
];

function escapeText(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function makeDom() {
  const byId = {};
  function textNode(data) {
    return {
      nodeType: 3,
      data: String(data),
      childNodes: [],
      get textContent() { return this.data; },
      set textContent(v) { this.data = String(v); }
    };
  }
  function serialize(n) {
    if (!n) return "";
    if (n.nodeType === 3) return escapeText(n.data);
    const tag = String(n.tagName || "div").toLowerCase();
    let attrs = "";
    if (n.id) attrs += ` id="${escapeText(n.id)}"`;
    if (n.className) attrs += ` class="${escapeText(n.className)}"`;
    for (const [k, v] of Object.entries(n._attrs || {})) {
      if (k === "id" || k === "class") continue;
      attrs += ` ${k}="${escapeText(v)}"`;
    }
    const inner = (n.childNodes || []).map(serialize).join("");
    if (tag === "input") return `<${tag}${attrs}>`;
    return `<${tag}${attrs}>${inner}</${tag}>`;
  }
  function textOf(n) {
    if (!n) return "";
    if (n.nodeType === 3) return n.data;
    return (n.childNodes || []).map(textOf).join("");
  }
  function matchOne(el, sel) {
    const m = sel.match(/^(?:([a-zA-Z][\w-]*)|)?((?:\.[A-Za-z][\w-]*)*)((?:\[[^\]]+\])*)$/);
    if (!m) return false;
    const tag = m[1];
    const classes = (m[2] || "").split(".").filter(Boolean);
    if (tag && String(el.tagName).toLowerCase() !== tag.toLowerCase()) return false;
    const cls = String(el.className || "").split(/\s+/);
    if (classes.some((c) => !cls.includes(c))) return false;
    const attrBlock = m[3] || "";
    const re = /\[([^\]]+)\]/g;
    let a;
    while ((a = re.exec(attrBlock))) {
      const spec = a[1];
      const eq = spec.match(/^([^=]+)=["']?([^"']*)["']?$/);
      if (eq) {
        if (String(el.getAttribute(eq[1].trim())) !== eq[2]) return false;
      } else if (el.getAttribute(spec.trim()) == null) return false;
    }
    return true;
  }
  function walk(root, acc) {
    (root.childNodes || []).forEach((c) => {
      if (c && c.nodeType === 1) { acc.push(c); walk(c, acc); }
    });
  }
  function qsa(root, selector) {
    const groups = String(selector).split(",").map((s) => s.trim()).filter(Boolean);
    const nodes = [];
    walk(root, nodes);
    return nodes.filter((n) => groups.some((g) => {
      const parts = g.split(/\s+/);
      if (parts.length === 1) return matchOne(n, parts[0]);
      if (!matchOne(n, parts[parts.length - 1])) return false;
      let cur = n.parentNode;
      let i = parts.length - 2;
      while (cur && i >= 0) {
        if (cur.nodeType === 1 && matchOne(cur, parts[i])) i--;
        cur = cur.parentNode;
      }
      return i < 0;
    }));
  }
  function el(tag) {
    const rec = {
      tagName: String(tag || "div").toUpperCase(),
      nodeType: 1,
      childNodes: [],
      parentNode: null,
      _attrs: {},
      _ln: {},
      hidden: false,
      checked: false,
      selected: false,
      value: "",
      type: "",
      className: "",
      id: "",
      _ndWired: false,
      setAttribute(k, v) {
        const key = String(k);
        const val = String(v);
        this._attrs[key] = val;
        if (key === "id") { this.id = val; byId[val] = this; }
        if (key === "class") this.className = val;
        if (key === "type") this.type = val;
      },
      getAttribute(k) {
        const key = String(k);
        if (key === "id") return this.id || null;
        if (key === "class") return this.className || null;
        return Object.prototype.hasOwnProperty.call(this._attrs, key) ? this._attrs[key] : null;
      },
      appendChild(c) {
        if (!c) return c;
        if (c.parentNode && c.parentNode.removeChild) c.parentNode.removeChild(c);
        c.parentNode = this;
        this.childNodes.push(c);
        if (c.id) byId[c.id] = c;
        return c;
      },
      removeChild(c) {
        this.childNodes = this.childNodes.filter((x) => x !== c);
        if (c) c.parentNode = null;
        return c;
      },
      insertBefore(c, ref) {
        if (!ref) return this.appendChild(c);
        if (c.parentNode && c.parentNode.removeChild) c.parentNode.removeChild(c);
        c.parentNode = this;
        const i = this.childNodes.indexOf(ref);
        if (i < 0) this.childNodes.push(c);
        else this.childNodes.splice(i, 0, c);
        if (c.id) byId[c.id] = c;
        return c;
      },
      get innerHTML() { return (this.childNodes || []).map(serialize).join(""); },
      set innerHTML(v) {
        this.childNodes = [];
        if (v) this._raw = String(v);
        else this._raw = "";
        // Keep unparsed markup so existing card HTML stays visible to tests.
        this._unparsed = this._raw;
      },
      get textContent() { return (this._unparsed || "") + textOf(this); },
      set textContent(v) { this.childNodes = []; this._unparsed = ""; if (String(v)) this.childNodes.push(textNode(String(v))); },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) { return qsa(this, sel); },
      addEventListener(type, fn) { (this._ln[type] = this._ln[type] || []).push(fn); },
      dispatchEvent(ev) { (this._ln[ev && ev.type] || []).forEach((fn) => fn(ev)); return true; },
      closest() { return null; },
      hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) || (k === "hidden" && this.hidden); },
      removeAttribute(k) { delete this._attrs[k]; if (k === "hidden") this.hidden = false; }
    };
    const innerGet = Object.getOwnPropertyDescriptor(rec, "innerHTML").get;
    Object.defineProperty(rec, "innerHTML", {
      configurable: true,
      enumerable: true,
      get() { return (this._unparsed || "") + innerGet.call(this); },
      set(v) {
        this.childNodes = [];
        this._unparsed = String(v == null ? "" : v);
      }
    });
    return rec;
  }
  const body = { classList: { _c: new Set(), add(...a){ a.forEach((x)=>this._c.add(x)); }, remove(...a){ a.forEach((x)=>this._c.delete(x)); } }, childNodes: [], nodeType: 1 };
  const known = {};
  function knownEl(id) {
    if (!known[id]) { known[id] = el("div"); known[id].id = id; byId[id] = known[id]; }
    return known[id];
  }
  const document = {
    body,
    _ln: {},
    addEventListener(type, fn) { (this._ln[type] = this._ln[type] || []).push(fn); },
    createElement: (tag) => el(tag),
    createTextNode: (data) => textNode(data),
    getElementById: (id) => byId[id] || null,
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) {
      const acc = Object.values(byId);
      const out = [];
      acc.forEach((n) => out.push(...qsa(n, sel)));
      return out;
    }
  };
  ["btnViewToggle", "newsdesk", "ndSections", "ndCards", "ndMeta", "ndNotice"].forEach(knownEl);
  return { document };
}

function loadDesk() {
  claims.load(J(fixture), newsdeskEp);
  const { document } = makeDom();
  ctx.document = document;
  ctx.window.document = document;
  newsdesk.applyView("newsdesk");
  newsdesk.state.feed = newsdesk.mergeFeeds([newsdesk.parseFeed(sections), newsdesk.parseFeed(catalog), newsdesk.parseFeed(newsdeskEp)]);
  newsdesk.state.loaded = true;
  newsdesk.state.sectionId = "all";
  newsdesk.state.selectedId = null;
  newsdesk.render();
  ctx.window.GD.state = ctx.window.GD.state || {};
  ctx.window.GD.state.episode = newsdesk.state.feed.episode || newsdeskEp;
  return document;
}

await t("old episodes and the 50 news-desk stories still validate with no claimStatus", async () => {
  EPISODES.forEach((rel) => {
    const ep = JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
    assert.deepEqual(schema.validate(ep), [], rel);
    const blob = JSON.stringify(ep);
    assert.equal(blob.includes("claimStatus"), false, rel + " must not carry claimStatus");
  });
  assert.equal(newsdeskEp.stories.length, 50);
});

await t("a fact with an unknown key still fails, and a bad claimStatus fails", async () => {
  const ep = J(dc);
  ep.stories[0].cards[0].facts[0].claimStatus = "supported";
  const factErrs = schema.validate(ep);
  assert.ok(factErrs.some((e) => /unknown key/.test(e) && /claimStatus/.test(e)), factErrs.join("; "));
  const bad = J(fixture);
  bad.claims[0].claimStatus = "maybe";
  const statusErrs = schema.validateClaims(bad, newsdeskEp);
  assert.ok(statusErrs.some((e) => /claimStatus must be/.test(e)), statusErrs.join("; "));
});

await t("people-disagree with fewer than two groups fails", async () => {
  const one = J(fixture);
  const row = one.claims.find((c) => c.claimStatus === "people-disagree");
  row.disagree = [row.disagree[0]];
  const errs = schema.validateClaims(one, newsdeskEp);
  assert.ok(errs.some((e) => /at least two disagree groups/.test(e)), errs.join("; "));
});

await t("the news-desk claims fixture has one supported, one not-proven, and one people-disagree fact", async () => {
  assert.equal(fixture.schema, "globedesk.claims/1");
  assert.deepEqual(schema.validateClaims(fixture, newsdeskEp), []);
  const byStatus = {};
  fixture.claims.forEach((c) => { byStatus[c.claimStatus] = (byStatus[c.claimStatus] || 0) + 1; });
  assert.equal(byStatus.supported, 1);
  assert.equal(byStatus["not-proven"], 1);
  assert.equal(byStatus["people-disagree"], 1);
  const disagree = fixture.claims.find((c) => c.claimStatus === "people-disagree");
  assert.equal(disagree.storyId, "story-nd-chicago-river-reversal");
  assert.equal(disagree.factLabel, "Reversal");
  assert.equal(disagree.disagree.length, 2);
  const text = JSON.stringify(disagree.disagree);
  assert.match(text, /2 January 1900/);
  assert.match(text, /17 January 1900/);
  assert.equal(/winner/i.test(text), false);
  const scored = new Set(fixture.claims.map((c) => c.factLabel));
  assert.equal(scored.has("Purpose, as stated"), false);
  const chicagoClaims = fixture.claims.filter((c) => c.storyId === "story-nd-chicago-river-reversal");
  assert.equal(chicagoClaims.length, fixture.claims.length);
});

await t("setClaim rejects a source id that is not on the story", async () => {
  claims.load(J(fixture), newsdeskEp);
  ctx.window.GD.state = { episode: newsdeskEp };
  const out = claims.setClaim({
    storyId: "story-nd-chicago-river-reversal",
    cardId: "card-nd-chicago-river",
    factIndex: 2,
    factLabel: "Purpose, as stated",
    claimStatus: "supported",
    sourceIds: ["src-not-on-story"]
  }, chicago);
  assert.equal(out.ok, false);
  assert.match(out.error, /unknown source/);
  const listed = claims.listed("story-nd-chicago-river-reversal");
  const purpose = listed.facts.find((f) => f.factIndex === 2);
  assert.equal(purpose.claimStatus, "");
});

await t("setClaim leaves asReported, source status, and the fact itself unchanged", async () => {
  const ep = J(newsdeskEp);
  const story = ep.stories.find((s) => s.id === "story-nd-chicago-river-reversal");
  const asReported = story.asReported;
  const statuses = story.sources.map((s) => s.status);
  const fact = J(story.cards[0].facts[2]);
  claims.load(J(fixture), ep);
  ctx.window.GD.state = { episode: ep };
  const out = claims.setClaim({
    storyId: story.id,
    cardId: "card-nd-chicago-river",
    factIndex: 2,
    claimStatus: "supported",
    sourceIds: ["src-mwrd-history"]
  }, story);
  assert.equal(out.ok, true, out.error);
  assert.equal(story.asReported, asReported);
  assert.deepEqual(story.sources.map((s) => s.status), statuses);
  assert.deepEqual(story.cards[0].facts[2], fact);
  assert.equal(Object.prototype.hasOwnProperty.call(story.cards[0].facts[2], "claimStatus"), false);
  const listed = claims.listed(story.id);
  const purpose = listed.facts.find((f) => f.factIndex === 2);
  assert.equal(purpose.claimStatus, "supported");
  assert.deepEqual(purpose.sourceIds, ["src-mwrd-history"]);
});

await t("listClaims returns ids and statuses only, with no label or value text", async () => {
  claims.load(J(fixture), newsdeskEp);
  ctx.window.GD.state = { episode: newsdeskEp };
  const listed = claims.listed("story-nd-chicago-river-reversal");
  assert.equal(listed.storyId, "story-nd-chicago-river-reversal");
  assert.equal(listed.facts.length, 4);
  const supported = listed.facts.find((f) => f.factIndex === 0);
  assert.equal(supported.claimStatus, "supported");
  assert.ok(supported.sourceIds.includes("src-mwrd-history"));
  assert.equal("factLabel" in supported, false);
  assert.equal("value" in supported, false);
  const reversal = listed.facts.find((f) => f.factIndex === 1);
  assert.equal(reversal.claimStatus, "people-disagree");
  assert.equal(reversal.disagree.length, 2);
  assert.equal("position" in reversal.disagree[0], false);
  assert.ok(reversal.disagree[0].sourceIds.length);
  const pin = listed.facts.find((f) => f.factIndex === 3);
  assert.equal(pin.claimStatus, "not-proven");
  const purpose = listed.facts.find((f) => f.factIndex === 2);
  assert.equal(purpose.claimStatus, "");
  const blob = JSON.stringify(listed);
  assert.equal(blob.includes("District created"), false);
  assert.equal(blob.includes("Purpose, as stated"), false);
  assert.equal(blob.includes("2 January 1900"), false);
  assert.equal("dek" in listed, false);
  assert.equal("script" in listed, false);
  assert.equal("body" in listed, false);
  assert.equal(blob.includes("<"), false);
});

await t("listClaims and setClaim reject an unknown story, and unpack rejects extra keys", async () => {
  claims.load(J(fixture), newsdeskEp);
  ctx.window.GD.state = { episode: newsdeskEp };
  const listed = await commands.run({ cmd: "listClaims", storyId: "story-does-not-exist" });
  assert.equal(listed.ok, false);
  assert.match(listed.error, /unknown story/);
  const set = await commands.run({
    cmd: "setClaim",
    storyId: "story-does-not-exist",
    cardId: "card-nd-chicago-river",
    factIndex: 0,
    claimStatus: "supported"
  });
  assert.equal(set.ok, false);
  assert.match(set.error, /unknown story/);
  const extra = commands.unpack({ cmd: "setClaim", storyId: "story-nd-chicago-river-reversal", cardId: "card-nd-chicago-river", factIndex: 0, claimStatus: "supported", url: "https://example.com/" });
  assert.match(extra.error, /unknown field/);
  const missing = commands.unpack({ cmd: "setClaim", storyId: "story-nd-chicago-river-reversal", cardId: "card-nd-chicago-river", claimStatus: "supported" });
  assert.match(missing.error, /factIndex or factLabel/);
  const disagreeExtra = commands.unpack({
    cmd: "setClaim",
    storyId: "story-nd-chicago-river-reversal",
    cardId: "card-nd-chicago-river",
    factIndex: 1,
    claimStatus: "people-disagree",
    disagree: [{ sourceIds: ["src-mwrd-125-friends"], position: "A", extra: true }]
  });
  assert.match(disagreeExtra.error, /unknown field/);
});

await t("the claims strip is only on the open story and does not change the 50-card count", async () => {
  const document = loadDesk();
  let html = document.getElementById("ndCards").innerHTML;
  assert.equal((html.match(/class="nd-card/g) || []).length, 50);
  assert.equal(html.includes("nd-claims"), false);
  newsdesk.selectTopic("story-nd-chicago-river-reversal", { silent: true });
  html = document.getElementById("ndCards").innerHTML;
  assert.equal((html.match(/class="nd-card/g) || []).length, 50);
  assert.match(html, /nd-claims/);
  assert.match(html, /Scores are set by the author, not by GlobeDesk/);
  assert.match(html, /claim-chip-supported/);
  assert.match(html, /claim-chip-not-proven/);
  assert.match(html, /claim-chip-people-disagree/);
  assert.match(html, /claim-disagree/);
  assert.match(html, /2 January 1900/);
  assert.match(html, /17 January 1900/);
  assert.match(html, /does not pick a winner/);
  assert.match(html, /Purpose, as stated/);
  const purposeBlock = html.split('claim-label">Purpose, as stated')[1].split('class="claim-fact"')[0];
  assert.equal(/claim-chip/.test(purposeBlock), false);
  const open = await commands.run({ cmd: "openClaims", storyId: "story-nd-chicago-river-reversal" });
  assert.equal(open.ok, true, open.error);
  assert.equal(J(open.result).alreadyOpen, true);
});

await t("editor Cards and Sources markup has a score control, a source picker, and a sources-disagree editor", async () => {
  const { document } = makeDom();
  ctx.document = document;
  ctx.window.document = document;
  claims.load(J(fixture), newsdeskEp);
  const html = claims.editorHtml(chicago);
  assert.match(html, /story-claims/);
  assert.match(html, /Scores are set by the author, not by GlobeDesk/);
  assert.match(html, /data-claim-status/);
  assert.match(html, /data-claim-src/);
  assert.match(html, /claim-dg-box/);
  assert.match(html, /at least two groups/);
});

await t("openClaims is a no-op success when the story is already selected, and fails on an unknown story", async () => {
  loadDesk();
  newsdesk.selectTopic("story-nd-chicago-river-reversal", { silent: true });
  const again = claims.openFor("story-nd-chicago-river-reversal");
  assert.equal(again.ok, true);
  assert.equal(again.result.alreadyOpen, true);
  const miss = claims.openFor("story-missing");
  assert.equal(miss.ok, false);
  assert.match(miss.error, /unknown story/);
});

await t("real boot order loads 3 claims even when the workspace episode is blank", async () => {
  const blank = JSON.parse(fs.readFileSync(path.join(root, "episodes/blank.globedesk.json"), "utf8"));
  const outboundDoc = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/outbound.json"), "utf8"));
  const { document } = makeDom();
  ctx.document = document;
  ctx.window.document = document;
  ctx.window.GD.state = { episode: J(blank) };
  claims.empty();
  newsdesk.state.feed = { sections: [], topics: [], episode: null };
  newsdesk.state.loaded = false;
  newsdesk.state.selectedId = null;
  const files = {
    "newsdesk/sections.json": sections,
    "newsdesk/catalog.json": catalog,
    "newsdesk/topics/newsdesk-50.globedesk.json": newsdeskEp,
    "newsdesk/claims.json": fixture,
    "newsdesk/outbound.json": outboundDoc
  };
  const prevFetch = ctx.fetch;
  ctx.fetch = (url) => {
    const key = String(url).replace(/^\//, "");
    const doc = files[key];
    return Promise.resolve({ ok: !!doc, json: () => Promise.resolve(doc ? J(doc) : null) });
  };
  try {
    await newsdesk.boot();
    assert.equal((ctx.window.GD.state.episode.stories || []).length, 1, "workspace episode should stay the blank story");
    assert.deepEqual(claims.state.errors, [], claims.state.errors.join("; "));
    assert.equal(claims.state.claims.length, 3);
    newsdesk.selectTopic("story-nd-chicago-river-reversal", { silent: true });
    const html = document.getElementById("ndCards").innerHTML;
    assert.equal((html.match(/class="nd-card/g) || []).length, 50);
    assert.equal((html.match(/claim-chip-/g) || []).length, 3);
    assert.equal((html.match(/class="claim-disagree-col"/g) || []).length, 2);
    const scored = await commands.run({
      cmd: "setClaim",
      storyId: "story-nd-chicago-river-reversal",
      cardId: "card-nd-chicago-river",
      factIndex: 2,
      claimStatus: "supported",
      sourceIds: ["src-mwrd-history"]
    });
    assert.equal(scored.ok, true, scored.error);
    assert.equal(claims.listed("story-nd-chicago-river-reversal").facts.find((f) => f.factIndex === 2).claimStatus, "supported");
  } finally {
    if (prevFetch === undefined) delete ctx.fetch;
    else ctx.fetch = prevFetch;
  }
});

await t("choosing Unscored clears an existing score", async () => {
  const { document } = makeDom();
  ctx.document = document;
  ctx.window.document = document;
  ctx.window.GD.state = { episode: newsdeskEp };
  claims.load(J(fixture), newsdeskEp);
  const root = document.createElement("div");
  claims.mountEditor(root, chicago);
  const box = root.querySelectorAll(".claim-edit")[0];
  assert.ok(box);
  const sel = box.querySelector("[data-claim-status]");
  assert.equal(sel.value, "supported");
  sel.value = "";
  sel.dispatchEvent({ type: "change" });
  assert.equal(claims.listed("story-nd-chicago-river-reversal").facts.find((f) => f.factIndex === 0).claimStatus, "");
  assert.equal(claims.findClaim("story-nd-chicago-river-reversal", "card-nd-chicago-river", 0, "District created"), null);
});

await t("a source id containing a colon still works in the disagree editor", async () => {
  const { document } = makeDom();
  ctx.document = document;
  ctx.window.document = document;
  const story = J(chicago);
  story.sources = story.sources.concat([{ id: "src:mwrd:official", label: "Colon source", status: "verified" }]);
  ctx.window.GD.state = { episode: { schema: "globedesk.episode/2", stories: [story] } };
  claims.load({ schema: "globedesk.claims/1", claims: [] }, { schema: "globedesk.episode/2", stories: [story] });
  const out = claims.setClaim({
    storyId: story.id,
    cardId: "card-nd-chicago-river",
    factIndex: 1,
    claimStatus: "people-disagree",
    disagree: [
      { sourceIds: ["src:mwrd:official"], position: "Position from the colon source." },
      { sourceIds: ["src-illinois-dnr-flood-history"], position: "Position from Illinois DNR." }
    ]
  }, story);
  assert.equal(out.ok, true, out.error);
  const root = document.createElement("div");
  claims.mountEditor(root, story);
  const colon = [...root.querySelectorAll("[data-claim-src-id]")].find((cb) => cb.getAttribute("data-claim-src-id") === "src:mwrd:official");
  assert.ok(colon, "checkbox missing for src:mwrd:official");
  assert.equal(colon.checked, true);
  const listed = claims.listed(story.id);
  assert.ok(listed.facts.find((f) => f.factIndex === 1).disagree.some((g) => g.sourceIds.includes("src:mwrd:official")));
});

await t("not-proven and disputed chips use different Lily pad palette colours", async () => {
  const css = fs.readFileSync(path.join(root, "css/app.css"), "utf8");
  const notProven = css.match(/\.claim-chip-not-proven\s*\{[^}]+\}/);
  const disputed = css.match(/\.claim-chip-disputed\s*\{[^}]+\}/);
  assert.ok(notProven, "missing not-proven chip rule");
  assert.ok(disputed, "missing disputed chip rule");
  assert.match(notProven[0], /--gd-amber|#ffbf5e/);
  assert.match(disputed[0], /--gd-violet|#c9a2ff/);
  assert.notEqual(notProven[0], disputed[0]);
});

await t("setClaim command logs keep ids and status only, with no position text", async () => {
  ctx.window.GD.state = { episode: newsdeskEp };
  claims.load(J(fixture), newsdeskEp);
  const phrase = "UNIQUE-POSITION-TEXT-DO-NOT-LOG";
  await commands.run({
    cmd: "setClaim",
    storyId: "story-nd-chicago-river-reversal",
    cardId: "card-nd-chicago-river",
    factIndex: 1,
    claimStatus: "people-disagree",
    disagree: [
      { sourceIds: ["src-mwrd-125-friends"], position: phrase },
      { sourceIds: ["src-illinois-dnr-flood-history"], position: "17 January 1900" }
    ]
  });
  const blob = JSON.stringify(commands.log());
  assert.equal(blob.includes(phrase), false);
  const row = commands.log().filter((r) => r.cmd === "setClaim").pop();
  assert.ok(row);
  assert.equal(row.args.storyId, "story-nd-chicago-river-reversal");
  assert.equal(row.args.claimStatus, "people-disagree");
  assert.equal("position" in ((row.args.disagree && row.args.disagree[0]) || {}), false);
});

await t("a workspace story id that collides with a feed story shows a visible error", async () => {
  const { document } = makeDom();
  ctx.document = document;
  ctx.window.document = document;
  const clash = J(blankIfPresent());
  const colliding = {
    id: "story-nd-chicago-river-reversal",
    slug: "workspace-clash",
    title: "Workspace copy",
    cards: [],
    sources: []
  };
  ctx.window.GD.state = { episode: { schema: "globedesk.episode/2", stories: [colliding] } };
  newsdesk.applyView("newsdesk");
  newsdesk.state.feed = newsdesk.mergeFeeds([newsdesk.parseFeed(sections), newsdesk.parseFeed(catalog), newsdesk.parseFeed(newsdeskEp)]);
  newsdesk.state.loaded = true;
  newsdesk.state.sectionId = "all";
  newsdesk.state.selectedId = null;
  claims.load(J(fixture), claims.claimsEpisode());
  newsdesk.render();
  const ids = claims.collidingStoryIds();
  assert.ok(ids.includes("story-nd-chicago-river-reversal"), String(ids));
  const notice = document.getElementById("ndNotice");
  assert.ok(notice, "missing collision notice");
  assert.equal(notice.hidden || notice.hasAttribute && notice.hasAttribute("hidden"), false);
  assert.match(notice.textContent, /story-nd-chicago-river-reversal/);
  assert.match(notice.textContent, /identical/);
  assert.match(notice.textContent, /research/);
  assert.match(notice.className, /nd-id-collision/);
  assert.ok(claims.state.errors.length, "sidecar should fail closed on a colliding id");
});

function blankIfPresent() {
  return { schema: "globedesk.episode/2", stories: [] };
}

await t("claims.js does not auto-score, call a network API, or geocode", async () => {
  const src = fs.readFileSync(path.join(root, "js/claims.js"), "utf8");
  assert.match(src, /No auto-scoring, no network calls, and no geocoding/);
  assert.equal(/function\s+autoScore|nominatim|XMLHttpRequest|WebSocket/.test(src), false);
  assert.equal(src.includes("newsdesk/claims.json"), true);
});

await Promise.resolve();
console.log("\n" + n + " tests passed");
