/* GlobeDesk research drawer. Human-kept links, quotes, [UNKNOWN] gaps, and a local update log
   live in globedesk.research/1, not on the episode. No remote CMS fetch, no geocoding,
   and no live refresh of cited pages (that stays [UNKNOWN]). */
(function () {
  const GD = (window.GD = window.GD || {});

  const PATH = "newsdesk/research.json";
  const KIND_LABEL = { official: "Official", coverage: "Coverage", other: "Other" };

  const state = {
    doc: null,
    stories: [],
    errors: [],
    loaded: false,
    openStoryId: null
  };

  function empty() {
    state.doc = null;
    state.stories = [];
    state.errors = [];
    state.loaded = false;
    state.openStoryId = state.openStoryId || null;
  }

  function blankDoc() {
    return { schema: "globedesk.research/1", stories: [] };
  }

  function researchEpisode(extraStory) {
    if (GD.claims && GD.claims.claimsEpisode) return GD.claims.claimsEpisode(extraStory);
    const stories = [];
    const seen = {};
    function add(list) {
      (list || []).forEach((s) => {
        if (!s || !s.id || seen[s.id]) return;
        seen[s.id] = true;
        stories.push(s);
      });
    }
    const ws = GD.state && GD.state.episode;
    if (ws) add(ws.stories);
    const feed = GD.newsdesk && GD.newsdesk.state && GD.newsdesk.state.feed;
    if (feed) {
      if (feed.episode) add(feed.episode.stories);
      (feed.topics || []).forEach((row) => { if (row.story) add([row.story]); });
    }
    if (extraStory) add([extraStory]);
    return { schema: "globedesk.episode/2", stories: stories };
  }

  function load(doc, ep) {
    const keepOpen = state.openStoryId;
    empty();
    state.openStoryId = keepOpen;
    if (!doc) return state;
    const errs = (GD.schema && GD.schema.validateResearch) ? GD.schema.validateResearch(doc, ep || researchEpisode()) : ["schema missing"];
    state.errors = errs;
    state.loaded = true;
    if (errs.length) return state;
    state.doc = doc;
    state.stories = Array.isArray(doc.stories) ? doc.stories.slice() : [];
    return state;
  }

  function reload() {
    if (state.doc) load(state.doc, researchEpisode());
    return state;
  }

  function resolveStory(id) {
    if (GD.claims && GD.claims.resolveStory) return GD.claims.resolveStory(id);
    if (!id) return null;
    const ep = researchEpisode();
    return (ep.stories || []).find((s) => s.id === id || s.slug === id) || null;
  }

  function entryFor(storyId) {
    const story = resolveStory(storyId);
    const id = (story && story.id) || storyId;
    return (state.stories || []).find((row) => row && row.storyId === id) || null;
  }

  function listed(storyId) {
    if (!storyId) return { error: "missing storyId" };
    const story = resolveStory(storyId);
    if (!story) return { error: "unknown story: " + storyId };
    const row = entryFor(story.id) || { storyId: story.id, links: [], quotes: [], gaps: [], updates: [] };
    const gaps = (row.gaps || []).map((g) => ({
      id: g.id || "",
      label: g.label || "",
      closed: g.closed || ""
    }));
    return {
      storyId: story.id,
      counts: {
        links: (row.links || []).length,
        quotes: (row.quotes || []).length,
        gaps: (row.gaps || []).length,
        openGaps: (row.gaps || []).filter((g) => !g.closed).length,
        updates: (row.updates || []).length
      },
      linkIds: (row.links || []).map((x) => x.id || "").filter(Boolean),
      quoteIds: (row.quotes || []).map((x) => x.id || "").filter(Boolean),
      gapIds: (row.gaps || []).map((x) => x.id || "").filter(Boolean),
      gaps: gaps
    };
  }

  function commit(doc, story) {
    const ep = researchEpisode(story || null);
    const errs = (GD.schema && GD.schema.validateResearch) ? GD.schema.validateResearch(doc, ep) : [];
    if (errs.length) return { ok: false, error: errs[0], errors: errs };
    load(doc, ep);
    if (GD.newsdesk && GD.newsdesk.render) GD.newsdesk.render();
    if (GD.ui && GD.ui.renderInspector) GD.ui.renderInspector();
    sync();
    return { ok: true };
  }

  function upsertEntry(story, mutate) {
    const nextStories = (state.doc && Array.isArray(state.doc.stories)) ? state.doc.stories.slice() : [];
    let row = nextStories.find((r) => r && r.storyId === story.id);
    if (!row) {
      row = { storyId: story.id, links: [], quotes: [], gaps: [], updates: [] };
      nextStories.push(row);
    } else {
      const at = nextStories.indexOf(row);
      row = Object.assign({}, row, {
        links: (row.links || []).slice(),
        quotes: (row.quotes || []).slice(),
        gaps: (row.gaps || []).slice(),
        updates: (row.updates || []).slice(),
        claimIds: (row.claimIds || []).slice(),
        recordIds: (row.recordIds || []).slice()
      });
      nextStories[at] = row;
    }
    mutate(row);
    const doc = Object.assign({}, state.doc || blankDoc(), { schema: "globedesk.research/1", stories: nextStories });
    return commit(doc, story);
  }

  function today() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function slugPart(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
  }

  function findGap(row, args) {
    const gaps = (row && row.gaps) || [];
    if (args && args.id) return gaps.find((g) => g && g.id === args.id) || null;
    if (args && args.label) return gaps.find((g) => g && g.label === args.label) || null;
    return null;
  }

  function addGap(args) {
    const story = resolveStory(args && args.storyId);
    if (!story) return { ok: false, error: "unknown story: " + ((args && args.storyId) || "") };
    const label = (args && args.label) || "";
    const id = (args && args.id) || "";
    if (!label && !id) return { ok: false, error: "addGap requires id or label" };
    if (!args.detail || !String(args.detail).trim()) return { ok: false, error: "addGap requires detail" };
    const existing = ((entryFor(story.id) || {}).gaps) || [];
    if (label && existing.some((g) => g && g.label === label)) return { ok: false, error: "duplicate gap label" };
    if (id && existing.some((g) => g && g.id === id)) return { ok: false, error: "duplicate gap id" };
    const out = upsertEntry(story, (row) => {
      if (findGap(row, { id: id || undefined, label: label || undefined })) return;
      const gap = {
        id: id || ("gap-" + story.id + "-" + slugPart(label || args.detail)),
        label: label || "Gap",
        detail: args.detail
      };
      if (args.isGap === true) gap.isGap = true;
      row.gaps.push(gap);
    });
    if (!out.ok) return out;
    const row = entryFor(story.id);
    const gap = findGap(row, { id: id || undefined, label: label || undefined }) || (row && row.gaps[row.gaps.length - 1]);
    return { ok: true, result: { storyId: story.id, id: gap && gap.id, label: gap && gap.label } };
  }

  function closeGap(args) {
    const story = resolveStory(args && args.storyId);
    if (!story) return { ok: false, error: "unknown story: " + ((args && args.storyId) || "") };
    if (!args || (!args.id && !args.label)) return { ok: false, error: "closeGap requires id or label" };
    if (!args.note || !String(args.note).trim()) return { ok: false, error: "closeGap requires a note" };
    const current = findGap(entryFor(story.id), args);
    if (!current) return { ok: false, error: "unknown gap" };
    if (current.closed) {
      return { ok: true, result: { storyId: story.id, id: current.id, label: current.label, closed: current.closed } };
    }
    let closedId = "";
    const out = upsertEntry(story, (row) => {
      const gap = findGap(row, args);
      if (!gap) return;
      const at = row.gaps.indexOf(gap);
      const next = Object.assign({}, gap, { closed: gap.closed || today() });
      row.gaps[at] = next;
      closedId = next.id || "";
      row.updates.push({
        id: "update-" + story.id + "-" + slugPart(next.id || next.label) + "-" + today() + "-" + row.updates.length,
        at: today(),
        note: args.note
      });
    });
    if (!out.ok) return out;
    const row = entryFor(story.id);
    const gap = findGap(row, args);
    if (!gap) return { ok: false, error: "unknown gap" };
    return { ok: true, result: { storyId: story.id, id: gap.id || closedId, label: gap.label, closed: gap.closed } };
  }

  function addLink(args, story) {
    const st = story || resolveStory(args && args.storyId);
    if (!st) return { ok: false, error: "unknown story: " + ((args && args.storyId) || "") };
    if (!args || !args.label || !String(args.label).trim()) return { ok: false, error: "link label missing" };
    if (!args.url) return { ok: false, error: "url missing" };
    const out = upsertEntry(st, (row) => {
      row.links.push({
        id: args.id || ("link-" + st.id + "-" + slugPart(args.label)),
        label: args.label,
        url: args.url,
        kind: args.kind || undefined
      });
      if (!row.links[row.links.length - 1].kind) delete row.links[row.links.length - 1].kind;
    });
    return out.ok ? { ok: true, result: { storyId: st.id } } : out;
  }

  function addQuote(args, story) {
    const st = story || resolveStory(args && args.storyId);
    if (!st) return { ok: false, error: "unknown story: " + ((args && args.storyId) || "") };
    if (!args || !args.text || !String(args.text).trim()) return { ok: false, error: "quote text missing" };
    if (!args.sourceId) return { ok: false, error: "quote requires a sourceId" };
    const out = upsertEntry(st, (row) => {
      const q = {
        id: args.id || ("quote-" + st.id + "-" + (row.quotes.length + 1)),
        text: args.text,
        sourceId: args.sourceId
      };
      if (args.retrieved) q.retrieved = args.retrieved;
      if (args.locator) q.locator = args.locator;
      row.quotes.push(q);
    });
    return out.ok ? { ok: true, result: { storyId: st.id } } : out;
  }

  function fetchJson(url) {
    return fetch(url, { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null));
  }

  function boot(fetcher) {
    const get = fetcher || fetchJson;
    return Promise.resolve(get(PATH)).then((doc) => {
      load(doc, researchEpisode());
      return state;
    }).catch(() => {
      empty();
      state.loaded = true;
      state.errors = ["research sidecar could not be loaded"];
      return state;
    });
  }

  function el(tag, className) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    return n;
  }

  function txt(node, value) {
    node.textContent = value == null ? "" : String(value);
    return node;
  }

  function markUnknown(parent, value) {
    const s = String(value == null ? "" : value);
    const parts = s.split("[UNKNOWN]");
    parts.forEach((part, i) => {
      if (part) parent.appendChild(document.createTextNode(part));
      if (i < parts.length - 1) {
        const mark = el("span", "nd-unknown");
        txt(mark, "[UNKNOWN]");
        parent.appendChild(mark);
      }
    });
  }

  function sourceLabel(story, id) {
    const src = ((story && story.sources) || []).find((s) => s && s.id === id);
    return (src && src.label) || id || "";
  }

  function isOpen() {
    return !!state.openStoryId;
  }

  function ensureDrawer() {
    if (typeof document === "undefined") return null;
    let root = document.getElementById("ndResearch");
    if (!root && document.createElement) {
      const host = document.getElementById("newsdesk") || document.body;
      root = el("div", "nd-research");
      root.id = "ndResearch";
      root.setAttribute("hidden", "");
      root.setAttribute("aria-label", "Research");
      if (host && host.appendChild) host.appendChild(root);
    }
    return root;
  }

  function close() {
    state.openStoryId = null;
    const root = (typeof document !== "undefined") ? document.getElementById("ndResearch") : null;
    if (root) {
      root.setAttribute("hidden", "");
      root.textContent = "";
    }
    return { ok: true };
  }

  function mountDrawer(parent, story) {
    if (!parent) return null;
    parent.textContent = "";
    const row = story ? entryFor(story.id) : null;
    const head = el("div", "nd-research-head");
    const title = el("h3");
    txt(title, "Research");
    head.appendChild(title);
    const sub = el("p", "muted small");
    txt(sub, "Notes kept by the author in GlobeDesk. This is not a remote CMS, and cited pages are not fetched.");
    head.appendChild(sub);
    const closeBtn = el("button", "small nd-research-close");
    closeBtn.type = "button";
    txt(closeBtn, "Close");
    closeBtn.addEventListener("click", function () { close(); });
    head.appendChild(closeBtn);
    parent.appendChild(head);

    function section(label) {
      const box = el("section", "nd-research-sec");
      const h = el("h4");
      txt(h, label);
      box.appendChild(h);
      parent.appendChild(box);
      return box;
    }

    const links = section("Links");
    const linkList = (row && row.links) || [];
    if (!linkList.length) { const p = el("p", "muted small"); txt(p, "No links yet."); links.appendChild(p); }
    const ul = el("ul", "nd-research-links");
    linkList.forEach((link) => {
      const li = el("li");
      if (link.url && GD.schema && GD.schema.httpsOk(link.url)) {
        const a = el("a", "nd-research-link");
        a.setAttribute("href", link.url);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
        txt(a, link.label || link.url);
        li.appendChild(a);
      } else {
        const s = el("span");
        txt(s, link.label || "");
        li.appendChild(s);
      }
      if (link.kind && KIND_LABEL[link.kind]) {
        const k = el("span", "muted");
        txt(k, " · " + KIND_LABEL[link.kind]);
        li.appendChild(k);
      }
      ul.appendChild(li);
    });
    if (linkList.length) links.appendChild(ul);

    const quotes = section("Quotes");
    const quoteList = (row && row.quotes) || [];
    if (!quoteList.length) { const p = el("p", "muted small"); txt(p, "No quotes yet."); quotes.appendChild(p); }
    quoteList.forEach((q) => {
      const block = el("blockquote", "nd-research-quote");
      const p = el("p");
      txt(p, q.text || "");
      block.appendChild(p);
      const cite = el("p", "muted small");
      txt(cite, sourceLabel(story, q.sourceId) + (q.locator ? " · " + q.locator : "") + (q.retrieved ? " · retrieved " + q.retrieved : ""));
      block.appendChild(cite);
      quotes.appendChild(block);
    });

    const gaps = section("Open gaps");
    const openGaps = ((row && row.gaps) || []).filter((g) => !g.closed);
    const closedGaps = ((row && row.gaps) || []).filter((g) => g.closed);
    if (!openGaps.length) { const p = el("p", "muted small"); txt(p, "No open gaps."); gaps.appendChild(p); }
    openGaps.forEach((g) => {
      const item = el("div", "nd-research-gap");
      const lab = el("p");
      const strong = el("strong");
      txt(strong, g.label || "Gap");
      lab.appendChild(strong);
      item.appendChild(lab);
      const d = el("p");
      markUnknown(d, g.detail || "");
      item.appendChild(d);
      gaps.appendChild(item);
    });
    if (closedGaps.length) {
      const closed = section("Closed gaps");
      closedGaps.forEach((g) => {
        const item = el("div", "nd-research-gap is-closed");
        const lab = el("p");
        const strong = el("strong");
        txt(strong, g.label || "Gap");
        lab.appendChild(strong);
        lab.appendChild(document.createTextNode(" · closed " + g.closed));
        item.appendChild(lab);
        closed.appendChild(item);
      });
    }

    const log = section("Update log");
    const updates = (row && row.updates) || [];
    if (!updates.length) { const p = el("p", "muted small"); txt(p, "No updates yet."); log.appendChild(p); }
    const list = el("ul", "nd-research-log");
    updates.forEach((u) => {
      const li = el("li");
      txt(li, (u.at || "") + " — " + (u.note || ""));
      list.appendChild(li);
    });
    if (updates.length) log.appendChild(list);
    if (GD.records && GD.records.mountOffMap) GD.records.mountOffMap(parent, story);
    return parent;
  }

  function openFor(storyId) {
    const story = resolveStory(storyId);
    if (!story) return { ok: false, error: "unknown story: " + storyId };
    const alreadyOpen = state.openStoryId != null && String(state.openStoryId) === String(story.id);
    const nd = GD.newsdesk;
    if (nd && nd.selectTopic && nd.state && nd.state.view !== "workspace") {
      const selected = nd.state.selectedId;
      const matches = nd.topicMatches
        ? (nd.state.feed.topics || []).some((t) => String(t.id || t.slug) === String(selected) && nd.topicMatches(t, story.id))
        : String(selected) === String(story.id) || String(selected) === String(story.slug);
      if (!matches && nd.selectTopic) nd.selectTopic(story.id, { silent: true });
    }
    state.openStoryId = story.id;
    const root = ensureDrawer();
    if (root) {
      root.removeAttribute("hidden");
      mountDrawer(root, story);
    }
    return { ok: true, result: { storyId: story.id, alreadyOpen: alreadyOpen } };
  }

  function sync() {
    const nd = GD.newsdesk;
    const selected = nd && nd.state ? nd.state.selectedId : null;
    if (!state.openStoryId) {
      const root = (typeof document !== "undefined") ? document.getElementById("ndResearch") : null;
      if (root && !root.hasAttribute("hidden") && root.getAttribute("hidden") !== "") close();
      return;
    }
    if (selected == null) {
      close();
      return;
    }
    const story = resolveStory(state.openStoryId);
    const still = story && (nd && nd.topicMatches
      ? (nd.state.feed.topics || []).some((t) => String(t.id || t.slug) === String(selected) && nd.topicMatches(t, story.id))
      : String(selected) === String(story.id) || String(selected) === String(story.slug));
    if (!still) close();
    else {
      const root = ensureDrawer();
      if (root && story) {
        root.removeAttribute("hidden");
        mountDrawer(root, story);
      }
    }
  }

  function mountButton(parent, story) {
    if (!parent) return null;
    parent.textContent = "";
    const btn = el("button", "small nd-research-open");
    btn.type = "button";
    txt(btn, "Research");
    btn.addEventListener("click", function (ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      openFor(story && (story.id || story.slug));
    });
    parent.appendChild(btn);
    return btn;
  }

  function field(labelText, control) {
    const lab = el("label");
    lab.appendChild(document.createTextNode(labelText));
    lab.appendChild(control);
    return lab;
  }

  function mountEditor(parent, story) {
    if (!parent) return null;
    parent.textContent = "";
    const root = el("div", "story-research");
    const note = el("p", "muted small");
    txt(note, "Research notes live in the research sidecar. Paste a quote only with a source already on this story. Links must be https. Closing a gap keeps the row and writes an update. Cited pages are not fetched.");
    root.appendChild(note);
    if (!story) { parent.appendChild(root); return root; }

    const row = entryFor(story.id);
    const listedOpen = ((row && row.gaps) || []).filter((g) => !g.closed);
    if (listedOpen.length) {
      const box = el("div", "research-gaps");
      const h = el("h4");
      txt(h, "Open gaps");
      box.appendChild(h);
      listedOpen.forEach((g) => {
        const item = el("div", "research-gap-edit");
        const lab = el("p");
        const strong = el("strong");
        txt(strong, g.label || "Gap");
        lab.appendChild(strong);
        item.appendChild(lab);
        const d = el("p");
        markUnknown(d, g.detail || "");
        item.appendChild(d);
        const noteBox = el("textarea");
        noteBox.setAttribute("data-close-note", g.id || g.label);
        const btn = el("button", "small");
        btn.type = "button";
        txt(btn, "Close gap");
        btn.addEventListener("click", function () {
          const out = closeGap({ storyId: story.id, id: g.id, label: g.label, note: noteBox.value });
          if (!out.ok && GD.ui && GD.ui.toast) GD.ui.toast(out.error);
        });
        item.appendChild(field("Close note", noteBox));
        item.appendChild(btn);
        box.appendChild(item);
      });
      root.appendChild(box);
    }

    const addGapBox = el("div", "research-add");
    const gh = el("h4");
    txt(gh, "Add a gap");
    addGapBox.appendChild(gh);
    const gapLabel = el("input");
    const gapDetail = el("textarea");
    const gapBtn = el("button", "small");
    gapBtn.type = "button";
    txt(gapBtn, "Add gap");
    gapBtn.addEventListener("click", function () {
      const out = addGap({ storyId: story.id, label: gapLabel.value, detail: gapDetail.value });
      if (!out.ok && GD.ui && GD.ui.toast) GD.ui.toast(out.error);
    });
    addGapBox.appendChild(field("Label", gapLabel));
    addGapBox.appendChild(field("Detail (include [UNKNOWN] or flag as a gap)", gapDetail));
    addGapBox.appendChild(gapBtn);
    root.appendChild(addGapBox);

    const addLinkBox = el("div", "research-add");
    const lh = el("h4");
    txt(lh, "Add an https link");
    addLinkBox.appendChild(lh);
    const linkLabel = el("input");
    const linkUrl = el("input");
    linkUrl.setAttribute("type", "url");
    const linkKind = el("select");
    ["", "official", "coverage", "other"].forEach((k) => {
      const opt = el("option");
      opt.value = k;
      txt(opt, k ? KIND_LABEL[k] : "Kind (optional)");
      linkKind.appendChild(opt);
    });
    const linkBtn = el("button", "small");
    linkBtn.type = "button";
    txt(linkBtn, "Add link");
    linkBtn.addEventListener("click", function () {
      const out = addLink({ storyId: story.id, label: linkLabel.value, url: linkUrl.value, kind: linkKind.value || undefined }, story);
      if (!out.ok && GD.ui && GD.ui.toast) GD.ui.toast(out.error);
    });
    addLinkBox.appendChild(field("Label", linkLabel));
    addLinkBox.appendChild(field("URL", linkUrl));
    addLinkBox.appendChild(field("Kind", linkKind));
    addLinkBox.appendChild(linkBtn);
    root.appendChild(addLinkBox);

    const addQuoteBox = el("div", "research-add");
    const qh = el("h4");
    txt(qh, "Paste a quote");
    addQuoteBox.appendChild(qh);
    const quoteText = el("textarea");
    const quoteSrc = el("select");
    const blank = el("option");
    blank.value = "";
    txt(blank, "Choose a source");
    quoteSrc.appendChild(blank);
    (story.sources || []).forEach((src) => {
      const opt = el("option");
      opt.value = src.id;
      txt(opt, (src.label || src.id) + " (" + src.status + ")");
      quoteSrc.appendChild(opt);
    });
    const quoteBtn = el("button", "small");
    quoteBtn.type = "button";
    txt(quoteBtn, "Add quote");
    quoteBtn.addEventListener("click", function () {
      const out = addQuote({ storyId: story.id, text: quoteText.value, sourceId: quoteSrc.value }, story);
      if (!out.ok && GD.ui && GD.ui.toast) GD.ui.toast(out.error);
    });
    addQuoteBox.appendChild(field("Quote", quoteText));
    addQuoteBox.appendChild(field("Source", quoteSrc));
    addQuoteBox.appendChild(quoteBtn);
    root.appendChild(addQuoteBox);

    parent.appendChild(root);
    return root;
  }

  function editorHtml(story) {
    if (typeof document === "undefined" || !document.createElement) return "";
    const box = document.createElement("div");
    mountEditor(box, story);
    return box.innerHTML || "";
  }

  GD.research = {
    PATH, state, load, boot, reload, empty, listed, entryFor,
    addGap, closeGap, addLink, addQuote, resolveStory, openFor, close, isOpen, sync,
    mountDrawer, mountButton, mountEditor, editorHtml, researchEpisode
  };
})();
