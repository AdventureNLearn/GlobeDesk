/* Map pointer policy: a plain click or tap only selects; a pin drops on right-click or a long press. */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});

  const LONG_PRESS_MS = 500;
  const MOVE_CANCEL_PX = 10;
  const DBLCLICK_MS = 300;
  const HIT_MIN_PX = 24;
  const PHONE_MQ = "(max-width: 760px)";
  const REDUCE_MQ = "(prefers-reduced-motion: reduce)";

  function isPrimaryClick(ev) {
    if (!ev) return true;
    return ev.button == null || ev.button === 0;
  }

  function pointDist(a, b) {
    const dx = ((a && a.x) || 0) - ((b && b.x) || 0);
    const dy = ((a && a.y) || 0) - ((b && b.y) || 0);
    return Math.hypot(dx, dy);
  }

  function shouldCancelLongPress(start, now) {
    if (!start || !now) return false;
    return pointDist(start, now) > MOVE_CANCEL_PX;
  }

  function reduceMotion() {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    try { return !!window.matchMedia(REDUCE_MQ).matches; } catch (e) { return false; }
  }

  function isPhoneLayout() {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    try { return !!window.matchMedia(PHONE_MQ).matches; } catch (e) { return false; }
  }

  // Pause-explore: picking a pin or card must not seek or wipe viewer edits.
  function shouldSeekOnSelect(state) {
    const S = state || GD.state;
    return !(S && S.paused && !S.playing);
  }

  // ev: { type, button?, pointerType?, detail? }
  // hits: { pin?, eventFeature?, card?, callout? }
  function actionFor(ev, hits) {
    const type = ev && ev.type;
    if (type === "escape" || type === "close") return "clearSelection";
    if (type === "pan" || type === "zoom" || type === "drag" || type === "movestart" || type === "dblclick") return "keep";
    if (type === "contextmenu" || type === "longpress") return "dropPin";
    if (type === "click" || type === "tap") {
      if (!isPrimaryClick(ev)) return "keep";
      if (ev && ev.detail != null && ev.detail > 1) return "keep";
      if (hits && (hits.pin || hits.eventFeature || hits.card || hits.callout)) return "select";
      return "keep";
    }
    return "keep";
  }

  function nextSelection(current, action, hit) {
    if (action === "select") return hit || null;
    if (action === "clearSelection") return null;
    return current || null;
  }

  function getSelection() {
    return (GD.state && GD.state.mapSel) || null;
  }

  function setSelection(sel) {
    if (!GD.state) return sel || null;
    GD.state.mapSel = sel || null;
    return GD.state.mapSel;
  }

  function clearSelection() {
    const prev = getSelection();
    setSelection(null);
    if (GD.eventsMap && GD.eventsMap.em && GD.eventsMap.em.selected) {
      if (GD.eventsMap.select) GD.eventsMap.select(null);
      else GD.eventsMap.em.selected = null;
    }
    if (GD.callouts && GD.callouts.collapse) GD.callouts.collapse();
    else if (GD.callouts && GD.callouts.state) GD.callouts.state.expanded = null;
    try { if (GD.globe && GD.globe.st && GD.globe.st.map) GD.globe.st.map.triggerRepaint(); } catch (e) { /* ignore */ }
    if (GD.eventsMap && GD.eventsMap.refresh) GD.eventsMap.refresh();
    return prev;
  }

  function apply(ev, hits) {
    const action = actionFor(ev, hits);
    if (action === "select") {
      const hit = (hits && (hits.pin || hits.eventFeature || hits.card || hits.callout)) || null;
      setSelection(hit);
    } else if (action === "clearSelection") {
      clearSelection();
    }
    return { action, selection: getSelection() };
  }

  function eventPoint(map, ev) {
    const canvas = map.getCanvas();
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function drawing() {
    return !!(GD.eventsMap && GD.eventsMap.em && GD.eventsMap.em.mode && GD.eventsMap.em.mode !== "select");
  }

  function hitsAt(map, point) {
    const hits = {};
    if (!map || !point) return hits;
    try {
      if (map.getLayer && map.getLayer("gd-pins")) {
        const pins = map.queryRenderedFeatures(point, { layers: ["gd-pins"] });
        if (pins && pins[0]) {
          const idx = Number(pins[0].properties && pins[0].properties.idx);
          const ep = (GD.globe && GD.globe.st && GD.globe.st.episode) || (GD.state && GD.state.episode);
          const s = ep && ep.stories && ep.stories[idx];
          hits.pin = { kind: "pin", id: s ? s.id : String(idx), storyIdx: idx, feature: pins[0] };
        }
      }
      const evLayers = ["ev-pt", "ev-line", "ev-head", "ev-zone-fill"].filter((id) => map.getLayer && map.getLayer(id));
      if (evLayers.length) {
        const ev = map.queryRenderedFeatures(point, { layers: evLayers });
        if (ev && ev[0] && ev[0].properties) {
          hits.eventFeature = { kind: "event", id: ev[0].properties.id, feature: ev[0] };
        }
      }
    } catch (e) { /* style not ready */ }
    return hits;
  }

  function dropStoryPinAt(lngLat, how) {
    const S = GD.state;
    const s = S && S.episode && S.episode.stories[S.storyIdx];
    if (!s || !s.location || !lngLat) return false;
    s.location.lat = Math.round(lngLat.lat * 1e5) / 1e5;
    s.location.lon = Math.round(lngLat.lng * 1e5) / 1e5;
    if (s.location.precision === "unset") s.location.precision = "approximate";
    if (GD.ui && GD.ui.changed) GD.ui.changed();
    const why = how === "longpress" ? "long press" : "right-click";
    if (GD.ui && GD.ui.toast) GD.ui.toast("Pin set to the " + why + " coordinates (no address lookup).");
    return true;
  }

  // Camera commands issued while a pointer is down are queued until release (MapLibre #5197).
  let downCount = 0;
  let queuedCamera = null;

  function pointerIsDown() { return downCount > 0; }

  function notePointerDown(map) {
    downCount++;
    try { if (map && map.stop) map.stop(); } catch (e) { /* ignore */ }
  }

  function notePointerUp() {
    downCount = Math.max(0, downCount - 1);
    if (downCount === 0 && queuedCamera) {
      const fn = queuedCamera;
      queuedCamera = null;
      fn();
    }
  }

  function requestCamera(fn) {
    if (typeof fn !== "function") return { queued: false };
    if (downCount > 0) {
      queuedCamera = fn;
      return { queued: true };
    }
    fn();
    return { queued: false };
  }

  function stopMotion(map) {
    queuedCamera = null;
    try { if (map && map.stop) map.stop(); } catch (e) { /* ignore */ }
  }

  function resetPointerState() {
    downCount = 0;
    queuedCamera = null;
  }

  function applySelectHit(hits, oe) {
    if (hits.pin) {
      if (GD.callouts && oe && (oe.shiftKey || oe.ctrlKey || oe.metaKey)) {
        const id = hits.pin.id;
        if (id) { GD.callouts.toggle(id); if (GD.ui && GD.ui.renderRundown) GD.ui.renderRundown(); }
        return;
      }
      if (GD.ui && GD.ui.selectStory) GD.ui.selectStory(hits.pin.storyIdx, { fly: true, openCard: true });
      return;
    }
    if (hits.eventFeature && GD.eventsMap && GD.eventsMap.select) {
      GD.eventsMap.select(hits.eventFeature.id);
      if (GD.eventsUI && GD.eventsUI.open) GD.eventsUI.open();
    }
  }

  function dispatchClick(map, e) {
    const oe = (e && e.originalEvent) || {};
    if (!isPrimaryClick(oe)) return { action: "keep" };
    if ((oe.detail || 1) > 1) return { action: "keep" };
    if (drawing()) return { action: "draw" };
    const hits = hitsAt(map, e.point);
    const out = apply({ type: "click", button: oe.button, detail: oe.detail || 1 }, hits);
    if (out.action === "select") applySelectHit(hits, oe);
    return out;
  }

  function bind(map) {
    if (!map || map._gdPointerBound) return;
    map._gdPointerBound = true;
    const canvas = map.getCanvas();
    let press = null;
    let suppressClickUntil = 0;
    let pendingClickTimer = null;

    const clearPress = () => {
      if (press && press.timer) clearTimeout(press.timer);
      press = null;
    };

    canvas.addEventListener("pointerdown", (ev) => {
      notePointerDown(map);
      if (drawing()) return;
      if (ev.pointerType === "mouse") return;
      if (ev.button != null && ev.button !== 0) return;
      const pt = eventPoint(map, ev);
      const lngLat = map.unproject([pt.x, pt.y]);
      press = {
        x: pt.x,
        y: pt.y,
        lngLat,
        timer: setTimeout(() => {
          const held = press;
          clearPress();
          suppressClickUntil = Date.now() + 400;
          if (pendingClickTimer) { clearTimeout(pendingClickTimer); pendingClickTimer = null; }
          if (held && held.lngLat) dropStoryPinAt(held.lngLat, "longpress");
        }, LONG_PRESS_MS)
      };
    });
    const trackMove = (ev) => {
      if (!press) return;
      const pt = ev.clientX != null ? eventPoint(map, ev) : ev;
      if (shouldCancelLongPress(press, pt)) clearPress();
    };
    canvas.addEventListener("pointermove", trackMove, { passive: true });
    const endPointer = () => { clearPress(); notePointerUp(); };
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("lostpointercapture", endPointer);
    map.on("dragstart", clearPress);
    map.on("zoomstart", clearPress);
    map.on("rotatestart", clearPress);
    map.on("pitchstart", clearPress);

    canvas.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      if (drawing()) return;
      const pt = eventPoint(map, ev);
      const lngLat = map.unproject([pt.x, pt.y]);
      suppressClickUntil = Date.now() + 400;
      if (pendingClickTimer) { clearTimeout(pendingClickTimer); pendingClickTimer = null; }
      dropStoryPinAt(lngLat, "contextmenu");
    });

    // One click dispatcher: pin or event wins; empty map never drops a pin.
    // A double-click zoom must not also run the click action, so the first
    // click waits DBLCLICK_MS and is cancelled if a second click arrives.
    map.on("click", (e) => {
      if (Date.now() < suppressClickUntil) return;
      const oe = e.originalEvent || {};
      if ((oe.detail || 1) > 1) {
        if (pendingClickTimer) { clearTimeout(pendingClickTimer); pendingClickTimer = null; }
        return;
      }
      if (pendingClickTimer) {
        clearTimeout(pendingClickTimer);
        pendingClickTimer = null;
        return;
      }
      const snapshot = { point: e.point, lngLat: e.lngLat, originalEvent: oe };
      pendingClickTimer = setTimeout(() => {
        pendingClickTimer = null;
        dispatchClick(map, snapshot);
      }, DBLCLICK_MS);
    });
    map.on("dblclick", () => {
      if (pendingClickTimer) { clearTimeout(pendingClickTimer); pendingClickTimer = null; }
    });
  }

  // Touch gestures on every layout (desktop, phone, Lite): one-finger drag pans the globe; a two-finger
  // pinch zooms only, so rotate and tilt never happen by accident. Mouse rotate (right-drag) and the
  // compass are unchanged. Page and panel scrolling work outside the map.
  function applyTouchGestures(map) {
    if (!map) return;
    const call = (h, fn) => { try { if (h && h[fn]) h[fn](); } catch (e) { /* older MapLibre */ } };
    call(map.cooperativeGestures, "disable");
    call(map.dragPan, "enable");
    call(map.touchZoomRotate, "enable");
    call(map.touchZoomRotate, "disableRotation");
    call(map.touchPitch, "disable");
  }

  GD.mapPointer = {
    LONG_PRESS_MS, MOVE_CANCEL_PX, DBLCLICK_MS, HIT_MIN_PX, PHONE_MQ, REDUCE_MQ,
    isPrimaryClick, pointDist, shouldCancelLongPress, reduceMotion, isPhoneLayout,
    shouldSeekOnSelect, actionFor, nextSelection, getSelection, setSelection, clearSelection, apply,
    dropStoryPinAt, bind, eventPoint, hitsAt, dispatchClick,
    pointerIsDown, notePointerDown, notePointerUp, requestCamera, stopMotion, resetPointerState,
    applyTouchGestures
  };
})();
