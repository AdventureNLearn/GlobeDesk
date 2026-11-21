#!/usr/bin/env python3
"""Local Blue Marble pack lookup and fallback: local MBTiles -> disk cache -> GIBS stream."""
from __future__ import annotations

import os
import sqlite3
import ssl
import time
import urllib.error
import urllib.request
from pathlib import Path

LAYER = "BlueMarble_ShadedRelief_Bathymetry"
TILEMATRIX = "GoogleMapsCompatible_Level8"
GIBS_TEMPLATE = (
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/"
    f"{LAYER}/default/{TILEMATRIX}/{{z}}/{{y}}/{{x}}.jpeg"
)
PACK_NAME = f"{LAYER}-z0-8.mbtiles"
MIN_ZOOM = 0
MAX_ZOOM = 8
USER_AGENT = "GlobeDesk/1.0 (local offline Blue Marble pack; personal use)"
DEFAULT_CACHE_MAX_BYTES = 256 * 1024 * 1024
CREDIT = (
    "Blue Marble (August 2004, Shaded Relief and Bathymetry) — "
    "NASA Earth Observatory / MODIS, public domain. Served locally or via NASA GIBS."
)


def expected_tile_count(min_zoom: int = MIN_ZOOM, max_zoom: int = MAX_ZOOM) -> int:
    """Inclusive Web Mercator tile count for zooms min..max: (4^(max+1) - 4^min) / 3."""
    return (4 ** (max_zoom + 1) - 4**min_zoom) // 3


def xyz_to_tms(z: int, y: int) -> int:
    return (1 << z) - 1 - y


def tms_to_xyz(z: int, tms_y: int) -> int:
    return (1 << z) - 1 - tms_y


def gibs_url(z: int, x: int, y: int) -> str:
    return GIBS_TEMPLATE.format(z=z, x=x, y=y)


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def data_dir(root: str | os.PathLike | None = None) -> Path:
    env = os.environ.get("GLOBEDESK_DATA") or os.environ.get("GOBEDESK_DATA")
    if env:
        return Path(env)
    base = Path(root).resolve() if root is not None else repo_root()
    return base / "globedesk-data"


def pack_path(base: str | os.PathLike | None = None) -> Path:
    return (Path(base) if base is not None else data_dir()) / "bluemarble" / PACK_NAME


def cache_dir(base: str | os.PathLike | None = None) -> Path:
    return (Path(base) if base is not None else data_dir()) / "cache" / "bluemarble"


def allow_stream() -> bool:
    if os.environ.get("GLOBEDESK_BLOCK_GIBS") == "1":
        return False
    if os.environ.get("GLOBEDESK_OFFLINE") == "1":
        return False
    return True


def _connect_ro(path: Path) -> sqlite3.Connection | None:
    if not path.is_file():
        return None
    uri = path.resolve().as_uri() + "?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.execute("PRAGMA query_only=ON")
    return conn


def get_pack_tile(path: Path, z: int, x: int, y: int) -> bytes | None:
    conn = _connect_ro(path)
    if conn is None:
        return None
    try:
        row = conn.execute(
            "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?",
            (z, x, xyz_to_tms(z, y)),
        ).fetchone()
        if not row or row[0] is None:
            return None
        data = bytes(row[0])
        return data or None
    finally:
        conn.close()


def pack_stats(path: Path) -> dict:
    info = {
        "present": False,
        "path": str(path),
        "tiles": 0,
        "bytes": 0,
        "minzoom": None,
        "maxzoom": None,
        "complete": False,
        "credit": CREDIT,
        "layer": LAYER,
    }
    if not path.is_file():
        return info
    info["bytes"] = path.stat().st_size
    conn = _connect_ro(path)
    if conn is None:
        return info
    try:
        n = conn.execute("SELECT COUNT(*) FROM tiles").fetchone()[0]
        zooms = conn.execute("SELECT MIN(zoom_level), MAX(zoom_level) FROM tiles").fetchone()
        info["present"] = n > 0
        info["tiles"] = int(n)
        info["minzoom"] = zooms[0]
        info["maxzoom"] = zooms[1]
        info["expected_tiles"] = expected_tile_count()
        info["complete"] = int(n) == info["expected_tiles"]
    finally:
        conn.close()
    return info


def cache_tile_path(base: Path, z: int, x: int, y: int) -> Path:
    return Path(base) / str(z) / str(x) / f"{y}.jpeg"


