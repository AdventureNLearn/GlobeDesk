#!/usr/bin/env python3
"""v1.3: offline share pack checks, the fixed ffmpeg command, and the loopback guard on the new endpoints.
All fixtures are synthetic samples."""
from __future__ import annotations

import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import export_share_pack as sp  # noqa: E402
import ffmpeg_export as fx  # noqa: E402

PLACEHOLDER = "Sharepack Placeholder Name"


def sample_episode(**story_overrides):
    story = {
        "id": "sample-story-1",
        "title": "Sample: Capitol dome",
        "durationSec": 6,
        "sources": [{"label": "Sample source", "url": "https://www.aoc.gov/explore-capitol-campus/buildings-grounds/capitol-building"}],
        "camera": [{"at": 0, "durationSec": 3, "center": [-77.009, 38.889], "zoom": 14, "pitch": 40, "bearing": 0}],
        "captions": [{"at": 0, "text": "Sample caption"}],
    }
    story.update(story_overrides)
    return {"schema": "globedesk.episode/1", "title": "Sample Share Pack", "date": "2026-01-01", "show": "Sample", "stories": [story]}


def patterns(td):
    p = Path(td) / "patterns.json"
    p.write_text(json.dumps([PLACEHOLDER]) + "\n", encoding="utf-8")
    return str(p)


