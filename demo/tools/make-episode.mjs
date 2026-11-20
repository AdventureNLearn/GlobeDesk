#!/usr/bin/env node
// Build a valid globedesk.episode/2 practice episode for the same-origin import demo.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(here, "..");
const nested = path.join(demoRoot, "globedesk");
const root = fs.existsSync(path.join(nested, "index.html"))
  ? nested
  : path.resolve(demoRoot, "..");
const out = path.resolve(here, "..", "episodes", "mission.json");
const ctx = { window: {}, Date, console, Uint8Array, ArrayBuffer, TextEncoder, TextDecoder, DataView, URL };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "data", "land.js"), "utf8"), ctx);
for (const f of ["themes", "captions", "events-model", "sanitize", "zip", "schema", "model"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"), ctx);
}
const GD = ctx.window.GD;
const ep = GD.model.blankEpisode();
ep.demo = true;
ep.sample = false;
ep.show = "GlobeDesk Mission";
ep.title = "Desk Online — Mission 01";
ep.date = "2026-11-20";
ep.lede = "A practice episode for the desk. Locations are approximate sample cities. No news claims are made.";
ep.cta = "Build on your own desk.";
ep.handle = "@AdventureNLearn";
ep.outro.handle = "@AdventureNLearn";
ep.outro.line1 = "GlobeDesk by AdventureNLearn";
ep.outro.link = "https://github.com/AdventureNLearn/GlobeDesk";
ep.links = [{ label: "AdventureNLearn", url: "https://x.com/AdventureNLearn" }];

const s = ep.stories[0];
s.title = "Street-level practice";
s.slug = "street-practice";
s.durationSec = 32;
s.location = {
  name: "Midtown Manhattan (sample city, approximate)",
  lat: 40.758,
  lon: -73.9855,
  precision: "approximate",
  verified: false,
  note: "demo city, approximate"
};
s.script = "This is a practice story on the desk. The pin is an approximate city center, not a precise address.";
s.captions = GD.captions.fromScript(s.script, s.durationSec);
s.summary = "Practice pin at an approximate city center. Not a news claim.";
s.credit = "AdventureNLearn";
s.asReported = true;
s.highlight = { a3: "USA", geojson: null };
const c = s.cards[0];
c.title = "Practice card";
c.body = "A topic card on the globe. Facts that are not known stay [UNKNOWN].";
c.why = "Practice only. This is not a news claim.";
c.at = 0;
c.dur = 32;
c.verified = false;
c.facts = [
  { label: "Claim status", value: "Practice card; not a news claim" },
  { label: "Exact site", value: "[UNKNOWN]" },
  { label: "Precision", value: "approximate city center" }
];
s.sources[0].label = "Demo structure";
s.sources[0].status = "unverified";
s.sources[0].note = "Practice episode. No primary news source.";

const layer = GD.events.createLayer("Mission sites (demo)", { color: "#30A1C3", note: "Practice points only. Approximate." });
layer.features.push(GD.events.createFeature("point", { type: "Point", coordinates: [-73.9855, 40.758] }, {
  title: "Midtown practice pin",
  category: "other",
  verification: "not verified",
  notes: "Approximate city center for the mission demo.",
  precisionLabel: "Precision: approximate city center, not an event fix",
  example: true,
  timeApprox: true
}));
ep.eventLayers = [layer];

const errs = GD.schema.validate(ep);
if (errs.length) {
  console.error(errs);
  process.exit(1);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(ep, null, 2) + "\n");
console.log("wrote", out, "ok", errs.length === 0);
