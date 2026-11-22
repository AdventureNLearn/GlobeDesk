#!/usr/bin/env python3
"""Local pack lookup and fallback: local MBTiles -> disk cache -> upstream stream."""
from __future__ import annotations

import os
import sqlite3
import ssl
import urllib.error
import urllib.request
from pathlib import Path

import tile_cache

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


def allow_eox_stream() -> bool:
    if os.environ.get("GLOBEDESK_BLOCK_EOX") == "1":
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


def cache_root(base: str | os.PathLike | None = None) -> Path:
    return (Path(base) if base is not None else data_dir()) / "cache"


def cache_tile_path(base: Path, z: int, x: int, y: int) -> Path:
    return tile_cache.cache_tile_path(base, z, x, y, ".jpeg")


def cache_max_bytes():
    return tile_cache.cache_max_bytes()


def cache_size_bytes(base: Path) -> int:
    # `base` may be a per-source folder or the cache root.
    root = Path(base)
    if (root / "lru.sqlite").is_file() or root.name == "cache":
        return tile_cache.cache_size_bytes(root)
    return tile_cache.cache_size_bytes(tile_cache.cache_root_for(root))


def enforce_cache_cap(base: Path, max_bytes: int | None = None) -> int:
    root = Path(base)
    if not ((root / "lru.sqlite").is_file() or root.name == "cache"):
        root = tile_cache.cache_root_for(root)
    return tile_cache.evict_to_cap(root, max_bytes)


def get_cache_tile(base: Path, z: int, x: int, y: int) -> bytes | None:
    return tile_cache.get_cache_tile(base, z, x, y, ".jpeg")


def put_cache_tile(base: Path, z: int, x: int, y: int, data: bytes, max_bytes: int | None = None) -> None:
    tile_cache.put_cache_tile(base, z, x, y, data, max_bytes=max_bytes, suffix=".jpeg")


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
    st["proxy"] = "/tiles/bluemarble/{z}/{x}/{y}.jpeg"
    st["fallback"] = ["local", "cache", "gibs"]
    st["streamAllowed"] = allow_stream()
    cache = tile_cache.cache_status(cache_root(base))
    regions = []
    for spec in list_region_specs():
        regions.append(region_status(base, spec))
    return {
        "dataDir": str(base),
        "cacheDir": str(cache_root(base)),
        "cache": cache,
        "bluemarble": st,
        "regions": regions,
        "eoxProxy": "/tiles/eox2016/{z}/{x}/{y}.jpg",
    }


# --- EOX 2016 region pack (demo) ---
EOX_LAYER = "s2cloudless_3857"
EOX_TEMPLATE = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"
EOX_CREDIT = (
    "Sentinel-2 cloudless 2016 by EOX IT Services GmbH "
    "(contains modified Copernicus Sentinel data 2016), CC BY 4.0."
)
EOX_MIN_ZOOM = 0
EOX_MAX_ZOOM = 14
REGION_WASHINGTON_DC = {
    "id": "washington-dc",
    "label": "Washington, DC",
    "story": "Washington, DC National Mall sample (approx.) 38.89, -77.01",
    # west, south, east, north — downtown / National Mall core, approximate
    "bbox": [-77.12, 38.83, -76.94, 38.97],
    "minzoom": EOX_MIN_ZOOM,
    "maxzoom": EOX_MAX_ZOOM,
    "source": "EOX Sentinel-2 cloudless 2016 (s2cloudless_3857, Web Mercator)",
    "license": "CC BY 4.0 (contains modified Copernicus Sentinel data 2016)",
    "packName": "eox2016-s2cloudless-2016.mbtiles",
}


def list_region_specs() -> list[dict]:
    return [dict(REGION_WASHINGTON_DC)]


def region_dir(base: str | os.PathLike | None, region_id: str) -> Path:
    return (Path(base) if base is not None else data_dir()) / "regions" / region_id


def region_pack_path(base: str | os.PathLike | None, spec: dict | None = None) -> Path:
    spec = spec or REGION_WASHINGTON_DC
    return region_dir(base, spec["id"]) / spec["packName"]


def eox_url(z: int, x: int, y: int) -> str:
    return EOX_TEMPLATE.format(z=z, x=x, y=y)


def eox_cache_dir(base: str | os.PathLike | None = None) -> Path:
    return cache_root(base) / "eox2016"


