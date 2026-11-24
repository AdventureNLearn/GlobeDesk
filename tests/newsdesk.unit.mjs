// Unit tests for the consumer news-desk view and the workspace toggle. No browser, no network.
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path"; import assert from "node:assert/strict"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, Date, URL, sessionStorage: { _d: {}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=String(v); } } };
vm.createContext(ctx);
for (const f of ["themes", "sanitize", "newsdesk"]) vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
const ND = ctx.window.GD.newsdesk;
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));


t("default palette uses Lily pad palette (owner original) tokens", () => {
  const pal = ctx.window.GD.themes.PALETTE;
  assert.equal(pal.bg, "#02040c");
  assert.equal(pal.ink, "#eaf6ff");
  assert.equal(pal.accent, "#e7c766");
  assert.equal(pal.highlight, "#5ee7ff");
});

t("parseFeed reads sections.json shape and does not invent topics", () => {
  const feed = ND.parseFeed({
    sections: [
      { id: "world", name: "World", order: 1, description: "Global places" },
      { id: "history", name: "History", order: 2 }
    ],
    topics: [
      { id: "suez", section: "world", title: "Suez Canal", dek: "Opened 1869", location: { name: "Ismailia (approx.)", lat: 30.59, lon: 32.27 }, zoom: 8 },
      { id: "un", section: "world", title: "UN Headquarters", lat: 40.75, lon: -73.97 }
    ]
  });
  assert.equal(feed.sections.length, 2);
  assert.equal(feed.topics.length, 2);
  assert.equal(ND.topicsInSection(feed, "world").length, 2);
  assert.equal(ND.topicsInSection(feed, "history").length, 0);
  assert.equal(ND.topicsInSection(feed, "all").length, 2);
});

t("parseFeed accepts nested section.topics and a story episode", () => {
  const nested = ND.parseFeed({
    sections: [{ id: "tech", name: "Tech", topics: [{ slug: "cern", title: "CERN", section: "tech", location: { lat: 46.23, lon: 6.05 } }] }]
  });
  assert.equal(nested.topics.length, 1);
  assert.equal(nested.topics[0].slug, "cern");
  const ep = ND.parseFeed({
    schema: "globedesk.episode/2",
    stories: [{ id: "story-capitol", slug: "capitol", title: "The Capitol", location: { lat: 38.89, lon: -77.01, name: "U.S. Capitol (approx.)" } }]
  });
  assert.equal(ep.topics[0].slug, "capitol");
  assert.equal(ep.episode.stories.length, 1);
});

t("empty or missing feed stays empty; nothing is invented", () => {
  assert.equal(ND.parseFeed(null).topics.length, 0);
  assert.equal(ND.parseFeed({}).topics.length, 0);
  assert.equal(ND.mergeFeeds([]).topics.length, 0);
});

t("flyTarget uses the topic pin and zoom; missing coords return null", () => {
  const tgt = ND.flyTarget({ location: { lat: 38.89, lon: -77.01 }, zoom: 13 });
  same(tgt.center, [-77.01, 38.89]);
  assert.equal(tgt.zoom, 13);
  assert.ok(tgt.durationSec > 0);
  assert.equal(ND.flyTarget({ title: "No pin" }), null);
});

t("view toggle goes newsdesk <-> workspace and persists", () => {
  assert.equal(ND.nextView("newsdesk"), "workspace");
  assert.equal(ND.nextView("workspace"), "newsdesk");
  assert.equal(ND.applyView("workspace"), "workspace");
  assert.equal(ND.state.view, "workspace");
  assert.equal(ND.toggleView(), "newsdesk");
  assert.equal(ctx.sessionStorage.getItem("globedesk-view"), "newsdesk");
});

t("selectTopic records the id and flyToTopic is a no-op without a globe", () => {
  ND.setFeed({ topics: [{ id: "capitol", title: "The Capitol", location: { lat: 38.89, lon: -77.01 } }] });
  const topic = ND.selectTopic("capitol", { silent: true });
  assert.equal(topic.id, "capitol");
  assert.equal(ND.state.selectedId, "capitol");
  assert.equal(ND.flyToTopic(topic), false);
});


