#!/usr/bin/env python3
"""scrub_scan allowlist: every phone on a line, and only a 555 *exchange*."""
import importlib.util
import io
import sys
import tempfile
import unittest
import zipfile
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("scrub_scan", ROOT / "tools" / "scrub_scan.py")
SCAN = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SCAN)


def dashed(parts):
    return "-".join(parts)


class PhoneExchange(unittest.TestCase):
    def test_exchange_not_area_code(self):
        self.assertTrue(SCAN.phone_exchange_is_555(dashed(["415", "555", "0100"])))
        self.assertTrue(SCAN.phone_exchange_is_555("(" + "415) " + dashed(["555", "0100"])))
        self.assertTrue(SCAN.phone_exchange_is_555("+1 " + "415." + "555.0100"))
        # 555 as the area code is not an exchange.
        self.assertFalse(SCAN.phone_exchange_is_555(dashed(["555", "123", "4567"])))
        self.assertFalse(SCAN.phone_exchange_is_555(dashed(["555", "234", "5678"])))
        self.assertFalse(SCAN.phone_exchange_is_555("(" + "555) " + dashed(["234", "5678"])))


class AllowlistHoles(unittest.TestCase):
    def _zip_and_scan(self, rel, text):
        tmp = Path(tempfile.mkdtemp()) / "probe.zip"
        with zipfile.ZipFile(tmp, "w") as z:
            z.writestr("GlobeDesk/" + rel, text)
        buf = io.StringIO()
        old = sys.argv
        sys.argv = ["scrub_scan.py", "--zip", str(tmp)]
        try:
            with redirect_stdout(buf):
                rc = SCAN.main()
        finally:
            sys.argv = old
        return rc, buf.getvalue()

    def test_later_non555_on_same_line_is_caught(self):
        # Allowlisted path: a 555 exchange first, then a later non-555 number.
        first = dashed(["415", "555", "0100"])
        later = dashed(["202", "456", "1414"])
        text = "const a = %r;\n" % (first + " and then " + later)
        rc, out = self._zip_and_scan("tests/research.unit.mjs", text)
        self.assertEqual(rc, 1, out)
        self.assertIn("phone number", out)

    def test_555_area_code_is_not_allowlisted(self):
        text = "const a = %r;\n" % dashed(["555", "234", "5678"])
        rc, out = self._zip_and_scan("tests/records.unit.mjs", text)
        self.assertEqual(rc, 1, out)
        self.assertIn("phone number", out)

    def test_555_exchange_in_allowlisted_file_is_ok(self):
        text = "const a = %r;\n" % dashed(["415", "555", "0100"])
        rc, out = self._zip_and_scan("tests/records.unit.mjs", text)
        self.assertEqual(rc, 0, out)

    def test_555_in_non_allowlisted_file_is_caught(self):
        text = "const a = %r;\n" % dashed(["415", "555", "0100"])
        rc, out = self._zip_and_scan("tests/claims.unit.mjs", text)
        self.assertEqual(rc, 1, out)


if __name__ == "__main__":
    unittest.main()
