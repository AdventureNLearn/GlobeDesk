# Frogpost guide (example)

AdventureNLearn’s example guide for the GlobeDesk mission demo. **Edit or replace this pack.** It is not a required character layer.

- Character: frog guide stills (idle, talk, thumbs-up, hint, salute)
- Voices: Piper `en_US-hfc_male-medium` (default "US", non-commercial only) under `assets/vo/`, and `en_GB-vctk-medium` speaker p226 ("British", CC BY 4.0) under `assets/vo/gb/`
- Script: mission lines in `manifest.json`
- Radio: live public streams (CCR-specific primary + classic-rock fallbacks). Links only; no song files
- Theme and lamp colors: Frogpost console palette

Voice WAVs were rendered locally with Piper and a clarity chain (no rubberband, no aecho). The Onnx models are not stored here. The British WAVs (`assets/vo/gb/`) are CC BY 4.0 with dataset credit (see `assets/vo/gb/SOURCE.txt`). The US WAVs are for non-commercial use only and are excluded from the CC BY 4.0 grant (see `assets/vo/SOURCE.txt`). Sound effects are synthesized by `demo/tools/make-sfx.py`, CC BY 4.0.

NASA embed credit: NASA / NASA Johnson — Ultra High Definition (4K) View of Planet Earth (2016), https://www.youtube.com/watch?v=oFDeNcu3mnc. The poster in `assets/nasa-earth-poster.jpg` is a typographic credit card, not a frame of that film. See `assets/POSTER-CREDIT.txt`.
