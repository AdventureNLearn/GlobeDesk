#!/usr/bin/env python3
"""Build an offline GlobeDesk share pack: one self-contained .globedesk.html file.

The pack plays a story read-only (Play, Pause, Scrub) from disk with no server.
Only stories that pass the promote checks go in: personal fields and desk links
are stripped (tools/promote_layer.py), every story needs a real https source and a
licence, the item needs a PUBLIC / RECORDED / PROJECTED label, and scrub_scan and
name_scan must both be clean. Nothing is written without an explicit confirm
(--yes on the CLI, the confirm box in the app). The tool never commits.

Map: the bundled Natural Earth outline by default. Optional add-ons come only from
packs already on this device: a low-zoom cut of the local NASA Blue Marble MBTiles
(public domain) or the local 2016 EOX Sentinel-2 cloudless region pack (CC BY 4.0).
No OpenFreeMap tiles, no NC-SA mosaics, no keys, no live embeds, no network.
Caps: 20 MiB for an outline pack, 80 MiB with tiles.
"""
from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import json
import re
import sys
import tempfile
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
ROOT = TOOLS_DIR.parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))
import local_tiles  # noqa: E402
import promote_layer  # noqa: E402

SCHEMA = "globedesk.share/1"
MIB = 1024 * 1024
CAP_OUTLINE = 20 * MIB
CAP_TILES = 80 * MIB
MAX_EPISODE_BYTES = 8 * MIB
BLUEMARBLE_MAX_ZOOM = 4
TILE_CHOICES = ("outline", "bluemarble", "eox-region")
UNKNOWN = promote_layer.UNKNOWN
# Not carried into a pack in v1.3: local media bytes, the user content layer, and event layers.
# Also left out: desk links and private production notes.
DROP_KEYS = {"mediaBin", "media", "voiceover", "audioOverlays", "content", "eventLayers", "script", "gisOverlayIds",
             "deskId", "desk", "notes", "privateNotes"}
NC_RE = re.compile(r"\bnc(-sa)?\b|non-?commercial", re.I)
FORBIDDEN_IN_PACK = re.compile(r"openfreemap\.org|api\.maptiler\.com|youtube-nocookie|[?&]key=", re.I)

ATTR_NE = {"text": "Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com (public domain).", "url": "https://www.naturalearthdata.com/about/terms-of-use/"}
ATTR_MAPLIBRE = {"text": "MapLibre GL JS (BSD-3-Clause). Licence text below.", "url": "https://github.com/maplibre/maplibre-gl-js"}
ATTR_GLOBEDESK = {"text": "GlobeDesk player by AdventureNLearn (MIT). Licence text below.", "url": "https://github.com/AdventureNLearn/GlobeDesk"}
ATTR_BLUEMARBLE = {"text": "Imagery: NASA Blue Marble (August 2004, shaded relief and bathymetry; NASA Earth Observatory / MODIS), public domain.", "url": "https://earthobservatory.nasa.gov/features/BlueMarble"}
ATTR_EOX = {"text": "Satellite: Sentinel-2 cloudless 2016 by EOX (contains modified Copernicus Sentinel data 2016), CC BY 4.0.", "url": "https://s2maps.eu"}


class ShareError(Exception):
    def __init__(self, message: str, reasons: list[str] | None = None):
        super().__init__(message)
        self.reasons = reasons or [message]


def _https(url) -> bool:
    if not isinstance(url, str) or not url.startswith("https://") or any(c.isspace() or ord(c) < 32 for c in url):
        return False
    host = url[len("https://"):].split("/")[0].split("?")[0].split("#")[0]
    return bool(host) and "@" not in host and "\\" not in url and url.strip() != UNKNOWN


def _known(v) -> bool:
    return isinstance(v, str) and v.strip() and v.strip() != UNKNOWN


def _drop(obj, notes: list[str], path: str = "$"):
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k in DROP_KEYS:
                if v not in (None, "", [], {}):
                    notes.append(f"left out {path}.{k} (not packed in v1.3)")
                continue
            out[k] = _drop(v, notes, f"{path}.{k}")
        return out
    if isinstance(obj, list):
        return [_drop(v, notes, f"{path}[{i}]") for i, v in enumerate(obj)]
    return obj


