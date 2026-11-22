#!/usr/bin/env python3
"""Promote-to-public helper: block on missing source/license, scrub, and name hits. Never commits."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
FIXTURES = ROOT / "tests" / "fixtures" / "promote"
PY = [sys.executable, "-B", str(TOOLS / "promote_layer.py")]

def patterns_file(td, names=None):
    path = Path(td) / "patterns.json"
    path.write_text(__import__("json").dumps(names or ["promote-name-scan-placeholder"]) + "\n", encoding="utf-8")
    return path


def run(args, env=None):
    e = os.environ.copy()
    e.update(env or {})
    e.setdefault("PYTHONDONTWRITEBYTECODE", "1")
    return subprocess.run(PY + args, cwd=str(ROOT), env=e, capture_output=True, text=True)


class PromoteLayerTests(unittest.TestCase):
    def test_missing_source_and_license_blocks_and_marks_unknown(self):
        with tempfile.TemporaryDirectory() as td:
            dest = Path(td) / "out.json"
            r = run(["--item", str(FIXTURES / "missing-license.json"), "--label", "PUBLIC", "--dest", str(dest), "--yes"])
        self.assertNotEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("source and license", (r.stderr + r.stdout).lower())
        self.assertIn("[UNKNOWN]", r.stderr + r.stdout)
        self.assertFalse(dest.exists())

    def test_refuses_without_yes_and_does_not_write(self):
        with tempfile.TemporaryDirectory() as td:
            dest = Path(td) / "out.json"
            pats = patterns_file(td)
            r = run(["--item", str(FIXTURES / "good.json"), "--label", "PUBLIC", "--dest", str(dest), "--patterns", str(pats)])
            self.assertNotEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertIn("owner YES", r.stderr + r.stdout)
            self.assertFalse(dest.exists())

    def test_yes_writes_stripped_candidate_and_does_not_commit(self):
        with tempfile.TemporaryDirectory() as td:
            dest = Path(td) / "out.json"
            pats = patterns_file(td)
            r = run(["--item", str(FIXTURES / "good.json"), "--label", "RECORDED", "--dest", str(dest), "--patterns", str(pats), "--yes"])
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertTrue(dest.is_file())
            doc = json.loads(dest.read_text())
            self.assertEqual(doc["publicStatus"], "RECORDED")
            cat = doc["catalogs"][0]
            self.assertNotIn("openIn", cat)
            self.assertNotIn("ownerName", cat)
            rec = cat["records"][0]
            self.assertNotIn("emailAddress", rec)
            self.assertIn("license", rec)
            self.assertIn("citations", rec)
            self.assertIn("Nothing was committed", r.stdout)
            # The helper must not have created a git commit in this repo.
            head = subprocess.check_output(["git", "-C", str(ROOT), "log", "-1", "--pretty=%s"], text=True).strip()
            self.assertNotIn("promote", head.lower())

    def test_name_scan_hit_blocks_write(self):
        with tempfile.TemporaryDirectory() as td:
            dest = Path(td) / "out.json"
            pats = Path(td) / "patterns.json"
            pats.write_text(json.dumps(["name-scan-token"]) + "\n", encoding="utf-8")
            r = run([
                "--item", str(FIXTURES / "name-hit.json"),
                "--label", "PUBLIC",
                "--dest", str(dest),
                "--patterns", str(pats),
                "--yes",
            ])
            self.assertNotEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertIn("name_scan", (r.stderr + r.stdout).lower())
            self.assertFalse(dest.exists())

    def test_missing_label_blocks(self):
        with tempfile.TemporaryDirectory() as td:
            dest = Path(td) / "out.json"
            src = Path(td) / "nolabel.json"
            doc = json.loads((FIXTURES / "good.json").read_text())
            doc.pop("publicStatus", None)
            doc["catalogs"][0].pop("publicStatus", None)
            src.write_text(json.dumps(doc) + "\n")
            pats = patterns_file(td)
            r = run(["--item", str(src), "--dest", str(dest), "--patterns", str(pats), "--yes"])
            self.assertNotEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertIn("PUBLIC", r.stderr + r.stdout)
            self.assertFalse(dest.exists())

    def test_missing_patterns_blocks_write(self):
        with tempfile.TemporaryDirectory() as td:
            dest = Path(td) / "out.json"
            env = {"GLOBEDESK_DATA": td, "GLOBEDESK_NAME_PATTERNS": ""}
            r = run(
                ["--item", str(FIXTURES / "good.json"), "--label", "PUBLIC", "--dest", str(dest), "--data", td, "--yes"],
                env=env,
            )
            self.assertNotEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertIn("patterns are required", (r.stderr + r.stdout).lower())
            self.assertFalse(dest.exists())
            # An empty pattern list also refuses.
            empty = Path(td) / "empty.json"
            empty.write_text("[]\n", encoding="utf-8")
            r = run([
                "--item", str(FIXTURES / "good.json"), "--label", "PUBLIC",
                "--dest", str(dest), "--patterns", str(empty), "--yes",
            ])
            self.assertNotEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertIn("empty", (r.stderr + r.stdout).lower())
            self.assertFalse(dest.exists())


if __name__ == "__main__":
    unittest.main()
