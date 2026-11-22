#!/usr/bin/env python3
"""Local-only helper: write one personal catalog item as a public-tree candidate.

The tool never commits. It strips personal fields and desk links, requires a
source and a license on every record (missing values become [UNKNOWN] and the
run is blocked), requires a PUBLIC / RECORDED / PROJECTED label, and refuses
to write if scrub_scan or name_scan report a hit. Pass --yes only after the
owner has confirmed this specific item. Do not batch-promote.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
ROOT = TOOLS_DIR.parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))
import catalog as catalog_mod
import local_tiles
import name_scan

PERSONAL_FIELD = re.compile(r"^(owner|address|phone|email|valuation|street|occupant)([A-Z_].*)?$", re.I)
STRIP_KEYS = {"openIn", "openin"}
LABELS = ("PUBLIC", "RECORDED", "PROJECTED")
UNKNOWN = "[UNKNOWN]"
LAYERS_DIR = ROOT / "episodes" / "layers"


class PromoteError(Exception):
    def __init__(self, message: str, reasons: list[str] | None = None):
        super().__init__(message)
        self.reasons = reasons or [message]


def load_item(path: Path, catalog_id: str | None) -> tuple[dict, str]:
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise PromoteError(f"could not read catalog item: {e}")
    if not isinstance(doc, dict):
        raise PromoteError("catalog item must be a JSON object")
    if not catalog_id:
        return doc, path.stem
    if isinstance(doc.get("catalogs"), list):
        for row in doc["catalogs"]:
            if isinstance(row, dict) and str(row.get("id") or "") == catalog_id:
                return {"schema": doc.get("schema") or "globedesk.records/1", "catalogs": [row]}, catalog_id
        raise PromoteError(f"no catalog id {catalog_id} in {path}")
    if isinstance(doc.get("stories"), list):
        for row in doc["stories"]:
            if isinstance(row, dict) and str(row.get("id") or "") == catalog_id:
                out = dict(doc)
                out["stories"] = [row]
                return out, catalog_id
        raise PromoteError(f"no story id {catalog_id} in {path}")
    raise PromoteError("--id only applies to a records sidecar or an episode file")


def strip_personal(obj, report: list[str], path: str = "$"):
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k in STRIP_KEYS:
                report.append(f"stripped desk link {path}.{k}")
                continue
            if PERSONAL_FIELD.match(str(k)):
                report.append(f"stripped personal field {path}.{k}")
                continue
            out[k] = strip_personal(v, report, f"{path}.{k}")
        return out
    if isinstance(obj, list):
        return [strip_personal(v, report, f"{path}[{i}]") for i, v in enumerate(obj)]
    return obj


def _blank(val) -> bool:
    if val is None:
        return True
    if isinstance(val, str) and not val.strip():
        return True
    if isinstance(val, (list, dict)) and not val:
        return True
    return False


def _has_source(node: dict) -> bool:
    for key in ("source", "sources", "citations", "creditUrl", "sourceUrl"):
        val = node.get(key)
        if isinstance(val, str) and val.strip() and val.strip() != UNKNOWN:
            return True
        if isinstance(val, list) and val:
            return True
        if isinstance(val, dict) and val:
            return True
    return False


def _has_license(node: dict) -> bool:
    val = node.get("license")
    if isinstance(val, str) and val.strip() and val.strip() != UNKNOWN:
        return True
    return False


def walk_records(doc: dict) -> list[tuple[str, dict]]:
    rows: list[tuple[str, dict]] = []
    if isinstance(doc.get("catalogs"), list):
        for i, cat in enumerate(doc["catalogs"]):
            if isinstance(cat, dict):
                rows.append((f"catalogs[{i}]", cat))
                for j, rec in enumerate(cat.get("records") or []):
                    if isinstance(rec, dict):
                        rows.append((f"catalogs[{i}].records[{j}]", rec))
        return rows
    if isinstance(doc.get("stories"), list):
        if isinstance(doc, dict):
            rows.append(("$", doc))
        for i, st in enumerate(doc["stories"]):
            if isinstance(st, dict):
                rows.append((f"stories[{i}]", st))
        return rows
    if doc.get("type") == "FeatureCollection" and isinstance(doc.get("features"), list):
        if isinstance(doc.get("properties"), dict):
            rows.append(("properties", doc["properties"]))
        else:
            rows.append(("$", doc))
        for i, feat in enumerate(doc["features"]):
            if isinstance(feat, dict):
                props = feat.get("properties") if isinstance(feat.get("properties"), dict) else feat
                rows.append((f"features[{i}]", props))
        return rows
    rows.append(("$", doc))
    return rows


def require_source_license(doc: dict) -> list[str]:
    reasons = []
    for path, node in walk_records(doc):
        if not _has_source(node):
            if "source" not in node and "sources" not in node and "citations" not in node:
                node["source"] = UNKNOWN
            reasons.append(f"{path}: source is {UNKNOWN} or missing")
        if not _has_license(node):
            node["license"] = UNKNOWN
            reasons.append(f"{path}: license is {UNKNOWN} or missing")
    return reasons


def apply_label(doc: dict, label: str | None) -> str:
    existing = str(doc.get("publicStatus") or doc.get("label") or "").strip().upper()
    chosen = (label or existing or "").strip().upper()
    if chosen not in LABELS:
        raise PromoteError(
            "every public candidate needs a PUBLIC, RECORDED, or PROJECTED label (pass --label)"
        )
    doc["publicStatus"] = chosen
    return chosen


def run_scrub(candidate: Path) -> list[str]:
    with tempfile.TemporaryDirectory() as td:
        zpath = Path(td) / "candidate.zip"
        with zipfile.ZipFile(zpath, "w") as z:
            z.write(candidate, arcname=candidate.name)
        proc = subprocess.run(
            [sys.executable, "-B", str(TOOLS_DIR / "scrub_scan.py"), "--zip", str(zpath)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
        )
    if proc.returncode == 0:
        return []
    lines = [ln for ln in (proc.stdout or "").splitlines() if ln.strip() and not ln.startswith("scrub scan:")]
    return lines or [proc.stderr.strip() or "scrub_scan failed"]


def require_patterns(patterns: str | None) -> str:
    """Fail closed when no name-scan patterns are available."""
    src = patterns
    if not src:
        default = name_scan.default_patterns_file()
        src = str(default) if default else None
    if not src:
        raise PromoteError(
            "blocked: name-scan patterns are required (pass --patterns or add GLOBEDESK_DATA/settings/name-scan-patterns.json). Nothing was written."
        )
    path = Path(src)
    if not path.is_file():
        raise PromoteError(f"blocked: name-scan patterns file is missing: {src}")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise PromoteError(f"blocked: could not read name-scan patterns: {e}")
    if isinstance(raw, dict) and "patterns" in raw:
        raw = raw["patterns"]
    if not isinstance(raw, list) or not [p for p in raw if str(p).strip()]:
        raise PromoteError("blocked: name-scan patterns file is empty. Nothing was written.")
    return str(path)


def run_name_scan(candidate: Path, patterns: str | None) -> list[str]:
    patterns = require_patterns(patterns)
    cmd = [sys.executable, "-B", str(TOOLS_DIR / "name_scan.py"), "--file", str(candidate), "--literal"]
    if patterns:
        cmd.extend(["--patterns", patterns])
    proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True)
    if proc.returncode == 0:
        return []
    lines = [ln for ln in (proc.stdout or "").splitlines() if ln.strip() and not ln.startswith("name scan:")]
    return lines or [proc.stderr.strip() or "name_scan failed"]


def dest_path(name: str, dest: str | None) -> Path:
    if dest:
        p = Path(dest)
        return p if p.is_absolute() else (ROOT / p)
    safe = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-") or "candidate"
    return LAYERS_DIR / f"{safe}.json"


def promote(src: Path, catalog_id: str | None, label: str | None, dest: str | None, yes: bool, patterns: str | None) -> dict:
    doc, ident = load_item(src, catalog_id)
    notes: list[str] = []
    cleaned = strip_personal(doc, notes)
    missing = require_source_license(cleaned)
    if missing:
        raise PromoteError("blocked: source and license are required on every record", missing)
    apply_label(cleaned, label)
    patterns = require_patterns(patterns)
    out = dest_path(ident, dest)
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / out.name
        tmp.write_text(json.dumps(cleaned, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        scrub_hits = run_scrub(tmp)
        if scrub_hits:
            raise PromoteError("blocked: scrub_scan reported hits", scrub_hits)
        name_hits = run_name_scan(tmp, patterns)
        if name_hits:
            raise PromoteError("blocked: name_scan reported hits", name_hits)
        if not yes:
            raise PromoteError(
                "refusing to write: owner YES is required for each promote (pass --yes after that confirmation). Nothing was written or committed.",
                [f"candidate would be {out}"],
            )
        out.parent.mkdir(parents=True, exist_ok=True)
        if out.exists():
            raise PromoteError(f"refusing to overwrite existing file {out}")
        shutil.copyfile(tmp, out)
    return {
        "ok": True,
        "path": str(out),
        "id": ident,
        "publicStatus": cleaned.get("publicStatus"),
        "stripped": notes,
        "committed": False,
        "note": "Wrote a public candidate only. Nothing was committed.",
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Write one catalog item as a public-tree candidate. Never commits.")
    ap.add_argument("--item", required=True, help="Path to a catalog JSON file (absolute, or relative to GLOBEDESK_DATA).")
    ap.add_argument("--id", dest="catalog_id", help="Optional catalog or story id inside that file.")
    ap.add_argument("--label", choices=LABELS, help="PUBLIC, RECORDED, or PROJECTED.")
    ap.add_argument("--dest", help="Output path. Default: episodes/layers/<id>.json under the repo.")
    ap.add_argument("--patterns", help="JSON patterns file for name_scan.")
    ap.add_argument("--yes", action="store_true", help="Write the candidate. Still does not commit. Owner YES required.")
    ap.add_argument("--data", help="GLOBEDESK_DATA root when --item is relative.")
    a = ap.parse_args()
    base = Path(a.data) if a.data else local_tiles.data_dir(ROOT)
    src = Path(a.item)
    if not src.is_file():
        src = base / a.item
    if not src.is_file():
        print(f"promote: no such item {a.item}", file=sys.stderr)
        return 2
    try:
        result = promote(src, a.catalog_id, a.label, a.dest, a.yes, a.patterns)
    except PromoteError as e:
        print(f"promote: {e}", file=sys.stderr)
        for r in e.reasons:
            print(f"  - {r}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    print("Not committed. Do not git add this file unless the owner asked to ship this exact item.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
