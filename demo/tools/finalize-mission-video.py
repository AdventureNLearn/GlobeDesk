#!/usr/bin/env python3
"""Concat title + mission + end cards, crossfade joints, loudnorm to -16 LUFS / TP -1.5."""
from __future__ import annotations
import json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TITLE = ROOT / "work" / "title-card.mp4"
END = ROOT / "work" / "end-card.mp4"
MISSION = ROOT / "GlobeDesk-frog-mission-full.mp4"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "GlobeDesk-frog-mission-FINAL.mp4"
WORK = ROOT / "work"
WORK.mkdir(exist_ok=True)
JOINED = WORK / "mission-joined.mp4"
PASS1 = WORK / "loudnorm-pass1.json"
XFADE = 0.5

def probe_duration(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", str(path),
    ], text=True)
    return float(out.strip())

def run(cmd, **kw):
    print("+", " ".join(str(c) for c in cmd[:8]), "...")
    subprocess.check_call(cmd, **kw)

def main():
    for p in (TITLE, MISSION, END):
        if not p.is_file():
            sys.exit(f"missing {p}")
    t_dur = probe_duration(TITLE)
    m_dur = probe_duration(MISSION)
    e_dur = probe_duration(END)
    off1 = t_dur - XFADE
    off2 = off1 + m_dur - XFADE
    print(f"title {t_dur:.3f}s  mission {m_dur:.3f}s  end {e_dur:.3f}s")
    print(f"xfade {XFADE}s  offsets {off1:.3f}, {off2:.3f}")

    filt = (
        f"[0:v][1:v]xfade=transition=fade:duration={XFADE}:offset={off1:.4f}[v01];"
        f"[v01][2:v]xfade=transition=fade:duration={XFADE}:offset={off2:.4f}[v];"
        f"[0:a][1:a]acrossfade=d={XFADE}[a01];"
        f"[a01][2:a]acrossfade=d={XFADE}[a]"
    )
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-i", str(TITLE), "-i", str(MISSION), "-i", str(END),
        "-filter_complex", filt,
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "18",
        "-r", "30", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", str(JOINED),
    ])

    # loudnorm pass 1
    log = subprocess.check_output([
        "ffmpeg", "-hide_banner", "-i", str(JOINED),
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
        "-f", "null", "-",
    ], stderr=subprocess.STDOUT, text=True)
    # json is at the end of stderr/stdout
    start = log.rfind("{")
    end = log.rfind("}")
    if start < 0 or end < start:
        sys.exit("loudnorm pass 1 produced no JSON\n" + log[-2000:])
    meas = json.loads(log[start:end+1])
    PASS1.write_text(json.dumps(meas, indent=2))
    print("loudnorm measured:", json.dumps(meas))

    ln = (
        "loudnorm=I=-16:TP=-1.5:LRA=11:"
        f"measured_I={meas['input_i']}:"
        f"measured_TP={meas['input_tp']}:"
        f"measured_LRA={meas['input_lra']}:"
        f"measured_thresh={meas['input_thresh']}:"
        f"offset={meas['target_offset']}:"
        "linear=true:print_format=json"
    )
    log2 = subprocess.check_output([
        "ffmpeg", "-y", "-hide_banner",
        "-i", str(JOINED),
        "-c:v", "copy",
        "-af", ln,
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart",
        str(OUT),
    ], stderr=subprocess.STDOUT, text=True)
    start = log2.rfind("{")
    end = log2.rfind("}")
    if start >= 0:
        applied = json.loads(log2[start:end+1])
        (WORK / "loudnorm-pass2.json").write_text(json.dumps(applied, indent=2))
        print("loudnorm applied:", json.dumps(applied))
    dur = probe_duration(OUT)
    print(f"OUT {OUT} duration {dur:.3f}s size {OUT.stat().st_size}")

if __name__ == "__main__":
    main()
