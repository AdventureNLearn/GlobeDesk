/* Atlas 3D viewer. Lazy-loads the vendored three.js r158 (MIT, unmodified, vendor/three-0.158.0.min.js)
   only when the user picks 3D, then draws the parametric layout from js/atlas/models/*.js
   (a model with its own build(THREE, layout), like bell.js, draws itself).
   Same origin only; nothing is fetched from the internet. If WebGL or the script is unavailable,
   the view stays a labelled stub. window.GD.atlas3d */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const SRC = "vendor/three-0.158.0.min.js";
  let loading = null;
  let view = null; // { renderer, scene, camera, raf, el, onDown, onMove, onUp }

  function loadThree() {
    if (global.THREE) return Promise.resolve(global.THREE);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const s = global.document.createElement("script");
      s.src = SRC; s.async = true;
      s.onload = () => (global.THREE ? resolve(global.THREE) : reject(new Error("three.js did not load")));
      s.onerror = () => { loading = null; reject(new Error("three.js is not available in this copy")); };
      global.document.head.appendChild(s);
    });
    return loading;
  }

  function dispose() {
    if (!view) return;
    try { global.cancelAnimationFrame(view.raf); } catch (e) { /* ignore */ }
    try { view.el.removeEventListener("pointerdown", view.onDown); global.removeEventListener("pointermove", view.onMove); global.removeEventListener("pointerup", view.onUp); } catch (e) { /* ignore */ }
    try { view.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); view.renderer.dispose(); } catch (e) { /* ignore */ }
    try { view.renderer.domElement.remove(); } catch (e) { /* ignore */ }
    view = null;
  }

  // Build a scene from a layout (mm). Boxes and cylinders only; an artistic layout, not a build drawing.
  function build(THREE, L) {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    const cellMat = new THREE.MeshStandardMaterial({ color: 0x5ee7ff, metalness: 0.2, roughness: 0.5 });
    (L.cells || []).forEach((c) => {
      const g = new THREE.CylinderGeometry(c.d / 2, c.d / 2, c.h, 24);
      const m = new THREE.Mesh(g, cellMat);
      m.position.set(c.x - L.inner.w / 2, c.h / 2 + 4, c.y - L.inner.d / 2);
      group.add(m);
    });
    const boxGeo = new THREE.BoxGeometry(L.box.w, L.box.h, L.box.d);
    const box = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xe7c766, transparent: true, opacity: 0.18, depthWrite: false }));
    box.position.set(0, L.box.h / 2, 0);
    group.add(box);
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), new THREE.LineBasicMaterial({ color: 0xe7c766 })).translateY(L.box.h / 2));
    scene.add(group);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(200, 300, 200); scene.add(sun);
    return { scene, group, size: Math.max(L.box.w, L.box.d, L.box.h) };
  }

  function show(el, modelId, param) {
    dispose();
    const models = global.GD_ATLAS_MODELS || {};
    const mod = models[modelId];
    if (!mod) { el.classList.add("stub"); el.textContent = "3D model not bundled [UNKNOWN]."; return Promise.resolve({ ok: false, reason: "model not bundled" }); }
    el.classList.remove("stub");
    el.textContent = "Loading 3D view…";
    return loadThree().then((THREE) => {
      const L = mod.layout(param);
      const w = Math.max(200, el.clientWidth || 360), h = Math.max(160, el.clientHeight || 240);
      let renderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { throw new Error("WebGL is not available"); }
      renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
      renderer.setSize(w, h);
      el.textContent = "";
      el.appendChild(renderer.domElement);
      const built = typeof mod.build === "function" ? mod.build(THREE, L) : build(THREE, L); // a model may bring its own builder (bell.js)
      const { scene, group, size } = built;
      const camera = new THREE.PerspectiveCamera(40, w / h, 1, size * 20);
      camera.position.set(size * 1.4, size * 1.1, size * 1.6);
      camera.lookAt(0, built.lookAtY != null ? built.lookAtY : L.box.h / 3, 0);
      let yaw = 0.6, drag = null;
      const onDown = (e) => { drag = e.clientX; };
      const onMove = (e) => { if (drag != null) { yaw += (e.clientX - drag) * 0.01; drag = e.clientX; } };
      const onUp = () => { drag = null; };
      renderer.domElement.addEventListener("pointerdown", onDown);
      global.addEventListener("pointermove", onMove);
      global.addEventListener("pointerup", onUp);
      view = { renderer, scene, camera, raf: 0, el: renderer.domElement, onDown, onMove, onUp };
      const reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const tick = () => {
        if (!view) return;
        if (!reduce && drag == null) yaw += 0.004;
        group.rotation.y = yaw;
        renderer.render(scene, camera);
        view.raf = global.requestAnimationFrame(tick);
      };
      tick();
      el.setAttribute("data-3d", "ok");
      el.setAttribute("data-model", modelId);
      return { ok: true, model: modelId, cells: L.cells ? L.cells.length : 0, layout: L };
    }).catch((err) => {
      el.classList.add("stub");
      el.setAttribute("data-3d", "stub");
      el.textContent = "3D view unavailable (" + err.message + "). Parts and sizes are in the tabs below.";
      return { ok: false, reason: err.message };
    });
  }

  GD.atlas3d = { show, dispose, loadThree, SRC, isOpen: () => !!view };
})(typeof window !== "undefined" ? window : globalThis);
