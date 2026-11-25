// videos.html: the hosted history film, captions, chapters, and CORS attributes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../videos.html", import.meta.url), "utf8");
const MP4 = "https://globedesk-assets.idontwanttodothisshit.com/globedesk/us-history-1775-2026/GlobeDesk-1.4-US-history-1775-2026-share-720p.mp4";
const VTT = "https://globedesk-assets.idontwanttodothisshit.com/globedesk/us-history-1775-2026/GlobeDesk-1.4-US-history-1775-2026.vtt";
const SRT = "https://globedesk-assets.idontwanttodothisshit.com/globedesk/us-history-1775-2026/GlobeDesk-1.4-US-history-1775-2026.srt";
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("the history film uses a 720p MP4 with crossorigin=anonymous", () => {
  assert.match(html, /<video[^>]*\bcrossorigin="anonymous"/);
  assert.match(html, /<video[^>]*\bpreload="metadata"/);
  assert.match(html, /<video[^>]*\bcontrols/);
  assert.ok(html.includes(MP4));
  assert.doesNotMatch(html, /1080p/i);
});
t("captions: a default English track with crossorigin points at the WebVTT, and the page links the SRT", () => {
  assert.match(html, /<track[^>]*\bkind="captions"/);
  assert.match(html, /<track[^>]*\bsrclang="en"/);
  assert.match(html, /<track[^>]*\bdefault\b/);
  assert.match(html, /<track[^>]*\bcrossorigin\b/);
  assert.ok(html.includes(`src="${VTT}"`) || html.includes(`src='${VTT}'`));
  assert.ok(html.includes(SRT));
});
t("chapters from the hosted list are linked, and there is no X video credit", () => {
  for (const label of ["Cold open", "A new nation", "A growing country", "Civil War and Reconstruction",
    "Industry, immigration and empire", "World wars and the Depression", "Cold War, civil rights and space",
    "Our own times", "Close and credits"]) assert.ok(html.includes(label), label);
  assert.doesNotMatch(html, /x\.com\/|twitter\.com\//i);
});

console.log(`${n} videos.html tests ok`);
