/* GlobeDesk claim scores. Human-applied rows live in globedesk.claims/1, not on episode facts.
   No auto-scoring, no network calls, and no geocoding. */
(function () {
  const GD = (window.GD = window.GD || {});

  const PATH = "newsdesk/claims.json";
  const STATUS_LABEL = {
    "supported": "Supported",
    "not-proven": "Not proven",
    "disputed": "Disputed",
    "people-disagree": "Sources disagree"
  };

  const state = {
    doc: null,
    claims: [],
    errors: [],
    loaded: false
  };

  function empty() {
    state.doc = null;
    state.claims = [];
    state.errors = [];
    state.loaded = false;
  }

  function blankDoc() {
    return { schema: "globedesk.claims/1", claims: [] };
  }

  function load(doc, ep) {
    empty();
    if (!doc) return state;
    const errs = (GD.schema && GD.schema.validateClaims) ? GD.schema.validateClaims(doc, ep || claimsEpisode()) : ["schema missing"];
    state.errors = errs;
    state.loaded = true;
    if (errs.length) return state;
    state.doc = doc;
    state.claims = Array.isArray(doc.claims) ? doc.claims.slice() : [];
    return state;
  }

  function currentEpisode() {
    return (GD.state && GD.state.episode) || null;
  }

  function claimsEpisode(extraStory) {
    const stories = [];
    const seen = {};
    function add(list) {
      (list || []).forEach((s) => {
        if (!s || !s.id || seen[s.id]) return;
        seen[s.id] = true;
        stories.push(s);
      });
    }
    const ws = currentEpisode();
    if (ws) add(ws.stories);
    const feed = GD.newsdesk && GD.newsdesk.state && GD.newsdesk.state.feed;
    if (feed) {
      if (feed.episode) add(feed.episode.stories);
      (feed.topics || []).forEach((row) => { if (row.story) add([row.story]); });
    }
    if (extraStory) add([extraStory]);
    return { schema: "globedesk.episode/2", stories: stories };
  }

  function reload() {
    if (state.doc) load(state.doc, claimsEpisode());
    return state;
  }

  function collidingStoryIds() {
    const feedIds = {};
    const feed = GD.newsdesk && GD.newsdesk.state && GD.newsdesk.state.feed;
    if (feed && feed.episode && Array.isArray(feed.episode.stories)) {
      feed.episode.stories.forEach((s) => { if (s && s.id) feedIds[s.id] = true; });
    }
    (feed && feed.topics || []).forEach((t) => {
      const st = (t && t.story) || {};
      if (st.id) feedIds[st.id] = true;
      if (t && t.id) feedIds[t.id] = true;
    });
    const ws = (currentEpisode() && currentEpisode().stories) || [];
    const out = [];
    const seen = {};
    ws.forEach((s) => {
      if (s && s.id && feedIds[s.id] && !seen[s.id]) { seen[s.id] = true; out.push(s.id); }
    });
    return out;
  }

  function allClaims() {
    return state.claims.slice();
  }

  function claimMatches(c, storyId, cardId, factIndex, factLabel) {
    if (!c) return false;
    if (storyId && c.storyId !== storyId) return false;
    if (cardId && c.cardId && c.cardId !== cardId) return false;
    if (typeof factIndex === "number" && c.factIndex != null && c.factIndex !== factIndex) return false;
    if (factLabel && c.factLabel && c.factLabel !== factLabel) return false;
    if (typeof factIndex === "number" && c.factIndex == null && c.factLabel && factLabel && c.factLabel !== factLabel) return false;
    return true;
  }

  function findClaim(storyId, cardId, factIndex, factLabel) {
    for (let i = 0; i < state.claims.length; i++) {
      const c = state.claims[i];
      if (c.storyId !== storyId) continue;
      if (cardId && c.cardId && c.cardId !== cardId) continue;
      if (typeof factIndex === "number" && c.factIndex === factIndex) return c;
      if (factLabel && c.factLabel === factLabel && (c.cardId === cardId || !cardId || !c.cardId)) return c;
    }
    return null;
  }

  function storyFacts(story) {
    const out = [];
    if (!story) return out;
    (story.cards || []).forEach((card) => {
      (card.facts || []).forEach((fact, factIndex) => {
        out.push({
          storyId: story.id,
          cardId: card.id,
          factIndex: factIndex,
          factLabel: fact.label,
          value: fact.value,
          claim: findClaim(story.id, card.id, factIndex, fact.label)
        });
      });
    });
    return out;
  }

  function listedClaim(c) {
    return {
      id: c.id || "",
      storyId: c.storyId,
      cardId: c.cardId || "",
      factIndex: c.factIndex,
      claimStatus: c.claimStatus || "",
      sourceIds: (c.sourceIds || []).slice(),
      disagree: (c.disagree || []).map((g) => ({ sourceIds: (g.sourceIds || []).slice() }))
    };
  }

  function listed(storyId) {
    if (!storyId) {
      return { claims: state.claims.map(listedClaim) };
    }
    const story = resolveStory(storyId);
    if (!story) return { error: "unknown story: " + storyId };
    return {
      storyId: story.id,
      facts: storyFacts(story).map((row) => {
        const c = row.claim;
        return {
          cardId: row.cardId,
          factIndex: row.factIndex,
          claimStatus: c ? c.claimStatus || "" : "",
          sourceIds: c ? (c.sourceIds || []).slice() : [],
          disagree: c && c.disagree ? c.disagree.map((g) => ({ sourceIds: (g.sourceIds || []).slice() })) : []
        };
      })
    };
  }

  function publicClaim(c) {
    return listedClaim(c);
  }

  function copyGroup(g) {
    return { sourceIds: (g.sourceIds || []).slice(), position: g.position || "" };
  }

  function resolveStory(id) {
    if (!id) return null;
    const ep = currentEpisode();
    if (ep && Array.isArray(ep.stories)) {
      const s = ep.stories.find((st) => st.id === id || st.slug === id);
      if (s) return s;
    }
    const topics = (GD.newsdesk && GD.newsdesk.state && GD.newsdesk.state.feed && GD.newsdesk.state.feed.topics) || [];
    for (let i = 0; i < topics.length; i++) {
      const t = topics[i];
      const st = t.story || {};
      if (t.id === id || t.slug === id || st.id === id || st.slug === id) {
        return st.id ? st : {
          id: st.id || t.id,
          slug: st.slug || t.slug || "",
          cards: st.cards || t.cards || [],
          sources: st.sources || t.sources || [],
          asReported: st.asReported
        };
      }
    }
    return null;
  }

  function sourceOnStory(story, sid) {
    return !!(story && (story.sources || []).some((s) => s && s.id === sid));
  }

  function resolveFact(st, args) {
    const card = (st.cards || []).find((c) => c.id === args.cardId);
    if (!card) return { error: "unknown card: " + args.cardId };
    const facts = card.facts || [];
    let factIndex = args.factIndex;
    let factLabel = args.factLabel || "";
    if (typeof factIndex === "number") {
      if (!Number.isInteger(factIndex) || factIndex < 0 || factIndex >= facts.length) {
        return { error: "factIndex is not a fact on the card" };
      }
      if (factLabel && facts[factIndex] && facts[factIndex].label !== factLabel) {
        return { error: "factLabel does not match fact " + factIndex };
      }
      factLabel = facts[factIndex].label;
    } else {
      const idx = facts.findIndex((f) => f && f.label === factLabel);
      if (idx < 0) return { error: "factLabel is not a fact on the card" };
      factIndex = idx;
    }
    return { card: card, facts: facts, factIndex: factIndex, factLabel: factLabel };
  }

  function clearClaim(args, story) {
    const st = story || resolveStory(args && args.storyId);
    if (!st) return { ok: false, error: "unknown story: " + ((args && args.storyId) || "") };
    if (!args || !args.cardId) return { ok: false, error: "missing cardId" };
    if (args.factIndex == null && !args.factLabel) return { ok: false, error: "setClaim requires factIndex or factLabel" };
    const found = resolveFact(st, args);
    if (found.error) return { ok: false, error: found.error };
    const existing = findClaim(st.id, args.cardId, found.factIndex, found.factLabel);
    if (!existing) return { ok: true, result: { cleared: true, storyId: st.id, cardId: args.cardId, factIndex: found.factIndex } };
    const next = ((state.doc && state.doc.claims) || []).filter((c) => c !== existing && !(c.id && existing.id && c.id === existing.id));
    const doc = Object.assign({}, state.doc || blankDoc(), { schema: "globedesk.claims/1", claims: next });
    const ep = claimsEpisode(st);
    const errs = (GD.schema && GD.schema.validateClaims) ? GD.schema.validateClaims(doc, ep) : [];
    if (errs.length) return { ok: false, error: errs[0], errors: errs };
    load(doc, ep);
    if (GD.newsdesk && GD.newsdesk.render) GD.newsdesk.render();
    if (GD.ui && GD.ui.renderInspector) GD.ui.renderInspector();
    return { ok: true, result: { cleared: true, storyId: st.id, cardId: args.cardId, factIndex: found.factIndex } };
  }

  function setClaim(args, story) {
    const st = story || resolveStory(args && args.storyId);
    if (!st) return { ok: false, error: "unknown story: " + ((args && args.storyId) || "") };
    if (!args || !args.storyId) return { ok: false, error: "missing storyId" };
    if (!args.cardId) return { ok: false, error: "missing cardId" };
    if (args.factIndex == null && !args.factLabel) return { ok: false, error: "setClaim requires factIndex or factLabel" };
    const statuses = (GD.schema && GD.schema.CLAIM_STATUS) || ["supported", "not-proven", "disputed", "people-disagree"];
    if (!args.claimStatus || args.claimStatus === "unscored") {
      return clearClaim(args, st);
    }
    if (statuses.indexOf(args.claimStatus) < 0) {
      return { ok: false, error: "claimStatus must be " + statuses.join("|") };
    }
    const found = resolveFact(st, args);
    if (found.error) return { ok: false, error: found.error };
    const facts = found.facts;
    const factIndex = found.factIndex;
    const factLabel = found.factLabel;
    const sourceIds = Array.isArray(args.sourceIds) ? args.sourceIds.slice() : [];
    for (let i = 0; i < sourceIds.length; i++) {
      if (!sourceOnStory(st, sourceIds[i])) return { ok: false, error: "unknown source: " + sourceIds[i] };
    }
    let disagree = Array.isArray(args.disagree) ? args.disagree.map(copyGroup) : undefined;
    if (disagree) {
      for (let g = 0; g < disagree.length; g++) {
        const ids = disagree[g].sourceIds || [];
        for (let i = 0; i < ids.length; i++) {
          if (!sourceOnStory(st, ids[i])) return { ok: false, error: "unknown source: " + ids[i] };
        }
      }
    }
    const asReportedBefore = st.asReported;
    const sourceStatusBefore = (st.sources || []).map((s) => s.status);
    const factBefore = facts[factIndex];
    if (factBefore && Object.prototype.hasOwnProperty.call(factBefore, "claimStatus")) {
      return { ok: false, error: "claimStatus must not be written on the fact" };
    }
    const existing = findClaim(st.id, args.cardId, factIndex, factLabel);
    const row = {
      id: (existing && existing.id) || ("claim-" + st.id + "-" + args.cardId + "-" + factIndex),
      storyId: st.id,
      cardId: args.cardId,
      factIndex: factIndex,
      factLabel: factLabel,
      claimStatus: args.claimStatus
    };
    if (sourceIds.length) row.sourceIds = sourceIds;
    if (args.claimStatus === "people-disagree") {
      if (!disagree || disagree.length < 2) return { ok: false, error: "people-disagree needs at least two disagree groups" };
      row.disagree = disagree;
    }
    const next = (state.doc && Array.isArray(state.doc.claims)) ? state.doc.claims.slice() : [];
    const at = existing ? next.findIndex((c) => c === existing || (c.id && existing.id && c.id === existing.id)) : -1;
    if (at >= 0) next[at] = row;
    else next.push(row);
    const doc = Object.assign({}, state.doc || blankDoc(), { schema: "globedesk.claims/1", claims: next });
    const ep = claimsEpisode(st);
    const errs = (GD.schema && GD.schema.validateClaims) ? GD.schema.validateClaims(doc, ep) : [];
    if (errs.length) return { ok: false, error: errs[0], errors: errs };
    if (st.asReported !== asReportedBefore) return { ok: false, error: "scoring must not change asReported" };
    const after = (st.sources || []).map((s) => s.status);
    for (let i = 0; i < sourceStatusBefore.length; i++) {
      if (after[i] !== sourceStatusBefore[i]) return { ok: false, error: "scoring must not change source status" };
    }
    if (facts[factIndex] && Object.prototype.hasOwnProperty.call(facts[factIndex], "claimStatus")) {
      return { ok: false, error: "claimStatus must not be written on the fact" };
    }
    load(doc, ep);
    if (GD.newsdesk && GD.newsdesk.render) GD.newsdesk.render();
    if (GD.ui && GD.ui.renderInspector) GD.ui.renderInspector();
    return { ok: true, result: publicClaim(row) };
  }

  function stToEpisode(st) {
    return claimsEpisode(st);
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

  function sourceById(story, id) {
    return ((story && story.sources) || []).find((s) => s && s.id === id) || null;
  }

  function sourceNode(story, id) {
    const src = sourceById(story, id);
    const wrap = el("span");
    const label = (src && src.label) || id;
    if (src && src.url && GD.schema && GD.schema.httpsOk(src.url)) {
      const a = el("a", "claim-src");
      a.setAttribute("href", src.url);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
      txt(a, label);
      wrap.appendChild(a);
    } else {
      const s = el("span");
      txt(s, label);
      wrap.appendChild(s);
    }
    if (src && src.status) {
      const st = el("span", "claim-src-status");
      txt(st, " (" + src.status + ")");
      wrap.appendChild(st);
    }
    return wrap;
  }

  function chipNode(status) {
    if (!status || !STATUS_LABEL[status]) return null;
    const chip = el("span", "claim-chip claim-chip-" + status);
    txt(chip, STATUS_LABEL[status]);
    return chip;
  }

  function mountDisagree(parent, story, claim) {
    const groups = (claim && claim.disagree) || [];
    if (groups.length < 2) return null;
    const box = el("div", "claim-disagree");
    const note = el("p", "claim-disagree-note");
    txt(note, "Sources disagree. Both positions are shown; GlobeDesk does not pick a winner.");
    box.appendChild(note);
    const cols = el("div", "claim-disagree-cols");
    groups.forEach((g) => {
      const col = el("div", "claim-disagree-col");
      const pos = el("p", "claim-position");
      txt(pos, g.position || "");
      col.appendChild(pos);
      if ((g.sourceIds || []).length) {
        const list = el("ul", "claim-src-list");
        (g.sourceIds || []).forEach((id) => {
          const item = el("li");
          item.appendChild(sourceNode(story, id));
          list.appendChild(item);
        });
        col.appendChild(list);
      }
      cols.appendChild(col);
    });
    box.appendChild(cols);
    parent.appendChild(box);
    return box;
  }

  function mountStrip(parent, story) {
    if (!parent) return null;
    parent.textContent = "";
    if (!story) return parent;
    const rows = storyFacts(story);
    const root = el("div", "nd-claims");
    if (story.asReported !== false) {
      const badge = el("p", "claim-story-badge");
      const pill = el("span", "pill warn");
      txt(pill, "as reported, not independently verified");
      badge.appendChild(pill);
      root.appendChild(badge);
    }
    const author = el("p", "claim-author-note");
    txt(author, "Scores are set by the author, not by GlobeDesk.");
    root.appendChild(author);
    rows.forEach((row) => {
      const box = el("div", "claim-fact");
      const head = el("p", "claim-fact-head");
      const lab = el("span", "claim-label");
      txt(lab, row.factLabel);
      head.appendChild(lab);
      const chip = row.claim ? chipNode(row.claim.claimStatus) : null;
      if (chip) {
        head.appendChild(document.createTextNode(" "));
        head.appendChild(chip);
      }
      box.appendChild(head);
      const val = el("p", "claim-value");
      markUnknown(val, row.value);
      box.appendChild(val);
      if (row.claim && row.claim.claimStatus === "people-disagree") {
        mountDisagree(box, story, row.claim);
      } else if (row.claim && (row.claim.sourceIds || []).length) {
        const srcs = el("p", "claim-sources");
        row.claim.sourceIds.forEach((id, i) => {
          if (i) srcs.appendChild(document.createTextNode(" "));
          srcs.appendChild(sourceNode(story, id));
        });
        box.appendChild(srcs);
      }
      root.appendChild(box);
    });
    parent.appendChild(root);
    return root;
  }

  function htmlOf(node) {
    if (!node) return "";
    if (typeof node.innerHTML === "string") return node.innerHTML;
    return "";
  }

  function stripHtml(story) {
    if (typeof document === "undefined" || !document.createElement) return "";
    const box = document.createElement("div");
    mountStrip(box, story);
    return htmlOf(box);
  }

  function sourceCheck(src, attrName, attrValue, checked) {
    const lab = el("label", "row claim-src-opt");
    const cb = el("input");
    cb.type = "checkbox";
    cb.setAttribute(attrName, attrValue);
    cb.checked = !!checked;
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(" " + (src.label || src.id) + " "));
    const st = el("span", "muted");
    txt(st, "(" + src.status + ")");
    lab.appendChild(st);
    return lab;
  }

  function mountDisagreeEditor(parent, story, claim) {
    const sources = story.sources || [];
    const groups = (claim && claim.disagree && claim.disagree.length) ? claim.disagree : [{ sourceIds: [], position: "" }, { sourceIds: [], position: "" }];
    const box = el("div", "claim-dg-box");
    const note = el("p", "muted small");
    txt(note, "Sources disagree needs at least two groups. Both positions are stored; GlobeDesk does not pick a winner.");
    box.appendChild(note);
    groups.forEach((g, gi) => {
      const selected = {};
      (g.sourceIds || []).forEach((id) => { selected[id] = true; });
      const wrap = el("div", "claim-dg");
      wrap.setAttribute("data-claim-dg", String(gi));
      const lab = el("label");
      lab.appendChild(document.createTextNode("Position"));
      const ta = el("textarea");
      ta.setAttribute("data-claim-pos", String(gi));
      txt(ta, g.position || "");
      ta.value = g.position || "";
      lab.appendChild(ta);
      wrap.appendChild(lab);
      sources.forEach((src) => {
        const row = el("label", "row");
        const cb = el("input");
        cb.type = "checkbox";
        cb.setAttribute("data-claim-dg-index", String(gi));
        cb.setAttribute("data-claim-src-id", src.id);
        cb.checked = !!selected[src.id];
        row.appendChild(cb);
        row.appendChild(document.createTextNode(" " + (src.label || src.id)));
        wrap.appendChild(row);
      });
      box.appendChild(wrap);
    });
    parent.appendChild(box);
    return box;
  }

  function mountEditor(parent, story, onChange) {
    if (!parent) return null;
    parent.textContent = "";
    const root = el("div", "story-claims");
    const note = el("p", "muted small");
    txt(note, "Scores are set by the author, not by GlobeDesk. They live in the claims sidecar. Scoring a fact does not change source verified/unverified status or the story's as-reported badge.");
    root.appendChild(note);
    const rows = story ? storyFacts(story) : [];
    if (!rows.length) {
      parent.appendChild(root);
      return root;
    }
    const sources = story.sources || [];
    rows.forEach((row) => {
      const box = el("div", "claim-edit");
      box.setAttribute("data-claim-card", row.cardId);
      box.setAttribute("data-claim-index", String(row.factIndex));
      box.setAttribute("data-claim-label", row.factLabel);
      const head = el("p");
      const strong = el("strong");
      txt(strong, row.factLabel);
      head.appendChild(strong);
      head.appendChild(document.createTextNode(" — " + row.value));
      box.appendChild(head);
      const lab = el("label");
      lab.appendChild(document.createTextNode("Author score"));
      const sel = el("select");
      sel.setAttribute("data-claim-status", "");
      const blank = el("option");
      blank.value = "";
      txt(blank, "Unscored");
      sel.appendChild(blank);
      const status = (row.claim && row.claim.claimStatus) || "";
      Object.keys(STATUS_LABEL).forEach((k) => {
        const opt = el("option");
        opt.value = k;
        txt(opt, STATUS_LABEL[k]);
        if (status === k) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.value = status;
      lab.appendChild(sel);
      box.appendChild(lab);
      if (sources.length) {
        const srcNote = el("p", "muted small");
        txt(srcNote, "Sources for this score");
        box.appendChild(srcNote);
        const selected = {};
        ((row.claim && row.claim.sourceIds) || []).forEach((id) => { selected[id] = true; });
        sources.forEach((src) => box.appendChild(sourceCheck(src, "data-claim-src", src.id, selected[src.id])));
      }
      if (status === "people-disagree") mountDisagreeEditor(box, story, row.claim);
      root.appendChild(box);
    });
    parent.appendChild(root);
    bindEditor(root, story, onChange);
    return root;
  }

  function editorHtml(story) {
    if (typeof document === "undefined" || !document.createElement) return "";
    const box = document.createElement("div");
    mountEditor(box, story);
    return htmlOf(box);
  }

  function bindEditor(root, story, onChange) {
    if (!root) return;
    root.querySelectorAll(".claim-edit").forEach((box) => {
      const read = () => {
        const status = (box.querySelector("[data-claim-status]") || {}).value || "";
        const sourceIds = [];
        box.querySelectorAll("[data-claim-src]").forEach((cb) => {
          if (cb.checked) sourceIds.push(cb.getAttribute("data-claim-src"));
        });
        const disagree = [];
        box.querySelectorAll("[data-claim-dg]").forEach((g) => {
          const pos = (g.querySelector("[data-claim-pos]") || {}).value || "";
          const ids = [];
          g.querySelectorAll("[data-claim-src-id]").forEach((cb) => {
            if (cb.checked) ids.push(cb.getAttribute("data-claim-src-id"));
          });
          disagree.push({ sourceIds: ids, position: pos });
        });
        return {
          storyId: story.id,
          cardId: box.getAttribute("data-claim-card"),
          factIndex: Number(box.getAttribute("data-claim-index")),
          factLabel: box.getAttribute("data-claim-label"),
          claimStatus: status,
          sourceIds: sourceIds,
          disagree: disagree
        };
      };
      function wire() {
        box.querySelectorAll("select, input, textarea").forEach((node) => {
          if (node._claimWired) return;
          node._claimWired = true;
          node.addEventListener("change", onChangeField);
        });
      }
      function ensureDisagree() {
        if (box.querySelector(".claim-dg-box")) return;
        mountDisagreeEditor(box, story, null);
        wire();
      }
      function onChangeField() {
        const args = read();
        if (!args.claimStatus) {
          const out = clearClaim(args, story);
          if (!out.ok && GD.ui && GD.ui.toast) GD.ui.toast(out.error);
          if (onChange) onChange(out);
          return;
        }
        if (args.claimStatus === "people-disagree") {
          const ready = (args.disagree || []).filter((g) => String(g.position || "").trim() && (g.sourceIds || []).length).length >= 2;
          if (!ready) { ensureDisagree(); return; }
        }
        const out = setClaim(args, story);
        if (!out.ok && GD.ui && GD.ui.toast) GD.ui.toast(out.error);
        if (onChange) onChange(out);
      }
      wire();
    });
  }

  function fetchJson(url) {
    return fetch(url, { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null));
  }

  function boot(fetcher) {
    const get = fetcher || fetchJson;
    return Promise.resolve(get(PATH)).then((doc) => {
      load(doc, claimsEpisode());
      return state;
    }).catch(() => {
      empty();
      state.loaded = true;
      state.errors = ["claims sidecar could not be loaded"];
      return state;
    });
  }

  function openFor(storyId) {
    const story = resolveStory(storyId);
    if (!story) return { ok: false, error: "unknown story: " + storyId };
    let alreadyOpen = false;
    const nd = GD.newsdesk;
    if (nd && nd.state && nd.state.view !== "workspace") {
      const topics = (nd.state.feed && nd.state.feed.topics) || [];
      const topic = topics.find((t) => (nd.topicMatches ? nd.topicMatches(t, storyId) : false) ||
        t.id === story.id || t.slug === story.slug || (t.story && (t.story.id === story.id || t.story.slug === story.slug)));
      const key = topic ? (topic.id || topic.slug || topic.title) : (story.id || story.slug || storyId);
      alreadyOpen = nd.state.selectedId != null && String(nd.state.selectedId) === String(key);
      if (nd.selectTopic) nd.selectTopic(key, { silent: true });
    } else if (GD.ui && GD.state && GD.state.episode) {
      const ep = GD.state.episode;
      const idx = ep.stories.findIndex((s) => s.id === story.id || s.slug === story.slug);
      if (idx < 0) return { ok: false, error: "unknown story: " + storyId };
      alreadyOpen = GD.state.storyIdx === idx && GD.state.tab === "cards";
      if (GD.ui.selectStory) GD.ui.selectStory(idx, { fly: false });
      GD.state.tab = "cards";
      if (GD.ui.renderInspector) GD.ui.renderInspector();
    } else if (nd && nd.selectTopic) {
      nd.selectTopic(story.id || storyId, { silent: true });
    }
    return { ok: true, result: { storyId: story.id, alreadyOpen: alreadyOpen } };
  }

  GD.claims = {
    PATH, STATUS_LABEL, state, load, boot, reload, empty, allClaims, findClaim,
    storyFacts, listed, setClaim, clearClaim, stripHtml, editorHtml, bindEditor,
    mountStrip, mountEditor, resolveStory, openFor, publicClaim, claimsEpisode, collidingStoryIds
  };
})();
