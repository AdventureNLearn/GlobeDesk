# GlobeDesk

A local, free newsdesk and video-editing studio built on a talking globe. You pick the stories, and the globe flies from orbit all the way down to street level for each one. Topic cards pin to the place, sources carry a verified or unverified label, captions are always on, and you drop in your own pre-recorded voiceover and media. Create your own stories, drop pins, import event layers, attach local video, images and audio, place them on the globe, and export a shareable `.globedesk` project or a local WebM at 16:9 or 9:16.

The bundled **Sample** episode is a removable template inspired by the public format of **@TheCriticalDri1** ("CTD's Geopolitics Update"). The default **CTD** look follows that public 47-second vertical cut as an example use case only. Claims in the sample are not verified and are not GlobeDesk's reporting. Start from **New blank** to make your own show.

> **Status:** v0.5.0. Local only. No backend, no account, no required API key. Media you add stays on this device.

## Risks / read first

- **Demo data is approximate and not verified.** Pins, zones, scripts and cards in the bundled demo are placeholders restated from public posts. They are not independently checked. Every claim should be treated as "as reported, not verified" unless you check it yourself.
- **Third-party tile services have no uptime guarantee.** The free satellite and street maps come from EOX, OpenFreeMap (and, if you turn them on, terrain tiles and NASA GIBS). They can be slow, incomplete, or unavailable. If a street or satellite *style* fails to load, GlobeDesk falls back to the bundled offline globe (coastlines, countries and towns only). If tiles fail later, use Layers → Offline globe; the app will prompt you.
- **Recording is local.** WebM capture, JSON, project packs, captions and layer exports stay in your browser or your Downloads folder. Nothing is uploaded by GlobeDesk.
- **Uploads stay on this device.** Audio, video and images you drop in are stored in this browser's IndexedDB only. They are never sent to a GlobeDesk server (there isn't one). You are responsible for having the rights to anything you upload, record, or share with someone else.
- **User text and imported files are sanitized.** Links must be https and open with `rel=noopener`. Embeds are limited to an allowlist (YouTube / X) and require a credit. Imported JSON is schema-validated. A Content-Security-Policy lists the exact hosts the app may talk to.
- **No keys are required.** GlobeDesk is free by default.
- **Any key you add stays in this browser's localStorage** (`globedesk.optional.*`; older `gobedesk.optional.*` keys are still read). Keys are never written into episode files, the repo, or logs. Use "Forget key" to remove one.
- **License:** MIT. See [LICENSE](LICENSE). Copyright (c) 2026 AdventureNLearn. Third-party components keep their own licenses (MapLibre, map data, and fonts — see *Data, credits and licenses* below).

## Run it

**Windows (no install):** double-click `START-GLOBEDESK.bat` (see [WINDOWS-RUN.md](WINDOWS-RUN.md)). Target folder: `C:\GlobeDesk` (or any folder you choose).

**Any OS**, from this folder:

```bash
python3 tools/serve.py          # forces correct MIME types, opens the browser
# or
python3 -m http.server 8080 --bind 127.0.0.1
# or
npx serve .
```

Then open <http://127.0.0.1:8080>. Use a local server rather than `file://`.

URL options: `?blank=1` (start from the blank template), `?sample=1` (load the removable sample), `?base=offline` (bundled globe, no network), `?aspect=9:16`, `?t=25` (seek, in seconds), `?import=/episodes/....json` (same-origin episode only).

Tests (Node 20+, plus Google Chrome for the smoke test):

```bash
node tests/unit.mjs              # model, captions, pacing, validation, secrets scan, v0.4 checks
node tests/events.unit.mjs       # Event Layers model: validation, time, geometry, GeoJSON/CSV/KML
node tests/v04.unit.mjs          # project pack, media limits, content-layer invariance helpers
node tests/smoke-events.mjs      # one load: draw tools, rendering, round trips, event clock, frame
node tests/build-templates.mjs   # regenerates episodes/*.globedesk.json from js/model.js
node tests/smoke.mjs             # serves, headless Chrome (no puppeteer), fails on console errors, writes shots/
python3 tools/make_grokme_manifest.py --check   # Grok.me kit manifest
```




## Interactive mission demo

The frog-guided mission under [`demo/`](demo/) is **AdventureNLearn’s example tour** of the desk. The frog, the voice, the script, the lamps, the radio and the theme all live in a swappable **guide pack** (`demo/guide-packs/frogpost/`). Any user can edit that pack or load their own — see `demo/guide-packs/README.md`.

Run it from this repository:

```bash
python3 demo/tools/serve.py          # http://127.0.0.1:8765/
```

