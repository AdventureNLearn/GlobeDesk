// Unit tests for the record-to-layer maker (globedesk.records/1). No online geocoder, no invented coordinates.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { validateSchema } from "./jsonschema-lite.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { console, window: { GD: {}, GD_REGIONS: {} }, Date, URL, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView };
ctx.window.window = ctx.window;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "data/towns.js"), "utf8"), ctx);
for (const f of ["sanitize", "schema", "events-model", "records", "commands"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
}
const { schema, events, records, commands } = ctx.window.GD;
const J = (v) => JSON.parse(JSON.stringify(v));
assert.deepEqual = ((orig) => (a, b, m) => orig(J(a), J(b), m))(assert.deepEqual);
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

const fixture = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/records.json"), "utf8"));
const newsdeskEp = JSON.parse(fs.readFileSync(path.join(root, "newsdesk/topics/newsdesk-50.globedesk.json"), "utf8"));
const dc = JSON.parse(fs.readFileSync(path.join(root, "episodes/washington-dc-demo.globedesk.json"), "utf8"));
const blank = JSON.parse(fs.readFileSync(path.join(root, "episodes/blank.globedesk.json"), "utf8"));
const chicago = newsdeskEp.stories.find((s) => s.id === "story-nd-chicago-river-reversal");
const recordsSchema = JSON.parse(fs.readFileSync(path.join(root, "schema/globedesk-records.schema.json"), "utf8"));
const officialUrls = new Set((chicago.sources || []).map((s) => s.url).filter(Boolean));
const sampleCite = (url) => /^https:\/\/example\.org\//.test(url);

function withFeed() {
  ctx.window.GD.newsdesk = {
    state: {
      view: "newsdesk",
      feed: {
        episode: J(newsdeskEp),
        topics: (newsdeskEp.stories || []).map((st) => ({ id: st.id, story: st }))
      }
    }
  };
}

function withEpisode(ep) {
  ctx.window.GD.state = { episode: J(ep || { schema: "globedesk.episode/2", stories: [], eventLayers: [] }) };
  if (!ctx.window.GD.state.episode.eventLayers) ctx.window.GD.state.episode.eventLayers = [];
  withFeed();
  return ctx.window.GD.state.episode;
}

await t("episodes without a records sidecar still load", async () => {
  assert.deepEqual(schema.validate(dc), []);
  assert.deepEqual(schema.validate(newsdeskEp), []);
  assert.deepEqual(schema.validate(blank), []);
  assert.equal(JSON.stringify(dc).includes("globedesk.records"), false);
});

await t("the news-desk records fixture validates against the schema", async () => {
  assert.equal(fixture.schema, "globedesk.records/1");
  assert.deepEqual(schema.validateRecords(fixture), []);
  assert.deepEqual(schema.validateRecords(fixture, newsdeskEp), []);
  assert.deepEqual(validateSchema(recordsSchema, fixture), []);
  assert.equal(fixture.catalogs.length, 3);
  const kinds = fixture.catalogs.map((c) => c.kind);
  assert.ok(kinds.includes("event-sequence"));
  assert.equal(kinds.includes("voyage"), false);
  fixture.catalogs.forEach((c) => {
    (c.records || []).forEach((row) => {
      (row.citations || []).forEach((cit) => {
        if (cit.url) {
          assert.ok(sampleCite(cit.url), "citation must be an example.org SAMPLE url: " + cit.url);
          assert.equal(schema.urlCarriesPersonalData(cit.url), false, cit.url);
        }
      });
    });
  });
});

await t("a record with [UNKNOWN] place, or with no coordinates and no gazetteer hit, is off-map and absent from the GeoJSON", async () => {
  withEpisode();
  records.load(J(fixture));
  const listed = records.listed({ recordCatalogId: "records-sample-canal-voyage" });
  assert.ok(listed.onMapIds.includes("rec-sample-canal-chicago"));
  assert.equal(listed.offMapIds.includes("rec-sample-canal-lockport"), false);
  const built = records.buildLayer({ recordCatalogId: "records-sample-canal-voyage" });
  assert.equal(built.ok, true, built.error);
  const layer = ctx.window.GD.state.episode.eventLayers.find((l) => l.id === "evl-sample-canal-voyage");
  assert.ok(layer);
  const ids = layer.features.map((f) => f.id);
  assert.ok(ids.includes("rec-sample-canal-chicago"));
  assert.equal(ids.includes("rec-sample-canal-lockport"), false);
  assert.equal(ids.includes("rec-sample-deepening-stretch"), false);
  const gj = events.toGeoJSON(layer);
  assert.equal(gj.features.some((f) => f.id === "rec-sample-deepening-stretch"), false);
  assert.ok(gj.features.every((f) => f.geometry && f.geometry.type === "Point"));
  const pin = layer.features.find((f) => f.id === "rec-sample-canal-chicago");
  assert.equal(pin.geometry.coordinates[1], 41.832);
  assert.equal(pin.geometry.coordinates[0], -87.752);
  assert.match(pin.properties.precisionLabel, /Natural Earth populated-place point for Chicago, not an event fix/);
  const im = records.buildLayer({ recordCatalogId: "records-sample-deepening" });
  assert.equal(im.ok, true, im.error);
  assert.deepEqual(im.result.onMapIds, []);
  assert.deepEqual(im.result.offMapIds, ["rec-sample-deepening-stretch"]);
});

await t("a record without a real citation cannot become an on-map feature", async () => {
  withEpisode();
  const unknownCit = J(fixture);
  unknownCit.catalogs[0].records[0].citations = [{ label: "[UNKNOWN]" }];
  const unknownErrs = schema.validateRecords(unknownCit, newsdeskEp);
  assert.ok(unknownErrs.some((e) => /placeholder or \[UNKNOWN\]/.test(e)), unknownErrs.join("; "));
  assert.ok(validateSchema(recordsSchema, unknownCit).length, "JSON Schema should reject a [UNKNOWN] citation label");
  unknownCit.catalogs[0].records[0].lat = 41.832;
  unknownCit.catalogs[0].records[0].lon = -87.752;

  const csv = records.parseCsv("title,place,lat,lon,date\nUncited pin,\"Chicago, Illinois\",41.832,-87.752,1900-01-17");
  assert.equal(csv.error, undefined, csv.error);
  assert.equal(csv.records[0].citations.length, 0);
  assert.equal(JSON.stringify(csv).includes("[UNKNOWN]"), false);

  const empty = J(fixture);
  empty.catalogs[0].records[0].citations = [];
  const emptyErrs = schema.validateRecords(empty, newsdeskEp);
  assert.ok(emptyErrs.some((e) => /citations/.test(e)), emptyErrs.join("; "));
  assert.ok(validateSchema(recordsSchema, empty).length, "JSON Schema should reject empty citations");
  empty.catalogs[0].records[0].lat = 41.832;
  empty.catalogs[0].records[0].lon = -87.752;

  records.load(J(fixture));
  const bare = J(records.state.doc);
  bare.catalogs[0].records[0].citations = [];
  bare.catalogs[0].records[0].lat = 41.832;
  bare.catalogs[0].records[0].lon = -87.752;
  records.state.catalogs = bare.catalogs;
  const listed = records.listed({ recordCatalogId: "records-sample-canal-voyage" });
  assert.equal(listed.onMapIds.includes("rec-sample-canal-chicago"), false);
  assert.ok(listed.offMapIds.includes("rec-sample-canal-chicago"));
  const built = records.buildLayer({ recordCatalogId: "records-sample-canal-voyage" });
  assert.equal(built.ok, true, built.error);
  assert.deepEqual(built.result.onMapIds, []);
  assert.ok(built.result.offMapIds.includes("rec-sample-canal-chicago"));
  const layer = ctx.window.GD.state.episode.eventLayers.find((l) => l.id === "evl-sample-canal-voyage");
  assert.ok(layer);
  assert.equal(layer.features.some((f) => f.id === "rec-sample-canal-chicago"), false);
});

await t("rebuilding the event-sequence and case fixtures from official excerpts keeps the same pins and off-map ids", async () => {
  withEpisode();
  records.load(J(fixture));
  const opening = records.buildLayer({ recordCatalogId: "records-sample-canal-voyage" });
  const cases = records.buildLayer({ recordCatalogId: "records-sample-inflow-case" });
  const deepening = records.buildLayer({ recordCatalogId: "records-sample-deepening" });
  assert.equal(opening.ok, true, opening.error);
  assert.equal(cases.ok, true, cases.error);
  assert.equal(deepening.ok, true, deepening.error);
  assert.deepEqual(opening.result.onMapIds, ["rec-sample-canal-chicago"]);
  assert.deepEqual(opening.result.offMapIds, []);
  assert.deepEqual(cases.result.onMapIds, ["rec-sample-inflow-chicago"]);
  assert.deepEqual(cases.result.offMapIds, ["rec-sample-inflow-standpoint"]);
  assert.deepEqual(deepening.result.onMapIds, []);
  assert.deepEqual(deepening.result.offMapIds, ["rec-sample-deepening-stretch"]);
  const again = records.buildLayer({ recordCatalogId: "records-sample-canal-voyage" });
  assert.deepEqual(again.result.onMapIds, opening.result.onMapIds);
  assert.deepEqual(again.result.offMapIds, opening.result.offMapIds);
  const src = fs.readFileSync(path.join(root, "js/records.js"), "utf8") + fs.readFileSync(path.join(root, "newsdesk/records.json"), "utf8");
  assert.equal(/seaglobe|wntr|geocode cache|nominatim/i.test(src), false);
});

await t("event-layer round trip keeps ids and credits", async () => {
  withEpisode();
  records.load(J(fixture));
  const built = records.buildLayer({ recordCatalogId: "records-sample-inflow-case", name: "Initial inflow into the canal (official record)" });
  assert.equal(built.ok, true, built.error);
  const layer = ctx.window.GD.state.episode.eventLayers.find((l) => l.id === "evl-sample-inflow-case");
  const gj = events.toGeoJSON(layer);
  const back = events.fromGeoJSON(J(gj));
  assert.deepEqual(back.layer.features.map((f) => f.id), layer.features.map((f) => f.id));
  assert.equal(back.layer.features[0].properties.citation.credit, layer.features[0].properties.citation.credit);
  assert.equal(back.layer.features[0].properties.citation.license, layer.features[0].properties.citation.license);
  assert.match(back.layer.note || gj.globedesk_layer.note || layer.note, /SAMPLE/);
  assert.equal(gj.globedesk_layer.id, "evl-sample-inflow-case");
});

await t("records.js does not call an online geocoder, and a personal-data scan rejects email, phone, and owner fields", async () => {
  const src = fs.readFileSync(path.join(root, "js/records.js"), "utf8");
  assert.match(src, /No online geocoder/);
  assert.equal(/nominatim|XMLHttpRequest|WebSocket|googleapis\.com\/geocode|mapbox\.com\/geocod/i.test(src), false);
  const email = J(fixture);
  email.catalogs[0].records[0].note = "Write to desk" + String.fromCharCode(64) + "example.com";
  assert.ok(schema.validateRecords(email).some((e) => /email or phone/.test(e)));
  const phone = J(fixture);
  phone.catalogs[0].records[0].place = "Call 312.555.1212 about the lock [UNKNOWN].";
  assert.ok(schema.validateRecords(phone).some((e) => /email or phone/.test(e)));
  const owner = J(fixture);
  owner.catalogs[0].records[0].owner = "A land owner";
  assert.ok(schema.validateRecords(owner).some((e) => /owner, address, phone, email, or valuation/.test(e) || /unknown key/.test(e)));
  const years = J(fixture);
  years.catalogs[0].note = "Official construction-to-opening span 1892-1900.";
  assert.deepEqual(schema.validateRecords(years).filter((e) => /email or phone/.test(e)), []);
});

await t("listRecords returns counts and ids only, and the command API rejects extra keys", async () => {
  withEpisode();
  records.load(J(fixture));
  const listed = await commands.run({ cmd: "listRecords", storyId: "story-nd-chicago-river-reversal" });
  assert.equal(listed.ok, true, listed.error);
  const blob = JSON.stringify(listed.result);
  assert.equal(listed.result.counts.onMap, 2);
  assert.equal(listed.result.counts.offMap, 2);
  assert.ok(listed.result.onMapIds.includes("rec-sample-canal-chicago"));
  assert.ok(listed.result.offMapIds.includes("rec-sample-deepening-stretch"));
  assert.equal(blob.includes("town center"), false);
  assert.equal(blob.includes("Lockport, Illinois"), false);
  const extra = commands.unpack({ cmd: "buildLayer", recordCatalogId: "records-sample-canal-voyage", url: "https://example.com/" });
  assert.match(extra.error, /unknown field/);
  const built = await commands.run({ cmd: "buildLayer", recordCatalogId: "records-sample-canal-voyage" });
  assert.equal(built.ok, true, built.error);
  const framed = await commands.run({ cmd: "frameLayer", id: "evl-sample-canal-voyage" });
  assert.equal(framed.ok, true, framed.error);
  assert.ok(framed.result.camera);
  assert.ok(framed.result.camera.zoom <= 14);
  assert.ok(framed.result.camera.pitch <= 85);
  const missing = commands.unpack({ cmd: "buildLayer" });
  assert.match(missing.error, /recordCatalogId or layerId/);
});

await t("the news-desk strip and research drawer show off-map rows, not hidden pins", async () => {
  function el(tag) {
    const rec = {
      tagName: String(tag || "div").toUpperCase(), nodeType: 1, childNodes: [], parentNode: null,
      className: "", id: "",
      appendChild(c) { if (!c) return c; c.parentNode = this; this.childNodes.push(c); return c; },
      get textContent() { return (this.childNodes || []).map((c) => c.textContent).join(""); },
      set textContent(v) { this.childNodes = []; if (String(v)) this.childNodes.push({ nodeType: 3, textContent: String(v) }); }
    };
    return rec;
  }
  ctx.document = { createElement: (tag) => el(tag), createTextNode: (d) => ({ nodeType: 3, textContent: String(d) }) };
  ctx.window.document = ctx.document;
  withEpisode();
  records.load(J(fixture));
  const before = J(ctx.window.GD.state.episode);
  const parent = el("div");
  records.mountStrip(parent, chicago);
  const text = parent.textContent;
  assert.match(text, /Event layer: SAMPLE canal opening/);
  assert.match(text, /Not on the map/);
  assert.match(text, /SAMPLE deepening stretch/);
  assert.match(text, /\[UNKNOWN\]/);
  assert.match(text, /SAMPLE standpoint/);
  assert.equal(/41\.832/.test(text), false);
  assert.equal(/Canal reach at Lockport/.test(text), false);
  assert.deepEqual(J(ctx.window.GD.state.episode), before);
});


await t("boot leaves a blank project and its autosave unchanged", async () => {
  const ep = withEpisode(blank);
  const before = J(ep);
  const mem = { episode: undefined };
  const scheduled = [];
  ctx.window.GD.store = {
    schedule(e) { scheduled.push("schedule"); mem.episode = J(e); },
    saveEpisode(e) { mem.episode = J(e); return Promise.resolve(); },
    loadEpisode() { return mem.episode === undefined ? undefined : J(mem.episode); },
    _mem: mem
  };
  ctx.window.GD.ui = {
    changed() { if (ctx.window.GD.store) ctx.window.GD.store.schedule(ctx.window.GD.state.episode); }
  };
  await records.boot(() => Promise.resolve(J(fixture)));
  assert.deepEqual(records.state.errors, []);
  assert.ok((records.state.layers || []).length >= 1);
  assert.deepEqual(J(ctx.window.GD.state.episode), before);
  assert.equal(ctx.window.GD.store.loadEpisode(), undefined);
  assert.equal(scheduled.length, 0);
  assert.equal(JSON.stringify(ctx.window.GD.state.episode).includes("evl-sample-canal-voyage"), false);
  assert.equal(JSON.stringify(ctx.window.GD.state.episode).includes("evl-sample-deepening"), false);
});

await t("unknown precision, a [UNKNOWN] place, an ambiguous town, and an unknown story id stay off the map or fail validation", async () => {
  withEpisode();
  assert.equal(records.lookupPlace("Alexandria"), null);
  assert.equal(records.lookupPlace("Springfield"), null);
  assert.ok(records.lookupPlace("Chicago"));
  assert.ok(records.lookupPlace("Alexandria, Virginia") || records.lookupPlace("Alexandria, USA"));
  const doc = J(fixture);
  const row = {
    id: "rec-test-springfield",
    title: "Ambiguous town",
    kind: "event",
    place: "Springfield",
    date: "1900-01-17",
    citations: [{ label: "Illinois DNR history of flood control and drainage", url: "https://dnr.illinois.gov/waterresources/historyoffloodcontroldrainageinnortheasternillinois.html" }],
    confidence: "low",
    reconstruction: false,
    storyId: "story-nd-chicago-river-reversal"
  };
  doc.catalogs[0].records.push(row);
  records.load(doc);
  const listed = records.listed({ recordCatalogId: "records-sample-canal-voyage" });
  assert.ok(listed.offMapIds.includes("rec-test-springfield"));
  const unknownPlace = J(fixture);
  unknownPlace.catalogs[0].records[0].place = "Chicago, Illinois [UNKNOWN]";
  records.load(unknownPlace);
  assert.ok(records.listed({ recordCatalogId: "records-sample-canal-voyage" }).offMapIds.includes("rec-sample-canal-chicago"));
  const unknownPrec = J(fixture);
  unknownPrec.catalogs[0].records[0].precision = "unknown";
  records.load(unknownPrec);
  assert.ok(records.listed({ recordCatalogId: "records-sample-canal-voyage" }).offMapIds.includes("rec-sample-canal-chicago"));
  const badStory = J(fixture);
  badStory.catalogs[0].storyId = "story-does-not-exist";
  const errs = schema.validateRecords(badStory, newsdeskEp);
  assert.ok(errs.some((e) => /existing story/.test(e)), errs.join("; "));
});


await t("a 1421 voyage row with reconstruction false must fail", async () => {
  const doc = J(fixture);
  const row = J(doc.catalogs[0].records[0]);
  row.id = "rec-test-1421-voyage";
  row.kind = "voyage";
  row.date = "1421-03-01";
  row.reconstruction = false;
  doc.catalogs[0].records.push(row);
  const errs = schema.validateRecords(doc, newsdeskEp);
  assert.ok(errs.some((e) => /pre-1500 voyage or event sequence/.test(e)), errs.join("; "));
  const marked = J(doc);
  marked.catalogs[0].records[marked.catalogs[0].records.length - 1].reconstruction = true;
  assert.deepEqual(schema.validateRecords(marked, newsdeskEp), []);
  const caps = J(fixture);
  const capsRow = J(caps.catalogs[0].records[0]);
  capsRow.id = "rec-test-1421-Voyage";
  capsRow.kind = "Voyage";
  capsRow.date = "1421-03-01";
  capsRow.reconstruction = false;
  caps.catalogs[0].records.push(capsRow);
  const capsErrs = schema.validateRecords(caps, newsdeskEp);
  assert.ok(capsErrs.some((e) => /pre-1500 voyage or event sequence/.test(e)), capsErrs.join("; "));
});

console.log("\n" + n + " tests passed");
