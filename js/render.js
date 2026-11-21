/* Pure render / layer-policy helpers for P0 performance. No MapLibre. window.GD.render */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const DEFAULT_PIXEL_RATIO_CAP = 1.5;
  const EOX_BASE_ID = "sat-hybrid";
  const AA_KEY = "globedesk.render.antialias";
  const CAP_KEY = "globedesk.render.pixelRatioCap";

  function usesEoxRaster(baseId) {
    return baseId === EOX_BASE_ID;
  }

  function rastersStacked(baseId, overlays) {
    return !!(usesEoxRaster(baseId) && overlays && overlays.bluemarble);
  }

  function pixelRatio(deviceRatio, cap) {
    const capN = Number(cap);
    const useCap = Number.isFinite(capN) && capN > 0 ? capN : DEFAULT_PIXEL_RATIO_CAP;
    const dev = Number(deviceRatio);
    const useDev = Number.isFinite(dev) && dev > 0 ? dev : 1;
    return Math.min(useDev, useCap);
  }

  function canvasContextAttributes(opts) {
    const o = opts || {};
    return {
      antialias: !!o.antialias,
      preserveDrawingBuffer: !!o.recording
    };
  }

  function policyOnSetOverlay(baseId, overlays, id, on) {
    const ov = Object.assign({}, overlays || {}, { [id]: !!on });
    let nextBase = baseId;
    let toast = "";
    if (id === "bluemarble" && on && usesEoxRaster(baseId)) {
      nextBase = "offline";
      toast = "Switched to the offline globe so Blue Marble isn't stacked with EOX satellite.";
    }
    return { baseId: nextBase, overlays: ov, toast };
  }

  function policyOnSetBase(baseId, overlays) {
    const ov = Object.assign({}, overlays || {});
    let toast = "";
    if (usesEoxRaster(baseId) && ov.bluemarble) {
      ov.bluemarble = false;
      toast = "Blue Marble turned off so it isn't stacked with EOX satellite.";
    }
    return { baseId, overlays: ov, toast };
  }

  function normalizeStartup(baseId, overlays) {
    return policyOnSetBase(baseId, overlays);
  }

  function readAntialias(storage) {
    try {
      const s = storage || (typeof localStorage !== "undefined" ? localStorage : null);
      const v = s && s.getItem(AA_KEY);
      if (v === "1") return true;
      if (v === "0") return false;
    } catch (e) { /* ignore */ }
    return false;
  }

  function readPixelRatioCap(storage) {
    try {
      const s = storage || (typeof localStorage !== "undefined" ? localStorage : null);
      const n = Number(s && s.getItem(CAP_KEY));
      if (Number.isFinite(n) && n > 0) return n;
    } catch (e) { /* ignore */ }
    return DEFAULT_PIXEL_RATIO_CAP;
  }

  function writeAntialias(on, storage) {
    try {
      const s = storage || (typeof localStorage !== "undefined" ? localStorage : null);
      if (s) s.setItem(AA_KEY, on ? "1" : "0");
    } catch (e) { /* ignore */ }
  }

  function writePixelRatioCap(cap, storage) {
    try {
      const s = storage || (typeof localStorage !== "undefined" ? localStorage : null);
      if (s) s.setItem(CAP_KEY, String(cap));
    } catch (e) { /* ignore */ }
  }

  GD.render = {
    DEFAULT_PIXEL_RATIO_CAP, EOX_BASE_ID, AA_KEY, CAP_KEY,
    usesEoxRaster, rastersStacked, pixelRatio, canvasContextAttributes,
    policyOnSetOverlay, policyOnSetBase, normalizeStartup,
    readAntialias, readPixelRatioCap, writeAntialias, writePixelRatioCap
  };
})();