def build_candidate(episode: dict, label: str | None, license_text: str | None, story_ids: list[str] | None = None) -> tuple[dict, list[str]]:
    """Apply the promote rules to an episode. Returns (candidate, notes) or raises ShareError."""
    if not isinstance(episode, dict) or not isinstance(episode.get("stories"), list) or not episode["stories"]:
        raise ShareError("the item must be an episode with at least one story")
    doc = copy.deepcopy(episode)
    if story_ids:
        want = set(str(x) for x in story_ids)
        doc["stories"] = [s for s in doc["stories"] if isinstance(s, dict) and str(s.get("id")) in want]
        if not doc["stories"]:
            raise ShareError("none of the chosen stories are in this episode")
    notes: list[str] = []
    doc = promote_layer.strip_personal(doc, notes)
    doc = _drop(doc, notes)
    reasons: list[str] = []
    lic = (license_text or "").strip()
    if lic and lic != UNKNOWN:
        if NC_RE.search(lic):
            reasons.append("non-commercial licences are not allowed in a share pack")
        doc.setdefault("license", lic)
        if not _known(doc.get("license")):
            doc["license"] = lic
    urls: list[str] = []
    for i, s in enumerate(doc["stories"]):
        if not isinstance(s, dict):
            reasons.append(f"stories[{i}]: not an object")
            continue
        if lic and not _known(s.get("license")):
            s["license"] = lic
        good = [x for x in (s.get("sources") or []) if isinstance(x, dict) and _https(x.get("url")) and x.get("url") != UNKNOWN]
        if _https(s.get("creditUrl")):
            urls.append(s["creditUrl"])
        if not good:
            reasons.append(f"stories[{i}] ({s.get('title') or s.get('id')}): needs at least one real https source")
        for x in good:
            if x["url"] not in urls:
                urls.append(x["url"])
        if isinstance(s.get("license"), str) and NC_RE.search(s["license"]):
            reasons.append(f"stories[{i}]: non-commercial licence is not allowed in a share pack")
    if urls:
        doc["sources"] = urls
    reasons.extend(promote_layer.require_source_license(doc))
    if reasons:
        raise ShareError("blocked: every story needs a real source and a licence", reasons)
    try:
        promote_layer.apply_label(doc, label)
    except promote_layer.PromoteError as e:
        raise ShareError(str(e))
    doc["schema"] = episode.get("schema") or doc.get("schema")
    return doc, notes


