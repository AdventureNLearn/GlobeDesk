/* Local catalog: export and import layout/settings into GLOBEDESK_DATA.
   These APIs exist only on the loopback serve.py. They are never written into
   an episode and are not part of the public grok.me pack. */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const KEY_RE = /^(globedesk|gobedesk)\./;
  const MAX_VALUE_CHARS = 64 * 1024;

  function acceptImportedItems(items) {
    const out = {};
    if (!items || typeof items !== "object" || Array.isArray(items)) {
      return { ok: false, error: "Import failed: invalid items." };
    }
    const keys = Object.keys(items);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!KEY_RE.test(k)) continue;
      const v = items[k];
      if (typeof v !== "string") return { ok: false, error: "Import failed: a setting was not a string." };
      if (v.length > MAX_VALUE_CHARS) return { ok: false, error: "Import failed: a setting was too large." };
      out[k] = v;
    }
    if (!Object.keys(out).length) return { ok: false, error: "Import failed: no globedesk.* keys." };
    return { ok: true, items: out };
  }

  function toast(msg) {
    if (GD.ui && GD.ui.toast) GD.ui.toast(msg, 4000);
    else window.alert(msg);
  }

  function collectItems() {
    const items = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !KEY_RE.test(k)) continue;
        items[k] = localStorage.getItem(k);
      }
    } catch (e) {
      return { ok: false, error: "This browser blocked localStorage." };
    }
    return { ok: true, items };
  }

  async function post(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    let payload = null;
    try { payload = await res.json(); } catch (e) { payload = null; }
    if (!res.ok) {
      const err = (payload && payload.error) || ("HTTP " + res.status);
      return { ok: false, error: err, status: res.status };
    }
    return payload || { ok: false, error: "empty response" };
  }

  async function get(path) {
    const res = await fetch(path);
    let payload = null;
    try { payload = await res.json(); } catch (e) { payload = null; }
    if (!res.ok) {
      const err = (payload && payload.error) || ("HTTP " + res.status);
      return { ok: false, error: err, status: res.status };
    }
    return payload || { ok: false, error: "empty response" };
  }

  async function exportSettings() {
    const collected = collectItems();
    if (!collected.ok) { toast(collected.error); return collected; }
    if (!Object.keys(collected.items).length) {
      const msg = "No globedesk.* layout or settings in this browser to export.";
      toast(msg);
      return { ok: false, error: msg };
    }
    if (!window.confirm("Save this browser's layout and settings into the local catalog folder on this machine? The files stay untracked.")) {
      return { ok: false, error: "cancelled" };
    }
    let result;
    try {
      result = await post("/api/catalog/export", { items: collected.items });
    } catch (e) {
      result = { ok: false, error: "Export is only available in the local app (serve.py)." };
    }
    if (result && result.ok) {
      const files = (result.files || [result.file]).filter(Boolean).join(", ");
      toast("Saved " + result.count + " keys to " + files);
    } else {
      toast((result && result.error) || "Export failed.");
    }
    return result;
  }

  function latestSettingsFile(items) {
    const rows = (items || []).filter((it) => it && it.type === "settings" && it.file);
    if (!rows.length) return "";
    rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.file).localeCompare(String(a.file)));
    return rows[0].file;
  }

  async function importSettings() {
    let listed;
    try {
      listed = await get("/api/catalog/list");
    } catch (e) {
      toast("Import is only available in the local app (serve.py).");
      return { ok: false, error: "not local" };
    }
    if (!listed || !listed.ok) {
      toast((listed && listed.error) || "Could not read the local catalog.");
      return listed || { ok: false, error: "list failed" };
    }
    const file = latestSettingsFile(listed.items);
    if (!file) {
      toast("No saved layout or settings in the local catalog yet. Export first.");
      return { ok: false, error: "empty catalog" };
    }
    if (!window.confirm("Load " + file + " from the local catalog into this browser? The page will reload.")) {
      return { ok: false, error: "cancelled" };
    }
    let result;
    try {
      result = await post("/api/catalog/import", { file: file });
    } catch (e) {
      result = { ok: false, error: "Import is only available in the local app (serve.py)." };
    }
    if (!result || !result.ok || !result.items) {
      toast((result && result.error) || "Import failed.");
      return result;
    }
    const accepted = acceptImportedItems(result.items);
    if (!accepted.ok) {
      toast(accepted.error);
      return accepted;
    }
    try {
      Object.keys(accepted.items).forEach((k) => {
        localStorage.setItem(k, accepted.items[k]);
      });
    } catch (e) {
      toast("This browser blocked writing localStorage.");
      return { ok: false, error: "localStorage write failed" };
    }
    toast("Loaded " + result.count + " keys from " + file + ". Reloading…");
    setTimeout(() => { window.location.reload(); }, 400);
    return result;
  }

  GD.catalog = { exportSettings, importSettings, collectItems };
})();
