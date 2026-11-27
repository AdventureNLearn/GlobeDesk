# Credits

GlobeDesk is by **AdventureNLearn** ([@AdventureNLearn](https://x.com/AdventureNLearn)).

- **Code:** MIT ([LICENSE](LICENSE)).
- **AdventureNLearn content:** CC BY 4.0 ([LICENSE-CONTENT](LICENSE-CONTENT)). That covers the episode text, screenshots and docs. Credit "AdventureNLearn".

- **Inter:** SIL Open Font License 1.1, local Inter variable cut. See `fonts/Inter-OFL.txt`.
- **Visual theme (cinematic glass, timeline strip, holographic globe atmosphere):** Lily pad palette (owner original).

Everything below belongs to its creators and keeps its own terms.

## Map data and software

- **MapLibre GL JS** 5.24.1, BSD-3-Clause. Vendored in `vendor/` with `vendor/LICENSE-maplibre.txt`. A local patch gives each globe-projection error-measurement readback its own pixel-pack buffer, following [MapLibre GL JS pull request 7943](https://github.com/maplibre/maplibre-gl-js/pull/7943). See `vendor/MAPLIBRE-PATCHES.md`.
- **Mediabunny** 1.66.2 by Vanilagy and contributors, MPL-2.0 ([source](https://github.com/Vanilagy/mediabunny), [npm](https://www.npmjs.com/package/mediabunny)). Vendored unmodified as `vendor/mediabunny-1.66.2.min.js` (byte-identical to `dist/bundles/mediabunny.min.cjs` in the npm package, sha256 `8a0e529432f11a94be04a737005eac7581c4b6687783e0b5fe7cb8c8fd510692`) with its licence in `vendor/LICENSE-mediabunny.txt`. Used only to mux MP4 / WebM from the browser's own WebCodecs encoders. See `vendor/MEDIABUNNY.md`.
- **three.js** r158 (0.158.0), MIT, © 2010-2023 three.js authors ([source](https://github.com/mrdoob/three.js), [npm](https://www.npmjs.com/package/three)). Vendored unmodified as `vendor/three-0.158.0.min.js` (byte-identical to `build/three.min.js` in the npm package, sha256 `3b3a1c97de3ce65ec5b28c28d9f2805a738e9651622691ba771aa95c79d41d51`) with its licence in `vendor/LICENSE-three.txt`. Lazy-loaded only when the Atlas 3D view is opened; it logs the upstream classic-build deprecation warning at that moment.
- **FFmpeg** (optional, not shipped): if you have installed FFmpeg yourself, the local `serve.py` can call it to turn a WebM into an MP4 when your browser cannot encode H.264 + AAC. GlobeDesk does not include, download or modify FFmpeg. Your copy keeps its own licence (LGPL-2.1+ or GPL-2.0+, depending on how it was built; builds with libx264 are GPL). See <https://ffmpeg.org/legal.html>.
- **OpenFreeMap** tiles and styles ([terms](https://openfreemap.org/tos/)), with map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL) and the [OpenMapTiles](https://openmaptiles.org/) schema (CC BY 4.0).
- **EOX** Sentinel-2 cloudless 2016 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0. The optional Washington, DC demo-region pack is this same 2016 layer, fetched from `tiles.maps.eox.at`, and is redistributed under that licence with attribution.
- **Natural Earth**, public domain. Used for the offline globe, land and towns (`data/`).
- **Terrain (optional):** Tilezen/Mapzen Terrarium tiles on AWS Open Data. See the [attribution notes](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).

- **USGS The National Map** (optional official GIS, off by default): USGS Topo, USGS Imagery Only, and the National Hydrography Dataset, served from `basemap.nationalmap.gov` and `hydro.nationalmap.gov`. Credit USGS / The National Map. These are current official composites, not yearly surveys.
- **U.S. Census Bureau TIGERweb** (optional official GIS, off by default): state and county boundaries from `tigerweb.geo.census.gov`. Credit: Source: U.S. Census Bureau. Legal boundaries are never projected.
- **U.S. Census Bureau Geocoder** (optional, off by default): reached only through the local `serve.py` proxy. This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.
- **NOAA nowCOAST** (optional official GIS, off by default): current weather observations from `nowcoast.noaa.gov`. Credit NOAA / NOS / nowCOAST / NWS. Hidden on a historical data year. NOAA and NCEI give no warranty of accuracy, reliability, or completeness.
- **NASA GIBS dated imagery** (optional, off by default): we acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Observing System Data and Information System (EOSDIS).
- **Photon** (optional address search, off by default): © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL), via [Photon](https://photon.komoot.io/).
- **Pleiades** gazetteer (Ancient World pins), CC BY 3.0, © Ancient World Mapping Center and Institute for the Study of the Ancient World ([pleiades.stoa.org](https://pleiades.stoa.org/), [licence](https://creativecommons.org/licenses/by/3.0/)). Representative points of 10 ancient sites are reused with credit; each record links its Pleiades place.
- **Wikidata** coordinates (Ancient World pins for Petra, Caral and Teotihuacan, and a cross-check for the rest), CC0 1.0 ([wikidata.org](https://www.wikidata.org/)).
- **Cliopatria** polity outlines (Ancient World layer, optional, off by default): Polity borders: Cliopatria, Seshat Global History Databank (https://github.com/Seshat-Global-History-Databank/cliopatria), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Subset; borders simplified and approximate; changes by GlobeDesk. Changes: polity outlines only, 14 snapshot years, simplified (0.05 degree tolerance) and rounded to 0.01 degree; see `data/atlas/ancient/extents-index.json`. Authors [UNKNOWN] (the repository files carry no author list).
- **UNESCO World Heritage Centre**, UNITAR-UNOSAT, Perseus Digital Library, Project Gutenberg, Banco de la República and library catalog records are cited and linked from the Ancient World layer; nothing is copied from them.
- **NASA Blue Marble (optional overlay):** *Blue Marble (August 2004, Shaded Relief and Bathymetry)* — NASA Earth Observatory / MODIS, public domain. Tiles may be served from a local z0–8 MBTiles pack or streamed from [NASA GIBS](https://earthdata.nasa.gov/gibs) (NASA EOSDIS).

## Mission demo (`demo/`)

- **NASA / NASA Johnson:** [Ultra High Definition (4K) View of Planet Earth (2016)](https://www.youtube.com/watch?v=oFDeNcu3mnc). Used as an allowlisted embed. The poster is a typographic credit card, not a frame of the film.
- **Live radio (links only, no song files):** [Exclusive Radio, Exclusively CCR](https://play.exclusive.radio/), [0 N Radio, Classic Rock](https://www.0nradio.com/), [SomaFM Left Coast 70s](https://somafm.com/seventies/).
- **"Cool Rock" by Kevin MacLeod** ([incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cool%20Rock.mp3)), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Used only as the radio bed in share-video recordings. The MP3 is not stored in this repository.
- **Fonts:** Orbitron, Rajdhani and Cinzel, SIL Open Font License 1.1. See `demo/assets/fonts/FONTS.txt`.

## Voices and sound effects

| Item | Path | License |
|---|---|---|
| **Sound effects** | `demo/assets/sfx/` | **CC BY 4.0**, credit "AdventureNLearn". Synthesized from scratch by `demo/tools/make-sfx.py` (ffmpeg signal generators: math expressions, sine tones, seeded noise). No samples or recordings. |

The voice-clip **scripts** (the words) are AdventureNLearn's and are CC BY 4.0.

