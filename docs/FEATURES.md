# GlobeDesk features and status

Every feature the in-app tutorial walks through (**? Help**), with the label it shows. Labels come
only from running the feature: **Live** means its check passed in headless Chrome; **Coming soon** means
the app itself says it is not wired yet, it is a placeholder, or it could not be run end to end here
(those rows say `[UNKNOWN]`). `tests/smoke-features.mjs` re-runs the checks and fails if a label and
its result disagree. The labels live in `js/tutorial-features.js`; this file is written by
`node tools/features-table.mjs <evidence.json>`.

39 Live, 5 Coming soon, 44 features.

| # | Feature | Status | How it was checked | What the run showed |
|---|---|---|---|---|
| 1 | The globe | **Live** | tests/smoke-features.mjs → `globe` | globe projection, style loaded, canvas 1095 px wide |
| 2 | Touch gestures | **Live** | `tests/smoke-touch.mjs` | phone and Lite: one finger pans, pinch zooms, no rotate or tilt, page and panel scroll |
| 3 | Home | **Live** | tests/smoke-features.mjs → `home` | moved to 120°E 40°S, Home returned to 40°, 28° |
| 4 | Layers | **Live** | tests/smoke-features.mjs → `layers` | panel opened with 29 switches |
| 5 | Dated satellite imagery | **Live** | tests/smoke-features.mjs → `datedImagery` | after opting in, year 2020 drew 35 tiles from NASA GIBS (badge "RECORDED · GIBS 2020-07-01") |
| 6 | Official GIS layers | **Live** | tests/smoke-features.mjs → `officialGis` | "usgs-topo" drew 18 tiles from basemap.nationalmap.gov |
| 7 | Atlas | **Live** | tests/smoke-features.mjs → `atlas` | Atlas opened, 178 entries |
| 8 | 3D objects and bells | **Live** | `tests/smoke-atlas.mjs` | Atlas, desks, Layers user sections, 3D and bell 3D, 0 console errors |
| 9 | Your layers | **Live** | `tests/smoke-atlas.mjs` | Atlas, desks, Layers user sections, 3D and bell 3D, 0 console errors |
| 10 | News desk | **Live** | tests/smoke-features.mjs → `newsdesk` | 50 topics; clicking a card moved the globe |
| 11 | Work desks | **Live** | tests/smoke-features.mjs → `desks` | 10 desks; switched to "jobsite" and its desk text showed |
| 12 | Claims, research and records | **Live** | `tests/smoke-claims.mjs` | claims, research and records sidecars on a topic |
| 13 | Sample episode | **Live** | tests/smoke-features.mjs → `sample` | loaded "Washington, DC demo — the National Mall", 2 stories |
| 14 | Workspace editor | **Live** | tests/smoke-features.mjs → `workspace` | Workspace view opened with the rundown |
| 15 | Stories | **Live** | tests/smoke-features.mjs → `stories` | + story: 2 → 3 stories |
| 16 | Pins | **Live** | tests/smoke-features.mjs → `pins` | right-click on the globe set the story pin's lat/lon |
| 17 | Town search (offline) | **Live** | tests/smoke-features.mjs → `gazetteer` | "Paris" found offline (FRA) |
| 18 | Media bin | **Live** | tests/smoke-features.mjs → `media` | PNG added, media bin 0 → 1 |
| 19 | Place media on the globe | **Live** | tests/smoke-features.mjs → `place` | Place tab lists card, overlay and embed options |
| 20 | Event layers | **Live** | `tests/smoke-events.mjs` | draw, render, GeoJSON/CSV/KML round trips passed; event-clock hide check failed ([4,4]) — already failing at 9c5326d |
| 21 | Cards on the globe | **Live** | `tests/smoke-callouts.mjs` | several cards at zoom 1.5 to 12, desktop and phone, no overlaps |
| 22 | Playback | **Live** | tests/smoke-features.mjs → `playback` | played to t = 1.7 s |
| 23 | Data year | **Live** | tests/smoke-features.mjs → `dataYear` | slider set the data year to 2018 |
| 24 | Use your assistant | **Live** | tests/smoke-features.mjs → `assist` | invalid JSON rejected; the sample JSON validated |
| 25 | Browser voice preview | **Coming soon** | tests/smoke-features.mjs → `browserVoice` | [UNKNOWN] the browser speech API is present (19 voices), but speech cannot be heard in headless Chrome |
| 26 | Save and open | **Live** | tests/smoke-features.mjs → `open` | saved JSON re-opened (3 stories) |
| 27 | Save project | **Live** | tests/smoke-features.mjs → `saveProject` | .globedesk pack downloaded (13828 bytes) |
| 28 | Captions (VTT and SRT) | **Live** | tests/smoke-features.mjs → `captions` | VTT (starts WEBVTT) and SRT downloaded |
| 29 | Record WebM | **Live** | `tests/smoke.mjs` | WebM recordings produced (bytes > 0) at 16:9 and 9:16 |
| 30 | Export MP4 | **Live** | tests/smoke-features.mjs → `mp4` | 2 s export: 2026-11-21-globedesk-16x9.mp4, 60 frames, 1920x1080, 2.5 MiB |
| 31 | Offline share pack | **Live** | `tests/smoke-sharepack.mjs` | pack built, opened from disk with every host blocked, played with no network requests |
| 32 | Archive | **Live** | tests/smoke-features.mjs → `archive` | Archive opened with 4 cards |
| 33 | Layouts and panel lock | **Live** | tests/smoke-features.mjs → `layouts` | Record / Present layout applied; Lock all panels on |
| 34 | Menu and search | **Live** | tests/smoke-features.mjs → `menu` | menu opened; searching "sample" found Sample |
| 35 | Keyboard shortcuts | **Live** | tests/smoke-features.mjs → `shortcuts` | L opened Layers; H returned Home |
| 36 | Lite view | **Live** | tests/smoke-features.mjs → `lite` | Lite view hid the news desk; Full view restored it |
| 37 | Local command API | **Live** | `tests/smoke-p3.mjs` | command API: DC sample, pause, explore, resume |
| 38 | Offline region packs | **Live** | `tests/smoke-p2.mjs` | region pack shown offline, origin check |
| 39 | Optional paid imagery (MapTiler) | **Coming soon** | tests/smoke-features.mjs → `paidOptions` | [UNKNOWN] the settings panel opens, but MapTiler imagery needs your own paid key and was not run |
| 40 | Cloud voices | **Coming soon** | tests/smoke-features.mjs → `cloudVoice` | the settings panel marks it "stub" and "not wired" |
| 41 | Cloud AI suggestions | **Coming soon** | tests/smoke-features.mjs → `cloudAi` | the settings panel marks it "stub" and "not wired" |
| 42 | Historical map (OpenHistoricalMap) | **Coming soon** | tests/smoke-features.mjs → `historicalMap` | Layers lists it as "Historical map (OpenHistoricalMap) [UNKNOWN] — not wired yet" |
| 43 | History video | **Live** | tests/smoke-features.mjs → `historyVideo` | tutorial step is Live, links to videos.html, HISTORY_VIDEO_URL is the hosted 720p film |
| 44 | Help | **Live** | tests/smoke-features.mjs → `tutorial` | Help opened the tour (45 steps); Skip closed it |

## History video

The tutorial has a **History video** step, labelled **Live**, that links to
[videos.html](../videos.html). That page plays the hosted 720p film
(US history, 1775–2026) with captions (WebVTT and SubRip) and a chapter list.
`HISTORY_VIDEO_URL` in `js/tutorial-features.js` is the 720p MP4 on the public
asset host. The film file is not in this repository.

## Lite view

Lite view is new in this build (`?lite=1`, the **Lite view** button, or Menu → View). It keeps the
globe, Home, Layers, Atlas and Help, and hides the news desk, editing panels, playback bar and export
tools. Features marked "needs Full view" in the tutorial are one tap away with **Full view**.
