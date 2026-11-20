/* User content layer / plugin.
   Renders story cards, pin popups, screen overlays, geo-anchored panels and allowlisted embeds
   in a DOM layer above the map. It never modifies the base map style, sources, or tiles.
   window.GD.content */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const layerId = "contentLayer";

  function blank(kind) {
    return {
      id: GD.model.uid("ct"),
      kind: kind || "overlay",
      mediaRef: "",
      embedUrl: "",
      credit: "",
      title: "",
      caption: "",
      visible: true,
      at: 0,
      dur: 8,
      order: 0,
      pin: null,
      overlay: { mode: "pip", x: 66, y: 22, width: 28, height: 24, opacity: 1 }
    };
  }

  function items(story) {
    return ((story && story.content) || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function clampNum(v, lo, hi, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(hi, Math.max(lo, n));
  }

  function clampOverlay(o) {
    o = o || {};
    return {
      mode: o.mode === "full" ? "full" : "pip",
      x: clampNum(o.x, 0, 100, 0),
      y: clampNum(o.y, 0, 100, 0),
      width: clampNum(o.width, 0, 100, 30),
      height: clampNum(o.height, 0, 100, 30),
      opacity: clampNum(o.opacity, 0, 1, 1)
    };
  }

  function visibleAt(el, lt) {
    if (!el || el.visible === false) return false;
    const at = Number(el.at) || 0, dur = Number(el.dur);
    if (lt < at) return false;
    if (dur > 0 && lt >= at + dur) return false;
    return true;
  }

  // Snapshot of base-map state for the invariance test. User content must not change this.
  function baseSnapshot() {
    const st = GD.globe && GD.globe.st;
    const map = st && st.map;
    if (!map || !map.getStyle) return { baseId: st && st.baseId, available: false };
    const style = map.getStyle();
    const sources = {};
    Object.keys(style.sources || {}).sort().forEach((k) => {
      const s = style.sources[k];
      sources[k] = { type: s.type, url: s.url || null, tiles: s.tiles ? s.tiles.slice() : null };
    });
    return {
      available: true,
      baseId: st.baseId,
      sourceIds: Object.keys(style.sources || {}).sort(),
      sources,
      layerIds: (style.layers || []).map((l) => l.id),
      terrain: map.getTerrain ? map.getTerrain() : null
    };
  }

  function sameBase(a, b) {
    if (!a || !b) return false;
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function root() { return document.getElementById(layerId); }

  function mediaEl(ref, kind, caption) {
    const url = GD.state && GD.state.blobs[ref];
    if (!url) return null;
    const tag = kind === "video" ? "video" : kind === "audio" ? "audio" : "img";
    const el = document.createElement(tag);
    el.src = url;
    if (tag === "video" || tag === "audio") {
      el.controls = true;
      el.playsInline = true;
      if (GD.state && GD.state.playing) el.play().catch(() => {});
      if (GD.recorder && GD.recorder.connectMedia && tag === "video") GD.recorder.connectMedia(el);
    } else {
      el.alt = caption || "";
    }
    return el;
  }

  function fillMedia(host, el) {
    const bin = (GD.state.episode.mediaBin || []).find((b) => b.ref === el.mediaRef);
    const node = mediaEl(el.mediaRef, bin && bin.kind, el.caption || el.title);
    if (node) host.appendChild(node);
  }

  function renderItem(el, lt) {
    const host = document.createElement("div");
    host.className = "gd-ct gd-ct-" + el.kind;
    host.dataset.id = el.id;
    host.tabIndex = 0;
    host.setAttribute("role", "group");
    host.setAttribute("aria-label", (el.title || el.kind) + (el.credit ? ", credit " + el.credit : ""));
    if (el.kind === "overlay") {
      const o = clampOverlay(el.overlay);
      host.style.position = "absolute";
      if (o.mode === "full") {
        host.style.inset = "0";
      } else {
        host.style.left = o.x + "%";
        host.style.top = o.y + "%";
        host.style.width = o.width + "%";
        host.style.height = o.height + "%";
      }
      host.style.opacity = String(o.opacity);
    }
    if (el.title) {
      const h = document.createElement("div");
      h.className = "gd-ct-title";
      h.textContent = el.title;
      h.title = el.title;
      host.appendChild(h);
    }
    if (el.kind === "embed") {
      const src = GD.sanitize.embedSrc(el.embedUrl);
      if (src) {
        const ifr = document.createElement("iframe");
        ifr.src = src;
        ifr.title = el.title || "Embedded media";
        ifr.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
        ifr.setAttribute("referrerpolicy", "no-referrer");
        ifr.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
        host.appendChild(ifr);
      } else if (GD.sanitize.isHttpsUrl(el.embedUrl)) {
        const a = document.createElement("a");
        a.href = el.embedUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = el.title || el.embedUrl;
        host.appendChild(a);
      }
    } else if (el.mediaRef) {
      fillMedia(host, el);
    }
    if (el.caption) {
      const c = document.createElement("div");
      c.className = "gd-ct-cap";
      c.textContent = el.caption;
      c.title = el.caption;
      host.appendChild(c);
    }
    if (el.credit) {
      const cr = document.createElement("div");
      cr.className = "gd-ct-credit";
      cr.textContent = el.credit;
      cr.title = el.credit;
      host.appendChild(cr);
    }
    return host;
  }

  function positionGeo(host, el) {
    const map = GD.globe && GD.globe.st && GD.globe.st.map;
    const pin = el.pin || (function () {
      const s = GD.state && GD.state.episode && GD.state.episode.stories[GD.state.storyIdx];
      return s && s.location && s.location.lat != null ? { lat: s.location.lat, lon: s.location.lon } : null;
    })();
    if (!map || !pin) { host.style.display = "none"; return; }
    const p = map.project([pin.lon, pin.lat]);
    host.style.position = "absolute";
    host.style.left = p.x + "px";
    host.style.top = p.y + "px";
    host.style.display = "";
  }

  function render() {
    const box = root();
    if (!box || !GD.state || !GD.state.episode) return;
    const S = GD.state;
    const story = S.episode.stories[S.storyIdx];
    const { lt } = GD.playback ? GD.playback.locate(S.t) : { lt: S.t };
    const want = S.ov && S.ov.outro ? [] : items(story).filter((el) => visibleAt(el, lt));
    const ids = want.map((el) => el.id);
    Array.from(box.children).forEach((n) => { if (ids.indexOf(n.dataset.id) < 0) n.remove(); });
    want.forEach((el) => {
      let n = box.querySelector('[data-id="' + CSS.escape(el.id) + '"]');
      if (!n) {
        n = renderItem(el, lt);
        box.appendChild(n);
      }
      if (el.kind === "geo-panel" || el.kind === "pin-popup") positionGeo(n, el);
    });
  }

  function clear() {
    const box = root();
    if (box) box.innerHTML = "";
  }

  function tab(el, s) {
    const esc = (GD.sanitize && GD.sanitize.esc) || ((v) => String(v == null ? "" : v));
    const bin = (GD.state.episode.mediaBin || []);
    el.innerHTML =
      '<p class="muted small">Place your media on the desk without touching the base map. Kinds: story card, pin popup, screen overlay (picture-in-picture or full frame), geo-anchored panel, or an allowlisted https embed (YouTube / X) with credit required. Click a pin on the globe or enter coordinates. Show/hide, timing and order are per element.</p>' +
      '<div class="actions"><button id="ctAddOverlay">+ Overlay</button><button id="ctAddGeo">+ Geo panel</button><button id="ctAddPopup">+ Pin popup</button><button id="ctAddCard">+ Card media</button><button id="ctAddEmbed">+ Embed</button></div>' +
      (items(s).map((c, i) => {
        return '<div class="item" data-ct="' + i + '"><h3><span class="sp">' + esc(c.kind) + ' — ' + esc(c.title || c.id) + '</span>' +
          '<label class="small">Show <input type="checkbox" data-f="' + i + '.visible"' + (c.visible !== false ? " checked" : "") + "></label>" +
          '<button data-del="' + i + '" class="small">✕</button></h3>' +
          '<div class="row2"><label>Title<input data-f="' + i + '.title" value="' + esc(c.title) + '"></label>' +
          '<label>Media<select data-f="' + i + '.mediaRef"><option value="">(none)</option>' +
          bin.map((b) => '<option value="' + esc(b.ref) + '"' + (c.mediaRef === b.ref ? " selected" : "") + ">" + esc(b.name) + "</option>").join("") +
          "</select></label></div>" +
          '<div class="row3"><label>At (s)<input data-f="' + i + '.at" type="number" step="0.1" value="' + esc(c.at) + '"></label>' +
          '<label>For (s)<input data-f="' + i + '.dur" type="number" step="0.1" value="' + esc(c.dur) + '"></label>' +
          '<label>Order<input data-f="' + i + '.order" type="number" step="1" value="' + esc(c.order || 0) + '"></label></div>' +
          '<label>Caption / transcript<input data-f="' + i + '.caption" value="' + esc(c.caption || "") + '" title="' + esc(c.caption || "") + '"></label>' +
          '<label>Credit (required for others’ work and for embeds)<input data-f="' + i + '.credit" value="' + esc(c.credit || "") + '"></label>' +
          (c.kind === "embed" ? '<label>Embed URL (https YouTube or X)<input data-f="' + i + '.embedUrl" value="' + esc(c.embedUrl || "") + '" placeholder="https://"></label>' : "") +
          (c.kind === "overlay" ? '<div class="row2"><label>Mode<select data-ov="' + i + '.mode"><option value="pip"' + ((c.overlay && c.overlay.mode) !== "full" ? " selected" : "") + ">Picture-in-picture</option><option value=\"full\"" + ((c.overlay && c.overlay.mode) === "full" ? " selected" : "") + ">Full frame</option></select></label>" +
            '<label>Opacity<input data-ov="' + i + '.opacity" type="number" min="0" max="1" step="0.05" value="' + esc((c.overlay && c.overlay.opacity) != null ? c.overlay.opacity : 1) + '"></label></div>' +
            '<div class="row3"><label>X %<input data-ov="' + i + '.x" type="number" value="' + esc(c.overlay && c.overlay.x || 0) + '"></label>' +
            '<label>Y %<input data-ov="' + i + '.y" type="number" value="' + esc(c.overlay && c.overlay.y || 0) + '"></label>' +
            '<label>W %<input data-ov="' + i + '.width" type="number" value="' + esc(c.overlay && c.overlay.width || 30) + '"></label></div>' : "") +
          ((c.kind === "geo-panel" || c.kind === "pin-popup") ? '<div class="row2"><label>Pin lat<input data-pin="' + i + '.lat" type="number" step="0.0001" value="' + esc(c.pin && c.pin.lat != null ? c.pin.lat : "") + '"></label>' +
            '<label>Pin lon<input data-pin="' + i + '.lon" type="number" step="0.0001" value="' + esc(c.pin && c.pin.lon != null ? c.pin.lon : "") + '"></label></div>' +
            '<button type="button" class="small" data-frompin="' + i + '">Use story pin</button>' : "") +
          "</div>";
      }).join("") || "<p>No placed media yet.</p>");

    const num = (v, d) => (v === "" || v == null || isNaN(Number(v)) ? d : Number(v));
    el.querySelectorAll("[data-f]").forEach((n) => n.addEventListener("change", (e) => {
      const [i, k] = e.target.dataset.f.split(".");
      const c = s.content[Number(i)];
      if (k === "visible") c.visible = e.target.checked;
      else if (k === "at" || k === "dur" || k === "order") c[k] = num(e.target.value, 0);
      else c[k] = e.target.value;
      GD.ui.changed();
    }));
    el.querySelectorAll("[data-ov]").forEach((n) => n.addEventListener("change", (e) => {
      const [i, k] = e.target.dataset.ov.split(".");
      const c = s.content[Number(i)];
      c.overlay = c.overlay || blank("overlay").overlay;
      c.overlay[k] = k === "mode" ? e.target.value : num(e.target.value, 0);
      GD.ui.changed();
    }));
    el.querySelectorAll("[data-pin]").forEach((n) => n.addEventListener("change", (e) => {
      const [i, k] = e.target.dataset.pin.split(".");
      const c = s.content[Number(i)];
      c.pin = c.pin || { lat: null, lon: null };
      c.pin[k] = e.target.value === "" ? null : num(e.target.value, null);
      GD.ui.changed();
    }));
    el.querySelectorAll("[data-frompin]").forEach((n) => n.addEventListener("click", (e) => {
      const i = Number(e.target.dataset.frompin);
      const loc = s.location || {};
      s.content[i].pin = { lat: loc.lat, lon: loc.lon };
      GD.ui.changed();
    }));
    el.querySelectorAll("[data-del]").forEach((n) => n.addEventListener("click", (e) => {
      s.content.splice(Number(e.target.dataset.del), 1); GD.ui.changed();
    }));
    function add(kind) {
      s.content = s.content || [];
      const c = blank(kind);
      if (kind === "geo-panel" || kind === "pin-popup") c.pin = s.location && s.location.lat != null ? { lat: s.location.lat, lon: s.location.lon } : null;
      s.content.push(c); GD.ui.changed();
    }
    const bind = (id, kind) => { const b = el.querySelector(id); if (b) b.addEventListener("click", () => add(kind)); };
    bind("#ctAddOverlay", "overlay");
    bind("#ctAddGeo", "geo-panel");
    bind("#ctAddPopup", "pin-popup");
    bind("#ctAddCard", "card");
    bind("#ctAddEmbed", "embed");
  }

  GD.content = { blank, items, visibleAt, clampNum, clampOverlay, baseSnapshot, sameBase, render, clear, tab, layerId };
})();
