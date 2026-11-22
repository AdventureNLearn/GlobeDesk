"""A quiet empty tile so a pack miss does not 404 and flood the browser console."""
from __future__ import annotations

import struct
import zlib

def rgba_png(width: int, height: int, rgba: tuple[int, int, int, int] = (0, 0, 0, 0)) -> bytes:
    raw = b"".join(b"\x00" + bytes(rgba) * width for _ in range(height))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


EMPTY_TILE_PNG = rgba_png(256, 256)
