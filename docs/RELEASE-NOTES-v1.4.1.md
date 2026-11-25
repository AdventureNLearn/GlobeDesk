# v1.4.1 Atlas

25 November 2026

GlobeDesk **v1.4.0 · Atlas** is already the public release, tagged at `95ca5c3` and published on 25 November 2026. Those notes stay as written. This 1.4.1 release only covers what lands after that tag: the US history film becomes Live, and the Grok.me file list is rebuilt so it matches the tree.

GlobeDesk is a free, local newsdesk and video studio on a talking globe. You do not need an account, a server or an API key. The live copy is at [globedesk.grok.me](https://globedesk.grok.me).

## What's new in 1.4.1

- **History video is Live.** The tutorial History video step links to [videos.html](../videos.html). That page plays the hosted 720p film of the US history timeline (1775–2026), with English captions (WebVTT and SubRip) and a chapter list. The film file is not in this repository; it is served from the public asset host. A local desk server (`serve.py` or `serve.ps1`) skips the main-app content-security header only for the exact path `/videos.html`, so that page's own policy can apply. Other paths, including look-alike names, still get the desk header.
- **Grok.me kit list repaired.** `grokme/manifest.json` is regenerated from the tracked kit files so sizes and hashes match the tree, and so the kit includes `videos.html`, the start-guide and tutorial scripts, and the other kit files that were missing from the 1.4.0 list. Official Grok.me size limits remain `[UNKNOWN]`. The self-imposed budget (20 MiB total, 5 MiB per file, 600 files) is unchanged.

v1.4.0's Atlas, Bells and 3D workshop, work desks, first-open tutorial, Lite view, one-finger pan, Home button, and personal layer are unchanged.

## Coming soon and `[UNKNOWN]`

These stay **Coming soon** (see [docs/FEATURES.md](https://github.com/AdventureNLearn/GlobeDesk/blob/main/docs/FEATURES.md)):

- Browser voice preview — the speech API is present, but it cannot be confirmed in a headless check (`[UNKNOWN]`).
- Optional paid imagery (MapTiler) — the settings panel is there; it was not run with a paid key (`[UNKNOWN]`).
- Cloud voices — not wired yet.
- Cloud AI suggestions — not wired yet; the Assist tab works today without sending data.
- Historical map (OpenHistoricalMap) — listed in Layers as not wired yet (`[UNKNOWN]`).

A remote version-check address is `[UNKNOWN]` and is disabled. Share packs still do not carry local media, the content layer or event layers.

The film narration follows the approved script. On two stops the on-screen Atlas card is longer than the spoken line (Ellis Island's opening date, and a sentence on the America 250 card about a July 4 ceremony near the Liberty Bell). Those extra card sentences are not in the narration.

## Credits and licensing

GlobeDesk is by [AdventureNLearn](https://x.com/AdventureNLearn).

- Code is [MIT](https://github.com/AdventureNLearn/GlobeDesk/blob/main/LICENSE).
- AdventureNLearn content is [CC BY 4.0](https://github.com/AdventureNLearn/GlobeDesk/blob/main/LICENSE-CONTENT). Credit "AdventureNLearn".
- Third-party map data, fonts and libraries keep their own terms. See [CREDITS.md](https://github.com/AdventureNLearn/GlobeDesk/blob/main/CREDITS.md).

Report security issues privately, as described in [SECURITY.md](https://github.com/AdventureNLearn/GlobeDesk/blob/main/SECURITY.md).
