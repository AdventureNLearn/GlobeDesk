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
  const THEMES = ["globedesk", "newsdesk"];
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
      audioOverlays: 24, content: 40, facts: 24, sourceIds: 40,
      claims: 400, disagreeGroups: 8, outboundTargets: 40, openIn: 40, gisOverlayIds: 40,
      researchStories: 80, researchQuotes: 80, researchGaps: 80, researchUpdates: 200,
      recordCatalogs: 40, records: 400, recordCitations: 16
    }
  };
  const CLAIM_STATUS = ["supported", "not-proven", "disputed", "people-disagree"];
  const RESEARCH_LINK_KINDS = ["official", "coverage", "other"];
  const RECORD_KINDS = ["event", "voyage", "event-sequence", "case"];
  const RECORD_CONFIDENCE = ["high", "medium", "low"];
  const PERSONAL_FIELD = /^(owner|address|phone|email|valuation|street|occupant)([A-Z_].*)?$/i;

  const KEYS = {
    episode: ["schema", "id", "show", "title", "date", "lede", "cta", "links", "demo", "sample", "look", "handle", "outro", "output", "stories", "eventLayers", "mediaBin"],
    look: ["label", "theme", "header", "headerBadge", "headerHeightPct", "citations", "captionsOn", "captionStyle", "captionSize", "captionLines", "captionZonePct", "lowerThird", "ticker", "music", "coldOpen", "shotSec", "palette", "map", "safeArea"],
    palette: ["bg", "ink", "accent", "highlight", "panel", "outroBg"],
    lookMap: ["base", "softBorders", "highlightGlow", "countryLabels"],
    outro: ["enabled", "durationSec", "line1", "link", "handle", "showXLogo"],
    output: ["aspect", "fps"],
    link: ["label", "url"],
    story: ["id", "slug", "title", "durationSec", "location", "camera", "cards", "sources", "script", "captions", "summary", "date", "credit", "creditUrl", "asReported", "media", "audioOverlays", "content", "highlight", "voiceover", "eventWindow", "openIn", "gisOverlayIds"],
    location: ["name", "lat", "lon", "precision", "verified", "note", "a3", "look"],
    locLook: ["lat", "lon", "name", "note"],
    camera: ["id", "preset", "at", "center", "zoom", "pitch", "bearing", "durationSec", "ease", "cut", "citation"],
    citation: ["type", "date", "credit", "license"],
    card: ["id", "kind", "title", "body", "why", "facts", "sourceIds", "pin", "at", "dur", "position", "verified"],
    fact: ["label", "value"],
    claimsFile: ["schema", "generated", "note", "claims"],
    claim: ["id", "storyId", "cardId", "factIndex", "factLabel", "claimStatus", "sourceIds", "disagree"],
    disagreeGroup: ["sourceIds", "position"],
    outboundFile: ["schema", "generated", "note", "checked", "targets"],
    outboundTarget: ["id", "label", "url", "credit", "enabled", "status", "reason", "sectionIds", "storyIds"],
    researchFile: ["schema", "generated", "note", "stories"],
    researchStory: ["storyId", "links", "quotes", "gaps", "updates", "claimIds", "recordIds"],
    researchLink: ["id", "label", "url", "kind"],
    researchQuote: ["id", "text", "sourceId", "retrieved", "locator"],
    researchGap: ["id", "label", "detail", "isGap", "closed"],
    researchUpdate: ["id", "at", "note", "sourceId"],
    recordsFile: ["schema", "generated", "note", "catalogs"],
    recordsCatalog: ["id", "name", "kind", "credit", "license", "terms", "storyId", "layerId", "records", "note"],
    record: ["id", "title", "kind", "place", "lat", "lon", "precision", "precisionLabel", "date", "dateEnd", "citations", "confidence", "reconstruction", "claimStatus", "license", "credit", "pathId", "storyId", "note"],
    recordCitation: ["id", "label", "url", "note"],
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
    if (typeof s !== "string" || !s || /\s/.test(s)) return false;
    if (GD.sanitize && GD.sanitize.isHttpsUrl) return GD.sanitize.isHttpsUrl(s);
    try {
      const u = new URL(s);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch (e) { return false; }
  }

  const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

  function decodeUrlPart(s) {
    try { return decodeURIComponent(String(s || "").replace(/\+/g, " ")); } catch (e) { return String(s || ""); }
  }

  function decodeTwice(s) {
    return decodeUrlPart(decodeUrlPart(s));
  }

  function digitCount(s) {
    return (String(s).match(/\d/g) || []).length;
  }

  function isDateToken(s) {
    return /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})$/.test(s);
  }

  function isVersionToken(s) {
    if (/^\d{3}\.\d{3}\.\d{4}$/.test(String(s).trim())) return false;
    return /^v?\d+(?:\.\d+){1,4}(?:-[A-Za-z0-9.]+)?$/i.test(s);
  }

  function isYearRangeToken(s) {
    return /^\d{4}\s*[-–—]\s*\d{4}$/.test(String(s).trim().replace(/[.,;:]+$/, ""));
  }

  function isNanpPhoneToken(s) {
    return /^\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}$/.test(String(s).trim().replace(/[.,;:]+$/, ""));
  }

  function isbn10Body(compact) {
    return /^\d{9}[\dXx]$/.test(compact);
  }

  function isbn10ChecksumOk(compact) {
    if (!isbn10Body(compact)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(compact.charAt(i)) * (10 - i);
    const last = compact.charAt(9);
    sum += (last === "X" || last === "x") ? 10 : Number(last);
    return sum % 11 === 0;
  }

  function isbn10Or13Body(chunk, rest) {
    let compact = String(chunk || "").replace(/[-\s]/g, "");
    const x = String(rest || "").match(/^[\s\-]*([Xx])(?![A-Za-z0-9])/);
    if (x && compact.length === 9) compact += x[1];
    return isbn10ChecksumOk(compact) || /^978\d{10}$/.test(compact) || /^979\d{10}$/.test(compact);
  }

  function isIsbnPrefixToken(s) {
    return /^ISBN[-:\s]*$/i.test(String(s || "").trim().replace(/[.,;:]+$/, ""));
  }

  function isbnPrefixBeside(s, index) {
    return /ISBN[-:\s]*$/i.test(String(s || "").slice(0, index));
  }

  function isIsbnToken(s, prev) {
    const raw = String(s).trim().replace(/[.,;:]+$/, "");
    if (isNanpPhoneToken(raw)) return false;
    const hasPrefix = /^ISBN/i.test(raw) || isIsbnPrefixToken(prev);
    const core = raw.replace(/^ISBN[-:\s]*/i, "");
    const compact = core.replace(/[-\s]/g, "");
    if (/^978\d{10}$/.test(compact) || /^979\d{10}$/.test(compact)) return true;
    if (hasPrefix && isbn10ChecksumOk(compact)) return true;
    return false;
  }

  function isCoordinatePairToken(s) {
    const t = String(s).trim().replace(/[.,;:]+$/, "");
    const m = t.match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
    if (!m) return false;
    const a = Number(m[1]), b = Number(m[2]);
    const latlon = (x, y) => Math.abs(x) <= 90 && Math.abs(y) <= 180;
    return latlon(a, b) || latlon(b, a);
  }

  function isCoordinateToken(s) {
    if (!/^-?\d+(?:\.\d+)?$/.test(s)) return false;
    const whole = String(s).replace(/^-/, "").split(".")[0];
    return whole.length <= 3;
  }

  function isBboxToken(s) {
    const parts = String(s).split(/\s*,\s*/);
    return parts.length === 4 && parts.every(isCoordinateToken);
  }

  function isHandleToken(s) {
    return /^@[A-Za-z0-9._]+$/.test(s);
  }

  function isLetterIdToken(s) {
    return /[A-Za-z]/.test(s) && !/tel:\s*/i.test(s);
  }

  function isSafeNonPhone(s) {
    const t = String(s).trim();
    if (!t) return true;
    if (isDateToken(t) || isVersionToken(t) || isCoordinateToken(t) || isBboxToken(t) || isHandleToken(t)) return true;
    if (isYearRangeToken(t) || isIsbnToken(t) || isCoordinatePairToken(t)) return true;
    if (isLetterIdToken(t)) return true;
    return false;
  }

  function looksLikePhone(s) {
    const t = String(s).trim();
    if (!t) return false;
    if (/tel:/i.test(t)) return true;
    if (isNanpPhoneToken(t)) return true;
    if (isSafeNonPhone(t)) return false;
    const intl = t.match(/(?:\+|00)([\s.\-()]*\d){8,15}(?!\d)/);
    if (intl) {
      const n = digitCount(intl[0].replace(/^[^\d+]+/, ""));
      if (n >= 8 && n <= 15) return true;
    }
    if (/^0[\s.\-()]*\d/.test(t) && /^[\s.\-()0-9]+$/.test(t) && digitCount(t) >= 7) return true;
    if (/\d{7,}/.test(t)) return true;
    if (/^[\s.\-()+0-9]+$/.test(t) && digitCount(t) >= 7) return true;
    return false;
  }

  function tokensHavePhone(tokens) {
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (!tok) continue;
      if (isIsbnToken(tok, tokens[i - 1])) continue;
      if (looksLikePhone(tok)) return true;
    }
    return false;
  }

  function textHasPhone(s) {
    const t = String(s || "");
    if (/tel:/i.test(t)) return true;
    if (looksLikePhone(t) && !isIsbnToken(t)) return true;
    return tokensHavePhone(t.split(/[?&#=/,]/));
  }

  function urlCarriesPersonalData(s) {
    if (typeof s !== "string" || !s) return false;
    try {
      const u = new URL(s);
      const bits = [decodeTwice(u.search || ""), decodeTwice(u.hash || "")];
      if (u.searchParams) u.searchParams.forEach((v, k) => { bits.push(decodeTwice(k), decodeTwice(v)); });
      const text = bits.join("\n");
      if (EMAIL_IN_TEXT.test(text)) return true;
      return bits.some((part) => textHasPhone(part));
    } catch (e) { return false; }
  }

  function isIsoDate(s) {
    if (typeof s !== "string") return false;
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:T([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.[0-9]+)?)?(?:Z|[+-][0-9]{2}:[0-9]{2})?)?$/.exec(s);
    if (!m) return false;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return false;
    if (m[4] != null) {
      const hh = Number(m[4]), mm = Number(m[5]), ss = m[6] != null ? Number(m[6]) : 0;
      if (hh > 23 || mm > 59 || ss > 59) return false;
    }
    return true;
  }

  function requireIsoDate(v, path, errs) {
    if (!requireText(v, path, LIMITS.str.short, errs)) return false;
    if (!isIsoDate(v)) {
      errs.push(path + " must be an ISO date");
      return false;
    }
    return true;
  }

  function textCarriesPersonalData(s) {
    if (typeof s !== "string" || !s) return false;
    if (EMAIL_IN_TEXT.test(s)) return true;
    if (/tel:/i.test(s)) return true;
    const tokens = s.split(/[\s?&#=/,;]+/).filter(Boolean);
    if (tokensHavePhone(tokens)) return true;
    const re = /(?:\+|00)?(?:\d[\s.\-()]*){6,14}\d/g;
    let m;
    while ((m = re.exec(s))) {
      const chunk = m[0];
      if (isYearRangeToken(chunk) || isIsbnToken(chunk) || isCoordinatePairToken(chunk)) continue;
      if (isbnPrefixBeside(s, m.index) && isbn10Or13Body(chunk, s.slice(m.index + chunk.length))) continue;
      if (looksLikePhone(chunk)) return true;
    }
    return false;
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
      if (THEMES.indexOf(L.theme) < 0) errs.push(path + ".theme must be globedesk|newsdesk");
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

  const BUNDLED_GIS_OVERLAY_IDS = ["usgs-topo", "usgs-imagery", "usgs-nhd", "tiger-boundaries", "nowcoast-radar", "ohm"];

  function gisOverlayIdKnown(id) {
    if (BUNDLED_GIS_OVERLAY_IDS.indexOf(id) >= 0) return true;
    try {
      const gis = (typeof window !== "undefined" && window.GD && window.GD.gis) || null;
      if (gis && gis.state && gis.state.loaded && gis.state.doc && typeof gis.byId === "function" && gis.byId(id)) return true;
    } catch (e) { /* registry not available */ }
    return false;
  }

  function storyErrors(s, i, errs, warns) {
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
    if (hasKey(s, "openIn") && isArr(s.openIn, p + ".openIn", LIMITS.count.openIn, errs)) {
      s.openIn.forEach((id, n) => {
        if (typeof id !== "string" || !id.trim() || !isStr(id, p + ".openIn[" + n + "]", LIMITS.str.id, errs)) {
          errs.push(p + ".openIn[" + n + "] must not be empty");
        }
      });
    }
    if (hasKey(s, "gisOverlayIds") && isArr(s.gisOverlayIds, p + ".gisOverlayIds", LIMITS.count.gisOverlayIds, errs)) {
      s.gisOverlayIds.forEach((id, n) => {
        if (typeof id !== "string" || !id.trim() || !isStr(id, p + ".gisOverlayIds[" + n + "]", LIMITS.str.id, errs)) {
          errs.push(p + ".gisOverlayIds[" + n + "] must not be empty");
        } else if (!gisOverlayIdKnown(id) && warns) {
          warns.push(p + ".gisOverlayIds[" + n + "] is not in the GIS registry");
        }
      });
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

  function extraValidate(ep, warns) {
    const errs = [];
    warns = warns || [];
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
      ep.stories.forEach((s, i) => storyErrors(s, i, errs, warns));
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


  function storyById(ep, id) {
    if (!ep || !Array.isArray(ep.stories)) return null;
    for (let i = 0; i < ep.stories.length; i++) {
      if (ep.stories[i] && ep.stories[i].id === id) return ep.stories[i];
    }
    return null;
  }

  function storySourceIds(story) {
    const ids = {};
    if (!story || !Array.isArray(story.sources)) return ids;
    story.sources.forEach((s) => { if (s && s.id) ids[s.id] = true; });
    return ids;
  }

  function hasKey(obj, key) {
    return obj && Object.prototype.hasOwnProperty.call(obj, key);
  }

  function checkSourceIds(ids, allowed, path, errs) {
    if (ids === undefined) return;
    if (!isArr(ids, path, LIMITS.count.sourceIds, errs)) return;
    ids.forEach((id, n) => {
      const p = path + "[" + n + "]";
      if (!id || !isStr(id, p, LIMITS.str.id, errs)) {
        if (id === "") errs.push(p + " must not be empty");
        return;
      }
      if (allowed && !allowed[id]) errs.push(p + " is not a source on the story");
    });
  }

  function disagreeErrors(groups, allowed, path, errs) {
    if (!isArr(groups, path, LIMITS.count.disagreeGroups, errs)) return;
    groups.forEach((g, i) => {
      const p = path + "[" + i + "]";
      if (!g || typeof g !== "object" || Array.isArray(g)) { errs.push(p + " must be an object"); return; }
      unknown(g, KEYS.disagreeGroup, p, errs);
      if (typeof g.position !== "string" || !g.position.trim() || !isStr(g.position, p + ".position", LIMITS.str.medium, errs)) {
        errs.push(p + ": position must be a non-empty string");
      }
      if (!Array.isArray(g.sourceIds) || g.sourceIds.length < 1) {
        errs.push(p + ": sourceIds must have at least one id");
      } else {
        checkSourceIds(g.sourceIds, allowed, p + ".sourceIds", errs);
      }
    });
  }

  function claimErrors(c, i, ep, errs) {
    const p = "claim " + (i + 1);
    if (!c || typeof c !== "object" || Array.isArray(c)) { errs.push(p + " must be an object"); return; }
    unknown(c, KEYS.claim, p, errs);
    if (hasKey(c, "id") && (!c.id || !String(c.id).trim() || !isStr(c.id, p + ".id", LIMITS.str.id, errs))) {
      errs.push(p + ": id must not be empty");
    }
    if (!c.storyId || !String(c.storyId).trim() || !isStr(c.storyId, p + ".storyId", LIMITS.str.id, errs)) errs.push(p + ": storyId missing");
    if (hasKey(c, "cardId")) isStr(c.cardId, p + ".cardId", LIMITS.str.id, errs);
    if (hasKey(c, "factLabel")) isStr(c.factLabel, p + ".factLabel", LIMITS.str.short, errs);
    const factIndexOk = hasKey(c, "factIndex") && typeof c.factIndex === "number" && Number.isInteger(c.factIndex) && c.factIndex >= 0;
    if (hasKey(c, "factIndex") && !factIndexOk) {
      errs.push(p + ".factIndex must be a whole number of 0 or more");
    }
    if (hasKey(c, "claimStatus") && CLAIM_STATUS.indexOf(c.claimStatus) < 0) {
      errs.push(p + ".claimStatus must be " + CLAIM_STATUS.join("|"));
    }
    const story = ep && c.storyId ? storyById(ep, c.storyId) : null;
    if (ep && c.storyId && !story) errs.push(p + ": storyId is not a story in the episode");
    const allowed = story ? storySourceIds(story) : null;
    if (hasKey(c, "sourceIds")) checkSourceIds(c.sourceIds, allowed, p + ".sourceIds", errs);
    if (c.claimStatus === "people-disagree") {
      if (!Array.isArray(c.disagree) || c.disagree.length < 2) {
        errs.push(p + ": people-disagree needs at least two disagree groups");
      } else {
        disagreeErrors(c.disagree, allowed, p + ".disagree", errs);
      }
    } else if (hasKey(c, "disagree")) {
      errs.push(p + ": disagree is only allowed on people-disagree claims");
    }
    if ((hasKey(c, "factIndex") || hasKey(c, "factLabel")) && !c.cardId) {
      errs.push(p + ": factIndex and factLabel need a cardId");
    }
    if (story && Array.isArray(story.cards)) {
      let card = null;
      if (c.cardId) {
        story.cards.forEach((cd) => { if (cd && cd.id === c.cardId) card = cd; });
        if (!card) errs.push(p + ": cardId is not a card on the story");
      }
      if (card) {
        const facts = Array.isArray(card.facts) ? card.facts : [];
        if (factIndexOk) {
          if (c.factIndex >= facts.length) errs.push(p + ".factIndex is not a fact on the card");
          else if (typeof c.factLabel === "string" && facts[c.factIndex] && facts[c.factIndex].label !== c.factLabel) {
            errs.push(p + ".factLabel does not match fact " + c.factIndex);
          }
        } else if (typeof c.factLabel === "string" && c.factLabel) {
          const hit = facts.some((f) => f && f.label === c.factLabel);
          if (!hit) errs.push(p + ".factLabel is not a fact on the card");
        }
      }
    }
  }

  function validateClaims(doc, ep) {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return ["Not an object"];
    const errs = [];
    unknown(doc, KEYS.claimsFile, "claims file", errs);
    if (doc.schema !== "globedesk.claims/1") errs.push("schema must be globedesk.claims/1");
    if (hasKey(doc, "generated")) isStr(doc.generated, "generated", LIMITS.str.short, errs);
    if (hasKey(doc, "note")) isStr(doc.note, "note", LIMITS.str.medium, errs);
    if (!Array.isArray(doc.claims)) errs.push("claims[] missing");
    else if (isArr(doc.claims, "claims", LIMITS.count.claims, errs)) {
      const seen = {};
      doc.claims.forEach((c, i) => {
        claimErrors(c, i, ep || null, errs);
        if (c && typeof c.id === "string" && c.id) {
          if (seen[c.id]) errs.push("claim " + (i + 1) + ": duplicate id");
          seen[c.id] = true;
        }
      });
    }
    return errs;
  }


  function idListErrors(ids, path, errs) {
    if (ids === undefined) return;
    if (!isArr(ids, path, LIMITS.count.openIn, errs)) return;
    ids.forEach((id, n) => {
      if (typeof id !== "string" || !id.trim() || !isStr(id, path + "[" + n + "]", LIMITS.str.id, errs)) {
        errs.push(path + "[" + n + "] must not be empty");
      }
    });
  }

  function outboundTargetErrors(tg, i, errs) {
    const p = "outbound " + (i + 1);
    if (!tg || typeof tg !== "object" || Array.isArray(tg)) { errs.push(p + " must be an object"); return; }
    unknown(tg, KEYS.outboundTarget, p, errs);
    if (!tg.id || !String(tg.id).trim() || !isStr(tg.id, p + ".id", LIMITS.str.id, errs)) errs.push(p + ": id missing");
    if (hasKey(tg, "label")) {
      if (!tg.label || !String(tg.label).trim()) errs.push(p + ": label missing");
      else isStr(tg.label, p + ".label", LIMITS.str.short, errs);
    } else errs.push(p + ": label missing");
    if (!hasKey(tg, "enabled")) errs.push(p + ": enabled missing");
    else isBool(tg.enabled, p + ".enabled", errs);
    if (!hasKey(tg, "status")) errs.push(p + ": status missing");
    else isStr(tg.status, p + ".status", LIMITS.str.short, errs);
    if (hasKey(tg, "credit")) isStr(tg.credit, p + ".credit", LIMITS.str.medium, errs);
    if (hasKey(tg, "reason")) isStr(tg.reason, p + ".reason", LIMITS.str.medium, errs);
    if (hasKey(tg, "url")) {
      if (tg.enabled === false) errs.push(p + ": a disabled target may not carry a url");
      else if (!httpsOk(tg.url)) errs.push(p + ": url must be https");
      else if (urlCarriesPersonalData(tg.url)) errs.push(p + ": url must not carry an email or phone number");
    } else if (tg.enabled) {
      errs.push(p + ": an enabled target needs an https url");
    }
    if (hasKey(tg, "sectionIds")) idListErrors(tg.sectionIds, p + ".sectionIds", errs);
    if (hasKey(tg, "storyIds")) idListErrors(tg.storyIds, p + ".storyIds", errs);
  }

  function validateOutbound(doc) {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return ["Not an object"];
    const errs = [];
    unknown(doc, KEYS.outboundFile, "outbound file", errs);
    if (doc.schema !== "globedesk.outbound/1") errs.push("schema must be globedesk.outbound/1");
    if (hasKey(doc, "generated")) isStr(doc.generated, "generated", LIMITS.str.short, errs);
    if (hasKey(doc, "note")) isStr(doc.note, "note", LIMITS.str.medium, errs);
    if (hasKey(doc, "checked")) isStr(doc.checked, "checked", LIMITS.str.short, errs);
    if (!Array.isArray(doc.targets)) errs.push("targets[] missing");
    else if (isArr(doc.targets, "targets", LIMITS.count.outboundTargets, errs)) {
      const ids = {};
      doc.targets.forEach((tg, i) => {
        outboundTargetErrors(tg, i, errs);
        if (tg && tg.id) {
          if (ids[tg.id]) errs.push("outbound " + (i + 1) + ": duplicate id");
          ids[tg.id] = true;
        }
      });
    }
    return errs;
  }

  function requireId(v, path, errs) {
    if (!v || !String(v).trim() || !isStr(v, path, LIMITS.str.id, errs)) {
      errs.push(path + " must not be empty");
      return false;
    }
    return true;
  }

  function requireText(v, path, max, errs) {
    if (typeof v !== "string" || !v.trim() || !isStr(v, path, max, errs)) {
      errs.push(path + " must be a non-empty string");
      return false;
    }
    return true;
  }

  function researchSourceOk(story, sourceId, path, errs) {
    if (!sourceId) return;
    if (story && !(story.sources || []).some((s) => s && s.id === sourceId)) {
      errs.push(path + " is not a source on the story");
    }
  }

  function researchLinkErrors(link, path, errs) {
    if (!link || typeof link !== "object" || Array.isArray(link)) { errs.push(path + " must be an object"); return; }
    unknown(link, KEYS.researchLink, path, errs);
    if (hasKey(link, "id")) requireId(link.id, path + ".id", errs);
    if (!hasKey(link, "label") || !requireText(link.label, path + ".label", LIMITS.str.short, errs)) {
      if (!hasKey(link, "label")) errs.push(path + ": label missing");
    }
    if (!hasKey(link, "url")) errs.push(path + ": url missing");
    else if (typeof link.url !== "string" || /\s/.test(link.url)) errs.push(path + ": url must not contain spaces");
    else if (!httpsOk(link.url)) errs.push(path + ": url must be https");
    else if (urlCarriesPersonalData(link.url)) errs.push(path + ": url must not carry an email or phone number");
    if (hasKey(link, "kind") && RESEARCH_LINK_KINDS.indexOf(link.kind) < 0) {
      errs.push(path + ".kind must be " + RESEARCH_LINK_KINDS.join("|"));
    }
  }

  function researchQuoteErrors(quote, path, story, errs) {
    if (!quote || typeof quote !== "object" || Array.isArray(quote)) { errs.push(path + " must be an object"); return; }
    unknown(quote, KEYS.researchQuote, path, errs);
    if (hasKey(quote, "id")) requireId(quote.id, path + ".id", errs);
    if (!hasKey(quote, "text") || !requireText(quote.text, path + ".text", LIMITS.str.medium, errs)) {
      if (!hasKey(quote, "text")) errs.push(path + ": text missing");
    } else if (textCarriesPersonalData(quote.text)) {
      errs.push(path + ".text must not carry an email or phone number");
    }
    if (!hasKey(quote, "sourceId") || !requireId(quote.sourceId, path + ".sourceId", errs)) {
      if (!hasKey(quote, "sourceId")) errs.push(path + ": sourceId missing");
    } else researchSourceOk(story, quote.sourceId, path + ".sourceId", errs);
    if (hasKey(quote, "retrieved")) requireIsoDate(quote.retrieved, path + ".retrieved", errs);
    if (hasKey(quote, "locator")) isStr(quote.locator, path + ".locator", LIMITS.str.short, errs);
  }

  function researchGapErrors(gap, path, errs) {
    if (!gap || typeof gap !== "object" || Array.isArray(gap)) { errs.push(path + " must be an object"); return; }
    unknown(gap, KEYS.researchGap, path, errs);
    if (hasKey(gap, "id")) requireId(gap.id, path + ".id", errs);
    if (!hasKey(gap, "label") || !requireText(gap.label, path + ".label", LIMITS.str.short, errs)) {
      if (!hasKey(gap, "label")) errs.push(path + ": label missing");
    } else if (textCarriesPersonalData(gap.label)) {
      errs.push(path + ".label must not carry an email or phone number");
    }
    if (!hasKey(gap, "detail") || !requireText(gap.detail, path + ".detail", LIMITS.str.medium, errs)) {
      if (!hasKey(gap, "detail")) errs.push(path + ": detail missing");
    } else {
      if (textCarriesPersonalData(gap.detail)) errs.push(path + ".detail must not carry an email or phone number");
      const marked = String(gap.detail).indexOf("[UNKNOWN]") >= 0;
      if (hasKey(gap, "isGap") && !isBool(gap.isGap, path + ".isGap", errs)) return;
      if (!marked && gap.isGap !== true) {
        errs.push(path + ": a gap with no [UNKNOWN] must be flagged isGap");
      }
    }
    if (hasKey(gap, "closed")) requireIsoDate(gap.closed, path + ".closed", errs);
  }

  function researchUpdateErrors(row, path, story, errs) {
    if (!row || typeof row !== "object" || Array.isArray(row)) { errs.push(path + " must be an object"); return; }
    unknown(row, KEYS.researchUpdate, path, errs);
    if (hasKey(row, "id")) requireId(row.id, path + ".id", errs);
    if (!hasKey(row, "at") || !requireText(row.at, path + ".at", LIMITS.str.short, errs)) {
      if (!hasKey(row, "at")) errs.push(path + ": at missing");
    } else if (!isIsoDate(row.at)) {
      errs.push(path + ".at must be an ISO date");
    }
    if (!hasKey(row, "note") || !requireText(row.note, path + ".note", LIMITS.str.medium, errs)) {
      if (!hasKey(row, "note")) errs.push(path + ": note missing");
    } else if (textCarriesPersonalData(row.note)) {
      errs.push(path + ".note must not carry an email or phone number");
    }
    if (hasKey(row, "sourceId")) {
      if (requireId(row.sourceId, path + ".sourceId", errs)) researchSourceOk(story, row.sourceId, path + ".sourceId", errs);
    }
  }

  function researchStoryErrors(entry, i, ep, claimIds, errs) {
    const p = "research story " + (i + 1);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) { errs.push(p + " must be an object"); return; }
    unknown(entry, KEYS.researchStory, p, errs);
    if (!hasKey(entry, "storyId") || !requireId(entry.storyId, p + ".storyId", errs)) {
      if (!hasKey(entry, "storyId")) errs.push(p + ": storyId missing");
    }
    let story = null;
    if (ep && entry.storyId) {
      story = (ep.stories || []).find((s) => s && (s.id === entry.storyId || s.slug === entry.storyId)) || null;
      if (!story) errs.push(p + ": storyId is not a story in the episode");
    }
    if (hasKey(entry, "links")) {
      if (isArr(entry.links, p + ".links", LIMITS.count.links, errs)) {
        entry.links.forEach((link, n) => researchLinkErrors(link, p + ".links[" + n + "]", errs));
      }
    }
    if (hasKey(entry, "quotes")) {
      if (isArr(entry.quotes, p + ".quotes", LIMITS.count.researchQuotes, errs)) {
        entry.quotes.forEach((q, n) => researchQuoteErrors(q, p + ".quotes[" + n + "]", story, errs));
      }
    }
    if (hasKey(entry, "gaps")) {
      if (isArr(entry.gaps, p + ".gaps", LIMITS.count.researchGaps, errs)) {
        entry.gaps.forEach((g, n) => researchGapErrors(g, p + ".gaps[" + n + "]", errs));
      }
    }
    if (hasKey(entry, "updates")) {
      if (isArr(entry.updates, p + ".updates", LIMITS.count.researchUpdates, errs)) {
        entry.updates.forEach((u, n) => researchUpdateErrors(u, p + ".updates[" + n + "]", story, errs));
      }
    }
    if (hasKey(entry, "claimIds")) {
      if (isArr(entry.claimIds, p + ".claimIds", LIMITS.count.sourceIds, errs)) {
        entry.claimIds.forEach((id, n) => {
          if (requireId(id, p + ".claimIds[" + n + "]", errs) && claimIds && !claimIds[id]) {
            errs.push(p + ".claimIds[" + n + "] is not a claim id");
          }
        });
      }
    }
    if (hasKey(entry, "recordIds")) idListErrors(entry.recordIds, p + ".recordIds", errs);
  }

  function validateResearch(doc, ep) {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return ["Not an object"];
    const errs = [];
    unknown(doc, KEYS.researchFile, "research file", errs);
    if (doc.schema !== "globedesk.research/1") errs.push("schema must be globedesk.research/1");
    if (hasKey(doc, "generated")) isStr(doc.generated, "generated", LIMITS.str.short, errs);
    if (hasKey(doc, "note")) {
      isStr(doc.note, "note", LIMITS.str.medium, errs);
      if (textCarriesPersonalData(doc.note)) errs.push("note must not carry an email or phone number");
    }
    if (!Array.isArray(doc.stories)) errs.push("stories[] missing");
    else if (isArr(doc.stories, "stories", LIMITS.count.researchStories, errs)) {
      const seenStory = {};
      const seenIds = {};
      const claimIds = {};
      if (GD.claims && GD.claims.state && Array.isArray(GD.claims.state.claims)) {
        GD.claims.state.claims.forEach((c) => { if (c && c.id) claimIds[c.id] = true; });
      }
      function takeId(id, path) {
        if (!id || typeof id !== "string") return;
        if (seenIds[id]) errs.push(path + ": duplicate id");
        seenIds[id] = true;
      }
      doc.stories.forEach((entry, i) => {
        researchStoryErrors(entry, i, ep || null, Object.keys(claimIds).length ? claimIds : null, errs);
        if (entry && entry.storyId) {
          if (seenStory[entry.storyId]) errs.push("research story " + (i + 1) + ": duplicate storyId");
          seenStory[entry.storyId] = true;
        }
        const p = "research story " + (i + 1);
        (entry && entry.links || []).forEach((x, n) => takeId(x && x.id, p + ".links[" + n + "]"));
        (entry && entry.quotes || []).forEach((x, n) => takeId(x && x.id, p + ".quotes[" + n + "]"));
        (entry && entry.gaps || []).forEach((x, n) => takeId(x && x.id, p + ".gaps[" + n + "]"));
        (entry && entry.updates || []).forEach((x, n) => takeId(x && x.id, p + ".updates[" + n + "]"));
      });
    }
    return errs;
  }

  function personalFieldName(k) {
    return PERSONAL_FIELD.test(String(k || ""));
  }

  function scanPersonalKeys(obj, path, errs) {
    if (!obj || typeof obj !== "object") return;
    Object.keys(obj).forEach((k) => {
      if (personalFieldName(k)) errs.push(path + ": must not carry an owner, address, phone, email, or valuation field");
      const v = obj[k];
      if (v && typeof v === "object") scanPersonalKeys(v, path, errs);
    });
  }

  function recordKindNorm(kind) {
    return String(kind || "").trim().toLowerCase();
  }

  function recordKindOk(kind) {
    if (RECORD_KINDS.indexOf(recordKindNorm(kind)) >= 0) return true;
    return typeof kind === "string" && /^[A-Za-z][A-Za-z0-9-]{0,39}$/.test(kind);
  }

  function citationLabelIsPlaceholder(label) {
    const t = String(label || "").trim();
    if (!t) return true;
    return t === "[UNKNOWN]" || !t.replace(/\[UNKNOWN\]/g, "").trim();
  }

  function recordHasRealCitation(row) {
    return !!(row && Array.isArray(row.citations) && row.citations.some((c) => c && !citationLabelIsPlaceholder(c.label)));
  }

  function storyInEpisode(ep, id) {
    if (!id || !ep || !Array.isArray(ep.stories)) return false;
    return ep.stories.some((st) => st && (st.id === id || st.slug === id));
  }

  function recordCitationErrors(cit, path, errs) {
    if (!cit || typeof cit !== "object" || Array.isArray(cit)) { errs.push(path + " must be an object"); return; }
    unknown(cit, KEYS.recordCitation, path, errs);
    if (hasKey(cit, "id")) requireId(cit.id, path + ".id", errs);
    if (!hasKey(cit, "label") || !requireText(cit.label, path + ".label", LIMITS.str.short, errs)) {
      if (!hasKey(cit, "label")) errs.push(path + ": label missing");
    } else if (citationLabelIsPlaceholder(cit.label)) {
      errs.push(path + ".label must not be a placeholder or [UNKNOWN]");
    } else if (textCarriesPersonalData(cit.label)) {
      errs.push(path + ".label must not carry an email or phone number");
    }
    if (hasKey(cit, "url")) {
      if (typeof cit.url !== "string" || /\s/.test(cit.url)) errs.push(path + ": url must not contain spaces");
      else if (!httpsOk(cit.url)) errs.push(path + ": url must be https");
      else if (urlCarriesPersonalData(cit.url)) errs.push(path + ": url must not carry an email or phone number");
    }
    if (hasKey(cit, "note")) {
      if (isStr(cit.note, path + ".note", LIMITS.str.medium, errs) && textCarriesPersonalData(cit.note)) {
        errs.push(path + ".note must not carry an email or phone number");
      }
    }
  }

  function recordErrors(row, path, errs, ep) {
    if (!row || typeof row !== "object" || Array.isArray(row)) { errs.push(path + " must be an object"); return; }
    unknown(row, KEYS.record, path, errs);
    scanPersonalKeys(row, path, errs);
    if (!hasKey(row, "id") || !requireId(row.id, path + ".id", errs)) {
      if (!hasKey(row, "id")) errs.push(path + ": id missing");
    }
    if (!hasKey(row, "title") || !requireText(row.title, path + ".title", LIMITS.str.short, errs)) {
      if (!hasKey(row, "title")) errs.push(path + ": title missing");
    } else if (textCarriesPersonalData(row.title)) {
      errs.push(path + ".title must not carry an email or phone number");
    }
    if (!hasKey(row, "kind") || !requireText(row.kind, path + ".kind", LIMITS.str.short, errs)) {
      if (!hasKey(row, "kind")) errs.push(path + ": kind missing");
    } else if (!recordKindOk(row.kind)) {
      errs.push(path + ".kind must be event, voyage, event-sequence, case, or a short author tag");
    }
    if (!hasKey(row, "place") || !requireText(row.place, path + ".place", LIMITS.str.medium, errs)) {
      if (!hasKey(row, "place")) errs.push(path + ": place missing");
    } else if (textCarriesPersonalData(row.place)) {
      errs.push(path + ".place must not carry an email or phone number");
    }
    const hasLat = hasKey(row, "lat"), hasLon = hasKey(row, "lon");
    if (hasLat !== hasLon) errs.push(path + ": lat and lon must be given together");
    if (hasLat && hasLon) {
      if (typeof row.lat !== "number" || !isFinite(row.lat) || Math.abs(row.lat) > 90) errs.push(path + ".lat must be a number between -90 and 90");
      if (typeof row.lon !== "number" || !isFinite(row.lon) || Math.abs(row.lon) > 180) errs.push(path + ".lon must be a number between -180 and 180");
    }
    if (hasKey(row, "precision")) isStr(row.precision, path + ".precision", LIMITS.str.short, errs);
    if (hasKey(row, "precisionLabel")) {
      if (isStr(row.precisionLabel, path + ".precisionLabel", LIMITS.str.medium, errs) && textCarriesPersonalData(row.precisionLabel)) {
        errs.push(path + ".precisionLabel must not carry an email or phone number");
      }
    }
    if (!hasKey(row, "date") || !requireText(row.date, path + ".date", LIMITS.str.short, errs)) {
      if (!hasKey(row, "date")) errs.push(path + ": date missing");
    } else if (textCarriesPersonalData(row.date)) {
      errs.push(path + ".date must not carry an email or phone number");
    }
    if (hasKey(row, "dateEnd")) {
      if (isStr(row.dateEnd, path + ".dateEnd", LIMITS.str.short, errs) && textCarriesPersonalData(row.dateEnd)) {
        errs.push(path + ".dateEnd must not carry an email or phone number");
      }
    }
    if (!hasKey(row, "citations") || !Array.isArray(row.citations)) errs.push(path + ": citations missing");
    else if (isArr(row.citations, path + ".citations", LIMITS.count.recordCitations, errs)) {
      if (!row.citations.length) errs.push(path + ": citations must not be empty");
      row.citations.forEach((c, n) => recordCitationErrors(c, path + ".citations[" + n + "]", errs));
    }
    if (!hasKey(row, "confidence") || RECORD_CONFIDENCE.indexOf(row.confidence) < 0) {
      errs.push(path + ".confidence must be high|medium|low");
    }
    if (!hasKey(row, "reconstruction") || !isBool(row.reconstruction, path + ".reconstruction", errs)) {
      if (!hasKey(row, "reconstruction")) errs.push(path + ": reconstruction missing");
    }
    const year = typeof row.date === "string" && /^(\d{4})/.exec(row.date);
    if (year && Number(year[1]) < 1500 && (recordKindNorm(row.kind) === "voyage" || recordKindNorm(row.kind) === "event-sequence") && row.reconstruction !== true) {
      errs.push(path + ": a pre-1500 voyage or event sequence must be marked reconstruction");
    }
    if (hasKey(row, "claimStatus") && CLAIM_STATUS.indexOf(row.claimStatus) < 0) {
      errs.push(path + ".claimStatus must be " + CLAIM_STATUS.join("|"));
    }
    ["license", "credit", "pathId", "storyId", "note"].forEach((k) => {
      if (!hasKey(row, k)) return;
      const max = k === "note" || k === "credit" || k === "license" ? LIMITS.str.medium : LIMITS.str.id;
      if (k === "storyId" || k === "pathId") requireId(row[k], path + "." + k, errs);
      else if (isStr(row[k], path + "." + k, max, errs) && textCarriesPersonalData(row[k])) {
        errs.push(path + "." + k + " must not carry an email or phone number");
      }
    });
    if (ep && hasKey(row, "storyId") && row.storyId && !storyInEpisode(ep, row.storyId)) {
      errs.push(path + ".storyId must match an existing story");
    }
  }

  function recordsCatalogErrors(cat, i, errs, ep) {
    const p = "records catalog " + (i + 1);
    if (!cat || typeof cat !== "object" || Array.isArray(cat)) { errs.push(p + " must be an object"); return; }
    unknown(cat, KEYS.recordsCatalog, p, errs);
    scanPersonalKeys(cat, p, errs);
    if (!hasKey(cat, "id") || !requireId(cat.id, p + ".id", errs)) {
      if (!hasKey(cat, "id")) errs.push(p + ": id missing");
    }
    if (!hasKey(cat, "name") || !requireText(cat.name, p + ".name", LIMITS.str.short, errs)) {
      if (!hasKey(cat, "name")) errs.push(p + ": name missing");
    }
    if (hasKey(cat, "kind") && !recordKindOk(cat.kind)) errs.push(p + ".kind must be event, voyage, event-sequence, case, or a short author tag");
    ["credit", "license", "terms", "note"].forEach((k) => {
      if (hasKey(cat, k)) {
        if (isStr(cat[k], p + "." + k, LIMITS.str.medium, errs) && textCarriesPersonalData(cat[k])) {
          errs.push(p + "." + k + " must not carry an email or phone number");
        }
      }
    });
    if (hasKey(cat, "storyId")) {
      requireId(cat.storyId, p + ".storyId", errs);
      if (ep && cat.storyId && !storyInEpisode(ep, cat.storyId)) errs.push(p + ".storyId must match an existing story");
    }
    if (hasKey(cat, "layerId")) requireId(cat.layerId, p + ".layerId", errs);
    if (!hasKey(cat, "records") || !Array.isArray(cat.records)) errs.push(p + ": records missing");
    else if (isArr(cat.records, p + ".records", LIMITS.count.records, errs)) {
      cat.records.forEach((row, n) => recordErrors(row, p + ".records[" + n + "]", errs, ep));
    }
  }

  function validateRecords(doc, ep) {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return ["Not an object"];
    const errs = [];
    unknown(doc, KEYS.recordsFile, "records file", errs);
    scanPersonalKeys(doc, "records file", errs);
    if (doc.schema !== "globedesk.records/1") errs.push("schema must be globedesk.records/1");
    if (hasKey(doc, "generated")) isStr(doc.generated, "generated", LIMITS.str.short, errs);
    if (hasKey(doc, "note")) {
      isStr(doc.note, "note", LIMITS.str.medium, errs);
      if (textCarriesPersonalData(doc.note)) errs.push("note must not carry an email or phone number");
    }
    if (!Array.isArray(doc.catalogs)) errs.push("catalogs[] missing");
    else if (isArr(doc.catalogs, "catalogs", LIMITS.count.recordCatalogs, errs)) {
      const seenCat = {}, seenRec = {}, seenLayer = {};
      doc.catalogs.forEach((cat, i) => {
        recordsCatalogErrors(cat, i, errs, ep);
        if (cat && cat.id) {
          if (seenCat[cat.id]) errs.push("records catalog " + (i + 1) + ": duplicate id");
          seenCat[cat.id] = true;
        }
        if (cat && cat.layerId) {
          if (seenLayer[cat.layerId]) errs.push("records catalog " + (i + 1) + ": duplicate layerId");
          seenLayer[cat.layerId] = true;
        }
        (cat && cat.records || []).forEach((row, n) => {
          if (row && row.id) {
            if (seenRec[row.id]) errs.push("records catalog " + (i + 1) + ".records[" + n + "]: duplicate id");
            seenRec[row.id] = true;
          }
        });
      });
    }
    return errs;
  }

  function validateEpisode(ep, warns) {
    const base = (GD.model && GD.model.validate) ? GD.model.validate(ep) : [];
    return base.concat(extraValidate(ep, warns).filter((e) => base.indexOf(e) < 0 && !(/^schema must be/.test(e) && base.some((b) => b.startsWith("schema")))));
  }

  function validate(ep, warns) {
    if (!ep || typeof ep !== "object") return ["Not an object"];
    const errs = [];
    if (GD.model && GD.model.validate) GD.model.validate(ep).forEach((e) => errs.push(e));
    extraValidate(ep, warns).forEach((e) => { if (errs.indexOf(e) < 0 && !(e.startsWith("schema") && errs.some((x) => x.startsWith("schema")))) errs.push(e); });
    return errs;
  }

  GD.schema = { CURRENT, LEGACY, PROJECT, CONTENT_KINDS, CLAIM_STATUS, RESEARCH_LINK_KINDS, CLAIMS_SCHEMA: "globedesk.claims/1", OUTBOUND_SCHEMA: "globedesk.outbound/1", RESEARCH_SCHEMA: "globedesk.research/1", LIMITS, KEYS, BUNDLED_GIS_OVERLAY_IDS, knownEpisodeSchema, contentErrors, audioErrors, validate, extraValidate, validateEpisode, validateClaims, validateOutbound, validateResearch, validateRecords, httpsOk, urlCarriesPersonalData, textCarriesPersonalData, isIsoDate, RECORD_KINDS, RECORD_CONFIDENCE, PERSONAL_FIELD };
})();
