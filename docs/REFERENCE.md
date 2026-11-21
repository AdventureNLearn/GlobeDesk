# GlobeDesk reference

The full feature reference. For a quick start see the [README](../README.md); for a walkthrough see the [user guide](../USER-GUIDE.md).

## Base map and user content

The globe and its base map (satellite, streets, buildings, optional terrain, bundled offline outlines) are a separate **core layer**. Your stories, media, cards, sound, embeds and event layers live in a **content layer / plugin** on top. User content never changes the base map's code, style, or tiles. Loading or clearing a project leaves the base map state unchanged (this is tested). See [docs/STORY-FORMAT.md](STORY-FORMAT.md) for the data shape.

## Why MapLibre GL JS (globe projection)

- **Free and keyless.** MapLibre GL JS 5.24.1 is BSD-3-Clause licensed and is **vendored in `vendor/`**, so no CDN is needed. The default hybrid base uses OpenFreeMap vector tiles (no key), 3D building extrusions, and optional Terrarium terrain from zoom 11.
- **Real globe-to-street zoom** in one renderer: a globe projection at low zoom, then streets, place labels and pitched 3D buildings at about z16–17.
- **Recordable.** The WebGL canvas turns `preserveDrawingBuffer` on only while Record WebM is running, so `captureStream` and `MediaRecorder` can composite frames; ordinary viewing keeps it off.
- **Display.** Layers has a pixel-ratio cap (default 1.5) and an antialias toggle (off by default). NASA Blue Marble is never shown at the same time as the EOX satellite base.
- **Local Blue Marble pack.** When `./globedesk-data` (or `GLOBEDESK_DATA`) contains the z0–8 MBTiles pack, `tools/serve.py` serves it first at `/tiles/bluemarble/{z}/{x}/{y}.jpeg`, then a disk cache capped at 256 MiB, then NASA GIBS. A complete z0–8 pack is 475,246,592 bytes. Build or resume the pack with `tools/fetch_bluemarble_pack.py`. If `/tiles` is missing, the overlay uses NASA GIBS directly. Natural Earth stays bundled for the offline outline globe.

## What's in the desk

