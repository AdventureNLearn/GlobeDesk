// Writes episodes/blank.globedesk.json and episodes/demo-2026-11-20.globedesk.json from js/model.js.
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {}, Date, URL };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "data", "land.js"), "utf8"), ctx);
for (const f of ["themes", "captions", "events-model", "sanitize", "schema", "model"]) vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
const GD = ctx.window.GD;
const out = { "blank.globedesk.json": GD.model.blankEpisode(), "demo-2026-11-20.globedesk.json": GD.model.demoEpisode() };
out["blank.globedesk.json"].date = "YYYY-MM-DD";
// Standalone .geojson copies of the demo's event layers.
fs.mkdirSync(path.join(root, "episodes", "layers"), { recursive: true });
out["demo-2026-11-20.globedesk.json"].eventLayers.forEach((l) => {
  const name = l.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".geojson";
  fs.writeFileSync(path.join(root, "episodes", "layers", name), JSON.stringify(GD.events.toGeoJSON(l), null, 2) + "\n");
  console.log("wrote layers/" + name);
});
for (const [n, ep] of Object.entries(out)) {
  const errs = GD.model.validate(ep);
  if (errs.length) { console.error(n, errs); process.exit(1); }
  fs.writeFileSync(path.join(root, "episodes", n), JSON.stringify(ep, null, 2) + "\n");
  console.log("wrote", n, "stories:", ep.stories.length, "duration:", GD.model.totalDuration(ep) + "s");
}
