/* Optional version check. The public URL is [UNKNOWN] until the owner publishes one.
   Off by default; fails silent. Never blocks the desk. window.GD.version */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const APP = "0.4.2";
  // Intended post-release check URL is not confirmed. Do not invent a host.
  const URL = null; // [UNKNOWN]

  async function check() {
    if (!URL) return { skipped: true, reason: "version-check URL is [UNKNOWN]" };
    try {
      const r = await fetch(URL, { credentials: "omit" });
      if (!r.ok) return { skipped: true };
      return { remote: await r.json(), local: APP };
    } catch (e) {
      return { skipped: true };
    }
  }

  GD.version = { APP, URL, check };
})();
