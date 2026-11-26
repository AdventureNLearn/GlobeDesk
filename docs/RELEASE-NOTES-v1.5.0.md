# v1.5.0 Atlas

26 November 2026

GlobeDesk 1.5.0 adds the **Elements periodic table** to the Atlas. It is a free, local newsdesk and video studio on a talking globe. You do not need an account, a server or an API key. The live copy is at [globedesk.grok.me](https://globedesk.grok.me).

## What's new in 1.5.0

- **Elements periodic table.** In **Atlas → Elements**, all 118 chemical elements sit in the IUPAC 18-column layout as a holographic table. Click an element (or press Enter) to open its card. **Fly in** to an atom to watch its electron shells orbit. **Table view** lists the same 118 elements in atomic-number order. Search and the category filter dim or filter the tiles; arrow keys move between elements; with reduced motion on, it opens as the plain table. Group 3 (La, Lu, Ac, Lr) is drawn as a dashed, unresolved fork because IUPAC has not settled it.
- **Where the data comes from.** 118 cited element entries (NIST atomic weights, the IUPAC periodic table of 4 May 2022, Wikidata CC0 discovery statements) and NIST SP 966 ground-state electron shells for Z=1–103. Z=104–108 are marked *not proven* (calculated, not measured). Z=109–118 have no NIST value and stay `[UNKNOWN]`. Nothing is guessed from the aufbau rule.
- **Links.** `?atlas-view=elements` opens the Elements view. `?atlas=<element-id>` opens one element (for example `?atlas=carbon-element`). The Energy and Materials desk has an **Elements periodic table** button, and the tutorial has a new Live step.
- **Phone and desktop layout.** The Elements sheet fits a 390×844 phone with the grid and the card on the first screen, and the desktop sky no longer overlaps the detail pane.
- **Docs.** The starter and full zip names in the README, `GROK-ME-BUILD.md` and `WINDOWS-RUN.md` follow the current release.

Everything else from 1.4.1 is unchanged: Atlas, Bells and 3D workshop, work desks, first-open tutorial, Lite view, one-finger pan, Home button, personal layer, the US history film page, and the Grok.me kit list.

## The data pack is still a draft

The Elements **view** is Live. The chemistry **data pack** under it is not promoted: its manifest is `0.1.0-draft` and `promote` stays `owner-yes-required`. 118 element entries plus 7 other chemistry records are all marked draft. A promote needs the owner's YES.

`[UNKNOWN]` is kept wherever a value is not confirmed. 58 of the 118 element entries carry at least one (the counts overlap):

| Field | Entries with `[UNKNOWN]` |
|---|---|
| IUPAC group (La–Lu, Ac–Lr) | 30 |
| Standard atomic weight (NIST lists none) | 24 |
| Ground-state electron configuration (Z=104–118) | 15 (5 not-proven, 10 no NIST value) |
| Discovery year | 11 |
| Discovery credit | 10 |

Elements are grouped by chemical family. A valence grouping is not part of this release.

## Coming soon and `[UNKNOWN]`

These stay **Coming soon** (see [docs/FEATURES.md](https://github.com/AdventureNLearn/GlobeDesk/blob/main/docs/FEATURES.md)):

- Browser voice preview — the speech API is present, but it cannot be confirmed in a headless check (`[UNKNOWN]`).
- Optional paid imagery (MapTiler) — the settings panel is there; it was not run with a paid key (`[UNKNOWN]`).
- Cloud voices — not wired yet.
- Cloud AI suggestions — not wired yet; the Assist tab works today without sending data.
- Historical map (OpenHistoricalMap) — listed in Layers as not wired yet (`[UNKNOWN]`).

A remote version-check address is `[UNKNOWN]` and is disabled. Official Grok.me size limits remain `[UNKNOWN]`; the self-imposed budget (20 MiB total, 5 MiB per file, 600 files) is unchanged. Share packs still do not carry local media, the content layer or event layers. In `docs/FEATURES.md`, the Event layers row still records an event-clock hide check that failed with undated drawn features; that was already failing before this release.

## Credits and licensing

GlobeDesk is by [AdventureNLearn](https://x.com/AdventureNLearn).

- Code is [MIT](https://github.com/AdventureNLearn/GlobeDesk/blob/main/LICENSE).
- AdventureNLearn content is [CC BY 4.0](https://github.com/AdventureNLearn/GlobeDesk/blob/main/LICENSE-CONTENT). Credit "AdventureNLearn".
- Element data credits NIST (public domain, 17 U.S.C. 105; see https://www.nist.gov/open/license), the IUPAC periodic table, and Wikidata (CC0). Third-party map data, fonts and libraries keep their own terms. See [CREDITS.md](https://github.com/AdventureNLearn/GlobeDesk/blob/main/CREDITS.md).

Report security issues privately, as described in [SECURITY.md](https://github.com/AdventureNLearn/GlobeDesk/blob/main/SECURITY.md).
