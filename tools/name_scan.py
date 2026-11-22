#!/usr/bin/env python3
"""Scan shipped text for names that must not appear in the public tree.

Patterns are never stored in this repository. Pass them with --pattern,
--patterns FILE, or a JSON list at GLOBEDESK_DATA/settings/name-scan-patterns.json
(or GLOBEDESK_NAME_PATTERNS). Exit code 1 on any hit. Hits are reported as
path:line: pattern #N — the matching text is not echoed.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
ROOT = TOOLS_DIR.parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))
import local_tiles

TEXT_EXT = {
    ".js", ".mjs", ".json", ".geojson", ".html", ".css", ".md", ".txt",
    ".py", ".ps1", ".bat", ".csv", ".kml", ".srt", ".vtt", ".svg", "",
}
SKIP_PREFIX = ("vendor/",)
ALLOW_FILES = {"tools/name_scan.py"}


def default_patterns_file() -> Path | None:
    env = os.environ.get("GLOBEDESK_NAME_PATTERNS")
    if env:
        return Path(env)
    base = local_tiles.data_dir(ROOT)
    candidate = base / "settings" / "name-scan-patterns.json"
    return candidate if candidate.is_file() else None


def load_patterns(args: argparse.Namespace) -> list[str]:
    pats: list[str] = []
    src = args.patterns or (str(default_patterns_file() or "") or None)
    if src:
        raw = json.loads(Path(src).read_text(encoding="utf-8"))
        if isinstance(raw, dict) and "patterns" in raw:
            raw = raw["patterns"]
        if not isinstance(raw, list):
            raise SystemExit("name-scan patterns file must be a JSON list")
        pats.extend(str(p) for p in raw if str(p).strip())
    for p in args.pattern or []:
        if p.strip():
            pats.append(p.strip())
    return pats


def tracked() -> list[tuple[str, bytes]]:
    out = subprocess.check_output(["git", "-C", str(ROOT), "ls-files", "-z"]).decode().split("\0")
    files = []
    for rel in out:
        if not rel or rel.startswith(SKIP_PREFIX) or rel in ALLOW_FILES:
            continue
        p = ROOT / rel
        if p.is_file() and p.suffix.lower() in TEXT_EXT:
            files.append((rel, p.read_bytes()))
    return files


def zipped_or_paths(zip_path: str | None, paths: list[str]) -> list[tuple[str, bytes]]:
    files: list[tuple[str, bytes]] = []
    if zip_path:
        import zipfile
        with zipfile.ZipFile(zip_path) as z:
            for n in z.namelist():
                if n.endswith("/"):
                    continue
                if Path(n).suffix.lower() not in TEXT_EXT:
                    continue
                files.append((n, z.read(n)))
    for p in paths:
        path = Path(p)
        if path.is_file():
            files.append((str(path), path.read_bytes()))
    return files


def main() -> int:
    ap = argparse.ArgumentParser(description="Scan public text for names that must stay off the public tree.")
    ap.add_argument("--pattern", action="append", default=[], help="A regex or literal name. Repeatable.")
    ap.add_argument("--patterns", help="JSON file containing a list of patterns.")
    ap.add_argument("--zip", help="Scan text files inside a zip instead of the git tree.")
    ap.add_argument("--file", action="append", default=[], dest="files", help="Scan this file too (or only, with --zip).")
    ap.add_argument("--literal", action="store_true", help="Treat patterns as literal strings, not regex.")
    a = ap.parse_args()
    pats = load_patterns(a)
    if not pats:
        scope = a.zip or a.files or "git-tracked files"
        print(f"name scan: 0 patterns, nothing to match in {scope}")
        return 0
    rx = []
    for i, p in enumerate(pats, 1):
        try:
            rx.append((i, re.compile(re.escape(p) if a.literal else p, re.I)))
        except re.error as e:
            raise SystemExit(f"name scan: bad pattern #{i}: {e}")
    files = zipped_or_paths(a.zip, a.files) if (a.zip or a.files) else tracked()
    hits = 0
    for rel, data in files:
        if rel in ALLOW_FILES or rel.replace("\\", "/").endswith("tools/name_scan.py"):
            continue
        text = data.decode("utf-8", "replace")
        for ln, line in enumerate(text.splitlines(), 1):
            for i, r in rx:
                if r.search(line):
                    hits += 1
                    print(f"{rel}:{ln}: pattern #{i}")
    scope = a.zip or ("listed files" if a.files else "git-tracked files")
    print(f"name scan: {len(files)} text files in {scope}, {len(pats)} patterns, {hits} hits")
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main())
