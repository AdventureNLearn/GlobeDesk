#!/usr/bin/env python3
"""Render 4 candidate mission-control voices of the same line, with comms EQ."""
import json, subprocess, sys
import os, shutil
from pathlib import Path

PIPER = Path(os.environ.get("PIPER") or shutil.which("piper") or "piper")
VOICES = Path(os.environ.get("PIPER_VOICES") or "voices")
OUT = Path(__file__).resolve().parents[1] / "voice-samples"
LINE_SPOKEN = "G.M., frens. Desk is online. This is mission control. Ready when you are."
LINE_TEXT = "GM frens. Desk is online. This is mission control. Ready when you are."

# Deeper, slightly slower, radio/comms presence, short room. Free ffmpeg only.
# rubberband pitch is a multiplier (1 = unchanged).
CHAIN = {
    "en_GB-alan-medium": "rubberband=pitch=0.94:tempo=0.97,highpass=f=90,equalizer=f=220:t=q:w=0.7:g=-2,equalizer=f=1300:t=q:w=0.9:g=2,equalizer=f=2600:t=q:w=1.0:g=3,lowpass=f=5000,aecho=0.8:0.85:42:0.16,loudnorm=I=-16:TP=-1.5:LRA=11",
    "en_US-hfc_male-medium": "rubberband=pitch=0.90:tempo=0.97,highpass=f=90,equalizer=f=220:t=q:w=0.7:g=-2,equalizer=f=1300:t=q:w=0.9:g=2,equalizer=f=2600:t=q:w=1.0:g=3,lowpass=f=5000,aecho=0.8:0.85:42:0.16,loudnorm=I=-16:TP=-1.5:LRA=11",
    "en_US-lessac-medium": "rubberband=pitch=0.90:tempo=0.97,highpass=f=90,equalizer=f=220:t=q:w=0.7:g=-2,equalizer=f=1300:t=q:w=0.9:g=2,equalizer=f=2600:t=q:w=1.0:g=3,lowpass=f=5000,aecho=0.8:0.85:42:0.16,loudnorm=I=-16:TP=-1.5:LRA=11",
    "en_US-joe-medium": "rubberband=pitch=0.86:tempo=0.96,highpass=f=90,equalizer=f=220:t=q:w=0.7:g=-2,equalizer=f=1300:t=q:w=0.9:g=2,equalizer=f=2600:t=q:w=1.0:g=3,lowpass=f=5000,aecho=0.8:0.85:42:0.16,loudnorm=I=-16:TP=-1.5:LRA=11",
}

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-3000:] + "\n")
        raise SystemExit("failed: " + " ".join(cmd[:4]))
    return r

def mean_f0(wav):
    import numpy as np
    import wave
    with wave.open(str(wav), "rb") as w:
        sr = w.getframerate()
        n = w.getnframes()
        data = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32)
        if w.getnchannels() > 1:
            data = data.reshape(-1, w.getnchannels())[:, 0]
    data /= 32768.0
    # Simple autocorrelation F0 over voiced frames.
    fmin, fmax = 70, 220
    minl, maxl = int(sr / fmax), int(sr / fmin)
    hop, win = 512, 2048
    pitches = []
    for i in range(0, len(data) - win, hop):
        frame = data[i:i + win]
        if np.sqrt(np.mean(frame * frame)) < 0.02:
            continue
        frame = frame - frame.mean()
        spec = np.fft.rfft(frame * np.hanning(len(frame)))
        corr = np.fft.irfft(spec * np.conj(spec))
        seg = corr[minl:maxl]
        if seg.size == 0:
            continue
        lag = int(np.argmax(seg)) + minl
        if corr[lag] > 0.3 * corr[0]:
            pitches.append(sr / lag)
    if not pitches:
        return None
    return float(np.median(pitches))

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "line_text": LINE_TEXT,
        "line_spoken": LINE_SPOKEN,
        "processing": "Piper raw → ffmpeg rubberband pitch/tempo, highpass, presence EQ, light aecho room, loudnorm -16 LUFS. Free tools only.",
        "candidates": []
    }
    for name, af in CHAIN.items():
        model = VOICES / f"{name}.onnx"
        raw = OUT / f"{name}.raw.wav"
        dest = OUT / f"{name}.wav"
        print("piper", name)
        p = subprocess.run(
            [str(PIPER), "-m", str(model), "-f", str(raw), "--length-scale", "1.06"],
            input=LINE_SPOKEN + "\n", text=True, capture_output=True,
        )
        if p.returncode != 0 or not raw.exists():
            sys.stderr.write(p.stderr)
            raise SystemExit("piper failed " + name)
        run(["ffmpeg", "-y", "-i", str(raw), "-af", af, "-ar", "22050", "-ac", "1", str(dest)])
        raw.unlink(missing_ok=True)
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dest)],
            capture_output=True, text=True,
        )
        dur = float(probe.stdout.strip() or 0)
        f0 = mean_f0(dest)
        rec = {
            "id": name,
            "file": str(dest),
            "duration": round(dur, 3),
            "median_f0_hz": round(f0, 1) if f0 else None,
        }
        manifest["candidates"].append(rec)
        print(" ", dest, f"{dur:.2f}s", "F0", rec["median_f0_hz"])
    (OUT / "SAMPLES.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("wrote", OUT / "SAMPLES.json")

if __name__ == "__main__":
    main()
