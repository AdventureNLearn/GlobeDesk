<!-- Thanks for contributing to GlobeDesk. See CONTRIBUTING.md for the rules behind each box. -->

## Title
<!-- Short, specific, imperative. Example: Add USGS earthquake layer (last 30 days) -->

## What changed
- 

## Why
<!-- The problem this solves. Link the issue: Closes #123 -->

## Sources and licences
<!-- One line per new source: Publisher, title, https link, licence. Write [UNKNOWN] if you could not confirm. Write "none" if no new data. -->
- 

## Screenshots
<!-- Before / after for anything visible. No private tabs, names or local paths in view. -->

## Tests run
<!-- Paste the commands you ran and the result line of each. -->
- [ ] `npm test`
- [ ] `python3 -m unittest discover -s tests -p "test_*.py"`
- [ ] `node tests/smoke-basic.mjs` (0 errors)
- [ ] `node tests/smoke-atlas.mjs` (if Atlas, desks or user layers changed)
- [ ] `python3 tools/make_grokme_manifest.py --check` (if served files changed)
- [ ] `python3 tools/scrub_scan.py` (0 hits)

## Checklist
- [ ] Every new fact, card, layer or Atlas entry has an https source and a named licence (or `[UNKNOWN]` in the source `license` field, explained above). A licence is never guessed.
- [ ] No non-commercial, no-derivatives, paywalled, restricted or traced data.
- [ ] Claims are labelled PUBLIC / RECORDED / PROJECTED, and reconstructions set `reconstruction: true`.
- [ ] History changes include hard history; nothing difficult was left out to soften the timeline.
- [ ] Feature status in docs/FEATURES.md (Live / Coming soon) still matches a real run; Coming soon items are not described as working.
- [ ] No personal data (private names, addresses, phones, emails, owner details) and no local paths.
- [ ] No API keys, tokens or `.env` files. Test fixtures use fake sample data.
- [ ] Links are https only; no new CSP hosts, or the reason is given above.
- [ ] I agree my code is MIT and my content is CC BY 4.0 (CONTRIBUTING.md), and I follow the Code of Conduct.
