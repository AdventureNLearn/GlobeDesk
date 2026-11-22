#!/usr/bin/env python3
"""P3 unit tests: command validation, Origin/Host gate, bus timeout, tool list."""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))

import command_api as C  # noqa: E402
import tile_http  # noqa: E402


class CommandValidate(unittest.TestCase):
    def setUp(self):
        C.reset_for_tests()

    def test_owner_commands_are_listed(self):
        names = C.command_names()
        for cmd in C.OWNER_COMMANDS:
            self.assertIn(cmd, names)
        tools = C.tools_payload()
        self.assertEqual(tools["schema"], "globedesk.commands/1")
        self.assertEqual([t["name"] for t in tools["tools"]], names)

    def test_flyto_ok_and_unknown_rejected(self):
        ok, err, n = C.validate_command({"cmd": "flyTo", "lat": 38.89, "lon": -77.01, "zoom": 13})
        self.assertTrue(ok, err)
        self.assertEqual(n["cmd"], "flyTo")
        self.assertEqual(n["args"]["lat"], 38.89)
        ok, err, n = C.validate_command({"cmd": "eval", "code": "1+1"})
        self.assertFalse(ok)
        self.assertIn("unknown command", err)
        self.assertIsNone(n)

    def test_ranges_and_missing_args(self):
        ok, err, _ = C.validate_command({"cmd": "flyTo", "lat": 100, "lon": 0})
        self.assertFalse(ok)
        self.assertIn("lat", err)
        ok, err, _ = C.validate_command({"cmd": "flyTo", "lat": 38.89})
        self.assertFalse(ok)
        self.assertIn("lon", err)
        ok, err, _ = C.validate_command({"cmd": "zoom"})
        self.assertFalse(ok)
        ok, err, n = C.validate_command({"cmd": "zoom", "by": -1.5})
        self.assertTrue(ok, err)
        ok, err, _ = C.validate_command({"cmd": "openCard", "id": "card-capitol", "extra": 1})
        self.assertFalse(ok)
        self.assertIn("unknown field", err)

    def test_list_outbound(self):
        ok, err, n = C.validate_command({"cmd": "listOutbound"})
        self.assertTrue(ok, err)
        self.assertEqual(n["cmd"], "listOutbound")
        self.assertEqual(n["args"], {})
        ok, err, n = C.validate_command({"cmd": "listOutbound", "storyId": "story-lincoln"})
        self.assertTrue(ok, err)
        self.assertEqual(n["args"]["storyId"], "story-lincoln")
        ok, err, _ = C.validate_command({"cmd": "listOutbound", "storyId": ""})
        self.assertFalse(ok)
        self.assertIn("storyId", err)
        ok, err, _ = C.validate_command({"cmd": "listOutbound", "url": "https://civic.example.org/"})
        self.assertFalse(ok)
        self.assertIn("unknown field", err)
        ok, err, _ = C.validate_command({"cmd": "openOutbound", "id": "sample-civic-desk"})
        self.assertFalse(ok)
        self.assertIn("unknown command", err)

    def test_claims_commands(self):
        ok, err, n = C.validate_command({"cmd": "listClaims"})
        self.assertTrue(ok, err)
        self.assertEqual(n["args"], {})
        ok, err, n = C.validate_command({"cmd": "listClaims", "storyId": "story-nd-chicago-river-reversal"})
        self.assertTrue(ok, err)
        self.assertEqual(n["args"]["storyId"], "story-nd-chicago-river-reversal")
        ok, err, n = C.validate_command({
            "cmd": "setClaim",
            "storyId": "story-nd-chicago-river-reversal",
            "cardId": "card-nd-chicago-river",
            "factIndex": 0,
            "claimStatus": "supported",
            "sourceIds": ["src-mwrd-history"],
        })
        self.assertTrue(ok, err)
        self.assertEqual(n["args"]["factIndex"], 0)
        self.assertEqual(n["args"]["sourceIds"], ["src-mwrd-history"])
        ok, err, n = C.validate_command({
            "cmd": "setClaim",
            "storyId": "story-nd-chicago-river-reversal",
            "cardId": "card-nd-chicago-river",
            "factLabel": "Reversal",
            "claimStatus": "people-disagree",
            "disagree": [
                {"sourceIds": ["src-mwrd-125-friends"], "position": "2 January 1900"},
                {"sourceIds": ["src-illinois-dnr-flood-history"], "position": "17 January 1900"},
            ],
        })
        self.assertTrue(ok, err)
        self.assertEqual(len(n["args"]["disagree"]), 2)
        ok, err, _ = C.validate_command({
            "cmd": "setClaim",
            "storyId": "story-nd-chicago-river-reversal",
            "cardId": "card-nd-chicago-river",
            "claimStatus": "supported",
        })
        self.assertFalse(ok)
        self.assertIn("factIndex or factLabel", err)
        ok, err, _ = C.validate_command({
            "cmd": "setClaim",
            "storyId": "story-nd-chicago-river-reversal",
            "cardId": "card-nd-chicago-river",
            "factIndex": 0,
            "claimStatus": "supported",
            "url": "https://example.com/",
        })
        self.assertFalse(ok)
        self.assertIn("unknown field", err)
        ok, err, _ = C.validate_command({
            "cmd": "setClaim",
            "storyId": "story-nd-chicago-river-reversal",
            "cardId": "card-nd-chicago-river",
            "factIndex": 1,
            "claimStatus": "people-disagree",
            "disagree": [{"sourceIds": ["src-mwrd-125-friends"], "position": "A", "extra": True}],
        })
        self.assertFalse(ok)
        self.assertIn("unknown field", err)
        ok, err, n = C.validate_command({"cmd": "openClaims", "storyId": "story-nd-chicago-river-reversal"})
        self.assertTrue(ok, err)
        self.assertEqual(n["args"]["storyId"], "story-nd-chicago-river-reversal")
        ok, err, _ = C.validate_command({"cmd": "openClaims"})
        self.assertFalse(ok)
        self.assertIn("missing storyId", err)

    def test_set_claim_log_redacts_position_text(self):
        tmp = tempfile.TemporaryDirectory()
        try:
            C.set_log_path(Path(tmp.name) / "command-log.jsonl")
            C.log_command({
                "id": "abc123",
                "cmd": "setClaim",
                "ok": True,
                "error": None,
                "args": {
                    "storyId": "story-nd-chicago-river-reversal",
                    "cardId": "card-nd-chicago-river",
                    "factIndex": 1,
                    "claimStatus": "people-disagree",
                    "disagree": [
                        {"sourceIds": ["src-mwrd-125-friends"], "position": "UNIQUE-POSITION-TEXT-DO-NOT-LOG"},
                        {"sourceIds": ["src-illinois-dnr-flood-history"], "position": "17 January 1900"},
                    ],
                },
            })
            text = (Path(tmp.name) / "command-log.jsonl").read_text(encoding="utf-8")
            self.assertNotIn("UNIQUE-POSITION-TEXT-DO-NOT-LOG", text)
            self.assertNotIn("17 January 1900", text)
            row = json.loads(text)
            self.assertEqual(row["args"]["storyId"], "story-nd-chicago-river-reversal")
            self.assertEqual(row["args"]["claimStatus"], "people-disagree")
            self.assertEqual(row["args"]["disagree"][0]["sourceIds"], ["src-mwrd-125-friends"])
            self.assertNotIn("position", row["args"]["disagree"][0])
            self.assertNotIn("factLabel", row["args"])
            mem = C.recent_log()[-1]
            self.assertNotIn("position", mem["args"]["disagree"][0])
        finally:
            tmp.cleanup()
            C.reset_for_tests()

    def test_research_commands(self):
        ok, err, n = C.validate_command({"cmd": "openResearch", "storyId": "story-nd-chicago-river-reversal"})
        self.assertTrue(ok, err)
        ok, err, n = C.validate_command({"cmd": "listResearch", "storyId": "story-nd-chicago-river-reversal"})
        self.assertTrue(ok, err)
        self.assertEqual(n["args"]["storyId"], "story-nd-chicago-river-reversal")
        ok, err, n = C.validate_command({
            "cmd": "addGap",
            "storyId": "story-nd-chicago-river-reversal",
            "label": "Surveyed lock coordinate",
            "detail": "Surveyed lock coordinate [UNKNOWN].",
        })
        self.assertTrue(ok, err)
        ok, err, _ = C.validate_command({"cmd": "addGap", "storyId": "story-nd-chicago-river-reversal"})
        self.assertFalse(ok)
        self.assertIn("id or label", err)
        ok, err, n = C.validate_command({
            "cmd": "closeGap",
            "storyId": "story-nd-chicago-river-reversal",
            "id": "gap-chicago-pin",
            "note": "Logged only.",
        })
        self.assertTrue(ok, err)
        ok, err, _ = C.validate_command({
            "cmd": "closeGap",
            "storyId": "story-nd-chicago-river-reversal",
            "id": "gap-chicago-pin",
        })
        self.assertFalse(ok)
        self.assertIn("missing note", err)
        ok, err, _ = C.validate_command({
            "cmd": "addGap",
            "storyId": "story-nd-chicago-river-reversal",
            "label": "x",
            "detail": "[UNKNOWN] y",
            "url": "https://example.com/",
        })
        self.assertFalse(ok)
        self.assertIn("unknown field", err)
        ok, err, _ = C.validate_command({"cmd": "openResearch"})
        self.assertFalse(ok)
        self.assertIn("missing storyId", err)

    def test_records_commands(self):
        ok, err, n = C.validate_command({"cmd": "listRecords", "storyId": "story-nd-chicago-river-reversal"})
        self.assertTrue(ok, err)
        ok, err, n = C.validate_command({
            "cmd": "buildLayer",
            "recordCatalogId": "records-chicago-canal-voyage",
            "layerId": "evl-chicago-canal-voyage",
            "name": "Chicago Sanitary and Ship Canal, 1900 opening",
        })
        self.assertTrue(ok, err)
        self.assertEqual(n["args"]["recordCatalogId"], "records-chicago-canal-voyage")
        ok, err, _ = C.validate_command({"cmd": "buildLayer"})
        self.assertFalse(ok)
        self.assertIn("recordCatalogId or layerId", err)
        ok, err, n = C.validate_command({"cmd": "frameLayer", "id": "evl-chicago-canal-voyage"})
        self.assertTrue(ok, err)
        ok, err, _ = C.validate_command({"cmd": "frameLayer"})
        self.assertFalse(ok)
        self.assertIn("missing id", err)
        ok, err, _ = C.validate_command({
            "cmd": "buildLayer",
            "recordCatalogId": "records-chicago-canal-voyage",
            "url": "https://example.com/",
        })
        self.assertFalse(ok)
        self.assertIn("unknown field", err)

    def test_gis_commands(self):
        ok, err, n = C.validate_command({"cmd": "listGis"})
        self.assertTrue(ok, err)
        self.assertEqual(n["cmd"], "listGis")
        ok, err, n = C.validate_command({"cmd": "listGis", "storyId": "story-nd-chicago-river-reversal"})
        self.assertTrue(ok, err)
        self.assertEqual(n["args"]["storyId"], "story-nd-chicago-river-reversal")
        ok, err, _ = C.validate_command({"cmd": "listGis", "url": "https://example.com/"})
        self.assertFalse(ok)
        self.assertIn("unknown field", err)
        ok, err, n = C.validate_command({"cmd": "gisStatus", "id": "ohm"})
        self.assertTrue(ok, err)
        self.assertEqual(n["args"]["id"], "ohm")
        ok, err, _ = C.validate_command({"cmd": "gisStatus"})
        self.assertFalse(ok)
        self.assertIn("id", err)


    def test_close_gap_log_redacts_note_text(self):
        tmp = tempfile.TemporaryDirectory()
        try:
            C.set_log_path(Path(tmp.name) / "command-log.jsonl")
            C.log_command({
                "id": "abc123",
                "cmd": "closeGap",
                "ok": True,
                "error": None,
                "args": {
                    "storyId": "story-nd-chicago-river-reversal",
                    "id": "gap-chicago-pin",
                    "note": "UNIQUE-GAP-NOTE-DO-NOT-LOG",
                },
            })
            text = (Path(tmp.name) / "command-log.jsonl").read_text(encoding="utf-8")
            self.assertNotIn("UNIQUE-GAP-NOTE-DO-NOT-LOG", text)
            row = json.loads(text)
            self.assertEqual(row["args"]["storyId"], "story-nd-chicago-river-reversal")
            self.assertEqual(row["args"]["id"], "gap-chicago-pin")
            self.assertNotIn("note", row["args"])
        finally:
            tmp.cleanup()
            C.reset_for_tests()

    def test_load_episode_url_allowlist(self):
        ok, err, n = C.validate_command({"cmd": "loadEpisode", "url": "/episodes/washington-dc-demo.globedesk.json"})
        self.assertTrue(ok, err)
        ok, err, _ = C.validate_command({"cmd": "loadEpisode", "url": "https://example.com/x.json"})
        self.assertFalse(ok)
        ok, err, _ = C.validate_command({"cmd": "loadEpisode", "url": "/episodes/../js/ui.js"})
        self.assertFalse(ok)

    def test_command_request_origin_and_host(self):
        port = 8211
        self.assertTrue(C.command_request_ok({"Host": "127.0.0.1:8211"}, port), "missing Origin is a local agent")
        self.assertTrue(C.command_request_ok({"Host": "127.0.0.1:8211", "Origin": "http://127.0.0.1:8211"}, port))
        self.assertFalse(C.command_request_ok({"Host": "127.0.0.1:8211", "Origin": "http://127.0.0.1:9"}, port))
        self.assertFalse(C.command_request_ok({"Host": "example.com", "Origin": "http://127.0.0.1:8211"}, port))
        self.assertFalse(C.command_request_ok({"Host": "127.0.0.1:9"}, port))
        # Host alone is not enough to treat a request as the desk app (tile fill).
        self.assertFalse(tile_http.request_from_app({"Host": "127.0.0.1:8211"}, port))

    def test_bus_times_out_without_a_desk(self):
        ok, err, n = C.validate_command({"cmd": "status"})
        self.assertTrue(ok, err)
        result, status = C.BUS.submit(n, wait_sec=0.2)
        self.assertEqual(status, 503)
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "no desk connected")
        log = C.recent_log()
        self.assertTrue(log)
        self.assertEqual(log[-1]["cmd"], "status")
        self.assertFalse(log[-1]["ok"])

    def test_bus_delivers_to_desk_and_logs(self):
        ok, err, n = C.validate_command({"cmd": "pause"})
        self.assertTrue(ok, err)
        tmp = tempfile.TemporaryDirectory()
        try:
            C.set_log_path(Path(tmp.name) / "command-log.jsonl")
            def desk():
                item = C.BUS.take(2)
                self.assertIsNotNone(item)
                C.BUS.complete(item["id"], {"ok": True, "result": {"paused": True}})
            import threading
            th = threading.Thread(target=desk)
            th.start()
            result, status = C.BUS.submit(n, wait_sec=2)
            th.join(2)
            self.assertEqual(status, 200)
            self.assertTrue(result["ok"])
            self.assertTrue(result["result"]["paused"])
            path = Path(tmp.name) / "command-log.jsonl"
            self.assertTrue(path.is_file())
            text = path.read_text(encoding="utf-8")
            self.assertIn('"cmd":"pause"', text)
            self.assertNotIn("Cookie", text)
        finally:
            tmp.cleanup()
            C.reset_for_tests()

    def test_two_desks_untargeted_rejected(self):
        C.BUS.touch("desk-a", focused=False, title="A")
        C.BUS.touch("desk-b", focused=False, title="B")
        ok, err, n = C.validate_command({"cmd": "dropPin", "lat": 38.91, "lon": -77.04})
        self.assertTrue(ok, err)
        result, status = C.BUS.submit(n, wait_sec=0.2)
        self.assertEqual(status, 409)
        self.assertFalse(result["ok"])
        self.assertIn("multiple desks", result["error"])
        self.assertEqual({d["id"] for d in result["desks"]}, {"desk-a", "desk-b"})

    def test_focused_and_explicit_desk_get_the_command(self):
        import threading
        C.BUS.touch("desk-watch", focused=True, title="Watched")
        C.BUS.touch("desk-other", focused=False, title="Other")
        ok, err, n = C.validate_command({"cmd": "dropPin", "lat": 38.91, "lon": -77.04})
        self.assertTrue(ok, err)
        stolen = []

        def watch():
            item = C.BUS.take(2, desk_id="desk-watch", focused=True, title="Watched")
            self.assertIsNotNone(item)
            self.assertEqual(item["cmd"], "dropPin")
            C.BUS.complete(item["id"], {"ok": True, "result": {"lat": 38.91, "lon": -77.04}})

        def other():
            item = C.BUS.take(0.4, desk_id="desk-other", focused=False, title="Other")
            if item:
                stolen.append(item)
                C.BUS.complete(item["id"], {"ok": True, "result": {"stolen": True}})

        tw = threading.Thread(target=watch)
        to = threading.Thread(target=other)
        to.start()
        tw.start()
        result, status = C.BUS.submit(n, wait_sec=2)
        tw.join(2)
        to.join(2)
        self.assertEqual(status, 200)
        self.assertTrue(result["ok"])
        self.assertEqual(result.get("desk"), "desk-watch")
        self.assertEqual(stolen, [])

        # Explicit desk wins even if another window is focused.
        stolen.clear()
        ok, err, n = C.validate_command({"cmd": "dropPin", "lat": 38.90, "lon": -77.03})
        tw = threading.Thread(target=watch)
        to = threading.Thread(target=other)
        # other should receive this one
        def other_ok():
            item = C.BUS.take(2, desk_id="desk-other", focused=False, title="Other")
            if item:
                stolen.append(item)
                C.BUS.complete(item["id"], {"ok": True, "result": {"lat": 38.90, "lon": -77.03}})

        def watch_skip():
            item = C.BUS.take(0.4, desk_id="desk-watch", focused=True, title="Watched")
            if item:
                C.BUS.complete(item["id"], {"ok": True, "result": {"wrong": True}})

        tw = threading.Thread(target=watch_skip)
        to = threading.Thread(target=other_ok)
        tw.start()
        to.start()
        result, status = C.BUS.submit(n, wait_sec=2, desk="desk-other")
        tw.join(2)
        to.join(2)
        self.assertEqual(status, 200)
        self.assertTrue(result["ok"])
        self.assertEqual(result.get("desk"), "desk-other")
        self.assertEqual(len(stolen), 1)


