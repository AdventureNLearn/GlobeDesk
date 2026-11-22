/* GlobeDesk Open in… allowlist. Load globedesk.outbound/1, match cards and stories,
   and emit same-document anchors. Links open in a new tab with noopener noreferrer.
   Disabled or [UNKNOWN] targets are never rendered as anchors. No data is posted,
   and no iframes are used. */
(function () {
  const GD = (window.GD = window.GD || {});

  const PATH = "newsdesk/outbound.json";

  const state = {
    doc: null,
    targets: [],
    errors: [],
    loaded: false
  };

  function empty() {
    state.doc = null;
    state.targets = [];
    state.errors = [];
    state.loaded = false;
  }

  function load(doc) {
    empty();
    if (!doc) return state;
    const errs = (GD.schema && GD.schema.validateOutbound) ? GD.schema.validateOutbound(doc) : ["schema missing"];
    state.errors = errs;
    state.loaded = true;
    if (errs.length) return state;
    state.doc = doc;
    state.targets = Array.isArray(doc.targets) ? doc.targets.slice() : [];
    return state;
  }

  function allTargets() {
    return state.targets.slice();
  }

  function byId(id) {
    if (!id) return null;
    for (let i = 0; i < state.targets.length; i++) {
      if (state.targets[i].id === id) return state.targets[i];
    }
    return null;
  }

  function isLinkable(tg) {
    return !!(tg && tg.enabled === true && tg.status !== "[UNKNOWN]" && GD.schema && GD.schema.httpsOk(tg.url));
  }

  function idList(v) {
    return Array.isArray(v) ? v : [];
  }

  function matchesStory(tg, story) {
    if (!tg || !story) return false;
    const sid = story.id || story.slug;
    if (sid && idList(tg.storyIds).indexOf(sid) !== -1) return true;
    const sectionId = story.sectionId || story.section;
    if (sectionId && idList(tg.sectionIds).indexOf(sectionId) !== -1) return true;
    const open = idList(story.openIn);
    if (open.indexOf(tg.id) !== -1) return true;
    return false;
  }

  function forStory(story) {
    if (!story) return [];
    const seen = {};
    const out = [];
    const open = idList(story.openIn);
    open.forEach((id) => {
      const tg = byId(id);
      if (!tg || seen[tg.id]) return;
      seen[tg.id] = true;
      out.push(tg);
    });
    state.targets.forEach((tg) => {
      if (seen[tg.id]) return;
      if (matchesStory(tg, story)) {
        seen[tg.id] = true;
        out.push(tg);
      }
    });
    return out;
  }

  function linkableForStory(story) {
    return forStory(story).filter(isLinkable);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function anchorHtml(tg) {
    if (!isLinkable(tg)) return "";
    const href = escapeAttr(tg.url);
    const label = escapeHtml(tg.label);
    const title = escapeAttr(tg.credit || ("Open in " + tg.label));
    return '<a class="nd-openin-link" href="' + href + '" target="_blank" rel="noopener noreferrer" title="' + title + '">' + label + "</a>";
  }

  function rowHtml(targets, className) {
    const links = (targets || []).filter(isLinkable).map(anchorHtml).filter(Boolean);
    if (!links.length) return "";
    return '<div class="' + (className || "nd-openin") + '"><span class="nd-openin-label">Open in…</span> ' + links.join(" ") + "</div>";
  }

  function cardHtml(story) {
    return rowHtml(forStory(story), "nd-openin");
  }

  function editorHtml(story) {
    return rowHtml(forStory(story), "story-openin");
  }

  function editorPickerHtml(story) {
    const tgs = allTargets();
    if (!tgs.length) return "";
    const attached = {};
    idList(story && story.openIn).forEach((id) => { attached[id] = true; });
    const links = rowHtml(forStory(story), "story-openin");
    const boxes = tgs.map((tg) => {
      const linkable = isLinkable(tg);
      const status = tg.status === "[UNKNOWN]" ? " [UNKNOWN]" : "";
      const checked = (attached[tg.id] && linkable) ? " checked" : "";
      const dis = linkable ? "" : " disabled";
      const hint = linkable ? "" : " — not linked";
      return '<label class="row story-openin-opt"><input type="checkbox" data-openin="' +
        escapeAttr(tg.id) + '"' + checked + dis + "> " + escapeHtml(tg.label) +
        escapeHtml(status) + hint + "</label>";
    }).join("");
    return '<div class="story-openin-box"><p class="label">Open in…</p>' +
      '<p class="muted small">Allowlisted public desks. A click opens a new tab with noopener and noreferrer. This story is not sent. Disabled entries have no verified public URL.</p>' +
      links + boxes + "</div>";
  }

  function listed(story) {
    return forStory(story).map((tg) => ({
      id: tg.id,
      label: tg.label,
      url: isLinkable(tg) ? tg.url : "",
      enabled: isLinkable(tg),
      status: tg.status || "",
      credit: tg.credit || "",
      reason: tg.reason || ""
    }));
  }

  function fetchJson(url) {
    return fetch(url, { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null));
  }

  function boot(fetcher) {
    const get = fetcher || fetchJson;
    return Promise.resolve(get(PATH)).then((doc) => {
      load(doc);
      return state;
    }).catch(() => {
      empty();
      state.loaded = true;
      state.errors = ["outbound allowlist could not be loaded"];
      return state;
    });
  }

  GD.outbound = {
    PATH, state, load, boot, empty, allTargets, byId, isLinkable,
    matchesStory, forStory, linkableForStory, listed,
    anchorHtml, rowHtml, cardHtml, editorHtml, editorPickerHtml
  };
})();
