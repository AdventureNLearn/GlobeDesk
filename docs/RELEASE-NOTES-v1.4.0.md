# v1.4.0 Atlas

25 November 2026

GlobeDesk 1.4.0 is the Atlas release. It is a free, local newsdesk and video studio on a talking globe. You do not need an account, a server or an API key. The live copy is at [globedesk.grok.me](https://globedesk.grok.me).

## What's new

- **Atlas.** A cited encyclopedia beside the news desk: 12 categories, 178 entries, and a US history timeline from 1775 to 2026 (76 sourced event entries). Browse A–Z, by category, by place and by year. Each entry has a reading level (Kids, Everyday, Student, and Professional where written). Hard history is included; it is never left out.
- **Bells and 3D.** A worldwide Bells pack and layer, and a **Globe | 3D** workshop for cited objects (including a demo object sample). 3D is an artistic layout, not a build drawing.
- **Work desks.** A Desk menu offers News plus nine work desks (permits, jobsite, trades, engineering, energy, infrastructure, regulatory, civil liberties, and security), each with its scope and official sources.
- **A simpler first open.** The first visit opens a skippable tutorial that walks every feature, labelled **Live** or **Coming soon**. **? Help** opens it again. The 50-topic example feed and the short Washington, DC sample are not preloaded (use the guide, Menu → File → Sample, or `?sample=1`).
- **Lite view.** `?lite=1`, the **Lite view** button, or Menu → View keeps the globe, Home, Layers, Atlas and Help and hides the editing tools. **Full view** brings everything back.
- **Touch.** One finger pans the globe; a two-finger pinch only zooms (it does not rotate or tilt).
- **⌂ Home** (or H) flies back to the starting globe without changing your layers.
- **Your layer.** Pins, notes and followed topics stay in this browser, with Import and Export. A Community layer exists but stays off until you turn it on; it ships empty.
- **Sources.** Every Atlas source record has a source and a licence field. When a licence cannot be verified from the source, it is marked `[UNKNOWN]`. Official sources are public records; they are never a personal project repo.

## Fixes

- The globe finishes a map rebuild even when a style or tile load fails, so the desk does not get stuck on "never loads".
- Words like "Secretary of State" are not treated as secrets. Real credential shapes (tokens, keys, password and bearer strings) are still caught.
- Older source records that had no licence field now have one. Unverified licences are `[UNKNOWN]`, never guessed.
- Docs match the app: the Washington, DC sample is two stories; the episode format is `globedesk.episode/2`; the feature table in [docs/FEATURES.md](FEATURES.md) matches the tutorial labels.

## Coming soon and `[UNKNOWN]`

These features stay **Coming soon** in this release (see [docs/FEATURES.md](FEATURES.md)):

- Browser voice preview — the speech API is present, but it cannot be confirmed in a headless check (`[UNKNOWN]`).
- Optional paid imagery (MapTiler) — the settings panel is there; it was not run with a paid key (`[UNKNOWN]`).
- Cloud voices — not wired yet.
- Cloud AI suggestions — not wired yet; the Assist tab works today without sending data.
- Historical map (OpenHistoricalMap) — listed in Layers as not wired yet (`[UNKNOWN]`).
- History video — the tutorial keeps a marked placeholder. No video is embedded, linked or uploaded in this build.

Other honest gaps stay marked `[UNKNOWN]` in the Atlas and on cards: licences that were not verified from the source (including 14 older catalog sources), reading levels that are not written yet, and any fact that is not in the cited source. A remote version-check address is `[UNKNOWN]` and is disabled. Share packs still do not carry local media, the content layer or event layers.

Event layers are Live. A check of the event clock with undated drawn features still does not hide them; dated features were not the failing case.

## Credits and licensing

GlobeDesk is by [AdventureNLearn](https://x.com/AdventureNLearn).

- Code is [MIT](../LICENSE).
- AdventureNLearn content is [CC BY 4.0](../LICENSE-CONTENT). Credit "AdventureNLearn".
- Third-party map data, fonts and libraries keep their own terms. See [CREDITS.md](../CREDITS.md) for MapLibre GL JS, three.js, Mediabunny, Natural Earth, EOX Sentinel-2 cloudless 2016, OpenFreeMap, OpenStreetMap contributors, NASA Blue Marble / GIBS, and the other credits.

Report security issues privately, as described in [SECURITY.md](../SECURITY.md).
