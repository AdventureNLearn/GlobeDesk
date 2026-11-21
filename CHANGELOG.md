# Changelog

## v0.5.1 — AdventureNLearn Edition — 2026-11-20

- **Frogpost is the default show.** A fresh open (or an empty save) loads Frogpost by @AdventureNLearn: the `frog` pond-green look, the `FROGPOST` header badge, and 50 stories in five fixed groups (Build it, Globe encyclopedia, Water and works, Receipts, Frogpost) from `js/frog-rundown.js`. Card text is used as written; `[UNKNOWN]` is kept; the six stories with no single place have no pin and are left off the event layer. Title and brand: "Frogpost — GlobeDesk", 🐸 Frogpost, link to @AdventureNLearn.
- **Archive.** New Archive page: every show and story ever added keeps a card and can be opened again. Bundled shows are rebuilt from code; your own stories are saved to an append-only local index that deleting a story, New blank, or opening a file never prunes. **Bring back** restores a story into the current rundown exactly as saved.
- **CTD show archived, not deleted.** The 20 Nov 2026 CTD geopolitics show stays in the Archive with its creator credit and link filled in. The CTD look stays as an optional look. A saved copy of the old sample is replaced by Frogpost on boot (it is still in the Archive).
- **Phone layout (≤ 760 px).** The globe comes first at full width, then the play controls, then the panels as collapsible sections. The top-bar buttons move into a ☰ Menu. The map credits move from the stage to a full, readable line under the globe, so they no longer cover it.
- **Inspector tabs.** All 12 tabs are visible in a 4 × 3 grid (no hidden sideways scroll), with `role="tab"`, `aria-selected` and arrow-key movement.
- **Stage.** Event labels no longer overlap each other, the header, cards, citations or captions; the active story’s label goes first, and labels from the far side of the globe are no longer drawn when zoomed in. The coarse focus-country glow fades out by region zoom instead of drawing a misplaced border over city streets. The topic card stays clear of the map zoom buttons in the preview. The on-stage handle is a link. Blank source lines are gone (one source box per real source).
- **Small fixes.** Version shown in the top bar ("v0.5.1 · AdventureNLearn Edition"). Record button contrast is 6+:1. The idle toast is fully hidden, so it no longer overlaps panels.
- **Grok.me kit.** `tests/`, `tools/`, `.gitignore`, `START-GLOBEDESK.bat` and `OPEN-ITEMS.md` are no longer in `grokme/manifest.json`, so they are not served on the live site.

## v0.5.0 — 2026-11-20

- Added the interactive mission demo under `demo/`. The frog guide is an **example pack** (`demo/guide-packs/frogpost/`). Users can edit or replace the character, voice, script, poses, lamp colors, radio stations and theme. A blank template pack and a “make your own guide” README ship with it.
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
