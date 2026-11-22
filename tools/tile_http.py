#!/usr/bin/env python3
"""Origin/Host checks so only the local GlobeDesk app can fill the tile cache."""
from __future__ import annotations

from urllib.parse import urlparse


def allowed_origins(port: int) -> set[str]:
    return {f"http://127.0.0.1:{int(port)}", f"http://localhost:{int(port)}"}


def allowed_hosts(port: int) -> set[str]:
    p = int(port)
    hosts = {f"127.0.0.1:{p}", f"localhost:{p}"}
    if p == 80:
        hosts.update({"127.0.0.1", "localhost"})
    return hosts


def header(headers, name: str) -> str:
    if headers is None:
        return ""
    if hasattr(headers, "get"):
        return (headers.get(name) or headers.get(name.lower()) or headers.get(name.title()) or "") or ""
    return ""


def origin_of(url: str) -> str:
    if not url:
        return ""
    try:
        u = urlparse(url)
    except ValueError:
        return ""
    if u.scheme not in ("http", "https") or not u.hostname:
        return ""
    host = u.hostname
    port = u.port
    if port:
        return f"{u.scheme}://{host}:{port}"
    return f"{u.scheme}://{host}"


def host_ok(headers, port: int) -> bool:
    raw = header(headers, "Host").strip().lower()
    return raw in allowed_hosts(port)


def request_loopback_ok(headers, port: int) -> bool:
    """Host must be this loopback port. A foreign Origin or Referer, or a
    cross-site fetch, is refused. A first navigation with only a loopback Host
    is allowed so the app can load.
    """
    if not host_ok(headers, port):
        return False
    site = header(headers, "Sec-Fetch-Site").strip().lower()
    if site == "cross-site":
        return False
    allowed = allowed_origins(port)
    org = header(headers, "Origin").strip().rstrip("/")
    if org and org not in allowed:
        return False
    ref = origin_of(header(headers, "Referer").strip())
    if ref and ref not in allowed:
        return False
    return True


def request_from_app(headers, port: int) -> bool:
    """True when the request is from this app on this loopback port.

    Host must be 127.0.0.1:<port> or localhost:<port>. If Origin is present it
    must match; otherwise Referer must match. A request with neither is not
    treated as the app, so it cannot fill the cache.
    """
    if not host_ok(headers, port):
        return False
    site = header(headers, "Sec-Fetch-Site").strip().lower()
    if site == "cross-site":
        return False
    allowed = allowed_origins(port)
    org = header(headers, "Origin").strip().rstrip("/")
    if org:
        return org in allowed
    ref = origin_of(header(headers, "Referer").strip())
    if ref:
        return ref in allowed
    return False
