/* Local media validation, IndexedDB persistence, and blob URLs. Never uploaded. window.GD.media */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});

  const TYPES = {
    image: { mime: [/^image\/(jpeg|png|webp|gif)$/], ext: /\.(jpe?g|png|webp|gif)$/i, max: 20 * 1024 * 1024 },
    audio: { mime: [/^audio\/(mpeg|mp3|wav|x-wav|wave|ogg|webm|mp4|aac|x-m4a)$/], ext: /\.(mp3|wav|ogg|webm|m4a|aac)$/i, max: 50 * 1024 * 1024 },
    video: { mime: [/^video\/(mp4|webm|quicktime)$/], ext: /\.(mp4|webm|mov)$/i, max: 200 * 1024 * 1024 },
    caption: { mime: [/^text\/(vtt|plain)$/, /^application\/octet-stream$/], ext: /\.(vtt|srt)$/i, max: 2 * 1024 * 1024 }
  };

  const CANON = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".aac": "audio/aac",
    ".webm": "video/webm", ".mp4": "video/mp4", ".mov": "video/quicktime",
    ".vtt": "text/vtt", ".srt": "text/plain"
  };

  function extOf(name) {
    const m = String(name || "").toLowerCase().match(/(\.[a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  function kindFromMime(t) {
    const type = String(t || "");
    if (!type) return null;
    for (const kind of ["image", "audio", "video", "caption"]) {
      if (TYPES[kind].mime.some((r) => r.test(type))) return kind;
    }
    return null;
  }

  function kindsFromExt(name) {
    const found = [];
    for (const kind of ["image", "audio", "video", "caption"]) {
      if (TYPES[kind].ext.test(name || "")) found.push(kind);
    }
    return found;
  }

  // Empty browser MIME types are filled from a canonical extension map, then both must agree.
  function resolvedType(file) {
    const t = file && file.type || "";
    if (t) return t;
    return CANON[extOf(file && file.name)] || "";
  }

  function kindOf(file) {
    const type = resolvedType(file);
    const km = kindFromMime(type);
    const kes = kindsFromExt(file && file.name || "");
    if (!km || kes.indexOf(km) < 0) return null;
    return km;
  }

  function validateFile(file) {
    const kind = kindOf(file);
    if (!kind) return { ok: false, error: "Not a supported audio, video, image, or caption file (type and extension must both match)." };
    const lim = TYPES[kind];
    const size = file && file.size;
    if (typeof size !== "number" || !Number.isFinite(size) || size < 0) {
      return { ok: false, error: "File size is missing or invalid." };
    }
    if (size > lim.max) {
      return { ok: false, error: (file.name || "file") + " is larger than the " + Math.round(lim.max / 1024 / 1024) + " MiB limit for " + kind + " files." };
    }
    return { ok: true, kind, max: lim.max, type: resolvedType(file) };
  }

  function objectUrl(blob) { return URL.createObjectURL(blob); }

  async function addFile(file) {
    const v = validateFile(file);
    if (!v.ok) return v;
    const ref = GD.model.uid("media");
    const rec = { ref, name: file.name, kind: v.kind, type: v.type || file.type || "", size: file.size, blob: file, local: true };
    if (GD.store) await GD.store.putMedia(rec);
    if (GD.state) {
      GD.state.blobs[ref] = objectUrl(file);
      GD.state.episode.mediaBin.push({ ref, name: file.name, kind: v.kind, local: true, size: file.size, type: v.type || file.type || "" });
    }
    return { ok: true, ref, kind: v.kind };
  }

  async function hydrateBlobs() {
    if (!GD.store || !GD.state) return;
    const all = await GD.store.allMedia();
    all.forEach((rec) => {
      if (!rec || !rec.blob) return;
      if (GD.state.blobs[rec.ref]) URL.revokeObjectURL(GD.state.blobs[rec.ref]);
      GD.state.blobs[rec.ref] = objectUrl(rec.blob);
    });
  }

  async function blobFor(ref) {
    if (GD.state && GD.state.blobs[ref]) {
      const url = GD.state.blobs[ref];
      // Prefer the stored File/Blob when we can.
    }
    if (GD.store) {
      const rec = await GD.store.getMedia(ref);
      if (rec && rec.blob) return rec.blob;
    }
    return null;
  }

  GD.media = { TYPES, CANON, kindOf, kindFromMime, kindsFromExt, resolvedType, validateFile, addFile, hydrateBlobs, blobFor, objectUrl };
})();
