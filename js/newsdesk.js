/* Consumer news-desk view: section tabs, story cards, fly-to, and a toggle
   into the full editor suite. Feed is newsdesk/sections.json plus optional
   catalog/topic files. window.GD.newsdesk */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const VIEW_KEY = "globedesk-view";
  const FEED_PATHS = [
    "newsdesk/sections.json",
    "newsdesk/catalog.json",
    "newsdesk/topics/newsdesk-50.globedesk.json"
  ];

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function asArray(v) { return Array.isArray(v) ? v : []; }

  function topicLocation(t) {
    if (!t || typeof t !== "object") return null;
    const loc = t.location || {};
    const lat = loc.lat != null ? Number(loc.lat) : (t.lat != null ? Number(t.lat) : null);
    const lon = loc.lon != null ? Number(loc.lon) : (t.lon != null ? Number(t.lon) : null);
    if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return {
      lat: lat,
      lon: lon,
      name: loc.name || t.locationName || t.place || t.title || "",
      zoom: t.zoom != null ? Number(t.zoom) : (loc.zoom != null ? Number(loc.zoom) : 8)
    };
  }

  function storyToTopic(st, ep, i) {
    const loc = (st && st.location) || {};
    return {
      id: st.slug || st.id || ("story-" + (i + 1)),
      slug: st.slug || "",
      section: st.section || st.sectionId || (ep && (ep.section || ep.sectionId)) || "",
      sectionId: st.sectionId || st.section || (ep && (ep.sectionId || ep.section)) || "",
      openIn: Array.isArray(st.openIn) ? st.openIn.slice() : [],
      title: st.title || "",
      dek: st.summary || st.lede || "",
      date: st.date || (ep && ep.date) || "",
      credit: st.credit || "",
      creditUrl: st.creditUrl || "",
      location: loc,
      sources: st.sources || [],
      story: st
    };
  }

  function countUnknown(value) {
    const s = typeof value === "string" ? value : JSON.stringify(value || "");
    const m = s.match(/\[UNKNOWN\]/g);
    return m ? m.length : 0;
  }

  function topicKey(t) {
    if (!t || typeof t !== "object") return "";
    return String(t.slug || t.id || t.headline || t.title || "");
  }

  function normalizeTopic(t, i) {
    if (!t || typeof t !== "object") return null;
    const loc = (t.location && typeof t.location === "object") ? Object.assign({}, t.location) : {};
    if (t.lat != null && loc.lat == null) loc.lat = t.lat;
    if (t.lon != null && loc.lon == null) loc.lon = t.lon;
    if (t.locationName && !loc.name) loc.name = t.locationName;
    if (t.precision && !loc.precision) loc.precision = t.precision;
    const note = loc.note || t.pinNote || t.note || "";
    if (note && !loc.note) loc.note = note;
    const title = t.title || t.headline || "";
    const dek = t.dek || t.summary || t.lede || "";
    const sources = asArray(t.sources);
    if (!sources.length && t.primarySource) sources.push({ label: t.publisher || t.credit || "", url: t.primarySource });
    const unknownMarks = countUnknown(note) + countUnknown(dek) + countUnknown(title) + countUnknown(loc) + countUnknown(t.story || t.cards);
    return {
      id: t.slug || t.id || ("topic-" + ((i == null ? 0 : i) + 1)),
      slug: t.slug || "",
      section: t.section || t.sectionId || "",
      sectionId: t.sectionId || t.section || "",
      tags: asArray(t.tags),
      title: title,
      dek: dek,
      date: t.date || "",
      credit: t.credit || t.publisher || "",
      creditUrl: t.creditUrl || t.primarySource || "",
      location: loc,
      pinNote: note,
      precision: loc.precision || t.precision || "",
      sources: sources,
      story: t.story || null,
      openIn: asArray(t.openIn || (t.story && t.story.openIn)),
      hasUnknown: unknownMarks > 0,
      unknownMarks: unknownMarks
    };
  }

  function mergeTopic(a, b) {
    if (!a) return normalizeTopic(b);
    if (!b) return normalizeTopic(a);
    const left = Object.assign({}, a);
    const right = b;
    const loc = Object.assign({}, left.location || {}, right.location || {});
    if (!loc.note) loc.note = right.pinNote || left.pinNote || "";
    const note = loc.note || right.pinNote || left.pinNote || "";
    const title = left.title || right.title || "";
    const dek = left.dek || right.dek || "";
    const unknownMarks = countUnknown(note) + countUnknown(dek) + countUnknown(title) + countUnknown(loc) + countUnknown(right.story || left.story);
    return {
      id: left.slug || left.id || right.slug || right.id,
      slug: left.slug || right.slug || "",
      section: left.section || left.sectionId || right.section || right.sectionId || "",
      sectionId: left.sectionId || left.section || right.sectionId || right.section || "",
      tags: left.tags && left.tags.length ? left.tags : (right.tags || []),
      title: title,
      dek: dek,
      date: left.date || right.date || "",
      credit: left.credit || right.credit || "",
      creditUrl: left.creditUrl || right.creditUrl || "",
      location: loc,
      pinNote: note,
      precision: loc.precision || left.precision || right.precision || "",
      sources: (left.sources && left.sources.length) ? left.sources : (right.sources || []),
      story: left.story || right.story || null,
      openIn: (left.openIn && left.openIn.length) ? left.openIn : (right.openIn || []),
      hasUnknown: unknownMarks > 0,
      unknownMarks: unknownMarks
    };
  }

  function normalizeSections(sections, topics) {
    const list = asArray(sections).map((s, i) => {
      if (typeof s === "string") return { id: s, name: s, order: i + 1, description: "" };
      return {
        id: String(s.id || s.slug || s.name || ("section-" + (i + 1))),
        name: s.name || s.title || s.id || ("Section " + (i + 1)),
        order: s.order != null ? Number(s.order) : (i + 1),
        description: s.description || s.dek || ""
      };
    });
    const seen = {};
    list.forEach((s) => { seen[s.id] = true; });
    asArray(topics).forEach((t) => {
      const sid = t && (t.section || t.sectionId);
      if (sid && !seen[sid]) {
        list.push({ id: String(sid), name: String(sid), order: list.length + 1, description: "" });
        seen[sid] = true;
      }
    });
    list.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
    return list;
  }

  function parseFeed(doc) {
    const empty = { sections: [], topics: [], episode: null };
    if (!doc || typeof doc !== "object") return empty;
    let topics = [];
    let sections = [];
    let episode = null;

    if (Array.isArray(doc.topics) || Array.isArray(doc.items) || Array.isArray(doc.entries)) {
      topics = asArray(doc.topics || doc.items || doc.entries);
    }
    if (Array.isArray(doc.sections) || Array.isArray(doc.categories)) {
      sections = asArray(doc.sections || doc.categories);
      if (!topics.length) {
        sections.forEach((s) => {
          asArray(s && (s.topics || s.items)).forEach((t) => {
            const row = Object.assign({}, t);
            if (!row.section) row.section = s.id || s.slug || s.name;
            topics.push(row);
          });
        });
      }
    }
    if (Array.isArray(doc.catalog)) topics = topics.concat(doc.catalog);
    if (Array.isArray(doc.stories)) {
      episode = doc;
      const fromStories = doc.stories.map((st, i) => storyToTopic(st, doc, i));
      topics = topics.length ? topics.concat(fromStories) : fromStories;
    }
    if (doc.episode && Array.isArray(doc.episode.stories)) {
      episode = episode || doc.episode;
      topics = topics.concat(doc.episode.stories.map((st, i) => storyToTopic(st, doc.episode, i)));
    }
    topics = topics.map((row, i) => normalizeTopic(row, i)).filter(Boolean);
    sections = normalizeSections(sections, topics);
    return { sections: sections, topics: topics, episode: episode };
  }

  function mergeFeeds(parts) {
    const out = { sections: [], topics: [], episode: null };
    const secSeen = {};
    const byKey = {};
    const order = [];
    (parts || []).forEach((p) => {
      if (!p) return;
      (p.sections || []).forEach((s) => {
        if (!s || secSeen[s.id]) return;
        secSeen[s.id] = true;
        out.sections.push(s);
      });
      (p.topics || []).forEach((t) => {
        const key = topicKey(t);
        if (!key) return;
        if (!byKey[key]) { byKey[key] = normalizeTopic(t); order.push(key); }
        else byKey[key] = mergeTopic(byKey[key], normalizeTopic(t));
      });
      if (p.episode) out.episode = p.episode;
    });
    out.topics = order.map((k) => byKey[k]);
    out.sections = normalizeSections(out.sections, out.topics);
    return out;
  }

  function topicsInSection(feed, sectionId) {
    const topics = (feed && feed.topics) || [];
    if (!sectionId || sectionId === "all") return topics.slice();
    return topics.filter((t) => String(t.section || t.sectionId || "") === String(sectionId));
  }

  function flyTarget(topic) {
    const loc = topicLocation(topic);
    if (!loc) return null;
    const zoom = loc.zoom != null && !Number.isNaN(loc.zoom) ? loc.zoom : 8;
    return {
      center: [loc.lon, loc.lat],
      lat: loc.lat,
      lon: loc.lon,
      zoom: zoom,
      pitch: zoom >= 12 ? 45 : 20,
      bearing: 0,
      durationSec: 1.6
    };
  }

  function readStoredView() {
    try {
      if (typeof sessionStorage === "undefined") return "newsdesk";
      const v = sessionStorage.getItem(VIEW_KEY);
      return v === "workspace" ? "workspace" : "newsdesk";
    } catch (e) { return "newsdesk"; }
  }

  function storeView(view) {
    try {
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(VIEW_KEY, view);
    } catch (e) { /* ignore */ }
  }

  function nextView(current) {
    return current === "workspace" ? "newsdesk" : "workspace";
  }

  const state = {
    view: "newsdesk",
    feed: { sections: [], topics: [], episode: null },
    sectionId: "all",
    selectedId: null,
    loaded: false,
    loadError: null
  };

  function applyView(view) {
    state.view = view === "workspace" ? "workspace" : "newsdesk";
    storeView(state.view);
    if (typeof document === "undefined") return state.view;
    const body = document.body;
    if (body) {
      body.classList.remove("view-newsdesk", "view-workspace");
      body.classList.add("view-" + state.view);
    }
    const btn = document.getElementById("btnViewToggle");
    if (btn) {
      const toWorkspace = state.view === "newsdesk";
      btn.setAttribute("aria-pressed", toWorkspace ? "false" : "true");
      btn.textContent = toWorkspace ? "Workspace" : "News desk";
      btn.title = toWorkspace ? "Open the full editor suite" : "Back to the news desk";
    }
    const nd = document.getElementById("newsdesk");
    if (nd) nd.hidden = state.view !== "newsdesk";
    return state.view;
  }

  function toggleView() { return applyView(nextView(state.view)); }

  function esc(s) {
    if (GD.sanitize && GD.sanitize.esc) return GD.sanitize.esc(String(s == null ? "" : s));
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  }

  function render() {
    if (typeof document === "undefined") return;
    const secEl = document.getElementById("ndSections");
    const cardEl = document.getElementById("ndCards");
    const metaEl = document.getElementById("ndMeta");
    if (!secEl || !cardEl) return;
    const feed = state.feed;
    const n = feed.topics.length;
    if (metaEl) {
      if (state.loadError) metaEl.textContent = "Could not load the news-desk feed.";
      else if (!state.loaded) metaEl.textContent = "Loading topics…";
      else if (!n) metaEl.textContent = "No topics in the feed yet.";
      else metaEl.textContent = n + " topic" + (n === 1 ? "" : "s") + " · " + feed.sections.length + " section" + (feed.sections.length === 1 ? "" : "s");
    }
    const tabs = [{ id: "all", name: "All" }].concat(feed.sections);
    secEl.innerHTML = tabs.map((s) => {
      const on = String(state.sectionId) === String(s.id);
      const count = s.id === "all" ? feed.topics.length : topicsInSection(feed, s.id).length;
      return `<button type="button" class="nd-tab${on ? " on" : ""}" data-section="${esc(s.id)}" aria-pressed="${on ? "true" : "false"}">${esc(s.name)} <span class="nd-count">${count}</span></button>`;
    }).join("");
    const rows = topicsInSection(feed, state.sectionId);
    if (!rows.length) {
      cardEl.innerHTML = `<p class="muted small">${state.loaded ? "No stories in this section." : "Waiting for the topic feed."}</p>`;
      return;
    }
    cardEl.innerHTML = rows.map((t) => {
      const id = t.id || t.slug || t.title;
      const loc = topicLocation(t);
      const place = (loc && loc.name) || t.locationName || t.place || "";
      const on = state.selectedId != null && String(state.selectedId) === String(id);
      const pin = (t.precision === "approximate" || (t.location && t.location.precision === "approximate")) ? "Approximate pin" : (t.precision || "");
      const meta = [place, t.date, t.credit, pin].filter(Boolean).join(" · ");
      const note = t.pinNote || (t.location && t.location.note) || "";
      const mark = (s) => esc(s).replace(/\[UNKNOWN\]/g, '<span class="nd-unknown">[UNKNOWN]</span>');
      const openHtml = (GD.outbound && GD.outbound.cardHtml) ? GD.outbound.cardHtml(topicAsStory(t)) : "";
      const claimsSlot = (on && GD.claims && GD.claims.mountStrip) ? '<div class="nd-claims-slot" id="ndClaimsSlot"></div>' : "";
      const researchSlot = (on && GD.research && GD.research.mountButton) ? '<div class="nd-research-slot" id="ndResearchSlot"></div>' : "";
      const recordsSlot = (on && GD.records && GD.records.mountStrip) ? '<div class="nd-records-slot" id="ndRecordsSlot"></div>' : "";
      const gisIds = t.gisOverlayIds || (t.story && t.story.gisOverlayIds) || [];
      const gisSlot = (on && GD.gis && GD.gis.mountNewsdesk && gisIds.length) ? '<div class="nd-gis-slot" id="ndGisSlot"></div>' : "";
      return `<div class="nd-item"><article class="nd-card${on ? " on" : ""}" data-topic="${esc(id)}" tabindex="0" role="button">
        <h3>${mark(t.title || "Untitled")}</h3>
        <p class="nd-dek">${mark(t.dek || t.summary || "")}</p>
        <p class="nd-meta">${esc(meta)}</p>
        ${note ? `<p class="nd-note">${mark(note)}</p>` : ""}
      </article>${claimsSlot}${researchSlot}${recordsSlot}${gisSlot}${openHtml}</div>`;
    }).join("");
    attachClaimsStrip(cardEl, rows);
    attachResearch(cardEl, rows);
    attachRecords(cardEl, rows);
    attachGis(cardEl, rows);
    renderIdCollisionNotice();
    if (GD.research && GD.research.sync) GD.research.sync();
  }

  function attachRecords(cardEl, rows) {
    if (!cardEl || !GD.records || !GD.records.mountStrip) return;
    const selected = rows && rows.find((t) => {
      const id = t.id || t.slug || t.title;
      return state.selectedId != null && String(state.selectedId) === String(id);
    });
    if (!selected) return;
    const story = selected.story || selected;
    let slot = cardEl.querySelector ? cardEl.querySelector(".nd-records-slot") : null;
    if (!slot && typeof document !== "undefined" && document.getElementById) {
      const found = document.getElementById("ndRecordsSlot");
      if (found && found.parentNode === cardEl) slot = found;
    }
    if (!slot && typeof document !== "undefined" && document.createElement) {
      slot = document.createElement("div");
      slot.className = "nd-records-slot";
      slot.id = "ndRecordsSlot";
      cardEl.appendChild(slot);
    }
    if (slot) GD.records.mountStrip(slot, story);
  }


  function attachGis(cardEl, rows) {
    if (!cardEl || !GD.gis || !GD.gis.mountNewsdesk) return;
    const selected = rows && rows.find((t) => {
      const id = t.id || t.slug || t.title;
      return state.selectedId != null && String(state.selectedId) === String(id);
    });
    if (!selected) return;
    const story = selected.story || selected;
    if (!story || !Array.isArray(story.gisOverlayIds) || !story.gisOverlayIds.length) return;
    let slot = cardEl.querySelector ? cardEl.querySelector(".nd-gis-slot") : null;
    if (!slot && typeof document !== "undefined" && document.getElementById) {
      const found = document.getElementById("ndGisSlot");
      if (found && found.parentNode === cardEl) slot = found;
    }
    if (!slot && typeof document !== "undefined" && document.createElement) {
      slot = document.createElement("div");
      slot.className = "nd-gis-slot";
      slot.id = "ndGisSlot";
      cardEl.appendChild(slot);
    }
    if (slot) GD.gis.mountNewsdesk(slot, story);
  }

  function collidingStoryIds() {
    if (GD.claims && GD.claims.collidingStoryIds) return GD.claims.collidingStoryIds();
    return [];
  }

  function renderIdCollisionNotice() {
    if (typeof document === "undefined") return;
    let box = document.getElementById("ndNotice");
    if (!box && document.createElement) {
      const host = document.getElementById("newsdesk");
      box = document.createElement("div");
      box.id = "ndNotice";
      box.className = "nd-notice";
      const cards = document.getElementById("ndCards");
      if (host && cards && host.insertBefore) host.insertBefore(box, cards);
      else if (host) host.appendChild(box);
    }
    if (!box) return;
    const ids = collidingStoryIds();
    box.textContent = "";
    if (!ids.length) {
      box.setAttribute("hidden", "");
      return;
    }
    box.removeAttribute("hidden");
    box.setAttribute("role", "alert");
    box.className = "nd-notice nd-id-collision";
    const p = document.createElement("p");
    const who = ids.length === 1 ? ("Workspace story id " + ids[0] + " is also used by a news-desk story.") : ("Workspace story ids " + ids.join(", ") + " are also used by a news-desk story.");
    p.textContent = who + " The workspace copy is used for claim scores and research notes. Those still apply when the two copies are identical; they are not applied if the workspace copy differs.";
    box.appendChild(p);
  }

  function attachResearch(cardEl, rows) {
    if (!cardEl || !GD.research || !GD.research.mountButton) return;
    const selected = rows && rows.find((t) => {
      const id = t.id || t.slug || t.title;
      return state.selectedId != null && String(state.selectedId) === String(id);
    });
    if (!selected) return;
    const story = selected.story || selected;
    let slot = cardEl.querySelector ? cardEl.querySelector(".nd-research-slot") : null;
    if (!slot && typeof document !== "undefined" && document.getElementById) {
      const found = document.getElementById("ndResearchSlot");
      if (found && found.parentNode === cardEl) slot = found;
    }
    if (!slot && typeof document !== "undefined" && document.createElement) {
      slot = document.createElement("div");
      slot.className = "nd-research-slot";
      slot.id = "ndResearchSlot";
      if (cardEl.appendChild) cardEl.appendChild(slot);
      else return;
    }
    if (slot) GD.research.mountButton(slot, story);
  }

  function attachClaimsStrip(cardEl, rows) {
    if (!cardEl || !GD.claims || !GD.claims.mountStrip) return;
    const selected = rows && rows.find((t) => {
      const id = t.id || t.slug || t.title;
      return state.selectedId != null && String(state.selectedId) === String(id);
    });
    if (!selected) return;
    const story = selected.story || selected;
    let slot = null;
    if (cardEl.querySelector) slot = cardEl.querySelector(".nd-claims-slot");
    if (!slot && typeof document !== "undefined" && document.getElementById) {
      const found = document.getElementById("ndClaimsSlot");
      if (found && (found.parentNode === cardEl || (cardEl.contains && cardEl.contains(found)))) slot = found;
    }
    if (!slot && typeof document !== "undefined" && document.createElement) {
      slot = document.createElement("div");
      slot.className = "nd-claims-slot";
      slot.id = "ndClaimsSlot";
      if (cardEl.appendChild) cardEl.appendChild(slot);
      else return;
    }
    if (slot) GD.claims.mountStrip(slot, story);
  }


  function topicAsStory(t) {
    const st = (t && t.story) || {};
    return {
      id: st.id || (t && (t.id || t.slug)) || "",
      slug: st.slug || (t && t.slug) || "",
      sectionId: (t && (t.sectionId || t.section)) || st.sectionId || st.section || "",
      section: (t && (t.section || t.sectionId)) || st.section || st.sectionId || "",
      openIn: st.openIn || (t && t.openIn) || []
    };
  }

  function flyToTopic(topic) {
    const target = flyTarget(topic);
    if (!target || !GD.globe || !GD.globe.flyTo) return false;
    GD.globe.flyTo(target);
    return true;
  }

  function topicMatches(t, id) {
    if (t == null || id == null) return false;
    const st = t.story || {};
    return [t.id, t.slug, t.title, st.id, st.slug].some((k) => k != null && String(k) === String(id));
  }

  function selectTopic(id, opts) {
    const rows = (state.feed && state.feed.topics) || [];
    const topic = rows.find((t) => topicMatches(t, id)) || null;
    state.selectedId = topic ? (topic.id || topic.slug || topic.title) : null;
    render();
    if (topic && !(opts && opts.silent)) flyToTopic(topic);
    return topic;
  }

  function wire() {
    if (typeof document === "undefined") return;
    const btn = document.getElementById("btnViewToggle");
    if (btn && !btn._ndWired) {
      btn._ndWired = true;
      btn.addEventListener("click", function () { toggleView(); });
    }
    const secEl = document.getElementById("ndSections");
    const cardEl = document.getElementById("ndCards");
    if (secEl && !secEl._ndWired) {
      secEl._ndWired = true;
      secEl.addEventListener("click", function (ev) {
        const t = ev.target.closest("[data-section]");
        if (!t) return;
        state.sectionId = t.getAttribute("data-section") || "all";
        render();
      });
    }
    if (cardEl && !cardEl._ndWired) {
      cardEl._ndWired = true;
      const go = (el) => { if (el) selectTopic(el.getAttribute("data-topic")); };
      cardEl.addEventListener("click", function (ev) {
        const node = ev.target && ev.target.nodeType === 3 ? ev.target.parentNode : ev.target;
        if (node && node.closest && node.closest("a.nd-openin-link, .nd-openin, .nd-claims, .nd-claims-slot, a.claim-src, .nd-research-slot, .nd-research, .nd-research-open, .nd-records-slot, .nd-offmap, .nd-gis-slot, .nd-gis")) {
          ev.stopPropagation();
          return;
        }
        go(ev.target.closest("[data-topic]"));
      });
      cardEl.addEventListener("keydown", function (ev) {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const el = ev.target.closest("[data-topic]");
        if (!el) return;
        ev.preventDefault();
        go(el);
      });
    }
    if (!document._ndEscWired) {
      document._ndEscWired = true;
      document.addEventListener("keydown", function (ev) {
        if (ev.key !== "Escape" && ev.code !== "Escape") return;
        const tag = (document.activeElement && document.activeElement.tagName) || "";
        if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
        if (GD.research && GD.research.isOpen && GD.research.isOpen()) {
          ev.preventDefault();
          GD.research.close();
        }
      });
    }
  }

  async function fetchJson(url) {
    const r = await fetch(url, { credentials: "same-origin" });
    if (!r.ok) return null;
    return r.json();
  }

  async function loadFeed(fetcher) {
    const get = fetcher || fetchJson;
    const parts = [];
    state.loadError = null;
    for (let i = 0; i < FEED_PATHS.length; i++) {
      try {
        const doc = await get(FEED_PATHS[i]);
        if (doc) parts.push(parseFeed(doc));
      } catch (e) {
        /* missing files are fine; a hard failure is recorded if nothing loads */
      }
    }
    state.feed = mergeFeeds(parts);
    state.loaded = true;
    if (!state.feed.topics.length && !state.feed.sections.length) {
      /* Empty is valid when the feed is not ready yet. */
    }
    if (GD.claims && GD.claims.reload) GD.claims.reload();
    if (GD.research && GD.research.reload) GD.research.reload();
    if (GD.records && GD.records.reload) GD.records.reload();
    render();
    return state.feed;
  }

  function boot() {
    applyView(readStoredView());
    wire();
    render();
    const outboundReady = (GD.outbound && GD.outbound.boot) ? GD.outbound.boot() : Promise.resolve();
    return Promise.resolve(outboundReady).then(function () {
      return loadFeed();
    }).then(function (feed) {
      const claimsReady = (GD.claims && GD.claims.boot) ? GD.claims.boot() : Promise.resolve();
      return Promise.resolve(claimsReady).then(function () {
        const researchReady = (GD.research && GD.research.boot) ? GD.research.boot() : Promise.resolve();
        return Promise.resolve(researchReady).then(function () {
          const recordsReady = (GD.records && GD.records.boot) ? GD.records.boot() : Promise.resolve();
          const gisReady = (GD.gis && GD.gis.boot) ? GD.gis.boot() : Promise.resolve();
          return Promise.all([recordsReady, gisReady]).then(function () {
            render();
            return feed;
          });
        });
      });
    });
  }

  function setFeed(doc) {
    state.feed = parseFeed(doc);
    state.loaded = true;
    state.loadError = null;
    render();
    return state.feed;
  }

  GD.newsdesk = {
    VIEW_KEY, FEED_PATHS, parseFeed, mergeFeeds, topicsInSection, topicLocation,
    flyTarget, nextView, readStoredView, applyView, toggleView, loadFeed, setFeed,
    selectTopic, flyToTopic, topicMatches, render, wire, boot, state, storyToTopic, normalizeTopic, mergeTopic, topicKey, countUnknown, topicAsStory
  };
})();
