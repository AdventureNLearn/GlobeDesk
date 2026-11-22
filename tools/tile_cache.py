#!/usr/bin/env python3
"""Shared visited-tile disk cache: SQLite LRU index, configurable cap, no per-write folder scan."""
from __future__ import annotations

import os
import sqlite3
import threading
import time
from pathlib import Path

# Plan default: 32 GiB LRU, configurable via GLOBEDESK_CACHE_MAX_BYTES.
DEFAULT_CACHE_MAX_BYTES = 32 * 1024 * 1024 * 1024
# Values at or above this are treated as no cap (same as "unlimited").
UNLIMITED_THRESHOLD_BYTES = 1024 * 1024 * 1024 * 1024  # 1 TiB
INDEX_NAME = "lru.sqlite"

_lock = threading.RLock()
_state: dict = {"conn": None, "root": None, "scans": 0}


def cache_max_bytes() -> int | None:
    """Return the cap in bytes, 0 if the cache is off, or None if uncapped.

    Env GLOBEDESK_CACHE_MAX_BYTES:
      unset / empty — 32 GiB (the default)
      0 — cache off (no reads, no writes; existing files are left in place)
      unlimited | none | nocap | no-cap — no cap
      an integer >= 1 TiB — no cap
      any other integer >= 0 — that many bytes
      anything else — the 32 GiB default
    """
    raw = os.environ.get("GLOBEDESK_CACHE_MAX_BYTES")
    if raw is None or str(raw).strip() == "":
        return DEFAULT_CACHE_MAX_BYTES
    s = str(raw).strip().lower()
    if s in ("unlimited", "none", "nocap", "no-cap"):
        return None
    try:
        n = int(s)
    except ValueError:
        return DEFAULT_CACHE_MAX_BYTES
    if n < 0:
        return DEFAULT_CACHE_MAX_BYTES
    if n >= UNLIMITED_THRESHOLD_BYTES:
        return None
    return n


def cache_enabled() -> bool:
    cap = cache_max_bytes()
    return cap != 0


def cache_uncapped() -> bool:
    return cache_max_bytes() is None


def _is_index_file(path: Path) -> bool:
    name = path.name
    return name == INDEX_NAME or name.startswith(INDEX_NAME + "-") or name.endswith("-journal") or name.endswith("-wal") or name.endswith("-shm")


def _rel_for(root: Path, path: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def index_path(cache_root: Path) -> Path:
    return Path(cache_root) / INDEX_NAME


def reset_index_state() -> None:
    """Close any open index. Used by tests."""
    with _lock:
        conn = _state.get("conn")
        if conn is not None:
            try:
                conn.close()
            except sqlite3.Error:
                pass
        _state["conn"] = None
        _state["root"] = None


def scan_count() -> int:
    return int(_state.get("scans") or 0)


def _connect(root: Path) -> sqlite3.Connection:
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    path = index_path(root)
    conn = sqlite3.connect(str(path), check_same_thread=False, timeout=10)
    conn.execute("PRAGMA journal_mode=DELETE")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tiles (rel TEXT PRIMARY KEY, size INTEGER NOT NULL, atime INTEGER NOT NULL)"
    )
    conn.execute("CREATE INDEX IF NOT EXISTS tiles_atime ON tiles(atime)")
    conn.execute("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)")
    conn.commit()
    return conn


def _total(conn: sqlite3.Connection) -> int:
    row = conn.execute("SELECT COALESCE(SUM(size), 0) FROM tiles").fetchone()
    return int(row[0] if row else 0)


def _needs_rebuild(conn: sqlite3.Connection, root: Path) -> bool:
    row = conn.execute("SELECT v FROM meta WHERE k='built'").fetchone()
    if not row:
        return True
    # Rebuild if the index is empty but tile files exist.
    n = conn.execute("SELECT COUNT(*) FROM tiles").fetchone()[0]
    if n == 0:
        for p in root.rglob("*"):
            if p.is_file() and not _is_index_file(p) and p.suffix != ".tmp":
                return True
    return False


def _rebuild(conn: sqlite3.Connection, root: Path) -> None:
    _state["scans"] = int(_state.get("scans") or 0) + 1
    conn.execute("DELETE FROM tiles")
    now = int(time.time())
    for p in root.rglob("*"):
        if not p.is_file() or _is_index_file(p) or p.suffix == ".tmp":
            continue
        try:
            st = p.stat()
            rel = _rel_for(root, p)
        except OSError:
            continue
        conn.execute(
            "INSERT INTO tiles (rel, size, atime) VALUES (?, ?, ?)",
            (rel, int(st.st_size), int(st.st_mtime or now)),
        )
    conn.execute("INSERT OR REPLACE INTO meta (k, v) VALUES ('built', '1')")
    conn.commit()


def open_index(cache_root: Path) -> sqlite3.Connection:
    root = Path(cache_root).resolve()
    with _lock:
        if _state["conn"] is not None and _state["root"] == root:
            return _state["conn"]
        if _state["conn"] is not None:
            try:
                _state["conn"].close()
            except sqlite3.Error:
                pass
            _state["conn"] = None
        conn = _connect(root)
        if _needs_rebuild(conn, root):
            _rebuild(conn, root)
        _state["conn"] = conn
        _state["root"] = root
        return conn


