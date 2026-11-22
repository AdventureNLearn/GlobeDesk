#!/usr/bin/env python3
"""Census geocoder proxy: official URL shape, no address logging, no browser host."""
import importlib.util
import io
import os
import socket
import subprocess
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("census_geocode", ROOT / "tools" / "census_geocode.py")
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)


class CensusProxy(unittest.TestCase):
    def test_official_url_uses_benchmark_4_and_json(self):
        url = MOD.official_url("1600 Pennsylvania Ave NW")
        self.assertTrue(url.startswith(MOD.CENSUS_ENDPOINT + "?"))
        self.assertIn("benchmark=4", url)
        self.assertIn("format=json", url)
        self.assertIn("address=", url)
        self.assertNotIn("callback=", url)

    def test_fetch_returns_payload_without_logging_the_address(self):
        logs = io.StringIO()

        class FakeRes:
            status = 200
            def read(self):
                return b'{"result":{"addressMatches":[]}}'
            def getcode(self):
                return 200
            def __enter__(self):
                return self
            def __exit__(self, *a):
                return False

        def opener(req, timeout=0):
            self.assertIsInstance(req, Request)
            self.assertEqual(req.full_url.split("?")[0], MOD.CENSUS_ENDPOINT)
            logs.write("opened")
            return FakeRes()

        # Exercise the real fetch path, not the offline 502 stub, even if the
        # runner inherited GLOBEDESK_OFFLINE from another test or the environment.
        old_offline = os.environ.pop("GLOBEDESK_OFFLINE", None)
        try:
            status, payload = MOD.fetch("a private query that must not be logged", opener=opener)
        finally:
            if old_offline is None:
                os.environ.pop("GLOBEDESK_OFFLINE", None)
            else:
                os.environ["GLOBEDESK_OFFLINE"] = old_offline
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertNotIn("a private query that must not be logged", logs.getvalue())
        src = Path(ROOT / "tools" / "serve.py").read_text()
        self.assertIn("/api/geocode/census", src)
        self.assertIn("census_geocode", src)
        # The browser script must not call the Census host directly.
        js = Path(ROOT / "js" / "geocode.js").read_text()
        self.assertNotIn("geocoding.geo.census.gov", js)
        self.assertNotIn("nominatim.openstreetmap.org", js)

    def test_serve_log_message_is_empty(self):
        # serve.py log_message is a no-op, so the address cannot appear in the access log.
        src = Path(ROOT / "tools" / "serve.py").read_text()
        self.assertIn("def log_message(self, fmt, *args):\n        pass", src)


    def test_address_ok_rejects_long_and_control_characters(self):
        self.assertEqual(MOD.address_ok("1600 Pennsylvania Ave NW")[0], True)
        self.assertEqual(MOD.address_ok("")[0], False)
        self.assertEqual(MOD.address_ok("A" * (MOD.ADDRESS_MAX + 1))[0], False)
        self.assertEqual(MOD.address_ok("line\r\nnext")[0], False)
        self.assertEqual(MOD.address_ok("ok\x00null")[0], False)

    def test_proxy_rejects_non_loopback(self):
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
        origin = f"http://127.0.0.1:{port}"
        try:
            deadline = time.time() + 10
            while time.time() < deadline:
                try:
                    urlopen(origin + "/", timeout=1)
                    break
                except OSError:
                    time.sleep(0.1)
            else:
                self.fail("serve.py did not start")

            def call(query, headers, method="GET"):
                req = Request(origin + "/api/geocode/census?" + query, headers=headers, method=method)
                try:
                    with urlopen(req, timeout=5) as res:
                        return res.status, json_body(res)
                except HTTPError as e:
                    body = e.read()
                    try:
                        payload = __import__("json").loads(body.decode("utf-8"))
                    except Exception:
                        payload = {"raw": body[:200].decode("utf-8", "replace")}
                    return e.code, payload

            # Host / Origin from another site: 403, Census is not contacted.
            status, payload = call(
                "address=1600+Pennsylvania",
                {"Host": "evil.example", "Origin": "https://evil.example"},
            )
            self.assertEqual(status, 403, payload)
            self.assertFalse(payload.get("ok", True))

            # Cross-site fetch metadata is refused even if Host looks local.
            status, payload = call(
                "address=1600+Pennsylvania",
                {
                    "Host": f"127.0.0.1:{port}",
                    "Origin": "https://evil.example",
                    "Sec-Fetch-Site": "cross-site",
                },
            )
            self.assertEqual(status, 403, payload)

            app = {"Host": f"127.0.0.1:{port}", "Origin": origin}

            status, payload = call("address=" + ("A" * 5000), app)
            self.assertEqual(status, 400, payload)
            self.assertIn("too long", payload.get("error", ""))

            status, payload = call("address=line%0d%0aInjected", app)
            self.assertEqual(status, 400, payload)
            self.assertIn("invalid", payload.get("error", ""))

            # A same-origin loopback request is accepted by the gate. GLOBEDESK_OFFLINE
            # is already set on the server, so fetch must not contact Census (502 stub).
            status, payload = call("address=1600+Pennsylvania", app)
            self.assertNotIn(status, (400, 403), payload)
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()

    def test_fetch_is_offline_when_GLOBEDESK_OFFLINE(self):
        def opener(req, timeout=0):
            self.fail("census_geocode.fetch must not contact Census when GLOBEDESK_OFFLINE=1")
        old = os.environ.get("GLOBEDESK_OFFLINE")
        os.environ["GLOBEDESK_OFFLINE"] = "1"
        try:
            status, payload = MOD.fetch("1600 Pennsylvania Ave NW", opener=opener)
        finally:
            if old is None:
                os.environ.pop("GLOBEDESK_OFFLINE", None)
            else:
                os.environ["GLOBEDESK_OFFLINE"] = old
        self.assertEqual(status, 502)
        self.assertFalse(payload.get("ok", True))
        self.assertNotIn("1600 Pennsylvania Ave NW", str(payload))


def json_body(res):
    import json
    return json.loads(res.read().decode("utf-8"))



if __name__ == "__main__":
    unittest.main()
