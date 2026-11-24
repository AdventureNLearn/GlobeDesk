#!/usr/bin/env python3
"""Contributor cards through the promote tool: contact fields are stripped, bad cards are blocked, nothing is committed."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY = [sys.executable, "-B", str(ROOT / "tools" / "promote_layer.py")]
sys.path.insert(0, str(ROOT / "tools"))
import contributor_card  # noqa: E402

AT = "@"  # split so the hygiene scans never see a whole address in this file
FAKE_MAIL = "someone" + AT + "example" + ".org"


def good_card(**over):
    card = {"schema": "globedesk.contributor-card/1", "handle": "canal-fan", "description": "Maps public canal records.",
            "topics": ["history-places/routes"], "links": [{"title": "My dataset", "url": "https://example.org/canals"}],
            "checked": "2026-11-24", "license": "CC BY 4.0"}
    card.update(over)
    return card


# Fictional test numbers, built from parts so the scrub scan does not flag this file.
FAKE_PHONE = " ".join(["+1", "555", "010", "0199"])
FAKE_PHONE_FMT = "+1 (555) " + "-".join(["010", "0199"])


def run(args):
    e = os.environ.copy()
    e["PYTHONDONTWRITEBYTECODE"] = "1"
    return subprocess.run(PY + args, cwd=str(ROOT), env=e, capture_output=True, text=True)


class ContributorCardTests(unittest.TestCase):
    def test_strip_contacts_removes_contact_and_location_fields(self):
        card = good_card(email=FAKE_MAIL, phone=FAKE_PHONE, real_name="Sample Person", location="Somewhere", lat=1.0, lng=2.0)
        card["links"].append({"title": "mail", "url": "mailto:" + FAKE_MAIL})
        out, removed = contributor_card.strip_contacts(card)
        for k in ("email", "phone", "real_name", "location", "lat", "lng"):
            self.assertNotIn(k, out)
            self.assertIn(k, removed)
        self.assertEqual([l["url"] for l in out["links"]], ["https://example.org/canals"])
        self.assertEqual(contributor_card.check(out), [])

    def test_description_contact_text_is_removed(self):
        out, removed = contributor_card.strip_contacts(good_card(description="Write to " + FAKE_MAIL + " or " + FAKE_PHONE_FMT))
        self.assertNotIn(AT, out["description"])
        self.assertIn("description[email]", removed)
        self.assertIn("description[phone]", removed)

    def test_check_refuses_bad_cards(self):
        self.assertTrue(contributor_card.check(good_card(topics=["not-a-category"])))
        self.assertTrue(contributor_card.check(good_card(links=[{"title": "x", "url": "http://plain.example"}])))
        self.assertTrue(contributor_card.check(good_card(links=[{"title": str(i), "url": "https://example.org/" + str(i)} for i in range(4)])))
        self.assertTrue(contributor_card.check(good_card(description="one\ntwo\nthree")))

    def test_promote_card_strips_and_needs_yes(self):
        with tempfile.TemporaryDirectory() as td:
            src = Path(td) / "card.json"
            src.write_text(json.dumps(good_card(email=FAKE_MAIL, address="1 Sample Road")), encoding="utf-8")
            pat = Path(td) / "patterns.json"
            pat.write_text(json.dumps(["promote-name-scan-placeholder"]), encoding="utf-8")
            dest = Path(td) / "out.json"
            r = run(["--card", "--item", str(src), "--dest", str(dest), "--patterns", str(pat)])
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("owner YES", r.stderr)
            self.assertFalse(dest.exists())
            r = run(["--card", "--item", str(src), "--dest", str(dest), "--patterns", str(pat), "--yes"])
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            written = json.loads(dest.read_text(encoding="utf-8"))
            self.assertNotIn("email", written)
            self.assertNotIn("address", written)
            self.assertNotIn(AT, json.dumps(written))
            self.assertIn("Nothing was committed", r.stdout)


if __name__ == "__main__":
    unittest.main()
