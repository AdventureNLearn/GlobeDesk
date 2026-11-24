# Open items

Audit of what has shipped, and what is still open.

## Closed in v1.0.1

- The unlicensed ambient audio track was stripped from the GlobeDesk cold-open clip (`demo/guide-packs/template/assets/v1-cold-open.mp4`) with `ffmpeg -an`, copying the video stream. The original audio license remains [UNKNOWN]; the picture is unchanged.

## Closed in v1.0.0

- License decided: MIT for code, CC BY 4.0 for content made for GlobeDesk (credited to "AdventureNLearn").
- Unbacked GlobeDesk cards dropped; the rest carry a source (only the "open maps" note has none, by design).
- Florida pins widened to one state-level approximate point.
- Multi-card callouts on the globe: scale with zoom, no overlaps, leaders follow their rings, clustering with hysteresis.
- Starter kit, scrub scan and starter zip script.
- British voice swapped to Piper en_GB-vctk-medium (CC BY 4.0 data); sound effects re-synthesized from scratch by our own script (CC BY 4.0); US voice labeled non-commercial.

## Closed in v0.5.0

- Interactive mission demo in `demo/`, with the frog as a swappable example guide pack.
- Temporary voice lab off by default.
- NASA embed fallback still and radio credits (links only; no song files in the repo).
- `demo/` excluded from the Grok.me upload manifest so the kit stays in budget.

## Closed in v0.4.2

- Grok.me manifest is built from git-tracked files only (no untracked docs). `--check` matches a clean export and the zip.
- Private-name scans were moved out of the public tests.
- `schema/globedesk-story.schema.json` now has `additionalProperties: false` and the same LIMITS; `js/schema.js` remains the authoritative runtime check.
- `?import=` uses `redirect: 'error'`, re-checks `res.url`, and rejects `%2f` / `%5c` / `%2e` in the path. postMessage requires a non-null source. A saved episode that fails validation is kept under a backup key and is not overwritten by autosave. Overlay cards default to the right so they do not cover the citation box.

## Closed in v0.4.1

- `?import=` only fetches same-origin paths under `/episodes/` (URL-parsed; try/catch; a failed import never overwrites autosave).
- Numeric fields in HTML templates are coerced and escaped. Validation rejects unknown keys, wrong types, out-of-range numbers, and over-limit strings/counts.
- Private folder name is no longer a literal in the test files.
- Overlay CSS values are clamped as numbers. postMessage checks source, origin (rejects `null`), and size. Project-pack media uses the same type and size checks (MIME and extension must both match). Source links use URL parsing and reject userinfo. Download blob URLs are revoked after the click.
- CSP: `frame-src` is youtube-nocookie only; terrain is the elevation-tiles path, not all of S3; `api.x.ai` dropped while unwired; `style-src 'unsafe-inline'` removed; `serve.ps1` sends the same CSP header.
- Map attribution stays visible above the caption band; auto map citations fill from the active base (EOX / OSM) instead of `[UNKNOWN]`.

## Closed in v0.4

- Story editor: create, edit, duplicate, delete; title, summary, date, credit, as-reported toggle; pin by click, coordinates, or bundled gazetteer (no online geocoder).
- Event Layers already present in v0.3 remain usable (points, routes, areas; colour, name, show/hide; GeoJSON / CSV / KML).
- Local uploads of video, images and audio in IndexedDB, with type and size checks. Captions / transcripts per placement; SRT/VTT import; captions remain burn-in-able.
- Sound overlays with volume, offset and loop, mixed into playback and the local recording. Pre-recorded voiceover kept.
- Assist panel: documented `globedesk.episode/2` schema, copyable prompt, pasted JSON with strict validation, same-origin postMessage / `?import=` hook. Default voice is the browser's speech synthesis. Optional paid voice/AI stays off; request shapes are [UNKNOWN].
- Autosave in IndexedDB; `.globedesk` project pack (JSON + media) and `.globedesk.json` without media; local WebM recording kept.
- Sanitizer, https-only links with `rel=noopener`, CSP listing allowed hosts, in-tool note that uploads stay on the device.
- Media placements: card, pin popup, screen overlay, geo-anchored panel, allowlisted embeds with credit. Base map stays a separate core layer.
- Sample episode labelled Sample and removable. Street level, offline fallback and the MIT license kept.
- Accessibility: keyboard-reachable controls, labels, contrast, full title/citation text on hover or click.
- Grok.me build kit (`GROK-ME-BUILD.md`, `grokme/`). You load it into the builder yourself; this repo does not publish to Grok.me.
- v0.3 review must-fixes: no private folder names in the tree; 3D terrain defaults off (opt-in); python `http.server` fallbacks bind `127.0.0.1`; offline-fallback wording matches behaviour; truncated titles/citations expandable.

## Still open / [UNKNOWN]

- Official Grok.me size limits and how Grok.me keeps history: [UNKNOWN]. The kit uses a self-imposed budget of 20 MiB total, 5 MiB per file, 600 files.
- A public version-check URL after release: [UNKNOWN]. Version check is off until one is confirmed.
- Optional cloud TTS / AI request shapes (including xAI): [UNKNOWN], adapters not wired.
- OpenHistoricalMap period view: not wired.
- Windows launcher on a real PC: please re-test v0.4 the same way v0.3 was tested. The built-in servers bind `127.0.0.1` only.
- The US demo voice clips are non-commercial only (CC BY-NC-SA 4.0 dataset). Swap them for a permissively licensed voice before any commercial use.
- Callouts on a phone preview are a scaled view of the 1080p video frame, so their text is small in the preview; it is full size in recordings.
- Nominatim / other online geocoders were not added (terms are a poor fit for an unrestricted app geocoder).

## Decisions still open

- A version-check host, if one is wanted: [UNKNOWN].
- v1.4.0-draft (not released): the Atlas, work desks and community open items (21, all OPEN) are in [atlas/OPEN-ITEMS.md](atlas/OPEN-ITEMS.md).
