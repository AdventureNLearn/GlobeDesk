#!/usr/bin/env python3
"""Serve the GlobeDesk mission demo on 127.0.0.1 and the GlobeDesk app under /globedesk/."""
import argparse
import http.server
import os
from pathlib import Path
from urllib.parse import unquote, urlparse

DEMO_ROOT = Path(__file__).resolve().parents[1]
# When this demo lives at <repo>/demo/, the app is the parent. Otherwise ./globedesk.
PARENT = DEMO_ROOT.parent
if (PARENT / "index.html").exists() and (PARENT / "js").is_dir() and (PARENT / "css").is_dir():
    APP_ROOT = PARENT
else:
    APP_ROOT = DEMO_ROOT / "globedesk"


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map, **{
        ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
        ".json": "application/json", ".wav": "audio/wav", ".mp4": "video/mp4",
    })

    def translate_path(self, path):
        parsed = urlparse(path)
        rel = unquote(parsed.path)
        if rel == "/globedesk" or rel.startswith("/globedesk/"):
            rest = rel[len("/globedesk"):].lstrip("/") or "index.html"
            return str((APP_ROOT / rest).resolve())
        # Serve the demo folder as the site root
        rel = rel.lstrip("/") or "index.html"
        return str((DEMO_ROOT / rel).resolve())

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--bind", default="127.0.0.1")
    args = p.parse_args()
    os.chdir(DEMO_ROOT)
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    server = http.server.ThreadingHTTPServer((args.bind, args.port), Handler)
    print(f"GlobeDesk demo: http://{args.bind}:{args.port}/")
    print(f"Demo root: {DEMO_ROOT}")
    print(f"App root (/globedesk/): {APP_ROOT}")
    print("Box / local only. Not published.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
