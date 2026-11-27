/* GlobeDesk shell layout: dockable, resizable, lockable panels; templates; app menu.
   Lily pad palette (owner original) is in css/app.css. No new hosts. */
(function (g) {
  const GD = g.GD || (g.GD = {});
  const STORAGE_KEY = "globedesk.shell.v1";
  const SCALE_MIN = 0.8, SCALE_MAX = 1.4;
  const MIN_STAGE = 280;
  const MIN_DOCK = 160;
  const PANEL_MIN_W = 220, PANEL_MIN_H = 140;
  const HEADER_H = 52;

  const PANEL_DEFS = {
    rundown: { id: "rundownPanel", title: "Rundown" },
    bin: { id: "binPanel", title: "Media bin" },
    inspector: { id: "inspectorPanel", title: "Inspector" },
    readable: { id: "readablePanel", title: "Readable view" },
    transport: { id: "transportBar", title: "Playback" }
  };
  const PANEL_IDS = Object.keys(PANEL_DEFS);
  const TEMPLATE_IDS = ["edit", "present", "research", "compact"];
  const TEMPLATE_LABELS = {
    edit: "Edit (default)",
    present: "Record / Present",
    research: "Research",
    compact: "Compact / laptop"
  };

  let state = defaultState("edit");
  let dragging = null;
  let menuOpen = false;
  let lastFocus = null;
  let booted = false;

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function $(id) { return document.getElementById(id); }

  function panelDefault(id, dock, visible) {
    return { dock: dock, visible: visible !== false, locked: false, scale: 1, x: 80, y: 80, w: 360, h: 420 };
  }

  function defaultState(name) {
    const t = TEMPLATE_IDS.includes(name) ? name : "edit";
    const st = {
      v: 1,
      template: t,
      lockAll: false,
      newsW: 0,
      docks: { left: 270, right: 360, bottom: 0 },
      panels: {
        rundown: panelDefault("rundown", "left", true),
        bin: panelDefault("bin", "left", true),
        inspector: panelDefault("inspector", "right", true),
        readable: panelDefault("readable", "bottom", true),
        transport: panelDefault("transport", "bottom", true)
      }
    };
    applyTemplateDefaults(t, st);
    return st;
  }

  function applyTemplateDefaults(name, st) {
    st.template = name;
    const P = st.panels;
    Object.keys(P).forEach((k) => {
      P[k].locked = false;
      P[k].scale = 1;
      P[k].dock = P[k].dock === "float" ? "float" : P[k].dock;
    });
    if (name === "edit") {
      st.newsW = 0;
      st.docks = { left: 270, right: 360, bottom: 0 };
      P.rundown = Object.assign(P.rundown, { dock: "left", visible: true, scale: 1 });
      P.bin = Object.assign(P.bin, { dock: "left", visible: true, scale: 1 });
      P.inspector = Object.assign(P.inspector, { dock: "right", visible: true, scale: 1 });
      P.readable = Object.assign(P.readable, { dock: "bottom", visible: true, scale: 1 });
      P.transport = Object.assign(P.transport, { dock: "bottom", visible: true, scale: 1 });
    } else if (name === "present") {
      st.newsW = 0;
      st.docks = { left: 0, right: 0, bottom: 0 };
      P.rundown.visible = false;
      P.bin.visible = false;
      P.inspector.visible = false;
      P.readable.visible = false;
      P.transport = Object.assign(P.transport, { dock: "bottom", visible: true, scale: 1 });
    } else if (name === "research") {
      st.newsW = 320;
      st.docks = { left: 0, right: 300, bottom: 0 };
      P.rundown.visible = false;
      P.bin.visible = false;
      P.inspector = Object.assign(P.inspector, { dock: "right", visible: true, scale: 1 });
      P.readable.visible = false;
      P.transport = Object.assign(P.transport, { dock: "bottom", visible: true, scale: 1 });
    } else if (name === "compact") {
      st.newsW = 0;
      st.docks = { left: 200, right: 280, bottom: 0 };
      P.rundown = Object.assign(P.rundown, { dock: "left", visible: true, scale: 0.9 });
      P.bin = Object.assign(P.bin, { dock: "left", visible: true, scale: 0.9 });
      P.inspector = Object.assign(P.inspector, { dock: "right", visible: true, scale: 0.9 });
      P.readable = Object.assign(P.readable, { dock: "bottom", visible: false, scale: 0.9 });
      P.transport = Object.assign(P.transport, { dock: "bottom", visible: true, scale: 1 });
    }
    return st;
  }

  function viewport() {
    const w = (typeof window !== "undefined" && window.innerWidth) || 1024;
    const h = (typeof window !== "undefined" && window.innerHeight) || 768;
    return { vw: w, vh: h };
  }

  function clampState(st, vw, vh) {
    vw = vw || (viewport().vw);
    vh = vh || (viewport().vh);
    const workH = Math.max(200, vh - HEADER_H);
    const news = (st.newsW > 0 && visibleNews(st)) ? st.newsW : 0;
    let left = st.docks.left || 0;
    let right = st.docks.right || 0;
    if (!dockHasVisible(st, "left")) left = 0;
    if (!dockHasVisible(st, "right")) right = 0;
    const budget = Math.max(MIN_STAGE, vw - MIN_STAGE);
    const used = news + left + right;
    if (used > vw - MIN_STAGE) {
      const scale = (vw - MIN_STAGE) / used;
      st.newsW = news ? Math.max(180, Math.floor(news * scale)) : 0;
      left = left ? Math.max(MIN_DOCK, Math.floor(left * scale)) : 0;
      right = right ? Math.max(MIN_DOCK, Math.floor(right * scale)) : 0;
      if (st.newsW + left + right > vw - MIN_STAGE) {
        right = Math.max(0, vw - MIN_STAGE - st.newsW - left);
      }
    }
    st.docks.left = left;
    st.docks.right = right;
    PANEL_IDS.forEach((id) => {
      const p = st.panels[id];
      p.scale = clamp(Number(p.scale) || 1, SCALE_MIN, SCALE_MAX);
      if (p.dock === "float") {
        const minW = id === "transport" ? 200 : PANEL_MIN_W;
        const minH = id === "transport" ? 52 : PANEL_MIN_H;
        p.w = clamp(p.w || 360, minW, Math.max(minW, vw - 16));
        p.h = clamp(p.h || (id === "transport" ? minH : 420), minH, Math.max(minH, workH - 8));
        p.x = clamp(p.x || 80, 0, Math.max(0, vw - p.w));
        p.y = clamp(p.y || 80, HEADER_H, Math.max(HEADER_H, vh - p.h));
      }
    });
    return st;
  }

  function visibleNews(st) {
    return st.template === "research" || st.newsW > 0 && st.template === "research";
  }

  function dockHasVisible(st, dock) {
    return PANEL_IDS.some((id) => st.panels[id].visible && st.panels[id].dock === dock);
  }

  function canDrag(id, st) {
    st = st || state;
    const p = st.panels[id];
    return !!(p && p.visible && !st.lockAll && !p.locked);
  }
  function canResize(id, st) {
    return canDrag(id, st);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState("edit");
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1 || !parsed.panels) return defaultState("edit");
      const st = defaultState(TEMPLATE_IDS.includes(parsed.template) ? parsed.template : "edit");
      st.lockAll = !!parsed.lockAll;
      if (parsed.docks) {
        st.docks.left = Number(parsed.docks.left) || 0;
        st.docks.right = Number(parsed.docks.right) || 0;
        st.docks.bottom = Number(parsed.docks.bottom) || 0;
      }
      if (typeof parsed.newsW === "number") st.newsW = parsed.newsW;
      PANEL_IDS.forEach((id) => {
        const src = parsed.panels[id];
        if (!src) return;
        const p = st.panels[id];
        if (["left", "right", "bottom", "float"].includes(src.dock)) p.dock = src.dock;
        p.visible = src.visible !== false;
        p.locked = !!src.locked;
        p.scale = clamp(Number(src.scale) || 1, SCALE_MIN, SCALE_MAX);
        p.x = Number(src.x) || p.x;
        p.y = Number(src.y) || p.y;
        p.w = Number(src.w) || p.w;
        p.h = Number(src.h) || p.h;
      });
      // The playback bar is a docked control strip. A saved float would cover
      // the Readable view and the Inspector; always put it back on the bottom dock.
      if (st.panels.transport) st.panels.transport.dock = dockAfterMove("transport", st.panels.transport.dock);
      return clampState(st, viewport().vw, viewport().vh);
    } catch (e) {
      return defaultState("edit");
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  function syncChrome() {
    const body = document.body;
    if (!body) return;
    TEMPLATE_IDS.forEach((t) => body.classList.toggle("shell-" + t, state.template === t));
    body.classList.toggle("shell-show-newsdesk", state.template === "research" && body.classList.contains("view-workspace"));
    body.classList.toggle("shell-lock-all", !!state.lockAll);
    body.classList.toggle("gd-layout-dragging", !!dragging);
    const { vw, vh } = viewport();
    clampState(state, vw, vh);
    const news = (state.template === "research") ? (state.newsW || 380) : 0;
    const left = dockHasVisible(state, "left") ? state.docks.left : 0;
    const right = dockHasVisible(state, "right") ? state.docks.right : 0;
    body.style.setProperty("--gd-news-w", (news || 0) + "px");
    body.style.setProperty("--gd-dock-left", (left || 0) + "px");
    body.style.setProperty("--gd-dock-right", (right || 0) + "px");
    const dl = $("dockLeft"), dr = $("dockRight"), db = $("dockBottom"), nd = $("newsdesk");
    if (dl) { dl.classList.toggle("is-collapsed", left <= 0); dl.classList.toggle("is-narrow", left > 0 && left < 300); dl.style.width = left ? left + "px" : ""; }
    if (dr) { dr.classList.toggle("is-collapsed", right <= 0); dr.classList.toggle("is-narrow", right > 0 && right < 300); dr.style.width = right ? right + "px" : ""; }
    if (db) db.classList.toggle("is-collapsed", !dockHasVisible(state, "bottom"));
    if (nd) nd.classList.toggle("is-research", state.template === "research");
    const floatLayer = $("floatLayer");
    PANEL_IDS.forEach((id) => {
      const def = PANEL_DEFS[id];
      const p = state.panels[id];
      const el = $(def.id);
      if (!el) return;
      el.classList.toggle("is-hidden-panel", !p.visible);
      el.hidden = !p.visible;
      el.classList.toggle("is-floating", p.visible && p.dock === "float");
      el.classList.toggle("is-locked", !!(state.lockAll || p.locked));
      el.style.setProperty("--gd-panel-scale", String(p.scale || 1));
      const parent = p.dock === "float" && p.visible && floatLayer ? floatLayer
        : p.dock === "left" ? $("dockLeft")
        : p.dock === "right" ? $("dockRight")
        : $("dockBottom");
      if (parent && el.parentElement !== parent) parent.appendChild(el);
      if (p.dock === "float" && p.visible) {
        el.style.left = p.x + "px";
        el.style.top = p.y + "px";
        el.style.width = p.w + "px";
        el.style.height = p.h + "px";
      } else {
        el.style.left = el.style.top = el.style.width = el.style.height = "";
      }
      const lockBtn = el.querySelector(".gd-panel-lock");
      if (lockBtn) {
        const locked = !!(state.lockAll || p.locked);
        lockBtn.setAttribute("aria-pressed", locked ? "true" : "false");
        lockBtn.title = locked ? "Unlock panel" : "Lock panel";
        lockBtn.textContent = locked ? "Locked" : "Lock";
        lockBtn.disabled = !!state.lockAll && !p.locked ? false : false;
      }
      const scaleEl = el.querySelector(".gd-panel-scale");
      if (scaleEl && Number(scaleEl.value) !== p.scale) scaleEl.value = String(p.scale);
      const scaleBtn = el.querySelector(".gd-panel-scale-btn");
      if (scaleBtn) {
        scaleBtn.textContent = Math.round((p.scale || 1) * 100) + "%";
        scaleBtn.disabled = !!(state.lockAll || p.locked);
      }
    });
    // Map control gutters: only needed when a float overlaps the stage's right/top edge.
    let gutterR = 8, gutterT = 0;
    const stage = $("stage") || $("map");
    if (stage) {
      const sr = stage.getBoundingClientRect();
      PANEL_IDS.forEach((id) => {
        const p = state.panels[id];
        if (!p.visible || p.dock !== "float") return;
        const el = $(PANEL_DEFS[id].id);
        if (!el) return;
        const r = el.getBoundingClientRect();
        const overlaps = !(r.right < sr.left || r.left > sr.right || r.bottom < sr.top || r.top > sr.bottom);
        if (!overlaps) return;
        const fromRight = sr.right - r.left;
        if (r.right > sr.right - 80 && fromRight > 0) gutterR = Math.max(gutterR, Math.min(fromRight + 8, sr.width * 0.5));
        if (r.top < sr.top + 80 && r.bottom > sr.top) gutterT = Math.max(gutterT, Math.min(r.bottom - sr.top + 8, 200));
      });
    }
    body.style.setProperty("--gd-map-gutter-right", gutterR + "px");
    body.style.setProperty("--gd-map-gutter-top", gutterT + "px");
    refreshMenuChecks();
  }

  function resizeStage() {
    const go = () => {
      const applyAspect = GD.ui && GD.ui.applyAspect;
      const aspect = (GD.state && GD.state.episode && GD.state.episode.output && GD.state.episode.output.aspect) || "16:9";
      if (applyAspect) applyAspect(aspect);
      else if (GD.globe && GD.globe.st && GD.globe.st.map) {
        try { GD.globe.st.map.resize(); } catch (e) { /* */ }
      }
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => requestAnimationFrame(go));
    else go();
  }

  function apply() {
    syncChrome();
    saveState();
    resizeStage();
  }

  function closeScalePops(except) {
    document.querySelectorAll(".gd-panel-scale-pop").forEach((pop) => {
      if (pop === except) return;
      pop.hidden = true;
    });
    document.querySelectorAll(".gd-panel-scale-btn").forEach((b) => {
      const pop = b.parentElement && b.parentElement.querySelector(".gd-panel-scale-pop");
      b.setAttribute("aria-expanded", pop && pop === except && !pop.hidden ? "true" : "false");
    });
  }

  function chromeBits(id, def) {
    const grip = document.createElement("span");
    grip.className = "gd-panel-grip";
    grip.setAttribute("aria-hidden", "true");
    const zoom = document.createElement("div");
    zoom.className = "gd-panel-zoom";
    const scaleBtn = document.createElement("button");
    scaleBtn.type = "button";
    scaleBtn.className = "gd-panel-scale-btn mini";
    scaleBtn.setAttribute("aria-expanded", "false");
    scaleBtn.setAttribute("aria-haspopup", "true");
    scaleBtn.title = "Panel scale";
    scaleBtn.setAttribute("aria-label", "Panel scale for " + def.title);
    scaleBtn.textContent = "100%";
    const pop = document.createElement("div");
    pop.className = "gd-panel-scale-pop";
    pop.hidden = true;
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Panel scale for " + def.title);
    pop.innerHTML = '<label class="gd-panel-scale-label"><span class="visually-hidden">Panel scale</span>' +
      '<input class="gd-panel-scale" type="range" min="0.8" max="1.4" step="0.05" value="1" aria-label="Panel scale for ' + def.title + '">' +
      '<span class="gd-panel-scale-val">100%</span></label>';
    zoom.appendChild(scaleBtn);
    zoom.appendChild(pop);
    const lock = document.createElement("button");
    lock.type = "button";
    lock.className = "gd-panel-lock mini";
    lock.setAttribute("aria-pressed", "false");
    lock.textContent = "Lock";
    const scale = pop.querySelector(".gd-panel-scale");
    const val = pop.querySelector(".gd-panel-scale-val");
    const syncScaleLabel = () => {
      const pct = Math.round((state.panels[id].scale || 1) * 100) + "%";
      scaleBtn.textContent = pct;
      if (val) val.textContent = pct;
    };
    scale.addEventListener("pointerdown", (e) => e.stopPropagation());
    scale.addEventListener("click", (e) => e.stopPropagation());
    scale.addEventListener("input", () => {
      if (state.lockAll || state.panels[id].locked) { scale.value = String(state.panels[id].scale); return; }
      state.panels[id].scale = clamp(Number(scale.value) || 1, SCALE_MIN, SCALE_MAX);
      syncScaleLabel();
      apply();
    });
    scaleBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    scaleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.lockAll || state.panels[id].locked) return;
      const open = pop.hidden;
      closeScalePops(open ? pop : null);
      pop.hidden = !open;
      scaleBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { syncScaleLabel(); scale.focus(); }
    });
    pop.addEventListener("pointerdown", (e) => e.stopPropagation());
    lock.addEventListener("pointerdown", (e) => e.stopPropagation());
    lock.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.lockAll) return;
      state.panels[id].locked = !state.panels[id].locked;
      if (state.panels[id].locked) { pop.hidden = true; scaleBtn.setAttribute("aria-expanded", "false"); }
      apply();
    });
    return { grip, zoom, lock };
  }

  function ensureChrome(id) {
    const def = PANEL_DEFS[id];
    const el = $(def.id);
    if (!el) return;
    if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", def.title);
    if (el.querySelector(".gd-panel-head") || el.querySelector(":scope > h2.gd-panel-h2") || el.querySelector(":scope > .gd-panel-grip")) return;
    const existingH2 = el.querySelector(":scope > h2");
    const bits = chromeBits(id, def);
    let dragEl;
    if (existingH2) {
      existingH2.classList.add("gd-panel-h2");
      existingH2.insertBefore(bits.grip, existingH2.firstChild);
      existingH2.appendChild(bits.lock);
      existingH2.appendChild(bits.zoom);
      dragEl = existingH2;
    } else {
      const head = document.createElement("div");
      head.className = "gd-panel-head";
      const title = document.createElement("span");
      title.className = "gd-panel-title";
      title.textContent = def.title;
      head.appendChild(bits.grip);
      head.appendChild(title);
      head.appendChild(bits.lock);
      head.appendChild(bits.zoom);
      el.insertBefore(head, el.firstChild);
      dragEl = head;
    }
    dragEl.addEventListener("pointerdown", (e) => onHeadPointerDown(id, e));
    if (id !== "transport") {
      const rz = document.createElement("div");
      rz.className = "gd-float-resizer";
      rz.dataset.resizePanel = id;
      rz.setAttribute("aria-label", "Resize " + def.title);
      el.appendChild(rz);
      rz.addEventListener("pointerdown", (e) => onFloatResizeDown(id, e));
    }
  }

  function onHeadPointerDown(id, e) {
    if (e.button !== 0) return;
    if (e.target.closest("button, input, label, select, a, .fold")) return;
    if (!canDrag(id)) return;
    e.preventDefault();
    e.stopPropagation();
    const p = state.panels[id];
    const el = $(PANEL_DEFS[id].id);
    const r = el.getBoundingClientRect();
    dragging = {
      kind: "move", id: id,
      dx: e.clientX - r.left, dy: e.clientY - r.top,
      startDock: p.dock
    };
    // Lift to float while dragging so the panel follows the pointer.
    if (p.dock !== "float") {
      p.dock = "float";
      p.x = r.left;
      p.y = r.top;
      const minW = id === "transport" ? 200 : PANEL_MIN_W;
      const minH = id === "transport" ? 52 : PANEL_MIN_H;
      p.w = Math.max(minW, r.width);
      p.h = Math.max(minH, r.height);
    }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    document.body.classList.add("gd-layout-dragging");
    apply();
  }

  function dockAfterMove(id, zone) {
    // Playback is a control bar. Leaving it floating covers the Readable view
    // and the Inspector; snap it back to the bottom dock.
    if (id === "transport" && zone === "float") return "bottom";
    return zone;
  }

  function dockZoneAt(x, y) {

    const dl = $("dockLeft"), dr = $("dockRight"), db = $("dockBottom"), desk = $("desk");
    const hit = (el, pad) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
    };
    if (hit(dl, 28) && !dl.classList.contains("is-collapsed")) return "left";
    if (hit(dr, 28) && !dr.classList.contains("is-collapsed")) return "right";
    if (hit(db, 28)) return "bottom";
    // Empty collapsed docks: snap to edges of the desk.
    if (desk) {
      const r = desk.getBoundingClientRect();
      if (x < r.left + 72) return "left";
      if (x > r.right - 72) return "right";
      if (y > r.bottom - 72) return "bottom";
    }
    return "float";
  }

  function onPointerMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const p = state.panels[dragging.id];
    if (dragging.kind === "move") {
      p.dock = "float";
      p.x = e.clientX - dragging.dx;
      p.y = e.clientY - dragging.dy;
      clampState(state, viewport().vw, viewport().vh);
      syncChrome();
    } else if (dragging.kind === "dock") {
      const { vw } = viewport();
      if (dragging.edge === "left") {
        state.docks.left = clamp(e.clientX - dragging.base, MIN_DOCK, vw - MIN_STAGE - (state.docks.right || 0) - (state.newsW || 0));
      } else if (dragging.edge === "right") {
        const desk = $("desk").getBoundingClientRect();
        state.docks.right = clamp(desk.right - e.clientX, MIN_DOCK, vw - MIN_STAGE - (state.docks.left || 0) - (state.newsW || 0));
      }
      clampState(state, viewport().vw, viewport().vh);
      syncChrome();
    } else if (dragging.kind === "float-resize") {
      p.w = clamp(e.clientX - p.x, PANEL_MIN_W, viewport().vw - 8);
      p.h = clamp(e.clientY - p.y, PANEL_MIN_H, viewport().vh - 8);
      clampState(state, viewport().vw, viewport().vh);
      syncChrome();
    }
  }

  function onPointerUp(e) {
    if (!dragging) return;
    if (dragging.kind === "move") {
      const zone = dockAfterMove(dragging.id, dockZoneAt(e.clientX, e.clientY));
      const p = state.panels[dragging.id];
      if (zone !== "float") {
        p.dock = zone;
        if (zone === "left" && state.docks.left < MIN_DOCK) state.docks.left = state.template === "compact" ? 200 : 270;
        if (zone === "right" && state.docks.right < MIN_DOCK) state.docks.right = state.template === "compact" ? 280 : 360;
      }
    }
    dragging = null;
    document.body.classList.remove("gd-layout-dragging");
    apply();
  }

  function onDockResizeDown(edge, e) {
    if (e.button !== 0) return;
    if (state.lockAll) return;
    // A dock is locked if every visible panel in it is locked.
    const ids = PANEL_IDS.filter((id) => state.panels[id].visible && state.panels[id].dock === (edge === "bottom" ? "bottom" : edge));
    if (ids.length && ids.every((id) => state.panels[id].locked)) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = { kind: "dock", edge: edge, base: (edge === "left") ? ($("dockLeft").getBoundingClientRect().left) : 0 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    document.body.classList.add("gd-layout-dragging");
  }

  function onFloatResizeDown(id, e) {
    if (e.button !== 0) return;
    if (!canResize(id)) return;
    e.preventDefault();
    e.stopPropagation();
    const p = state.panels[id];
    if (p.dock !== "float") return;
    dragging = { kind: "float-resize", id: id };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    document.body.classList.add("gd-layout-dragging");
  }

  function applyTemplate(name) {
    if (!TEMPLATE_IDS.includes(name)) return;
    const lockAll = state.lockAll;
    state = defaultState(name);
    state.lockAll = lockAll;
    if (name === "research" || name === "edit" || name === "compact" || name === "present") {
      const applyView = (GD.newsdesk && GD.newsdesk.applyView) || (GD.ui && GD.ui.applyView);
      if (applyView) {
        try { applyView("workspace"); } catch (e) {
          document.body.classList.add("view-workspace");
          document.body.classList.remove("view-newsdesk");
        }
      } else {
        document.body.classList.add("view-workspace");
        document.body.classList.remove("view-newsdesk");
      }
    }
    apply();
  }

  function reset() {
    const t = state.template || "edit";
    const lockAll = state.lockAll;
    state = defaultState(t);
    state.lockAll = lockAll;
    apply();
  }

  function setLockAll(on) {
    state.lockAll = !!on;
    apply();
  }
  function setPanelLock(id, on) {
    if (!state.panels[id]) return;
    state.panels[id].locked = !!on;
    apply();
  }
  function setPanelScale(id, n) {
    if (!state.panels[id] || state.lockAll || state.panels[id].locked) return;
    state.panels[id].scale = clamp(Number(n) || 1, SCALE_MIN, SCALE_MAX);
    apply();
  }
  function setPanelVisible(id, on) {
    if (!state.panels[id]) return;
    state.panels[id].visible = !!on;
    apply();
  }

  /* ---------- App menu ---------- */
  const MENU = [
    { group: "File", items: [
      { id: "file-new", label: "New blank", shortcut: "", run: () => clickId("btnNew") },
      { id: "file-open", label: "Open…", shortcut: "", run: () => { const i = $("fileOpen"); if (i) i.click(); } },
      { id: "file-save-json", label: "Save JSON", shortcut: "", run: () => clickId("btnSave") },
      { id: "file-save-project", label: "Save project", shortcut: "", run: () => clickId("btnSaveProject") },
      { id: "file-archive", label: "Archive", shortcut: "", run: () => clickId("btnArchive") },
      { id: "file-sample", label: "Sample", shortcut: "", run: () => clickId("btnDemo") },
      { id: "file-export-catalog", label: "Export my layout/settings", shortcut: "", run: () => GD.catalog && GD.catalog.exportSettings && GD.catalog.exportSettings() },
      { id: "file-import-catalog", label: "Import my layout/settings", shortcut: "", run: () => GD.catalog && GD.catalog.importSettings && GD.catalog.importSettings() }
    ]},
    { group: "View", items: [
      { id: "view-edit", label: "Layout: Edit (default)", kind: "template", template: "edit", run: () => applyTemplate("edit") },
      { id: "view-present", label: "Layout: Record / Present", kind: "template", template: "present", run: () => applyTemplate("present") },
      { id: "view-research", label: "Layout: Research", kind: "template", template: "research", run: () => applyTemplate("research") },
      { id: "view-compact", label: "Layout: Compact / laptop", kind: "template", template: "compact", run: () => applyTemplate("compact") },
      { id: "view-lock-all", label: "Lock all panels", kind: "toggle", run: () => setLockAll(!state.lockAll) },
      { id: "view-reset", label: "Reset layout", run: () => reset() },
      { id: "view-reset-globe", label: "Home (reset globe)", shortcut: "H", run: () => GD.resetView && GD.resetView() },
      { id: "view-workspace", label: "Workspace / News desk", run: () => clickId("btnViewToggle") },
      { id: "view-atlas", label: "Atlas", run: () => clickId("btnAtlas") },
      { id: "view-aspect-169", label: "Output 16:9", run: () => clickId("asp169") },
      { id: "view-aspect-916", label: "Output 9:16", run: () => clickId("asp916") },
      { id: "view-lite", label: "Lite view / Full view", run: () => GD.startGuide && GD.startGuide.setLite(!GD.startGuide.isLite()) },
      { id: "view-layers", label: "Layers (turn map layers on or off)", shortcut: "L", run: () => GD.layersPanel && GD.layersPanel.open() },
      { id: "vis-rundown", label: "Show Rundown", kind: "visibility", panel: "rundown", run: () => setPanelVisible("rundown", !state.panels.rundown.visible) },
      { id: "vis-bin", label: "Show Media bin", kind: "visibility", panel: "bin", run: () => setPanelVisible("bin", !state.panels.bin.visible) },
      { id: "vis-inspector", label: "Show Inspector", kind: "visibility", panel: "inspector", run: () => setPanelVisible("inspector", !state.panels.inspector.visible) },
      { id: "vis-readable", label: "Show Readable view", kind: "visibility", panel: "readable", run: () => setPanelVisible("readable", !state.panels.readable.visible) },
      { id: "vis-transport", label: "Show Playback bar", kind: "visibility", panel: "transport", run: () => setPanelVisible("transport", !state.panels.transport.visible) }
    ]},
    { group: "Export", items: [
      { id: "ex-vtt", label: "Export VTT", run: () => clickId("btnVtt") },
      { id: "ex-srt", label: "Export SRT", run: () => clickId("btnSrt") },
      { id: "ex-mp4", label: "Export MP4 / share pack…", run: () => GD.sharePack && GD.sharePack.open() },
      { id: "ex-webm", label: "Record WebM", run: () => clickId("btnRecord") }
    ]},
    { group: "Help", items: [
      { id: "help-start-guide", label: "Start guide (step by step)", run: () => GD.startGuide && GD.startGuide.open(0) },
      { id: "help-guide", label: "Guide", run: () => openHelp("guide") },
      { id: "help-shortcuts", label: "Keyboard shortcuts", run: () => openHelp("shortcuts") },
      { id: "help-version", label: "Version", run: () => openHelp("version") },
      { id: "help-about", label: "About · Contribute · Fork it", run: () => openHelp("about") },
      { id: "help-contribute", label: "Contribute (GitHub)", run: () => openRepoPage("contribute") },
      { id: "help-fork", label: "Fork it (GitHub)", run: () => openRepoPage("fork") }
    ]}
  ];

  function clickId(id) {
    const el = $(id);
    if (el) el.click();
  }

  function menuItemsFlat() {
    const out = [];
    MENU.forEach((g) => g.items.forEach((it) => out.push(Object.assign({ group: g.group }, it))));
    return out;
  }

  function renderMenu(filter) {
    const body = $("appMenuBody");
    if (!body) return;
    const q = String(filter || "").trim().toLowerCase();
    body.innerHTML = "";
    MENU.forEach((g) => {
      const items = g.items.filter((it) => !q || (g.group + " " + it.label).toLowerCase().includes(q));
      if (!items.length) return;
      const sec = document.createElement("section");
      sec.className = "app-menu-group";
      const h = document.createElement("h3");
      h.textContent = g.group;
      sec.appendChild(h);
      items.forEach((it) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "app-menu-item";
        b.dataset.id = it.id;
        b.setAttribute("role", "option");
        let extra = "";
        if (it.kind === "template") extra = state.template === it.template ? " ✓" : "";
        if (it.kind === "toggle" && it.id === "view-lock-all") extra = state.lockAll ? " ✓" : "";
        if (it.kind === "visibility") extra = state.panels[it.panel].visible ? " ✓" : "";
        b.textContent = it.label + extra;
        b.addEventListener("click", () => {
          closeMenu();
          it.run();
        });
        sec.appendChild(b);
      });
      body.appendChild(sec);
    });
    if (!body.childElementCount) {
      const p = document.createElement("p");
      p.className = "muted small";
      p.textContent = "No matching items.";
      body.appendChild(p);
    }
  }

  function refreshMenuChecks() {
    if (!menuOpen) return;
    const search = $("appMenuSearch");
    renderMenu(search ? search.value : "");
  }

  function menuFocusables() {
    const dlg = $("appMenu");
    if (!dlg) return [];
    return Array.from(dlg.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.disabled && el.offsetParent !== null || el === $("appMenuSearch") || el === $("appMenuClose"));
  }

  function onMenuKey(e) {
    if (!menuOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      return;
    }
    if (e.key !== "Tab") return;
    const list = menuFocusables();
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openMenu() {
    const dlg = $("appMenu");
    const btn = $("btnMenu");
    if (!dlg) return;
    lastFocus = document.activeElement;
    menuOpen = true;
    renderMenu("");
    if (dlg.showModal) { if (!dlg.open) dlg.showModal(); }
    else dlg.setAttribute("open", "");
    if (btn) { btn.setAttribute("aria-expanded", "true"); }
    const search = $("appMenuSearch");
    if (search) { search.value = ""; search.focus(); }
    document.addEventListener("keydown", onMenuKey, true);
  }

  function closeMenu() {
    const dlg = $("appMenu");
    const btn = $("btnMenu");
    menuOpen = false;
    if (dlg) {
      if (dlg.open && dlg.close) dlg.close();
      else dlg.removeAttribute("open");
    }
    if (btn) btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onMenuKey, true);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* */ } }
    lastFocus = null;
  }

  function toggleMenu() {
    if (menuOpen) closeMenu(); else openMenu();
  }

  // Civic Intelligence Project links. Repo confirmed from git remote and SECURITY.md. Plain https links;
  // the CSP is unchanged because opening a page in a new tab is navigation, not a fetch.
  const REPO = "https://github.com/AdventureNLearn/GlobeDesk";
  const REPO_PAGES = {
    contribute: REPO + "/blob/HEAD/CONTRIBUTING.md",
    fork: REPO + "/blob/HEAD/FORKING.md",
    forkNow: REPO + "/fork",
    license: REPO + "/blob/HEAD/LICENSE",
    conduct: REPO + "/blob/HEAD/CODE_OF_CONDUCT.md",
    security: REPO + "/security/policy",
    issues: REPO + "/issues"
  };
  function openRepoPage(key) {
    const url = REPO_PAGES[key];
    if (!url) return;
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (w) w.opener = null;
  }

  function openHelp(kind) {
    const dlg = $("helpDialog");
    const body = $("helpDialogBody");
    if (!dlg || !body) return;
    const ver = (GD.version && (GD.version.label || (GD.version.number + (GD.version.suffix ? " · " + GD.version.suffix : "")))) || ($("appVersion") && $("appVersion").textContent) || "v1.5.1 · Atlas";
    const link = (key, label) => "<a href='" + escapeHtml(REPO_PAGES[key]) + "' target='_blank' rel='noopener noreferrer'>" + escapeHtml(label) + "</a>";
    if (kind === "about") {
      body.innerHTML = "<p><strong>GlobeDesk</strong> · " + escapeHtml(ver) + " · by @AdventureNLearn</p>" +
        "<p>A <strong>Civic Intelligence Project</strong>: free, open source and local-first. Code is MIT; AdventureNLearn's content is CC BY 4.0.</p>" +
        "<ul class='help-links'>" +
        "<li>" + link("contribute", "Contribute") + " · add civic data layers, public-record sources, fixes, translations or docs</li>" +
        "<li>" + link("fork", "Fork it") + " · branch off for your own newsroom, classroom or city (" + link("forkNow", "fork on GitHub") + ")</li>" +
        "<li>" + link("license", "License") + " · " + link("conduct", "Code of Conduct") + " · " + link("security", "Security") + " · " + link("issues", "Issues") + "</li>" +
        "</ul><p class='muted small'>These open GitHub in a new tab. Nothing from your desk is sent.</p>";
    } else if (kind === "version") {
      body.innerHTML = "<p><strong>" + escapeHtml(ver) + "</strong></p><p class='muted small'>Lily pad palette (owner original). Local-first. Official GIS is off until you turn it on.</p><p class='small'>Open source: " + link("contribute", "Contribute") + " · " + link("fork", "Fork it") + "</p>";
    } else if (kind === "shortcuts") {
      body.innerHTML = "<ul class='help-keys'>" +
        "<li><kbd>Alt</kbd>+<kbd>M</kbd> Open or close the menu</li>" +
        "<li><kbd>Esc</kbd> Close the menu or a dialog</li>" +
        "<li><kbd>H</kbd> Reset to the default globe</li>" +
        "<li><kbd>L</kbd> Open or close the Layers panel</li>" +
        "<li>Click the map to select. Pin a place with a right-click or a long press (~500 ms). Pan and zoom never drop a pin.</li>" +
        "<li>Drag a panel by its header to dock or float it. Locked panels stay put. Resize from the dock edge or the float corner.</li>" +
        "</ul>";
    } else {
      body.innerHTML = "<p>GlobeDesk is a local-first desk for map-led stories. Use the menu for File, layout templates, panel lock, and export.</p>" +
        "<p><strong>Layers</strong> (toolbar, or <kbd>L</kbd>) lists every base map and overlay with an on/off switch, a short description and a legend. <strong>Export</strong> saves a frame-accurate MP4 (16:9 or 9:16) or an offline share pack.</p>" +
        "<p>The <strong>Edit</strong> layout is the default workspace. <strong>Record / Present</strong> gives the stage room. <strong>Research</strong> brings the news desk (claims, research, records) forward. <strong>Compact / laptop</strong> narrows the docks for a smaller window.</p>" +
        "<p>GlobeDesk is open source. Menu → Help → <strong>About · Contribute · Fork it</strong>.</p>" +
        "<p class='muted small'>The longer guide is USER-GUIDE.md in the app folder, served at <a href='USER-GUIDE.md'>USER-GUIDE.md</a> on this same origin.</p>";
    }
    if (dlg.showModal) { if (!dlg.open) dlg.showModal(); }
    else dlg.setAttribute("open", "");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function onGlobalKey(e) {
    if (e.altKey && (e.key === "m" || e.key === "M") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      toggleMenu();
    }
  }

  function onResize() {
    clampState(state, viewport().vw, viewport().vh);
    syncChrome();
    saveState();
    resizeStage();
  }

  function boot() {
    if (booted) return;
    booted = true;
    state = loadState();
    PANEL_IDS.forEach(ensureChrome);
    const btn = $("btnMenu");
    if (btn) btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); toggleMenu(); });
    const close = $("appMenuClose");
    if (close) close.addEventListener("click", () => closeMenu());
    const search = $("appMenuSearch");
    if (search) search.addEventListener("input", () => renderMenu(search.value));
    const dlg = $("appMenu");
    if (dlg) dlg.addEventListener("cancel", (e) => { e.preventDefault(); closeMenu(); });
    document.querySelectorAll(".dock-resizer").forEach((el) => {
      el.addEventListener("pointerdown", (e) => onDockResizeDown(el.getAttribute("data-resize"), e));
    });
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onGlobalKey);
    document.addEventListener("pointerdown", (e) => {
      if (e.target && e.target.closest && e.target.closest(".gd-panel-zoom")) return;
      closeScalePops(null);
    });
    const onScaleEsc = (e) => {
      if (e.key === "Escape" && document.querySelector(".gd-panel-scale-pop:not([hidden])")) {
        closeScalePops(null);
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", onScaleEsc, true);
    apply();
    renderMenu("");
  }

  GD.layout = {
    STORAGE_KEY: STORAGE_KEY,
    TEMPLATES: TEMPLATE_IDS,
    TEMPLATE_LABELS: TEMPLATE_LABELS,
    defaultState: defaultState,
    clampState: clampState,
    canDrag: canDrag,
    canResize: canResize,
    applyTemplate: applyTemplate,
    dockAfterMove: dockAfterMove,
    reset: reset,
    setLockAll: setLockAll,
    setPanelLock: setPanelLock,
    setPanelScale: setPanelScale,
    setPanelVisible: setPanelVisible,
    loadState: loadState,
    saveState: saveState,
    boot: boot,
    openMenu: openMenu,
    closeMenu: closeMenu,
    toggleMenu: toggleMenu,
    state: function () { return state; },
    apply: apply,
    resizeStage: resizeStage
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
