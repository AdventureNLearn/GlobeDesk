/* Theme presets. "frog" (Frogpost, pond green) is the default and first in the list.
   "ctd" and "newsdesk" stay as optional looks. Every value is editable per episode
   in the Look tab. window.GD.themes */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const DEFAULT = "frog";
  const THEMES = {
    frog: {
      label: "Frogpost (default) — pond green, header, citation boxes, bold captions, no music",
      theme: "frog",
      header: true, headerBadge: "FROGPOST", headerHeightPct: 15,
      citations: true,
      captionsOn: true, captionStyle: "shadow", captionSize: "large", captionLines: 2, captionZonePct: 15,
      lowerThird: false, ticker: false, music: false, coldOpen: true,
      shotSec: 8,
      palette: { bg: "#0c1610", ink: "#f3f7ef", accent: "#3dbe6a", highlight: "#d6f25c", panel: "rgba(16,42,28,0.78)", outroBg: "#07140c" },
      map: { base: "sat-hybrid", softBorders: true, highlightGlow: true, countryLabels: "flat-white" },
      safeArea: true
    },
    ctd: {
      label: "CTD (optional look) — red header, citation boxes, bold captions, no music",
      theme: "ctd",
      header: true, headerBadge: "NOW COVERING", headerHeightPct: 15,
      citations: true,
      captionsOn: true, captionStyle: "shadow", captionSize: "large", captionLines: 2, captionZonePct: 15,
      lowerThird: false, ticker: false, music: false, coldOpen: true,
      shotSec: 8,
      palette: { bg: "#151618", ink: "#ffffff", accent: "#e0242f", highlight: "#ff8a1f", panel: "rgba(70,72,76,0.62)", outroBg: "#0b1530" },
      map: { base: "sat-hybrid", softBorders: true, highlightGlow: true, countryLabels: "flat-white" },
      safeArea: true
    },
    newsdesk: {
      label: "Newsdesk — lower third, boxed captions",
      theme: "newsdesk",
      header: false, headerBadge: "LIVE", headerHeightPct: 12,
      citations: true,
      captionsOn: true, captionStyle: "box", captionSize: "medium", captionLines: 2, captionZonePct: 15,
      lowerThird: true, ticker: false, music: true, coldOpen: false,
      shotSec: 10,
      palette: { bg: "#04101f", ink: "#ffffff", accent: "#ff3b5c", highlight: "#5ee6ff", panel: "rgba(6,18,38,0.85)", outroBg: "#04101f" },
      map: { base: "ofm-dark", softBorders: false, highlightGlow: true, countryLabels: "style" },
      safeArea: true
    }
  };
  // 9:16 safe zones (fractions of frame height/width) used by the stage guides and the recorder.
  const SAFE = {
    "9:16": { top: 0.15, bottom: 0.15, side: 0.06, note: "Header in the top 15%, captions in the bottom 15%; keep cards/citations inside the side margins and clear of platform UI on the right edge." },
    "16:9": { top: 0.12, bottom: 0.15, side: 0.05, note: "Title-safe margins for horizontal video." }
  };
  function lookFor(id) { return JSON.parse(JSON.stringify(THEMES[id] || THEMES[DEFAULT])); }
  GD.themes = { THEMES, SAFE, lookFor, DEFAULT };
})();
