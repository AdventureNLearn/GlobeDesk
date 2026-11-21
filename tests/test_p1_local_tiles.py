#!/usr/bin/env python3
"""P1 unit tests: tile counts, TMS flip, fallback local -> cache -> stream."""
from __future__ import annotations

import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))

import local_tiles as T  # noqa: E402


JPEG = b"\xff\xd8\xff\xd9fake-jpeg-bytes"


def write_mbtiles(path: Path, tiles: list[tuple[int, int, int, bytes]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.execute("CREATE TABLE metadata (name text, value text)")
    conn.execute(
        "CREATE TABLE tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob)"
    )
    conn.execute("CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row)")
    conn.executemany(
        "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?,?,?,?)",
        [(z, x, T.xyz_to_tms(z, y), data) for z, x, y, data in tiles],
    )
    conn.commit()
    conn.close()


class TileMath(unittest.TestCase):
    def test_expected_count_z0_8(self):
        self.assertEqual(T.expected_tile_count(0, 8), 87381)
        self.assertEqual(T.expected_tile_count(), 87381)

    def test_tms_roundtrip(self):
        for z, y in ((0, 0), (1, 0), (1, 1), (8, 0), (8, 255), (8, 127)):
            self.assertEqual(T.tms_to_xyz(z, T.xyz_to_tms(z, y)), y)

    def test_gibs_url_uses_z_y_x(self):
        url = T.gibs_url(3, 2, 1)
        self.assertIn("/3/1/2.jpeg", url)
        self.assertIn("BlueMarble_ShadedRelief_Bathymetry", url)


class Fallback(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)
        self.pack = self.base / "bluemarble" / T.PACK_NAME
        self.cache = self.base / "cache" / "bluemarble"

    def tearDown(self):
        self.tmp.cleanup()

    def test_local_wins_over_cache_and_stream(self):
        write_mbtiles(self.pack, [(1, 0, 1, b"LOCAL")])
        T.put_cache_tile(self.cache, 1, 0, 1, b"CACHE")
        calls = []

        def fetcher(z, x, y):
            calls.append((z, x, y))
            return b"STREAM"

        data, source = T.resolve_tile(1, 0, 1, pack=self.pack, cache=self.cache, fetcher=fetcher)
        self.assertEqual(data, b"LOCAL")
        self.assertEqual(source, "local")
        self.assertEqual(calls, [])

    def test_cache_used_when_pack_misses(self):
        write_mbtiles(self.pack, [(0, 0, 0, b"OTHER")])
        T.put_cache_tile(self.cache, 2, 1, 1, b"CACHE")
        data, source = T.resolve_tile(2, 1, 1, pack=self.pack, cache=self.cache, fetcher=lambda *a: b"STREAM")
        self.assertEqual(data, b"CACHE")
        self.assertEqual(source, "cache")

    def test_stream_and_write_through(self):
        write_mbtiles(self.pack, [])
        data, source = T.resolve_tile(
            3, 4, 5, pack=self.pack, cache=self.cache, stream=True,
            write_through=True, fetcher=lambda z, x, y: JPEG,
        )
        self.assertEqual(source, "stream")
        self.assertEqual(data, JPEG)
        self.assertEqual(T.get_cache_tile(self.cache, 3, 4, 5), JPEG)

    def test_blocked_stream_is_a_miss(self):
        write_mbtiles(self.pack, [])
        data, source = T.resolve_tile(
            1, 0, 0, pack=self.pack, cache=self.cache, stream=False,
            fetcher=lambda *a: (_ for _ in ()).throw(RuntimeError("should not stream")),
        )
        self.assertIsNone(data)
        self.assertEqual(source, "miss")

    def test_out_of_range_is_miss(self):
        data, source = T.resolve_tile(9, 0, 0, pack=self.pack, cache=self.cache, stream=False)
        self.assertEqual(source, "miss")
        data, source = T.resolve_tile(1, 2, 0, pack=self.pack, cache=self.cache, stream=False)
        self.assertEqual(source, "miss")

    def test_pack_stats_complete_flag(self):
        write_mbtiles(self.pack, [(0, 0, 0, JPEG)])
        st = T.pack_stats(self.pack)
        self.assertTrue(st["present"])
        self.assertEqual(st["tiles"], 1)
        self.assertFalse(st["complete"])
        self.assertEqual(st["expected_tiles"], 87381)


    def test_missing_pack(self):
        st = T.pack_stats(self.pack)
        self.assertFalse(st["present"])
        self.assertEqual(st["tiles"], 0)


class DataDir(unittest.TestCase):
    def setUp(self):
        self._env = {k: os.environ.get(k) for k in ("GLOBEDESK_DATA", "GOBEDESK_DATA", "GLOBEDESK_CACHE_MAX_BYTES")}
        for k in self._env:
            os.environ.pop(k, None)

    def tearDown(self):
        for k, v in self._env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_default_is_repo_globedesk_data(self):
        self.assertEqual(T.data_dir(ROOT), ROOT / "globedesk-data")
        self.assertEqual(T.data_dir(), ROOT / "globedesk-data")

    def test_env_overrides(self):
        os.environ["GLOBEDESK_DATA"] = "/tmp/gd-custom-data"
        self.assertEqual(T.data_dir(ROOT), Path("/tmp/gd-custom-data"))
        self.assertEqual(T.data_dir(), Path("/tmp/gd-custom-data"))


class CacheCap(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cache = Path(self.tmp.name) / "cache" / "bluemarble"
        self._prev = os.environ.get("GLOBEDESK_CACHE_MAX_BYTES")
        os.environ.pop("GLOBEDESK_CACHE_MAX_BYTES", None)

    def tearDown(self):
        self.tmp.cleanup()
        if self._prev is None:
            os.environ.pop("GLOBEDESK_CACHE_MAX_BYTES", None)
        else:
            os.environ["GLOBEDESK_CACHE_MAX_BYTES"] = self._prev

    def test_evicts_oldest_when_over_cap(self):
        T.put_cache_tile(self.cache, 0, 0, 0, b"A" * 100, max_bytes=10_000)
        T.put_cache_tile(self.cache, 1, 0, 0, b"B" * 100, max_bytes=10_000)
        # Make the first tile strictly older.
        p0 = T.cache_tile_path(self.cache, 0, 0, 0)
        p1 = T.cache_tile_path(self.cache, 1, 0, 0)
        os.utime(p0, (1, 1))
        os.utime(p1, (2, 2))
        T.put_cache_tile(self.cache, 2, 0, 0, b"C" * 100, max_bytes=250)
        self.assertIsNone(T.get_cache_tile(self.cache, 0, 0, 0))
        self.assertEqual(T.get_cache_tile(self.cache, 1, 0, 0), b"B" * 100)
        self.assertEqual(T.get_cache_tile(self.cache, 2, 0, 0), b"C" * 100)
        self.assertLessEqual(T.cache_size_bytes(self.cache), 250)

    def test_env_cap_zero_evicts_all(self):
        os.environ["GLOBEDESK_CACHE_MAX_BYTES"] = "0"
        T.put_cache_tile(self.cache, 0, 0, 0, b"X" * 50)
        self.assertIsNone(T.get_cache_tile(self.cache, 0, 0, 0))
        self.assertEqual(T.cache_size_bytes(self.cache), 0)


if __name__ == "__main__":
    unittest.main()
