# GlobeDesk user guide

GlobeDesk is a local studio. There is no account and no server. Everything you create stays in this browser or in files you save to your computer.

## Getting started

1. Put the app folder somewhere convenient, for example `C:\GlobeDesk`, so that `index.html` is in that folder.
2. Windows: double-click `START-GLOBEDESK.bat`. Any OS: run `python3 tools/serve.py` (or `python3 -m http.server 8080 --bind 127.0.0.1`) and open <http://127.0.0.1:8080>.
3. The first visit opens the **news desk**, with no episode preloaded. Use the section tabs to browse example topics, or click **Workspace** for the full editor. **Sample** loads the short Washington, DC walk (approximate pins). **New blank** starts your own show. Later visits restore the project this browser autosaved. Click **Archive** to see a card for every show and story that has ever been in the desk and bring any of them back.

Do not open `index.html` as a `file://` URL. The browser will block parts of the app.

## Make your own story

- In the rundown, click **+ story**. You can also duplicate, reorder, or delete a story.
- On the **Story** tab, set the title, summary, date, and a credit if the material is someone else's. Leave **As reported, not independently verified** on unless you have checked the claim yourself.
- Drop a pin by **right-clicking the globe** (or a **long press** of about half a second on a touch screen), entering latitude and longitude, or searching the bundled town gazetteer (offline). A plain click or tap selects a pin, card, or feature already on the map; it does not drop a pin. Panning, zooming, or tapping empty map keeps the current selection. Escape or an explicit close clears it. There is no online address lookup.
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

## Layers

Click **Layers** in the top bar (or press **L**) to see every map layer in one place. Each row has an on/off switch, a one-line description and a small legend. **Show all** turns on every overlay that can sit on the current base map; **Hide all** turns them all off. Pick the base map at the top of the panel. Dated imagery and official GIS layers are further down and stay off until you opt in. **Reset** (H) flies back to the starting globe without changing your layers.

## Atlas, desks and your layer (v1.4.0-draft, not released)

- **Atlas.** Press **Atlas** in the top bar. Browse **A–Z** (letter jump and search), **Categories** (12, with pack status; categories without a pack yet are greyed), **By place** (counts on the globe by country; places are coarse) or **By year**. On the year slider, the current year zooms to **Months** and **Weeks**, and **This week** jumps to the current ISO week. Pick a reading level (Kids, Everyday, Student, Professional); entries not written at that level say so with `[UNKNOWN]`.
- **Entry tabs.** **Object** (summary, sizes, key facts, safety rules in the record), **Parts** (quantities and bundled, dated price checks by region; unknown prices stay `[UNKNOWN]`), **Chemistry**, and **Sources**, grouped as Official sources, Other cited references, Experimental references (the maintainer's own repos and cards, never official) and Community links.
- **Globe | 3D.** Globe flies to an entry's place. 3D draws the bag solar kit's parametric layout with the bundled three.js; it is an artistic layout, not a build drawing. All Atlas entries are drafts; the kit is not built or tested. Online price and solar lookups are off.
- **Desks.** The **Desk** menu above the news desk switches between News (unchanged) and nine work desks. Each desk shows its scope, reading levels, official sources (or `Official source [UNKNOWN]`), and experimental references labelled *Experimental (not an official source)*.
- **Your layer.** Layers, **Your layer**: pin the map centre, follow Atlas entries, add notes, and **Export** or **Import** them as a JSON file. Import refuses a file over 2 MB. It stays in this browser on this device.
- **Community.** Layers, **Community** (off by default) shows contributor cards per Atlas category, community links and community pins with their own badge. See CONTRIBUTING.md, Contributor cards.

## Export MP4 and share packs

Click **Export** in the top bar.

- **MP4:** choose 16:9 or 9:16 and a length, then **Export MP4**. The app renders every frame in order, so the file is smooth even on a slow machine; it can take longer than real time. Sound is AAC when the browser supports it. If it cannot, and you have installed FFmpeg yourself, GlobeDesk converts on this computer; otherwise you get a WebM. Nothing is uploaded. FFmpeg is optional and not part of GlobeDesk; your copy keeps its own GPL/LGPL licence.
- **Share pack:** give a label (PUBLIC, RECORDED or PROJECTED) and a licence for your own text, choose the map (outline globe, or a Blue Marble or EOX region pack you have already downloaded), then **Check**. Read the report, tick the confirm box, and **Build** to download one `.globedesk.html`. Anyone can open it by double-clicking; it plays read-only with no server and no internet. Stories without a real source, with a non-commercial licence, or with a name or private-data hit are refused. Media files are not included yet.

## Save, load and record

- The desk **autosaves** in this browser (IndexedDB).
- **Save JSON** writes a `.globedesk.json` episode (no media bytes).
- **Save project** writes a `.globedesk` pack (JSON plus media) you can copy to another machine. Open accepts both, and still accepts older `.gobedesk.json`.
- **Record WebM** (●) captures the stage locally in real time at 16:9 or 9:16, including mixed sound overlays. Nothing is uploaded.
- You are responsible for the rights to anything you upload or share.

## Captions and accessibility

Captions can be auto-built from the script, imported as SRT or WebVTT, and optionally burned into the recording (they are on by default in the GlobeDesk look). The Readable view shows full titles, citations, cards and captions as text. Truncated titles and citations on the stage show their full text on hover or click. Controls are keyboard reachable and labelled.

## Grok.me

If you want a copy built in Grok.me, you load [GROK-ME-BUILD.md](GROK-ME-BUILD.md) and `grokme/` yourself. This repository does not publish or sign in anywhere.

## Optional paid features

MapTiler imagery, cloud voices and cloud AI are off until you turn them on and paste your own key. Keys stay in this browser only.
