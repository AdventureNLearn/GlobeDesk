// Writes the bundled episode files from code:
//   episodes/blank.globedesk.json            blank (Frogpost look)
//   episodes/frogpost-2026-11-20.globedesk.json   default show (Frogpost)
// and standalone .geojson copies of the Frogpost event layers in episodes/layers/,
// plus the take-away starter kit files: starter/episode-template.globedesk.json and
// starter/layer-template.geojson (placeholders only, no real places or people).
// episodes/demo-2026-11-20.globedesk.json is the archived CTD show. It is frozen (never
// regenerated or deleted); js/archive.js rebuilds the same show in the app.
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, Date, URL };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "data", "land.js"), "utf8"), ctx);
for (const f of ["themes", "captions", "events-model", "sanitize", "schema", "frog-rundown", "model", "archive"]) vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
const GD = ctx.window.GD;
const out = {
  "blank.globedesk.json": GD.model.blankEpisode(),
  "frogpost-2026-11-20.globedesk.json": GD.model.demoEpisode()
};
out["blank.globedesk.json"].date = "YYYY-MM-DD";
fs.mkdirSync(path.join(root, "episodes", "layers"), { recursive: true });
out["frogpost-2026-11-20.globedesk.json"].eventLayers.forEach((l) => {
  const name = "frogpost-" + l.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".geojson";
  fs.writeFileSync(path.join(root, "episodes", "layers", name), JSON.stringify(GD.events.toGeoJSON(l), null, 2) + "\n");
  console.log("wrote layers/" + name);
});
for (const [n, ep] of Object.entries(out)) {
  const errs = GD.model.validate(ep);
  if (errs.length) { console.error(n, errs); process.exit(1); }
  fs.writeFileSync(path.join(root, "episodes", n), JSON.stringify(ep, null, 2) + "\n");
  console.log("wrote", n, "stories:", ep.stories.length, "duration:", GD.model.totalDuration(ep) + "s");
}

// ---------- Starter kit (placeholders only) ----------
{
  const ep = GD.model.blankEpisode();
  ep.show = "My Show"; ep.title = "[UNKNOWN] episode title"; ep.date = "YYYY-MM-DD";
  ep.handle = "@your_handle"; ep.lede = "[UNKNOWN] one-line summary of this episode.";
  ep.cta = "[UNKNOWN] call to action, e.g. Follow @your_handle.";
  ep.links = [];
  ep.look = GD.themes.lookFor("newsdesk"); ep.look.headerBadge = "MY SHOW";
  Object.assign(ep.outro, { line1: "[UNKNOWN] closing line", link: "https://example.com/", handle: "@your_handle" });
  const st = ep.stories[0];
  st.title = "[UNKNOWN] story headline"; st.summary = "[UNKNOWN] what happened, as reported.";
  st.credit = ""; st.creditUrl = "";
  const errs = GD.model.validate(ep);
  if (errs.length) { console.error("starter episode", errs); process.exit(1); }
  fs.mkdirSync(path.join(root, "starter"), { recursive: true });
  fs.writeFileSync(path.join(root, "starter", "episode-template.globedesk.json"), JSON.stringify(ep, null, 2) + "\n");
  console.log("wrote starter/episode-template.globedesk.json");
  const E = GD.events;
  const layer = E.createLayer("My layer (placeholders, not real data)");
  const common = { verification: "not verified", notes: "Placeholder shape near 0°, 0° in the open ocean. Replace it.", example: true };
  layer.features.push(E.createFeature("point", { type: "Point", coordinates: [1.0, 1.0] }, Object.assign({ title: "PLACEHOLDER point", category: "other" }, common)));
  layer.features.push(E.createFeature("line", { type: "LineString", coordinates: [[-2.0, -1.0], [2.0, 1.5]] }, Object.assign({ title: "PLACEHOLDER route", category: "convoy" }, common)));
  layer.features.push(E.createFeature("polygon", { type: "Polygon", coordinates: [[[-1.5, -1.5], [1.5, -1.5], [1.5, 0.5], [-1.5, 0.5], [-1.5, -1.5]]] }, Object.assign({ title: "PLACEHOLDER area", category: "other" }, common)));
  layer.features.push(E.createFeature("ring", { type: "Point", coordinates: [-1.0, 2.0] }, Object.assign({ title: "PLACEHOLDER ring", radiusKm: 50 }, common)));
  const lerrs = E.validateLayers([layer]);
  if (lerrs.length) { console.error("starter layer", lerrs); process.exit(1); }
  fs.writeFileSync(path.join(root, "starter", "layer-template.geojson"), JSON.stringify(E.toGeoJSON(layer), null, 2) + "\n");
  console.log("wrote starter/layer-template.geojson");
}
