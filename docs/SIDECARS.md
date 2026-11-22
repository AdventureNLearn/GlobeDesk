# Sidecars and schema rules

Step A of the native tools plan (branch `native-tools-20261121`, from `847c4fd`). These rules keep `globedesk.episode/2` stable and hold new catalogs beside it, the same way the news desk already does.

`js/schema.js` is the authoritative check at load time. Machine-readable copies live under `schema/`. Unknown keys are rejected. Do not invent facts, coordinates, or scores.

Owner decisions that apply here (owner-confirmed 2026-11-21): claim scores live in the `globedesk.claims/1` sidecar, not on episode facts. The public "Open in…" allowlist ships only generic SAMPLE desks (see below). Personal desks stay in the local GLOBEDESK_DATA catalog and are not part of the public tree.

## What stays in the episode

`globedesk.episode/2` is the playback file: stories, cards, sources, captions, media descriptors, and event layers. A card fact remains `label` and `value` only. Empty values are not allowed; write `[UNKNOWN]`.

Source `status` stays `verified` or `unverified` and means only whether the cited document was read and matched. It is not a claim score. The story `asReported` toggle and the card `verified` flag stay as they are.

Episode files still must not describe changes to the base map style, its sources, or its tiles.

Old episodes, including the Washington, DC sample, the 50 news-desk topics, the four news-desk episode files, the blank episode, and the starter template, must keep loading without new keys.

## Sidecar catalogs

Sidecars are JSON catalogs with a `schema` string. The news-desk catalog already ships beside the news-desk files. A later `.globedesk` project pack, with sidecars next to `project.json`, is not built yet. An episode with no sidecar still loads.

| Schema | Purpose | Status |
|---|---|---|
| `globedesk.newsdesk.catalog/1` | Section, tags, and dek for the news desk (already shipped) | In use |
| `globedesk.claims/1` | Author-applied claim scores for card facts | Wired in this step |
| `globedesk.outbound/1` | Allowlisted "Open in…" targets | Schema, sidecar, cards, editor, and `listOutbound` in this step |
| `globedesk.research/1` | Per-story links, quotes, `[UNKNOWN]` gaps, and a local update log | Wired in this step |
| `globedesk.records/1` | Cited lists and off-map rows used to build event layers | Wired in this step |

Official GIS overlays belong in a core layer registry (`data/gis-registry.json`, `globedesk.gis-registry/1`), not in the episode. A story may name overlay ids in an optional `gisOverlayIds` array so the news desk can offer those layers; each id should already exist in the bundled GIS registry. The JS validator checks that bundled list even before the registry file has loaded, and treats an unknown id as a warning rather than a load-blocking error. At runtime a leftover unknown id stays off and shows `[UNKNOWN]`, not a replacement dataset. Live official GIS is off by default and only the user can opt in on this device. When live GIS is on and a query overlay is on, that overlay refreshes at the end of a map move (debounced). A down layer is left off and is not re-fetched until the user turns it back on. Unknown registry entries (including OpenHistoricalMap, until a style and date filter are wired) stay undrawn and store no URL. A down host is a skip. Online geocoding stays off. Wiring a new live official source is deferred (step G). The static Content-Security-Policy cannot be delayed until opt-in, so this slice does not add any host to it. `listGis` returns id, label, status, min zoom, and credit. `gisStatus` returns the last health token (`ok`, `error`, `below-minzoom`, `off`, `skipped`, `unknown`). `setOverlay` refuses an unknown or down official layer without changing its URL.


## Command API

The command API stays allowlisted, loopback-only, and Origin/Host-checked. New commands take typed objects, not free text that could open a private path. No command opens an arbitrary URL.

## Tests

New checks are added next to the existing suites, in a small file per tool. Re-running an unrelated suite is not a substitute for those checks.

## Claim scores (`globedesk.claims/1`)

Scores are set by a person, never by the app. They live in this sidecar, not on the episode fact (owner-confirmed 2026-11-21).

The planned optional fields are:

- `claimStatus`: `supported`, `not-proven`, `disputed`, or `people-disagree`. Omitted means unscored.
- `sourceIds`: ids from that story's `sources` list.
- `disagree`: only on a `people-disagree` claim. Two or more groups, each with a non-empty `sourceIds` array and a non-empty `position` (the wording that source actually supports). GlobeDesk does not pick a winner.

