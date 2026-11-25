# Sources and Atlas data

How to add a public-record source or an Atlas entry to GlobeDesk. The contribution rules (no personal data, no secrets, PR format) are in [CONTRIBUTING.md](../CONTRIBUTING.md). Pack layout and rebuild commands are in [atlas/README.md](../atlas/README.md).

## Source records

Every id an entry cites must exist in `atlas/packs/core/sources.json`. A source record is the source plus its licence:

```json
{
  "id": "example-agency-page",
  "title": "Short title of the page or dataset",
  "url": "https://example.gov/the-record",
  "publisher": "Name of the agency or publisher",
  "class": "official",
  "license": "US federal government work: public domain in the US (17 U.S.C. 105)",
  "checked": "2026-11-24"
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Stable slug. Entries cite this id, never a raw URL alone. |
| `title` | yes | The page or dataset, in a few words. |
| `url` | yes | https link a reader can open. |
| `publisher` | should | The agency, archive or site. |
| `class` | yes | `official` (government, standards body, or a dataset with a named licence), `reference` (other cited pages), or `experimental` (the maintainer's own repos and Learning Lab cards; never a record backing a claim). |
| `license` | yes | The licence or reuse terms as stated on the source. If you cannot confirm them from the source, write `[UNKNOWN]`. Never guess. |
| `checked` | yes | Date you opened the page, `YYYY-MM-DD`. |
| `description`, `terms_url` | optional | A short description of the page, and a link to the terms if they live elsewhere. |

GlobeDesk's own Atlas wording is CC BY 4.0. Third-party text is not copied into the tree unless its licence allows it. When the licence is `[UNKNOWN]` or does not allow reuse, link and summarise in your own words, and say so.

## Atlas entries

Entries live in `atlas/packs/<pack>/entries.json`. After you edit a pack or a source, from the repo root:

```bash
node tools/atlas/build-packs.mjs && node tools/atlas/build-js.mjs
node tools/atlas/validate.mjs
```

- No entry is about a living person (`subject_person_living` must be false). Officials appear only by public role inside an event.
- Unknown facts stay `[UNKNOWN]`. Do not invent dates, pins, numbers or sources.
- Reading levels (`tiers`: kids, everyday, student, professional) are optional. The summary must match the text at `tier`.
- Pins that are approximate must say so.

## Bells

All bell entries belong in the Bells pack (`atlas/packs/bells/`). Every bell cites at least one source with a publisher and a licence (official or primary where one exists). Wikipedia is only a secondary pointer and never the only source. Other packs link to a bell by id and never duplicate the entry.

## History

The history pack (`atlas/packs/history-places/`) is US history from 1775 to 2026 (76 sourced event entries in date order, draft). The timeline starts at 1775. Every history entry needs at least one official source; the validator rejects a history date outside 1775–2026.

**Hard history:** include hard history; never leave it out. Difficult events, violence, injustice and the official record of them belong in the pack when they are part of the period. Do not drop, soften or skip an event to make the timeline more comfortable. Cite official sources, mark unknowns as `[UNKNOWN]`, and do not invent facts.

## Feature status

A new or changed Atlas feature must match [docs/FEATURES.md](FEATURES.md): **Live** or **Coming soon**, from a real run, never from a guess. The in-app tutorial reads the same labels.
