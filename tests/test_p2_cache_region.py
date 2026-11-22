#!/usr/bin/env python3
"""P2 unit tests: LRU cache index, cap edge cases, Origin/Host check, region pack math."""
from __future__ import annotations

import os
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))

import local_tiles as T  # noqa: E402
import tile_cache  # noqa: E402
import tile_http  # noqa: E402


JPEG = b"\xff\xd8\xff\xd9fake-jpeg-bytes"


class EnvGuard(unittest.TestCase):
    ENV_KEYS = ("GLOBEDESK_CACHE_MAX_BYTES", "GLOBEDESK_DATA", "GOBEDESK_DATA",
                "GLOBEDESK_OFFLINE", "GLOBEDESK_BLOCK_EOX", "GLOBEDESK_BLOCK_GIBS")

    def setUp(self):
        self._env = {k: os.environ.get(k) for k in self.ENV_KEYS}
        for k in self.ENV_KEYS:
            os.environ.pop(k, None)
        tile_cache.reset_index_state()
        self.tmp = tempfile.TemporaryDirectory()
        self.cache = Path(self.tmp.name) / "cache" / "bluemarble"

    def tearDown(self):
        tile_cache.reset_index_state()
        self.tmp.cleanup()
        for k, v in self._env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


class CacheIndex(EnvGuard):
    def _set_atime(self, z, x, y, atime):
        root = tile_cache.cache_root_for(self.cache)
        p = T.cache_tile_path(self.cache, z, x, y)
        rel = p.resolve().relative_to(root.resolve()).as_posix()
        conn = tile_cache.open_index(root)
        conn.execute("UPDATE tiles SET atime=? WHERE rel=?", (int(atime), rel))
        conn.commit()

    def test_default_cap_is_32gib(self):
        self.assertEqual(tile_cache.cache_max_bytes(), 32 * 1024 * 1024 * 1024)
        self.assertTrue(tile_cache.cache_enabled())
        self.assertFalse(tile_cache.cache_uncapped())

    def test_zero_means_off_no_write(self):
        os.environ["GLOBEDESK_CACHE_MAX_BYTES"] = "0"
        T.put_cache_tile(self.cache, 0, 0, 0, b"X" * 50)
        self.assertIsNone(T.get_cache_tile(self.cache, 0, 0, 0))
        self.assertFalse(list(self.cache.rglob("*.jpeg")))

    def test_unlimited_and_huge_mean_no_cap(self):
        os.environ["GLOBEDESK_CACHE_MAX_BYTES"] = "unlimited"
        self.assertIsNone(tile_cache.cache_max_bytes())
        self.assertTrue(tile_cache.cache_uncapped())
        os.environ["GLOBEDESK_CACHE_MAX_BYTES"] = str(1024 * 1024 * 1024 * 1024)
        self.assertIsNone(tile_cache.cache_max_bytes())
        os.environ["GLOBEDESK_CACHE_MAX_BYTES"] = "none"
        self.assertIsNone(tile_cache.cache_max_bytes())
        # A huge cap should not evict a tiny write.
        os.environ["GLOBEDESK_CACHE_MAX_BYTES"] = str(10**18)
        T.put_cache_tile(self.cache, 0, 0, 0, b"Y" * 80)
        self.assertEqual(T.get_cache_tile(self.cache, 0, 0, 0), b"Y" * 80)

    def test_evicts_oldest_using_index(self):
        T.put_cache_tile(self.cache, 0, 0, 0, b"A" * 100, max_bytes=10_000)
        T.put_cache_tile(self.cache, 1, 0, 0, b"B" * 100, max_bytes=10_000)
        self._set_atime(0, 0, 0, 1)
        self._set_atime(1, 0, 0, 2)
        before = tile_cache.scan_count()
        T.put_cache_tile(self.cache, 2, 0, 0, b"C" * 100, max_bytes=250)
        self.assertEqual(tile_cache.scan_count(), before, "a write must not rescan the folder")
        self.assertIsNone(T.get_cache_tile(self.cache, 0, 0, 0))
        self.assertEqual(T.get_cache_tile(self.cache, 1, 0, 0), b"B" * 100)
        self.assertEqual(T.get_cache_tile(self.cache, 2, 0, 0), b"C" * 100)
        self.assertLessEqual(T.cache_size_bytes(self.cache), 250)

    def test_get_bumps_lru_and_second_write_does_not_scan(self):
        T.put_cache_tile(self.cache, 0, 0, 0, b"A" * 40, max_bytes=10_000)
        scans = tile_cache.scan_count()
        self.assertEqual(T.get_cache_tile(self.cache, 0, 0, 0), b"A" * 40)
        T.put_cache_tile(self.cache, 1, 0, 0, b"B" * 40, max_bytes=10_000)
        self.assertEqual(tile_cache.scan_count(), scans)


