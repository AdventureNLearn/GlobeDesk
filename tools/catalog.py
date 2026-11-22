#!/usr/bin/env python3
"""Local, untracked personal catalog under GLOBEDESK_DATA.

The public repo ships only generic SAMPLE sidecars. Personal desks, stories,
claims, research, records, layouts, and settings live in this data folder and
are not tracked. This module writes the folder layout, CATALOG.md, and the
layout/settings export files used by the local serve.py catalog APIs.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))
import local_tiles

CATALOG_DIRS = ("desks", "stories", "claims", "research", "records", "layouts", "settings")

# Repo-relative URL -> path under GLOBEDESK_DATA. Only these static paths are
# overlaid; the handler never serves an arbitrary data-dir file as a repo path.
SIDECAR_OVERLAY = {
    "/newsdesk/outbound.json": "desks/outbound.json",
    "/newsdesk/claims.json": "claims/claims.json",
    "/newsdesk/research.json": "research/research.json",
    "/newsdesk/records.json": "records/records.json",
}

SETTINGS_SCHEMA = "globedesk.catalog-settings/1"
MAX_FILE_BYTES = 256 * 1024
MAX_VALUE_BYTES = 64 * 1024
MAX_KEY_CHARS = 256
LAYOUT_SCHEMA = "globedesk.catalog-layout/1"
KEY_RE = re.compile(r"^(globedesk|gobedesk)\.")
SAFE_FILE = re.compile(r"^[A-Za-z0-9._-]+$")
NY = timezone(timedelta(hours=-5))


def data_dir(root: str | os.PathLike | None = None) -> Path:
    return local_tiles.data_dir(root)


def ensure_dirs(base: str | os.PathLike | None = None) -> Path:
    root = Path(base) if base is not None else data_dir()
    root.mkdir(parents=True, exist_ok=True)
    for name in CATALOG_DIRS:
        (root / name).mkdir(parents=True, exist_ok=True)
    return root


def overlay_rel(url_path: str) -> str | None:
    path = (url_path or "/").split("?", 1)[0]
    return SIDECAR_OVERLAY.get(path)


def overlay_file(url_path: str, base: str | os.PathLike | None = None) -> Path | None:
    rel = overlay_rel(url_path)
    if not rel:
        return None
    root = Path(base) if base is not None else data_dir()
    candidate = (root / rel).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    if candidate.is_file():
        return candidate
    return None


def _iso_now() -> str:
    return datetime.now(NY).strftime("%Y-%m-%dT%H:%M:%S") + " America/New_York"


def _stamp() -> str:
    return datetime.now(NY).strftime("%Y%m%d-%H%M%S")


def _date_of(obj: dict, fallback: str = "") -> str:
    for key in ("generated", "exported", "checked", "date", "updated"):
        val = obj.get(key) if isinstance(obj, dict) else None
        if isinstance(val, str) and val.strip():
            return val.strip()[:32]
    return fallback


def _safe_under(root: Path, rel: str) -> Path | None:
    if not rel or rel.startswith("/") or "\\" in rel or ".." in Path(rel).parts:
        return None
    top = rel.split("/", 1)[0]
    if top not in CATALOG_DIRS:
        return None
    candidate = (root / rel).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate


def list_items(base: str | os.PathLike | None = None) -> list[dict]:
    """Return catalog rows: name, type, date, file (repo-relative to data dir)."""
    root = ensure_dirs(base)
    items: list[dict] = []

    outbound = root / "desks" / "outbound.json"
    if outbound.is_file():
        try:
            doc = json.loads(outbound.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            doc = {}
        date = _date_of(doc, "")
        for tg in doc.get("targets") or []:
            if not isinstance(tg, dict):
                continue
            items.append({
                "name": str(tg.get("label") or tg.get("id") or "desk"),
                "type": "desk",
                "date": date,
                "file": "desks/outbound.json",
                "id": str(tg.get("id") or ""),
            })

    for kind, folder, key in (
        ("claim", "claims", "claims"),
        ("research", "research", "stories"),
        ("record", "records", "catalogs"),
    ):
        path = root / folder / f"{folder}.json"
        if not path.is_file():
            continue
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            doc = {}
        date = _date_of(doc, "")
        rows = doc.get(key) or []
        if not rows and kind == "research":
            items.append({"name": path.name, "type": kind, "date": date, "file": f"{folder}/{folder}.json", "id": ""})
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            name = row.get("name") or row.get("label") or row.get("title") or row.get("id") or row.get("storyId") or path.name
            items.append({
                "name": str(name),
                "type": kind,
                "date": _date_of(row, date),
                "file": f"{folder}/{folder}.json",
                "id": str(row.get("id") or row.get("storyId") or ""),
            })

    for folder, typ in (("stories", "story"), ("layouts", "layout"), ("settings", "settings")):
        d = root / folder
        if not d.is_dir():
            continue
        for p in sorted(d.iterdir()):
            if not p.is_file() or p.name.startswith("."):
                continue
            date = ""
            name = p.stem
            ident = ""
            if p.suffix.lower() == ".json":
                try:
                    doc = json.loads(p.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    doc = None
                if isinstance(doc, dict):
                    date = _date_of(doc, "")
                    name = str(doc.get("title") or doc.get("name") or doc.get("show") or p.stem)
                    ident = str(doc.get("id") or "")
                    if typ == "settings" and not date:
                        date = _date_of(doc, "")
            if not date:
                try:
                    date = datetime.fromtimestamp(p.stat().st_mtime, NY).strftime("%Y-%m-%d")
                except OSError:
                    date = ""
            items.append({
                "name": name,
                "type": typ,
                "date": date,
                "file": f"{folder}/{p.name}",
                "id": ident,
            })

    return items


def catalog_md(items: list[dict]) -> str:
    lines = [
        "# Personal catalog",
        "",
        "Local, untracked work in this GLOBEDESK_DATA folder. These files are not shipped with the public GitHub or grok.me tree.",
        "",
        f"Updated: {_iso_now()}",
        "",
        "| Name | Type | Date | File |",
        "| --- | --- | --- | --- |",
    ]
    for it in items:
        name = str(it.get("name") or "").replace("|", "/")
        typ = str(it.get("type") or "").replace("|", "/")
        date = str(it.get("date") or "").replace("|", "/")
        file = str(it.get("file") or "").replace("|", "/")
        lines.append(f"| {name} | {typ} | {date} | {file} |")
    if not items:
        lines.append("| (empty) | — | — | — |")
    lines.append("")
    return "\n".join(lines)


def write_catalog_md(base: str | os.PathLike | None = None) -> Path:
    root = ensure_dirs(base)
    path = root / "CATALOG.md"
    path.write_text(catalog_md(list_items(root)), encoding="utf-8")
    return path


def _filter_items(items: dict) -> dict[str, str]:
    """Export helper: keep globedesk.*/gobedesk.* keys and coerce values to strings."""
    out = {}
    if not isinstance(items, dict):
        return out
    for key, val in items.items():
        if not isinstance(key, str) or not KEY_RE.match(key):
            continue
        if val is None:
            continue
        text = val if isinstance(val, str) else json.dumps(val)
        if len(key) > MAX_KEY_CHARS or len(text.encode("utf-8")) > MAX_VALUE_BYTES:
            continue
        out[key] = text
    return out


def _import_items(items) -> tuple[dict[str, str] | None, str | None]:
    """Import helper: require string values and enforce size caps. Fail closed."""
    if not isinstance(items, dict):
        return None, "settings file has no items"
    out = {}
    for key, val in items.items():
        if not isinstance(key, str) or not KEY_RE.match(key):
            continue
        if not isinstance(val, str):
            return None, "settings values must be strings"
        if len(key) > MAX_KEY_CHARS:
            return None, "settings key too long"
        if len(val.encode("utf-8")) > MAX_VALUE_BYTES:
            return None, "settings value too large"
        out[key] = val
    if not out:
        return None, "no globedesk.* or gobedesk.* keys in file"
    return out, None


def export_settings(payload: dict, base: str | os.PathLike | None = None) -> dict:
    root = ensure_dirs(base)
    items = _filter_items((payload or {}).get("items") or payload or {})
    if not items:
        return {"ok": False, "error": "no globedesk.* or gobedesk.* settings to export"}
    stamp = _stamp()
    exported = _iso_now()
    settings_rel = f"settings/settings-{stamp}.json"
    settings_path = root / settings_rel
    doc = {"schema": SETTINGS_SCHEMA, "exported": exported, "items": items}
    settings_path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    result = {"ok": True, "file": settings_rel, "count": len(items), "files": [settings_rel]}
    shell = items.get("globedesk.shell.v1") or items.get("gobedesk.shell.v1")
    if shell is not None:
        layout_rel = f"layouts/layout-{stamp}.json"
        layout_path = root / layout_rel
        layout_doc = {
            "schema": LAYOUT_SCHEMA,
            "exported": exported,
            "items": {k: items[k] for k in items if k.endswith("shell.v1") or k.startswith("globedesk.shell") or k.startswith("gobedesk.shell")},
        }
        layout_path.write_text(json.dumps(layout_doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        result["layout"] = layout_rel
        result["files"].append(layout_rel)
    write_catalog_md(root)
    return result


def read_catalog_file(rel: str, base: str | os.PathLike | None = None) -> dict:
    root = ensure_dirs(base)
    path = _safe_under(root, rel or "")
    if path is None or not path.is_file():
        return {"ok": False, "error": "unknown catalog file"}
    try:
        size = path.stat().st_size
    except OSError:
        return {"ok": False, "error": "could not read file"}
    if size > MAX_FILE_BYTES:
        return {"ok": False, "error": "catalog file too large"}
    if path.suffix.lower() == ".json":
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            return {"ok": False, "error": "invalid json"}
        return {"ok": True, "file": rel, "doc": doc}
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return {"ok": False, "error": "could not read file"}
    return {"ok": True, "file": rel, "text": text}


def import_settings(rel: str, base: str | os.PathLike | None = None) -> dict:
    got = read_catalog_file(rel, base)
    if not got.get("ok"):
        return got
    doc = got.get("doc")
    if not isinstance(doc, dict):
        return {"ok": False, "error": "settings file must be JSON"}
    items = doc.get("items") if isinstance(doc.get("items"), dict) else None
    if items is None:
        return {"ok": False, "error": "settings file has no items"}
    filtered, err = _import_items(items)
    if err:
        return {"ok": False, "error": err}
    return {"ok": True, "file": rel, "items": filtered, "count": len(filtered)}


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    cmd = args[0] if args else "write-md"
    base = None
    if "--data" in args:
        i = args.index("--data")
        if i + 1 >= len(args):
            print("catalog: --data needs a folder", file=sys.stderr)
            return 2
        base = args[i + 1]
    if cmd in ("write-md", "init", "organize"):
        root = ensure_dirs(base)
        path = write_catalog_md(root)
        print(f"wrote {path} ({len(list_items(root))} items)")
        return 0
    if cmd == "list":
        for it in list_items(base):
            print(f"{it['type']}\t{it['date']}\t{it['file']}\t{it['name']}")
        return 0
    print("usage: catalog.py [init|write-md|list] [--data DIR]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
