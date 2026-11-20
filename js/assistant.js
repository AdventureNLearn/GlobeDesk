/* "Use your assistant" panel: copy a ready prompt + schema, paste JSON, validate, import.
   Default voice is the free browser speechSynthesis. Optional paid keys stay off. window.GD.assistant */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});

  function promptText() {
    return [
      "You are helping me write a GlobeDesk story project.",
      "Return ONLY valid JSON for schema globedesk.episode/2 (a GlobeDesk episode).",
      "Rules:",
      "- Do not invent facts, quotes, dates, or sources. Use [UNKNOWN] when something is not known.",
      "- Every source URL must be https. Credit other people’s work.",
      "- Set asReported to true unless the user has independently verified the claim.",
      "- Locations may be approximate. Do not invent a precise street address.",
      "- Do not include API keys, personal data, or file bytes. Media is referenced by mediaBin slots only.",
      "- User content placements (content[]) must not describe changes to the base map style or tiles.",
      "Read the schema summary below and fill a complete episode object."
    ].join("\n");
  }

  function schemaSummary() {
    return [
      "schema: \"globedesk.episode/2\"",
      "title, date, show, lede, handle, stories[]",
      "story: title, summary, date, credit, creditUrl (https), asReported (boolean), durationSec,",
      "  location { name, lat, lon, precision, verified, note, look? {lat,lon,name,note} },",
      "  script, captions[{start,end,text}], cards[], sources[{label,url,status,note}],",
      "  camera[] (presets orbit|dive|street|cinematic|close|overview),",
      "  audioOverlays[{id,mediaRef,volume,offset,loop,at,dur}],",
      "  content[{id,kind:card|pin-popup|overlay|geo-panel|embed,mediaRef,embedUrl,credit,title,caption,visible,at,dur,order,pin,overlay}],",
      "eventLayers[] (points, lines, polygons; GeoJSON-compatible), mediaBin[{ref,name,kind}] (descriptors only)."
    ].join("\n");
  }

  function readyPrompt() {
    return promptText() + "\n\n--- schema ---\n" + schemaSummary();
  }

  function importJson(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, errors: ["Not valid JSON: " + (e.message || e)] }; }
    if (data && data.schema === GD.schema.PROJECT && data.episode) data = data.episode;
    const errs = (GD.schema && GD.schema.validate) ? GD.schema.validate(data) : GD.model.validate(data);
    if (errs.length) return { ok: false, errors: errs };
    return { ok: true, episode: data };
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return false;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(String(text || "")));
    return true;
  }

  function maxJson() {
    return (GD.schema && GD.schema.LIMITS && GD.schema.LIMITS.projectJson) || (8 * 1024 * 1024);
  }

  // Pure URL check used by importSameOrigin and by unit tests.
  function safeImportUrl(path, baseHref) {
    if (typeof path !== "string" || !path) return { ok: false, errors: ["Missing path."] };
    let u, origin;
    try {
      u = new URL(path, baseHref);
      origin = new URL(baseHref).origin;
    } catch (e) {
      return { ok: false, errors: ["Invalid import URL."] };
    }
    if (origin === "null" || u.origin === "null") return { ok: false, errors: ["Import is not available from this origin."] };
    if (u.origin !== origin) return { ok: false, errors: ["Only same-origin paths are allowed."] };
    if (u.username || u.password) return { ok: false, errors: ["Invalid import URL."] };
    // Reject encoded slashes, backslashes and dots before any server-side decode.
    const raw = String(path) + " " + (u.pathname || "") + " " + (u.href || "");
    if (/%2f|%5c|%2e/i.test(raw)) return { ok: false, errors: ["Invalid import path."] };
    let pathname = u.pathname || "";
    let decoded = pathname;
    try { decoded = decodeURIComponent(pathname); } catch (e) { /* keep */ }
    if (decoded.indexOf("\\") >= 0 || /[\u0000-\u001F]/.test(decoded)) {
      return { ok: false, errors: ["Invalid import path."] };
    }
    // u.pathname already has . and .. resolved. Require a file under /episodes/.
    if (!pathname.startsWith("/episodes/") || pathname === "/episodes/") {
      return { ok: false, errors: ["Only /episodes/ files can be fetched."] };
    }
    if (!/\.json$/i.test(pathname)) return { ok: false, errors: ["Only .json episode files can be fetched."] };
    return { ok: true, url: u };
  }

  // Re-check a completed fetch URL (defense if a redirect was followed).
  function acceptFetchedUrl(responseUrl, baseHref) {
    if (!responseUrl) return { ok: false, errors: ["Import failed."] };
    return safeImportUrl(responseUrl, baseHref);
  }

  function messageAllowed(ev, loc, win) {
    if (!ev || !loc || !win) return false;
    if (loc.origin === "null" || ev.origin === "null" || ev.origin !== loc.origin) return false;
    const src = ev.source;
    if (!src || (src !== win && src !== win.opener && src !== win.parent)) return false;
    const d = ev.data;
    if (!d || d.type !== "globedesk.import") return false;
    let n = 0;
    try {
      if (typeof d.json === "string") n = d.json.length;
      else n = JSON.stringify(d.episode || d.json || "").length;
    } catch (e) { return false; }
    if (n > maxJson()) return false;
    return true;
  }

  function onMessage(ev) {
    try {
      if (!messageAllowed(ev, location, window)) return;
      const d = ev.data;
      const raw = typeof d.json === "string" ? d.json : JSON.stringify(d.episode || d.json || "");
      const r = importJson(raw);
      if (!r.ok) {
        if (GD.ui) GD.ui.toast("Assistant import rejected: " + r.errors[0]);
        return;
      }
      if (GD.ui) GD.ui.loadEpisode(r.episode, "Imported from assistant (validated).");
    } catch (e) { /* never break the desk */ }
  }

  // Same-origin /episodes/ JSON only (no remote fetch).
  async function importSameOrigin(path) {
    try {
      const base = (typeof location !== "undefined" && location.href) ? location.href : "";
      const checked = safeImportUrl(path, base);
      if (!checked.ok) return checked;
      const res = await fetch(checked.url, { credentials: "same-origin", redirect: "error" });
      if (!res.ok) return { ok: false, errors: ["Could not read that file."] };
      const again = acceptFetchedUrl(res.url, base);
      if (!again.ok) return { ok: false, errors: ["Import redirected to a disallowed URL."] };
      const text = await res.text();
      if (text.length > maxJson()) return { ok: false, errors: ["Imported JSON is larger than the project limit."] };
      return importJson(text);
    } catch (e) {
      return { ok: false, errors: ["Import failed."] };
    }
  }

  function tab(el) {
    const esc = (GD.sanitize && GD.sanitize.esc) || ((v) => String(v == null ? "" : v));
    el.innerHTML =
      '<p class="muted small">Use any assistant you already have. Copy the prompt, paste the JSON it returns, and GlobeDesk will validate it before loading. Nothing is sent to a network model from this panel. The default voice is the browser’s free speech synthesis. Optional paid voice or AI keys (Settings) stay off unless you turn them on; their request shape is <strong>[UNKNOWN]</strong> until documented.</p>' +
      '<div class="actions"><button type="button" id="asCopy">Copy prompt + schema</button>' +
      '<button type="button" id="asSpeak">Speak current script (free)</button></div>' +
      '<label>Ready prompt<textarea id="asPrompt" readonly rows="8">' + esc(readyPrompt()) + "</textarea></label>" +
      '<label>Paste episode JSON<textarea id="asPaste" rows="10" placeholder="Paste a globedesk.episode/2 JSON object"></textarea></label>' +
      '<div class="actions"><button type="button" id="asCheck">Validate</button><button type="button" id="asLoad">Validate and load</button></div>' +
      '<pre id="asErr" class="muted small as-err"></pre>';
    const err = el.querySelector("#asErr");
    el.querySelector("#asCopy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(readyPrompt()); if (GD.ui) GD.ui.toast("Prompt copied."); }
      catch (e) { if (GD.ui) GD.ui.toast("Could not copy — select the prompt and copy it yourself."); }
    });
    el.querySelector("#asSpeak").addEventListener("click", () => {
      const s = GD.state.episode.stories[GD.state.storyIdx];
      if (!speak(s && s.script)) { if (GD.ui) GD.ui.toast("No browser voice in this window."); }
    });
    function run(load) {
      const r = importJson(el.querySelector("#asPaste").value);
      err.textContent = r.ok ? "Valid episode." : r.errors.join("\n");
      if (r.ok && load) GD.ui.loadEpisode(r.episode, "Assistant JSON loaded (validated).");
    }
    el.querySelector("#asCheck").addEventListener("click", () => run(false));
    el.querySelector("#asLoad").addEventListener("click", () => run(true));
  }

  function listen() {
    window.addEventListener("message", onMessage);
  }

  GD.assistant = { promptText, schemaSummary, readyPrompt, importJson, importSameOrigin, safeImportUrl, acceptFetchedUrl, messageAllowed, speak, tab, listen };
})();
