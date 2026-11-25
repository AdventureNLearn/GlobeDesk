# Contributing to GlobeDesk

GlobeDesk is a **Civic Intelligence Project**: a free, open-source, local-first globe for map-led stories built on public records. Code is MIT ([LICENSE](LICENSE)); AdventureNLearn's content is CC BY 4.0 ([LICENSE-CONTENT](LICENSE-CONTENT)). Contributions are welcome, and this page explains how to shape one so the maintainer can review it quickly.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Want to take the project in your own direction instead? See [FORKING.md](FORKING.md).

## What's welcome

- **Atlas entries.** Cited encyclopedia entries (history, bells, objects, energy, and the other packs). See [atlas/README.md](atlas/README.md) and [docs/SOURCES.md](docs/SOURCES.md).
- **Civic data layers.** Public-record layers (boundaries, infrastructure, hazards, history) with a named source and licence. See `episodes/layers/` and [docs/PROMOTE.md](docs/PROMOTE.md).
- **Public-record sources.** New or better citations, in the source registry format (source plus licence; write `[UNKNOWN]` when the licence is unclear). See [docs/SOURCES.md](docs/SOURCES.md).
- **Fixes.** Bugs, accessibility, performance, layout on small screens.
- **Translations.** UI strings and docs. Keep source citations in their original language and add a translated summary.
- **Docs.** Clearer guides, examples, and corrections. If you add or change a feature, keep [docs/FEATURES.md](docs/FEATURES.md) in step (Live vs Coming soon).
- **Atlas 3D objects.** A buildable object or kit layer copied from the bag solar kit sample. See [docs/BUILD-YOUR-OWN-OBJECT.md](docs/BUILD-YOUR-OWN-OBJECT.md).

Not a fit: tracking or locating private people, scraped data that breaks a site's terms, paid or restricted datasets, ads or telemetry, or anything that needs a GlobeDesk server or account.

## Build your own object

The v1.4.0-draft tree ships the 3D workshop and the bag solar kit as a demo sample. To add a buildable object or kit layer of your own, copy that sample, rebuild, validate and load it in Atlas. The steps and every schema field are in [docs/BUILD-YOUR-OWN-OBJECT.md](docs/BUILD-YOUR-OWN-OBJECT.md). You do not need to do a real kit build or fill in prices.

## Atlas entries, bells and history

GlobeDesk's Atlas (v1.4.0-draft, not released) is a cited encyclopedia in this repo. The layout, rebuild commands and pack rules are in [atlas/README.md](atlas/README.md). The source-record format is in [docs/SOURCES.md](docs/SOURCES.md).