class SharePackTests(unittest.TestCase):
    def test_good_sample_builds_one_offline_file_with_attributions(self):
        with tempfile.TemporaryDirectory() as td:
            r = sp.plan(sample_episode(), "PUBLIC", "CC BY 4.0", "outline", patterns(td), Path(td))
        html = r["html"]
        self.assertTrue(r["ok"])
        self.assertLess(r["bytes"], sp.CAP_OUTLINE)
        self.assertEqual(r["scans"], {"scrub_scan": "clean", "name_scan": "clean"})
        self.assertTrue(any("Natural Earth" in a for a in r["attributions"]))
        self.assertTrue(any("MapLibre" in a for a in r["attributions"]))
        self.assertIn("default-src 'none'", html)
        self.assertNotRegex(html, r'<script[^>]+src=|<link[^>]+href=["\']https?:')
        self.assertNotRegex(html, sp.FORBIDDEN_IN_PACK)
        self.assertIn("Sample: Capitol dome", html)

    def test_unsourced_story_is_blocked(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(sp.ShareError) as cm:
                sp.plan(sample_episode(sources=[]), "PUBLIC", "CC BY 4.0", "outline", patterns(td), Path(td))
        self.assertTrue(any("source" in x for x in cm.exception.reasons))

    def test_missing_licence_or_nc_licence_is_blocked(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(sp.ShareError):
                sp.plan(sample_episode(), "PUBLIC", None, "outline", patterns(td), Path(td))
            with self.assertRaises(sp.ShareError) as cm:
                sp.plan(sample_episode(), "PUBLIC", "CC BY-NC-SA 4.0", "outline", patterns(td), Path(td))
        self.assertTrue(any("non-commercial" in x for x in cm.exception.reasons))

    def test_missing_label_is_blocked(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(sp.ShareError):
                sp.plan(sample_episode(), None, "CC BY 4.0", "outline", patterns(td), Path(td))

    def test_personal_fields_and_local_media_are_stripped(self):
        ep = sample_episode(voiceover={"mediaId": "m1"}, notes="private desk note")
        ep["mediaBin"] = [{"id": "m1"}]
        ep["deskId"] = "desk-sample"
        ep["stories"][0]["ownerName"] = "Sample Owner"
        ep["stories"][0]["openIn"] = [{"url": "https://example.org/sample"}]
        cand, notes = sp.build_candidate(ep, "PUBLIC", "CC BY 4.0")
        blob = json.dumps(cand)
        self.assertNotIn("Sample Owner", blob)
        self.assertNotIn("openIn", blob)
        self.assertNotIn("private desk note", blob)
        self.assertNotIn("mediaBin", blob)
        self.assertNotIn("voiceover", blob)
        self.assertNotIn("desk-sample", blob)
        self.assertTrue(notes)

    def test_name_scan_hit_and_missing_patterns_fail_closed(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(sp.ShareError) as cm:
                sp.plan(sample_episode(title="Sample about " + PLACEHOLDER), "PUBLIC", "CC BY 4.0", "outline", patterns(td), Path(td))
            self.assertIn("name_scan", str(cm.exception))
            env_keep = os.environ.pop("GLOBEDESK_NAME_PATTERNS", None)
            try:
                with self.assertRaises(sp.ShareError):
                    sp.run_scans(sp.build_candidate(sample_episode(), "PUBLIC", "CC BY 4.0")[0], str(Path(td) / "missing.json"))
            finally:
                if env_keep is not None:
                    os.environ["GLOBEDESK_NAME_PATTERNS"] = env_keep

    def test_tile_add_on_without_a_local_pack_is_refused_and_never_fetched(self):
        with tempfile.TemporaryDirectory() as td:
            for choice in ("bluemarble", "eox-region"):
                with self.assertRaises(sp.ShareError):
                    sp.plan(sample_episode(), "PUBLIC", "CC BY 4.0", choice, patterns(td), Path(td))

    def test_caps_and_cli_dry_run_writes_nothing(self):
        self.assertEqual(sp.CAP_OUTLINE, 20 * 1024 * 1024)
        self.assertEqual(sp.CAP_TILES, 80 * 1024 * 1024)
        with tempfile.TemporaryDirectory() as td:
            ep = Path(td) / "sample.globedesk.json"
            ep.write_text(json.dumps(sample_episode()), encoding="utf-8")
            out = Path(td) / "pack.globedesk.html"
            base = [sys.executable, "-B", str(ROOT / "tools" / "export_share_pack.py"), "--episode", str(ep), "--label", "PUBLIC",
                    "--license", "CC BY 4.0", "--patterns", patterns(td), "--data", td, "--out", str(out)]
            r = subprocess.run(base, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertFalse(out.exists())
            r = subprocess.run(base + ["--yes"], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertTrue(out.is_file())
            r = subprocess.run(base + ["--yes"], capture_output=True, text=True)
            self.assertNotEqual(r.returncode, 0, "never overwrites")


class SharePackLinkTests(unittest.TestCase):
    def test_only_https_links_reach_the_pack(self):
        ep = sample_episode(sources=[
            {"label": "Good", "url": "https://www.aoc.gov/"},
            {"label": "Script", "url": "javascript:alert(1)"},
            {"label": "Plain", "url": "http://example.org/sample"},
            {"label": "Data", "url": "data:text/html,sample"},
            {"label": "Spaced", "url": "https://exa mple.org/"},
        ], creditUrl="javascript:alert(2)")
        ep["sources"] = ["https://www.aoc.gov/", "http://example.org/sample"]
        with tempfile.TemporaryDirectory() as td:
            html = sp.plan(ep, "PUBLIC", "CC BY 4.0", "outline", patterns(td), Path(td))["html"]
        data = re.search(r"GD_SHARE\s*=\s*(\{.*?\});", html, re.S)
        blob = data.group(1) if data else html
        self.assertIn("https://www.aoc.gov/", blob)
        for bad in ("javascript:", "http://example.org", "data:text/html", "exa mple"):
            self.assertNotIn(bad, blob)

    def test_player_renders_https_links_only(self):
        js = (ROOT / "share" / "player.js").read_text(encoding="utf-8")
        self.assertIn("function safeHref", js)
        self.assertRegex(js, r'protocol === "https:"')
        self.assertIn("href = safeHref(href);", js)


class FfmpegTests(unittest.TestCase):
    def test_fixed_command_line(self):
        argv = fx.fixed_argv("ffmpeg", Path("work") / "in.webm", Path("work") / "out.mp4")
        self.assertEqual(argv[1:6], ["-hide_banner", "-nostdin", "-loglevel", "error", "-y"])
        self.assertIn("libx264", argv)
        self.assertIn("aac", argv)
        self.assertEqual(argv[-1], str(Path("work") / "out.mp4"))

    def test_transcode_uses_runner_and_cleans_up(self):
        seen = {}

        def runner(argv, **kw):
            seen["argv"] = argv
            Path(argv[-1]).write_bytes(b"\x00\x00\x00\x18ftypisom")
            return subprocess.CompletedProcess(argv, 0)

        data = b"\x1a\x45\xdf\xa3" + b"0" * 100
        pos = {"i": 0}

        def read(n):
            chunk = data[pos["i"]:pos["i"] + n]
            pos["i"] += len(chunk)
            return chunk

        out = fx.transcode_stream(read, len(data), "ffmpeg", runner)
        self.assertTrue(out.startswith(b"\x00\x00\x00\x18ftyp"))
        self.assertFalse(Path(seen["argv"][-1]).parent.exists(), "temp folder removed")
        with self.assertRaises(fx.ExportError):
            fx.transcode_stream(read, 0, "ffmpeg", runner)


class FfmpegStreamTests(unittest.TestCase):
    def _runner(self, argv, **kw):
        Path(argv[-1]).write_bytes(b"\x00\x00\x00\x18ftypisom" + b"m" * 3000000)
        return subprocess.CompletedProcess(argv, 0)

    def test_output_streams_in_chunks_from_the_temp_file(self):
        data = b"w" * 10
        got, sizes = [], []
        it = iter([data])
        n = fx.transcode_stream(lambda k: next(it, b""), len(data), "ffmpeg", self._runner,
                                write=got.append, start=sizes.append)
        self.assertEqual(n, sizes[0])
        self.assertGreater(len(got), 1, "written in chunks, not one buffer")
        self.assertTrue(all(len(c) <= fx.CHUNK for c in got))
        self.assertEqual(sum(len(c) for c in got), n)

    def test_stalled_upload_is_an_export_error(self):
        def read(k):
            raise TimeoutError("timed out")
        with self.assertRaises(fx.ExportError) as cm:
            fx.transcode_stream(read, 100, "ffmpeg", self._runner)
        self.assertIn("stalled", str(cm.exception))
        self.assertGreater(fx.READ_TIMEOUT_SEC, 0)
        serve = (ROOT / "tools" / "serve.py").read_text(encoding="utf-8")
        self.assertIn("settimeout(ffmpeg_export.READ_TIMEOUT_SEC)", serve)
        self.assertNotIn("_send_bytes(data, \"video/mp4\")", serve)


class LoopbackGuardTests(unittest.TestCase):
    def test_new_endpoints_refuse_foreign_origin(self):
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
        sock.close()
        env = os.environ.copy()
        env.update({"GLOBEDESK_NO_BROWSER": "1", "GLOBEDESK_OFFLINE": "1", "PYTHONDONTWRITEBYTECODE": "1"})
        with tempfile.TemporaryDirectory() as td:
            env["GLOBEDESK_DATA"] = td
            proc = subprocess.Popen([sys.executable, "-B", "tools/serve.py", str(port)], cwd=str(ROOT), env=env,
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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

                def call(method, path, headers, body=None):
                    req = urllib.request.Request(origin + path, data=body, method=method, headers=headers)
                    try:
                        with urllib.request.urlopen(req, timeout=10) as r:
                            return r.status
                    except urllib.error.HTTPError as e:
                        return e.code

                evil = {"Origin": "https://evil.example", "Content-Type": "application/json"}
                badhost = {"Host": "evil.example", "Origin": origin, "Content-Type": "application/json"}
                for h in (evil, badhost):
                    self.assertEqual(call("GET", "/api/export/mp4", h), 403)
                    self.assertEqual(call("POST", "/api/export/mp4", dict(h, **{"Content-Type": "video/webm"}), b"x"), 403)
                    self.assertEqual(call("POST", "/api/share-pack", h, b"{}"), 403)
                good = {"Origin": origin, "Referer": origin + "/index.html", "Content-Type": "application/json"}
                self.assertEqual(call("GET", "/api/export/mp4", good), 200)
                self.assertEqual(call("POST", "/api/share-pack", good, json.dumps({"episode": sample_episode(), "confirm": False}).encode()), 400)
            finally:
                proc.kill()
                proc.wait(timeout=5)


if __name__ == "__main__":
    unittest.main()
