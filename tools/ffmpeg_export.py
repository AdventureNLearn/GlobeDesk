#!/usr/bin/env python3
"""Optional local MP4 transcode with the ffmpeg already installed on this PC.

Used by tools/serve.py at /api/export/mp4 only when the browser cannot encode
H.264 + AAC itself. The command line is fixed: no caller-supplied flags, file
names or codecs. Input and output live in a private temp folder that is always
removed. Size cap and timeout stop a runaway encode. FFmpeg is not shipped with
GlobeDesk; a typical H.264 build is GPL (libx264), so it is used in place only.
"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

MAX_INPUT_BYTES = 2 * 1024 * 1024 * 1024  # 2 GiB, plan cap
MAX_OUTPUT_BYTES = 2 * 1024 * 1024 * 1024
TIMEOUT_SEC = 30 * 60
READ_TIMEOUT_SEC = 60  # a stalled upload is dropped after this many seconds without data
CHUNK = 1024 * 1024


def find_ffmpeg() -> str | None:
    return shutil.which("ffmpeg")


def fixed_argv(ffmpeg: str, src: Path, dst: Path) -> list[str]:
    """The only command this module runs. Paths are ours, inside a fresh temp folder."""
    return [
        ffmpeg, "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
        "-i", str(src),
        "-map", "0:v:0", "-map", "0:a:0?",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k",
        "-movflags", "+faststart",
        str(dst),
    ]


class ExportError(Exception):
    pass


def transcode_stream(read, length: int, ffmpeg: str | None = None, runner=subprocess.run, write=None, start=None):
    """Read `length` bytes of WebM from `read(n)` and transcode to MP4.

    With `write` (and optional `start(size)`), the MP4 is streamed from the temp file in
    chunks and the byte count is returned, so the output is never held in memory.
    Without `write`, the MP4 bytes are returned (tests and small files)."""
    exe = ffmpeg or find_ffmpeg()
    if not exe:
        raise ExportError("ffmpeg is not installed on this device")
    if length <= 0 or length > MAX_INPUT_BYTES:
        raise ExportError("input is empty or over the 2 GiB cap")
    with tempfile.TemporaryDirectory(prefix="globedesk-mp4-") as td:
        src = Path(td) / "in.webm"
        dst = Path(td) / "out.mp4"
        left = length
        with open(src, "wb") as f:
            while left > 0:
                try:
                    buf = read(min(CHUNK, left))
                except (TimeoutError, OSError):
                    raise ExportError("upload stalled; nothing received for %d seconds" % READ_TIMEOUT_SEC)
                if not buf:
                    raise ExportError("upload ended early")
                f.write(buf)
                left -= len(buf)
        try:
            proc = runner(fixed_argv(exe, src, dst), capture_output=True, timeout=TIMEOUT_SEC)
        except subprocess.TimeoutExpired:
            raise ExportError("ffmpeg timed out")
        if proc.returncode != 0 or not dst.is_file():
            raise ExportError("ffmpeg failed")
        size = dst.stat().st_size
        if size <= 0 or size > MAX_OUTPUT_BYTES:
            raise ExportError("output is empty or over the 2 GiB cap")
        if write is None:
            return dst.read_bytes()
        if start is not None:
            start(size)
        with open(dst, "rb") as f:
            while True:
                buf = f.read(CHUNK)
                if not buf:
                    break
                write(buf)
        return size
