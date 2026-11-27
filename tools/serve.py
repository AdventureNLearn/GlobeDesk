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
from pathlib import Path
from urllib.parse import unquote

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)
import local_tiles
import tile_cache
import tile_http
import command_api
import tile_empty
import census_geocode
import catalog as catalog_mod
import ffmpeg_export
import export_share_pack

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("GLOBEDESK_PORT") or os.environ.get("GOBEDESK_PORT") or "8080")


class ThreadingServer(socketserver.ThreadingTCPServer):
    # The default backlog is 5. MapLibre can open dozens of tile connections at once;
    # a short backlog surfaces in the browser as net::ERR_CONNECTION_REFUSED.
    request_queue_size = 256
    daemon_threads = True


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
        # videos.html has its own meta CSP (hosted film, inline script/style).
        # Match that path exactly (query strings are stripped above); do not
        # prefix-match /videos.htmlx or /videos.html.bak.
        if not (path == "/demo" or path.startswith("/demo/") or path == "/videos.html"):
            self.send_header("Content-Security-Policy",
                "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://tiles.maps.eox.at https://tiles.openfreemap.org https://s3.amazonaws.com/elevation-tiles-prod/ https://gibs.earthdata.nasa.gov https://api.maptiler.com https://basemap.nationalmap.gov https://hydro.nationalmap.gov https://tigerweb.geo.census.gov https://nowcoast.noaa.gov https://mrdata.usgs.gov; connect-src 'self' https://tiles.maps.eox.at https://tiles.openfreemap.org https://s3.amazonaws.com/elevation-tiles-prod/ https://gibs.earthdata.nasa.gov https://api.maptiler.com https://basemap.nationalmap.gov https://hydro.nationalmap.gov https://tigerweb.geo.census.gov https://nowcoast.noaa.gov https://mrdata.usgs.gov https://photon.komoot.io; font-src 'self' data: https://tiles.openfreemap.org; media-src 'self' blob: data:; frame-src https://www.youtube-nocookie.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'")
        super().end_headers()

    def _from_app(self):
        return tile_http.request_from_app(self.headers, PORT)

    def _loopback_ok(self):
        return tile_http.request_loopback_ok(self.headers, PORT)

    def _refuse_remote(self):
        self._send_json({"ok": False, "error": "only the local app can use this server"}, 403)

    def _root_resolved(self):
        return Path(ROOT).resolve()

    def _data_dir_resolved(self):
        return local_tiles.data_dir(ROOT).resolve()

    def _clean_url_path(self, path):
        raw = unquote(unquote(path or "/")).replace("\\", "/")
        raw = raw.split("?", 1)[0]
        if not raw.startswith("/"):
            raw = "/" + raw
        parts = []
        for part in raw.split("/"):
            if part in ("", "."):
                continue
            if part == "..":
                if parts:
                    parts.pop()
                continue
            parts.append(part)
        return "/" + "/".join(parts)

    def _data_url_prefixes(self):
        prefixes = {"/globedesk-data"}
        try:
            rel = self._data_dir_resolved().relative_to(self._root_resolved())
            prefixes.add("/" + rel.as_posix())
        except ValueError:
            pass
        return prefixes

    def _data_path_forbidden(self, path):
        """True when the URL or the resolved file is the personal catalog folder."""
        norm = self._clean_url_path(path)
        for prefix in self._data_url_prefixes():
            if norm == prefix or norm.startswith(prefix + "/"):
                return True
        try:
            translated = Path(self.translate_path(norm)).resolve()
        except (OSError, ValueError):
            return False
        try:
            translated.relative_to(self._data_dir_resolved())
            return True
        except ValueError:
            return False

    def _static_escapes_root(self, path):
        norm = self._clean_url_path(path)
        try:
            translated = Path(self.translate_path(norm)).resolve()
        except (OSError, ValueError):
            return True
        try:
            translated.relative_to(self._root_resolved())
            return False
        except ValueError:
            return True

    def list_directory(self, path):
        try:
            Path(path).resolve().relative_to(self._data_dir_resolved())
            self.send_error(403, "forbidden")
            return None
        except ValueError:
            pass
        except OSError:
            self.send_error(404, "not found")
            return None
        return super().list_directory(path)

    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_tile(self, data, source, content_type="image/jpeg"):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-GlobeDesk-Tile-Source", source)
        self.end_headers()
        self.wfile.write(data)

    def _send_empty_tile(self):
        # 200 + transparent PNG so a pack miss does not 404 and flood the console.
        self._send_tile(tile_empty.EMPTY_TILE_PNG, "empty", content_type="image/png")


    def _catalog_base(self):
        return catalog_mod.ensure_dirs(local_tiles.data_dir(ROOT))

    def _send_bytes(self, data, content_type, status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _catalog_get(self, path):
        if not self._from_app():
            self._send_json({"ok": False, "error": "only the local app can use the catalog"}, 403)
            return True
        if path in ("/api/catalog/list", "/api/catalog/list.json"):
            base = self._catalog_base()
            items = catalog_mod.list_items(base)
            self._send_json({"ok": True, "items": items, "root": "GLOBEDESK_DATA"})
            return True
        if path in ("/api/catalog/item", "/api/catalog/item.json"):
            from urllib.parse import parse_qs, unquote
            qs = (self.path or "").split("?", 1)
            rel = ""
            if len(qs) == 2:
                q = parse_qs(qs[1], keep_blank_values=True)
                rel = unquote((q.get("file") or [""])[0])
            result = catalog_mod.read_catalog_file(rel, self._catalog_base())
            self._send_json(result, 200 if result.get("ok") else 404)
            return True
        self._send_json({"ok": False, "error": "unknown catalog path"}, 404)
        return True

    def _maybe_overlay_sidecar(self, path):
        overlay = catalog_mod.overlay_file(path, local_tiles.data_dir(ROOT))
        if not overlay:
            return False
        data = overlay.read_bytes()
        ctype = "application/json; charset=utf-8"
        self._send_bytes(data, ctype)
        return True

    def do_GET(self):
        path = (self.path or "/").split("?", 1)[0]
        if not self._loopback_ok():
            self._refuse_remote()
            return
        if self._data_path_forbidden(path) or self._static_escapes_root(path):
            self.send_error(403, "forbidden")
            return
        if path.startswith("/api/catalog/"):
            if self._catalog_get(path):
                return
        if self._maybe_overlay_sidecar(path):
            return
        if path == "/api/export/mp4":
            if not self._from_app():
                self._send_json({"ok": False, "error": "only the local app can use the exporter"}, 403)
                return
            self._send_json({"ok": True, "ffmpeg": bool(ffmpeg_export.find_ffmpeg())})
            return
        if path in ("/api/packs", "/api/packs.json"):
            self._send_json(local_tiles.packs_status(ROOT))
            return
        if path == "/api/geocode/census":
            # Loopback-only Census geocoder proxy. The address is not logged.
            if not self._from_app():
                self._send_json({"ok": False, "error": "only the local app can use the Census proxy"}, 403)
                return
            from urllib.parse import parse_qs
            qs = (self.path or "").split("?", 1)
            address = ""
            if len(qs) == 2:
                q = parse_qs(qs[1], keep_blank_values=True)
                address = (q.get("address") or [""])[0]
            ok, err = census_geocode.address_ok(address)
            if not ok:
                self._send_json({"ok": False, "error": err}, 400)
                return
            status, payload = census_geocode.fetch(address)
            self._send_json(payload, status)
            return
        if path in ("/api/cache", "/api/cache.json"):
            base = local_tiles.data_dir(ROOT)
            self._send_json(tile_cache.cache_status(local_tiles.cache_root(base)))
            return
        if path in ("/api/tools", "/api/tools.json"):
            if not command_api.command_request_ok(self.headers, PORT):
                self._send_json({"ok": False, "error": "only localhost can read the command list"}, 403)
                return
            self._send_json(command_api.tools_payload())
            return
        if path in ("/api/command/log", "/api/command/log.json"):
            if not command_api.command_request_ok(self.headers, PORT):
                self._send_json({"ok": False, "error": "only localhost can read the command log"}, 403)
                return
            self._send_json({"ok": True, "log": command_api.recent_log()})
            return
        if path in ("/api/desks", "/api/desks.json", "/api/command/desks"):
            if not command_api.command_request_ok(self.headers, PORT):
                self._send_json({"ok": False, "error": "only localhost can list desks"}, 403)
                return
            self._send_json({"ok": True, "desks": command_api.BUS.list_desks()})
            return
        if path == "/api/command/next":
            if not self._from_app():
                self._send_json({"ok": False, "error": "only the local app can take commands"}, 403)
                return
            qs = (self.path or "").split("?", 1)
            wait = 20.0
            desk = ""
            focused = False
            title = ""
            gone = False
            if len(qs) == 2:
                from urllib.parse import parse_qs, unquote
                q = parse_qs(qs[1], keep_blank_values=True)
                if "wait" in q:
                    try:
                        wait = min(25.0, max(0.0, float(q["wait"][0])))
                    except ValueError:
                        wait = 20.0
                desk = (q.get("desk") or [""])[0]
                focused = (q.get("focused") or ["0"])[0] in ("1", "true", "yes")
                title = unquote((q.get("title") or [""])[0])[:200]
                gone = (q.get("gone") or ["0"])[0] in ("1", "true", "yes")
            if gone and desk:
                command_api.BUS.drop(desk)
                self.send_response(204)
                self.end_headers()
                return
            item = command_api.BUS.take(wait, desk_id=desk or None, focused=focused, title=title)
            if not item:
                self.send_response(204)
                self.end_headers()
                return
            self._send_json(item)
            return
        m = re.match(r"^/tiles/bluemarble/(\d+)/(\d+)/(\d+)\.(?:jpe?g|png)$", path)
        if m:
            z, x, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
            from_app = self._from_app()
            try:
                data, source = local_tiles.resolve_tile(
                    z, x, y,
                    pack=local_tiles.pack_path(local_tiles.data_dir(ROOT)),
                    cache=local_tiles.cache_dir(local_tiles.data_dir(ROOT)),
                    stream=from_app and local_tiles.allow_stream(),
                    write_through=from_app,
                )
            except Exception:
                data, source = None, "miss"
            if not data:
                self._send_empty_tile()
                return
            self._send_tile(data, source)
            return
        m = re.match(r"^/tiles/eox2016/(\d+)/(\d+)/(\d+)\.(?:jpe?g|png|jpg)$", path)
        if m:
            z, x, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
            from_app = self._from_app()
            try:
                data, source = local_tiles.resolve_eox_tile(
                    z, x, y, base=local_tiles.data_dir(ROOT),
                    stream=from_app and local_tiles.allow_eox_stream(),
                    write_through=from_app,
                )
            except Exception:
                data, source = None, "miss"
            if not data:
                self._send_empty_tile()
                return
            self._send_tile(data, source)
            return
        if self._data_path_forbidden(path) or self._static_escapes_root(path):
            self.send_error(403, "forbidden")
            return
        super().do_GET()

    def do_HEAD(self):
        path = (self.path or "/").split("?", 1)[0]
        if not self._loopback_ok():
            self._refuse_remote()
            return
        if self._data_path_forbidden(path) or self._static_escapes_root(path):
            self.send_error(403, "forbidden")
            return
        super().do_HEAD()

    def _read_json(self, max_bytes=command_api.LIMITS["payload"]):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = -1
        if n < 0 or n > max_bytes:
            return None, "payload too large or missing"
        raw = self.rfile.read(n) if n else b""
        if not raw:
            return None, "empty body"
        try:
            return json.loads(raw.decode("utf-8")), None
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None, "body must be JSON"

    def do_POST(self):
        path = (self.path or "/").split("?", 1)[0]
        if not self._loopback_ok():
            self._refuse_remote()
            return
        if path == "/api/cache/clear":
            if not self._from_app():
                self.send_error(403, "only the local app can clear the cache")
                return
            removed = tile_cache.clear_cache(local_tiles.cache_root(local_tiles.data_dir(ROOT)))
            self._send_json({"cleared": True, "bytesRemoved": removed})
            return
        if path == "/api/command":
            if not command_api.command_request_ok(self.headers, PORT):
                self._send_json({"ok": False, "error": "only localhost can send commands"}, 403)
                return
            payload, err = self._read_json()
            if err:
                self._send_json({"ok": False, "error": err}, 400)
                return
            desk = None
            if isinstance(payload, dict):
                desk = payload.pop("desk", None) or payload.pop("target", None)
            ok, error, normalized = command_api.validate_command(payload)
            if not ok:
                command_api.log_command({"id": None, "cmd": (payload or {}).get("cmd") if isinstance(payload, dict) else None, "args": {}, "ok": False, "error": error})
                self._send_json({"ok": False, "error": error}, 400)
                return
            result, status = command_api.BUS.submit(normalized, desk=desk)
            self._send_json(result, status)
            return
        if path == "/api/command/result":
            if not self._from_app():
                self._send_json({"ok": False, "error": "only the local app can complete commands"}, 403)
                return
            payload, err = self._read_json(64 * 1024)
            if err or not isinstance(payload, dict):
                self._send_json({"ok": False, "error": err or "result must be a JSON object"}, 400)
                return
            ok = command_api.BUS.complete(str(payload.get("id") or ""), payload)
            self._send_json({"ok": ok}, 200 if ok else 404)
            return
        if path == "/api/export/mp4":
            # Optional local transcode (WebM in, MP4 out) with a fixed ffmpeg command line.
            if not self._from_app():
                self._send_json({"ok": False, "error": "only the local app can use the exporter"}, 403)
                return
            try:
                n = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                n = -1
            if n <= 0 or n > ffmpeg_export.MAX_INPUT_BYTES:
                self._send_json({"ok": False, "error": "video is empty or over the 2 GiB cap"}, 413)
                return
            started = {"sent": False}

            def start(size):
                # Upload done: no read timeout while the response streams back.
                self.connection.settimeout(None)
                started["sent"] = True
                self.send_response(200)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Length", str(size))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()

            self.connection.settimeout(ffmpeg_export.READ_TIMEOUT_SEC)
            try:
                ffmpeg_export.transcode_stream(self.rfile.read, n, write=self.wfile.write, start=start)
            except ffmpeg_export.ExportError as e:
                self.connection.settimeout(None)
                if not started["sent"]:
                    self._send_json({"ok": False, "error": str(e)}, 400)
                self.close_connection = True
                return
            except (BrokenPipeError, ConnectionResetError):
                self.close_connection = True
                return
            self.connection.settimeout(None)
            return
        if path == "/api/share-pack":
            # Dry run (confirm false) returns the check report; confirm true returns the HTML file.
            if not self._from_app():
                self._send_json({"ok": False, "error": "only the local app can build a share pack"}, 403)
                return
            payload, err = self._read_json(export_share_pack.MAX_EPISODE_BYTES + 64 * 1024)
            if err or not isinstance(payload, dict):
                self._send_json({"ok": False, "error": err or "request must be a JSON object"}, 400)
                return
            tiles = str(payload.get("tiles") or "outline")
            if tiles not in export_share_pack.TILE_CHOICES:
                self._send_json({"ok": False, "error": "unknown map add-on"}, 400)
                return
            ids = payload.get("storyIds")
            ids = [str(x) for x in ids][:200] if isinstance(ids, list) else None
            try:
                result = export_share_pack.plan(payload.get("episode"), payload.get("label") or None,
                                                payload.get("license") or None, tiles, None,
                                                local_tiles.data_dir(ROOT), ids)
            except export_share_pack.ShareError as e:
                self._send_json({"ok": False, "error": str(e), "reasons": e.reasons[:50]}, 400)
                return
            html = result.pop("html")
            if payload.get("confirm") is True:
                self._send_bytes(html.encode("utf-8"), "text/html; charset=utf-8")
                return
            result["written"] = False
            self._send_json(result)
            return
        if path in ("/api/catalog/export", "/api/catalog/export.json"):
            if not self._from_app():
                self._send_json({"ok": False, "error": "only the local app can export the catalog"}, 403)
                return
            payload, err = self._read_json(256 * 1024)
            if err or not isinstance(payload, dict):
                self._send_json({"ok": False, "error": err or "export must be a JSON object"}, 400)
                return
            result = catalog_mod.export_settings(payload, self._catalog_base())
            self._send_json(result, 200 if result.get("ok") else 400)
            return
        if path in ("/api/catalog/import", "/api/catalog/import.json"):
            if not self._from_app():
                self._send_json({"ok": False, "error": "only the local app can import the catalog"}, 403)
                return
            payload, err = self._read_json(16 * 1024)
            if err or not isinstance(payload, dict):
                self._send_json({"ok": False, "error": err or "import must be a JSON object"}, 400)
                return
            rel = str(payload.get("file") or "")
            result = catalog_mod.import_settings(rel, self._catalog_base())
            self._send_json(result, 200 if result.get("ok") else 400)
            return
        self.send_error(404, "not found")

    def log_message(self, fmt, *args):
        pass


def main():
    socketserver.TCPServer.allow_reuse_address = True
    try:
        httpd = ThreadingServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        print(f"Port {PORT} is busy ({e}). Try: START-GLOBEDESK.bat 8090")
        sys.exit(1)
    command_api.set_log_path(command_api.default_log_path(local_tiles.data_dir(ROOT)))
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
