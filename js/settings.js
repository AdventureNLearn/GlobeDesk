/* Optional paid features. All OFF by default. Keys live only in this browser's localStorage
   under "globedesk.optional.*" (legacy "gobedesk.optional.*" keys are still read). Nothing here is ever written into an episode file or the repo. */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const PREFIX = "globedesk.optional.";
  const LEGACY_PREFIX = "gobedesk.optional.";
  const FEATURES = [
    { id: "maptiler", label: "Premium imagery: MapTiler satellite/hybrid base map", wired: true,
      help: "Uses your own MapTiler key. Adds the 'Satellite (MapTiler)' base map in Layers." },
    { id: "tts", label: "Cloud text-to-speech voice for scripts", wired: false,
      help: "Provider request shape is [UNKNOWN] and not wired. Free path today: drop in pre-recorded audio, add a sound overlay, or use the browser's built-in voice (preview only, not captured in recordings)." },
    { id: "ai", label: "AI summarize / suggest topic cards from a script", wired: false,
      help: "Provider request shape is [UNKNOWN] and not wired. Free path today: 'Suggest cards' uses a local, rule-based splitter (no network). Use the Assist tab to paste JSON from any assistant you already have." }
  ];

  const get = (k) => { try { return localStorage.getItem(PREFIX + k) ?? localStorage.getItem(LEGACY_PREFIX + k); } catch (e) { return null; } };
  const set = (k, v) => { try { if (v == null || v === "") localStorage.removeItem(PREFIX + k); else localStorage.setItem(PREFIX + k, v); } catch (e) { /* ignore */ } };

  function enabled(id) { return get(id + ".on") === "1"; }
  function key(id) { return enabled(id) ? get(id + ".key") : null; }

  function render(root) {
    root.innerHTML = "";
    const intro = document.createElement("p");
    intro.className = "muted";
    intro.textContent = "GlobeDesk is fully free by default. These options are off until you turn them on and paste your own key. Keys stay in this browser only (localStorage) and are never saved into episode files.";
    root.appendChild(intro);
    FEATURES.forEach((f) => {
      const box = document.createElement("fieldset");
      box.className = "opt";
      box.innerHTML = `<legend>${f.label}${f.wired ? "" : " <span class=\"pill warn\">stub</span>"}</legend>
        <label class="row"><input type="checkbox" data-opt="${f.id}"> Enable (optional, paid by you)</label>
        <label class="row">Your key <input type="password" autocomplete="off" spellcheck="false" data-key="${f.id}" placeholder="not set"></label>
        <p class="muted small">${f.help}</p>
        <button type="button" class="ghost" data-clear="${f.id}">Forget key</button>`;
      root.appendChild(box);
      const cb = box.querySelector("[data-opt]");
      const kin = box.querySelector("[data-key]");
      cb.checked = enabled(f.id);
      kin.value = get(f.id + ".key") ? "••••••••" : "";
      cb.addEventListener("change", () => set(f.id + ".on", cb.checked ? "1" : null));
      kin.addEventListener("change", () => { if (kin.value && kin.value !== "••••••••") { set(f.id + ".key", kin.value.trim()); kin.value = "••••••••"; } });
      box.querySelector("[data-clear]").addEventListener("click", () => { set(f.id + ".key", null); set(f.id + ".on", null); cb.checked = false; kin.value = ""; });
    });
  }

  GD.settings = { FEATURES, enabled, key, render };
})();
