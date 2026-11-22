/* Save/load a .globedesk project pack (JSON + media zip) or a .globedesk.json episode. window.GD.project */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});

  function episodeJSON(ep) {
    return JSON.stringify(ep, null, 2);
  }

  async function buildPack(ep, blobs) {
    const files = [{ name: "project.json", data: JSON.stringify({ schema: GD.schema.PROJECT, episode: ep }, null, 2) }];
    const bin = ep.mediaBin || [];
    for (let i = 0; i < bin.length; i++) {
      const b = bin[i];
      let data = null;
      if (GD.store) {
        const rec = await GD.store.getMedia(b.ref);
        if (rec && rec.blob) data = new Uint8Array(await rec.blob.arrayBuffer());
      }
      if (!data && blobs && blobs[b.ref]) {
        const res = await fetch(blobs[b.ref]);
        data = new Uint8Array(await res.arrayBuffer());
      }
      if (data) {
        const safe = String(b.name || b.ref).replace(/[/\\]/g, "_");
        files.push({ name: "media/" + b.ref + "/" + safe, data });
      }
    }
    return GD.zip.write(files);
  }

  async function parsePack(buf) {
    const files = GD.zip.read(buf);
    const raw = GD.zip.readText(files, "project.json");
    if (!raw) throw new Error("project.json missing from the .globedesk pack");
    const cap = (GD.schema && GD.schema.LIMITS && GD.schema.LIMITS.projectJson) || (8 * 1024 * 1024);
    if (raw.length > cap) throw new Error("project.json is larger than the " + cap + " byte limit");
    let pack;
    try { pack = JSON.parse(raw); } catch (e) { throw new Error("project.json is not valid JSON"); }
    const ep = pack.episode || pack;
    const warns = [];
    const errs = GD.schema.validate(ep, warns);
    if (errs.length) throw new Error("Invalid episode: " + errs[0]);
    const media = [];
    Object.keys(files).forEach((name) => {
      if (name === "project.json") return;
      const m = name.match(/^media\/([^/]+)\/(.+)$/);
      if (!m) return;
      media.push({ ref: m[1], name: m[2], data: files[name] });
    });
    return { episode: ep, media };
  }

  async function absorbMedia(list, episode) {
    const bin = (episode && episode.mediaBin) || [];
    const accepted = [];
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      const meta = bin.find((b) => b.ref === m.ref) || {};
      const type = meta.type || "";
      const size = (m.data && m.data.byteLength) || (m.data && m.data.length) || 0;
      const file = new File([m.data], m.name, { type: type });
      // File.size should match the bytes; pass an explicit size if the runtime omits it.
      const probe = { name: m.name, type: file.type || type, size: file.size || size };
      const v = GD.media ? GD.media.validateFile(probe) : { ok: false, error: "Media validator missing." };
      if (!v.ok) throw new Error("Pack media rejected (" + m.name + "): " + v.error);
      const kind = v.kind;
      if (meta.kind && meta.kind !== kind) throw new Error("Pack media rejected (" + m.name + "): kind does not match the file.");
      const typed = new File([m.data], m.name, { type: v.type || type || file.type });
      if (GD.store) await GD.store.putMedia({ ref: m.ref, name: m.name, kind, type: typed.type, size: typed.size || size, blob: typed, local: true });
      if (GD.state) {
        if (GD.state.blobs[m.ref]) URL.revokeObjectURL(GD.state.blobs[m.ref]);
        GD.state.blobs[m.ref] = URL.createObjectURL(typed);
      }
      accepted.push({ ref: m.ref, name: m.name, kind, type: typed.type, size: typed.size || size });
    }
    return accepted;
  }

  async function exportProject(filename) {
    const bytes = await buildPack(GD.state.episode, GD.state.blobs);
    const a = document.createElement("a");
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
    a.href = url;
    a.download = filename || "project.globedesk";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ } }, 2000);
    return bytes;
  }

  async function importFile(file) {
    const name = (file && file.name) || "";
    if (/\.globedesk$/i.test(name) && !/\.json$/i.test(name)) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const pack = await parsePack(buf);
      await absorbMedia(pack.media, pack.episode);
      return pack.episode;
    }
    const text = await file.text();
    const data = JSON.parse(text);
    const ep = data && data.schema === GD.schema.PROJECT && data.episode ? data.episode : data;
    const warns = [];
    const errs = GD.schema.validate(ep, warns);
    if (errs.length) throw new Error("Invalid episode: " + errs[0]);
    return ep;
  }

  GD.project = { episodeJSON, buildPack, parsePack, absorbMedia, exportProject, importFile };
})();