The temporary voice lab is **off** in production (`tempVoiceLab.enabled` in `demo/js/config.js`). Live internet radio, when you turn it on, is streamed from the station — this repo does not vendor song files. Share-video recordings mix a credited CC BY 4.0 bed (“Cool Rock” by Kevin MacLeod, incompetech.com) under the boot and debrief; the widget shows that credit. The MP3 is kept out of the repo.

The demo folder is **not** part of the Grok.me upload kit (it is over the kit’s 20 MiB budget, mostly voice WAVs). Clone the repo to run it locally.

## Base map and user content

The globe and its base map (satellite, streets, buildings, optional terrain, bundled offline outlines) are a separate **core layer**. Your stories, media, cards, sound, embeds and event layers live in a **content layer / plugin** on top. User content never changes the base map's code, style, or tiles. Loading or clearing a project leaves the base map state unchanged (this is tested). See [docs/STORY-FORMAT.md](docs/STORY-FORMAT.md) for the data shape.

## Getting started

A longer walkthrough is in [USER-GUIDE.md](USER-GUIDE.md). Short version:

1. Double-click `START-GLOBEDESK.bat` (Windows) or run `python3 tools/serve.py`, then open <http://127.0.0.1:8080>.
2. Click **New blank** (or keep the labelled **Sample** and replace it).
3. **Make your own story:** add a story in the rundown, set a title and summary, drop a pin by clicking the globe, entering coordinates, or searching the bundled gazetteer, then write cards, sources and captions. Mark other people's work with a credit. Leave **As reported, not independently verified** on unless you have checked the claim.
4. **Add sound:** drop audio into the media bin, then use the Sound tab (volume, offset, loop) or set a voiceover on the Shots tab.
5. **Place media:** use the Place tab to put a file on a card, a pin popup, a screen overlay, or a geo-anchored panel. Embeds must be https YouTube or X links and need a credit.
6. **Use your assistant:** open the Assist tab, copy the prompt, paste the JSON it returns, and Validate and load. Nothing is sent to a model from GlobeDesk. Same-origin `postMessage` (`{type:"globedesk.import", json}`) and `?import=/episodes/...json` also work; remote URLs are not fetched.
7. **Save and share:** *Save project* writes a `.globedesk` file (JSON + media) to your Downloads folder. *Save JSON* writes `.globedesk.json` without media. Record WebM is still local. You are responsible for rights in anything you share.
8. **Grok.me:** if you want a hosted builder copy, follow [GROK-ME-BUILD.md](GROK-ME-BUILD.md). You load the kit yourself; nothing in this repo publishes to Grok.me.

Truncated titles and citations on the stage show their full text on hover or click, and in the Readable view.

## Why MapLibre GL JS (globe projection)

- **Free and keyless.** MapLibre GL JS 5.24.1 is BSD-3-Clause licensed and is **vendored in `vendor/`**, so no CDN is needed. The default hybrid base uses OpenFreeMap vector tiles (no key), 3D building extrusions, and optional Terrarium terrain from zoom 11.
- **Real globe-to-street zoom** in one renderer: a globe projection at low zoom, then streets, place labels and pitched 3D buildings at about z16–17.
- **Recordable.** The WebGL canvas uses `preserveDrawingBuffer`, so `captureStream` and `MediaRecorder` can composite it with overlays.

## What's in the desk

