/* Optional version check. The public URL is [UNKNOWN] until a host is confirmed.
   Off by default; fails silent. Never blocks the desk. window.GD.version */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const APP = "1.3.0";
  const EDITION = "Share & Export";
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

  const label = "v" + APP + " · " + EDITION;
  GD.version = { APP, EDITION, URL, check, label: label, number: "v" + APP, suffix: EDITION };
})();
