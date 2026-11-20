#!/usr/bin/env python3
"""Write or check grokme/manifest.json. Self-imposed budget: 20 MiB / 5 MiB / 600 files.
Grok.me's official limits are [UNKNOWN].

File lists always come from git-tracked paths when this is a git checkout
(`git ls-files`). Untracked worktree files (for example docs/VIDEO-SCRIPT.md)
are never included. When git is unavailable (a git-archive export or an
unzipped zip), the script walks the tree on disk with the same skip rules.
"""
from __future__ import annotations
import hashlib, json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "grokme" / "manifest.json"
TOTAL = 20 * 1024 * 1024
PER = 5 * 1024 * 1024
MAX_FILES = 600
SKIP_DIRS = {".git", "shots", "node_modules"}
SKIP_NAMES = {".DS_Store"}


def git_tracked() -> list[str] | None:
    try:
        out = subprocess.check_output(
            ["git", "-C", str(ROOT), "ls-files", "-z"],
            stderr=subprocess.DEVNULL,
        )
        return [p for p in out.decode().split("\0") if p]
    except (OSError, subprocess.CalledProcessError):
        return None


def include(rel: Path) -> bool:
    if any(part in SKIP_DIRS for part in rel.parts):
        return False
    if rel.name in SKIP_NAMES:
        return False
    if rel.as_posix() == "grokme/manifest.json":
        return False
    return True


def listed_files() -> list[Path]:
    tracked = git_tracked()
    if tracked is not None:
        out = []
        for rel in tracked:
            r = Path(rel)
            if not include(r):
                continue
            p = ROOT / r
            if p.is_file():
                out.append(p)
        return sorted(out, key=lambda x: x.relative_to(ROOT).as_posix())
    out = []
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(ROOT)
        if include(rel):
            out.append(p)
    return sorted(out, key=lambda x: x.relative_to(ROOT).as_posix())


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    h.update(p.read_bytes())
    return h.hexdigest()


def entries() -> list[dict]:
    rows = []
    for p in listed_files():
        rel = p.relative_to(ROOT).as_posix()
        size = p.stat().st_size
        rows.append({"path": rel, "size": size, "sha256": sha256(p)})
    return rows


def budget(rows: list[dict]) -> list[str]:
    errs = []
    total = sum(r["size"] for r in rows)
    if len(rows) > MAX_FILES:
        errs.append(f"{len(rows)} files > {MAX_FILES}")
    if total > TOTAL:
        errs.append(f"{total} bytes > {TOTAL}")
    for r in rows:
        if r["size"] > PER:
            errs.append(f"{r['path']} {r['size']} > {PER}")
    return errs


def write() -> list[dict]:
    rows = entries()
    errs = budget(rows)
    payload = {
        "name": "GlobeDesk",
        "version": "0.4.2",
        "entry": "index.html",
        "limits": {
            "note": "Official Grok.me size limits are [UNKNOWN]. These are self-imposed.",
            "totalBytes": TOTAL,
            "perFileBytes": PER,
            "maxFiles": MAX_FILES,
        },
        "files": rows,
        "totals": {"files": len(rows), "bytes": sum(r["size"] for r in rows)},
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(payload, indent=2) + "\n")
    if errs:
        raise SystemExit("budget: " + "; ".join(errs))
    return rows


def check() -> None:
    if not MANIFEST.is_file():
        raise SystemExit("missing " + str(MANIFEST))
    doc = json.loads(MANIFEST.read_text())
    rows = entries()
    got = {r["path"]: r for r in rows}
    listed = {r["path"]: r for r in doc.get("files", [])}
    errs = budget(rows)
    for path in sorted(set(got) | set(listed)):
        if path not in got:
            errs.append("manifest has extra " + path)
        elif path not in listed:
            errs.append("manifest missing " + path)
        else:
            if got[path]["size"] != listed[path]["size"] or got[path]["sha256"] != listed[path]["sha256"]:
                errs.append("stale " + path)
    if errs:
        raise SystemExit("check failed:\n- " + "\n- ".join(errs))
    print(f"ok — {len(rows)} files, {sum(r['size'] for r in rows)} bytes")


if __name__ == "__main__":
    if "--check" in sys.argv:
        check()
    else:
        rows = write()
        print(f"wrote {MANIFEST} ({len(rows)} files, {sum(r['size'] for r in rows)} bytes)")
        if "--check" in sys.argv:
            check()
