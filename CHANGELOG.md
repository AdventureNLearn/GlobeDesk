# Changelog

## v1.0.1 — Official Release — 2026-11-21

- **Cold-open audio stripped.** The 8-second Frogpost cold-open clip (`demo/guide-packs/frogpost/assets/v1-cold-open.mp4`) no longer has an audio stream. The quiet ambient track that came with the AI-generated video had a license of [UNKNOWN]; it was removed with `ffmpeg -an`, copying the video stream (no re-encode). Credits and `LICENSE-CONTENT` are updated. Remuxing the container dropped the C2PA content credentials that were in the original file.
- Version shown as "v1.0.1 · Official Release".

## v1.0.0 — Official Release — 2026-11-20

- **Licenses.** Code is MIT (`LICENSE`). Content made for GlobeDesk (episode text, our frog art, our voice clips, screenshots, docs) is CC BY 4.0, credited to "AdventureNLearn" (`LICENSE-CONTENT`). Third-party items keep their own terms.
- **Voices and sounds with clear licenses.** The British demo voice is now Piper `en_GB-vctk-medium` (speaker p226), trained on CC BY 4.0 data (CSTR VCTK Corpus, Hi-Fi TTS); its 50 clips were re-rendered with the same clarity chain (`demo/tools/make-vo-gb.py`) and are CC BY 4.0. The old `en_GB-alan-medium` clips are removed. All sound effects are re-synthesized from scratch by `demo/tools/make-sfx.py` (CC BY 4.0). The US voice (`en_US-hfc_male-medium`) is labeled non-commercial only (CC BY-NC-SA 4.0 dataset, fine-tuned from lessac under the Blizzard 2013 license) and its clips are excluded from the CC BY 4.0 grant.
- **Frogpost content, sourced or dropped.** Cards that could not be backed were removed (48 stories now). The Southern California card is reworded to the backed fact: a BOEM Call for Information and Nominations (Federal Register, 27 Jan 2026), "not a final decision to lease", with a first sale tentatively in 2027 and a regional pin. The Iowa plant card cites the Acting Secretary of the Army on X. The robocall card is labeled an unofficial public claim that was not checked. The two cards that spoke to "you" are rewritten for viewers.
- **Florida pins.** All Florida stories share one state-level approximate pin, and town names are not used in their titles or text.
- **Multi-card callouts on the globe.** Open several story cards at once (the ◎ button in the rundown, Shift/Ctrl-click on a pin, or `?callouts=slug,slug`). Rings and strokes scale with zoom inside fixed limits, so a ring never covers a country when zoomed out. Cards and fonts scale within readable limits, never overlap each other, a ring, the header, captions or the map buttons, and collapse to compact chips (hover or tap to expand) when space runs out. Each leader line is re-routed every frame to its own ring, through zoom, rotation and pitch, and fades with its ring near the far side of the globe. Nearby rings merge into one count badge when zoomed out and split as you zoom in. Placement uses hysteresis and a short upgrade delay, so continuous zoom does not flicker. The callouts are painted by the same painter as the recorder, so they appear in recordings too.
- **Starter kit.** `starter/` has a blank episode template, a layer template, a guide-pack template and `MAKE-YOUR-OWN.md`. `tools/make_starter_zip.py` builds `globedesk-starter-v1.0.0.zip` and scans it; `tools/scrub_scan.py` checks the tree for private paths, emails and keys.
- **Docs.** New README, `CONTRIBUTING.md`, `SECURITY.md`, `CREDITS.md`, and `docs/REFERENCE.md` (the long reference that used to be in the README).
- **Fixes.** The smoke test finds the Kyiv story by slug, and adds a phone-size shot. Demo tools use the system temp folder (or `GLOBEDESK_TMP`) instead of fixed `/tmp` paths. Grok.me prompts use neutral wording; `starter/` is left out of the Grok.me manifest.
- Version shown as "v1.0.0 · Official Release".

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