def cache_max_bytes() -> int:
    raw = os.environ.get("GLOBEDESK_CACHE_MAX_BYTES")
    if raw is not None and raw != "":
        try:
            n = int(raw)
            if n >= 0:
                return n
        except ValueError:
            pass
    return DEFAULT_CACHE_MAX_BYTES


def _cache_files(base: Path) -> list[Path]:
    if not Path(base).is_dir():
        return []
    return [p for p in Path(base).rglob("*") if p.is_file() and p.suffix != ".tmp"]


def cache_size_bytes(base: Path) -> int:
    total = 0
    for p in _cache_files(base):
        try:
            total += p.stat().st_size
        except OSError:
            pass
    return total


def enforce_cache_cap(base: Path, max_bytes: int | None = None) -> int:
    """Delete oldest cache files until total size is at most max_bytes. Returns bytes evicted."""
    cap = cache_max_bytes() if max_bytes is None else max_bytes
    base = Path(base)
    files = _cache_files(base)
    files.sort(key=lambda p: (p.stat().st_mtime, str(p)))
    total = 0
    sizes = {}
    kept_stat = []
    for p in files:
        try:
            st = p.stat()
        except OSError:
            continue
        sizes[p] = st.st_size
        total += st.st_size
        kept_stat.append(p)
    evicted = 0
    for p in kept_stat:
        if total <= cap:
            break
        try:
            sz = sizes.get(p, p.stat().st_size)
            p.unlink()
            total -= sz
            evicted += sz
        except OSError:
            pass
    return evicted


def get_cache_tile(base: Path, z: int, x: int, y: int) -> bytes | None:
    p = cache_tile_path(base, z, x, y)
    if not p.is_file():
        return None
    data = p.read_bytes()
    if data:
        try:
            os.utime(p, None)
        except OSError:
            pass
    return data or None


def put_cache_tile(base: Path, z: int, x: int, y: int, data: bytes, max_bytes: int | None = None) -> None:
    p = cache_tile_path(base, z, x, y)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".jpeg.tmp")
    tmp.write_bytes(data)
    tmp.replace(p)
    try:
        enforce_cache_cap(base, max_bytes)
    except OSError:
        pass


def fetch_gibs(z: int, x: int, y: int, timeout: float = 20.0) -> bytes:
    req = urllib.request.Request(gibs_url(z, x, y), headers={"User-Agent": USER_AGENT})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        data = resp.read()
        ctype = (resp.headers.get("Content-Type") or "").lower()
    if not data or "jpeg" not in ctype and not data.startswith(b"\xff\xd8"):
        raise ValueError(f"GIBS did not return a JPEG for {z}/{x}/{y}")
    return data


def resolve_tile(
    z: int,
    x: int,
    y: int,
    *,
    pack: Path | None = None,
    cache: Path | None = None,
    stream: bool | None = None,
    write_through: bool = True,
    fetcher=None,
) -> tuple[bytes | None, str]:
    """Return (data, source) with source in local, cache, stream, or miss."""
    if z < MIN_ZOOM or z > MAX_ZOOM:
        return None, "miss"
    n = 1 << z
    if x < 0 or y < 0 or x >= n or y >= n:
        return None, "miss"
    pack = pack if pack is not None else pack_path()
    cache = cache if cache is not None else cache_dir()
    data = get_pack_tile(pack, z, x, y)
    if data:
        return data, "local"
    data = get_cache_tile(cache, z, x, y)
    if data:
        return data, "cache"
    if stream is None:
        stream = allow_stream()
    if not stream:
        return None, "miss"
    get = fetcher or fetch_gibs
    data = get(z, x, y)
    if not data:
        return None, "miss"
    if write_through:
        try:
            put_cache_tile(cache, z, x, y, data)
        except OSError:
            pass
    return data, "stream"


def packs_status(root: str | os.PathLike | None = None) -> dict:
    base = data_dir(root)
    st = pack_stats(pack_path(base))
    st["dataDir"] = str(base)
    st["cacheDir"] = str(cache_dir(base))
    st["proxy"] = "/tiles/bluemarble/{z}/{x}/{y}.jpeg"
    st["fallback"] = ["local", "cache", "gibs"]
    st["streamAllowed"] = allow_stream()
    return {"bluemarble": st}
