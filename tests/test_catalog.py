#!/usr/bin/env python3
"""Local catalog: sidecar overlay, CATALOG.md, and loopback export/import."""
from __future__ import annotations

import http.client
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import catalog as catalog_mod  # noqa: E402


def json_body(res):
    return json.loads(res.read().decode("utf-8"))


def _payload(body, limit=400):
    try:
        return json.loads(body.decode("utf-8"))
    except Exception:
        return {"raw": body[:limit].decode("utf-8", "replace")}


def call(url, headers=None, method="GET", data=None):
    req = Request(url, headers=headers or {}, method=method, data=data)
    try:
        with urlopen(req, timeout=5) as res:
            return res.status, _payload(res.read())
    except HTTPError as e:
        return e.code, _payload(e.read(), 200)


def raw_call(port, method, path, headers=None, skip_host=False):
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    try:
        conn.putrequest(method, path, skip_host=skip_host, skip_accept_encoding=True)
        for key, val in (headers or {}).items():
            if skip_host and key.lower() == "host":
                continue
            conn.putheader(key, val)
        conn.endheaders()
        res = conn.getresponse()
        return res.status, _payload(res.read())
    finally:
        conn.close()


class CatalogModuleTests(unittest.TestCase):
    def test_write_catalog_md_and_export_settings(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            desks = {
                "schema": "globedesk.outbound/1",
                "generated": "2026-11-22",
                "targets": [
                    {"id": "sample-civic-desk", "label": "Sample Civic Desk", "url": "https://civic.example.org/", "enabled": True, "status": "verified"}
                ],
            }
            (base / "desks").mkdir()
            (base / "desks" / "outbound.json").write_text(json.dumps(desks), encoding="utf-8")
            path = catalog_mod.write_catalog_md(base)
            text = path.read_text(encoding="utf-8")
            self.assertIn("Sample Civic Desk", text)
            self.assertIn("desks/outbound.json", text)
            result = catalog_mod.export_settings(
                {"items": {"globedesk.shell.v1": "{\"template\":\"edit\"}", "gobedesk.optional.x": "1"}},
                base,
            )
            self.assertTrue(result["ok"], result)
            self.assertTrue((base / result["file"]).is_file())
            self.assertIn("layout", result)
            imported = catalog_mod.import_settings(result["file"], base)
            self.assertTrue(imported["ok"], imported)
            self.assertEqual(imported["items"]["globedesk.shell.v1"], "{\"template\":\"edit\"}")
            # Non-matching keys are dropped.
            bad = catalog_mod.export_settings({"items": {"other.key": "nope"}}, base)
            self.assertFalse(bad["ok"])

    def test_import_rejects_non_string_and_oversized_values(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            catalog_mod.ensure_dirs(base)
            bad = base / "settings" / "bad.json"
            bad.write_text(json.dumps({
                "schema": catalog_mod.SETTINGS_SCHEMA,
                "items": {"globedesk.shell.v1": {"template": "edit"}},
            }), encoding="utf-8")
            got = catalog_mod.import_settings("settings/bad.json", base)
            self.assertFalse(got["ok"], got)
            self.assertIn("string", got.get("error", ""))
            huge = base / "settings" / "huge.json"
            huge.write_text(json.dumps({
                "schema": catalog_mod.SETTINGS_SCHEMA,
                "items": {"globedesk.shell.v1": "x" * (catalog_mod.MAX_VALUE_BYTES + 1)},
            }), encoding="utf-8")
            got = catalog_mod.import_settings("settings/huge.json", base)
            self.assertFalse(got["ok"], got)
            self.assertIn("too large", got.get("error", ""))

    def test_read_catalog_file_enforces_size_cap(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            catalog_mod.ensure_dirs(base)
            path = base / "settings" / "too-big.json"
            path.write_bytes(b"{" + b"a" * (catalog_mod.MAX_FILE_BYTES + 1) + b"}")
            got = catalog_mod.read_catalog_file("settings/too-big.json", base)
            self.assertFalse(got["ok"], got)
            self.assertIn("too large", got.get("error", ""))

    def test_overlay_path_is_constrained(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            catalog_mod.ensure_dirs(base)
            target = base / "desks" / "outbound.json"
            target.write_text("{\"schema\":\"globedesk.outbound/1\",\"targets\":[]}\n", encoding="utf-8")
            self.assertEqual(catalog_mod.overlay_file("/newsdesk/outbound.json", base), target.resolve())
            self.assertIsNone(catalog_mod.overlay_file("/newsdesk/../desks/outbound.json", base))
            self.assertIsNone(catalog_mod.overlay_file("/etc/passwd", base))
            self.assertIsNone(catalog_mod.read_catalog_file("../secrets.json", base).get("doc"))
            self.assertFalse(catalog_mod.read_catalog_file("desks/../../outbound.json", base)["ok"])


class CatalogServeTests(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.base = Path(self.td.name)
        catalog_mod.ensure_dirs(self.base)
        personal = {
            "schema": "globedesk.outbound/1",
            "generated": "2026-11-22",
            "targets": [
                {"id": "personal-test-desk", "label": "Personal Test Desk", "url": "https://personal.example.org/", "enabled": True, "status": "verified", "sectionIds": ["local-civic"]}
            ],
        }
        (self.base / "desks" / "outbound.json").write_text(json.dumps(personal), encoding="utf-8")
        claims = {
            "schema": "globedesk.claims/1",
            "claims": [{"id": "claim-personal-secret", "storyId": "story-x", "cardId": "card-x", "factIndex": 0, "factLabel": "secret", "claimStatus": "supported", "sourceIds": ["src-x"]}],
        }
        (self.base / "claims" / "claims.json").write_text(json.dumps(claims), encoding="utf-8")
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        self.port = sock.getsockname()[1]
        sock.close()
        env = os.environ.copy()
        env.update({
            "GLOBEDESK_NO_BROWSER": "1",
            "GLOBEDESK_OFFLINE": "1",
            "GLOBEDESK_DATA": str(self.base),
            "PYTHONDONTWRITEBYTECODE": "1",
        })
        self.proc = subprocess.Popen(
            [sys.executable, "-B", "tools/serve.py", str(self.port)],
            cwd=str(ROOT),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self.origin = f"http://127.0.0.1:{self.port}"
        deadline = time.time() + 10
        while time.time() < deadline:
            try:
                urlopen(self.origin + "/", timeout=1)
                break
            except OSError:
                time.sleep(0.1)
        else:
            self.tearDown()
            self.fail("serve.py did not start")

    def tearDown(self):
        if getattr(self, "proc", None):
            self.proc.terminate()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        if getattr(self, "td", None):
            self.td.cleanup()

    def app_headers(self):
        return {"Host": f"127.0.0.1:{self.port}", "Origin": self.origin}

    def test_overlay_prefers_data_dir_sidecar(self):
        status, payload = call(self.origin + "/newsdesk/outbound.json", self.app_headers())
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["targets"][0]["id"], "personal-test-desk")

    def test_catalog_api_rejects_non_app_and_exports(self):
        status, payload = call(
            self.origin + "/api/catalog/list",
            {"Host": "evil.example", "Origin": "https://evil.example"},
        )
        self.assertEqual(status, 403, payload)

        status, payload = call(self.origin + "/api/catalog/list", self.app_headers())
        self.assertEqual(status, 200, payload)
        self.assertTrue(payload.get("ok"), payload)
        names = [it["name"] for it in payload.get("items") or []]
        self.assertIn("Personal Test Desk", names)

        body = json.dumps({"items": {"globedesk.shell.v1": "{\"template\":\"edit\"}"}}).encode("utf-8")
        status, payload = call(
            self.origin + "/api/catalog/export",
            {**self.app_headers(), "Content-Type": "application/json"},
            method="POST",
            data=body,
        )
        self.assertEqual(status, 200, payload)
        self.assertTrue(payload.get("ok"), payload)
        settings_file = payload["file"]

        status, payload = call(
            self.origin + "/api/catalog/import",
            {**self.app_headers(), "Content-Type": "application/json"},
            method="POST",
            data=json.dumps({"file": settings_file}).encode("utf-8"),
        )
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["items"]["globedesk.shell.v1"], "{\"template\":\"edit\"}")


    def test_foreign_host_cannot_read_overlay_claims(self):
        status, payload = call(
            self.origin + "/newsdesk/claims.json",
            {"Host": "evil.example", "Origin": "https://evil.example"},
        )
        self.assertEqual(status, 403, payload)
        blob = json.dumps(payload)
        self.assertNotIn("claim-personal-secret", blob)
        # Loopback still receives the overlay.
        status, payload = call(self.origin + "/newsdesk/claims.json", self.app_headers())
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["claims"][0]["id"], "claim-personal-secret")

    def test_globedesk_data_url_is_refused(self):
        # Bait lives only in the temp GLOBEDESK_DATA catalog. The test never reads, writes or deletes
        # anything under the repo's own globedesk-data/ folder.
        bait_dir = self.base / "claims"
        bait = bait_dir / "secret-bait.json"
        bait_dir.mkdir(parents=True, exist_ok=True)
        bait.write_text('{"secret":"should-not-be-served"}\n', encoding="utf-8")
        status, payload = call(self.origin + "/globedesk-data/claims/secret-bait.json", self.app_headers())
        self.assertIn(status, (403, 404), payload)
        self.assertNotIn("should-not-be-served", json.dumps(payload))
        status, payload = call(self.origin + "/globedesk-data/", self.app_headers())
        self.assertIn(status, (403, 404), payload)

    def test_loopback_request_still_serves_the_app(self):
        status, payload = call(self.origin + "/newsdesk/outbound.json", self.app_headers())
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload["targets"][0]["id"], "personal-test-desk")
        # A first navigation with only a loopback Host still loads the app.
        status, payload = call(self.origin + "/", {"Host": "127.0.0.1:%s" % self.port})
        # "/" is HTML, so payload may be raw
        self.assertEqual(status, 200, payload)

    def test_head_is_guarded(self):
        status, payload = call(
            self.origin + "/index.html",
            {"Host": "evil.example", "Origin": "https://evil.example"},
            method="HEAD",
        )
        self.assertEqual(status, 403, payload)
        status, payload = call(
            self.origin + "/globedesk-data/claims/secret-bait.json",
            self.app_headers(),
            method="HEAD",
        )
        self.assertIn(status, (403, 404), payload)
        self.assertNotIn("should-not-be-served", json.dumps(payload))
        status, payload = call(self.origin + "/index.html", self.app_headers(), method="HEAD")
        self.assertEqual(status, 200, payload)

    def test_loopback_guard_rejects_other_port_missing_host_and_cross_site(self):
        status, payload = call(
            self.origin + "/newsdesk/claims.json",
            {"Host": "127.0.0.1:9", "Origin": "http://127.0.0.1:9"},
        )
        self.assertEqual(status, 403, payload)
        self.assertNotIn("claim-personal-secret", json.dumps(payload))
        status, payload = raw_call(self.port, "GET", "/newsdesk/claims.json", skip_host=True)
        self.assertEqual(status, 403, payload)
        self.assertNotIn("claim-personal-secret", json.dumps(payload))
        status, payload = call(
            self.origin + "/newsdesk/claims.json",
            {**self.app_headers(), "Sec-Fetch-Site": "cross-site"},
        )
        self.assertEqual(status, 403, payload)
        self.assertNotIn("claim-personal-secret", json.dumps(payload))




if __name__ == "__main__":
    unittest.main()
