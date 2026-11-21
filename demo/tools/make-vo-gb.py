#!/usr/bin/env python3
"""Render the British mission voice lines: Piper en_GB-vctk-medium, speaker p226, + the clarity chain.

Voice license (checked 2026-11-20, see the SOURCE.txt next to the WAVs):
  model  rhasspy/piper-voices en_GB-vctk-medium (repo license MIT)
  data   CSTR VCTK Corpus 0.92, University of Edinburgh, CC BY 4.0
  base   hifi_tts_92 (Hi-Fi TTS, NVIDIA, CC BY 4.0; LibriVox public-domain recordings)
Get the model:  https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_GB/vctk/medium
"""
import json, subprocess, sys
import os, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "js" / "config.js"
OUT = ROOT / "guide-packs" / "frogpost" / "assets" / "vo" / "gb"
PIPER = Path(os.environ.get("PIPER") or shutil.which("piper") or "piper")
MODEL = Path(os.environ.get("PIPER_MODEL") or "voices/en_GB-vctk-medium.onnx")
SPEAKER = os.environ.get("PIPER_SPEAKER") or "p226"  # VCTK p226: male, 22, English (Surrey)
# Same clarity chain as the US bank: natural pitch, no aecho, gentle EQ.
AF = (
    "highpass=f=80,"
    "equalizer=f=3000:t=q:w=1.2:g=1.5,"
    "lowpass=f=10000,"
    "loudnorm=I=-17:TP=-2:LRA=7"
)
AR = "44100"

def load_demo():
    js = """
      const fs = require("fs");
      const vm = require("vm");
      const code = fs.readFileSync(%s, "utf8");
      const ctx = { window: {} };
      vm.createContext(ctx);
      vm.runInContext(code, ctx);
      process.stdout.write(JSON.stringify(ctx.window.DEMO));
    """ % json.dumps(str(CONFIG))
    r = subprocess.run(["node", "-e", js], capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr)
        raise SystemExit("failed to read config.js")
    demo = json.loads(r.stdout)
    # The spoken lines live in the guide pack (same merge as js/guidepack.js).
    pack = json.loads((ROOT / "guide-packs" / "frogpost" / "manifest.json").read_text())
    demo["lines"] = dict(pack.get("lines") or {})
    scripts = pack.get("levels") or {}
    if isinstance(scripts, list):
        scripts = {row["id"]: row for row in scripts if row and row.get("id")}
    for lv in demo.get("levels") or []:
        for field in ("brief", "hint", "success", "why"):
            if (scripts.get(lv["id"]) or {}).get(field):
                lv[field] = scripts[lv["id"]][field]
    return demo

def collect(demo):
    items = []
    def add(key, row):
        if not row: return
        spoken = (row.get("spoken") or row.get("text") or "").strip()
        text = (row.get("text") or spoken).strip()
        if spoken:
            items.append((key, spoken, text))
    for k, row in (demo.get("lines") or {}).items():
        add(k, row)
    for lv in demo.get("levels") or []:
        lid = lv["id"]
        for field in ("brief", "hint", "success", "why"):
            add(f"{lid}-{field}", lv.get(field))
    return items

def main():
    if not PIPER.exists() or not MODEL.exists():
        raise SystemExit("piper or model missing")
    OUT.mkdir(parents=True, exist_ok=True)
    # keep SOURCE note if present; don't delete all blindly except wavs we replace
    speakers = json.loads(Path(str(MODEL) + ".json").read_text()).get("speaker_id_map", {})
    if SPEAKER not in speakers:
        raise SystemExit("speaker not in model: " + SPEAKER)
    sid = str(speakers[SPEAKER])
    demo = load_demo()
    items = collect(demo)
    manifest = []
    for key, spoken, text in items:
        raw = OUT / f"{key}.raw.wav"
        dest = OUT / f"{key}.wav"
        print(f"piper {key}: {spoken[:80]}")
        p = subprocess.run(
            [str(PIPER), "-m", str(MODEL), "-s", sid, "-f", str(raw), "--length-scale", "1.06"],
            input=spoken + "\n", text=True, capture_output=True,
        )
        if p.returncode != 0 or not raw.exists():
            sys.stderr.write(p.stderr)
            raise SystemExit("piper failed " + key)
        r = subprocess.run(
            ["ffmpeg", "-y", "-i", str(raw), "-af", AF, "-ar", AR, "-ac", "1", str(dest)],
            capture_output=True, text=True,
        )
        raw.unlink(missing_ok=True)
        if r.returncode != 0:
            sys.stderr.write(r.stderr[-2000:])
            raise SystemExit("ffmpeg failed " + key)
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dest)],
            capture_output=True, text=True,
        )
        dur = float(probe.stdout.strip() or 0)
        manifest.append({"id": key, "file": dest.name, "duration": round(dur, 3), "spoken": spoken, "text": text})
        print(f"  {dest.name}  {dur:.2f}s")
    (OUT / "durations.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("lines", len(manifest), "wrote", OUT / "durations.json")

if __name__ == "__main__":
    main()
