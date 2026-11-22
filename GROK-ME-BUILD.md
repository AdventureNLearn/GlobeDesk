# Rebuilding GlobeDesk on Grok.me

Built by AdventureNLearn.

This kit lets a hosted app builder (Grok.me) rebuild GlobeDesk from this repository. You point the builder at the repository and pastes `grokme/BUILDER-PROMPT.txt`. Nothing in this repository uploads, publishes or signs in anywhere by itself.

How Grok.me actually works (size limits, history, what "upload" means) is **[UNKNOWN]**. Treat the steps below as the intended use of this kit, not a confirmed Grok.me manual.

## What to upload

Exactly the files listed in `grokme/manifest.json` (path, size, SHA-256), copied unchanged.

Left out of the kit (keep them in the git repo, do not upload unless you choose to):

- `shots/` (screenshots)
- `starter/` (the take-away starter kit; it ships as `globedesk-starter-v1.0.1.zip` on the GitHub release)
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

A version-check URL for published copies is [UNKNOWN] and is not enabled (`js/version.js` has `URL = null`).

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

## GROK-ME-UPDATE

1. Each copy can show its local version from `js/version.js` (`1.2.0`). A remote version-check host is [UNKNOWN] and disabled.
2. When a new GlobeDesk release is published, paste `grokme/UPDATE-PROMPT.txt` into the builder.
3. The builder rebuilds from that release's `grokme/manifest.json` and changes nothing else.
4. If the copy looks wrong, roll back with the builder's own history (how Grok.me keeps history is [UNKNOWN]).

## Test checklist

After a Grok.me (or local) build:

- [ ] The desk boots at the entry page with no console errors.
- [ ] New blank, Sample, and Open / Save JSON / Save project all work.
- [ ] Clicking the globe drops a pin; gazetteer search works offline.
- [ ] A story can be duplicated and deleted.
- [ ] Dropping an image and an audio file keeps them after a reload (IndexedDB).
- [ ] Sound overlay plays with volume / offset / loop and is present in a short recording.
- [ ] Place tab: screen overlay and geo-anchored panel render; clearing content leaves the base map unchanged.
- [ ] Assist tab rejects invalid JSON and accepts a valid episode.
- [ ] CSP is present; no unpaid keys in the tree.
- [ ] Sample is labelled Sample and is removable.
- [ ] A fresh open (empty save) shows GlobeDesk: GLOBEDESK badge, @AdventureNLearn, 48 stories, version "v1.2.0 · Live Data" in the top bar.
- [ ] Archive opens a card for every story (Washington, DC sample plus the news-desk topic set). A story deleted from the rundown is still in the Archive and **Bring back** restores it.
- [ ] At phone width (about 390 px) the globe shows first at full width; the ☰ Menu opens the top-bar buttons; panels fold.
