#!/usr/bin/env python3
"""Copy a local news-desk topic set into this repo's newsdesk/ folder."""
from __future__ import annotations
import argparse
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEFAULT_SRC = REPO.parent / "globedesk-newsdesk"
FILES = [
    "sections.json",
    "catalog.json",
    "topics/newsdesk-50.globedesk.json",
]

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--src",
        type=Path,
        default=DEFAULT_SRC,
        help="Folder that holds sections.json, catalog.json, topics/ and episodes/ (default: a sibling globedesk-newsdesk directory)",
    )
    args = parser.parse_args()
    src = args.src.resolve()
    dst = REPO / "newsdesk"
    if not src.is_dir():
        print("source missing:", src)
        return 1
    (dst / "topics").mkdir(parents=True, exist_ok=True)
    (dst / "episodes").mkdir(parents=True, exist_ok=True)
    copied = 0
    for rel in FILES:
        s, d = src / rel, dst / rel
        if s.is_file():
            d.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(s, d)
            copied += 1
            print("copied", rel)
        else:
            print("missing", rel)
    src_eps = src / "episodes"
    if src_eps.is_dir():
        for f in sorted(src_eps.glob("*.globedesk.json")):
            shutil.copy2(f, dst / "episodes" / f.name)
            copied += 1
            print("copied episodes/" + f.name)
    print("copied", copied, "files into", dst)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
