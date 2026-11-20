# Changelog

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