def lonlat_to_tile(lon: float, lat: float, z: int) -> tuple[int, int]:
    import math
    lat = max(min(lat, 85.05112878), -85.05112878)
    n = 1 << z
    x = int((lon + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_rad) + (1.0 / math.cos(lat_rad))) / math.pi) / 2.0 * n)
    x = min(max(x, 0), n - 1)
    y = min(max(y, 0), n - 1)
    return x, y


def tiles_for_bbox(bbox: list[float], min_zoom: int, max_zoom: int) -> list[tuple[int, int, int]]:
    west, south, east, north = bbox
    if east < west:
        west, east = east, west
    if north < south:
        south, north = north, south
    out: list[tuple[int, int, int]] = []
    for z in range(min_zoom, max_zoom + 1):
        x0, y_south = lonlat_to_tile(west, south, z)
        x1, y_north = lonlat_to_tile(east, north, z)
        x_lo, x_hi = min(x0, x1), max(x0, x1)
        y_lo, y_hi = min(y_south, y_north), max(y_south, y_north)
        for x in range(x_lo, x_hi + 1):
            for y in range(y_lo, y_hi + 1):
                out.append((z, x, y))
    return out


def expected_region_tile_count(spec: dict | None = None) -> int:
    spec = spec or REGION_WASHINGTON_DC
    return len(tiles_for_bbox(spec["bbox"], spec["minzoom"], spec["maxzoom"]))


def region_status(base: str | os.PathLike | None, spec: dict | None = None) -> dict:
    spec = spec or REGION_WASHINGTON_DC
    path = region_pack_path(base, spec)
    st = pack_stats(path)
    st.update({
        "id": spec["id"],
        "label": spec["label"],
        "story": spec["story"],
        "bbox": list(spec["bbox"]),
        "source": spec["source"],
        "license": spec["license"],
        "credit": EOX_CREDIT,
        "layer": EOX_LAYER,
        "minzoom": spec["minzoom"],
        "maxzoom": spec["maxzoom"],
        "expected_tiles": expected_region_tile_count(spec),
        "proxy": "/tiles/eox2016/{z}/{x}/{y}.jpg",
        "complete": st.get("tiles", 0) == expected_region_tile_count(spec) and st.get("present"),
    })
    return st


def get_region_tile(base: str | os.PathLike | None, z: int, x: int, y: int) -> bytes | None:
    for spec in list_region_specs():
        if z < spec["minzoom"] or z > spec["maxzoom"]:
            continue
        data = get_pack_tile(region_pack_path(base, spec), z, x, y)
        if data:
            return data
    return None


def fetch_eox(z: int, x: int, y: int, timeout: float = 20.0) -> bytes:
    req = urllib.request.Request(eox_url(z, x, y), headers={"User-Agent": USER_AGENT})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        data = resp.read()
        ctype = (resp.headers.get("Content-Type") or "").lower()
    if not data or (("jpeg" not in ctype and "jpg" not in ctype) and not data.startswith(b"\xff\xd8")):
        raise ValueError(f"EOX did not return a JPEG for {z}/{x}/{y}")
    return data


def resolve_eox_tile(
    z: int,
    x: int,
    y: int,
    *,
    base: str | os.PathLike | None = None,
    stream: bool | None = None,
    write_through: bool = True,
    fetcher=None,
) -> tuple[bytes | None, str]:
    """Return (data, source) with source in local, cache, stream, or miss."""
    if z < EOX_MIN_ZOOM or z > EOX_MAX_ZOOM:
        return None, "miss"
    n = 1 << z
    if x < 0 or y < 0 or x >= n or y >= n:
        return None, "miss"
    data = get_region_tile(base, z, x, y)
    if data:
        return data, "local"
    cache = eox_cache_dir(base)
    data = tile_cache.get_cache_tile(cache, z, x, y, ".jpg")
    if data:
        return data, "cache"
    if stream is None:
        stream = allow_eox_stream()
    if not stream:
        return None, "miss"
    get = fetcher or fetch_eox
    data = get(z, x, y)
    if not data:
        return None, "miss"
    if write_through:
        try:
            tile_cache.put_cache_tile(cache, z, x, y, data, suffix=".jpg")
        except OSError:
            pass
    return data, "stream"
