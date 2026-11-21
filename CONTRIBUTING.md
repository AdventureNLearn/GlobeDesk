# Contributing to GlobeDesk

Thanks for helping. GlobeDesk is a small, dependency-free browser app, so a contribution is usually one focused change.

## Run it

```bash
python3 tools/serve.py          # http://127.0.0.1:8080
```

## Before you open a pull request

```bash
npm test                                      # unit suites (Node 20+)
node tests/smoke.mjs                          # headless Chrome; must report 0 console errors
python3 tools/make_grokme_manifest.py --check # if you changed any file the live app serves
python3 tools/scrub_scan.py                   # no private paths, emails, tokens or internal IDs
```

If you change a bundled show (for example `js/frog-rundown.js`), regenerate its files with `node tests/build-templates.mjs` and commit the result.

## Rules for content

- **Credit and link creators.** Any story, clip, quote or layer based on someone else's work needs a visible credit and an https link to the original.
- **Don't invent facts.** Mark what you don't know as `[UNKNOWN]`. Keep "as reported, not verified" unless you checked the claim yourself.
- **Use approximate pins** for news places. Never pin a private home or anything that could locate a private person.
- **Don't add copyrighted songs**, paid sample packs, or media you don't have the rights to.
- **Don't commit secrets.** API keys, tokens and `.env` files never go in the repo or in episode files.

## Code style

- Plain JavaScript (no build step) in `js/`. Keep the base map layer and the user-content layer separate.
- Sanitize anything a user can type or import. Don't use raw `innerHTML` with user input.
- Keep the Content-Security-Policy host list in `index.html`, `tools/serve.py` and `tools/serve.ps1` in sync.

## Licensing of contributions

By contributing, you agree that your code is released under the MIT License ([LICENSE](LICENSE)) and your content (text, images, docs) under CC BY 4.0 ([LICENSE-CONTENT](LICENSE-CONTENT)).
