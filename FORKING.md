# Forking GlobeDesk

Forks are welcome. GlobeDesk is a Civic Intelligence Project, and the licences exist so you can adapt it for your newsroom, classroom, city or cause. This page covers how to fork, what the licences ask of you, how to keep your fork distinct, and how to send improvements back.

## Fork and run it locally

1. On GitHub, open [AdventureNLearn/GlobeDesk](https://github.com/AdventureNLearn/GlobeDesk) and click **Fork**.
2. Clone your fork and start the local server:

   ```bash
   git clone https://github.com/<your-account>/<your-fork>.git
   cd <your-fork>
   python3 tools/serve.py        # then open http://127.0.0.1:8080
   ```

   On Windows you can double-click `START-GLOBEDESK.bat`. There is no build step and no account.
3. Optional offline map packs are not in the repository; build them with `tools/fetch_bluemarble_pack.py` and `tools/fetch_region_pack.py` (see the README Quick start).
4. Run the checks in [CONTRIBUTING.md](CONTRIBUTING.md) after you change things.

## Licence obligations

- **Code (MIT, [LICENSE](LICENSE)).** Keep the copyright and permission notice in your copy of `LICENSE`. You can add your own copyright line for your changes.
- **Content (CC BY 4.0, [LICENSE-CONTENT](LICENSE-CONTENT)).** If you reuse AdventureNLearn's episode text, screenshots or docs, keep a credit line such as:

  > Based on GlobeDesk by AdventureNLearn (https://github.com/AdventureNLearn/GlobeDesk), CC BY 4.0. Changes: <what you changed>.

  CC BY 4.0 requires that you **say what you changed** and don't imply endorsement.
- **Third-party parts keep their own terms.** MapLibre (BSD-3-Clause), Mediabunny (MPL-2.0, keep it unmodified or publish your changes to that file), fonts (OFL), map data and tiles, and every linked source. See [CREDITS.md](CREDITS.md). Some voice clips are non-commercial only.
- **Data you add** needs its own named licence, just as in the main project.

## Rename or rebrand your fork

So people don't confuse your fork with the official project:

- Give it a different name in the README title, the page `<title>` in `index.html`, the app name in the top bar, and `package.json`.
- Change the version edition in `js/version.js` (or add a suffix such as `-yourname`). Its update check is off (`URL = null`); if you turn it on, point it at your own release feed.
- Replace the AdventureNLearn handle in the bundled shows and the episode `handle` field (shown in the header band) with your own.
- Don't use "official GlobeDesk" or the AdventureNLearn name to describe your fork. "Forked from GlobeDesk" is fine and appreciated.
- Update the Contribute and Fork links in Menu → Help (`js/layout.js`) to your repository.

## Send improvements back upstream

1. Keep your fork in sync: `git remote add upstream https://github.com/AdventureNLearn/GlobeDesk.git` then `git fetch upstream` and merge or rebase.
2. Put each improvement on its own branch, based on upstream's current branch, without your rebranding.
3. Open a pull request to AdventureNLearn/GlobeDesk using the template, with sources, licences, screenshots and tests run, as described in [CONTRIBUTING.md](CONTRIBUTING.md).

Bug fixes, civic data layers, translations and docs are the easiest to accept.

## Keep forks safe

- Don't commit API keys, tokens, local paths or personal data. Run `python3 tools/scrub_scan.py` before you publish.
- Keep links https only and keep optional network features off by default.
- Security issues in shared code: please report them upstream through [SECURITY.md](SECURITY.md) as well.
