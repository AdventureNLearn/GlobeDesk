#!/usr/bin/env python3
"""Serve GlobeDesk on http://127.0.0.1:<port>/ (default 8080). Local only; no installs needed.
Forces correct MIME types (Windows registries sometimes map .js to text/plain)."""
import http.server
import os
import socketserver
import sys
import webbrowser

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
        self.send_header("Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://tiles.maps.eox.at https://tiles.openfreemap.org https://s3.amazonaws.com/elevation-tiles-prod/ https://gibs.earthdata.nasa.gov https://api.maptiler.com; connect-src 'self' https://tiles.maps.eox.at https://tiles.openfreemap.org https://s3.amazonaws.com/elevation-tiles-prod/ https://gibs.earthdata.nasa.gov https://api.maptiler.com; font-src 'self' data: https://tiles.openfreemap.org; media-src 'self' blob: data:; frame-src https://www.youtube-nocookie.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'")
        super().end_headers()

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
