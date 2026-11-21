// Writes the bundled episode files from code:
//   episodes/blank.globedesk.json            blank (Frogpost look)
//   episodes/frogpost-2026-11-20.globedesk.json   default show (50 stories)
// and standalone .geojson copies of the Frogpost event layers in episodes/layers/.
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
