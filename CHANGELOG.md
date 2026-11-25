# Changelog

## v1.4.0 — Atlas — 2026-11-25

- Version shown as "v1.4.0 · Atlas".
- **Atlas.** New **Atlas** view beside News desk and Workspace: A–Z, Categories, By place and By year browsing (years, then months and ISO weeks in the current year, plus **This week**), a reading-level switch, a **Globe | 3D** switch, and Object, Parts, Chemistry and Sources tabs. Data: 12-category tree, entry schema (`schema/atlas-entry.schema.json`), pack manifest schema (`schema/atlas-pack-manifest.schema.json`), a core pack and four starter packs (Energy, 3D objects, Chemistry, Economics and prices; 10 draft or placeholder entries), the bag solar kit record, LFP vs NMC chemistry record and US, GB, IT and IN price checks. `tools/atlas/` builds the packs and the generated `js/atlas/atlas-data.js` and validates everything (no entries about living people, Now timing, sources, sizes under 50 MB, hashes). Online price and solar lookups stay off.
- **3D.** three.js r158 (MIT, unmodified) is vendored and lazy-loaded only when 3D is chosen; it draws the kit's parametric layout. If WebGL or the file is missing, the view is a labelled stub.
- **Work desks.** A **Desk** menu above the news desk adds nine work desks next to the unchanged News desk: Permits and Codes; Jobsite and Constructability; Trades and Skills; Engineering and 3D Objects; Energy and Materials; Infrastructure, Trade and Routes; Regulatory and Public Records; Surveillance and Civil Liberties; Security and Counterterrorism (`desks/work-desks.json`).
- **Source classes (owner rule).** Official sources are primary or public records only. The maintainer's own repos and Learning Lab cards are listed as *Experimental (not an official source)* in a separate group and never count as a record backing a claim; the validator refuses an owner repo tagged official. Eight desks show `Official source [UNKNOWN]` and are listed as open.
- **Your layer and Community (v1).** A personal layer (pins, notes, followed topics, links) stays in the browser with Import and Export. Import refuses a file over 2 MB, checked on the file size and on the text length (and UTF-8 byte size) before the JSON is parsed. Contributor cards (handle, 1–2 line description, topics, up to 3 public links, checked date; no contact or location fields) with a schema and validator. A **Community** switch in Layers, off by default, with its own pin style and badge; contributor lists per Atlas category; community links kept apart from sources. `tools/promote_layer.py --card` strips contact fields. No profiles, ratings, accounts or server.
- Open items: the 12 owner questions stay OPEN, plus 9 new ones, in [atlas/OPEN-ITEMS.md](atlas/OPEN-ITEMS.md).
- **Palette credit.** The default look is labelled Lily pad palette (owner original). Docs, credits, comments and earlier changelog lines no longer name another owner project. Colors are unchanged.

## v1.3.1 — Share & Export (patch) — 2026-11-22

