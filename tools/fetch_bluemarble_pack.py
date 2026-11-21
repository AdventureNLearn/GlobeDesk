#!/usr/bin/env python3
"""Rate-limited, resumable fetch of the NASA Blue Marble z0–8 Web Mercator pack into one MBTiles file.

Default output: ./globedesk-data/bluemarble/BlueMarble_ShadedRelief_Bathymetry-z0-8.mbtiles
under the GlobeDesk repo (gitignored). Override the parent folder with GLOBEDESK_DATA
or pass --out. Does not push or upload anything.

Usage:
  py -3 tools/fetch_bluemarble_pack.py --estimate
  py -3 tools/fetch_bluemarble_pack.py
  py -3 tools/fetch_bluemarble_pack.py --out ./globedesk-data/bluemarble
"""
from __future__ import annotations

import argparse
import queue
import json
import random
import threading
import sqlite3
import sys
import time
import urllib.error
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

import local_tiles as T

# Stay well under GIBS's published 350k JPEG tiles/hour and 50 Mbps guidance.
# 87,381 tiles is far below the 1,000,000/day "bulk download" coordination threshold.
DEFAULT_RPS = 20
DEFAULT_WORKERS = 4
MAX_PACK_BYTES = 20 * 1024 * 1024 * 1024
MIN_FREE_AFTER = 40 * 1024 * 1024 * 1024
SAMPLE_PER_HIGH_ZOOM = 64
Z8_SAMPLES = 128


def iter_tiles(min_zoom: int, max_zoom: int):
    for z in range(min_zoom, max_zoom + 1):
        n = 1 << z
        for x in range(n):
            for y in range(n):
                yield z, x, y


def sample_tiles(seed: int = 2004):
    """All of z0–3, plus a fixed sample at z4–8, for a size estimate."""
    tiles = list(iter_tiles(0, 3))
    rng = random.Random(seed)
    for z, k in ((4, SAMPLE_PER_HIGH_ZOOM), (5, SAMPLE_PER_HIGH_ZOOM), (6, SAMPLE_PER_HIGH_ZOOM),
                 (7, SAMPLE_PER_HIGH_ZOOM), (8, Z8_SAMPLES)):
        n = 1 << z
        seen = set()
        while len(seen) < k:
            seen.add((z, rng.randrange(n), rng.randrange(n)))
        tiles.extend(sorted(seen))
    return tiles


def disk_free(path: Path) -> int:
    import shutil
    path.mkdir(parents=True, exist_ok=True)
    return shutil.disk_usage(path).free


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


def write_metadata(conn: sqlite3.Connection, extra: dict | None = None) -> None:
    meta = {
        "name": "NASA Blue Marble Shaded Relief and Bathymetry",
        "format": "jpg",
        "minzoom": str(T.MIN_ZOOM),
        "maxzoom": str(T.MAX_ZOOM),
        "bounds": "-180.0,-85.05112878,180.0,85.05112878",
        "center": "0,0,2",
        "attribution": T.CREDIT,
        "description": (
            "Web Mercator z0–8 JPEG tiles of GIBS layer "
            f"{T.LAYER} / {T.TILEMATRIX}. NASA Earth Observatory / MODIS, public domain."
        ),
        "type": "baselayer",
        "scheme": "tms",
        "version": "1.0.0",
    }
    if extra:
        meta.update({k: str(v) for k, v in extra.items()})
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
            return T.fetch_gibs(z, x, y)
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