def run_scans(candidate: dict, patterns: str | None) -> None:
    try:
        pats = promote_layer.require_patterns(patterns)
    except promote_layer.PromoteError as e:
        raise ShareError(str(e))
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "share-candidate.json"
        tmp.write_text(json.dumps(candidate, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        hits = promote_layer.run_scrub(tmp)
        if hits:
            raise ShareError("blocked: scrub_scan reported hits", hits)
        hits = promote_layer.run_name_scan(tmp, pats)
        if hits:
            raise ShareError("blocked: name_scan reported hits", hits)


def _pack_tiles_from_mbtiles(path: Path, max_zoom: int, bbox: list[float] | None = None) -> dict[str, str]:
    conn = local_tiles._connect_ro(path)
    if conn is None:
        return {}
    out: dict[str, str] = {}
    try:
        rows = conn.execute("SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles WHERE zoom_level <= ?", (max_zoom,)).fetchall()
    finally:
        conn.close()
    allowed = None
    if bbox:
        allowed = set(local_tiles.tiles_for_bbox(bbox, 0, max_zoom))
    for z, x, tms_y, data in rows:
        y = local_tiles.tms_to_xyz(z, tms_y)
        if allowed is not None and (z, x, y) not in allowed:
            continue
        if data:
            out[f"{z}/{x}/{y}"] = base64.b64encode(bytes(data)).decode("ascii")
    return out


def collect_tiles(choice: str, data_dir: Path) -> tuple[list[dict], dict[str, str], list[dict]]:
    """Return (tile layer specs, inlined tiles keyed 'layer/z/x/y', attributions). Local packs only."""
    if choice in (None, "", "outline"):
        return [], {}, []
    if choice not in TILE_CHOICES:
        raise ShareError(f"unknown map add-on {choice!r}")
    if choice == "bluemarble":
        pack = local_tiles.pack_path(data_dir)
        tiles = _pack_tiles_from_mbtiles(pack, BLUEMARBLE_MAX_ZOOM)
        if not tiles:
            raise ShareError("no local Blue Marble pack was found on this device. Build one with tools/fetch_bluemarble_pack.py, or choose the outline globe.")
        spec = {"id": "bm", "minzoom": 0, "maxzoom": BLUEMARBLE_MAX_ZOOM, "fade": True, "credit": ATTR_BLUEMARBLE["text"]}
        return [spec], {f"bm/{k}": v for k, v in tiles.items()}, [ATTR_BLUEMARBLE]
    region = local_tiles.list_region_specs()[0]
    lic = str(region.get("license") or "")
    if NC_RE.search(lic) or "CC BY 4.0" not in lic:
        raise ShareError("the region pack licence is not CC BY 4.0; it cannot go in a share pack")
    pack = local_tiles.region_pack_path(data_dir, region)
    tiles = _pack_tiles_from_mbtiles(pack, int(region["maxzoom"]))
    if not tiles:
        raise ShareError("no local 2016 EOX region pack was found on this device. Build it with tools/fetch_region_pack.py, or choose the outline globe.")
    spec = {"id": "eox", "minzoom": int(region["minzoom"]), "maxzoom": int(region["maxzoom"]), "bounds": list(region["bbox"]), "fade": False, "credit": ATTR_EOX["text"]}
    return [spec], {f"eox/{k}": v for k, v in tiles.items()}, [ATTR_EOX]


def _player_episode(doc: dict) -> dict:
    keep_ep = ("title", "show", "date", "handle", "sample", "demo", "license", "publicStatus", "sources")
    keep_story = ("id", "title", "summary", "date", "credit", "creditUrl", "asReported", "durationSec", "location", "camera", "cards", "captions", "sources", "highlight", "license")
    ep = {k: doc[k] for k in keep_ep if k in doc}
    ep["stories"] = [{k: s[k] for k in keep_story if k in s} for s in doc["stories"]]
    # Links in a pack are https only: javascript:, http:, data: and every other scheme are dropped.
    if isinstance(ep.get("sources"), list):
        ep["sources"] = [u for u in ep["sources"] if _https(u)]
    for s in ep["stories"]:
        s["sources"] = [{"label": x.get("label"), "url": x["url"]} if isinstance(x.get("label"), str) else {"url": x["url"]}
                        for x in (s.get("sources") or []) if isinstance(x, dict) and _https(x.get("url"))]
        if "creditUrl" in s and not _https(s.get("creditUrl")):
            del s["creditUrl"]
        loc = s.get("location") or {}
        s["location"] = {k: loc.get(k) for k in ("name", "lat", "lon", "precision", "verified") if k in loc}
        s["highlight"] = {"a3": (s.get("highlight") or {}).get("a3")} if isinstance(s.get("highlight"), dict) and (s.get("highlight") or {}).get("a3") else None
    return ep


def _safe_inline(js: str, name: str) -> str:
    low = js.lower()
    if "</script" in low or "<!--" in low:
        raise ShareError(f"{name} contains a sequence that cannot be inlined safely")
    return js


def _json_inline(obj) -> str:
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return s.replace("</", "<\\/").replace("<!--", "<\\!--").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def _sha(s: str) -> str:
    return "'sha256-" + base64.b64encode(hashlib.sha256(s.encode("utf-8")).digest()).decode("ascii") + "'"


def _read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def render_html(candidate: dict, tile_specs: list[dict], tiles: dict[str, str], tile_attr: list[dict]) -> str:
    ep = _player_episode(candidate)
    look = candidate.get("look") or {}
    pal = look.get("palette") or {}
    manifest = {
        "schema": SCHEMA,
        "label": candidate.get("publicStatus"),
        "license": candidate.get("license"),
        "look": {"badge": str(look.get("headerBadge") or "GLOBEDESK")[:24], "highlight": pal.get("highlight") or "#5ee7ff"},
        "episode": ep,
        "tiles": tile_specs,
        "attributions": [ATTR_NE, ATTR_MAPLIBRE, ATTR_GLOBEDESK] + tile_attr,
        "licenses": [
            {"name": "MapLibre GL JS licence (BSD-3-Clause)", "text": _read("vendor/LICENSE-maplibre.txt")},
            {"name": "GlobeDesk code licence (MIT)", "text": _read("LICENSE")},
        ],
    }
    scripts = [
        _safe_inline(_read("vendor/maplibre-gl.js"), "maplibre-gl.js"),
        _safe_inline(_read("data/land.js"), "land.js"),
        _safe_inline(_read("data/world.js"), "world.js"),
        "window.GD_SHARE=" + _json_inline(manifest) + ";",
    ]
    if tiles:
        scripts.append("window.GD_SHARE_TILES=" + _json_inline(tiles) + ";")
    scripts.append(_safe_inline(_read("js/frame-export.js"), "frame-export.js"))
    scripts.append(_safe_inline(_read("share/player.js"), "player.js"))
    styles = [_read("vendor/maplibre-gl.css"), _read("share/player.css")]
    for st in styles:
        if "</style" in st.lower():
            raise ShareError("a stylesheet cannot be inlined safely")
    csp = ("default-src 'none'; script-src " + " ".join(_sha(s) for s in scripts) +
           "; style-src " + " ".join(_sha(s) for s in styles) +
           "; img-src data: blob:; worker-src blob:; connect-src data: blob:; font-src data:; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'")
    title = str(ep.get("title") or "GlobeDesk story").replace("<", "").replace(">", "").replace("&", "and")[:160]
    head = (
        "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
        f"<meta http-equiv=\"Content-Security-Policy\" content=\"{csp}\">\n"
        "<meta name=\"referrer\" content=\"no-referrer\">\n"
        f"<meta name=\"generator\" content=\"GlobeDesk share pack ({SCHEMA})\">\n"
        f"<title>{title}</title>\n"
        + "".join(f"<style>{s}</style>\n" for s in styles)
        + "</head>\n"
    )
    body = (
        "<body>\n"
        "<header class=\"sp-top\"><span class=\"sp-brand\">GlobeDesk</span><span id=\"spTitle\" class=\"sp-title\"></span><span id=\"spLabel\" class=\"sp-label\"></span></header>\n"
        "<main class=\"sp-stage\" aria-label=\"Story\"><div id=\"spMap\"></div>"
        "<div class=\"sp-head\"><span id=\"spBadge\" class=\"sp-badge\"></span><span id=\"spStory\" class=\"sp-story\"></span></div>"
        "<div id=\"spCite\" class=\"sp-cite\" hidden></div><div id=\"spCards\" class=\"sp-cards\" aria-live=\"polite\"></div>"
        "<div id=\"spSample\" class=\"sp-sample\" hidden>SAMPLE • LOCATIONS APPROXIMATE • NOT VERIFIED</div>"
        "<div id=\"spCap\" class=\"sp-cap\" aria-live=\"polite\"></div></main>\n"
        "<nav class=\"sp-bar\" aria-label=\"Playback\"><button id=\"spPlay\" type=\"button\" aria-label=\"Play\">▶ Play</button>"
        "<input id=\"spScrub\" type=\"range\" min=\"0\" max=\"1\" value=\"0\" aria-label=\"Story position\"><span id=\"spTime\" class=\"sp-time\">0:00 / 0:00</span>"
        "<button id=\"spCreditsBtn\" type=\"button\" aria-expanded=\"false\" aria-controls=\"spCredits\">Credits &amp; sources</button></nav>\n"
        "<section id=\"spCredits\" class=\"sp-credits\" hidden><div id=\"spCreditsBody\"></div></section>\n"
        + "".join(f"<script>{s}</script>\n" for s in scripts)
        + "</body>\n</html>\n"
    )
    html = head + body
    # Belt and braces: a pack must never point at live tile hosts, keys or embeds.
    data_part = scripts[3] + (scripts[4] if tiles else "")
    if FORBIDDEN_IN_PACK.search(data_part):
        raise ShareError("the pack data references a live tile host, key or embed; refused")
    return html


def plan(episode: dict, label: str | None, license_text: str | None, tiles_choice: str = "outline",
         patterns: str | None = None, data_dir: Path | None = None, story_ids: list[str] | None = None) -> dict:
    """Dry run: run every check and size the pack. Writes nothing."""
    raw = json.dumps(episode, ensure_ascii=False).encode("utf-8")
    if len(raw) > MAX_EPISODE_BYTES:
        raise ShareError("the episode is over the 8 MiB project JSON limit")
    cand, notes = build_candidate(episode, label, license_text, story_ids)
    run_scans(cand, patterns)
    specs, tiles, attr = collect_tiles(tiles_choice or "outline", data_dir or local_tiles.data_dir(ROOT))
    html = render_html(cand, specs, tiles, attr)
    size = len(html.encode("utf-8"))
    cap = CAP_TILES if tiles else CAP_OUTLINE
    if size > cap:
        raise ShareError(f"the pack would be {size / MIB:.1f} MiB, over the {cap // MIB} MiB cap. Choose the outline globe or fewer stories.")
    return {
        "ok": True,
        "schema": SCHEMA,
        "label": cand.get("publicStatus"),
        "license": cand.get("license"),
        "stories": [{"id": s.get("id"), "title": s.get("title"), "sources": len([x for x in (s.get("sources") or []) if isinstance(x, dict) and x.get("url")]), "license": s.get("license")} for s in cand["stories"]],
        "stripped": notes,
        "tiles": tiles_choice or "outline",
        "tileCount": len(tiles),
        "bytes": size,
        "capBytes": cap,
        "attributions": [a["text"] for a in ([ATTR_NE, ATTR_MAPLIBRE, ATTR_GLOBEDESK] + attr)],
        "scans": {"scrub_scan": "clean", "name_scan": "clean"},
        "html": html,
    }


def file_name(episode: dict) -> str:
    base = f"{episode.get('date') or 'story'}-{episode.get('title') or 'globedesk'}"
    slug = re.sub(r"[^a-z0-9]+", "-", str(base).lower()).strip("-")[:80] or "globedesk-story"
    return slug + ".globedesk.html"


def main() -> int:
    ap = argparse.ArgumentParser(description="Build one offline GlobeDesk share pack (.globedesk.html). Dry run unless --yes. Never commits.")
    ap.add_argument("--episode", required=True, help="Episode JSON (.globedesk.json).")
    ap.add_argument("--label", choices=promote_layer.LABELS, help="PUBLIC, RECORDED, or PROJECTED.")
    ap.add_argument("--license", dest="license_text", help="Your licence for your own text, for stories that do not carry one (for example 'CC BY 4.0').")
    ap.add_argument("--tiles", choices=TILE_CHOICES, default="outline", help="Map add-on from a local pack. Default: outline.")
    ap.add_argument("--story", action="append", dest="stories", help="Only this story id (repeatable).")
    ap.add_argument("--patterns", help="JSON patterns file for name_scan.")
    ap.add_argument("--data", help="GLOBEDESK_DATA root for local tile packs.")
    ap.add_argument("--out", help="Output file. Default: ./<date>-<title>.globedesk.html")
    ap.add_argument("--yes", action="store_true", help="Write the pack after the checks pass. Owner confirm required.")
    a = ap.parse_args()
    try:
        episode = json.loads(Path(a.episode).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"share pack: could not read episode: {e}", file=sys.stderr)
        return 2
    try:
        result = plan(episode, a.label, a.license_text, a.tiles, a.patterns, Path(a.data) if a.data else None, a.stories)
    except ShareError as e:
        print(f"share pack: {e}", file=sys.stderr)
        for r in e.reasons:
            print(f"  - {r}", file=sys.stderr)
        return 1
    html = result.pop("html")
    out = Path(a.out) if a.out else Path.cwd() / file_name(episode)
    result["out"] = str(out)
    if not a.yes:
        result["written"] = False
        print(json.dumps(result, indent=2))
        print("Dry run only. Nothing was written. Pass --yes after the owner confirms this exact pack.")
        return 0
    if out.exists():
        print(f"share pack: refusing to overwrite {out}", file=sys.stderr)
        return 1
    out.write_text(html, encoding="utf-8")
    result["written"] = True
    print(json.dumps(result, indent=2))
    print("Written locally. Not committed and not uploaded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
