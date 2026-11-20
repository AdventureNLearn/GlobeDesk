/* Minimal ZIP (store method) reader/writer for .globedesk project packs. MIT-shaped, no deps. window.GD.zip */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});

  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    let c = 0xffffffff;
    const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    for (let i = 0; i < u.length; i++) c = CRC_TABLE[(c ^ u[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function enc(s) { return new TextEncoder().encode(s); }
  function dec(u) { return new TextDecoder().decode(u); }

  function u16(n) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; }
  function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }

  function concat(parts) {
    let n = 0; parts.forEach((p) => n += p.length);
    const out = new Uint8Array(n); let o = 0;
    parts.forEach((p) => { out.set(p, o); o += p.length; });
    return out;
  }

  // files: [{ name, data: Uint8Array|ArrayBuffer|string }]
  function write(files) {
    const locals = [], centrals = [];
    let offset = 0;
    files.forEach((f) => {
      const name = enc(f.name.replace(/\\/g, "/"));
      let data = f.data;
      if (typeof data === "string") data = enc(data);
      if (data instanceof ArrayBuffer) data = new Uint8Array(data);
      const crc = crc32(data);
      const local = concat([
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0),
        name, data
      ]);
      const central = concat([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0),
        u16(0), u16(0), u16(0), u32(0), u32(offset), name
      ]);
      locals.push(local);
      centrals.push(central);
      offset += local.length;
    });
    const center = concat(centrals);
    const end = concat([
      u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
      u32(center.length), u32(offset), u16(0)
    ]);
    return concat(locals.concat([center, end]));
  }

  function read(buf) {
    const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    // Find end of central directory (last 22+ bytes).
    let eocd = -1;
    for (let i = u.length - 22; i >= Math.max(0, u.length - 22 - 65535); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("Not a zip file");
    const n = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    const out = {};
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(off, true) !== 0x02014b50) throw new Error("Bad central directory");
      const method = dv.getUint16(off + 10, true);
      const crc = dv.getUint32(off + 16, true);
      const comp = dv.getUint32(off + 20, true);
      const nameLen = dv.getUint16(off + 28, true);
      const extra = dv.getUint16(off + 30, true);
      const comment = dv.getUint16(off + 32, true);
      const localOff = dv.getUint32(off + 42, true);
      const name = dec(u.subarray(off + 46, off + 46 + nameLen));
      off += 46 + nameLen + extra + comment;
      const loName = dv.getUint16(localOff + 26, true);
      const loExtra = dv.getUint16(localOff + 28, true);
      const start = localOff + 30 + loName + loExtra;
      const data = u.subarray(start, start + comp);
      if (method === 0) {
        if (crc32(data) !== crc) throw new Error("CRC mismatch: " + name);
        out[name] = data.slice();
      } else {
        throw new Error("Compressed entries are not supported: " + name);
      }
    }
    return out;
  }

  function readText(buf, name) {
    const files = typeof buf === "object" && !(buf instanceof ArrayBuffer) && !(buf instanceof Uint8Array) ? buf : read(buf);
    const u = files[name];
    if (!u) return null;
    return dec(u);
  }

  GD.zip = { write, read, readText, crc32 };
})();
