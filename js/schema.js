/* Episode / project schema helpers. Runtime validation is in GD.schema.validate
   (unknown keys, types, ranges, and LIMITS). window.GD.schema */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const CURRENT = "globedesk.episode/2";
  const LEGACY = ["globedesk.episode/1", "gobedesk.episode/1"];
  const PROJECT = "globedesk.project/1";

  const CONTENT_KINDS = ["card", "pin-popup", "overlay", "geo-panel", "embed"];
  const MEDIA_KINDS = ["video", "audio", "image", "caption"];
  const CARD_KINDS = ["topic", "stat", "quote", "timeline", "insight"];
  const PRESETS = ["orbit", "dive", "street", "cinematic", "close", "overview"];
  const EASES = ["cinematic", "smooth", "linear"];
  const ASPECTS = ["16:9", "9:16"];
  const SOURCE_STATUS = ["verified", "unverified"];
  const CAP_STYLES = ["shadow", "box"];
  const CAP_SIZES = ["small", "medium", "large"];
  const THEMES = ["frog", "ctd", "newsdesk"];
  const POSITIONS = ["left", "right", "center"];
  const MEDIA_ROLES = ["broll", "still", "voiceover", "music"];
  const OVERLAY_MODES = ["pip", "full"];

  const LIMITS = {
    image: 20 * 1024 * 1024,
    audio: 50 * 1024 * 1024,
    video: 200 * 1024 * 1024,
    caption: 2 * 1024 * 1024,
    projectJson: 8 * 1024 * 1024,
    geojson: 1 * 1024 * 1024,
    str: { id: 200, short: 500, medium: 8000, long: 50000, url: 2000, color: 64 },
    count: {
      stories: 80, links: 40, mediaBin: 80, eventLayers: 24, features: 400,
      cards: 40, sources: 40, captions: 500, camera: 40, media: 40,
      audioOverlays: 24, content: 40, facts: 24, sourceIds: 40
    }
  };

  const KEYS = {
    episode: ["schema", "id", "show", "title", "date", "lede", "cta", "links", "demo", "sample", "look", "handle", "outro", "output", "stories", "eventLayers", "mediaBin"],
    look: ["label", "theme", "header", "headerBadge", "headerHeightPct", "citations", "captionsOn", "captionStyle", "captionSize", "captionLines", "captionZonePct", "lowerThird", "ticker", "music", "coldOpen", "shotSec", "palette", "map", "safeArea"],
    palette: ["bg", "ink", "accent", "highlight", "panel", "outroBg"],
    lookMap: ["base", "softBorders", "highlightGlow", "countryLabels"],
    outro: ["enabled", "durationSec", "line1", "link", "handle", "showXLogo"],
    output: ["aspect", "fps"],
    link: ["label", "url"],
    story: ["id", "slug", "title", "durationSec", "location", "camera", "cards", "sources", "script", "captions", "summary", "date", "credit", "creditUrl", "asReported", "media", "audioOverlays", "content", "highlight", "voiceover", "eventWindow"],
    location: ["name", "lat", "lon", "precision", "verified", "note", "a3", "look"],
    locLook: ["lat", "lon", "name", "note"],
    camera: ["id", "preset", "at", "center", "zoom", "pitch", "bearing", "durationSec", "ease", "cut", "citation"],
    citation: ["type", "date", "credit", "license"],
    card: ["id", "kind", "title", "body", "why", "facts", "sourceIds", "pin", "at", "dur", "position", "verified"],
    fact: ["label", "value"],
    source: ["id", "label", "url", "status", "note"],
    caption: ["start", "end", "text"],
    mediaShot: ["mediaRef", "role", "at", "dur", "citation", "caption"],
    audio: ["id", "mediaRef", "volume", "offset", "loop", "at", "dur", "mediaDur"],
    content: ["id", "kind", "mediaRef", "embedUrl", "credit", "title", "caption", "visible", "at", "dur", "order", "pin", "overlay"],
    overlay: ["mode", "x", "y", "width", "height", "opacity"],
    pin: ["lat", "lon"],
    highlight: ["a3", "geojson"],
    eventWindow: ["start", "end"],
    mediaBin: ["ref", "name", "kind", "local", "note", "size", "type"],
    evLayer: ["id", "name", "color", "icon", "visible", "labels", "styleByCategory", "scope", "note", "features"],
    evFeature: ["type", "id", "geometry", "properties"],
    evGeom: ["type", "coordinates"],
    evProps: ["kind", "title", "eventTime", "eventEnd", "timeApprox", "datePrecision", "category", "verification", "sources", "citation", "notes", "precisionLabel", "radiusKm", "cardId", "storyId", "example"],
    evSource: ["label", "url", "status", "note", "id"]
  };

  function knownEpisodeSchema(s) { return s === CURRENT || LEGACY.indexOf(s) >= 0; }

  function httpsOk(s) {
    if (GD.sanitize && GD.sanitize.isHttpsUrl) return GD.sanitize.isHttpsUrl(s);
    try {
      const u = new URL(s);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch (e) { return false; }
  }

  function unknown(obj, allowed, path, errs) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
    Object.keys(obj).forEach((k) => {
      if (allowed.indexOf(k) < 0) errs.push(path + ": unknown key " + k);
    });
  }
  function isStr(v, path, max, errs) {
    if (typeof v !== "string") { errs.push(path + " must be a string"); return false; }
    if (v.length > max) { errs.push(path + " is longer than " + max + " characters"); return false; }
    return true;
  }
  function isNum(v, path, lo, hi, errs, allowNull) {
    if (allowNull && (v === null || v === undefined)) return true;
    if (typeof v !== "number" || !Number.isFinite(v)) { errs.push(path + " must be a finite number"); return false; }
    if (lo != null && v < lo) { errs.push(path + " must be ≥ " + lo); return false; }
    if (hi != null && v > hi) { errs.push(path + " must be ≤ " + hi); return false; }
    return true;
  }
  function isBool(v, path, errs, allowNull) {
    if (allowNull && (v === null || v === undefined)) return true;
    if (typeof v !== "boolean") { errs.push(path + " must be a boolean"); return false; }
    return true;
  }
  function isArr(v, path, max, errs) {
    if (!Array.isArray(v)) { errs.push(path + " must be an array"); return false; }
    if (max != null && v.length > max) { errs.push(path + " has more than " + max + " items"); return false; }
    return true;
  }
  function citeErrors(c, path, errs) {
    if (c == null) return;
    if (typeof c !== "object" || Array.isArray(c)) { errs.push(path + " must be an object"); return; }
    unknown(c, KEYS.citation, path, errs);
    ["type", "date", "credit", "license"].forEach((k) => { if (c[k] != null) isStr(c[k], path + "." + k, LIMITS.str.short, errs); });
  }

  function pinErrors(p, path, errs, allowNull) {
    if (p == null) { if (!allowNull) errs.push(path + " is required"); return; }
    if (typeof p !== "object" || Array.isArray(p)) { errs.push(path + " must be an object"); return; }
    unknown(p, KEYS.pin, path, errs);
    if (p.lat != null) isNum(p.lat, path + ".lat", -90, 90, errs, true);
    if (p.lon != null) isNum(p.lon, path + ".lon", -180, 180, errs, true);
  }

  function contentErrors(el, path) {
    const errs = [];
    if (!el || typeof el !== "object" || Array.isArray(el)) return [path + ": not an object"];
    unknown(el, KEYS.content, path, errs);
    if (!el.id || !isStr(el.id, path + ".id", LIMITS.str.id, errs)) errs.push(path + ": id missing");
    if (CONTENT_KINDS.indexOf(el.kind) < 0) errs.push(path + ": kind must be " + CONTENT_KINDS.join("|"));
    if (el.mediaRef != null) isStr(el.mediaRef, path + ".mediaRef", LIMITS.str.id, errs);
    if (el.title != null) isStr(el.title, path + ".title", LIMITS.str.short, errs);
    if (el.caption != null) isStr(el.caption, path + ".caption", LIMITS.str.medium, errs);
    if (el.credit != null) isStr(el.credit, path + ".credit", LIMITS.str.medium, errs);
    if (el.visible != null) isBool(el.visible, path + ".visible", errs);
    if (el.at != null) isNum(el.at, path + ".at", 0, 3600, errs);
    if (el.dur != null) isNum(el.dur, path + ".dur", 0, 3600, errs);
    if (el.order != null) isNum(el.order, path + ".order", -1000, 1000, errs);
    if (el.embedUrl) {
      if (!httpsOk(el.embedUrl) || (GD.sanitize && !GD.sanitize.embedInfo(el.embedUrl))) errs.push(path + ": embedUrl is not an allowlisted https URL");
      if (!(el.credit && String(el.credit).trim())) errs.push(path + ": credit is required for embeds");
      if (el.embedUrl.length > LIMITS.str.url) errs.push(path + ".embedUrl is longer than " + LIMITS.str.url + " characters");
    }
    if (el.kind === "embed" && !el.embedUrl) errs.push(path + ": embed needs embedUrl");
    if (el.overlay != null) {
      if (typeof el.overlay !== "object" || Array.isArray(el.overlay)) errs.push(path + ".overlay must be an object");
      else {
        unknown(el.overlay, KEYS.overlay, path + ".overlay", errs);
        if (el.overlay.mode != null && OVERLAY_MODES.indexOf(el.overlay.mode) < 0) errs.push(path + ".overlay.mode must be pip|full");
        if (el.overlay.x != null) isNum(el.overlay.x, path + ".overlay.x", 0, 100, errs);
        if (el.overlay.y != null) isNum(el.overlay.y, path + ".overlay.y", 0, 100, errs);
        if (el.overlay.width != null) isNum(el.overlay.width, path + ".overlay.width", 0, 100, errs);
        if (el.overlay.height != null) isNum(el.overlay.height, path + ".overlay.height", 0, 100, errs);
        if (el.overlay.opacity != null) isNum(el.overlay.opacity, path + ".overlay.opacity", 0, 1, errs);
      }
    }
    if (el.pin !== undefined) pinErrors(el.pin, path + ".pin", errs, true);
    return errs;
  }

  function audioErrors(o, path) {
    const errs = [];
    if (!o || typeof o !== "object" || Array.isArray(o)) return [path + ": not an object"];
    unknown(o, KEYS.audio, path, errs);
    if (!o.id || !isStr(o.id, path + ".id", LIMITS.str.id, errs)) errs.push(path + ": id missing");
    if (!o.mediaRef || !isStr(o.mediaRef, path + ".mediaRef", LIMITS.str.id, errs)) errs.push(path + ": mediaRef missing");
    if (o.volume != null && !isNum(o.volume, path + ".volume", 0, 1, errs)) { /* already recorded */ }
    if (o.offset != null) isNum(o.offset, path + ".offset", -3600, 3600, errs);
    if (o.loop != null) isBool(o.loop, path + ".loop", errs);
    if (o.at != null) isNum(o.at, path + ".at", 0, 3600, errs);
    if (o.dur != null) isNum(o.dur, path + ".dur", 0, 3600, errs, true);
    if (o.mediaDur != null) isNum(o.mediaDur, path + ".mediaDur", 0, 3600, errs, true);
    return errs;
  }

  function lookErrors(L, path, errs) {
    if (L == null) return;
    if (typeof L !== "object" || Array.isArray(L)) { errs.push(path + " must be an object"); return; }
    unknown(L, KEYS.look, path, errs);
    if (L.label != null) isStr(L.label, path + ".label", LIMITS.str.medium, errs);
    if (L.theme != null) {
      isStr(L.theme, path + ".theme", LIMITS.str.short, errs);
      if (THEMES.indexOf(L.theme) < 0) errs.push(path + ".theme must be frog|ctd|newsdesk");
    }
    ["header", "citations", "captionsOn", "lowerThird", "ticker", "music", "coldOpen", "safeArea"].forEach((k) => {
      if (L[k] != null) isBool(L[k], path + "." + k, errs);
    });
    if (L.headerBadge != null) isStr(L.headerBadge, path + ".headerBadge", LIMITS.str.short, errs);
    if (L.headerHeightPct != null) isNum(L.headerHeightPct, path + ".headerHeightPct", 0, 40, errs);
    if (L.captionZonePct != null) isNum(L.captionZonePct, path + ".captionZonePct", 0, 40, errs);
    if (L.captionLines != null) isNum(L.captionLines, path + ".captionLines", 1, 4, errs);
    if (L.shotSec != null) isNum(L.shotSec, path + ".shotSec", 0.5, 120, errs);
    if (L.captionStyle != null && CAP_STYLES.indexOf(L.captionStyle) < 0) errs.push(path + ".captionStyle must be shadow|box");
    if (L.captionSize != null && CAP_SIZES.indexOf(L.captionSize) < 0) errs.push(path + ".captionSize must be small|medium|large");
    if (L.palette != null) {
      if (typeof L.palette !== "object" || Array.isArray(L.palette)) errs.push(path + ".palette must be an object");
      else {
        unknown(L.palette, KEYS.palette, path + ".palette", errs);
        KEYS.palette.forEach((k) => { if (L.palette[k] != null) isStr(L.palette[k], path + ".palette." + k, LIMITS.str.color, errs); });
      }
    }
    if (L.map != null) {
      if (typeof L.map !== "object" || Array.isArray(L.map)) errs.push(path + ".map must be an object");
      else {
        unknown(L.map, KEYS.lookMap, path + ".map", errs);
        if (L.map.base != null) isStr(L.map.base, path + ".map.base", LIMITS.str.id, errs);
        if (L.map.softBorders != null) isBool(L.map.softBorders, path + ".map.softBorders", errs);
        if (L.map.highlightGlow != null) isBool(L.map.highlightGlow, path + ".map.highlightGlow", errs);
        if (L.map.countryLabels != null) isStr(L.map.countryLabels, path + ".map.countryLabels", LIMITS.str.short, errs);
      }
    }
  }

  function storyErrors(s, i, errs) {
    const p = "story " + (i + 1);
    if (!s || typeof s !== "object" || Array.isArray(s)) { errs.push(p + " must be an object"); return; }
    unknown(s, KEYS.story, p, errs);
    if (!s.id) errs.push(p + ": id missing");
    else isStr(s.id, p + ".id", LIMITS.str.id, errs);
    if (s.slug != null) isStr(s.slug, p + ".slug", LIMITS.str.short, errs);
    if (s.title != null) isStr(s.title, p + ".title", LIMITS.str.short, errs);
    if (s.summary != null) isStr(s.summary, p + ".summary", LIMITS.str.medium, errs);
    if (s.date != null) isStr(s.date, p + ".date", LIMITS.str.short, errs);
    if (s.credit != null) isStr(s.credit, p + ".credit", LIMITS.str.medium, errs);
    if (s.script != null) isStr(s.script, p + ".script", LIMITS.str.long, errs);
    if (s.asReported != null) isBool(s.asReported, p + ".asReported", errs);
    if (s.durationSec != null) isNum(s.durationSec, p + ".durationSec", 0.1, 3600, errs);
    if (s.creditUrl) {
      if (!httpsOk(s.creditUrl)) errs.push(p + ": credit URL must be https");
      if (String(s.creditUrl).length > LIMITS.str.url) errs.push(p + ".creditUrl is longer than " + LIMITS.str.url + " characters");
    } else if (s.creditUrl != null && s.creditUrl !== "") {
      isStr(s.creditUrl, p + ".creditUrl", LIMITS.str.url, errs);
    }
    if (s.voiceover != null) isStr(s.voiceover, p + ".voiceover", LIMITS.str.id, errs);
    if (!s.location || typeof s.location !== "object" || Array.isArray(s.location)) errs.push(p + ": location missing");
    else {
      const loc = s.location;
      unknown(loc, KEYS.location, p + ".location", errs);
      if (loc.name != null) isStr(loc.name, p + ".location.name", LIMITS.str.short, errs);
      isNum(loc.lat, p + ".location.lat", -90, 90, errs, true);
      isNum(loc.lon, p + ".location.lon", -180, 180, errs, true);
      if (loc.precision != null) isStr(loc.precision, p + ".location.precision", LIMITS.str.short, errs);
      if (loc.verified != null) isBool(loc.verified, p + ".location.verified", errs);
      if (loc.note != null) isStr(loc.note, p + ".location.note", LIMITS.str.medium, errs);
      if (loc.a3 != null) isStr(loc.a3, p + ".location.a3", 8, errs);
      if (loc.look != null) {
        if (typeof loc.look !== "object" || Array.isArray(loc.look)) errs.push(p + ".location.look must be an object");
        else {
          unknown(loc.look, KEYS.locLook, p + ".location.look", errs);
          isNum(loc.look.lat, p + ".location.look.lat", -90, 90, errs, true);
          isNum(loc.look.lon, p + ".location.look.lon", -180, 180, errs, true);
          if (loc.look.name != null) isStr(loc.look.name, p + ".location.look.name", LIMITS.str.short, errs);
          if (loc.look.note != null) isStr(loc.look.note, p + ".location.look.note", LIMITS.str.medium, errs);
        }
      }
    }
    if (s.camera != null) {
      if (isArr(s.camera, p + ".camera", LIMITS.count.camera, errs)) {
        s.camera.forEach((k, j) => {
          const cp = p + " camera " + (j + 1);
          if (!k || typeof k !== "object" || Array.isArray(k)) { errs.push(cp + " must be an object"); return; }
          unknown(k, KEYS.camera, cp, errs);
          if (k.id != null) isStr(k.id, cp + ".id", LIMITS.str.id, errs);
          if (k.preset != null && PRESETS.indexOf(k.preset) < 0) errs.push(cp + ": preset must be " + PRESETS.join("|"));
          if (k.at != null) isNum(k.at, cp + ".at", 0, 3600, errs);
          if (k.zoom != null) isNum(k.zoom, cp + ".zoom", 0, 24, errs);
          if (k.pitch != null) isNum(k.pitch, cp + ".pitch", 0, 85, errs);
          if (k.bearing != null) isNum(k.bearing, cp + ".bearing", -360, 360, errs);
          if (k.durationSec != null) isNum(k.durationSec, cp + ".durationSec", 0, 3600, errs);
          if (k.ease != null && EASES.indexOf(k.ease) < 0) errs.push(cp + ": ease must be " + EASES.join("|"));
          if (k.cut != null) isBool(k.cut, cp + ".cut", errs);
          if (k.center != null) {
            if (!Array.isArray(k.center) || k.center.length !== 2) errs.push(cp + ".center must be [lon, lat]");
            else {
              isNum(k.center[0], cp + ".center[0]", -180, 180, errs);
              isNum(k.center[1], cp + ".center[1]", -90, 90, errs);
            }
          }
          citeErrors(k.citation, cp + ".citation", errs);
        });
      }
    } else {
      errs.push(p + ": camera[] missing");
    }
    if (s.cards != null) {
      if (isArr(s.cards, p + ".cards", LIMITS.count.cards, errs)) {
        s.cards.forEach((c, j) => {
          const cp = p + " card " + (j + 1);
          if (!c || typeof c !== "object" || Array.isArray(c)) { errs.push(cp + " must be an object"); return; }
          unknown(c, KEYS.card, cp, errs);
          if (c.id != null) isStr(c.id, cp + ".id", LIMITS.str.id, errs);
          if (c.kind != null && CARD_KINDS.indexOf(c.kind) < 0) errs.push(cp + ": kind must be " + CARD_KINDS.join("|"));
          if (c.title != null) isStr(c.title, cp + ".title", LIMITS.str.short, errs);
          if (c.body != null) isStr(c.body, cp + ".body", LIMITS.str.medium, errs);
          if (c.why != null) isStr(c.why, cp + ".why", LIMITS.str.medium, errs);
          if (c.position != null && POSITIONS.indexOf(c.position) < 0) errs.push(cp + ": position must be left|right|center");
          if (c.verified != null) isBool(c.verified, cp + ".verified", errs);
          if (c.at != null) isNum(c.at, cp + ".at", 0, 3600, errs);
          if (c.dur != null) isNum(c.dur, cp + ".dur", 0, 3600, errs);
          if (c.pin !== undefined) pinErrors(c.pin, cp + ".pin", errs, true);
          if (c.facts != null && isArr(c.facts, cp + ".facts", LIMITS.count.facts, errs)) {
            c.facts.forEach((f, n) => {
              if (!f || typeof f !== "object") { errs.push(cp + " fact " + (n + 1) + " must be an object"); return; }
              unknown(f, KEYS.fact, cp + " fact " + (n + 1), errs);
              if (f.label != null) isStr(f.label, cp + " fact " + (n + 1) + ".label", LIMITS.str.short, errs);
              if (f.value != null) isStr(f.value, cp + " fact " + (n + 1) + ".value", LIMITS.str.medium, errs);
            });
          }
          if (c.sourceIds != null && isArr(c.sourceIds, cp + ".sourceIds", LIMITS.count.sourceIds, errs)) {
            c.sourceIds.forEach((id, n) => isStr(id, cp + ".sourceIds[" + n + "]", LIMITS.str.id, errs));
          }
        });
      }
    }
    if (s.sources != null) {
      if (isArr(s.sources, p + ".sources", LIMITS.count.sources, errs)) {
        s.sources.forEach((src, j) => {
          const sp = p + " source " + (j + 1);
          if (!src || typeof src !== "object" || Array.isArray(src)) { errs.push(sp + " must be an object"); return; }
          unknown(src, KEYS.source, sp, errs);
          if (src.id != null) isStr(src.id, sp + ".id", LIMITS.str.id, errs);
          if (src.label != null) isStr(src.label, sp + ".label", LIMITS.str.short, errs);
          if (src.note != null) isStr(src.note, sp + ".note", LIMITS.str.medium, errs);
          if (src.status != null && SOURCE_STATUS.indexOf(src.status) < 0) errs.push(p + ": source status must be verified|unverified");
          if (src.url) {
            if (!httpsOk(src.url)) errs.push(p + ": source url must be https");
            if (String(src.url).length > LIMITS.str.url) errs.push(sp + ".url is longer than " + LIMITS.str.url + " characters");
          } else if (src.url != null && src.url !== "") isStr(src.url, sp + ".url", LIMITS.str.url, errs);
        });
      }
    }
    if (s.captions != null && isArr(s.captions, p + ".captions", LIMITS.count.captions, errs)) {
      s.captions.forEach((c, j) => {
        const cp = p + " caption " + (j + 1);
        if (!c || typeof c !== "object" || Array.isArray(c)) { errs.push(cp + " must be an object"); return; }
        unknown(c, KEYS.caption, cp, errs);
        if (c.start != null) isNum(c.start, cp + ".start", 0, 3600, errs);
        if (c.end != null) isNum(c.end, cp + ".end", 0, 3600, errs);
        if (c.text != null) isStr(c.text, cp + ".text", LIMITS.str.medium, errs);
      });
    }
    if (s.media != null && isArr(s.media, p + ".media", LIMITS.count.media, errs)) {
      s.media.forEach((m, j) => {
        const mp = p + " media " + (j + 1);
        if (!m || typeof m !== "object" || Array.isArray(m)) { errs.push(mp + " must be an object"); return; }
        unknown(m, KEYS.mediaShot, mp, errs);
        if (m.mediaRef != null) isStr(m.mediaRef, mp + ".mediaRef", LIMITS.str.id, errs);
        if (m.role != null && MEDIA_ROLES.indexOf(m.role) < 0) errs.push(mp + ": role must be " + MEDIA_ROLES.join("|"));
        if (m.at != null) isNum(m.at, mp + ".at", 0, 3600, errs);
        if (m.dur != null) isNum(m.dur, mp + ".dur", 0, 3600, errs);
        if (m.caption != null) isStr(m.caption, mp + ".caption", LIMITS.str.medium, errs);
        citeErrors(m.citation, mp + ".citation", errs);
      });
    }
    if (s.audioOverlays != null) {
      if (isArr(s.audioOverlays, p + ".audioOverlays", LIMITS.count.audioOverlays, errs)) {
        s.audioOverlays.forEach((o, j) => audioErrors(o, p + " audio " + (j + 1)).forEach((e) => errs.push(e)));
      }
    }
    if (s.content != null) {
      if (isArr(s.content, p + ".content", LIMITS.count.content, errs)) {
        s.content.forEach((c, j) => contentErrors(c, p + " content " + (j + 1)).forEach((e) => errs.push(e)));
      }
    }
    if (s.highlight != null) {
      if (typeof s.highlight !== "object" || Array.isArray(s.highlight)) errs.push(p + ".highlight must be an object");
      else {
        unknown(s.highlight, KEYS.highlight, p + ".highlight", errs);
        if (s.highlight.a3 != null) isStr(s.highlight.a3, p + ".highlight.a3", 8, errs);
        if (s.highlight.geojson != null) {
          if (typeof s.highlight.geojson !== "object") errs.push(p + ".highlight.geojson must be an object or null");
          else {
            let n = 0;
            try { n = JSON.stringify(s.highlight.geojson).length; } catch (e) { n = LIMITS.geojson + 1; }
            if (n > LIMITS.geojson) errs.push(p + ".highlight.geojson is larger than the " + LIMITS.geojson + " byte limit");
          }
        }
      }
    }
    if (s.eventWindow != null) {
      if (typeof s.eventWindow !== "object" || Array.isArray(s.eventWindow)) errs.push(p + ".eventWindow must be an object");
      else {
        unknown(s.eventWindow, KEYS.eventWindow, p + ".eventWindow", errs);
        if (s.eventWindow.start != null) isStr(s.eventWindow.start, p + ".eventWindow.start", LIMITS.str.short, errs);
        if (s.eventWindow.end != null) isStr(s.eventWindow.end, p + ".eventWindow.end", LIMITS.str.short, errs);
      }
    }
  }

  function eventLayerShape(layers, errs) {
    if (layers == null) return;
    if (!isArr(layers, "eventLayers", LIMITS.count.eventLayers, errs)) return;
    layers.forEach((l, i) => {
      const p = "event layer " + (i + 1);
      if (!l || typeof l !== "object" || Array.isArray(l)) { errs.push(p + " must be an object"); return; }
      unknown(l, KEYS.evLayer, p, errs);
      if (l.id != null) isStr(l.id, p + ".id", LIMITS.str.id, errs);
      if (l.name != null) isStr(l.name, p + ".name", LIMITS.str.short, errs);
      if (l.color != null) isStr(l.color, p + ".color", LIMITS.str.color, errs);
      if (l.icon != null) isStr(l.icon, p + ".icon", 8, errs);
      if (l.visible != null) isBool(l.visible, p + ".visible", errs);
      if (l.labels != null) isBool(l.labels, p + ".labels", errs);
      if (l.styleByCategory != null) isBool(l.styleByCategory, p + ".styleByCategory", errs);
      if (l.scope != null) isStr(l.scope, p + ".scope", LIMITS.str.short, errs);
      if (l.note != null) isStr(l.note, p + ".note", LIMITS.str.medium, errs);
      if (l.features != null && isArr(l.features, p + ".features", LIMITS.count.features, errs)) {
        l.features.forEach((f, j) => {
          const fp = p + " feature " + (j + 1);
          if (!f || typeof f !== "object") { errs.push(fp + " must be an object"); return; }
          unknown(f, KEYS.evFeature, fp, errs);
          if (f.id != null && typeof f.id !== "string" && typeof f.id !== "number") errs.push(fp + ".id must be a string or number");
          if (f.geometry != null) {
            if (typeof f.geometry !== "object" || Array.isArray(f.geometry)) errs.push(fp + ".geometry must be an object");
            else unknown(f.geometry, KEYS.evGeom, fp + ".geometry", errs);
          }
          if (f.properties != null) {
            if (typeof f.properties !== "object" || Array.isArray(f.properties)) errs.push(fp + ".properties must be an object");
            else {
              unknown(f.properties, KEYS.evProps, fp + ".properties", errs);
              const pr = f.properties;
              if (pr.title != null) isStr(pr.title, fp + ".title", LIMITS.str.short, errs);
              if (pr.notes != null) isStr(pr.notes, fp + ".notes", LIMITS.str.medium, errs);
              if (pr.precisionLabel != null) isStr(pr.precisionLabel, fp + ".precisionLabel", LIMITS.str.short, errs);
              if (pr.eventTime != null) isStr(pr.eventTime, fp + ".eventTime", LIMITS.str.short, errs);
              if (pr.eventEnd != null) isStr(pr.eventEnd, fp + ".eventEnd", LIMITS.str.short, errs);
              if (pr.kind != null) isStr(pr.kind, fp + ".kind", LIMITS.str.short, errs);
              if (pr.category != null) isStr(pr.category, fp + ".category", LIMITS.str.short, errs);
              if (pr.verification != null) isStr(pr.verification, fp + ".verification", LIMITS.str.short, errs);
              if (pr.datePrecision != null) isStr(pr.datePrecision, fp + ".datePrecision", LIMITS.str.short, errs);
              if (pr.timeApprox != null) isBool(pr.timeApprox, fp + ".timeApprox", errs);
              if (pr.example != null) isBool(pr.example, fp + ".example", errs);
              if (pr.radiusKm != null) isNum(pr.radiusKm, fp + ".radiusKm", 0, 20000, errs, true);
              if (pr.cardId != null) isStr(pr.cardId, fp + ".cardId", LIMITS.str.id, errs);
              if (pr.storyId != null) isStr(pr.storyId, fp + ".storyId", LIMITS.str.id, errs);
              citeErrors(pr.citation, fp + ".citation", errs);
              if (pr.sources != null && isArr(pr.sources, fp + ".sources", LIMITS.count.sources, errs)) {
                pr.sources.forEach((src, n) => {
                  if (!src || typeof src !== "object") { errs.push(fp + " source " + (n + 1) + " must be an object"); return; }
                  unknown(src, KEYS.evSource, fp + " source " + (n + 1), errs);
                  if (src.label != null) isStr(src.label, fp + " source " + (n + 1) + ".label", LIMITS.str.short, errs);
                  if (src.note != null) isStr(src.note, fp + " source " + (n + 1) + ".note", LIMITS.str.medium, errs);
                  if (src.url) {
                    if (!httpsOk(src.url)) errs.push(fp + " source url must be https");
                  }
                });
              }
            }
          }
        });
      }
    });
  }

  function extraValidate(ep) {
    const errs = [];
    if (!ep || typeof ep !== "object" || Array.isArray(ep)) return ["Not an object"];
    unknown(ep, KEYS.episode, "episode", errs);
    if (!knownEpisodeSchema(ep.schema)) errs.push("schema must be " + CURRENT + " (or legacy globedesk.episode/1 / gobedesk.episode/1)");
    if (ep.id != null) isStr(ep.id, "id", LIMITS.str.id, errs);
    if (ep.show != null) isStr(ep.show, "show", LIMITS.str.short, errs);
    if (ep.title != null) isStr(ep.title, "title", LIMITS.str.short, errs);
    if (ep.date != null) isStr(ep.date, "date", LIMITS.str.short, errs);
    if (ep.lede != null) isStr(ep.lede, "lede", LIMITS.str.medium, errs);
    if (ep.cta != null) isStr(ep.cta, "cta", LIMITS.str.medium, errs);
    if (ep.handle != null) isStr(ep.handle, "handle", LIMITS.str.short, errs);
    if (ep.demo != null) isBool(ep.demo, "demo", errs);
    if (ep.sample != null) isBool(ep.sample, "sample", errs);
    lookErrors(ep.look, "look", errs);
    if (ep.outro != null) {
      if (typeof ep.outro !== "object" || Array.isArray(ep.outro)) errs.push("outro must be an object");
      else {
        unknown(ep.outro, KEYS.outro, "outro", errs);
        if (ep.outro.enabled != null) isBool(ep.outro.enabled, "outro.enabled", errs);
        if (ep.outro.durationSec != null) isNum(ep.outro.durationSec, "outro.durationSec", 0, 3600, errs);
        if (ep.outro.line1 != null) isStr(ep.outro.line1, "outro.line1", LIMITS.str.short, errs);
        if (ep.outro.link != null) isStr(ep.outro.link, "outro.link", LIMITS.str.medium, errs);
        if (ep.outro.handle != null) isStr(ep.outro.handle, "outro.handle", LIMITS.str.short, errs);
        if (ep.outro.showXLogo != null) isBool(ep.outro.showXLogo, "outro.showXLogo", errs);
      }
    }
    if (ep.output != null) {
      if (typeof ep.output !== "object" || Array.isArray(ep.output)) errs.push("output must be an object");
      else {
        unknown(ep.output, KEYS.output, "output", errs);
        if (ep.output.aspect != null && ASPECTS.indexOf(ep.output.aspect) < 0) errs.push("output.aspect must be 16:9 or 9:16");
        if (ep.output.fps != null) isNum(ep.output.fps, "output.fps", 1, 60, errs);
      }
    }
    if (ep.links != null && isArr(ep.links, "links", LIMITS.count.links, errs)) {
      ep.links.forEach((ln, i) => {
        const p = "link " + (i + 1);
        if (!ln || typeof ln !== "object" || Array.isArray(ln)) { errs.push(p + " must be an object"); return; }
        unknown(ln, KEYS.link, p, errs);
        if (ln.label != null) isStr(ln.label, p + ".label", LIMITS.str.short, errs);
        if (ln.url) {
          if (!httpsOk(ln.url)) errs.push(p + ": url must be https");
        } else if (ln.url != null && ln.url !== "") isStr(ln.url, p + ".url", LIMITS.str.url, errs);
      });
    }
    if (!Array.isArray(ep.stories)) errs.push("stories[] missing");
    else if (isArr(ep.stories, "stories", LIMITS.count.stories, errs)) {
      ep.stories.forEach((s, i) => storyErrors(s, i, errs));
    }
    if (ep.mediaBin != null && isArr(ep.mediaBin, "mediaBin", LIMITS.count.mediaBin, errs)) {
      ep.mediaBin.forEach((b, i) => {
        const p = "mediaBin " + (i + 1);
        if (!b || typeof b !== "object" || Array.isArray(b)) { errs.push(p + " must be an object"); return; }
        unknown(b, KEYS.mediaBin, p, errs);
        if (b.ref != null) isStr(b.ref, p + ".ref", LIMITS.str.id, errs);
        if (b.name != null) isStr(b.name, p + ".name", LIMITS.str.short, errs);
        if (b.kind != null && MEDIA_KINDS.indexOf(b.kind) < 0) errs.push(p + ".kind must be " + MEDIA_KINDS.join("|"));
        if (b.local != null) isBool(b.local, p + ".local", errs);
        if (b.note != null) isStr(b.note, p + ".note", LIMITS.str.medium, errs);
        if (b.type != null) isStr(b.type, p + ".type", LIMITS.str.short, errs);
        if (b.size != null) isNum(b.size, p + ".size", 0, 512 * 1024 * 1024, errs);
      });
    }
    eventLayerShape(ep.eventLayers, errs);
    try {
      const n = JSON.stringify(ep).length;
      if (n > LIMITS.projectJson) errs.push("episode JSON is larger than the " + LIMITS.projectJson + " byte limit");
    } catch (e) {
      errs.push("episode JSON could not be measured");
    }
    return errs;
  }

  function validateEpisode(ep) {
    const base = (GD.model && GD.model.validate) ? GD.model.validate(ep) : [];
    return base.concat(extraValidate(ep).filter((e) => base.indexOf(e) < 0 && !(/^schema must be/.test(e) && base.some((b) => b.startsWith("schema")))));
  }

  function validate(ep) {
    if (!ep || typeof ep !== "object") return ["Not an object"];
    const errs = [];
    if (GD.model && GD.model.validate) GD.model.validate(ep).forEach((e) => errs.push(e));
    extraValidate(ep).forEach((e) => { if (errs.indexOf(e) < 0 && !(e.startsWith("schema") && errs.some((x) => x.startsWith("schema")))) errs.push(e); });
    return errs;
  }

  GD.schema = { CURRENT, LEGACY, PROJECT, CONTENT_KINDS, LIMITS, KEYS, knownEpisodeSchema, contentErrors, audioErrors, validate, extraValidate, validateEpisode, httpsOk };
})();
