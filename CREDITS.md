# Credits

GlobeDesk is by **AdventureNLearn** ([@AdventureNLearn](https://x.com/AdventureNLearn)).

- **Code:** MIT ([LICENSE](LICENSE)).
- **AdventureNLearn content:** CC BY 4.0 ([LICENSE-CONTENT](LICENSE-CONTENT)). That covers the episode text, frog art, voice-clip scripts, screenshots and docs. Credit "AdventureNLearn".

Everything below belongs to its creators and keeps its own terms.

## Creators and shows

- **@TheCriticalDri1** ([x.com/TheCriticalDri1](https://x.com/TheCriticalDri1)) made the archived 20 Nov 2026 geopolitics show (`episodes/demo-2026-11-20.globedesk.json`, rebuilt in `js/archive.js`). Every story in it links back to the creator's original post. It is kept in the Archive with that credit.
- **Frogpost sources.** Each Frogpost card links the outlet or post it restates, including news.gov.hk, Smart Maritime Network, Telecom Review Americas, Democracy Now!, World Ports Organization, Blitz via Qoshe, Reuters, Splash247, RRI / Voice of Indonesia, the Federal Register (BOEM), CBS News, Palm Beach Post, South Florida Sun Sentinel, ABC News, Thai Times, Broadcast Media Africa, Transparency International, Cyprus Mail, Financial News (Korea), the EU (EEAS), WSVN, the Acting Secretary of the Army (@SecArmy), @Shaughnessy119 (an unofficial post) and @AdventureNLearn. Card text restates those reports. The articles themselves are linked, not copied.

## Map data and software

- **MapLibre GL JS** 5.24.1, BSD-3-Clause. Vendored in `vendor/` with `vendor/LICENSE-maplibre.txt`. A local patch gives each globe-projection error-measurement readback its own pixel-pack buffer, following [MapLibre GL JS pull request 7943](https://github.com/maplibre/maplibre-gl-js/pull/7943). See `vendor/MAPLIBRE-PATCHES.md`.
- **OpenFreeMap** tiles and styles ([terms](https://openfreemap.org/tos/)), with map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL) and the [OpenMapTiles](https://openmaptiles.org/) schema (CC BY 4.0).
- **EOX** Sentinel-2 cloudless 2016 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0.
- **Natural Earth**, public domain. Used for the offline globe, land and towns (`data/`).
- **Terrain (optional):** Tilezen/Mapzen Terrarium tiles on AWS Open Data. See the [attribution notes](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
- **NASA Blue Marble (optional overlay):** *Blue Marble (August 2004, Shaded Relief and Bathymetry)* — NASA Earth Observatory / MODIS, public domain. Tiles may be served from a local z0–8 MBTiles pack or streamed from [NASA GIBS](https://earthdata.nasa.gov/gibs) (NASA EOSDIS).

## Mission demo (`demo/`)

- **NASA / NASA Johnson:** [Ultra High Definition (4K) View of Planet Earth (2016)](https://www.youtube.com/watch?v=oFDeNcu3mnc). Used as an allowlisted embed. The poster is a typographic credit card, not a frame of the film.
- **Live radio (links only, no song files):** [Exclusive Radio, Exclusively CCR](https://play.exclusive.radio/), [0 N Radio, Classic Rock](https://www.0nradio.com/), [SomaFM Left Coast 70s](https://somafm.com/seventies/).
- **"Cool Rock" by Kevin MacLeod** ([incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cool%20Rock.mp3)), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Used only as the radio bed in share-video recordings. The MP3 is not stored in this repository.
- **Fonts:** Orbitron, Rajdhani and Cinzel, SIL Open Font License 1.1. See `demo/assets/fonts/FONTS.txt`.
- **Frog art:** AdventureNLearn, made with an AI image tool (C2PA content credentials are embedded). CC BY 4.0.

## Voices and sound effects

| Item | Path | License |
|---|---|---|
| **British voice clips** (default "British" option) | `demo/guide-packs/frogpost/assets/vo/gb/*.wav` | **CC BY 4.0**, credit "AdventureNLearn". Voice: Piper [`en_GB-vctk-medium`](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_GB/vctk/medium), speaker p226 (repository license MIT). Trained on the [CSTR VCTK Corpus 0.92](https://datashare.ed.ac.uk/handle/10283/3443) (Yamagishi, Veaux and MacDonald, University of Edinburgh; its `license_text.txt` is CC BY 4.0), fine-tuned from Piper `hifi_tts_92`, trained on [Hi-Fi TTS](https://www.openslr.org/109/) (Bakhturina, Lavrukhin, Ginsburg and Zhang, NVIDIA; CC BY 4.0; LibriVox public-domain recordings). Credit both datasets when you reuse the clips. Details: `vo/gb/SOURCE.txt`. |
| **US voice clips** ("US" option) | `demo/guide-packs/frogpost/assets/vo/*.wav` | **Non-commercial use only. Excluded from the CC BY 4.0 grant.** Voice: Piper [`en_US-hfc_male-medium`](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/hfc_male/medium). Dataset (Hi-Fi-Captain): CC BY-NC-SA 4.0 (non-commercial, share-alike). Model fine-tuned from lessac (Blizzard 2013 license). Details: `vo/SOURCE.txt`. |
| **Sound effects** | `demo/assets/sfx/`, `demo/guide-packs/frogpost/assets/sfx/` | **CC BY 4.0**, credit "AdventureNLearn". Synthesized from scratch by `demo/tools/make-sfx.py` (ffmpeg signal generators: math expressions, sine tones, seeded noise). No samples or recordings. |

The voice-clip **scripts** (the words) are AdventureNLearn's and are CC BY 4.0.

The 8-second cold-open clip (`demo/guide-packs/frogpost/assets/v1-cold-open.mp4`) had a quiet ambient audio track (no speech) of [UNKNOWN] license that came with the AI-generated video. In v1.0.1 that audio was stripped with `ffmpeg -an` (video stream copied, no re-encode). The picture is AdventureNLearn content under CC BY 4.0. Remuxing the container removed the C2PA content credentials that were in the original file; those credentials would not have validated after the audio was removed anyway.
