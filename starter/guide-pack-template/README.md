# Guide pack template

A blank narrator pack for the GlobeDesk mission demo. It has placeholder stills, no voice and no radio.

1. Copy this folder into a GlobeDesk checkout as `demo/guide-packs/my-guide/`.
2. In `manifest.json`, set `id` to `my-guide` (the same as the folder name) and change `title`, `character.shortName` and `character.commsWho`.
3. Replace `assets/*.jpg` with your own stills: idle, talk, success, hint, salute and portrait.
4. Write your lines. Keep the line ids (`start`, `spin-brief`, `spin-success`, …) so they match the mission.
5. Optional: add WAV files to `assets/vo/`, named like the line ids, and list them under `voices`.
6. Optional: add live radio streams you have the right to link to, and credit the station. Never add song files.
7. In `demo/js/config.js`, set `guidePack: "my-guide"`, then run `python3 demo/tools/serve.py`.

The full notes are in `demo/guide-packs/README.md` in the GlobeDesk repository. You are responsible for the rights to any image, voice or stream you add.
