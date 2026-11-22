#!/usr/bin/env python3
"""Render 1080p title and end cards (our stills + typography). No third-party song audio."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter
import subprocess, tempfile, shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "work"
FONT = ROOT / "assets" / "fonts"
PACK = ROOT / "guide-packs" / "template" / "assets"
W, H = 1920, 1080

def font(name, size):
    return ImageFont.truetype(str(FONT / name), size)

def still(path, dim=0.42):
    im = Image.open(path).convert("RGB")
    im = im.resize((W, H), Image.Resampling.LANCZOS)
    im = ImageEnhance.Brightness(im).enhance(dim)
    im = ImageEnhance.Color(im).enhance(0.7)
    return im

def center(draw, text, y, f, fill, shadow=True):
    b = draw.textbbox((0, 0), text, font=f)
    x = (W - (b[2] - b[0])) / 2
    if shadow:
        draw.text((x + 2, y + 2), text, font=f, fill=(0, 0, 0))
    draw.text((x, y), text, font=f, fill=fill)

def title_img():
    src = PACK / "a1-console.jpg"
    im = still(src, 0.38)
    d = ImageDraw.Draw(im)
    center(d, "GLOBEDESK", 340, font("Cinzel.ttf", 110), (206, 158, 73))
    center(d, "by AdventureNLearn", 480, font("Rajdhani-SemiBold.ttf", 42), (163, 216, 224))
    center(d, "A free newsdesk studio on a talking globe", 560, font("Rajdhani-Medium.ttf", 32), (232, 232, 232))
    center(d, "Interactive mission demo  |  v1.0.1", 640, font("Orbitron.ttf", 22), (77, 161, 81))
    return im

def end_img():
    src = PACK / "a4-outro.jpg"
    im = still(src, 0.36)
    d = ImageDraw.Draw(im)
    center(d, "GLOBEDESK", 260, font("Cinzel.ttf", 96), (206, 158, 73))
    center(d, "by AdventureNLearn", 380, font("Rajdhani-SemiBold.ttf", 40), (163, 216, 224))
    center(d, "Free, local, and yours to make", 460, font("Rajdhani-Medium.ttf", 34), (232, 232, 232))
    f = font("Rajdhani-Medium.ttf", 24)
    credits = [
        "The frog guide is an example pack — edit or replace it.",
        "NASA / NASA Johnson — Earth from the ISS (2016)  ·  youtube.com/watch?v=oFDeNcu3mnc",
        "Radio (links only): Exclusive Radio  ·  0 N Radio  ·  SomaFM",
        "Radio bed in this video:  \"Cool Rock\" by Kevin MacLeod (incompetech.com)  ·  CC BY 4.0",
        "Voices: Piper  ·  License: MIT  ·  Copyright 2026 AdventureNLearn",
    ]
    y = 560
    for line in credits:
        center(d, line, y, f, (200, 200, 200))
        y += 40
    return im

def to_mp4(im: Image.Image, dest: Path, seconds: float, audio: Path | None):
    OUT.mkdir(parents=True, exist_ok=True)
    png = dest.with_suffix(".png")
    im.save(png, quality=95)
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-t", str(seconds), "-i", str(png),
    ]
    if audio and audio.exists():
        cmd += ["-stream_loop", "-1", "-i", str(audio),
                "-af", "volume=0.12,afade=t=in:st=0:d=0.6,afade=t=out:st=%.2f:d=0.8" % max(0, seconds - 0.8),
                "-shortest"]
    else:
        cmd += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-shortest"]
    cmd += [
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-crf", "16",
        "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k",
        "-t", str(seconds), str(dest),
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("wrote", dest, seconds, "s")

def main():
    amb = PACK / "sfx" / "ambience-ship.wav"
    to_mp4(title_img(), OUT / "title-card.mp4", 5.0, amb)
    to_mp4(end_img(), OUT / "end-card.mp4", 7.0, amb)

if __name__ == "__main__":
    main()
