/* Theme presets. "globedesk" is the default look (SeaGlobe v3.1.4 cinematic
   glass: navy #02040c, ice text, gold, cyan highlight). "newsdesk" is the same
   palette with a lower-third and boxed captions for the consumer view.
   Palette tokens are ported from SeaGlobe web/app.css at tag
   benchmark-v3.1.4-20261115. Credit: SeaGlobe / AdventureNLearn.
   Every value is editable per episode in the Look tab. window.GD.themes */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const DEFAULT = "globedesk";
  const PALETTE = {
    bg: "#02040c",
    ink: "#eaf6ff",
    accent: "#e7c766",
    highlight: "#5ee7ff",
    panel: "rgba(12, 24, 56, 0.42)",
    outroBg: "#02040c"
  };
  const MAP = { base: "sat-hybrid", softBorders: true, highlightGlow: true, countryLabels: "flat-white" };
  const THEMES = {
    globedesk: {
      label: "GlobeDesk (default) — SeaGlobe cinematic glass, holographic cyan, gold chrome",
      theme: "globedesk",
      header: true, headerBadge: "GLOBEDESK", headerHeightPct: 15,
      citations: true,
      captionsOn: true, captionStyle: "shadow", captionSize: "large", captionLines: 2, captionZonePct: 15,
      lowerThird: false, ticker: false, music: false, coldOpen: false,
      shotSec: 8,
      palette: Object.assign({}, PALETTE),
      map: Object.assign({}, MAP),
      safeArea: true
    },
    newsdesk: {
      label: "Newsdesk — lower third, boxed captions, same palette",
      theme: "newsdesk",
      header: false, headerBadge: "NEWSDESK", headerHeightPct: 12,
      citations: true,
      captionsOn: true, captionStyle: "box", captionSize: "medium", captionLines: 2, captionZonePct: 15,
      lowerThird: true, ticker: false, music: false, coldOpen: false,
      shotSec: 10,
      palette: Object.assign({}, PALETTE),
      map: { base: "ofm-dark", softBorders: false, highlightGlow: true, countryLabels: "style" },
      safeArea: true
    }
  };
  const SAFE = {
    "9:16": { top: 0.15, bottom: 0.15, side: 0.06, note: "Header in the top 15%, captions in the bottom 15%; keep cards/citations inside the side margins and clear of platform UI on the right edge." },
    "16:9": { top: 0.12, bottom: 0.15, side: 0.05, note: "Title-safe margins for horizontal video." }
  };
  function lookFor(id) { return JSON.parse(JSON.stringify(THEMES[id] || THEMES[DEFAULT])); }
  function knownTheme(id) { return !!(id && THEMES[id]); }
  GD.themes = { THEMES, SAFE, lookFor, knownTheme, DEFAULT, PALETTE };
})();
