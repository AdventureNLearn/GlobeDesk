#!/usr/bin/env python3
"""Serve GlobeDesk on http://127.0.0.1:<port>/ (default 8080). Local only; no installs needed.
Forces correct MIME types (Windows registries sometimes map .js to text/plain)."""
import http.server
import json
import os
import re
import socketserver
import sys
import webbrowser

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)
import local_tiles

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("GLOBEDESK_PORT") or os.environ.get("GOBEDESK_PORT") or "8080")


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map, **{
        ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
        ".geojson": "application/geo+json", ".html": "text/html", ".svg": "image/svg+xml", ".png": "image/png",
        ".wasm": "application/wasm", ".csv": "text/csv", ".kml": "application/vnd.google-earth.kml+xml",
    })

    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        path = (self.path or "/").split("?", 1)[0]
        # The mission demo under /demo/ loads live radio streams and pack media.
        # Do not apply the desk CSP there (it would block the radio). Prefer
        # `python3 demo/tools/serve.py` to run the demo on its own port.
        if not (path == "/demo" or path.startswith("/demo/")):
            self.send_header("Content-Security-Policy",
                "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://tiles.maps.eox.at https://tiles.openfreemap.org https://s3.amazonaws.com/elevation-tiles-prod/ https://gibs.earthdata.nasa.gov https://api.maptiler.com; connect-src 'self' https://tiles.maps.eox.at https://tiles.openfreemap.org https://s3.amazonaws.com/elevation-tiles-prod/ https://gibs.earthdata.nasa.gov https://api.maptiler.com; font-src 'self' data: https://tiles.openfreemap.org; media-src 'self' blob: data:; frame-src https://www.youtube-nocookie.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'")
        super().end_headers()

    def do_GET(self):
        path = (self.path or "/").split("?", 1)[0]
        if path in ("/api/packs", "/api/packs.json"):
            payload = local_tiles.packs_status(ROOT)
            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        m = re.match(r"^/tiles/bluemarble/(\d+)/(\d+)/(\d+)\.(?:jpe?g|png)$", path)
        if m:
            z, x, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
            try:
                data, source = local_tiles.resolve_tile(z, x, y, pack=local_tiles.pack_path(local_tiles.data_dir(ROOT)), cache=local_tiles.cache_dir(local_tiles.data_dir(ROOT)))
            except Exception:
                data, source = None, "miss"
            if not data:
                self.send_error(404, "tile not found")
                return
            body = data
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("X-GlobeDesk-Tile-Source", source)
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        pass


def main():
    socketserver.TCPServer.allow_reuse_address = True
    try:
        httpd = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        print(f"Port {PORT} is busy ({e}). Try: START-GLOBEDESK.bat 8090")
        sys.exit(1)
    url = f"http://127.0.0.1:{PORT}/"
    print(f"GlobeDesk running at {url}  (close this window or press Ctrl+C to stop)")
    if os.environ.get("GLOBEDESK_NO_BROWSER", os.environ.get("GOBEDESK_NO_BROWSER")) != "1":
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
