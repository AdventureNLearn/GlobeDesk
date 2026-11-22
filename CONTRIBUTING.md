# Contributing to GlobeDesk

GlobeDesk is a **Civic Intelligence Project**: a free, open-source, local-first globe for map-led stories built on public records. Code is MIT ([LICENSE](LICENSE)); AdventureNLearn's content is CC BY 4.0 ([LICENSE-CONTENT](LICENSE-CONTENT)). Contributions are welcome, and this page explains how to shape one so the maintainer can review it quickly.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Want to take the project in your own direction instead? See [FORKING.md](FORKING.md).

## What's welcome

- **Civic data layers.** Public-record layers (boundaries, infrastructure, hazards, history) with a named source and licence. See `episodes/layers/` and [docs/PROMOTE.md](docs/PROMOTE.md).
- **Public-record sources.** Better citations for existing stories and cards, especially primary sources (agencies, archives, court and legislative records).
- **Fixes.** Bugs, accessibility, performance, layout on small screens.
- **Translations.** UI strings and docs. Keep source citations in their original language and add a translated summary.
- **Docs.** Clearer guides, examples, and corrections.

Not a fit: tracking or locating private people, scraped data that breaks a site's terms, paid or restricted datasets, ads or telemetry, or anything that needs a GlobeDesk server or account.

## Source and citation rules

- **Public records only.** Every fact, layer or card needs a source a reader can check: an https link to the original record, plus the publisher's name.
- **Name the licence.** Each layer or dataset states its licence (for example public domain, CC BY 4.0, ODbL). If you can't find it, write `[UNKNOWN]` and say so in the PR. Unknown-licence data stays out of the public tree until it is resolved.
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
npm test                                            # unit suites (Node 20+)
python3 -m unittest discover -s tests -p "test_*.py" # Python tool and server tests
node tests/smoke-basic.mjs                          # headless Chrome load; must report 0 errors
python3 tools/make_grokme_manifest.py               # if you changed any file the app serves...
python3 tools/make_grokme_manifest.py --check       # ...then this must print ok
python3 tools/scrub_scan.py                         # must report 0 hits
```

Run only what applies, and list what you ran in the PR. If you change a bundled show (for example `js/model.js`), regenerate its files with `node tests/build-templates.mjs`. The maintainer also runs a private name scan before merging; you can run `tools/name_scan.py --patterns your-list.json` with your own list.

## Pull request format

Use the template that opens with every PR ([.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)). In short:

1. **Title:** short and specific, in the imperative. Example: `Add USGS earthquake layer (last 30 days)`.
2. **What changed:** a few bullets, by file or feature.
3. **Why:** the problem it solves or the issue it closes (`Closes #123`).
4. **Sources and licences:** every new source as `Publisher, title, https link, licence`. Write `[UNKNOWN]` where you couldn't confirm.
5. **Screenshots:** before/after for anything visible, with no private tabs, names or paths in view.
6. **Tests run:** the commands from the checks above and their results.

One focused change per PR is easiest to review. Draft PRs are fine for early feedback.

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
