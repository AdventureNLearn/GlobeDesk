/* Short cited flyover for a first visit. It is built from four stories already in the
   bundled news desk (newsdesk/topics/newsdesk-50.globedesk.json): their titles, captions,
   cards, sources and camera moves are reused as they are, nothing is added. The stops run
   in date order and each story's event window is its own date, so during playback the
   event clock reveals each place when it is reached and keeps later ones hidden.
   It is only offered while the open episode is an untouched blank. window.GD.flyover */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const PATH = "newsdesk/topics/newsdesk-50.globedesk.json";
  // Date order. Each has a day-precise date and a verified source in the topics file.
  const STOPS = [
    "story-nd-royal-observatory-greenwich",
    "story-nd-suez-canal",
    "story-nd-panama-canal",
    "story-nd-un-headquarters"
  ];
  const LAYER_ID = "evl-first-run-flyover";
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  const clone = (v) => JSON.parse(JSON.stringify(v));

  // Returns null if any stop, its date or its pin is missing: no stop is ever made up.
  function build(topics, look) {
    if (!topics || !Array.isArray(topics.stories)) return null;
    const stories = STOPS.map((id) => topics.stories.find((s) => s && s.id === id));
    if (stories.some((s) => !s || !DAY.test(s.date || "") || !(s.camera || []).length || !(s.sources || []).length)) return null;
    const feats = [];
    (topics.eventLayers || []).forEach((l) => (l.features || []).forEach((f) => {
      if (f && f.properties && STOPS.indexOf(f.properties.storyId) >= 0 && f.geometry && DAY.test(f.properties.eventTime || "")) feats.push(clone(f));
    }));
    if (STOPS.some((id) => !feats.some((f) => f.properties.storyId === id))) return null;
    const ep = GD.model.blankEpisode();
    ep.id = "ep-first-run-flyover";
    ep.show = "GlobeDesk";
    ep.title = "A short cited flyover: four dated places";
    ep.lede = "Four stories from the bundled news desk, in date order. Each card cites its source. Pins are approximate.";
    ep.cta = "";
    ep.sample = true; ep.demo = true;
    if (look) ep.look = clone(look);
    ep.outro = { enabled: false, durationSec: 0, line1: "", link: "", handle: "", showXLogo: false };
    ep.stories = stories.map((s) => {
      const st = clone(s);
      st.eventWindow = { start: st.date, end: st.date };
      return st;
    });
    ep.links = [];
    ep.stories.forEach((s) => (s.sources || []).forEach((src) => { if (src.url && !ep.links.some((l) => l.url === src.url)) ep.links.push({ label: src.label, url: src.url }); }));
    feats.sort((a, b) => STOPS.indexOf(a.properties.storyId) - STOPS.indexOf(b.properties.storyId));
    ep.eventLayers = [{
      id: LAYER_ID, name: "Flyover stops (approximate pins)", color: "#5ee6ff", icon: "●",
      visible: true, labels: true, styleByCategory: false, scope: "all",
      note: "Copied from the news desk topics layer. Pins are approximate unless a cited official page published a coordinate. Not street addresses.",
      features: feats
    }];
    return ep;
  }

  // The flyover is offered only when nothing would be lost by opening it.
  function offerable(ep) {
    const U = GD.model.U;
    if (!ep || GD.model.hasTimeline(ep)) return false;
    if ((ep.mediaBin || []).length || (ep.eventLayers || []).some((l) => (l.features || []).length)) return false;
    if (ep.title && ep.title !== U) return false;
    return (ep.stories || []).every((s) => (!s.title || s.title === U) && (!s.location || s.location.lat == null));
  }

  let cached = null;
  function load() {
    if (cached) return Promise.resolve(cached);
    return fetch(PATH, { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)).then((doc) => { cached = doc; return doc; });
  }

  async function play() {
    const S = GD.state;
    if (!offerable(S.episode)) return false;
    let ep = null;
    try { ep = build(await load(), S.episode.look); } catch (e) { ep = null; }
    if (!ep) { if (GD.ui) GD.ui.toast("The flyover could not be built from the bundled stories."); return false; }
    if (!GD.ui.loadEpisode(ep, "Flyover: four cited places in date order. Pins are approximate.")) return false;
    S.eventClockMode = "follow";
    GD.playback.play();
    return true;
  }

  GD.flyover = { PATH, STOPS, LAYER_ID, build, offerable, load, play };
})();