| Panel | What it does |
|---|---|
| **Rundown** | The story list: add, reorder, duplicate, delete. Each story shows its location, duration, cards, shots and verification. |
| **Stage** | The globe preview at 16:9 or 9:16, with safe-zone guides. The overlays you see are painted by **the same painter the recorder uses**, so the preview matches the recording. |
| **Callouts** | Several story cards can be open on the globe at once: the ◎ button on a rundown row, Shift/Ctrl/Cmd-click on a pin, or `?callouts=slug-a,slug-b` in the URL. Each open story gets a ring (about 60 km, clamped between a small minimum and a maximum so it never covers a country), a leader line and a card. Cards scale with zoom within readable limits and are placed so they never overlap each other, any ring, the header, captions, citations, the docked card, the map buttons or the attribution. When a full card has no room it becomes a compact chip; hover or tap a chip to expand it. Rings closer than about 64 px (at 1080p) merge into one count badge and split again as you zoom in. A short delay and hysteresis keep cards from jumping or flickering while you zoom. Callouts near the far side of the globe fade, then hide. Logic: `js/callouts.js`; tests: `tests/callouts.unit.mjs`, `tests/smoke-callouts.mjs`. |
| **Transport** | Play/pause (Space), a scrubber with story segments, orange cut ticks and the outro segment. There's also an optional free browser voice for previewing. |
| **Readable view** | Live text of the current header, source boxes, cards and captions, for viewers who are hard of hearing and for screen readers (`aria-live`). |
| **Story tab** | Title, summary, date, credit, an **as reported, not verified** toggle, duration, place search over the bundled gazetteer (works offline — there is no online address lookup), click the globe or enter coordinates to drop a **story pin**, an optional separate **street-level camera target**, verified flag, focus-region glow (any country, or your own GeoJSON polygon), script, and **spatial insight**: the nearest mapped towns with distance and bearing, computed locally. Street zoom only runs when the target (or the pin, if no target is set) is on land. |
| **Camera tab** | Keyframes: orbit → dive → street → cinematic presets, "set from view", preview, ease, the **cut** flag, a **Go to street level** action, and a **per-shot citation box** (media type, date, credit, license). Citation boxes sit under the header and the headline starts to the right of the badge so the box cannot clip the title. |
| **Cards tab** | Topic, stat, quote, timeline and insight cards: title, body, why it matters, key facts, linked sources, timing, and a verified flag. There's a local "suggest from script" splitter and a "spatial insight card". |
| **Sources tab** | Label, https link, a **verified or unverified** status, and a note. Anything unknown is marked `[UNKNOWN]`. |
| **Captions tab** | Auto cues from the script, SRT/VTT import, and per-cue editing. Export SRT or VTT for the whole episode from the top bar. |
| **Shots tab** | Media from the bin: b-roll or still, timing, and a per-shot citation. Pick the story's voiceover track here. |
| **Look tab** | Theme preset (Frogpost / CTD / Newsdesk), show name, date, handle, header badge, caption size and style, citation boxes, lower third, shot length, colors, and the **editable outro card**. |
| **Layers tab** | Base maps and overlays, each with its credit and terms (see below). |
| **Sound tab** | Your own audio tracks per story: volume, offset into the file, loop, start time. Mixed into playback and the local WebM recording. Pre-recorded voiceover still lives on the Shots tab. |
| **Place tab** | Put uploaded media on the desk as a card, a pin popup, a screen overlay (picture-in-picture or full frame, with position, size and opacity), a geo-anchored panel that moves with the map, or an allowlisted https embed (YouTube / X) with credit required. Each element is clickable, can be shown or hidden, and has timing and order. |
| **Assist tab** | Copy a ready prompt plus the story schema, then paste JSON from any assistant you already have. Strict validation before load. Default voice is the browser's free speech synthesis. |
| **Media bin** | Drag and drop audio, video or images. Files are type- and size-checked and kept in IndexedDB on this device. Drag an item onto the stage, or click **Use**, to add it at the playhead. Audio can be the story's voiceover or a sound overlay. |
| **Save project** | Export a `.globedesk` pack (JSON plus media) you can move to another machine, or a `.globedesk.json` episode without media. The desk also autosaves in this browser. |
| **Optional paid** | Settings for features that cost money, all off by default (see below). |

### Frogpost preset (default)

The `frog` look is first in the Look menu and is what a new file, the **Sample** button, `?sample=1` and a missing save use. Everything in it can be changed in the Look tab.

- **Palette.** Background `#0c1610`, ink `#f3f7ef`, accent `#3dbe6a`, highlight `#d6f25c`, panel `rgba(16,42,28,0.78)`, outro `#07140c`. The page chrome uses the same pond green.
- **Persistent header (top 15%).** A green `FROGPOST` badge and a white headline to the right of the badge, with a second bar for show, date and handle. The handle on the stage is a link.
- **Source citation boxes.** Small panels in the upper left, **under the header**. Each shot (map keyframe cut or media shot) has its own citation. Map shots set to `auto` take the credit of whichever base map is on. A story shows one source box per real source; empty sources are not shown.
- **Captions always on.** Bottom center (the bottom 15%), large bold white, 1–2 lines, drop shadow. No lower third, no ticker, no music.
- **Maps.** Satellite plus streets (`sat-hybrid`), soft borders, focus-country glow, flat white country labels.
- **Pacing.** 8 s shots; each Frogpost story is 16 s with one card. Stories with no single place have no pin and no camera move.
- **9:16 safe zones.** Header 15% at the top, captions 15% at the bottom, 6% side margins.

Other looks: **CTD** (red header, optional) and **Newsdesk** (lower third, boxed captions). Neither is the default.

### Archive

The **Archive** button opens a page with a card for every story that has ever been in the desk:

- the bundled shows: **Frogpost** (48 stories) and the archived **CTD** geopolitics show from 20 Nov 2026 (3 stories, credited and linked to its creator);
- every story you add or load, saved on this device (IndexedDB key `archive`).

The archive only grows. Deleting a story from the rundown, starting a new blank episode, or opening another file never removes a card. **Open** loads a bundled show at that story. **Bring back into this episode** puts the story back into the current rundown exactly as it was saved.

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

Templates: `episodes/blank.globedesk.json` and `episodes/frogpost-2026-11-20.globedesk.json` (the default show). `episodes/demo-2026-11-20.globedesk.json` is the archived CTD show; it is kept and never regenerated. The app also builds these in memory (**New blank**, **Sample**, **Archive**). Older `.gobedesk.json` files and the legacy `gobedesk.episode/1` schema still open.

**About the Frogpost sample:** the 48 rows in `js/frog-rundown.js` come from @AdventureNLearn's posts and the sources linked on each card. Card text is used as written. Each story is unverified and "as reported". Pins are approximate stand-ins (a city, a port, a strait); six stories have no single place and no pin. Where a detail is not in the source, the card says `[UNKNOWN]`. Where a source link is missing, the card says so.

## Event Layers (v0.2)

These are data layers you build to show **where events took place**, right on the globe (the **Events** tab).