Each claim also points at a fact: `storyId` (required, non-empty), and optional `cardId`, `factIndex`, and `factLabel`. Claim `id`s, when present, must be unique. If the sidecar is checked against an episode, `storyId`, `cardId`, `factIndex`, `factLabel`, and `sourceIds` must exist on that episode. `factIndex` and `factLabel` need a `cardId` so they can be checked. Explicit `null` is not an omitted field; omit the key instead.

Putting `claimStatus` or other claim fields on an episode fact is an unknown key and must fail.

Validator: `GD.schema.validateClaims(doc, episode?)`. JSON Schema: `schema/globedesk-claims.schema.json`.

The public SAMPLE fixture lives at `newsdesk/claims.json`. Personal claims load from `GLOBEDESK_DATA/claims/claims.json` when that file is present. The news-desk Claims strip, the Cards and Sources editor controls, and the `listClaims` / `setClaim` / `openClaims` commands read and write this sidecar in memory. `listClaims` returns ids and statuses only, with no label or value text. Scoring a fact does not write `claimStatus` onto the episode fact, and it does not change `asReported` or `sources[].status`. Scores are set by the author, not by GlobeDesk. There is no auto-scoring, no network call, and no geocoding.

Existing news-desk topics stay unscored until an author adds a row to the claims sidecar.


## Open in… (`globedesk.outbound/1`)

The public allowlist lives in `newsdesk/outbound.json` and ships only generic SAMPLE desks. Each target has an `id`, `label`, `enabled`, and `status`. A public https `url` is required only when the target is enabled. Disabled or `[UNKNOWN]` targets must not be rendered as links. When GlobeDesk is served locally, a `GLOBEDESK_DATA/desks/outbound.json` file (untracked) is preferred over the shipped SAMPLE list so a personal catalog can stay on that machine.

The shipped SAMPLE list is:

- Sample Civic Desk (`https://civic.example.org/`) — enabled, verified, fictional
- Sample Atlas Desk (`https://atlas.example.org/`) — enabled, verified, fictional; Science & Space only, so a World card has no Open in… button unless the story names a target in `openIn`
- Sample Pending Desk — `[UNKNOWN]`, disabled, no url. It is never rendered as a link.

Matching: a story may name targets in an optional `openIn` array of ids. Targets also match by `sectionIds` or `storyIds` on the sidecar. Unknown ids are ignored. Links open in a new tab with `noopener` and `noreferrer`. No data is sent. No iframes. CSP is unchanged (these hosts are not added to `connect-src` or `frame-src`).

The allowlisted command is `listOutbound` (optional `storyId`). There is no command that opens a URL.

Validator: `GD.schema.validateOutbound(doc)`, which is authoritative at load time, including the personal-data check: a query string or fragment must not carry an email or a phone number. The URL path is not scanned (plan scope). JSON Schema: `schema/globedesk-outbound.schema.json` (shape, https, and enablement; it does not repeat the personal-data scan).

## Other sidecars (later steps)

These shapes are locked here so later steps do not invent a second pattern.

## Research drawer (`globedesk.research/1`)

The public SAMPLE fixture lives at `newsdesk/research.json`. Personal research loads from `GLOBEDESK_DATA/research/research.json` when that file is present. It is keyed by `storyId`. Each story entry may hold:

- `links[]`: `label`, https `url`, optional `kind` (`official` | `coverage` | `other`)
- `quotes[]`: `text` must be a verbatim excerpt of the cited page, not a paraphrase of the story's source notes, with a `sourceId` that exists on the story; optional `retrieved` ISO date and `locator`
- `gaps[]`: `label` and `detail`. The detail must include `[UNKNOWN]`, or the row must set `isGap` to true. Optional `closed` ISO date. Closing a gap keeps the row and appends an `updates[]` entry. Closing an already-closed gap is a no-op and does not add another update. `addGap` rejects a duplicate label.
- `updates[]`: `at` (ISO date), `note`, optional `sourceId` — an in-app log of author edits, not a network sync
- optional `claimIds` and `recordIds` (ids only; they do not copy the claim or record catalogs)