| Panel | What it does |
|---|---|
| **Rundown** | The story list: add, reorder, duplicate, delete. Each story shows its location, duration, cards, shots and verification. |
| **Stage** | The globe preview at 16:9 or 9:16, with safe-zone guides. The overlays you see are painted by **the same painter the recorder uses**, so the preview matches the recording. |
| **Transport** | Play/pause (Space), a scrubber with story segments, orange cut ticks and the outro segment. There's also an optional free browser voice for previewing. |
| **Readable view** | Live text of the current header, source boxes, cards and captions, for viewers who are hard of hearing and for screen readers (`aria-live`). |
| **Story tab** | Title, summary, date, credit, an **as reported, not verified** toggle, duration, place search over the bundled gazetteer (works offline — there is no online address lookup), click the globe or enter coordinates to drop a **story pin**, an optional separate **street-level camera target**, verified flag, focus-region glow (any country, or your own GeoJSON polygon), script, and **spatial insight**: the nearest mapped towns with distance and bearing, computed locally. Street zoom only runs when the target (or the pin, if no target is set) is on land. |
| **Camera tab** | Keyframes: orbit → dive → street → cinematic presets, "set from view", preview, ease, the **cut** flag, a **Go to street level** action, and a **per-shot citation box** (media type, date, credit, license). Citation boxes sit under the header and the headline starts to the right of the badge so the box cannot clip the title. |
| **Cards tab** | Topic, stat, quote, timeline and insight cards: title, body, why it matters, key facts, linked sources, timing, and a verified flag. There's a local "suggest from script" splitter and a "spatial insight card". |
| **Sources tab** | Label, https link, a **verified or unverified** status, and a note. Anything unknown is marked `[UNKNOWN]`. |
| **Captions tab** | Auto cues from the script, SRT/VTT import, and per-cue editing. Export SRT or VTT for the whole episode from the top bar. |
| **Shots tab** | Media from the bin: b-roll or still, timing, and a per-shot citation. Pick the story's voiceover track here. |
| **Look tab** | Theme preset (CTD / Newsdesk), show name, date, handle, header badge, caption size and style, citation boxes, lower third, shot length, colors, and the **editable outro card**. |
| **Layers tab** | Base maps and overlays, each with its credit and terms (see below). |
| **Sound tab** | Your own audio tracks per story: volume, offset into the file, loop, start time. Mixed into playback and the local WebM recording. Pre-recorded voiceover still lives on the Shots tab. |
| **Place tab** | Put uploaded media on the desk as a card, a pin popup, a screen overlay (picture-in-picture or full frame, with position, size and opacity), a geo-anchored panel that moves with the map, or an allowlisted https embed (YouTube / X) with credit required. Each element is clickable, can be shown or hidden, and has timing and order. |
| **Assist tab** | Copy a ready prompt plus the story schema, then paste JSON from any assistant you already have. Strict validation before load. Default voice is the browser's free speech synthesis. |
| **Media bin** | Drag and drop audio, video or images. Files are type- and size-checked and kept in IndexedDB on this device. Drag an item onto the stage, or click **Use**, to add it at the playhead. Audio can be the story's voiceover or a sound overlay. |
| **Save project** | Export a `.globedesk` pack (JSON plus media) you can move to another machine, or a `.globedesk.json` episode without media. The desk also autosaves in this browser. |
| **Optional paid** | Settings for features that cost money, all off by default (see below). |

### CTD preset (default)

This is built from the creator's public 47-second vertical cut, and everything in it can be changed in the Look tab.

- **Voiceover over maps and file media, no music, cold open.** The episode starts speaking over the map at t = 0.
- **Persistent header (top 15%).** A red `NOW COVERING` badge and a white headline to the right of the badge, with a second bar for show, date and handle.
- **Source citation boxes.** Small, semi-transparent grey boxes in the upper left, **under the header**, in the form `File photo (Apr 2026) / Photo: … / …; Public domain`. Each shot (map keyframe cut or media shot) has its own citation. Map shots set to `auto` take the credit of whichever base map is on.
- **Captions always on.** Bottom center (the bottom 15%), large bold white sans-serif, 1–2 lines, no box, with a drop shadow. No lower third and no ticker.
- **Maps.** Satellite at low zoom, blending into OpenFreeMap streets, place labels and 3D buildings at street zoom; soft white borders; the focus country with a **glowing orange border and a translucent fill**; and flat white country labels.
- **Pacing.** About 6 cuts in about 47 s: the auto path makes two ~8 s shots per story, cut on topic shifts. Water pins without a land street-level target stay at a regional close instead of an empty-sea street dive.
- **Outro.** A solid dark navy card with "Full brief on the channel", the channel link, and the X mark with the handle. All three are editable placeholders.
- **Palette.** Neutral dark grey, black and white, with red accents and orange map highlights.
- **9:16 safe zones.** Header 15% at the top, captions 15% at the bottom, 6% side margins (toggle the guides under the stage).

### Episode model (`globedesk.episode/1`)

```text
episode: schema, id, show, title, date, handle, lede, cta, links[], demo,
         look{theme, header, headerBadge, captions*, citations, lowerThird, shotSec, palette, map, safeArea},
         outro{enabled, durationSec, line1, link, handle, showXLogo},
         output{aspect, fps}, mediaBin[{ref, name, kind, local}], stories[]
story:   id, slug, title, durationSec,
         location{name, lat, lon, precision, verified, note,
                  look?{lat, lon, name, note}}, highlight{a3 | geojson},
         camera[{id, preset, at, center, zoom, pitch, bearing, durationSec, ease, cut, citation}],
         cards[{id, kind, title, body, why, facts[], sourceIds[], pin, at, dur, verified}],
         sources[{id, label, url(https), status: verified|unverified, note}],
         script, captions[{start, end, text}], media[{mediaRef, role, at, dur, citation}], voiceover
citation: {type, date, credit, license}
```