def cache_tile_path(source_dir: Path, z: int, x: int, y: int, suffix: str = ".jpeg") -> Path:
    ext = suffix if suffix.startswith(".") else f".{suffix}"
    return Path(source_dir) / str(z) / str(x) / f"{y}{ext}"


def cache_root_for(source_dir: Path) -> Path:
    """The LRU index lives in the parent of a per-source folder (…/cache/<source>)."""
    return Path(source_dir).resolve().parent


def cache_size_bytes(cache_root: Path) -> int:
    with _lock:
        conn = open_index(cache_root)
        return _total(conn)


def tile_count(cache_root: Path) -> int:
    with _lock:
        conn = open_index(cache_root)
        return int(conn.execute("SELECT COUNT(*) FROM tiles").fetchone()[0])


def touch(cache_root: Path, rel: str, size: int | None = None) -> None:
    now = int(time.time())
    with _lock:
        conn = open_index(cache_root)
        if size is None:
            conn.execute("UPDATE tiles SET atime=? WHERE rel=?", (now, rel))
        else:
            conn.execute(
                "INSERT INTO tiles (rel, size, atime) VALUES (?, ?, ?) "
                "ON CONFLICT(rel) DO UPDATE SET size=excluded.size, atime=excluded.atime",
                (rel, int(size), now),
            )
        conn.commit()


def evict_to_cap(cache_root: Path, max_bytes: int | None = None) -> int:
    cap = cache_max_bytes() if max_bytes is None else max_bytes
    if cap is None:
        return 0
    root = Path(cache_root)
    evicted = 0
    with _lock:
        conn = open_index(root)
        if cap <= 0:
            return 0
        total = _total(conn)
        if total <= cap:
            return 0
        rows = conn.execute("SELECT rel, size FROM tiles ORDER BY atime ASC, rel ASC").fetchall()
        for rel, size in rows:
            if total <= cap:
                break
            path = root / rel
            try:
                if path.is_file():
                    path.unlink()
            except OSError:
                pass
            conn.execute("DELETE FROM tiles WHERE rel=?", (rel,))
            total -= int(size or 0)
            evicted += int(size or 0)
        conn.commit()
    return evicted


def get_cache_tile(source_dir: Path, z: int, x: int, y: int, suffix: str = ".jpeg") -> bytes | None:
    if not cache_enabled():
        return None
    p = cache_tile_path(source_dir, z, x, y, suffix)
    if not p.is_file():
        # also try .jpg if .jpeg missed, and vice versa
        if suffix == ".jpeg":
            p = cache_tile_path(source_dir, z, x, y, ".jpg")
        elif suffix == ".jpg":
            p = cache_tile_path(source_dir, z, x, y, ".jpeg")
        if not p.is_file():
            return None
    try:
        data = p.read_bytes()
    except OSError:
        return None
    if not data:
        return None
    root = cache_root_for(source_dir)
    try:
        rel = _rel_for(root, p)
        touch(root, rel, size=len(data))
        os.utime(p, None)
    except OSError:
        pass
    return data


def put_cache_tile(
    source_dir: Path,
    z: int,
    x: int,
    y: int,
    data: bytes,
    max_bytes: int | None = None,
    suffix: str = ".jpeg",
) -> None:
    cap = cache_max_bytes() if max_bytes is None else max_bytes
    if cap == 0:
        return
    if not data:
        return
    p = cache_tile_path(source_dir, z, x, y, suffix)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(p)
    root = cache_root_for(source_dir)
    try:
        rel = _rel_for(root, p)
        touch(root, rel, size=len(data))
        evict_to_cap(root, cap)
    except OSError:
        pass


def clear_cache(cache_root: Path) -> int:
    """Delete cached tiles (not pack files). Returns bytes removed."""
    root = Path(cache_root)
    removed = 0
    with _lock:
        conn = open_index(root)
        rows = conn.execute("SELECT rel, size FROM tiles").fetchall()
        for rel, size in rows:
            path = root / rel
            try:
                if path.is_file():
                    path.unlink()
                    removed += int(size or 0)
            except OSError:
                pass
        conn.execute("DELETE FROM tiles")
        conn.execute("INSERT OR REPLACE INTO meta (k, v) VALUES ('built', '1')")
        conn.commit()
    return removed


def cache_status(cache_root: Path) -> dict:
    cap = cache_max_bytes()
    root = Path(cache_root)
    return {
        "enabled": cache_enabled(),
        "uncapped": cache_uncapped(),
        "capBytes": cap,
        "bytes": cache_size_bytes(root) if root.exists() or index_path(root).exists() else 0,
        "tiles": tile_count(root) if root.exists() or index_path(root).exists() else 0,
        "defaultCapBytes": DEFAULT_CACHE_MAX_BYTES,
    }
