// Unit tests for the Event Layers model (js/events-model.js). No browser, no network.
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path"; import assert from "node:assert/strict"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, Date }; vm.createContext(ctx);
for (const f of ["themes", "captions", "events-model", "frog-rundown", "model", "archive"]) vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
const { events: E, model, archive } = ctx.window.GD;
const J = (v) => JSON.parse(JSON.stringify(v));
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const POST = "https://x.com/TheCriticalDri1/status/2123762612571886024";

t("archived CTD layers use only its story locations and each story's own source; example is marked", () => {
  const ep = archive.ctdEpisode();
  assert.equal(ep.eventLayers.length, 2);
  const [demo, ex] = ep.eventLayers;
  assert.equal(demo.features.length, 3);
  ep.stories.forEach((s, i) => {
    const f = demo.features[i];
    assert.deepEqual(J(f.geometry.coordinates), [s.location.lon, s.location.lat]);
    assert.equal(f.properties.verification, "not verified");
    assert.match(f.properties.notes, /^sample, not verified/);
    assert.deepEqual(J(f.properties.sources.map((x) => x.url)), [POST]);
    assert.equal(f.properties.storyId, s.id);
  });
  assert.ok(ex.features.every((f) => f.properties.example && f.properties.sources.length === 0 && /\[UNKNOWN\]/.test(f.properties.notes)));
  assert.deepEqual(J(model.validate(ep)), []);
});
t("strict validation: kinds, verification, https, verified-needs-source, coords, ring radius", () => {
  const ok = E.createFeature("point", { type: "Point", coordinates: [30, 50] });
  assert.deepEqual(J(E.validateFeature(ok)), []);
  const bad = E.createFeature("line", { type: "Point", coordinates: [300, 50] }, { verification: "maybe", sources: [{ url: "http://x" }], eventTime: "yesterday" });
  const errs = E.validateFeature(bad).join("|");
  ["verification", "https", "eventTime", "LineString"].forEach((k) => assert.ok(errs.includes(k), k));
  assert.ok(E.validateFeature(E.createFeature("point", { type: "Point", coordinates: [0, 0] }, { verification: "verified" })).join().includes("source"));
  assert.ok(E.validateFeature(E.createFeature("ring", { type: "Point", coordinates: [0, 0] }, { radiusKm: 0 })).join().includes("radius"));
  assert.ok(E.validateFeature(E.createFeature("polygon", { type: "Polygon", coordinates: [[[0, 0], [1, 0], [0, 0]]] })).join().includes("polygon"));
});
t("time: ISO parse, reveal by clock, route progress", () => {
  assert.equal(E.parseTime("2026-11-20"), Date.UTC(2026, 10, 20));
  assert.equal(E.parseTime("2026-11-20T14:30"), Date.UTC(2026, 10, 20, 14, 30));
  assert.equal(E.parseTime("2026-11-20T14:30+02:00"), Date.UTC(2026, 10, 20, 12, 30));
  assert.equal(E.parseTime("nope"), null);
  const f = E.createFeature("line", { type: "LineString", coordinates: [[0, 0], [10, 0]] }, { eventTime: "2026-11-20T10:00", eventEnd: "2026-11-20T12:00" });
  assert.equal(E.visibleAt(f, Date.UTC(2026, 10, 20, 9)), false);
  assert.equal(E.visibleAt(f, null), true);
  assert.equal(E.progressAt(f, Date.UTC(2026, 10, 20, 11)), 0.5);
  assert.equal(E.progressAt(f, Date.UTC(2026, 10, 20, 13)), 1);
  assert.equal(E.timeLabel(f.properties), "≈ 2026-11-20 10:00 → 2026-11-20 12:00");
});
t("geometry: ring polygon radius, lineAt midpoint, bbox", () => {
  const r = E.ringPolygon(56.25, 26.57, 25, 32).coordinates[0];
  assert.equal(r.length, 33); assert.deepEqual(J(r[0]), J(r[32]));
  r.forEach((c) => assert.ok(Math.abs(E.km([56.25, 26.57], c) - 25) < 0.05));
  const m = E.lineAt([[0, 0], [2, 0]], 0.5); assert.ok(Math.abs(m.head[0] - 1) < 1e-9);
  const b = E.bbox([E.createFeature("point", { type: "Point", coordinates: [1, 2] }), E.createFeature("line", { type: "LineString", coordinates: [[-3, 5], [4, -1]] })]);
  assert.deepEqual(J(b), [-3, -1, 4, 5]);
});
t("GeoJSON round trip keeps layer meta and properties; bad features are skipped, not guessed", () => {
  const l = E.createLayer("Test", { color: "#123456", icon: "★" });
  l.features.push(E.createFeature("ring", { type: "Point", coordinates: [30.5, 50.4] }, { title: "R", radiusKm: 5, category: "strike", sources: [{ label: "S", url: "https://example.org" }] }));
  const back = E.fromGeoJSON(J(E.toGeoJSON(l)));
  assert.equal(back.layer.name, "Test"); assert.equal(back.layer.icon, "★");
  assert.equal(back.layer.features[0].properties.radiusKm, 5);
  assert.equal(back.layer.features[0].properties.category, "strike");
  const mixed = E.fromGeoJSON({ type: "FeatureCollection", features: [
    { type: "Feature", geometry: { type: "MultiPoint", coordinates: [[0, 0]] }, properties: {} },
    { type: "Feature", geometry: { type: "Point", coordinates: [999, 0] }, properties: {} },
    { type: "Feature", geometry: null, properties: { title: "No place" } }] });
  assert.equal(mixed.skipped.length, 2);
  assert.equal(mixed.layer.features.length, 1); assert.equal(mixed.layer.features[0].geometry, null);
});
t("CSV: export → import round trip; blank lat/lon stays off-map; needs lat/lon columns", () => {
  const l = E.createLayer("C");
  l.features.push(E.createFeature("point", { type: "Point", coordinates: [46.68, 24.71] }, { title: 'Quote "x", y', eventTime: "2026-11-20", category: "missile" }));
  const back = E.fromCSV(E.toCSV(l), "C");
  assert.equal(back.layer.features[0].properties.title, 'Quote "x", y');
  assert.deepEqual(J(back.layer.features[0].geometry.coordinates), [46.68, 24.71]);
  const off = E.fromCSV("title,lat,lon\nSomewhere,,\n", "x");
  assert.equal(off.layer.features[0].geometry, null);
  assert.throws(() => E.fromCSV("a,b\n1,2\n"), /lat and lon/);
});
t("KML export → import round trip (point, line, ring→polygon)", () => {
  const l = E.createLayer("K & co");
  l.features.push(E.createFeature("point", { type: "Point", coordinates: [1, 2] }, { title: "P<1>", eventTime: "2026-11-20" }));
  l.features.push(E.createFeature("line", { type: "LineString", coordinates: [[1, 2], [3, 4]] }, { title: "L" }));
  l.features.push(E.createFeature("ring", { type: "Point", coordinates: [5, 6] }, { title: "R", radiusKm: 3 }));
  const back = E.fromKML(E.toKML(l), "k");
  assert.equal(back.layer.name, "K & co");
  assert.deepEqual(J(back.layer.features.map((f) => f.geometry.type)), ["Point", "LineString", "Polygon"]);
  assert.equal(back.layer.features[0].properties.title, "P<1>");
  assert.equal(back.layer.features[0].properties.eventTime, "2026-11-20");
});
t("episode validate reports bad event features", () => {
  const ep = model.blankEpisode();
  const l = E.createLayer("x"); l.features.push(E.createFeature("point", { type: "Point", coordinates: [0, 0] }, { category: "nope" }));
  ep.eventLayers = [l];
  assert.ok(model.validate(ep).some((m) => /category/.test(m)));
});
console.log(`\n${n} passed`);