- Version shown as "v1.3.1 · Share & Export".
- **Layers Show all / Hide all apply in one go.** A batch of overlay changes is coalesced into one map update as soon as the style is parsed, even if tiles are still loading (`isStyleLoaded()` can stay false while Event Layers animate, and idle may never fire). If the apply throws, it is retried on a short timer bound to the current map, and that wait is cleared when the map is recreated (MP4 export start and end, or a render-option change). Previously the rest of the batch was skipped until the next click: on the offline globe, Show all turned Blue Marble on in the panel but did not draw it, and Hide all then drew Blue Marble, the focus glow and the pin while the summary said everything was off; on the satellite base, hillshade and the same story overlays lagged one step behind. Single switches were already fine.
- Grok.me builder notes are in [GROK-ME-BUILD.md](GROK-ME-BUILD.md): the entry page stays `index.html`, `desk.html` is only the host shell, the version-check URL stays null, `/api/packs` and `/api/command/next` stay localhost-only, and the git repo is the kit (not the wrapper). Stale v1.2.0 and "48 stories" checklist lines are updated.
- The public live copy at [globedesk.grok.me](https://globedesk.grok.me) showed v1.3.1 · Share & Export in the top bar on Nov 22, 2026 (checked that afternoon, ET). 104 of the 105 files in `grokme/manifest.json` on main (a54baa1, tree 46b08f4c) matched by SHA-256. The one that did not is `index.html`: the kit `index.html` is served as `/desk.html` (same hash), and `/index.html` returned 404. The host shell at `/` iframes `/desk.html`. How Grok.me maps those paths is [UNKNOWN].


## v1.3.0 — Share & Export — 2026-11-22

- Version shown as "v1.3.0 · Share & Export".
- **Layers button and panel.** One **Layers** button in the main toolbar (shortcut L) opens a glass panel that lists every base map, overlay, dated imagery and official-GIS layer with an on/off switch, a short plain description and a legend swatch. **Show all** and **Hide all** are at the top. Show all keeps the chosen base map, so Blue Marble stays off on the satellite base and the 2016 EOX region pack and OpenHistoricalMap stay off (they replace or need extra setup); official GIS rows only switch on if live GIS is already enabled. A one-time hint points to the button on first load. On a phone the panel opens as a bottom sheet.
- **Frame-accurate MP4 export** (toolbar **Export**, or Menu → Export MP4 / share pack). Playback is rendered frame by frame at exactly n / 30 s in 16:9 (1920×1080) or 9:16 (1080×1920), encoded with the browser's WebCodecs H.264 (and AAC when the browser has it) and muxed with the vendored Mediabunny 1.66.2 (MPL-2.0, unmodified). If the browser cannot make H.264 + AAC and you have installed FFmpeg yourself (optional, not shipped; its own GPL/LGPL licence applies), the app encodes WebM and the local `serve.py` turns it into MP4 with one fixed command line, loopback only. WebM is the last resort. No ffmpeg.wasm. Voice-over and sound overlays are mixed in; video b-roll audio is not.
- **Offline share pack.** Export → Share pack builds one self-contained `.globedesk.html` that opens from disk with no server: read-only Play, Pause and Scrub, captions, sources and a Credits panel. Only stories that pass the promote checks go in (real https source, licence, PUBLIC / RECORDED / PROJECTED label, personal fields and desk links stripped, scrub_scan and name_scan clean), and only after you tick the confirm box for the exact pack you checked. The map is the bundled Natural Earth outline; optional add-ons come only from packs already on this device: a low-zoom (z0–4) Blue Marble cut or the 2016 EOX Sentinel-2 cloudless region pack (CC BY 4.0, attributed). Caps 20 MiB, or 80 MiB with tiles. Never OpenFreeMap tiles, non-commercial mosaics, keys or live embeds. Source and credit links in a pack are https only; other schemes are dropped. CLI: `tools/export_share_pack.py` (dry run unless `--yes`, never overwrites, never commits). Local media, the content layer and event layers are not packed in v1.3.
- **Title.** The title band no longer shows "GLOBEDESK [UNKNOWN]" on first load; an untitled desk shows "Welcome to GlobeDesk".
- **Civic Intelligence Project, open source.** New CONTRIBUTING.md (what's welcome, source and citation rules, no personal data or secrets, PR format, checks, review), FORKING.md (run a fork, licence obligations, rebranding, sending changes upstream), CODE_OF_CONDUCT.md (Contributor Covenant 2.1, GitHub-only contact), a pull-request template and bug / layer-data / feature issue templates, and a README section. Menu → Help → **About · Contribute · Fork it** opens those pages on GitHub in a new tab; the Content-Security-Policy is unchanged.
- The **Sample** button and `?sample=1` retry loading the bundled Washington, DC sample, which could load as a one-story stub when the first fetch was aborted during start-up.
- A Reset button in the main toolbar (keyboard shortcut H) clears the selection and any highlighted item, closes the info and Inspector panels, stops playback, and flies the globe back to the default starting view. Layers, desks, and catalog data stay as they are. Escape is unchanged, because it already closes dialogs, the research drawer, and the full-text panel.
- Catalog tests no longer remove `globedesk-data/` folders when cleaning leftover bait.

## v1.2.0 — Live Data — 2026-11-22

- Version shown as "v1.2.0 · Live Data".
- A data-year slider, separate from episode playback, drives dated imagery and official GIS vintages. Follow-story-date is optional and does not move the playback scrubber. Recorded and projected years are labelled in the UI, the Readable view, and recordings. Projected views are an estimate of bracketing recorded imagery; legal Census boundaries, addresses, and counts are never projected.
- Dated NASA GIBS imagery (Landsat WELD annual true colour for the listed 1983–2000 years, and daily true colour thereafter) is opt-in and off by default. Requests never use a future date. Blue Marble stays undated.
- Yearly EOX mosaics for 2018–2025 stay behind a non-commercial CC BY-NC-SA acknowledgement, off by default. The default satellite base remains the 2016 CC BY 4.0 mosaic. The 2017 mosaic is not offered.
- Official USGS Topo / Imagery / NHD, Census TIGERweb, and NOAA nowCOAST overlays can be turned on after the existing live-GIS opt-in (still off by default). TIGER vintages follow the data year (no ACS2020). Current-only layers hide on a historical year. OpenHistoricalMap stays unwired.
- Opt-in address search uses Photon (OpenStreetMap / ODbL). The US Census geocoder is available only through the local `serve.py` proxy, using official benchmark 4. Nominatim is not used. Queries are not written to the episode or to command logs.
- The Content-Security-Policy adds only the approved hosts: `basemap.nationalmap.gov`, `hydro.nationalmap.gov`, `tigerweb.geo.census.gov`, `nowcoast.noaa.gov` (img-src and connect-src), and `photon.komoot.io` (connect-src). No Nominatim host, no `geocoding.geo.census.gov`, no ArcGIS Online, no EOX 2017.
- Review fixes after the v1.2.0 pass: the Census proxy refuses non-loopback Host/Origin and cross-site requests and caps addresses; raster and dated-imagery hosts that go down are switched off and stop requesting; on-screen credits follow the imagery actually shown, and recordings carry the base-imagery credit only (not GIS overlay credits); NHD and other official rasters have a min zoom; Photon keeps one in-flight request, needs at least three characters, and is not used just because the Census opt-in is on.
- Layout review fixes folded in: unknown-id warnings stay visible with the load reason; the scrub allowlist checks every phone number and requires a 555 exchange; map zoom controls sit below the in-stage title band; layout-shots no longer default to the sibling shots folder; town labels hide below zoom 6 and skip collisions with the pin.
- The Playback bar keeps a visible Playback label and cannot cover the Readable view or the Inspector. A floating bar is snapped back to a dock; it can sit at the bottom of the stage column or in a side column. The layout-shots overlap check covers every panel, toast, bar, and open popover.
- The public tree ships only generic SAMPLE sidecars (fictional Open in… desks on example.org, and clearly labelled SAMPLE claims, research, and records). Personal desks, stories, claims, research, records, layouts, and settings load from the local GLOBEDESK_DATA catalog when present, stay untracked, and are listed in CATALOG.md. The File menu can export or import this browser's globedesk.* / gobedesk.* layout and settings into that folder.
- A local-only Promote to public tool (`tools/promote_layer.py`, `docs/PROMOTE.md`) writes one catalog item into `episodes/layers/` after stripping personal fields and desk links, requiring a source, a license, and a PUBLIC / RECORDED / PROJECTED label, and after scrub_scan and name_scan pass. It never auto-commits. Owner YES is required for each promote.
- The grok.me pack manifest (`grokme/manifest.json`) is regenerated so file hashes match this tree, including the Playback-bar files that had gone stale.


## v1.1.0 — Native Tools — 2026-11-22

- Version shown as "v1.1.0 · Native Tools".
- Native tools on this branch: author claim scores, the research drawer, cited record-to-layer lists, allowlisted Open in… buttons, and an official-GIS connector that stays off until the user opts in. Live GIS still adds no host to the Content-Security-Policy.
- Official-GIS polish: map-move refresh is debounced; a down layer is left off and is not re-fetched until the user turns it back on in the Layers tab. The command API refuses to re-enable a down or unknown official layer, without changing its URL. Story `gisOverlayIds` are checked against the bundled registry list even before the registry file has loaded; an unknown id is a warning, not a load-blocking error, is shown in the app, and still shows `[UNKNOWN]` at runtime.
- Shell layout: the Inspector and other panels dock or float, resize, scale, and lock; four templates (Edit, Record/Present, Research, Compact/laptop) persist per device; a searchable hamburger menu sits beside the GlobeDesk title so the top bar stays on one row and no longer covers the stage or map controls.
- Stage polish: map pan controls show icons in a compact pad beside the zoom control; attribution is a collapsible MapLibre control in the bottom-right of the stage; the globe stays centred in the 16:9 frame after the docks change size; panel scale lives in a compact header control; playback and rundown labels wrap cleanly at laptop width.
- GIS unit fixtures are marked synthetic in the fixture files themselves.
- Small Lily pad palette (owner original) consistency on the new claims, research, records, Official GIS, and Open in… panels (tokens, radius, glass, and link hover).


## Unreleased — basic GlobeDesk (local branch)

- Combined look (owner pick): GlobeDesk news-desk card layout with Lily pad palette (owner original) colors, holographic globe atmosphere, and a timeline-strip treatment on the transport bar. Replaces the X-profile palette.

- Plain GlobeDesk shell uses the Lily pad palette (owner original) look (navy #02040c, ice text, gold, cyan) and a holographic globe atmosphere. No prior show branding in the product.
- Consumer news desk with section tabs and story cards, plus a toggle into the full editor. Boots with no episode preloaded.
- Example feed: 50 sourced topics in 10 sections. Cards keep `[UNKNOWN]` marks and approximate-pin notes as authored.
- Bundled sample is the short Washington, DC National Mall walk. A click still only selects; a pin drops only on right-click or a 500 ms long press.

- Screenshots in `shots/` were recaptured from the current news-desk and Washington, DC sample UI.
- `tools/sync_newsdesk_feed.py` takes `--src` or a sibling topic folder; it no longer hard-codes a machine path.
- Docs and `LICENSE-CONTENT` now describe the current `globedesk` look and typographic stills.
- Demo stills in `demo/assets/` and `demo/poster/` are typographic placeholders.
- News-desk topics: official dates from the 21 Nov 2026 ET research pass were folded in, each with a source URL. Month-only days, and the Great Barrier Reef inscription day and Joint Security Area start day, stay `[UNKNOWN]`. Official pages disagree on the 1900 Chicago River reversal day (2 January vs 17 January); the card does not pick one. The Bletchley Park topic refers to the invasion of Poland on 1 September 1939.



## Unreleased — P3 command API and story-driven mode (2026-11-21)

- **Localhost command API.** `window.GD.commands` (alias `window.globe`) and `POST /api/command` on `tools/serve.py` accept only an allowlisted set: `flyTo`, `jumpTo`, `zoom`, `tilt`, `rotate`, `camera`, `search`, `setBase`, `setOverlay`, `toggleLayer`, `dropPin`, `setLocation`, `openCard`, `closeCard`, `closeAllCards`, `highlight`, `loadEpisode`, `setStory`, `play`, `pause`, `resume`, `seek`, `status`. Host must be this loopback port. If Origin is present it must be the app; a local agent with no Origin is allowed because the server binds 127.0.0.1 only. Every argument is validated; unknown commands and out-of-range values are rejected and ignored. Each command is logged to `./globedesk-data/command-log.jsonl` (no headers). `GET /api/tools` lists the tools. The desk page pumps `GET /api/command/next`. The PowerShell fallback still does not provide this API — Python is required. `preserveDrawingBuffer` stays on only during export.
- **Story-driven mode and the resume rule.** Playback still uses `globedesk.episode/2`. The clock applies story state from `(episode, t)` (camera keyframes, timed cards). **Pause and explore:** viewers can open several cards, toggle layers, and drop pins. **On Resume** (and on `seek`), every viewer edit is cleared and the view returns to the story state at the paused beat, then the original story order continues.
- **Washington, DC sample episode** at `episodes/washington-dc-demo.globedesk.json` (two short National Mall stories, open official sources, approximate pins, facts cited or marked [UNKNOWN]). Load with `?import=/episodes/washington-dc-demo.globedesk.json`. It is written for the optional DC region pack from P2. `loadEpisode` (and `?import=`) applies `look.map.base`.
- **Quiet tile misses.** The tile server listen backlog is 256 so a MapLibre burst does not surface as `net::ERR_CONNECTION_REFUSED`. A pack or cache miss returns a 200 transparent PNG instead of 404. The DC region overlay (`eox-region`) sets MapLibre `bounds` to the pack bbox so the globe does not request tiles outside that region.
- **Pin drop and selection.** A plain click or tap on the globe only selects or opens an existing pin, card, or feature; it never drops a pin and it does not clear the current selection. Panning, zooming, and empty taps also keep the selection. A single click dispatcher owns the gesture, so picking an event cannot also move the story pin. A double-click zoom does not run the click action. A pin is dropped only by a right-click (`contextmenu`) on desktop or a long press (500 ms, cancelled if the finger moves or the map is dragged) on touch. Escape closes the full-text panel if it is open, otherwise it stops camera motion and clears the selection; selecting something else replaces it.
- **Pause-explore selection.** Clicking a pin, card, or rundown row while paused selects (and can open the card) without seeking the story clock or restoring the play baseline. Resume still clears viewer edits and continues the story.
- **Camera vs gesture.** Story and API `flyTo` / `jumpTo` commands issued while a pointer is down are queued until release, and a `pointerdown` stops the current flight. Flights use `essential: false` and honour `prefers-reduced-motion` (event pulses also pause). The phone layout (`max-width: 760px`) turns on MapLibre cooperative gestures. Overlay hit targets are at least 24 px. Pan buttons sit next to the zoom control, plus a recenter-on-pin action.
- **Desk targeting.** Each open desk registers while it pumps `GET /api/command/next?desk=&focused=`. `POST /api/command` may include a top-level `desk` id. With one desk, or one uniquely focused desk, the command is delivered there. If two or more desks are connected and none is clearly focused, the request is rejected (409) with the desk list rather than landing in a hidden window. `GET /api/desks` lists connected desks. `openCard` on a card or callout that is already open returns `{ok:true, alreadyOpen:true}`.

## Unreleased — P2 disk cache and DC demo region (2026-11-21)

- **Production-grade tile-proxy disk cache.** Default cap is **32 GiB** (34,359,738,368 bytes), configurable with `GLOBEDESK_CACHE_MAX_BYTES`. An SQLite LRU index (`cache/lru.sqlite`) is updated on each write and read, so a write does not rescan the cache folder. `0` turns the cache off (no reads or writes; existing files are left in place). `unlimited`, `none`, or an integer of 1 TiB (1,099,511,627,776) or larger means no cap. Layers shows the size and a Clear cache control.
- **Origin/Host check on `/tiles`.** Only requests from this app on the same loopback port (Origin or Referer plus Host) can stream from GIBS or EOX and write the cache. Other local pages can still read a pack or an already-cached tile, but a miss returns a 200 transparent PNG (`X-GlobeDesk-Tile-Source: empty`) and is not written to the cache. The PowerShell fallback and `python -m http.server` still do not provide `/tiles`.
- **`/api/packs` probe timeout.** The page waits at most 2 seconds for `/api/packs` before falling back to direct GIBS/EOX URLs, so a hung local server cannot block the globe.
- **Washington, DC demo-region pack** (optional, not shipped in git). EOX Sentinel-2 cloudless **2016** (`s2cloudless_3857`), CC BY 4.0, contains modified Copernicus Sentinel data 2016. Built with `tools/fetch_region_pack.py` for the approximate downtown / National Mall bbox around the GlobeDesk Washington, DC pin (38.89, −77.01): west −77.12, south 38.83, east −76.94, north 38.97, z0–14, **131 tiles, 1,904,640 bytes**. Stored at `./globedesk-data/regions/washington-dc/eox2016-s2cloudless-2016.mbtiles`. Coverage outside that bbox is **[UNKNOWN]** / empty. An OpenFreeMap or terrain extract for the same bbox was not built (OpenFreeMap-as-PMTiles method is **[UNKNOWN]**). The **Washington, DC demo region** overlay uses the pack under `tools/serve.py`, then the disk cache, then EOX; it switches to the offline globe so it is not stacked with the hybrid base or Blue Marble.


## Unreleased — P1 local Blue Marble pack (2026-11-21)

- **Local NASA Blue Marble pack (z0–8), not shipped in the repo.** A single MBTiles file of the public-domain *Blue Marble (August 2004, Shaded Relief and Bathymetry)* layer is downloaded on request from public NASA GIBS by `tools/fetch_bluemarble_pack.py` and stored under `./globedesk-data/bluemarble/` in the clone (gitignored; override the parent folder with `GLOBEDESK_DATA`). A complete z0–8 pack measures 475,246,592 bytes. The Python server (`tools/serve.py`, used by `START-GLOBEDESK` when Python is available) serves tiles at `/tiles/bluemarble/{z}/{x}/{y}.jpeg` with fallback **local pack → disk cache (capped at 256 MiB, overridable with `GLOBEDESK_CACHE_MAX_BYTES`) → GIBS stream**. Set `GLOBEDESK_BLOCK_GIBS=1` or `GLOBEDESK_OFFLINE=1` to refuse the stream. Fetch or resume the pack with `tools/fetch_bluemarble_pack.py`. If the `/tiles` route is missing (PowerShell fallback, `python -m http.server`, or `npm start`), the overlay uses NASA GIBS directly.
- Credit: NASA Earth Observatory / MODIS, public domain, via NASA GIBS.
- `setOverlay` waits for the current map style to finish loading before adding layers, so turning on Blue Marble right after switching to the offline globe still attaches the layer.

## Unreleased — P0 performance (2026-11-21)

- **Drawing buffer only during export.** `preserveDrawingBuffer` is off in ordinary viewing and is turned on only while the built-in Record WebM export runs (the map is recreated to toggle it). After the recording finishes, or if map recreation for export throws, it is turned off again.
- **Pixel-ratio cap** (default 1.5) and an **antialias** option (off by default) live under Layers → Display. Changing either recreates the globe.
- **Blue Marble (GIBS) is never stacked with the EOX satellite base.** Turning Blue Marble on switches to the offline globe; choosing the EOX hybrid base turns Blue Marble off.
- **Vendored MapLibre 5.24.1 patch:** globe projection error measurement allocates a fresh four-byte pixel-pack buffer per readback and deletes it afterwards, so Chrome/Edge no longer flood the console with READ-usage buffer warnings. See `vendor/MAPLIBRE-PATCHES.md`.


## v1.0.1 — Official Release — 2026-11-21

- **Cold-open audio stripped.** The 8-second GlobeDesk cold-open clip (`demo/guide-packs/template/assets/v1-cold-open.mp4`) no longer has an audio stream. The quiet ambient track that came with the AI-generated video had a license of [UNKNOWN]; it was removed with `ffmpeg -an`, copying the video stream (no re-encode). Credits and `LICENSE-CONTENT` are updated. Remuxing the container dropped the C2PA content credentials that were in the original file.
- Version shown as "v1.0.1 · Official Release".

## v1.0.0 — Official Release — 2026-11-20

- **Licenses.** Code is MIT (`LICENSE`). Content made for GlobeDesk (episode text, our frog art, our voice clips, screenshots, docs) is CC BY 4.0, credited to "AdventureNLearn" (`LICENSE-CONTENT`). Third-party items keep their own terms.
- **Voices and sounds with clear licenses.** The British demo voice is now Piper `en_GB-vctk-medium` (speaker p226), trained on CC BY 4.0 data (CSTR VCTK Corpus, Hi-Fi TTS); its 50 clips were re-rendered with the same clarity chain (`demo/tools/make-vo-gb.py`) and are CC BY 4.0. The old `en_GB-alan-medium` clips are removed. All sound effects are re-synthesized from scratch by `demo/tools/make-sfx.py` (CC BY 4.0). The US voice (`en_US-hfc_male-medium`) is labeled non-commercial only (CC BY-NC-SA 4.0 dataset, fine-tuned from lessac under the Blizzard 2013 license) and its clips are excluded from the CC BY 4.0 grant.
- **GlobeDesk content, sourced or dropped.** Cards that could not be backed were removed (48 stories now). The Southern California card is reworded to the backed fact: a BOEM Call for Information and Nominations (Federal Register, 27 Jan 2026), "not a final decision to lease", with a first sale tentatively in 2027 and a regional pin. The Iowa plant card cites the Acting Secretary of the Army on X. The robocall card is labeled an unofficial public claim that was not checked. The two cards that spoke to "you" are rewritten for viewers.
- **Florida pins.** All Florida stories share one state-level approximate pin, and town names are not used in their titles or text.
- **Multi-card callouts on the globe.** Open several story cards at once (the ◎ button in the rundown, Shift/Ctrl-click on a pin, or `?callouts=slug,slug`). Rings and strokes scale with zoom inside fixed limits, so a ring never covers a country when zoomed out. Cards and fonts scale within readable limits, never overlap each other, a ring, the header, captions or the map buttons, and collapse to compact chips (hover or tap to expand) when space runs out. Each leader line is re-routed every frame to its own ring, through zoom, rotation and pitch, and fades with its ring near the far side of the globe. Nearby rings merge into one count badge when zoomed out and split as you zoom in. Placement uses hysteresis and a short upgrade delay, so continuous zoom does not flicker. The callouts are painted by the same painter as the recorder, so they appear in recordings too.
- **Starter kit.** `starter/` has a blank episode template, a layer template, a guide-pack template and `MAKE-YOUR-OWN.md`. `tools/make_starter_zip.py` builds `globedesk-starter-v1.0.0.zip` and scans it; `tools/scrub_scan.py` checks the tree for private paths, emails and keys.
- **Docs.** New README, `CONTRIBUTING.md`, `SECURITY.md`, `CREDITS.md`, and `docs/REFERENCE.md` (the long reference that used to be in the README).
- **Fixes.** The smoke test finds the Kyiv story by slug, and adds a phone-size shot. Demo tools use the system temp folder (or `GLOBEDESK_TMP`) instead of fixed `/tmp` paths. Grok.me prompts use neutral wording; `starter/` is left out of the Grok.me manifest.
- Version shown as "v1.0.0 · Official Release".

## v0.5.1 — AdventureNLearn Edition — 2026-11-20

- **GlobeDesk is the default show.** A fresh open (or an empty save) loads GlobeDesk by @AdventureNLearn: the `frog` pond-green look, the `GLOBEDESK` header badge, and 50 stories in five fixed groups (Build it, Globe encyclopedia, Water and works, Receipts, GlobeDesk) from `js/model.js`. Card text is used as written; `[UNKNOWN]` is kept; the six stories with no single place have no pin and are left off the event layer. Title and brand: "GlobeDesk — GlobeDesk", 🐸 GlobeDesk, link to @AdventureNLearn.
- **Archive.** New Archive page: every show and story ever added keeps a card and can be opened again. Bundled shows are rebuilt from code; your own stories are saved to an append-only local index that deleting a story, New blank, or opening a file never prunes. **Bring back** restores a story into the current rundown exactly as saved.
- **the older look show archived, not deleted.** The 20 Nov 2026 geopolitics show stays in the Archive with its creator credit and link filled in. The older look stays as an optional look. A saved copy of the old sample is replaced by GlobeDesk on boot (it is still in the Archive).
- **Phone layout (≤ 760 px).** The globe comes first at full width, then the play controls, then the panels as collapsible sections. The top-bar buttons move into a ☰ Menu. The map credits move from the stage to a full, readable line under the globe, so they no longer cover it.
- **Inspector tabs.** All 12 tabs are visible in a 4 × 3 grid (no hidden sideways scroll), with `role="tab"`, `aria-selected` and arrow-key movement.
- **Stage.** Event labels no longer overlap each other, the header, cards, citations or captions; the active story’s label goes first, and labels from the far side of the globe are no longer drawn when zoomed in. The coarse focus-country glow fades out by region zoom instead of drawing a misplaced border over city streets. The topic card stays clear of the map zoom buttons in the preview. The on-stage handle is a link. Blank source lines are gone (one source box per real source).
- **Small fixes.** Version shown in the top bar ("v0.5.1 · AdventureNLearn Edition"). Record button contrast is 6+:1. The idle toast is fully hidden, so it no longer overlaps panels.
- **Grok.me kit.** `tests/`, `tools/`, `.gitignore`, `START-GLOBEDESK.bat` and `OPEN-ITEMS.md` are no longer in `grokme/manifest.json`, so they are not served on the live site.

## v0.5.0 — 2026-11-20

- Added the interactive mission demo under `demo/`. The frog guide is an **example pack** (`demo/guide-packs/template/`). Users can edit or replace the character, voice, script, poses, lamp colors, radio stations and theme. A blank template pack and a “make your own guide” README ship with it.
- Production default: the temporary voice lab in the demo is off.
- Credits for the NASA Earth embed and for live radio stations are links only. The repo does not include song files. Share-video recordings mix a credited CC BY 4.0 radio bed (“Cool Rock” by Kevin MacLeod, incompetech.com) under the boot and debrief; the live page still uses Exclusive CCR. A credited still is used if the live YouTube embed is unavailable.
- Demo captions sit above the HINT/CONTINUE bar, wrap to at most two lines, and page in sync with the voice-over so lines are no longer clipped.
- Demo HUD uses a fixed zone grid (top bar, left rail, center desk, bottom captions/controls). Inspector tabs scroll on one row instead of wrapping into a pile. Overlap is reserved for purposeful modals such as the kit and debrief.
- Grok.me kit stays within the self-imposed 20 MiB budget: `demo/` is git-tracked for local use but is not listed in `grokme/manifest.json`.
- Version number is 0.5.0. License remains MIT, Copyright (c) 2026 AdventureNLearn.

## v0.4.2

- Closed the v0.4.1 review blockers (Grok.me manifest from git-tracked files only, stricter `?import=`, schema `additionalProperties: false`). See `OPEN-ITEMS.md`.

## v0.4.1

- Closed the v0.4 review blockers (same-origin import, validation, CSP, sanitizer, overlay and source-link checks).

## v0.4

- Production desk: story editor, local media, sound overlays, content placements, assist panel, project packs, Grok.me kit.

## v0.3

- Street-level hybrid globe, look target, citation layout, MIT license.

## Earlier

- Renamed to GlobeDesk.
