/* Export dialog: frame-accurate MP4 (js/frame-export.js) and the offline share pack.
   The share pack is built by the local server (tools/export_share_pack.py) so the same
   promote checks run as on the command line: strip personal fields, real source and
   licence on every story, a PUBLIC / RECORDED / PROJECTED label, scrub_scan and name_scan.
   Check first (dry run), then the confirm box, then Build. window.GD.sharePack */
(function (global) {
  "use strict";
  const GD = (global.GD = global.GD || {});
  const $ = (id) => global.document.getElementById(id);
  const st = { checked: null };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function onLoopback() {
    const l = global.location;
    return !!(l && /^https?:$/.test(l.protocol) && /^(127\.0\.0\.1|localhost)$/.test(l.hostname));
  }
  function picked(name) { const el = global.document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ""; }

  // Pure: request body for the server (unit-tested).
  function requestBody(episode, form, confirm) {
    return { episode, label: form.label || "", license: form.license || "", tiles: form.tiles || "outline", confirm: confirm === true };
  }

  function form() { return { label: $("shLabel").value, license: $("shLicense").value.trim(), tiles: picked("shTiles") || "outline" }; }
  function sameForm(a, b) { return a && b && a.label === b.label && a.license === b.license && a.tiles === b.tiles; }

  function resetConfirm() {
    st.checked = null;
    $("shConfirm").checked = false; $("shConfirm").disabled = true; $("shBuild").disabled = true;
  }

  async function post(body) {
    const r = await fetch("/api/share-pack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r;
  }

  async function check() {
    resetConfirm();
    const rep = $("shReport");
    if (!onLoopback()) { rep.innerHTML = "<p>The share pack needs the local GlobeDesk server (START-GLOBEDESK). Nothing was made.</p>"; return null; }
    const f = form();
    rep.textContent = "Checking…";
    try {
      const r = await post(requestBody(GD.state.episode, f, false));
      const j = await r.json();
      if (!r.ok || !j.ok) {
        rep.innerHTML = '<p class="ex-bad"><strong>Blocked.</strong> ' + esc(j.error || "check failed") + "</p>" +
          (j.reasons && j.reasons.length ? "<ul>" + j.reasons.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "");
        return j;
      }
      st.checked = f;
      rep.innerHTML = '<p class="ex-ok"><strong>Ready.</strong> ' + esc(j.label) + " · licence " + esc(j.license) + " · " + (j.bytes / 1048576).toFixed(1) + " MiB of " + Math.round(j.capBytes / 1048576) + " MiB cap · map: " + esc(j.tiles) + (j.tileCount ? " (" + j.tileCount + " tiles)" : "") + "</p>" +
        "<p>Stories that will go in:</p><ul>" + j.stories.map((s) => "<li>" + esc(s.title) + " — " + s.sources + " source(s), " + esc(s.license) + "</li>").join("") + "</ul>" +
        (j.stripped.length ? "<p>Left out or stripped:</p><ul>" + j.stripped.slice(0, 20).map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "") +
        "<p>Scans: scrub " + esc(j.scans.scrub_scan) + ", names " + esc(j.scans.name_scan) + ". Credits in the pack: " + esc(j.attributions.join(" · ")) + "</p>";
      $("shConfirm").disabled = false;
      return j;
    } catch (e) {
      rep.textContent = "Could not reach the local server: " + (e.message || e);
      return null;
    }
  }

  async function build() {
    const f = form();
    if (!st.checked || !sameForm(st.checked, f) || !$("shConfirm").checked) { if (GD.ui) GD.ui.toast("Run Check and tick the confirm box first."); return null; }
    $("shBuild").disabled = true;
    try {
      const r = await post(requestBody(GD.state.episode, f, true));
      if (!r.ok) { const j = await r.json().catch(() => ({})); $("shReport").innerHTML = '<p class="ex-bad">' + esc(j.error || "build failed") + "</p>"; return null; }
      const blob = await r.blob();
      const ep = GD.state.episode;
      const name = (String((ep.date || "story") + "-" + (ep.title || "globedesk")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "globedesk-story") + ".globedesk.html";
      const a = global.document.createElement("a"); const url = URL.createObjectURL(blob);
      a.href = url; a.download = name; global.document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      if (GD.ui) GD.ui.toast("Share pack saved to your Downloads: " + name + ". It opens offline with a double-click.");
      return { ok: true, name, bytes: blob.size };
    } finally { resetConfirm(); }
  }

  async function exportMp4() {
    if (!GD.frameExport) return;
    const go = $("exMp4Go"), cancel = $("exMp4Cancel"), bar = $("exMp4Progress"), status = $("exMp4Status");
    const len = $("exLength").value;
    go.disabled = true; cancel.hidden = false; bar.hidden = false; bar.value = 0;
    try {
      const res = await GD.frameExport.exportVideo({
        aspect: picked("exAspect") || "16:9",
        seconds: len === "full" ? null : Number(len),
        onProgress: (f, msg) => { bar.value = Math.round(f * 100); if (msg) status.textContent = msg; }
      });
      status.textContent = "Saved " + res.name + " (" + (res.bytes / 1048576).toFixed(1) + " MiB, " + res.frames + " frames at " + res.fps + " fps, " + res.width + "×" + res.height + ", " + (res.method === "webcodecs" ? "browser H.264" + (res.audio === "aac" ? " + AAC" : "") : res.method === "ffmpeg" ? "local ffmpeg" : "WebM fallback") + ").";
      return res;
    } catch (e) {
      status.textContent = String(e.message || e);
      return null;
    } finally { go.disabled = false; cancel.hidden = true; }
  }

  function open() {
    const d = $("exportDialog"); if (!d) return;
    const asp = (GD.state && GD.state.episode && GD.state.episode.output && GD.state.episode.output.aspect) || "16:9";
    const r = global.document.querySelector('input[name="exAspect"][value="' + asp + '"]'); if (r) r.checked = true;
    if (!d.open) d.showModal();
  }
  function close() { const d = $("exportDialog"); if (d && d.open && !(GD.frameExport && GD.frameExport.isRunning())) d.close(); }

  function wire() {
    const b = $("btnExport"); if (b) b.addEventListener("click", open);
    const c = $("exportClose"); if (c) c.addEventListener("click", close);
    const g = $("exMp4Go"); if (g) g.addEventListener("click", exportMp4);
    const x = $("exMp4Cancel"); if (x) x.addEventListener("click", () => GD.frameExport && GD.frameExport.cancel());
    const ck = $("shCheck"); if (ck) ck.addEventListener("click", check);
    const bd = $("shBuild"); if (bd) bd.addEventListener("click", build);
    const cf = $("shConfirm"); if (cf) cf.addEventListener("change", () => { $("shBuild").disabled = !(cf.checked && st.checked && sameForm(st.checked, form())); });
    ["shLabel", "shLicense"].forEach((id) => { const el = $(id); if (el) el.addEventListener("input", resetConfirm); });
    global.document.querySelectorAll('input[name="shTiles"]').forEach((el) => el.addEventListener("change", resetConfirm));
  }

  GD.sharePack = { requestBody, check, build, exportMp4, open, close };
  if (global.document && global.document.getElementById) {
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", wire); else wire();
  }
})(typeof window !== "undefined" ? window : globalThis);