The news-desk Research control opens a drawer on the selected story (Escape closes the drawer only, and does not clear the news-desk selection; closing the story also closes the drawer). The Sources tab has a Research subpanel. `openResearch`, `listResearch`, `addGap`, and `closeGap` read and write this sidecar in memory. `listResearch` returns counts, ids, and gap labels, not quote text. There is no command that pastes a quote from the network. Cited pages are not fetched. Optional later refresh of a cited https page stays **[UNKNOWN]**. No geocoding.

Validator: `GD.schema.validateResearch(doc, episode?)`. It scans quote, gap, and note text for emails and phones, requires ISO dates for `at`, `retrieved`, and `closed`, and rejects a link URL with leading or trailing spaces. JSON Schema: `schema/globedesk-research.schema.json`. An episode with no research sidecar still loads.

## Records (`globedesk.records/1`)

The public SAMPLE fixture lives at `newsdesk/records.json`. Personal records load from `GLOBEDESK_DATA/records/records.json` when that file is present. The shipped catalogs are clearly labelled SAMPLE and cite example.org pages plus public-domain gazetteer points. Each catalog may hold `credit`, `license`, `terms`, an optional `storyId` and `layerId`, and `records[]`.

Each record has `id`, `title`, `kind` (`event` | `voyage` | `event-sequence` | `case`, or a short author tag), `place` (including `[UNKNOWN]` when the source has no place), optional `lat` / `lon` only when a cited source prints them or the author types them, `date` (or `[UNKNOWN]`), non-empty `citations`, `confidence`, and a `reconstruction` flag. Pre-1500 voyages and event sequences must be marked reconstruction. A citation label must be a real source name, not empty and not `[UNKNOWN]`. A bundled Natural Earth gazetteer match may supply a populated-place point, labelled as a Natural Earth populated-place point and never as an event fix. A row stays off the map when it has no real citation, its precision is unknown, its place is `[UNKNOWN]`, a named place has no printed point and no unique gazetteer hit, or the same place name matches more than one town and no state or country is given.

`buildLayer` writes only cited, placed features into an existing-style `eventLayers` entry (`globedesk_layer` GeoJSON) when the author asks to write into the open project. A row without a real citation, or with only a placeholder citation, never becomes an on-map feature; those rows go on the not-on-map list instead. CSV ingest does not invent a citation. Rebuilds of the shipped SAMPLE event-sequence and case fixtures cite example.org pages plus public-domain gazetteer points — not files from another app. Live GIS stays off; there is no online geocoder.

News-desk boot keeps record layers in a news-desk scope, read-only for the open project. It does not write those layers into the workspace episode or its autosave. The Events tab has a "Build layer from records" panel (paste or open JSON / CSV, on-map vs off-map counts, credit and license, write or refresh one layer). The news desk shows the layer credit on a linked story, and off-map rows appear there and in the research drawer. `listRecords` returns counts and ids, not source page bodies. `frameLayer` flies to the layer bounds, clamped like other camera commands and like the existing Events Frame control. Edits are in memory only.

Validator: `GD.schema.validateRecords(doc, episode?)`. It scans text for emails and phones, rejects owner/address/phone/email/valuation field names, rejects a citation URL with spaces, rejects a placeholder or `[UNKNOWN]` citation label, and checks catalog and record `storyId` values against existing stories when an episode is given. JSON Schema: `schema/globedesk-records.schema.json`. An episode with no records sidecar still loads.

## Lock tests

Lock tests live in `tests/sidecars.unit.mjs`: unknown keys still fail on episodes and on the claims sidecar; all eight shipped episodes still validate; claim fields on a fact are rejected; a valid sidecar, including a people-disagree claim, is accepted when it points at real source ids; empty disagree groups, a whitespace-only position, an empty claim id, disagree on a non-people-disagree claim, duplicate ids, and explicit nulls are rejected. The JSON Schema file is exercised against the same fixtures.

Open in… tests live in `tests/outbound.unit.mjs`: the shipped SAMPLE allowlist validates; Sample Pending Desk stays disabled and is never an anchor; enabled links use `target="_blank"` and `rel="noopener noreferrer"`; `listOutbound` returns the list and rejects a raw URL; news-desk cards and the story editor render buttons only for enabled targets that are not [UNKNOWN] and have an https url.
