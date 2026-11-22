#!/usr/bin/env python3
"""Scrub scan: fail if shipped text contains private paths, personal emails,
phone numbers, tokens, webhook URLs or internal IDs.

Usage:
  python3 tools/scrub_scan.py                 # scan git-tracked files
  python3 tools/scrub_scan.py --zip FILE.zip  # scan the text files inside a zip
  python3 tools/scrub_scan.py --private PATTERNS.json

Extra, private patterns (names, places, internal project words) are never stored
in this repository. Pass them with --private, or set GLOBEDESK_PRIVATE_PATTERNS
to a JSON file containing a list of regular expressions. Exit code 1 on any hit.
Test-only phone fixtures may be allowlisted by exact (path, kind)
and only when the match contains a 555 exchange. Do not allow a whole file.
"""
from __future__ import annotations
import argparse, json, os, re, subprocess, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEXT_EXT = {".js", ".mjs", ".json", ".geojson", ".html", ".css", ".md", ".txt", ".py", ".ps1", ".bat", ".csv", ".kml", ".srt", ".vtt", ".svg", ""}
SKIP_PREFIX = ("vendor/",)  # third-party code, scanned by gitleaks instead

SEP = r"[\\/]"
GENERIC = {
    "windows user path": r"[A-Za-z]:" + SEP + r"{1,2}Users" + SEP,
    "posix home path": r"/home/[a-z][a-z0-9_-]*/",
    "box workspace path": r"(?<![\w.])/workspace/",
    "tmp path": r"(?<![\w.])/tmp/",
    "mount path": r"(?<![\w.])/mnt/[a-z]",
    "personal email": r"[A-Za-z0-9._%+-]+@(?:gmail|googlemail|yahoo|outlook|hotmail|live|icloud|me|proton|protonmail|aol)\.(?:com|me)",
    "phone number": r"(?<![\w.])(?:\+?1[ .-])?\(?[2-9]\d{2}\)?[ .-]\d{3}[ .-]\d{4}(?![\w])",
    "openai/xai key": r"\b(?:sk|xai)-[A-Za-z0-9_-]{20,}",
    "aws key": r"\bAKIA[0-9A-Z]{16}\b",
    "github token": r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}",
    "slack token or webhook": r"\bxox[abposr]-[A-Za-z0-9-]{10,}|hooks\.slack\.com/services/",
    "discord webhook": r"discord(?:app)?\.com/api/webhooks/",
    "private key": r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    "agent store id": r"\bstore-[0-9a-f]{8}-[0-9a-f]{4}",
    "uuid": r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
}
# Lines that legitimately contain a pattern (documentation of the scanner itself).
# Whole-file allows are only for the scanner source. Test fixtures must use ALLOW_HITS.
ALLOW_FILES = {"tools/scrub_scan.py"}
# Exact (path, kind) pairs only. Phone hits also require the NANP *exchange* to be 555.
ALLOW_HITS = {
    ("tests/records.unit.mjs", "phone number"),
    ("tests/research.unit.mjs", "phone number"),
}
PHONE_555 = re.compile(r"(?<!\d)555(?!\d)")
# A 555 *area code* is not an exchange. Strip punctuation and require digits 4-6.
def phone_exchange_is_555(text: str) -> bool:
    digits = re.sub(r"\D+", "", text or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        return False
    return digits[3:6] == "555"

# The bundled gazetteer (Natural Earth, public domain) lists thousands of real towns;
# private place patterns are not applied to it.
PRIVATE_SKIP_PREFIX = ("data/",)


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


def zipped(path: str) -> list[tuple[str, bytes]]:
    """Text files in a zip. Paths are made repo-relative (a single top folder such as
    GlobeDesk/ is dropped) so the same skip rules apply as for the git tree."""
    files = []
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if not n.endswith("/")]
        tops = {n.split("/", 1)[0] for n in names}
        strip = len(tops) == 1 and all("/" in n for n in names)
        for n in names:
            rel = n.split("/", 1)[1] if strip else n
            if rel.startswith(SKIP_PREFIX) or rel in ALLOW_FILES or Path(n).suffix.lower() not in TEXT_EXT:
                continue
            files.append((rel, z.read(n)))
    return files


def load_private(arg: str | None) -> dict[str, str]:
    src = arg or os.environ.get("GLOBEDESK_PRIVATE_PATTERNS")
    if not src:
        return {}
    pats = json.loads(Path(src).read_text())
    return {f"private pattern #{i + 1}": p for i, p in enumerate(pats)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip")
    ap.add_argument("--private")
    a = ap.parse_args()
    pats = {**GENERIC, **load_private(a.private)}
    rx = {k: re.compile(v, re.I if k.startswith("private") else 0) for k, v in pats.items()}
    files = zipped(a.zip) if a.zip else tracked()
    hits = 0
    for rel, data in files:
        text = data.decode("utf-8", "replace")
        for ln, line in enumerate(text.splitlines(), 1):
            for k, r in rx.items():
                if k.startswith("private") and rel.startswith(PRIVATE_SKIP_PREFIX):
                    continue
                for m in r.finditer(line):
                    if (rel, k) in ALLOW_HITS and (k != "phone number" or phone_exchange_is_555(m.group(0) or "")):
                        continue
                    hits += 1
                    # Private patterns are reported by number only, never echoed.
                    print(f"{rel}:{ln}: {k}")
    scope = a.zip or "git-tracked files"
    print(f"scrub scan: {len(files)} text files in {scope}, {len(pats)} patterns ({len(pats) - len(GENERIC)} private), {hits} hits")
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main())