- **Draw on the globe:** *Point* (click), *Route* (click points, then Finish or double-click) for convoy paths and flight or missile tracks, *Zone* (polygon) for an affected area or blockade zone, and *Radius* (click a center, set km) for a strike or impact radius. **Snap to a place** with the bundled gazetteer. It moves the selected point there, adds a vertex while drawing, or drops a new point, and labels it "town center, not an event fix".
- **Every feature has:** a title, an event date and time in ISO (plus an optional end for routes), an *approximate* flag, date precision, a category (strike, convoy, blockade, military, missile, protest, disaster, diplomacy, other), a verification label (**verified / not verified / disputed**), source links (https only), a citation (type, date, credit, license), notes, a precision label, and a linked story and topic card.
- **Strict rules:** "verified" needs at least one source link. Bad coordinates, wrong geometry or non-ISO times are refused. Imports skip invalid rows and say so in the console instead of guessing. Rows with no coordinates go to a **Not on the map** list and are never placed.
- **Layers:** create, rename, color, icon, show or hide, reorder (the first layer is on top), delete, color by category, labels on or off, and a scope (all stories, or only the linked story).
- **Event clock:** *Follow playback* sweeps each story's event window (start → end, in ISO) over the story's duration. Features appear when their date is reached, and routes draw from their start time to their end time. *Manual* gives a slider when paused; *Show all* turns it off.
- **Auto-frame:** **Frame** on a layer or a feature flies the camera to fit it. **+ Camera keyframe framing this layer** adds that view as a cut at the playhead.
- **On-globe visuals** (all in the map canvas, so recordings capture them): pulsing markers, routes with a glow and a moving head, glowing zone fills (dashed edge when *disputed*), and radius rings with ripples. Labels show title, time, verification and an EXAMPLE tag where it applies. The shared overlay painter draws them, so the preview and the WebM match. The **Readable view** lists every visible event as text.
- **Import / export:** GeoJSON (with the layer's style kept under `globedesk_layer`), CSV (`title,lat,lon,event_time,event_end,time_approx,category,verification,source_label,source_url,radius_km,notes`) and KML. Layers are saved inside the episode JSON, and each one can also be saved as a standalone `.geojson`. The sample layers are in `episodes/layers/`.
- **Sample data:** "Sample story places (approximate, not verified)" puts one point at each pinned Frogpost story's approximate location, linked to that story's own source. The six stories with no single place are left off the layer. The archived CTD show keeps its own layer plus "EXAMPLE PLACEHOLDERS (not real data)", one 25 km ring marked as an example with its source `[UNKNOWN]`. No events, coordinates or sources were invented.

## Free vs optional paid

| Free by default (no key) | Optional, off by default (your own key) |
|---|---|
| Satellite + streets hybrid: Sentinel-2 cloudless **2016** by EOX (CC BY 4.0) plus OpenFreeMap vector roads, street and place labels, and 3D buildings | **MapTiler** satellite/hybrid base map (wired) |
| OpenFreeMap street styles (dark, Liberty, Positron) | Cloud **TTS voice** for scripts (stub, adapter TODO) |
| Offline bundled globe: Natural Earth land, countries and towns | **AI summarize / suggest cards** (stub, adapter TODO) |
| Terrain + hillshade (Tilezen/Mapzen terrain tiles on AWS Open Data) | |
| NASA Blue Marble overlay (local z0–8 pack, then GIBS) | |
| Captions, SRT/VTT, cards, sources, spatial insight (all local) | |
| Pre-recorded voiceover; the browser's built-in voice for previews | |
| JSON save/load and WebM recording, all in the browser | |

Keys are typed into **Optional paid** and stored **only in this browser's `localStorage`**. They are never written into episode JSON, the repo or logs. "Forget key" removes one. The repo ships no keys, and `tests/unit.mjs` scans for key-like strings.

## Data, credits and licenses

- **GlobeDesk** code is MIT licensed ([LICENSE](../LICENSE)). AdventureNLearn content is CC BY 4.0 ([LICENSE-CONTENT](../LICENSE-CONTENT)). Copyright (c) 2026 AdventureNLearn. Full credits: [CREDITS.md](../CREDITS.md).
- **MapLibre GL JS** 5.24.1, BSD-3-Clause: `vendor/LICENSE-maplibre.txt`. The vendored files in `vendor/` keep that license.
- **Natural Earth** (public domain): `data/land.js` (1:110m land), `data/world.js` (country outlines) and `data/towns.js` (town gazetteer: towns, admin-1 and capitals with lat/lon and population). Made with Natural Earth.
- **EOX Sentinel-2 cloudless 2016**: "Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016)", CC BY 4.0. The 2018+ EOX layers are **CC BY-NC-SA** and are not used. The public endpoint has **no SLA** and a fair-use policy. During repeated testing some tiles returned fetch errors, so switch to another base if it is slow.
- **OpenFreeMap** © OpenMapTiles, data © OpenStreetMap contributors (ODbL). The public tiles are free, need no key, and are provided as-is (see [OpenFreeMap terms](https://openfreemap.org/tos/)). Attribution is required: OpenFreeMap, OpenMapTiles, and OpenStreetMap contributors. MapLibre shows this on the map; it is also listed in the Layers tab.
- **Terrain**: Tilezen/Mapzen terrain tiles on AWS Open Data (Terrarium). The upstream sources require credit; the canonical list is the [Tilezen joerd attribution notes](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
- **NASA Blue Marble** (August 2004, shaded relief and bathymetry): NASA Earth Observatory / MODIS, public domain, via NASA GIBS. Optional local pack under `./globedesk-data` (gitignored; override with `GLOBEDESK_DATA`).
- **NASA / NASA Johnson** — [Ultra High Definition (4K) View of Planet Earth (2016)](https://www.youtube.com/watch?v=oFDeNcu3mnc), used as an allowlisted example embed in the mission demo. A typographic credit still is shown when the live embed cannot play.
- **Live radio stations** in the mission demo (links only; no song files are in this repository): [Exclusive Radio — Exclusively Creedence Clearwater Revival](https://play.exclusive.radio/), [0 N Radio — Classic Rock](https://www.0nradio.com/), [SomaFM Left Coast 70s](https://somafm.com/seventies/).
- **Recording bed** (share videos only; the MP3 is not in this repository): “Cool Rock” by Kevin MacLeod, [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cool%20Rock.mp3), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Piper** example voices in the frog guide pack. Models are not stored in the tree. British (`en_GB-vctk-medium`, p226): CC BY 4.0 data. US (`en_US-hfc_male-medium`): non-commercial only (CC BY-NC-SA 4.0 dataset). See CREDITS.md.
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