class QuietTiles(unittest.TestCase):
    def test_empty_tile_is_png(self):
        import tile_empty
        self.assertTrue(tile_empty.EMPTY_TILE_PNG.startswith(b"\x89PNG"))
        self.assertGreater(len(tile_empty.EMPTY_TILE_PNG), 50)

    def test_parallel_tile_misses_are_200_empty_not_refused(self):
        import concurrent.futures
        import socket
        import subprocess
        import time
        import urllib.error
        import urllib.request

        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
        sock.close()
        env = os.environ.copy()
        env.update({
            "GLOBEDESK_NO_BROWSER": "1",
            "GLOBEDESK_OFFLINE": "1",
            "PYTHONDONTWRITEBYTECODE": "1",
        })
        proc = subprocess.Popen(
            [sys.executable, "-B", "tools/serve.py", str(port)],
            cwd=str(ROOT),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            origin = f"http://127.0.0.1:{port}"
            deadline = time.time() + 10
            while time.time() < deadline:
                try:
                    urllib.request.urlopen(origin + "/api/tools", timeout=1)
                    break
                except OSError:
                    time.sleep(0.1)
            else:
                self.fail("serve.py did not start")

            def get(i):
                req = urllib.request.Request(
                    f"{origin}/tiles/eox2016/2/{i % 4}/{i % 4}.jpg",
                    headers={"Origin": origin, "Referer": origin + "/index.html"},
                )
                try:
                    with urllib.request.urlopen(req, timeout=15) as r:
                        return r.status, r.headers.get("X-GlobeDesk-Tile-Source"), r.headers.get("Content-Type"), r.read()[:8]
                except urllib.error.HTTPError as e:
                    return e.code, e.headers.get("X-GlobeDesk-Tile-Source"), e.headers.get("Content-Type"), b""
                except OSError as e:
                    return "refused", str(e), "", b""

            with concurrent.futures.ThreadPoolExecutor(max_workers=64) as pool:
                rows = list(pool.map(get, range(80)))
            refused = [row for row in rows if row[0] == "refused"]
            self.assertEqual(refused, [], "tile burst was refused: " + str(refused[:3]))
            for status, source, ctype, head in rows:
                self.assertEqual(status, 200, (status, source, ctype))
                self.assertNotEqual(status, 404)
                if source == "empty":
                    self.assertTrue((ctype or "").startswith("image/png"))
                    self.assertEqual(head, b"\x89PNG\r\n\x1a\n"[:8])
        finally:
            proc.kill()
            proc.wait(timeout=5)


if __name__ == "__main__":
    unittest.main()
