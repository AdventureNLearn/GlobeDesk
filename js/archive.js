/* Archive: every show and story ever added keeps a card and can be brought back.
   - Bundled shows (the Washington, DC sample) are rebuilt from code or from the
     episode JSON, so they can never go missing.
   - Stories you add or load are snapshotted into a local index (IndexedDB key "archive").
     The index is append-only: remember() and merge() never drop a card, and deleting a
     story from the rundown does not touch it.
   window.GD.archive */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const SCHEMA = "globedesk.archive/1";

  function sampleBuild() {
    if (GD.model && GD.model.sampleEpisode) return GD.model.sampleEpisode();
    return null;
  }

  // Bundled shows. `file` is the same show as a JSON file in /episodes/.
  const SHOWS = [
    { id: "washington-dc-demo", show: "GlobeDesk", label: "Washington, DC demo — the National Mall",
      handle: "@AdventureNLearn", handleUrl: "https://x.com/AdventureNLearn",
      file: "episodes/washington-dc-demo.globedesk.json", isDefault: false, build: sampleBuild }
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

  GD.archive = { SCHEMA, SHOWS, show, blankIndex, keyFor, cardFor, remember, merge, bundledIndex, all, list, bringBack, openShow, load, save, rememberEpisode, KEY, _mem: mem };
  if (typeof module !== "undefined") module.exports = GD.archive;
})();
