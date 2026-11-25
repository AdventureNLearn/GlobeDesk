/* Every GlobeDesk feature, in tutorial order, with a Live / Coming soon label.
 * Labels come only from running the feature: "check" names a check in tests/smoke-features.mjs and
 * "smoke" names another smoke test that exercises it. A feature is Live only when that run passes, and
 * Coming soon when the app itself says it is not wired yet (or it could not be run end to end; those are
 * listed as [UNKNOWN] in docs/FEATURES.md). tests/smoke-features.mjs fails if a label and its run disagree.
 * target: the button the tutorial highlights (hidden in Lite view for editing tools; the step says so). */
(function () {
  "use strict";
  const GD = (window.GD = window.GD || {});
  const L = "Live", C = "Coming soon";
  GD.tutorialFeatures = [
    { id: "globe", title: "The globe", status: L, check: "globe", body: "Drag to move the globe. Scroll, pinch or use + and − to zoom. The compass resets north." },
    { id: "touch", title: "Touch gestures", status: L, smoke: "tests/smoke-touch.mjs", body: "On a touch screen, one finger moves the globe and a two-finger pinch zooms. A pinch never rotates or tilts it." },
    { id: "home", title: "Home", status: L, check: "home", target: "btnReset", body: "<strong>⌂ Home</strong> (or H) flies back to the start view without changing your layers." },
    { id: "layers", title: "Layers", status: L, check: "layers", target: "btnLayers", body: "<strong>Layers</strong> (or L) lists every base map and overlay with an on/off switch, a description and a legend. Show all and Hide all are at the top." },
    { id: "dated-imagery", title: "Dated satellite imagery", status: L, check: "datedImagery", target: "dataYear", needsFull: true, body: "Move the <strong>Data year</strong> slider and the satellite layer switches to imagery from that year where it exists. Needs the network." },
    { id: "official-gis", title: "Official GIS layers", status: L, check: "officialGis", target: "btnLayers", body: "Official public map services (for example USGS and Census) sit further down in Layers. They stay off until you turn them on, and they need the network." },
    { id: "atlas", title: "Atlas", status: L, check: "atlas", target: "btnAtlas", body: "<strong>Atlas</strong> is GlobeDesk's own cited encyclopedia (draft): A–Z, categories, by place and by year, at four reading levels." },
    { id: "atlas-3d", title: "3D objects and bells", status: L, smoke: "tests/smoke-atlas.mjs", target: "btnAtlas", body: "In an Atlas entry, <strong>Globe | 3D</strong> draws the object (the bag solar kit, the bells) in 3D. It is an artistic layout, not a build drawing." },
    { id: "your-layers", title: "Your layers", status: L, smoke: "tests/smoke-atlas.mjs", target: "btnLayers", body: "Add your own places and notes as a layer of your own. It stays in this browser." },
    { id: "newsdesk", title: "News desk", status: L, check: "newsdesk", target: "newsdesk", needsFull: true, body: "Browse 50 example topics in 10 sections. Click a card and the globe flies to it." },
    { id: "desks", title: "Work desks", status: L, check: "desks", target: "deskSelect", needsFull: true, body: "The <strong>Desk</strong> menu switches between News and nine work desks, each with its scope and official sources." },
    { id: "research", title: "Claims, research and records", status: L, smoke: "tests/smoke-claims.mjs", target: "newsdesk", needsFull: true, body: "On a topic, open its claims, research notes and public records side by side. Claims stay \"as reported\" until you check them." },
    { id: "sample", title: "Sample episode", status: L, check: "sample", target: "sgSample", body: "Open the short Washington, DC sample from the first step of this guide or Menu → File → Sample. Pins are approximate." },
    { id: "workspace", title: "Workspace editor", status: L, check: "workspace", target: "btnViewToggle", needsFull: true, body: "<strong>Workspace</strong> opens the full editor: rundown, media bin, inspector and playback." },
    { id: "stories", title: "Stories", status: L, check: "stories", target: "addStory", needsFull: true, body: "In the rundown, <strong>+ story</strong> adds a story. Set its title, date, summary and credit on the Story tab." },
    { id: "pins", title: "Pins", status: L, check: "pins", needsFull: true, body: "Right-click the globe (or long-press on touch) to drop the story pin. A plain click only selects." },
    { id: "gazetteer", title: "Town search (offline)", status: L, check: "gazetteer", needsFull: true, body: "On the Story tab, search the bundled town list to place a pin without the network." },
    { id: "media", title: "Media bin", status: L, check: "media", target: "drop", needsFull: true, body: "Drop audio, video or images into the media bin. Files stay on this device." },
    { id: "place-media", title: "Place media on the globe", status: L, check: "place", target: "tab-place", needsFull: true, body: "The <strong>Place</strong> tab turns media into a card, a pin popup, a screen overlay, a map-anchored panel or an allowlisted embed." },
    { id: "events", title: "Event layers", status: L, smoke: "tests/smoke-events.mjs", target: "tab-events", needsFull: true, body: "The <strong>Events</strong> tab draws or imports points, routes and areas (GeoJSON, CSV, KML)." },
    { id: "callouts", title: "Cards on the globe", status: L, smoke: "tests/smoke-callouts.mjs", needsFull: true, body: "Topic cards open on the globe next to their pins and never overlap each other." },
    { id: "playback", title: "Playback", status: L, check: "playback", target: "btnPlay", needsFull: true, body: "Play, pause and scrub the episode. The camera flies story to story." },
    { id: "data-year", title: "Data year", status: L, check: "dataYear", target: "dataYear", needsFull: true, body: "The <strong>Data year</strong> slider sets which year the map data shows, without moving playback." },
    { id: "assist", title: "Use your assistant", status: L, check: "assist", target: "tab-assist", needsFull: true, body: "The <strong>Assist</strong> tab copies a ready prompt. Paste the JSON your assistant returns and GlobeDesk validates it before loading. Nothing is sent from this panel." },
    { id: "browser-voice", title: "Browser voice preview", status: C, check: "browserVoice", target: "browserVoice", needsFull: true, body: "Reads the script aloud with the browser's own voice (preview only, not recorded)." },
    { id: "save-open", title: "Save and open", status: L, check: "open", needsFull: true, body: "Menu → File → <strong>Save JSON</strong> downloads the episode; <strong>Open</strong> loads it again." },
    { id: "save-project", title: "Save project", status: L, check: "saveProject", needsFull: true, body: "Menu → File → <strong>Save project</strong> writes a .globedesk pack with the episode and its media." },
    { id: "captions", title: "Captions (VTT and SRT)", status: L, check: "captions", needsFull: true, body: "Captions come from the script. Menu → Export → <strong>VTT</strong> or <strong>SRT</strong> saves them." },
    { id: "record", title: "Record WebM", status: L, smoke: "tests/smoke.mjs", target: "btnRecord", needsFull: true, body: "<strong>● Record</strong> captures the stage in real time at 16:9 or 9:16, with sound. Nothing is uploaded." },
    { id: "mp4", title: "Export MP4", status: L, check: "mp4", target: "btnExport", needsFull: true, body: "<strong>Export</strong> renders a frame-accurate MP4 at 16:9 or 9:16." },
    { id: "share-pack", title: "Offline share pack", status: L, smoke: "tests/smoke-sharepack.mjs", target: "btnExport", needsFull: true, body: "<strong>Export</strong> also builds a share pack that plays from a folder with no network." },
    { id: "archive", title: "Archive", status: L, check: "archive", needsFull: true, body: "Menu → File → <strong>Archive</strong> keeps a card for every show and story ever added. Open one to bring it back." },
    { id: "layouts", title: "Layouts and panel lock", status: L, check: "layouts", target: "btnMenu", needsFull: true, body: "Menu → View: Edit, Record / Present, Research and Compact layouts, and Lock all panels." },
    { id: "menu", title: "Menu and search", status: L, check: "menu", target: "btnMenu", body: "<strong>☰ Menu</strong> (Alt+M) holds every command. Type to search it." },
    { id: "shortcuts", title: "Keyboard shortcuts", status: L, check: "shortcuts", body: "H goes Home, L opens Layers, Alt+M opens the menu, Esc closes a dialog." },
    { id: "lite", title: "Lite view", status: L, check: "lite", target: "btnLiteToggle", body: "<strong>Lite view</strong> keeps the globe and the main buttons. <strong>Full view</strong> brings every tool back." },
    { id: "command-api", title: "Local command API", status: L, smoke: "tests/smoke-p3.mjs", body: "With the local Python server, scripts can drive GlobeDesk (load, play, pause, explore). It only listens on this computer." },
    { id: "region-packs", title: "Offline region packs", status: L, smoke: "tests/smoke-p2.mjs", body: "Download a region's imagery once and GlobeDesk shows it with no network." },
    { id: "paid-options", title: "Optional paid imagery (MapTiler)", status: C, check: "paidOptions", target: "btnSettings", needsFull: true, body: "MapTiler satellite imagery with your own key. The settings panel is there; this build has not been checked with a key." },
    { id: "cloud-voice", title: "Cloud voices", status: C, check: "cloudVoice", body: "Cloud text-to-speech for scripts. Not wired yet." },
    { id: "cloud-ai", title: "Cloud AI suggestions", status: C, check: "cloudAi", body: "AI summaries and card suggestions from a cloud model. Not wired yet; the Assist tab works today." },
    { id: "historical-map", title: "Historical map (OpenHistoricalMap)", status: C, check: "historicalMap", target: "btnLayers", body: "A historical base map. Listed in Layers, not wired yet." },
    { id: "history-video", title: "History video", status: C, check: "historyVideo", video: true, body: "A short video about the history timeline will go here." },
    { id: "help", title: "Help", status: L, check: "tutorial", target: "btnHelp", body: "<strong>? Help</strong> opens this tour again at any time. Skip closes it." }
  ];
})();