- **Entries.** Each entry lives in a pack (`atlas/packs/<pack>/entries.json`), cites sources by id, and carries a licence on the entry itself (AdventureNLearn's Atlas text is CC BY 4.0). After you edit, run `node tools/atlas/build-packs.mjs && node tools/atlas/build-js.mjs && node tools/atlas/validate.mjs`. No entry is about a living person (`subject_person_living` must be false). Officials appear only by public role inside an event. Unknowns stay `[UNKNOWN]`.
- **Bells.** All bell entries belong in the Bells pack. Every bell cites at least one source with a publisher and a licence (official or primary where one exists). Wikipedia is only a secondary pointer and never the only source. Approximate pins say so. Other packs link to bells by id (`see_also_ids` or `related`), and never copy the bell entry.
- **History.** The history pack is US history from 1775 to 2026. Every history entry needs at least one official source (the validator checks this). The timeline starts at 1775 (the Old North lanterns of April 1775 sit inside the range).
- **Hard history.** Include hard history; never leave it out. Difficult events, violence, injustice and the official record of them belong in the pack when they are part of the period. Do not drop, soften or skip an event to make the timeline more comfortable. Cite official sources, mark unknowns as `[UNKNOWN]`, and do not invent facts.

## Live and Coming soon

[docs/FEATURES.md](docs/FEATURES.md) is the feature status table the in-app tutorial uses. A feature is **Live** only when it has been run and checked; **Coming soon** means it is not wired yet, it is a placeholder, or it could not be verified end to end. Do not describe a Coming soon item as if it already works. If you add or change a feature, update the table (and `js/tutorial-features.js`) from a real run, not from a guess. Anything you cannot verify stays `[UNKNOWN]` in the docs.

## Source and citation rules

- **Public records only.** Every fact, layer or card needs a source a reader can check: an https link to the original record, plus the publisher's name.
- **Name the licence.** Each source record has a `license` field (for example public domain, CC BY 4.0, ODbL, or the site's stated reuse terms). If you cannot confirm it from the source, write `[UNKNOWN]` and say so in the PR. Never guess a licence. Unknown-licence data is not copied into the tree; GlobeDesk may link and summarise in its own words. Restricted or unlicensed datasets stay out of public layers until the licence is resolved. The JSON field name is `license`; prose in this repo also uses "licence".
- **No restricted or traced data.** No non-commercial (NC / NC-SA) or no-derivatives data in public layers, nothing behind a paywall or login, nothing marked restricted or for official use only, and no shapes traced from copyrighted maps or imagery.
- **Label what kind of claim it is.** Use the item labels **PUBLIC** (published record), **RECORDED** (documented observation) or **PROJECTED** (forecast or model). Reconstructions (for example a historical route rebuilt from accounts) must set `reconstruction: true` and say what they are based on.
- **Don't invent facts.** Mark unknowns as `[UNKNOWN]`. Keep "as reported, not verified" unless you checked the claim yourself.
- **Approximate pins for news places.** Never pin a private home or anything that could locate a private person.
- **Credit creators.** Anything based on someone else's work carries a visible credit and an https link. No copyrighted songs, paid sample packs, or media you don't have the rights to.

## No personal data, no secrets

- No personal names of private people, home addresses, phone numbers, emails, or property owner details. The promote tool strips owner, address, phone, email, valuation, street and occupant fields, but don't rely on it: leave them out.
- No local paths from your machine, desk exports, catalog folders (`globedesk-data/`), or screenshots that show private tabs or files.
- No API keys, tokens or `.env` files, in code, episodes or test fixtures. Test fixtures use obviously fake sample data.

## Run it

```bash
python3 tools/serve.py          # http://127.0.0.1:8080
```

Hosted Grok.me copies follow the host notes in [GROK-ME-BUILD.md](GROK-ME-BUILD.md) (entry page `index.html`, no `desk.html` in the repo, localhost-only APIs).

## Checks to run before you open a PR

```bash
npm test                                            # unit suites (Node 20+), including the Atlas, desks and community tests
python3 -m unittest discover -s tests -p "test_*.py" # Python tool and server tests
node tests/smoke-basic.mjs                          # headless Chrome load; must report 0 errors
node tests/smoke-atlas.mjs                          # if you changed the Atlas, desks or user layers
node tests/firstload.mjs                            # if you changed first open, Lite view (?lite=1) or the tutorial
node tools/atlas/build-packs.mjs && node tools/atlas/build-js.mjs  # after editing atlas/, data/atlas/ or desks/
python3 tools/make_grokme_manifest.py               # if you changed any file the app serves...
python3 tools/make_grokme_manifest.py --check       # ...then this must print ok
python3 tools/scrub_scan.py                         # must report 0 hits
```

Run only what applies, and list what you ran in the PR. If you change a bundled show (for example `episodes/washington-dc-demo.globedesk.json`), regenerate its files with `node tests/build-templates.mjs`. The maintainer also runs a private name scan before merging; you can run `tools/name_scan.py --patterns your-list.json` with your own list.

## Pull request format

Use the template that opens with every PR ([.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)). In short:

1. **Title:** short and specific, in the imperative. Example: `Add USGS earthquake layer (last 30 days)`.
2. **What changed:** a few bullets, by file or feature.
3. **Why:** the problem it solves or the issue it closes (`Closes #123`).
4. **Sources and licences:** every new source as `Publisher, title, https link, licence`. Write `[UNKNOWN]` where you couldn't confirm.
5. **Screenshots:** before/after for anything visible, with no private tabs, names or paths in view.
6. **Tests run:** the commands from the checks above and their results.

One focused change per PR is easiest to review. Draft PRs are fine for early feedback.

## Contributor cards (Community lane, v1.4.0-draft)

You can add yourself as a contributor for Atlas topics you care about. A card is a **credit**, not an Atlas entry about you.

- **What a card holds:** a public handle you choose, a one- or two-line description, 1 to 6 Atlas categories (for example `energy` or `history-places/routes`), up to 3 public https links, a checked date and the licence CC BY 4.0. Format: [schema/globedesk-contributor-card.schema.json](schema/globedesk-contributor-card.schema.json).
- **What a card never holds:** email, phone, real name, address or location. The promote tool strips these (`python3 tools/promote_layer.py --card --item your-card.json --patterns your-list.json`), but leave them out.
- **How it is shown:** in its own Community lane, off by default (Layers, Community), with a Community badge and its own pin style. Community links sit apart from official sources under an Atlas entry and never back a claim. Contributor lists appear per Atlas category.
- **Official vs experimental:** official sources are primary or public records (government, standards bodies, datasets with a named licence). Links to the maintainer's own repositories or Learning Lab cards are shown as *Experimental (not an official source)* and are never counted as a record. The Atlas validator refuses an owner repo tagged official.
- **Review:** open a pull request that adds your card to `atlas/community/community.json`. Every link still needs a checkable public page and a named licence. Cards carry a checked date and fade after a year without a recheck. Nothing goes public without maintainer review and the owner's YES.
- **Not in v1:** profiles, ratings, accounts or anything that needs a server.

Your **personal layer** (your pins, notes, followed topics and links) is different: it stays in your browser on your device. Export and Import in Layers, Your layer, move it as a JSON file ([schema/globedesk-personal-layer.schema.json](schema/globedesk-personal-layer.schema.json)). Share it only if you choose to.

## Code style

- Plain JavaScript with no build step, in `js/`. Keep the base-map layer and the user-content layer separate.
- Sanitize anything a user can type or import. Don't put user input into `innerHTML` without escaping.
- Links are https only. Keep the Content-Security-Policy host list in `index.html`, `tools/serve.py` and `tools/serve.ps1` in sync, and don't add hosts without a reason in the PR.
- Vendored libraries stay unmodified with their licence files, and are listed in [CREDITS.md](CREDITS.md).

## What happens in review

1. The maintainer checks the PR format, sources and licences first. Missing sources or an unclear licence get a request for changes, not a rejection.
2. Tests, the manifest check and the scans are re-run. A scan hit blocks merge until fixed.
3. Visible changes are tried in a local copy of the app.
4. You may be asked to split a large PR, relabel a claim, or swap a source for a primary one.
5. Merged work is credited in [CHANGELOG.md](CHANGELOG.md). Response times are best effort.

Security problems go through [SECURITY.md](SECURITY.md), not a public issue.

## Licensing of contributions

By contributing, you agree that your code is released under the MIT License ([LICENSE](LICENSE)) and your content (text, images, docs) under CC BY 4.0 ([LICENSE-CONTENT](LICENSE-CONTENT)). Third-party data you add keeps its own licence, which you must name.
