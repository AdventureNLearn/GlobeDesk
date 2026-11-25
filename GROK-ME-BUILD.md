# Rebuilding GlobeDesk on Grok.me

Built by AdventureNLearn.

This kit lets a hosted app builder (Grok.me) rebuild GlobeDesk from the public repository. Point the builder at **https://github.com/AdventureNLearn/GlobeDesk**, main branch, and paste `grokme/BUILDER-PROMPT.txt`. Nothing in this repository uploads, publishes or signs in anywhere by itself.

How Grok.me actually works (size limits, history, what "upload" means) is **[UNKNOWN]**. Treat the steps below as the intended use of this kit, not a confirmed Grok.me manual.

## What to upload

Exactly the files listed in `grokme/manifest.json` (path, size, SHA-256), copied unchanged.

Left out of the kit (keep them in the git repo, do not upload unless you choose to):

- `shots/` (screenshots)
- `starter/` (the take-away starter kit; it ships as `globedesk-starter-v1.4.0.zip` on the GitHub release)
- `demo/` (interactive mission tour and guide packs; over the 20 MiB kit budget)
- `.git/`
- zip artifacts outside this folder

Keep as-is: `vendor/maplibre-gl.js`, `vendor/maplibre-gl.css`, `vendor/LICENSE-maplibre.txt`, `data/land.js`, `data/world.js`, `data/towns.js`, `LICENSE`, `LICENSE-CONTENT`, `CREDITS.md`. Do not replace MapLibre with a CDN copy.

Entry page: `index.html`.

## Size budget

Grok.me's own size limits are [UNKNOWN]. This kit uses self-imposed limits: **20 MiB total**, **5 MiB per file**, **600 files**. `python3 tools/make_grokme_manifest.py --check` fails if the listed files go over.

## Check it yourself

```sh
python3 tools/make_grokme_manifest.py          # rewrite grokme/manifest.json from the file list
python3 tools/make_grokme_manifest.py --check  # manifest matches files and stays in budget
```

A version-check URL for published copies is [UNKNOWN] and is not enabled (`js/version.js` has `URL = null`). Leave it null.

## Requests the build may make

- EOX satellite tiles: `https://tiles.maps.eox.at` (default hybrid base, network).
- OpenFreeMap styles, tiles and glyphs: `https://tiles.openfreemap.org`.
- Optional terrain (off by default): `https://s3.amazonaws.com/elevation-tiles-prod/` (Tilezen/Mapzen Terrarium on AWS Open Data).
- Optional NASA GIBS: `https://gibs.earthdata.nasa.gov` (off by default).
- Optional MapTiler: `https://api.maptiler.com`, only after the visitor pastes their own key.
- Optional xAI stays unwired; `https://api.x.ai` is not in the CSP until a request shape is documented.
- YouTube nocookie frames, only if the user adds an allowlisted embed. X/Twitter embeds render as a credit-required link (no frame).
- Nothing else. `index.html`, `tools/serve.py` and `tools/serve.ps1` list exactly these hosts in the Content-Security-Policy. `style-src` is `'self'` only (no `unsafe-inline`).

Offline, the bundled Natural Earth globe still runs (`?base=offline` or Layers → Offline globe).

## Safety rules the builder must not weaken

- Local-only media: uploads stay in the browser; no server upload.
- Sanitize all user text; no raw `innerHTML` of unsanitized input.
- No API keys in the tree or in episode files.
- Credit other people's work. Keep "as reported, not verified" labels. Do not invent facts.
- https-only links with `rel=noopener`. Embeds only from the allowlist, with credit required.
- User content must not modify the base map style, sources, or tiles.
- Optional paid features stay off by default.


## Host notes (Grok.me)

These notes came from the v1.3.0 rebuild and were rechecked against the public live copy on Nov 22, 2026 (ET). They still apply in v1.4.1 Atlas. Build from https://github.com/AdventureNLearn/GlobeDesk (main branch):

- The kit is exactly the files listed in `grokme/manifest.json`. Copy them unchanged. Do not invent a new tree.
- In this repository the entry page stays `index.html`. Do not add `desk.html` to the repo: on Grok.me, `/` is the host shell, which iframes `/desk.html`. A check of the live v1.3.1 copy found `/desk.html` byte-identical to this kit's `index.html`, and `/index.html` returned 404. How the builder maps those paths is [UNKNOWN].
- Leave the version-check URL in `js/version.js` null.
- Keep the Content-Security-Policy in `index.html` exactly as it is. Add no hosts.
- Live official GIS, dated NASA imagery, and online address search stay off by default.
- Keep LICENSE (MIT), LICENSE-CONTENT (CC BY 4.0), CREDITS.md, and the licence files in `vendor/`.
- Do not add keys, sign-in, or paid API calls.
- Do not "fix" `/api/packs` or `/api/command/next`. Those run only on localhost when the local GlobeDesk server is present. A hosted copy does not call them.
- Ignore any Grok.me wrapper. This git repository is the kit, not the host shell.

## GROK-ME-UPDATE

1. Each copy can show its local version from `js/version.js` (`1.4.1`). A remote version-check host is [UNKNOWN] and disabled.
2. When a new GlobeDesk release is published, point the builder at https://github.com/AdventureNLearn/GlobeDesk (main) and paste `grokme/UPDATE-PROMPT.txt`.
3. The builder rebuilds from that release's `grokme/manifest.json` and changes nothing else.
4. If the copy looks wrong, roll back with the builder's own history (how Grok.me keeps history is [UNKNOWN]).

## Test checklist

After a Grok.me (or local) build:

- [ ] The desk boots at the entry page with no console errors.
- [ ] New blank, Sample, and Open / Save JSON / Save project all work.
- [ ] A plain click or tap on the globe selects; a pin is dropped only by right-click or a long press. Gazetteer search works offline.
- [ ] A story can be duplicated and deleted.
- [ ] Dropping an image and an audio file keeps them after a reload (IndexedDB).
- [ ] Sound overlay plays with volume / offset / loop and is present in a short recording.
- [ ] Place tab: screen overlay and geo-anchored panel render; clearing content leaves the base map unchanged.
- [ ] Assist tab rejects invalid JSON and accepts a valid episode.
- [ ] CSP is present; no unpaid keys in the tree.
- [ ] Sample is labelled Sample and is removable.
- [ ] A fresh open (empty save) shows the GlobeDesk news desk with the GLOBEDESK badge, @AdventureNLearn, and version "v1.4.1 · Atlas" in the top bar. A skippable tutorial covers every feature (Help reopens it). The 50-topic example feed and the 2-story Washington, DC sample are not preloaded (open the sample from the guide, Menu → File → Sample, or ?sample=1).
- [ ] The tutorial History video step is Live and links to `videos.html`. Opening `/videos.html` plays the hosted 720p film and captions.
- [ ] Archive opens a card for every story (Washington, DC sample plus the news-desk topic set). A story deleted from the rundown is still in the Archive and **Bring back** restores it.
- [ ] The Layers button (or the L key) opens the layer list. Show all and Hide all update the visible map layers in one go on the Offline globe and on Satellite + streets (not only the summary text). Home (or H) returns to the default globe.
- [ ] At phone width (about 390 px) the globe shows first at full width; the ☰ Menu opens the top-bar buttons; panels fold. One-finger drag pans the globe; a two-finger pinch only zooms.
- [ ] ?lite=1 (and the Lite view button) keeps the globe and the main buttons (Home, Layers, Atlas, Help). Full view brings every tool back.