class OriginCheck(unittest.TestCase):
    def test_app_origin_and_referer_ok(self):
        port = 8080
        self.assertTrue(tile_http.request_from_app({"Host": "127.0.0.1:8080", "Origin": "http://127.0.0.1:8080"}, port))
        self.assertTrue(tile_http.request_from_app({"Host": "localhost:8080", "Referer": "http://localhost:8080/index.html?sample=1"}, port))
        self.assertFalse(tile_http.request_from_app({"Host": "127.0.0.1:8080", "Origin": "http://127.0.0.1:8206"}, port))
        self.assertFalse(tile_http.request_from_app({"Host": "127.0.0.1:8080"}, port), "no Origin/Referer is not the app")
        self.assertFalse(tile_http.request_from_app({"Host": "127.0.0.1:9090", "Origin": "http://127.0.0.1:9090"}, port))


class RegionMath(unittest.TestCase):
    def test_washington_dc_tile_count(self):
        self.assertEqual(T.expected_region_tile_count(), 131)
        tiles = T.tiles_for_bbox(T.REGION_WASHINGTON_DC["bbox"], 0, 14)
        self.assertEqual(len(tiles), 131)
        self.assertIn((14, 4684, 6266), tiles)

    def test_region_local_wins(self):
        tmp = tempfile.TemporaryDirectory()
        try:
            base = Path(tmp.name)
            pack = T.region_pack_path(base, T.REGION_WASHINGTON_DC)
            pack.parent.mkdir(parents=True, exist_ok=True)
            # write a one-tile mbtiles using the existing helper from P1 tests
            import sqlite3
            conn = sqlite3.connect(str(pack))
            conn.execute("CREATE TABLE metadata (name text, value text)")
            conn.execute("CREATE TABLE tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob)")
            z, x, y = 12, 1171, 1566
            conn.execute(
                "INSERT INTO tiles VALUES (?, ?, ?, ?)",
                (z, x, T.xyz_to_tms(z, y), b"LOCAL-DC"),
            )
            conn.commit()
            conn.close()
            calls = []
            data, source = T.resolve_eox_tile(
                z, x, y, base=base, stream=True, fetcher=lambda *a: calls.append(a) or b"STREAM",
            )
            self.assertEqual(data, b"LOCAL-DC")
            self.assertEqual(source, "local")
            self.assertEqual(calls, [])
        finally:
            tile_cache.reset_index_state()
            tmp.cleanup()

    def test_eox_stream_writes_cache_and_blocked_is_miss(self):
        tmp = tempfile.TemporaryDirectory()
        try:
            base = Path(tmp.name)
            data, source = T.resolve_eox_tile(
                3, 2, 1, base=base, stream=True, write_through=True, fetcher=lambda *a: JPEG,
            )
            self.assertEqual(source, "stream")
            self.assertEqual(data, JPEG)
            data2, source2 = T.resolve_eox_tile(
                3, 2, 1, base=base, stream=False,
                fetcher=lambda *a: (_ for _ in ()).throw(RuntimeError("no")),
            )
            self.assertEqual(source2, "cache")
            self.assertEqual(data2, JPEG)
            data3, source3 = T.resolve_eox_tile(4, 0, 0, base=base, stream=False)
            self.assertEqual(source3, "miss")
        finally:
            tile_cache.reset_index_state()
            tmp.cleanup()


class ServeOrigin(unittest.TestCase):
    def setUp(self):
        self._env = {k: os.environ.get(k) for k in ("GLOBEDESK_DATA", "GLOBEDESK_NO_BROWSER", "GLOBEDESK_PORT", "GLOBEDESK_OFFLINE")}
        os.environ["GLOBEDESK_NO_BROWSER"] = "1"
        os.environ["GLOBEDESK_OFFLINE"] = "1"
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["GLOBEDESK_DATA"] = self.tmp.name
        # Import a fresh serve module would be messy because PORT is set at import.
        # Drive the handler functions via a short live server by exec after setting argv.
        self.port = 18207
        os.environ["GLOBEDESK_PORT"] = str(self.port)

    def tearDown(self):
        self.tmp.cleanup()
        for k, v in self._env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_cross_origin_cannot_fill_cache(self):
        # Live server test is in the smoke helper; this checks the gate used by serve.py.
        headers_app = {"Host": "127.0.0.1:18207", "Origin": "http://127.0.0.1:18207"}
        headers_other = {"Host": "127.0.0.1:18207", "Origin": "http://127.0.0.1:9"}
        self.assertTrue(tile_http.request_from_app(headers_app, 18207))
        self.assertFalse(tile_http.request_from_app(headers_other, 18207))


if __name__ == "__main__":
    unittest.main()