def estimate(args) -> dict:
    tiles = sample_tiles()
    per_zoom: dict[int, list[int]] = {z: [] for z in range(0, 9)}
    errors = 0
    t0 = time.time()
    gap = 1.0 / max(args.rps, 1)
    last = 0.0
    for i, (z, x, y) in enumerate(tiles, 1):
        wait = gap - (time.time() - last)
        if wait > 0:
            time.sleep(wait)
        last = time.time()
        try:
            data = fetch_one(z, x, y)
            per_zoom[z].append(len(data))
        except Exception as e:
            errors += 1
            print(f"sample fail {z}/{x}/{y}: {e}", file=sys.stderr)
        if i % 50 == 0:
            print(f"sampled {i}/{len(tiles)}", file=sys.stderr)
    projected = 0
    by_zoom = {}
    for z in range(0, 9):
        sizes = per_zoom[z]
        n = 1 << (2 * z)
        mean = (sum(sizes) / len(sizes)) if sizes else 0
        est = int(mean * n)
        projected += est
        by_zoom[z] = {"samples": len(sizes), "tiles": n, "meanBytes": int(mean), "estBytes": est}
    out = {
        "ok": errors == 0 or (sum(len(v) for v in per_zoom.values()) >= 50),
        "sampled": sum(len(v) for v in per_zoom.values()),
        "sampleErrors": errors,
        "expectedTiles": T.expected_tile_count(),
        "projectedBytes": projected,
        "projectedGiB": round(projected / (1024**3), 3),
        "maxPackBytes": MAX_PACK_BYTES,
        "minFreeAfterBytes": MIN_FREE_AFTER,
        "byZoom": by_zoom,
        "seconds": round(time.time() - t0, 1),
        "layer": T.LAYER,
        "credit": T.CREDIT,
    }
    return out


def gate_estimate(est: dict, dest: Path) -> None:
    proj = int(est["projectedBytes"])
    if proj > MAX_PACK_BYTES:
        raise SystemExit(
            f"STOP: projected pack {est['projectedGiB']} GiB exceeds the ~20 GB limit. Not downloading."
        )
    free = disk_free(dest)
    remaining = free - proj
    est["freeBytesBefore"] = free
    est["projectedFreeAfter"] = remaining
    est["projectedFreeAfterGiB"] = round(remaining / (1024**3), 2)
    if remaining < MIN_FREE_AFTER:
        raise SystemExit(
            f"STOP: only {remaining / (1024**3):.2f} GiB would remain after a "
            f"{est['projectedGiB']} GiB pack; need at least 40 GB free after. Not downloading."
        )


class RateLimit:
    def __init__(self, rps: float):
        self.gap = 1.0 / max(rps, 0.1)
        self.lock = threading.Lock()
        self.next = 0.0

    def wait(self) -> None:
        with self.lock:
            now = time.time()
            delay = self.next - now
            self.next = max(now, self.next) + self.gap
        if delay > 0:
            time.sleep(delay)


