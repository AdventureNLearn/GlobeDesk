/* Archive: every show and story ever added keeps a card and can be brought back.
   - Bundled shows (Frogpost, and the archived CTD show) are rebuilt from code, so they
     can never go missing.
   - Stories you add or load are snapshotted into a local index (IndexedDB key "archive").
     The index is append-only: remember() and merge() never drop a card, and deleting a
     story from the rundown does not touch it.
   window.GD.archive */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const SCHEMA = "globedesk.archive/1";
  const CTD = { handle: "@TheCriticalDri1", handleUrl: "https://x.com/TheCriticalDri1" };

  // Archived show: "CTD's Geopolitics Update" (20 Nov 2026), credited to its creator.
  // Structure only: claims are restated from the creator's public post and are NOT
  // independently verified. Locations are approximate city/strait centers.
  // Not the default show; it opens from the Archive.
  function ctdEpisode() {
    const M = GD.model, U = M.U, uid = M.uid, blankStory = M.blankStory, blankCard = M.blankCard, blankEpisode = M.blankEpisode;
    const autoCameraPathForLocation = M.autoCameraPathForLocation;
    const POST = "https://x.com/TheCriticalDri1/status/2123762612571886024";
    const POST2 = "https://x.com/TheCriticalDri1/status/2123762859985277078";
    const creatorSrc = (label, url) => ({
      id: uid("src"),
      label,
      url,
      status: "unverified",
      note: "Creator's own public post. Not independently checked. Primary sources [UNKNOWN]."
    });
    const mk = (n, slug, title, loc, cardTitle, cardBody, script) => {
      const s = blankStory(n);
      s.slug = slug;
      s.title = title;
      s.location = Object.assign({ precision: "approximate", verified: false, note: "demo, not verified" }, loc);
      s.camera = autoCameraPathForLocation(loc, 8, (typeof window !== 'undefined' && window.GD_LAND) || null);
      s.durationSec = 16;
      s.highlight = { a3: loc.a3 || null, geojson: null };
      // Map-shot citation reflects the default free base map (see README for licenses).
      // "auto" fills credit/license from whichever base map is on (see globe.baseCitation).
      s.camera.forEach((k) => { k.citation = { type: "Map", date: "auto", credit: "auto", license: "auto" }; });
      const c = blankCard(loc.lat, loc.lon);
      c.title = cardTitle;
      c.body = cardBody;
      c.why = U;
      c.facts = [
        { label: "Claim status", value: "As stated in creator's post; not verified" },
        { label: "Exact site", value: U },
        { label: "Primary source", value: U }
      ];
      c.at = 2;
      c.dur = 12;
      s.sources = [creatorSrc("CTD's Geopolitics Update post (X)", POST)];
      s.credit = CTD.handle;
      s.creditUrl = POST;
      c.sourceIds = [s.sources[0].id];
      s.cards = [c];
      s.script = script;
      s.captions = GD.captions ? GD.captions.fromScript(script, s.durationSec) : [];
      return s;
    };
    const ep = blankEpisode();
    ep.look = GD.themes ? GD.themes.lookFor("ctd") : { theme: "ctd" };
    ep.look.headerBadge = "NOW COVERING";
    ep.demo = true;
    ep.sample = true;
    ep.show = "CTD's Geopolitics Update";
    ep.title = "🌍 CTD's Geopolitics Update, Fri Nov 20 '26";
    ep.date = "2026-11-20";
    ep.lede = "Three stories from the creator's post: an Iran tanker convoy vs a U.S. blockade in Hormuz; Russia hits three Kyiv bridges after Kerch strikes; a Houthi missile hits Riyadh's tallest tower. DEMO STRUCTURE ONLY: claims are not verified here.";
    ep.cta = "Full 16-min brief 👇 Follow for daily updates.";
    ep.handle = "@TheCriticalDri1";
    ep.outro.handle = "@TheCriticalDri1";
    ep.outro.link = "[channel link — UNKNOWN]";
    ep.links = [
      { label: "Creator post", url: POST },
      { label: "Creator post (brief link)", url: POST2 }
    ];
    ep.stories = [
      mk(1, "hormuz", "Iran tanker convoy vs U.S. blockade in Hormuz",
        { name: "Strait of Hormuz (approx. center)", lat: 26.57, lon: 56.25, a3: "IRN" },
        "Tanker convoy vs blockade",
        "Placeholder card. The creator's post reports an Iranian tanker convoy facing a U.S. blockade in the Strait of Hormuz. Details, vessels and positions: [UNKNOWN].",
        "Story one. The creator reports an Iranian tanker convoy facing a U.S. blockade in the Strait of Hormuz. This is demo structure only. Details are unknown and not verified."),
      mk(2, "kyiv-bridges", "Russia hits three Kyiv bridges after Kerch strikes",
        { name: "Kyiv, Dnipro river crossings (approx.)", lat: 50.45, lon: 30.56, a3: "UKR" },
        "Three Kyiv bridges",
        "Placeholder card. The creator's post reports Russian strikes on three Kyiv bridges following Kerch strikes. Which bridges, and damage: [UNKNOWN].",
        "Story two. The creator reports that Russia hit three bridges in Kyiv after strikes on Kerch. Which bridges were hit is unknown here. Not verified."),
      mk(3, "riyadh-tower", "Houthi missile hits Riyadh's tallest tower",
        { name: "Riyadh (city, approx.; exact tower not pinned)", lat: 24.71, lon: 46.68, a3: "SAU" },
        "Riyadh strike claim",
        "Placeholder card. The creator's post reports a Houthi missile hitting Riyadh's tallest tower. The building is not pinned here; exact site: [UNKNOWN].",
        "Story three. The creator reports a Houthi missile strike on Riyadh's tallest tower. The exact building is not pinned in this demo. Not verified.")
    ];
    if (GD.events) ep.eventLayers = GD.events.demoLayers(ep);
    ep.mediaBin = [
      { ref: "placeholder-brief-16x9", name: "Full brief 16:9 (16 min) — drop file", kind: "video", local: false, note: "Placeholder slot" },
      { ref: "placeholder-vertical-9x16", name: "Vertical cut 9:16 (47 s) — drop file", kind: "video", local: false, note: "Placeholder slot" }
    ];
    return ep;
  }


  // Bundled shows, newest default first. `file` is the same show as a JSON file in /episodes/.
  const SHOWS = [
    { id: "frogpost-2026-11-20", show: "Frogpost", label: "Frogpost — 20 Nov 2026", handle: "@AdventureNLearn", handleUrl: "https://x.com/AdventureNLearn",
      file: "episodes/frogpost-2026-11-20.globedesk.json", isDefault: true, build: () => GD.model.demoEpisode() },
    { id: "ctd-geopolitics-2026-11-20", show: "CTD's Geopolitics Update", label: "CTD's Geopolitics Update — 20 Nov 2026 (archive)", handle: CTD.handle, handleUrl: CTD.handleUrl,
      file: "episodes/demo-2026-11-20.globedesk.json", isDefault: false, build: ctdEpisode }
  ];
  function show(id) { return SHOWS.find((s) => s.id === id) || null; }

  function blankIndex() { return { schema: SCHEMA, cards: {} }; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function keyFor(showId, st) { return String(showId || "local") + "/" + String((st && (st.slug || st.id)) || "story"); }
  function firstSource(st) {
    const s = (st.sources || []).find((x) => x && x.url) || null;
    return s ? { label: s.label || "", url: s.url } : null;
  }

  // One archive card for a story. `snapshot` is a full copy so it can be restored exactly.
  function cardFor(st, ep, showId, now) {
    const sh = show(showId);
    const src = firstSource(st);
    return {
      key: keyFor(showId, st),
      showId: String(showId || "local"),
      show: (sh && sh.show) || (ep && ep.show) || "",
      handle: (sh && sh.handle) || (ep && ep.handle) || "",
      storyId: st.id,
      slug: st.slug || "",
      title: st.title || "",
      place: (st.location && st.location.name) || "",
      pinned: !!(st.location && st.location.lat != null && st.location.lon != null),
      summary: st.summary || "",
      credit: st.credit || "",
      creditUrl: st.creditUrl || "",
      source: src,
      bundled: !!sh,
      archivedAt: now || Date.now(),
      snapshot: clone(st)
    };
  }

  // Add or refresh cards for every story in an episode. Never removes a card.
  function remember(index, ep, showId, now) {
    const idx = index && index.cards ? index : blankIndex();
    const sid = showId || (ep && ep.id) || "local";
    ((ep && ep.stories) || []).forEach((st) => {
      if (!st) return;
      const c = cardFor(st, ep, sid, now);
      const old = idx.cards[c.key];
      if (old) c.archivedAt = old.archivedAt;
      idx.cards[c.key] = c;
    });
    return idx;
  }

  // Union of two indexes. A card in either survives.
  function merge(a, b) {
    const out = blankIndex();
    [a, b].forEach((ix) => { Object.keys((ix && ix.cards) || {}).forEach((k) => { out.cards[k] = ix.cards[k]; }); });
    return out;
  }

  // Bundled shows as an index (rebuilt from code every time; cannot be pruned).
  function bundledIndex() {
    let idx = blankIndex();
    SHOWS.forEach((s) => { try { idx = remember(idx, s.build(), s.id, 0); } catch (e) { /* show stays listed in SHOWS */ } });
    return idx;
  }

  // Everything: bundled cards plus the local index.
  function all(local) { return merge(bundledIndex(), local); }

  function list(index, showId) {
    const cards = Object.keys((index && index.cards) || {}).map((k) => index.cards[k]);
    return showId ? cards.filter((c) => c.showId === showId) : cards;
  }

  // Bring a card's story back into an episode. Returns the story index in ep.stories.
  // If the same story id is already in the rundown, it is selected instead of copied.
  function bringBack(index, key, ep) {
    const c = index && index.cards && index.cards[key];
    if (!c || !ep || !Array.isArray(ep.stories)) return -1;
    const have = ep.stories.findIndex((s) => s && s.id === c.storyId);
    if (have >= 0) return have;
    const st = clone(c.snapshot);
    if (GD.model && GD.model.normalizeStory) GD.model.normalizeStory(st);
    ep.stories.push(st);
    return ep.stories.length - 1;
  }

  // Open the show a card belongs to: { episode, storyIdx } or null for local cards.
  function openShow(key, index) {
    const c = index && index.cards && index.cards[key];
    const sh = c ? show(c.showId) : null;
    if (!sh) return null;
    const ep = sh.build();
    const i = ep.stories.findIndex((s) => (s.slug || s.id) === (c.slug || c.storyId));
    return { episode: ep, storyIdx: Math.max(0, i) };
  }

  // Local persistence (IndexedDB "kv" store, key "archive"). Writes are merged, never replaced.
  const KEY = "archive";
  const mem = { index: null };
  function load() {
    if (!GD.store || !GD.store.getKv) return Promise.resolve(mem.index || blankIndex());
    return GD.store.getKv(KEY).then((v) => (v && v.cards ? v : mem.index || blankIndex())).catch(() => mem.index || blankIndex());
  }
  function save(index) {
    return load().then((cur) => {
      const merged = merge(cur, index);
      mem.index = merged;
      if (!GD.store || !GD.store.putKv) return merged;
      return GD.store.putKv(KEY, merged).then(() => merged);
    });
  }
  function rememberEpisode(ep, showId) {
    return load().then((cur) => save(remember(cur, ep, showId)));
  }

  GD.archive = { SCHEMA, SHOWS, CTD, show, ctdEpisode, blankIndex, keyFor, cardFor, remember, merge, bundledIndex, all, list, bringBack, openShow, load, save, rememberEpisode, KEY, _mem: mem };
  if (typeof module !== "undefined") module.exports = GD.archive;
})();
