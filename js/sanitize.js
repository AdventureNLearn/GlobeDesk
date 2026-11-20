/* Text and URL sanitizer. Never feed user data to innerHTML without esc(). window.GD.sanitize */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function text(v) { return String(v == null ? "" : v); }

  function isHttpsUrl(s) {
    if (typeof s !== "string" || !s) return false;
    try {
      const u = new URL(s);
      if (u.protocol !== "https:") return false;
      if (u.username || u.password) return false;
      return true;
    } catch (e) { return false; }
  }

  const EMBED = [
    { re: /^https:\/\/(?:www\.)?youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{6,}/, host: "youtube-nocookie" },
    { re: /^https:\/\/(?:www\.)?youtube\.com\/embed\/[A-Za-z0-9_-]{6,}/, host: "youtube" },
    { re: /^https:\/\/(?:www\.)?youtube\.com\/watch\?/, host: "youtube-watch" },
    { re: /^https:\/\/youtu\.be\/[A-Za-z0-9_-]{6,}/, host: "youtu.be" },
    { re: /^https:\/\/(?:www\.)?x\.com\/[A-Za-z0-9_]+\/status\/\d+/, host: "x" },
    { re: /^https:\/\/(?:www\.)?twitter\.com\/[A-Za-z0-9_]+\/status\/\d+/, host: "x" }
  ];

  function embedInfo(s) {
    if (!isHttpsUrl(s)) return null;
    return EMBED.find((e) => e.re.test(s)) || null;
  }

  // Convert a watch/share URL to a safe iframe src, or null.
  function embedSrc(s) {
    const info = embedInfo(s);
    if (!info) return null;
    let m;
    if ((m = s.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{6,})/))) {
      return "https://www.youtube-nocookie.com/embed/" + m[1];
    }
    if ((m = s.match(/[?&]v=([A-Za-z0-9_-]{6,})/))) {
      return "https://www.youtube-nocookie.com/embed/" + m[1];
    }
    if ((m = s.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/))) {
      return "https://www.youtube-nocookie.com/embed/" + m[1];
    }
    // X/Twitter: no official no-script iframe without their widget JS. We show a
    // credit-required link card rather than an arbitrary remote frame.
    if (info.host === "x") return null;
    return null;
  }

  function safeHref(url) { return isHttpsUrl(url) ? url : ""; }

  GD.sanitize = { esc, text, isHttpsUrl, embedInfo, embedSrc, safeHref, EMBED };
})();
