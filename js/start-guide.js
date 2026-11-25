/* GlobeDesk start view, short guide and Lite view.
 * First open: a clean globe and a short guide (Welcome, Home, Layers, Help). Skip or Done is
 * remembered in localStorage, so the guide does not come back on its own; Help reopens it.
 * The sample episode is one click away (guide, menu File → Sample) but is never loaded by default.
 * Lite view (?lite=1, or the "Lite view" switch) keeps the globe, Home, Layers, Atlas and Help and
 * hides the editing docks, news desk and export tools; "Full view" brings everything back. */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const GUIDE_KEY = "globedesk.guide.v1";
  const LITE_KEY = "globedesk.lite";
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k) { try { return window.localStorage ? window.localStorage.getItem(k) : null; } catch (e) { return null; } },
    set(k, v) { try { if (window.localStorage) { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } } catch (e) { /* private mode */ } }
  };

  const STEPS = [
    { id: "welcome", title: "Welcome to GlobeDesk", target: null,
      body: "A globe for map-led stories. Drag to move the globe. Pinch or scroll to zoom." },
    { id: "home", title: "Home", target: "btnReset",
      body: "Lost? <strong>Home</strong> brings the globe back to the start view. The H key does the same." },
    { id: "layers", title: "Layers", target: "btnLayers",
      body: "<strong>Layers</strong> turns base maps and overlays on or off." },
    { id: "help", title: "Help", target: "btnHelp",
      body: "<strong>Help</strong> opens this guide again at any time. The sample episode is under Menu → File → Sample." }
  ];

  const st = { step: 0, open: false, steps: STEPS };

  function guideDone() { return store.get(GUIDE_KEY) === "done"; }
  function isLite() { return document.body.classList.contains("lite"); }

  function setLite(on, opts) {
    document.body.classList.toggle("lite", !!on);
    store.set(LITE_KEY, on ? "1" : null);
    const b = $("btnLiteToggle");
    if (b) { b.textContent = on ? "Full view" : "Lite view"; b.setAttribute("aria-pressed", on ? "true" : "false"); b.title = on ? "Show every panel and tool" : "Simple view: globe, Home, Layers, Atlas and Help"; }
    const m = GD.globe && GD.globe.st && GD.globe.st.map;
    if (m && m.resize) { try { m.resize(); } catch (e) { /* ignore */ } }
    if (!(opts && opts.quiet) && GD.ui && GD.ui.toast) GD.ui.toast(on ? "Lite view: the globe and the main buttons. Full view brings every tool back." : "Full view: every panel and tool.");
  }

  function clearTarget() { document.querySelectorAll(".sg-target").forEach((el) => el.classList.remove("sg-target")); }

  function render() {
    const box = $("startGuide");
    if (!box) return;
    const s = st.steps[st.step];
    clearTarget();
    if (s.target && $(s.target)) $(s.target).classList.add("sg-target");
    $("sgCount").textContent = "Step " + (st.step + 1) + " of " + st.steps.length;
    $("sgTitle").textContent = s.title;
    $("sgBody").innerHTML = s.body;
    $("sgLinks").hidden = st.step !== 0;
    $("sgBack").disabled = st.step === 0;
    const last = st.step === st.steps.length - 1;
    $("sgNext").textContent = last ? "Done" : "Next";
    if (s.label) { $("sgLabel").hidden = false; $("sgLabel").textContent = s.label; $("sgLabel").dataset.status = s.label; } else { $("sgLabel").hidden = true; }
  }

  function open(step) {
    const box = $("startGuide");
    if (!box) return;
    st.step = Math.max(0, Math.min(st.steps.length - 1, step || 0));
    st.open = true;
    box.hidden = false;
    const hint = $("layersHint"); if (hint) hint.hidden = true;
    render();
    const n = $("sgNext"); if (n && n.focus) { try { n.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  function close(reason) {
    const box = $("startGuide");
    if (box) box.hidden = true;
    st.open = false;
    clearTarget();
    store.set(GUIDE_KEY, "done");
    // The guide covers the Layers tip, so it is not shown separately afterwards.
    if (GD.layersPanel && GD.layersPanel.dismissHint) GD.layersPanel.dismissHint();
    st.lastClose = reason || "skip";
  }

  function next() { if (st.step >= st.steps.length - 1) close("done"); else { st.step++; render(); } }
  function back() { if (st.step > 0) { st.step--; render(); } }

  function wire() {
    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };
    on("sgNext", next);
    on("sgBack", back);
    on("sgSkip", () => close("skip"));
    on("btnHelp", () => open(0));
    on("btnLiteToggle", () => setLite(!isLite()));
    on("sgSample", () => { close("sample"); const b = $("btnDemo"); if (b) b.click(); });
    on("sgAtlas", () => { close("atlas"); const b = $("btnAtlas"); if (b) b.click(); });
    on("sgLite", () => setLite(!isLite()));
    const box = $("startGuide");
    if (box) box.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close("skip"); } });
  }

  function boot(params) {
    const p = params || new URLSearchParams(location.search);
    const q = p.get("lite");
    const lite = q === "1" || q === "true" || (q == null && store.get(LITE_KEY) === "1");
    setLite(lite, { quiet: true });
    wire();
    // A link that opens a specific episode or view is not a first open for the guide.
    const directLink = ["sample", "import", "archive", "workspace", "callouts", "t"].some((k) => p.get(k));
    if (!guideDone() && !directLink && p.get("guide") !== "0") open(0);
  }

  GD.startGuide = { boot, open, close, next, back, setLite, isLite, guideDone, st, STEPS, GUIDE_KEY, LITE_KEY };
})();
