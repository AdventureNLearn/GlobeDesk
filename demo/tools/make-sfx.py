#!/usr/bin/env python3
"""Synthesize every demo sound effect from scratch with ffmpeg (no samples, no recordings).

The output is AdventureNLearn's own content, licensed CC BY 4.0 (see LICENSE-CONTENT).
Deterministic: fixed noise seeds and bit-exact WAV output, so a re-run gives the same files.
Writes the same set to demo/assets/sfx/ and demo/guide-packs/template/assets/sfx/.
Usage: python3 demo/tools/make-sfx.py   (needs ffmpeg)
"""
import shutil, subprocess, sys
from pathlib import Path

DEMO = Path(__file__).resolve().parents[1]
OUTS = [DEMO / "assets" / "sfx", DEMO / "guide-packs" / "template" / "assets" / "sfx"]
SR = 22050
PI = "PI"

def ev(expr, d):
    return f"aevalsrc='{expr}':s={SR}:d={d}"

# name -> (filter_complex graph ending in [out], short description)
SOUNDS = {
    "ui-click.wav": (f"{ev('0.6*sin(2*PI*1800*t)*exp(-70*t)', 0.07)}[out]", "1.8 kHz sine tick, fast decay"),
    "hint-tick.wav": (f"{ev('0.5*sin(2*PI*2600*t)*exp(-90*t)', 0.05)}[out]", "2.6 kHz sine tick"),
    "ui-blip.wav": (f"{ev('0.45*sin(2*PI*(880*t+1700*t*t))*exp(-16*t)', 0.12)}[out]", "rising sine blip 880 Hz up"),
    "ui-boot.wav": (
        f"{ev('0.35*sin(2*PI*(180*t+520*t*t))*sin(PI*t/0.7)', 0.7)}[a];"
        f"anoisesrc=color=pink:seed=7:amplitude=0.25:r={SR}:d=0.7,bandpass=f=900:width_type=o:w=1.5,afade=t=in:d=0.3,afade=t=out:st=0.35:d=0.35[b];"
        "[a][b]amix=inputs=2:normalize=0[out]",
        "rising sine chirp + band-passed pink noise swell"),
    "sector-whoosh.wav": (
        f"anoisesrc=color=white:seed=3:amplitude=0.5:r={SR}:d=0.55,bandpass=f=1400:width_type=o:w=2,lowpass=f=4000,"
        "afade=t=in:curve=qsin:d=0.25,afade=t=out:curve=qsin:st=0.25:d=0.3[out]",
        "band-passed white-noise sweep"),
    "success-chime.wav": (
        f"{ev('0.22*exp(-5*t)*(sin(2*PI*1047*t)+0.8*gt(t,0.07)*sin(2*PI*1319*t)+0.7*gt(t,0.14)*sin(2*PI*1568*t))', 0.52)}[out]",
        "stacked sine chime C6-E6-G6"),
    "rank-up.wav": (
        f"{ev('0.2*(sin(2*PI*523*t)*exp(-6*t)+gt(t,0.12)*sin(2*PI*659*t)*exp(-6*(t-0.12))+gt(t,0.24)*sin(2*PI*784*t)*exp(-6*(t-0.24))+gt(t,0.36)*sin(2*PI*1047*t)*exp(-5*(t-0.36)))', 0.72)}[out]",
        "four-note sine arpeggio C5-E5-G5-C6"),
    "telemetry-bed.wav": (
        f"{ev('0.05*sin(2*PI*55*t)+0.07*sin(2*PI*1200*t)*lt(mod(t,0.5),0.035)+0.04*sin(2*PI*1800*t)*lt(mod(t+0.25,1.5),0.03)', 6)}[a];"
        f"anoisesrc=color=brown:seed=5:amplitude=0.12:r={SR}:d=6,lowpass=f=500[b];"
        "[a][b]amix=inputs=2:normalize=0,afade=t=in:d=0.4,afade=t=out:st=5.5:d=0.5[out]",
        "low hum + data beeps + soft brown noise"),
    "ambience-ship.wav": (
        f"anoisesrc=color=brown:seed=11:amplitude=0.35:r={SR}:d=40,lowpass=f=380[a];"
        f"{ev('0.12*sin(2*PI*44*t)*(0.6+0.4*sin(2*PI*0.125*t))', 40)}[b];"
        "[a][b]amix=inputs=2:normalize=0[out]",
        "brown-noise rumble + slow 44 Hz sub pulse (loops every 8 s)"),
}

def render(name, graph, dest):
    cmd = ["ffmpeg", "-v", "error", "-y", "-filter_complex", graph + ";[out]alimiter=limit=0.89:level=false,aformat=sample_fmts=s16:channel_layouts=mono[o]",
           "-map", "[o]", "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", "-map_metadata", "-1",
           "-fflags", "+bitexact", "-flags:a", "+bitexact", str(dest)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr)
        raise SystemExit("ffmpeg failed: " + name)

def main():
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg not found")
    first = OUTS[0]
    first.mkdir(parents=True, exist_ok=True)
    for name, (graph, _) in SOUNDS.items():
        render(name, graph, first / name)
        print("wrote", name)
    for other in OUTS[1:]:
        other.mkdir(parents=True, exist_ok=True)
        for name in SOUNDS:
            shutil.copyfile(first / name, other / name)

if __name__ == "__main__":
    main()
