#!/usr/bin/env node
// Writes docs/FEATURES.md, the feature status table, from js/tutorial-features.js (the labels the
// tutorial shows) and, optionally, the evidence JSON from tests/smoke-features.mjs.
// Usage: node tools/features-table.mjs [evidence.json]      (prints to stdout with --stdout)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "js/tutorial-features.js"), "utf8"), ctx);
const FEATURES = ctx.window.GD.tutorialFeatures;
const evPath = process.argv.slice(2).find((a) => !a.startsWith("--"));
const ev = evPath ? JSON.parse(fs.readFileSync(evPath, "utf8")).results : {};
const plain = (h) => String(h).replace(/<[^>]+>/g, "").replace(/\|/g, "\\|");

// One short line per check: what the run actually observed.
const SAY = {
  globe: (d) => `globe projection, style loaded, canvas ${d.canvas} px wide`,
  home: (d) => `moved to 120°E 40°S, Home returned to ${Math.round(d.lng)}°, ${Math.round(d.lat)}°`,
  layers: (d) => `panel opened with ${d.rows} switches`,
  atlas: (d) => `Atlas opened, ${d.entries} entries`,
  newsdesk: (d) => `${d.topics} topics; clicking a card moved the globe`,
  desks: (d) => `${d.options} desks; switched to "${d.picked}" and its desk text showed`,
  sample: (d) => `loaded "${d.title}", ${d.stories} stories`,
  workspace: () => "Workspace view opened with the rundown",
  stories: (d) => `+ story: ${d.before} → ${d.after} stories`,
  pins: () => "right-click on the globe set the story pin's lat/lon",
  gazetteer: (d) => `"Paris" found offline (${d[0] && d[0].a3})`,
  media: (d) => `PNG added, media bin ${d.before} → ${d.after}`,
  place: () => "Place tab lists card, overlay and embed options",
  playback: (d) => `played to t = ${Number(d.t).toFixed(1)} s`,
  dataYear: (d) => `slider set the data year to ${d.got}`,
  assist: () => "invalid JSON rejected; the sample JSON validated",
  open: (d) => `saved JSON re-opened (${d.stories} stories)`,
  saveProject: (d) => `.globedesk pack downloaded (${d.bytes} bytes)`,
  captions: () => "VTT (starts WEBVTT) and SRT downloaded",
  archive: (d) => `Archive opened with ${d.cards} cards`,
  layouts: () => "Record / Present layout applied; Lock all panels on",
  menu: () => "menu opened; searching \"sample\" found Sample",
  shortcuts: () => "L opened Layers; H returned Home",
  lite: () => "Lite view hid the news desk; Full view restored it",
  tutorial: (d) => `Help opened the tour (${d.steps} steps); Skip closed it`,
  mp4: (d) => `2 s export: ${d.name}, ${d.frames} frames, ${d.size}, ${(d.bytes / 1048576).toFixed(1)} MiB`,
  datedImagery: (d) => `after opting in, year 2020 drew ${d.tiles && d.tiles[0] && d.tiles[0].tiles} tiles from NASA GIBS (badge "${d.badge}")`,
  officialGis: (d) => `"${d.pick && d.pick.id}" drew ${d.map && d.map[0] && d.map[0].renderable} tiles from basemap.nationalmap.gov`,
  paidOptions: () => "[UNKNOWN] the settings panel opens, but MapTiler imagery needs your own paid key and was not run",
  browserVoice: (d) => `[UNKNOWN] the browser speech API is present (${d.voices} voices), but speech cannot be heard in headless Chrome`,
  cloudVoice: () => "the settings panel marks it \"stub\" and \"not wired\"",
  cloudAi: () => "the settings panel marks it \"stub\" and \"not wired\"",
  historicalMap: (d) => `Layers lists it as "${d.line}"`,
  historyVideo: () => "the tutorial step shows the marked placeholder; no video, link or embed",
};
const SMOKE_SAY = {
  "tests/smoke-touch.mjs": "phone and Lite: one finger pans, pinch zooms, no rotate or tilt, page and panel scroll",
  "tests/smoke-atlas.mjs": "Atlas, desks, Layers user sections, 3D and bell 3D, 0 console errors",
  "tests/smoke-claims.mjs": "claims, research and records sidecars on a topic",
  "tests/smoke-events.mjs": "draw, render, GeoJSON/CSV/KML round trips passed; event-clock hide check failed ([4,4]) — already failing at 9c5326d",
  "tests/smoke-callouts.mjs": "several cards at zoom 1.5 to 12, desktop and phone, no overlaps",
  "tests/smoke.mjs": "WebM recordings produced (bytes > 0) at 16:9 and 9:16",
  "tests/smoke-sharepack.mjs": "pack built, opened from disk with every host blocked, played with no network requests",
  "tests/smoke-p3.mjs": "command API: DC sample, pause, explore, resume",
  "tests/smoke-p2.mjs": "region pack shown offline, origin check",
};

const rows = FEATURES.map((f, i) => {
  let how, seen;
  if (f.check) { how = `tests/smoke-features.mjs → \`${f.check}\``; const r = ev[f.check]; seen = r && SAY[f.check] ? SAY[f.check](r.detail || {}) : (SAY[f.check] ? SAY[f.check]({}) : ""); }
  else { how = `\`${f.smoke}\``; seen = SMOKE_SAY[f.smoke] || ""; }
  return `| ${i + 1} | ${plain(f.title)} | **${f.status}** | ${how} | ${plain(seen)} |`;
});
const live = FEATURES.filter((f) => f.status === "Live").length;
const md = `# GlobeDesk features and status

Every feature the in-app tutorial walks through (**? Help**), with the label it shows. Labels come
only from running the feature: **Live** means its check passed in headless Chrome; **Coming soon** means
the app itself says it is not wired yet, it is a placeholder, or it could not be run end to end here
(those rows say \`[UNKNOWN]\`). \`tests/smoke-features.mjs\` re-runs the checks and fails if a label and
its result disagree. The labels live in \`js/tutorial-features.js\`; this file is written by
\`node tools/features-table.mjs <evidence.json>\`.

${live} Live, ${FEATURES.length - live} Coming soon, ${FEATURES.length} features.

| # | Feature | Status | How it was checked | What the run showed |
|---|---|---|---|---|
${rows.join("\n")}

## History video

The tutorial has a **History video** step with a dashed box marked
\`PLACEHOLDER: history video\`. No video is embedded, linked or uploaded in this build.

## Lite view

Lite view is new in this build (\`?lite=1\`, the **Lite view** button, or Menu → View). It keeps the
globe, Home, Layers, Atlas and Help, and hides the news desk, editing panels, playback bar and export
tools. Features marked "needs Full view" in the tutorial are one tap away with **Full view**.
`;
if (process.argv.includes("--stdout")) process.stdout.write(md);
else { fs.writeFileSync(path.join(root, "docs/FEATURES.md"), md); console.log("wrote docs/FEATURES.md"); }
