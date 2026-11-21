/* Local IndexedDB: autosave the open project and keep media bytes on this device only. window.GD.store */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const DB_NAME = "globedesk";
  const DB_VER = 1;
  const EPISODE_KEY = "episode";
  const REJECTED_KEY = "rejectedEpisode";
  let dbp = null;
  const mem = { episode: null, rejected: null };

  function rejectedBackup(ep, errors) {
    return { savedAt: Date.now(), errors: (errors || []).slice(), episode: ep };
  }

  // Pure: if the saved episode fails validation, keep it as a backup record.
  function reviewRestore(ep, errors) {
    if (!ep) return { ok: false, episode: null, backup: null, errors: errors || ["Missing episode."] };
    if (!errors || !errors.length) return { ok: true, episode: ep, backup: null, errors: [] };
    return { ok: false, episode: null, backup: rejectedBackup(ep, errors), errors: errors.slice() };
  }

  function open() {
    if (dbp) return dbp;
    if (typeof indexedDB === "undefined") {
      dbp = Promise.resolve(null);
      return dbp;
    }
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
        if (!db.objectStoreNames.contains("media")) db.createObjectStore("media", { keyPath: "ref" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function tx(store, mode, fn) {
    return open().then((db) => {
      if (!db) return null;
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const req = fn(s);
        t.oncomplete = () => resolve(req && "result" in req ? req.result : undefined);
        t.onerror = () => reject(t.error);
        if (req && req !== s) {
          req.onsuccess = () => {};
          req.onerror = () => reject(req.error);
        }
      });
    });
  }

  function saveEpisode(ep) {
    const json = JSON.parse(JSON.stringify(ep));
    // Autosave never writes the rejected-episode backup key.
    if (typeof indexedDB === "undefined") { mem.episode = json; return Promise.resolve(json); }
    return tx("kv", "readwrite", (s) => s.put(json, EPISODE_KEY));
  }
  function loadEpisode() {
    if (typeof indexedDB === "undefined") return Promise.resolve(mem.episode);
    return tx("kv", "readonly", (s) => s.get(EPISODE_KEY));
  }
  function keepRejected(ep, errors) {
    const rec = rejectedBackup(ep, errors);
    if (typeof indexedDB === "undefined") { mem.rejected = rec; return Promise.resolve(rec); }
    return tx("kv", "readwrite", (s) => s.put(rec, REJECTED_KEY)).then(() => rec);
  }
  function loadRejected() {
    if (typeof indexedDB === "undefined") return Promise.resolve(mem.rejected);
    return tx("kv", "readonly", (s) => s.get(REJECTED_KEY));
  }
  // Generic kv access (used by the append-only archive index, GD.archive).
  function getKv(key) {
    if (typeof indexedDB === "undefined") return Promise.resolve(mem[key] || null);
    return tx("kv", "readonly", (s) => s.get(key));
  }
  function putKv(key, value) {
    const json = JSON.parse(JSON.stringify(value));
    if (typeof indexedDB === "undefined") { mem[key] = json; return Promise.resolve(json); }
    return tx("kv", "readwrite", (s) => s.put(json, key));
  }
  function putMedia(rec) {
    return tx("media", "readwrite", (s) => s.put(rec));
  }
  function getMedia(ref) {
    return tx("media", "readonly", (s) => s.get(ref));
  }
  function deleteMedia(ref) {
    return tx("media", "readwrite", (s) => s.delete(ref));
  }
  function allMedia() {
    return open().then((db) => {
      if (!db) return [];
      return new Promise((resolve, reject) => {
        const t = db.transaction("media", "readonly");
        const req = t.objectStore("media").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  }
  // Clears the saved episode and media. The archive index is kept on purpose.
  function clearAll() {
    return open().then((db) => {
      if (!db) return;
      return new Promise((resolve, reject) => {
        const t = db.transaction(["kv", "media"], "readwrite");
        t.objectStore("kv").delete(EPISODE_KEY);
        t.objectStore("kv").delete(REJECTED_KEY);
        t.objectStore("media").clear();
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      });
    });
  }

  let timer = 0;
  function schedule(ep) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      saveEpisode(ep).catch((e) => console.warn("autosave failed", e && e.message));
    }, 800);
  }

  GD.store = { open, saveEpisode, loadEpisode, keepRejected, loadRejected, reviewRestore, rejectedBackup, putMedia, getMedia, deleteMedia, allMedia, clearAll, schedule, getKv, putKv, DB_NAME, EPISODE_KEY, REJECTED_KEY, _mem: mem };
})();
