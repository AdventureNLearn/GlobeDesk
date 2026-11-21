# GlobeDesk user guide

GlobeDesk is a local studio. There is no account and no server. Everything you create stays in this browser or in files you save to your computer.

## Getting started

1. Put the app folder somewhere convenient, for example `C:\GlobeDesk`, so that `index.html` is in that folder.
2. Windows: double-click `START-GLOBEDESK.bat`. Any OS: run `python3 tools/serve.py` (or `python3 -m http.server 8080 --bind 127.0.0.1`) and open <http://127.0.0.1:8080>.
3. The first visit opens **Frogpost**, the labelled sample show by @AdventureNLearn (48 stories, approximate locations, as reported, not verified). It is removable. Click **New blank** to start your own show. Later visits restore the project this browser autosaved. Click **Archive** to see a card for every show and story that has ever been in the desk and bring any of them back.

Do not open `index.html` as a `file://` URL. The browser will block parts of the app.

## Make your own story

- In the rundown, click **+ story**. You can also duplicate, reorder, or delete a story.
- On the **Story** tab, set the title, summary, date, and a credit if the material is someone else's. Leave **As reported, not independently verified** on unless you have checked the claim yourself.
- Drop a pin by **clicking the globe**, entering latitude and longitude, or searching the bundled town gazetteer (offline). There is no online address lookup.
- The story pin and the street-level camera target can be different places. Street zoom only runs when that target is on land.
- Add topic cards, https sources (verified or unverified), captions, and camera keyframes. Unknown facts stay `[UNKNOWN]`.

## Add sound

- Drop audio into the media bin (type and size are checked; files stay on this device).
- **Shots** tab: pick a voiceover for the story (plays from the start).
- **Sound** tab: add extra tracks with volume (0–1), an offset into the file, loop, and a start time. These mix into playback and into the local WebM recording.
- The free browser voice is a preview of the script only. It is not captured in recordings.
- Optional paid cloud voices are off by default. Their request shape is [UNKNOWN] and not wired.

## Place media on the globe

On the **Place** tab, any uploaded video, image or audio can be:

- a story **card**
- a **pin popup**
- a **screen overlay** (picture-in-picture or full frame, with position, size and opacity)
- a **geo-anchored panel** that sits at a map location and moves with the map
- an **embed** of an allowlisted https YouTube or X link (credit required)

Each element is clickable, can be shown or hidden, and has timing and order. The base map is not modified. See [docs/STORY-FORMAT.md](docs/STORY-FORMAT.md).

## Event layers

The **Events** tab still lets you draw or import points, routes and areas (GeoJSON, CSV with lat/lon, KML). Colour, name, show/hide, and export are included.

## Use your assistant

The **Assist** tab copies a ready prompt plus a schema summary. Paste the JSON your assistant returns and choose **Validate and load**. Invalid JSON is rejected. Nothing is sent to a network model from this panel.

You can also import from a same-origin `postMessage` (`{ type: "globedesk.import", json: "..." }`) or `?import=/episodes/your-file.json`. GlobeDesk will not fetch an arbitrary remote URL.

The default spoken voice is the browser's free speech synthesis.

## Save, load and record

- The desk **autosaves** in this browser (IndexedDB).
- **Save JSON** writes a `.globedesk.json` episode (no media bytes).
- **Save project** writes a `.globedesk` pack (JSON plus media) you can copy to another machine. Open accepts both, and still accepts older `.gobedesk.json`.
- **Record WebM** captures the stage locally at 16:9 or 9:16, including mixed sound overlays. Nothing is uploaded.
- You are responsible for the rights to anything you upload or share.

## Captions and accessibility

Captions can be auto-built from the script, imported as SRT or WebVTT, and optionally burned into the recording (they are on by default in the Frogpost look). The Readable view shows full titles, citations, cards and captions as text. Truncated titles and citations on the stage show their full text on hover or click. Controls are keyboard reachable and labelled.

## Grok.me

If you want a copy built in Grok.me, you load [GROK-ME-BUILD.md](GROK-ME-BUILD.md) and `grokme/` yourself. This repository does not publish or sign in anywhere.

## Optional paid features

MapTiler imagery, cloud voices and cloud AI are off until you turn them on and paste your own key. Keys stay in this browser only.
