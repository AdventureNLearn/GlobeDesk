"""Same-origin Census geocoder proxy helpers. Addresses are not logged."""
from __future__ import annotations
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json
import os

CENSUS_ENDPOINT = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
# Official default public locator on 22 Nov 2026: id 4 / Public_AR_Current.
BENCHMARK = "4"
ADDRESS_MAX = 200


def address_ok(address: str):
    """Return (ok, error). Reject empty, over-long, or control-character addresses."""
    s = address if isinstance(address, str) else str(address or "")
    if not s.strip():
        return False, "address is required"
    if len(s) > ADDRESS_MAX:
        return False, "address is too long"
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in s):
        return False, "address has invalid characters"
    return True, ""

USER_AGENT = "GlobeDesk/1.2 (local serve.py census proxy; +https://github.com)"


def official_url(address: str) -> str:
    return CENSUS_ENDPOINT + "?" + urlencode({
        "address": address or "",
        "benchmark": BENCHMARK,
        "format": "json",
    })


def fetch(address: str, opener=None, timeout=12):
    """Return (status, payload). Never include the address in the payload's logs."""
    if (os.environ.get("GLOBEDESK_OFFLINE") or "").strip().lower() in ("1", "true", "yes"):
        return 502, {"ok": False, "error": "census geocoder unreachable"}
    url = official_url(address)
    open_fn = opener or urlopen
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with open_fn(req, timeout=timeout) as res:
            raw = res.read()
            status = getattr(res, "status", None) or res.getcode()
            try:
                body = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return 502, {"ok": False, "error": "census geocoder returned non-JSON"}
            return int(status), {"ok": True, "result": body}
    except HTTPError as e:
        return int(getattr(e, "code", 502) or 502), {"ok": False, "error": "census geocoder HTTP " + str(getattr(e, "code", ""))}
    except URLError:
        return 502, {"ok": False, "error": "census geocoder unreachable"}
    except TimeoutError:
        return 504, {"ok": False, "error": "census geocoder timed out"}