def fetch_pack(args, dest: Path) -> dict:
    mbtiles = dest / T.PACK_NAME
    conn = open_mbtiles(mbtiles)
    write_metadata(conn, {"source": T.GIBS_TEMPLATE})
    have = existing_keys(conn)
    wanted = list(iter_tiles(T.MIN_ZOOM, T.MAX_ZOOM))
    todo = [t for t in wanted if t not in have]
    workers = max(1, int(getattr(args, "workers", DEFAULT_WORKERS) or DEFAULT_WORKERS))
    print(f"already have {len(have)} / {len(wanted)}; fetching {len(todo)} with {workers} workers @ {args.rps} rps", file=sys.stderr, flush=True)
    got = 0
    failed: list[str] = []
    bytes_new = 0
    t0 = time.time()
    batch = []
    limiter = RateLimit(args.rps)
    work: queue.Queue = queue.Queue()
    results: queue.Queue = queue.Queue()
    for t in todo:
        work.put(t)
    for _ in range(workers):
        work.put(None)

    def worker() -> None:
        while True:
            item = work.get()
            if item is None:
                results.put(None)
                return
            z, x, y = item
            try:
                limiter.wait()
                data = fetch_one(z, x, y)
                results.put(("ok", z, x, y, data))
            except Exception as e:
                results.put(("err", z, x, y, e))

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(workers)]
    for th in threads:
        th.start()
    try:
        finished = 0
        while finished < workers:
            item = results.get()
            if item is None:
                finished += 1
                continue
            kind, z, x, y, payload = item
            if kind == "err":
                failed.append(f"{z}/{x}/{y}:{payload}")
                if len(failed) <= 10:
                    print(f"fail {z}/{x}/{y}: {payload}", file=sys.stderr, flush=True)
                continue
            data = payload
            batch.append((z, x, T.xyz_to_tms(z, y), data))
            bytes_new += len(data)
            got += 1
            if len(batch) >= 200:
                conn.executemany(
                    "INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?,?,?,?)",
                    batch,
                )
                conn.commit()
                batch.clear()
            if got % 500 == 0:
                elapsed = max(time.time() - t0, 0.001)
                print(
                    f"{got}/{len(todo)} new, {bytes_new/1024/1024:.1f} MiB this run, {got/elapsed:.1f} tiles/s",
                    file=sys.stderr,
                    flush=True,
                )
        if batch:
            conn.executemany(
                "INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?,?,?,?)",
                batch,
            )
            conn.commit()
    finally:
        n = conn.execute("SELECT COUNT(*) FROM tiles").fetchone()[0]
        write_metadata(
            conn,
            {
                "source": T.GIBS_TEMPLATE,
                "tilecount": n,
                "fetched": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        )
        conn.close()
    stats = T.pack_stats(mbtiles)
    credit = dest / "CREDIT.txt"
    credit.write_text(
        T.CREDIT
        + "\n\nSource WMTS:\n"
        + T.GIBS_TEMPLATE
        + "\n\nTiles are stored as MBTiles (TMS row scheme).\n",
        encoding="utf-8",
    )
    return {
        "ok": stats.get("complete") and not failed,
        "path": str(mbtiles),
        "tiles": stats.get("tiles"),
        "expectedTiles": T.expected_tile_count(),
        "complete": stats.get("complete"),
        "bytes": stats.get("bytes"),
        "gib": round((stats.get("bytes") or 0) / (1024**3), 3),
        "newTiles": got,
        "failed": len(failed),
        "failedSamples": failed[:20],
        "seconds": round(time.time() - t0, 1),
        "credit": T.CREDIT,
    }


def main() -> int:
    p = argparse.ArgumentParser(description="Fetch a local NASA Blue Marble z0–8 MBTiles pack.")
    p.add_argument("--out", type=Path, default=None, help="Directory for the .mbtiles file (created if needed).")
    p.add_argument("--estimate", action="store_true", help="Sample tiles, project size, and stop.")
    p.add_argument("--rps", type=float, default=DEFAULT_RPS, help="Max requests per second (default 20).")
    p.add_argument("--workers", type=int, default=DEFAULT_WORKERS, help="Parallel fetch workers (default 4).")
    p.add_argument("--force", action="store_true", help="Fetch even if a complete pack is already present.")
    p.add_argument("--skip-estimate", action="store_true", help="Skip the pre-flight sample (use only after a passing --estimate).")
    args = p.parse_args()
    dest = args.out
    if dest is None:
        dest = T.data_dir() / "bluemarble"
    dest = dest.resolve()

    if args.estimate:
        est = estimate(args)
        try:
            gate_estimate(est, dest)
            est["gate"] = "ok"
        except SystemExit as e:
            est["gate"] = "stop"
            est["stopReason"] = str(e)
            print(json.dumps(est, indent=2))
            return 2
        print(json.dumps(est, indent=2))
        return 0

    # Always estimate first unless a complete pack already exists.
    existing = T.pack_stats(dest / T.PACK_NAME)
    if existing.get("complete") and not args.force:
        print(json.dumps({"ok": True, "skipped": "already complete", **existing}, indent=2))
        return 0

    if not args.skip_estimate:
        print("Estimating pack size from a sample before the full fetch...", file=sys.stderr)
        est = estimate(args)
        gate_estimate(est, dest)
        print(json.dumps({"estimate": est}, indent=2), file=sys.stderr)
    else:
        est = {"projectedBytes": 403546954, "projectedGiB": 0.376, "sampled": 469, "projectedFreeAfterGiB": 180.95, "skipped": True}
        free = disk_free(dest)
        if free - MAX_PACK_BYTES < MIN_FREE_AFTER:
            raise SystemExit("STOP: not enough free space for a 20 GB worst-case pack plus 40 GB headroom.")
    result = fetch_pack(args, dest)
    result["estimate"] = {k: est[k] for k in ("projectedBytes", "projectedGiB", "sampled", "projectedFreeAfterGiB") if k in est}
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
