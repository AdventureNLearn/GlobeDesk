#!/usr/bin/env python3
"""Build a small offline demo-region MBTiles pack from EOX Sentinel-2 cloudless 2016.

Default region: downtown Washington, DC, used by the Washington, DC National Mall sample
(approximate pin 38.89, -77.01). Imagery is CC BY 4.0 (modified Copernicus
Sentinel data 2016). Do not use EOX 2018+ mosaics (those are not CC BY 4.0).

Default output: ./globedesk-data/regions/washington-dc/eox2016-s2cloudless-2016.mbtiles
(gitignored). Override the data parent with GLOBEDESK_DATA or pass --out.

Usage:
  python3 tools/fetch_region_pack.py --estimate
  python3 tools/fetch_region_pack.py
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
import time
import urllib.error
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

import local_tiles as T

DEFAULT_RPS = 4
DEFAULT_WORKERS = 2
USER_NOTE = (
    "Sentinel-2 cloudless 2016 by EOX IT Services GmbH "
    "(contains modified Copernicus Sentinel data 2016), CC BY 4.0."
)


def open_mbtiles(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("CREATE TABLE IF NOT EXISTS metadata (name text, value text)")
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tiles "
        "(zoom_level integer, tile_column integer, tile_row integer, tile_data blob)"
    )
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS tile_index ON tiles (zoom_level, tile_column, tile_row)"
    )
    conn.commit()
    return conn


def write_metadata(conn: sqlite3.Connection, spec: dict) -> None:
    west, south, east, north = spec["bbox"]
    lat = (south + north) / 2
    lon = (west + east) / 2
    meta = {
        "name": f"GlobeDesk demo region: {spec['label']} (EOX 2016)",
        "format": "jpg",
        "minzoom": str(spec["minzoom"]),
        "maxzoom": str(spec["maxzoom"]),
        "bounds": f"{west},{south},{east},{north}",
        "center": f"{lon},{lat},12",
        "attribution": USER_NOTE,
        "description": (
            f"{spec['story']}. Source: {spec['source']}. License: {spec['license']}. "
            "Bbox is approximate downtown / National Mall coverage."
        ),
        "type": "baselayer",
        "scheme": "tms",
        "version": "1.0.0",
        "region": spec["id"],
    }
    conn.execute("DELETE FROM metadata")
    conn.executemany("INSERT INTO metadata (name, value) VALUES (?, ?)", list(meta.items()))
    conn.commit()


def existing_keys(conn: sqlite3.Connection) -> set[tuple[int, int, int]]:
    rows = conn.execute("SELECT zoom_level, tile_column, tile_row FROM tiles")
    return {(z, x, T.tms_to_xyz(z, tms_y)) for z, x, tms_y in rows}


def fetch_one(z: int, x: int, y: int, retries: int = 4) -> bytes:
    delay = 1.0
    last = None
    for attempt in range(retries):
        try:
            return T.fetch_eox(z, x, y)
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(delay)
                delay = min(delay * 2, 30)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ValueError) as e:
            last = e
            if attempt < retries - 1:
                time.sleep(delay)
                delay = min(delay * 2, 30)
                continue
            raise
    raise last  # type: ignore[misc]


def main() -> None:
    spec = T.REGION_WASHINGTON_DC
    p = argparse.ArgumentParser(description="Fetch the GlobeDesk Washington, DC EOX 2016 demo-region pack.")
    p.add_argument("--out", type=Path, default=None, help="Directory for the .mbtiles file (created if needed).")
    p.add_argument("--estimate", action="store_true", help="List tile counts and stop.")
    p.add_argument("--rps", type=float, default=DEFAULT_RPS, help="Max requests per second (default 4).")
    p.add_argument("--force", action="store_true", help="Fetch even if a complete pack is already present.")
    args = p.parse_args()

    tiles = T.tiles_for_bbox(spec["bbox"], spec["minzoom"], spec["maxzoom"])
    dest = args.out or (T.region_dir(None, spec["id"]))
    dest = dest.resolve()
    mbtiles = dest / spec["packName"]

    if args.estimate:
        print(json_estimate(spec, tiles, mbtiles))
        return

    if mbtiles.is_file() and not args.force:
        st = T.pack_stats(mbtiles)
        if st.get("tiles") == len(tiles):
            print(f"already complete: {mbtiles} ({st['tiles']} tiles, {st['bytes']} bytes)")
            return

    dest.mkdir(parents=True, exist_ok=True)
    conn = open_mbtiles(mbtiles)
    write_metadata(conn, spec)
    have = existing_keys(conn)
    todo = [t for t in tiles if t not in have]
    print(f"fetching {len(todo)} of {len(tiles)} tiles into {mbtiles} (already have {len(have)})", flush=True)
    gap = 1.0 / max(args.rps, 0.1)
    last = 0.0
    got = 0
    errors = 0
    t0 = time.time()
    for z, x, y in todo:
        wait = gap - (time.time() - last)
        if wait > 0:
            time.sleep(wait)
        last = time.time()
        try:
            data = fetch_one(z, x, y)
        except Exception as e:
            errors += 1
            print(f"FAIL {z}/{x}/{y}: {e}", file=sys.stderr, flush=True)
            continue
        conn.execute(
            "INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)",
            (z, x, T.xyz_to_tms(z, y), data),
        )
        got += 1
        if got % 25 == 0 or got == len(todo):
            conn.commit()
            print(f"  {got + len(have)}/{len(tiles)}", flush=True)
    conn.commit()
    write_metadata(conn, spec)
    conn.close()
    st = T.pack_stats(mbtiles)
    print(
        f"done in {time.time() - t0:.1f}s: {st['tiles']} tiles, {st['bytes']} bytes, "
        f"errors={errors}, path={mbtiles}"
    )
    if errors:
        sys.exit(2)


def json_estimate(spec, tiles, mbtiles) -> str:
    import json
    by_zoom = {}
    for z, x, y in tiles:
        by_zoom[z] = by_zoom.get(z, 0) + 1
    return json.dumps({
        "region": spec["id"],
        "label": spec["label"],
        "bbox": spec["bbox"],
        "source": spec["source"],
        "license": spec["license"],
        "story": spec["story"],
        "tiles": len(tiles),
        "byZoom": by_zoom,
        "out": str(mbtiles),
        "credit": USER_NOTE,
    }, indent=2)


if __name__ == "__main__":
    main()
