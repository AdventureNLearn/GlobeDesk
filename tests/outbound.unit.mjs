// Unit tests for the Open in… allowlist sidecar, card/editor HTML, and listOutbound.
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
vm.createContext(ctx);
for (const f of ["sanitize", "schema", "outbound", "newsdesk", "commands"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
}
const { schema, outbound, newsdesk, commands } = ctx.window.GD;
const J = (v) => JSON.parse(JSON.stringify(v));
assert.deepEqual = ((orig) => (a, b, m) => orig(J(a), J(b), m))(assert.deepEqual);
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

const allowlist = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/outbound.json"), "utf8"));
const sections = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/sections.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/catalog.json"), "utf8"));
const episode = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/topics/newsdesk-50.globedesk.json"), "utf8"));
const dc = JSON.parse(fs.readFileSync(path.join(root, "episodes", "washington-dc-demo.globedesk.json"), "utf8"));

const EXPECTED = [
  { id: "sample-civic-desk", label: "Sample Civic Desk", url: "https://civic.example.org/", enabled: true, status: "verified" },
  { id: "sample-atlas-desk", label: "Sample Atlas Desk", url: "https://atlas.example.org/", enabled: true, status: "verified" },
  { id: "sample-pending-desk", label: "Sample Pending Desk", url: "", enabled: false, status: "[UNKNOWN]" }
];

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

await t("shipped outbound allowlist validates as globedesk.outbound/1", () => {
  assert.equal(allowlist.schema, "globedesk.outbound/1");
  assert.deepEqual(schema.validateOutbound(allowlist), []);
  assert.equal(allowlist.targets.length, 3);
});

await t("unknown keys and an enabled target without https still fail", () => {
  const badKey = JSON.parse(JSON.stringify(allowlist));
  badKey.extra = true;
  assert.ok(schema.validateOutbound(badKey).some((m) => /unknown key/.test(m)));
  const badUrl = JSON.parse(JSON.stringify(allowlist));
  badUrl.targets[0].url = "http://civic.example.org/";
  assert.ok(schema.validateOutbound(badUrl).some((m) => /https/.test(m)));
  const noUrl = JSON.parse(JSON.stringify(allowlist));
  delete noUrl.targets[0].url;
  assert.ok(schema.validateOutbound(noUrl).some((m) => /https url/.test(m)));
});

await t("each shipped target has the expected verification status", () => {
  outbound.load(allowlist);
  assert.deepEqual(outbound.state.errors, []);
  EXPECTED.forEach((exp) => {
    const tg = outbound.byId(exp.id);
    assert.ok(tg, exp.id);
    assert.equal(tg.label, exp.label);
    assert.equal(tg.status, exp.status);
    assert.equal(!!tg.enabled, exp.enabled);
    if (exp.enabled) {
      assert.equal(tg.url, exp.url);
      assert.equal(outbound.isLinkable(tg), true);
      assert.ok(schema.httpsOk(tg.url));
    } else {
      assert.equal(outbound.isLinkable(tg), false);
      assert.ok(!tg.url);
    }
  });
});

await t("card HTML links only enabled targets, with noopener noreferrer and no iframe", () => {
  outbound.load(allowlist);
  const html = outbound.cardHtml({ id: "story-nd-high-line", sectionId: "local-civic" });
  assert.match(html, /Open in…/);
  assert.match(html, /civic\.example\.org/);
  assert.doesNotMatch(html, /atlas\.example\.org/);
  assert.doesNotMatch(html, /sample-pending-desk/i);
  assert.doesNotMatch(html, /iframe/i);
  assert.doesNotMatch(html, /github\.com/);
  const anchors = html.match(/<a\b[^>]*>/g) || [];
  assert.equal(anchors.length, 1);
  anchors.forEach((a) => {
    assert.match(a, /target="_blank"/);
    assert.match(a, /rel="noopener noreferrer"/);
    assert.match(a, /href="https:\/\//);
  });
  const space = outbound.cardHtml({ id: "story-nd-cern-lhc", sectionId: "science-space" });
  assert.match(space, /atlas\.example\.org/);
  assert.doesNotMatch(space, /civic\.example\.org/);
  assert.equal((space.match(/<a\b/g) || []).length, 1);
  const world = outbound.cardHtml({ id: "story-nd-suez-canal", sectionId: "world" });
  assert.equal(world, "");
});

await t("Sample Pending Desk stays [UNKNOWN] and is never an anchor, including in the editor", () => {
  outbound.load(allowlist);
  const picker = outbound.editorPickerHtml({ id: "story-x", sectionId: "politics-policy", openIn: ["sample-pending-desk"] });
  assert.match(picker, /Sample Pending Desk \[UNKNOWN\]/);
  assert.match(picker, /not linked/);
  assert.match(picker, /data-openin="sample-pending-desk"[^>]*disabled/);
  assert.doesNotMatch(picker, /href="[^"]*sample-pending-desk/i);
  const anchors = picker.match(/<a\b[^>]*>/g) || [];
  anchors.forEach((a) => {
    assert.doesNotMatch(a, /sample-pending-desk/i);
    assert.match(a, /rel="noopener noreferrer"/);
  });
});

await t("optional story.openIn attaches an allowlisted target and still validates the episode", () => {
  outbound.load(allowlist);
  const html = outbound.cardHtml({ id: "story-nd-suez-canal", sectionId: "world", openIn: ["sample-civic-desk"] });
  assert.match(html, /civic\.example\.org/);
  const ep = JSON.parse(JSON.stringify(dc));
  ep.stories[0].openIn = ["sample-civic-desk", "sample-atlas-desk"];
  assert.deepEqual(schema.validate(ep), []);
});

await t("listOutbound is allowlisted, never opens a URL, and lists matching targets", () => {
  outbound.load(allowlist);
  const names = commands.list();
  assert.ok(names.includes("listOutbound"));
  assert.ok(!names.includes("openOutbound"));
  const unpacked = commands.unpack({ cmd: "listOutbound" });
  assert.equal(unpacked.cmd, "listOutbound");
  const bad = commands.unpack({ cmd: "listOutbound", url: "https://civic.example.org/" });
  assert.ok(bad.error && /unknown field/.test(bad.error));
});

await t("listOutbound result covers the shipped list and a matching news-desk story", async () => {
  outbound.load(allowlist);
  const all = J(await commands.run({ cmd: "listOutbound" }));
  assert.equal(all.ok, true, all.error || "listOutbound failed");
  assert.equal(all.result.targets.length, 3);
  assert.equal(all.result.targets.filter((x) => x.enabled).length, 2);
  const frog = all.result.targets.find((x) => x.id === "sample-pending-desk");
  assert.equal(frog.enabled, false);
  assert.equal(frog.url, "");
  assert.equal(frog.status, "[UNKNOWN]");
  const miss = J(await commands.run({ cmd: "listOutbound", storyId: "no-such-story" }));
  assert.equal(miss.ok, false);
  newsdesk.state.feed = newsdesk.mergeFeeds([
    newsdesk.parseFeed(sections),
    newsdesk.parseFeed(catalog),
    newsdesk.parseFeed(episode)
  ]);
  const civic = J(await commands.run({ cmd: "listOutbound", storyId: "story-nd-high-line" }));
  assert.equal(civic.ok, true, civic.error || "listOutbound storyId failed");
  const ids = civic.result.targets.filter((x) => x.enabled).map((x) => x.id).sort();
  assert.deepEqual(ids, ["sample-civic-desk"]);
  civic.result.targets.forEach((x) => {
    if (!x.enabled) assert.equal(x.url, "");
  });
});

await t("news-desk cards keep 50 articles and show Open in… only on matching sections", () => {
  outbound.load(allowlist);
  const { document } = makeDom();
  ctx.document = document;
  ctx.window.document = document;
  newsdesk.applyView("newsdesk");
  newsdesk.state.feed = newsdesk.mergeFeeds([
    newsdesk.parseFeed(sections),
    newsdesk.parseFeed(catalog),
    newsdesk.parseFeed(episode)
  ]);
  newsdesk.state.loaded = true;
  newsdesk.state.sectionId = "all";
  newsdesk.render();
  const html = document.getElementById("ndCards").innerHTML;
  assert.equal((html.match(/class="nd-card/g) || []).length, 50);
  assert.equal((html.match(/class="nd-openin"/g) || []).length, 15);
  assert.equal((html.match(/<a class="nd-openin-link"/g) || []).length, 15);
  assert.doesNotMatch(html, /<iframe/i);
  assert.doesNotMatch(html, /sample-pending-desk/i);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /\[UNKNOWN\]/);
  assert.match(html, /Approximate pin/);
});

await t("CSP is unchanged and does not list the outbound hosts", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const py = fs.readFileSync(path.join(root, "tools/serve.py"), "utf8");
  const ps = fs.readFileSync(path.join(root, "tools/serve.ps1"), "utf8");
  const cspRe = /Content-Security-Policy[^"']*["']([^"']+)["']/;
  const meta = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(meta);
  const csp = meta[1];
  ["civic.example.org", "atlas.example.org"].forEach((host) => {
    assert.ok(!csp.includes(host), host);
    assert.ok(!py.includes(host));
    assert.ok(!ps.includes(host));
  });
  assert.match(csp, /frame-src https:\/\/www\.youtube-nocookie\.com/);
});

await t("DC sample and the 50 news-desk topics still validate without openIn", () => {
  assert.deepEqual(schema.validate(dc), []);
  assert.deepEqual(schema.validate(episode), []);
  assert.ok(!Object.prototype.hasOwnProperty.call(dc.stories[0], "openIn"));
});

await t("a query string or fragment with an email or phone is rejected", () => {
  const mail = "person" + String.fromCharCode(64) + "example.com";
  const dashed = ["415", "555", "0100"].join("-");
  const e164 = ["+", "1", "415", "555", "0100"].join("");
  const bareUs = ["415", "555", "0100"].join("");
  const tel = "tel:" + e164;
  const ukIntl = ["+", "44", " 20 ", "7946", " 0958"].join("");
  const ukZero = ["00", "44", "-", "20", "-", "7946", "-", "0958"].join("");
  const ukLocal = ["020", " ", "7946", " ", "0958"].join("");
  const local7 = ["555", "0100"].join("");
  const withQuery = (url) => {
    const doc = J(allowlist);
    doc.targets = [Object.assign({}, doc.targets[0], { url })];
    return schema.validateOutbound(doc);
  };
  const q = (val) => "https://civic.example.org/?p=" + encodeURIComponent(val);
  const reject = (url, label) => {
    const errs = withQuery(url);
    assert.ok(errs.some((e) => /email or phone/.test(e)), label + " accepted: " + url + " → " + errs.join("; "));
  };
  const qMail = withQuery("https://civic.example.org/?e=" + mail);
  assert.ok(qMail.some((e) => /email or phone/.test(e)), qMail.join("; "));
  const encMail = withQuery("https://civic.example.org/?e=" + encodeURIComponent(mail));
  assert.ok(encMail.some((e) => /email or phone/.test(e)), encMail.join("; "));
  const frag = withQuery("https://civic.example.org/#c=" + mail);
  assert.ok(frag.some((e) => /email or phone/.test(e)), frag.join("; "));
  reject(q(dashed), "dashed US");
  reject(q(e164), "E.164");
  reject(q(bareUs), "bare US");
  reject(q(tel), "tel:");
  reject(q(ukIntl), "UK +44 raw");
  reject("https://civic.example.org/?p=%2B442079460958", "UK %2B");
  reject(q(ukZero), "UK 0044");
  reject(q(ukLocal), "UK 020");
  reject(q(local7), "7-digit");
  reject("https://civic.example.org/#" + encodeURIComponent(encodeURIComponent(mail)), "double-encoded email fragment");
  reject("https://civic.example.org/#" + encodeURIComponent(encodeURIComponent(dashed)), "double-encoded phone fragment");
  assert.deepEqual(withQuery("https://civic.example.org/"), []);
  const okUrls = [
    "https://civic.example.org/?date=2026-11-21",
    "https://civic.example.org/?lat=38.89&lon=-77.01",
    "https://civic.example.org/?bbox=-77.1,38.8,-77.0,38.9",
    "https://civic.example.org/?v=1.0.1",
    "https://civic.example.org/?u=@handle",
    "https://civic.example.org/?id=123-456-7890x",
    "https://civic.example.org/#map=12/38.89/-77.01",
    "https://civic.example.org/u/" + mail,
    "https://civic.example.org/call/" + dashed
  ];
  okUrls.forEach((url) => {
    assert.deepEqual(withQuery(url), [], "false positive or path scanned: " + url);
  });
});

await t("a story that names only unknown ids renders no button and does not throw", () => {
  outbound.load(allowlist);
  let html;
  assert.doesNotThrow(() => {
    html = outbound.cardHtml({ id: "story-x", sectionId: "world", openIn: ["not-a-real-target", "also-unknown"] });
  });
  assert.equal(html, "");
  assert.doesNotThrow(() => {
    html = outbound.editorHtml({ id: "story-x", sectionId: "history", openIn: ["missing-desk"] });
  });
  assert.equal(html, "");
  assert.doesNotMatch(html, /<a\b/);
});

await t("loading or rendering the allowlist does not request outbound hosts", async () => {
  const hits = [];
  const hosts = ["civic.example.org", "atlas.example.org"];
  const prev = ctx.fetch;
  ctx.fetch = (url) => {
    hits.push(String(url));
    const u = String(url);
    if (u === "newsdesk/outbound.json" || /\/newsdesk\/outbound\.json$/.test(u)) {
      return Promise.resolve({ ok: true, json: async () => J(allowlist) });
    }
    if (u.startsWith("newsdesk/") || u.startsWith("/newsdesk/")) {
      return Promise.resolve({ ok: false, json: async () => null });
    }
    return Promise.resolve({ ok: false, json: async () => null });
  };
  try {
    assert.equal(typeof ctx.fetch, "function", "fetch stub was not installed");
    assert.equal(ctx.fetch !== prev, true, "fetch stub did not replace the previous fetch");
    await outbound.boot();
    await newsdesk.loadFeed();
    outbound.cardHtml({ id: "story-nd-high-line", sectionId: "local-civic" });
    outbound.editorPickerHtml({ id: "story-x", sectionId: "politics-policy" });
    assert.ok(hits.length, "fetch stub was never called");
    assert.ok(hits.some((u) => /outbound\.json/.test(u)), "allowlist was not fetched through the stub: " + hits.join(", "));
    hosts.forEach((h) => {
      assert.ok(!hits.some((u) => u.includes(h)), "requested " + h + " via " + hits.join(", "));
    });
  } finally {
    if (prev === undefined) delete ctx.fetch;
    else ctx.fetch = prev;
  }
});

await t("explicit nulls, a disabled url, and an empty openIn id are rejected", () => {
  const nulled = J(allowlist);
  nulled.generated = null;
  nulled.note = null;
  nulled.targets[0].credit = null;
  const nullErrs = schema.validateOutbound(nulled);
  assert.ok(nullErrs.some((e) => /generated/.test(e)), nullErrs.join("; "));
  const disabledUrl = J(allowlist);
  const frog = disabledUrl.targets.find((x) => x.id === "sample-pending-desk");
  frog.url = "https://example.com/";
  assert.ok(schema.validateOutbound(disabledUrl).some((e) => /disabled target may not carry a url/.test(e)));
  const ep = J(dc);
  ep.stories[0].openIn = [""];
  assert.ok(schema.validate(ep).some((e) => /openIn/.test(e) && /empty/.test(e)));
  const ws = J(dc);
  ws.stories[0].openIn = ["  "];
  assert.ok(schema.validate(ws).some((e) => /openIn/.test(e) && /empty/.test(e)));
  const sections = J(allowlist);
  sections.targets[0].sectionIds = ["  "];
  assert.ok(schema.validateOutbound(sections).some((e) => /sectionIds/.test(e) && /empty/.test(e)));
  const stories = J(allowlist);
  stories.targets[0].storyIds = [" "];
  assert.ok(schema.validateOutbound(stories).some((e) => /storyIds/.test(e) && /empty/.test(e)));
});

await t("the outbound JSON Schema file matches the js checks for url and enablement", () => {
  const outboundSchema = JSON.parse(fs.readFileSync(path.join(root, "schema/globedesk-outbound.schema.json"), "utf8"));
  assert.deepEqual(validateSchema(outboundSchema, allowlist), []);
  const noUrl = J(allowlist);
  delete noUrl.targets[0].url;
  assert.ok(validateSchema(outboundSchema, noUrl).length, "enabled target without url should fail the schema");
  const disabledUrl = J(allowlist);
  disabledUrl.targets.find((x) => x.id === "sample-pending-desk").url = "https://example.com/";
  assert.ok(validateSchema(outboundSchema, disabledUrl).length, "disabled target with url should fail the schema");
  const noLabel = J(allowlist);
  noLabel.targets[0].label = "";
  assert.ok(validateSchema(outboundSchema, noLabel).length, "empty label should fail the schema");
  const wsLabel = J(allowlist);
  wsLabel.targets[0].label = "  ";
  assert.ok(validateSchema(outboundSchema, wsLabel).length, "whitespace-only label should fail the schema");
  assert.ok(schema.validateOutbound(wsLabel).some((e) => /label missing/.test(e)), "js must reject a whitespace-only label");
  const handle = J(allowlist);
  handle.targets[0].url = "https://civic.example.org/?u=@handle";
  assert.deepEqual(validateSchema(outboundSchema, handle), [], "schema must not reject @handle");
  assert.deepEqual(schema.validateOutbound(handle), [], "js must not reject @handle");
});

await Promise.resolve();
console.log("\n" + n + " tests passed");
