# Make your own guide

The frog in this demo is **AdventureNLearn’s example**, not a locked layer. Every user can edit or replace the guide: the character, the name, the voice, the script, the pose map, the comms-lamp colors, the ship-radio stations, and the theme palette.

All of that lives in a **guide pack** — one folder under `guide-packs/`. The demo loads the pack named in `js/config.js`:

```js
guidePack: "template"   // folder name under guide-packs/
```

Switch packs by changing that one string (for example `"template"`) and reloading. No app code has to change.

## What’s in a pack

| Item | Where |
|---|---|
| Manifest | `guide-packs/<id>/manifest.json` |
| Character stills / poses | paths listed under `character.poses` |
| Voice banks (WAV) | `voices[].dir` plus files named `<line-id>.wav` |
| Theme palette | `theme` (CSS color tokens) |
| Lamp colors | `lamps` (`live`, `clear`, `hint`, `radio`) |
| Radio stations | `radio.stations` (live stream URLs and credit links only — do not add song files) |
| Script | `lines` and `levels.<id>.{brief,hint,success,why}` |
| Pose map | `poseMap` (which pose to show for success, hint, finale, …) |

The mission structure itself (level ids, objectives, XP, badges, kiosk modes, timing) stays in `js/config.js` so a pack can re-voice the same desk tour. A pack may also override `embed` credits and the start / complete stills.

## How to make a pack

1. Copy `guide-packs/template/` to `guide-packs/my-guide/`.
2. Edit `manifest.json`. Set `id` to `my-guide` (same as the folder name).
3. Drop your portraits into `assets/` and point `character.poses` at them.
4. Write your lines. Keep the same ids (`start`, `spin-brief`, `spin-success`, …) unless you also change the mission in `config.js`.
5. Optional: render a voice bank (for example with [Piper](https://github.com/rhasspy/piper)) to `assets/vo/<id>.wav`, then set `voice.enabled` and `voices`.
6. Optional: add live radio streams you have the right to link to. Credit the station. Never vendor copyrighted songs.
7. Set `guidePack: "my-guide"` in `js/config.js` and reload.

`guide-packs/template/` is the blank starting pack. Add your own portrait, lines, and voice bank.

## Credits and rights

You are responsible for the rights to any image, voice, script, or stream you add. The example pack credits NASA (embed / poster), Exclusive Radio, 0 N Radio, SomaFM, and Piper voice models in the pack files. Keep credits next to other people’s work.
