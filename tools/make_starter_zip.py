#!/usr/bin/env python3
"""Build globedesk-starter-v<version>.zip from git-tracked starter/ files plus the
license files, then run the scrub scan on the zip. Byte-for-byte reproducible
(fixed timestamps, sorted entries).

Usage: python3 tools/make_starter_zip.py [--out DIR] [--private PATTERNS.json]
"""
from __future__ import annotations
import argparse, json, subprocess, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTRA = ["LICENSE", "LICENSE-CONTENT"]
STAMP = (2026, 1, 1, 0, 0, 0)


def files() -> list[str]:
    out = subprocess.check_output(["git", "-C", str(ROOT), "ls-files", "-z", "starter"]).decode().split("\0")
    return sorted([p for p in out if p]) + EXTRA


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "dist"))
    ap.add_argument("--private")
    a = ap.parse_args()
    version = json.loads((ROOT / "package.json").read_text())["version"]
    name = f"globedesk-starter-v{version}"
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    zpath = out / f"{name}.zip"
    listed = files()
    if not any(p.startswith("starter/") for p in listed):
        print("no tracked starter/ files"); return 1
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for rel in listed:
            arc = name + "/" + (rel[len("starter/"):] if rel.startswith("starter/") else rel)
            info = zipfile.ZipInfo(arc, STAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, (ROOT / rel).read_bytes())
    print(f"wrote {zpath} ({len(listed)} files)", flush=True)
    scan = [sys.executable, str(ROOT / "tools" / "scrub_scan.py"), "--zip", str(zpath)]
    if a.private:
        scan += ["--private", a.private]
    return subprocess.call(scan)


if __name__ == "__main__":
    sys.exit(main())
