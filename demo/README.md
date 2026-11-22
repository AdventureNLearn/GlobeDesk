# GlobeDesk mission demo

An interactive guided tour of [GlobeDesk](https://github.com/AdventureNLearn/GlobeDesk). Built by AdventureNLearn.

**The guide is an example pack.** Every narrator piece — stills, name, voice bank, script, pose map, lamp colors, radio stations, theme palette — lives in a swappable guide pack:

- Example pack: [`guide-packs/template/`](guide-packs/template/)
- Blank starter: [`guide-packs/template/`](guide-packs/template/)
- How to make your own: [`guide-packs/README.md`](guide-packs/README.md)

Set `guidePack` in `js/config.js` to the folder name you want to load.

## Run it

From this folder (or from `demo/` inside a GlobeDesk checkout):

```bash
python3 tools/serve.py          # http://127.0.0.1:8765/
```

The server also exposes the GlobeDesk app at `/globedesk/`. Use a local server, not `file://`.

`?auto=1` runs the tour by itself. `?record=1` mutes the live radio stream, shows a credit for the recording bed, and uses a credited NASA still if the YouTube embed cannot play. `?muted=1` mutes all demo audio.

The temporary voice lab is **off** unless you set `tempVoiceLab.enabled` to `true` in `js/config.js`.

## Credits

- GlobeDesk and this demo: AdventureNLearn. Code: MIT (`LICENSE`). AdventureNLearn content (stills, scripts, docs): CC BY 4.0 (`LICENSE-CONTENT`). British voice WAVs and sound effects: CC BY 4.0. US voice WAVs: non-commercial only, excluded from CC BY (see `CREDITS.md`).
- NASA / NASA Johnson — [Ultra High Definition (4K) View of Planet Earth (2016)](https://www.youtube.com/watch?v=oFDeNcu3mnc). The live embed is used when it plays; otherwise a typographic credit still is shown. The still is not a frame of the film.
- Live radio (links only, no song files in this repo): [Exclusive Radio — Exclusively Creedence Clearwater Revival](https://play.exclusive.radio/), [0 N Radio — Classic Rock](https://www.0nradio.com/), [SomaFM Left Coast 70s](https://somafm.com/seventies/).
- Recording bed (used only when muxing a share video, not stored in this repo): “Cool Rock” by Kevin MacLeod, [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cool%20Rock.mp3), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit appears on the radio widget and the end card.
- Example voices: Piper `en_US-hfc_male-medium` ("US", non-commercial only: CC BY-NC-SA 4.0 dataset, fine-tuned from lessac under the Blizzard 2013 license) and `en_GB-vctk-medium` speaker p226 ("British", CC BY 4.0 data: CSTR VCTK Corpus and Hi-Fi TTS). Onnx models are not stored here. See `CREDITS.md`.
- Sound effects: synthesized from scratch by `tools/make-sfx.py` (CC BY 4.0).

You are responsible for rights in any pack, image, voice, or stream you add.

## Demo video

The shareable ~4.5 minute mission video is not stored in git (it is large). A title poster is at [`poster/title.jpg`](poster/title.jpg). The finished video is shared separately from the repository (file name `GlobeDesk-mission-FINAL.mp4`).