`location` is the story pin. `location.look` is an optional camera / street-level target (a land point can be used even when the pin is in open water). If `look` is omitted, the camera uses the pin. Street zoom (about z16–17, pitched) is applied only when that target is on land.

Templates: `episodes/blank.globedesk.json` and `episodes/demo-2026-11-20.globedesk.json`. The app also builds both in memory with the **New blank** and **Demo** buttons. Older `.gobedesk.json` files and the legacy `gobedesk.episode/1` schema still open.

**About the demo:** it uses three Nov 20 '26 stories from the creator's public posts as *placeholder structure only*. Locations are approximate (a strait center, a city center; the Riyadh tower is deliberately not pinned) and labeled "demo, not verified". The only links are the creator's two public X posts, marked unverified. Every other fact, vessel, bridge and building is `[UNKNOWN]`. Credits use the public handle **@TheCriticalDri1** only.

## Event Layers (v0.2)

These are data layers you build to show **where events took place**, right on the globe (the **Events** tab).

- **Draw on the globe:** *Point* (click), *Route* (click points, then Finish or double-click) for convoy paths and flight or missile tracks, *Zone* (polygon) for an affected area or blockade zone, and *Radius* (click a center, set km) for a strike or impact radius. **Snap to a place** with the bundled gazetteer. It moves the selected point there, adds a vertex while drawing, or drops a new point, and labels it "town center, not an event fix".
- **Every feature has:** a title, an event date and time in ISO (plus an optional end for routes), an *approximate* flag, date precision, a category (strike, convoy, blockade, military, missile, protest, disaster, diplomacy, other), a verification label (**verified / not verified / disputed**), source links (https only), a citation (type, date, credit, license), notes, a precision label, and a linked story and topic card.
- **Strict rules:** "verified" needs at least one source link. Bad coordinates, wrong geometry or non-ISO times are refused. Imports skip invalid rows and say so in the console instead of guessing. Rows with no coordinates go to a **Not on the map** list and are never placed.
- **Layers:** create, rename, color, icon, show or hide, reorder (the first layer is on top), delete, color by category, labels on or off, and a scope (all stories, or only the linked story).
- **Event clock:** *Follow playback* sweeps each story's event window (start → end, in ISO) over the story's duration. Features appear when their date is reached, and routes draw from their start time to their end time. *Manual* gives a slider when paused; *Show all* turns it off.
- **Auto-frame:** **Frame** on a layer or a feature flies the camera to fit it. **+ Camera keyframe framing this layer** adds that view as a cut at the playhead.
- **On-globe visuals** (all in the map canvas, so recordings capture them): pulsing markers, routes with a glow and a moving head, glowing zone fills (dashed edge when *disputed*), and radius rings with ripples. Labels show title, time, verification and an EXAMPLE tag where it applies. The shared overlay painter draws them, so the preview and the WebM match. The **Readable view** lists every visible event as text.
- **Import / export:** GeoJSON (with the layer's style kept under `globedesk_layer`), CSV (`title,lat,lon,event_time,event_end,time_approx,category,verification,source_label,source_url,radius_km,notes`) and KML. Layers are saved inside the episode JSON, and each one can also be saved as a standalone `.geojson`. The demo's layers are in `episodes/layers/`.
- **Demo data:** "Demo event places (demo, not verified)" puts one point at each demo story's existing approximate location, linked only to the creator's post. "EXAMPLE PLACEHOLDERS (not real data)" holds one 25 km ring that is marked as an example, with its source `[UNKNOWN]`. No events, coordinates or sources were invented.

## Free vs optional paid

| Free by default (no key) | Optional, off by default (your own key) |
|---|---|
| Satellite + streets hybrid: Sentinel-2 cloudless **2016** by EOX (CC BY 4.0) plus OpenFreeMap vector roads, street and place labels, and 3D buildings | **MapTiler** satellite/hybrid base map (wired) |
| OpenFreeMap street styles (dark, Liberty, Positron) | Cloud **TTS voice** for scripts (stub, adapter TODO) |
| Offline bundled globe: Natural Earth land, countries and towns | **AI summarize / suggest cards** (stub, adapter TODO) |
| Terrain + hillshade (Tilezen/Mapzen terrain tiles on AWS Open Data) | |
| NASA GIBS Blue Marble overlay | |
| Captions, SRT/VTT, cards, sources, spatial insight (all local) | |
| Pre-recorded voiceover; the browser's built-in voice for previews | |
| JSON save/load and WebM recording, all in the browser | |

Keys are typed into **Optional paid** and stored **only in this browser's `localStorage`**. They are never written into episode JSON, the repo or logs. "Forget key" removes one. The repo ships no keys, and `tests/unit.mjs` scans for key-like strings.

## Data, credits and licenses

- **GlobeDesk** is MIT licensed. See [LICENSE](LICENSE). Copyright (c) 2026 AdventureNLearn.
- **MapLibre GL JS** 5.24.1, BSD-3-Clause: `vendor/LICENSE-maplibre.txt`. The vendored files in `vendor/` keep that license.
- **Natural Earth** (public domain): `data/land.js` (1:110m land), `data/world.js` (country outlines) and `data/towns.js` (town gazetteer: towns, admin-1 and capitals with lat/lon and population). Made with Natural Earth.
- **EOX Sentinel-2 cloudless 2016**: "Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016)", CC BY 4.0. The 2018+ EOX layers are **CC BY-NC-SA** and are not used. The public endpoint has **no SLA** and a fair-use policy. During repeated testing some tiles returned fetch errors, so switch to another base if it is slow.
- **OpenFreeMap** © OpenMapTiles, data © OpenStreetMap contributors (ODbL). The public tiles are free, need no key, and are provided as-is (see [OpenFreeMap terms](https://openfreemap.org/tos/)). Attribution is required: OpenFreeMap, OpenMapTiles, and OpenStreetMap contributors. MapLibre shows this on the map; it is also listed in the Layers tab.
- **Terrain**: Tilezen/Mapzen terrain tiles on AWS Open Data (Terrarium). The upstream sources require credit; the canonical list is the [Tilezen joerd attribution notes](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
- **NASA GIBS** Blue Marble imagery.
- **NASA / NASA Johnson** — [Ultra High Definition (4K) View of Planet Earth (2016)](https://www.youtube.com/watch?v=oFDeNcu3mnc), used as an allowlisted example embed in the mission demo. A typographic credit still is shown when the live embed cannot play.
- **Live radio stations** in the mission demo (links only; no song files are in this repository): [Exclusive Radio — Exclusively Creedence Clearwater Revival](https://play.exclusive.radio/), [0 N Radio — Classic Rock](https://www.0nradio.com/), [SomaFM Left Coast 70s](https://somafm.com/seventies/).
- **Recording bed** (share videos only; the MP3 is not in this repository): “Cool Rock” by Kevin MacLeod, [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cool%20Rock.mp3), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Piper** example voices in the frog guide pack. Models are not stored in the tree. Dataset licenses: [UNKNOWN] beyond the piper-voices model card.
- Credits are shown on the map (the attribution control) and in the Layers tab. Demo radio and embed credits also appear on the guide pack and in `demo/CREDITS.md`.

## Roadmap

0. Event Layers next: vertex editing and dragging of drawn shapes, clustering of dense point layers at globe zoom, per-category icons drawn on the map, and a timeline strip of events under the transport.
1. Clip-style pass 2: the hard-cut transition and Ken-Burns stills. Keyframe-accurate offline rendering (frame stepping instead of real-time capture).
2. A **"ground at time of incident"** period view (USGS historical topo, NLS, OpenHistoricalMap). It is declared in Layers as `[UNKNOWN] not wired yet`.
3. Wire the optional TTS and AI adapters behind the existing toggles (bring your own key).
4. Media relinking by file name and hash after opening a saved episode. A bundled project folder (`.globedesk` zip) with media.
5. Higher-detail admin drill-down (state → county → town) from additional Natural Earth / gazetteer packs.
6. MP4 export through optional local ffmpeg.wasm (WebM only today).
7. Mobile layout for the editor (the outputs are already 9:16).

## Stubbed / known gaps

- **TTS and AI adapters** are stubs: the toggles and key storage work, but no provider is called.
- **Browser voice** is for previews only. `speechSynthesis` audio cannot be captured, so it is not in recordings. Drop in a pre-recorded voiceover to record audio.
- **Recording** is real-time capture of the live view. Audio is mixed only when the episode has a voiceover or video shot. Recording with audio was not exercised headless: [UNKNOWN] on every browser. Video-only capture was verified in headless Chrome.
- Media in the bin is session-only `blob:` URLs. A saved episode keeps descriptors, and you re-drop files after reopening.
- At street zoom the 2016 satellite is ~10 m imagery, so roads and 3D buildings carry the detail. Sharper imagery is the optional MapTiler key.
- Flat white country labels need online glyphs; the offline globe shows town names only for the active story.
- The OpenHistoricalMap period view is not wired.