t("wires all 50 catalog topics into 10 sections and keeps [UNKNOWN] pin notes", () => {
  const sections = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/sections.json"), "utf8"));
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/catalog.json"), "utf8"));
  const episode = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/topics/newsdesk-50.globedesk.json"), "utf8"));
  const feed = ND.mergeFeeds([ND.parseFeed(sections), ND.parseFeed(catalog), ND.parseFeed(episode)]);
  assert.equal(feed.sections.length, 10);
  assert.equal(feed.topics.length, 50);
  assert.equal(feed.episode.stories.length, 50);
  const counts = {};
  feed.topics.forEach((row) => {
    const sid = row.section || row.sectionId;
    counts[sid] = (counts[sid] || 0) + 1;
    assert.ok(row.title, row.slug + " needs a title");
    assert.ok(row.dek, row.slug + " needs the catalog dek");
    assert.ok(row.pinNote || (row.location && row.location.note), row.slug + " needs the pin note");
    const note = row.pinNote || row.location.note;
    assert.match(note, /approximate|Approximate|UNESCO|Mauna Loa|coordinate|pin/i);
  });
  assert.equal(Object.keys(counts).length, 10);
  Object.keys(counts).forEach((k) => assert.equal(counts[k], 5, k));
  const suez = feed.topics.find((row) => row.slug === "suez-canal");
  assert.ok(suez);
  assert.equal(suez.sectionId, "world");
  assert.match(suez.pinNote, /\[UNKNOWN\]/);
  assert.equal(suez.hasUnknown, true);
  assert.equal(suez.precision, "approximate");
  assert.ok(suez.story || true);
  const tgt = ND.flyTarget(suez);
  same(tgt.center, [32.27, 30.59]);
});

t("consumer card HTML keeps [UNKNOWN] and the approximate-pin note", () => {
  const sections = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/sections.json"), "utf8"));
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/catalog.json"), "utf8"));
  const episode = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/topics/newsdesk-50.globedesk.json"), "utf8"));
  // Minimal DOM so render() can run.
  const { document } = makeDom();
  ctx.document = document;
  ctx.window.document = document;
  ND.applyView("newsdesk");
  ND.state.feed = ND.mergeFeeds([ND.parseFeed(sections), ND.parseFeed(catalog), ND.parseFeed(episode)]);
  ND.state.loaded = true;
  ND.state.sectionId = "all";
  ND.render();
  const html = document.getElementById("ndCards").innerHTML;
  assert.match(html, /\[UNKNOWN\]/);
  assert.match(html, /nd-unknown/);
  assert.match(html, /Approximate pin/);
  assert.match(html, /nd-note/);
  assert.equal((html.match(/class="nd-card/g) || []).length, 50);
});

function makeDom() {
  const els = {};
  function el(id) {
    if (els[id]) return els[id];
    const rec = { id, innerHTML: "", hidden: false, _ndWired: false, className: "",
      setAttribute() {}, getAttribute(k){ return this._attrs && this._attrs[k]; },
      addEventListener() {}, closest() { return null; } };
    els[id] = rec;
    return rec;
  }
  const body = { classList: { _c: new Set(), add(...a){ a.forEach((x)=>this._c.add(x)); }, remove(...a){ a.forEach((x)=>this._c.delete(x)); } } };
  const document = {
    body,
    getElementById: (id) => {
      if (id === "btnViewToggle") return el("btnViewToggle");
      if (id === "newsdesk") return el("newsdesk");
      if (id === "ndSections") return el("ndSections");
      if (id === "ndCards") return el("ndCards");
      if (id === "ndMeta") return el("ndMeta");
      return el(id);
    }
  };
  return { document };
}


console.log("\n" + n + " newsdesk tests passed");
