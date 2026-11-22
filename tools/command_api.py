#!/usr/bin/env python3
"""Allowlisted localhost command API for GlobeDesk.

POST /api/command is accepted only on this loopback port. If Origin is present
it must be the app itself (CSRF). A local agent with no Origin is allowed
because the server already binds 127.0.0.1. Unknown commands and out-of-range
arguments are rejected. Each command is logged (no headers or personal data).
"""
from __future__ import annotations

import json
import os
import tempfile
import threading
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Any

import tile_http

# Ranges match js/schema.js camera / id limits.
LIMITS = {
    "lat": (-90.0, 90.0),
    "lon": (-180.0, 180.0),
    "zoom": (0.0, 24.0),
    "pitch": (0.0, 85.0),
    "bearing": (-360.0, 360.0),
    "durationSec": (0.0, 120.0),
    "t": (0.0, 24 * 3600.0),
    "id": 200,
    "q": 500,
    "label": 500,
    "payload": 1024 * 1024,
    "position": 8000,
}

CLAIM_STATUS = ("supported", "not-proven", "disputed", "people-disagree")

COMMANDS: dict[str, dict[str, Any]] = {
    "flyTo": {
        "description": "Fly the camera to lat/lon with optional zoom, pitch, bearing, and durationSec.",
        "fields": ("lat", "lon", "zoom", "pitch", "bearing", "durationSec"),
        "required": ("lat", "lon"),
    },
    "jumpTo": {
        "description": "Jump the camera to lat/lon with optional zoom, pitch, and bearing (no flight).",
        "fields": ("lat", "lon", "zoom", "pitch", "bearing"),
        "required": ("lat", "lon"),
    },
    "zoom": {
        "description": "Set an absolute zoom, or pass by for a relative zoom change.",
        "fields": ("zoom", "by", "durationSec"),
        "required": (),
    },
    "tilt": {
        "description": "Set an absolute pitch, or pass by for a relative tilt.",
        "fields": ("pitch", "by", "durationSec"),
        "required": (),
    },
    "rotate": {
        "description": "Set an absolute bearing, or pass by for a relative rotation.",
        "fields": ("bearing", "by", "durationSec"),
        "required": (),
    },
    "camera": {"description": "Read the current camera.", "fields": (), "required": ()},
    "search": {
        "description": "Search the bundled gazetteer only (no online geocoder).",
        "fields": ("q",),
        "required": ("q",),
    },
    "setBase": {
        "description": "Switch to an existing base layer id.",
        "fields": ("id",),
        "required": ("id",),
    },
    "setOverlay": {
        "description": "Turn an existing overlay id on or off.",
        "fields": ("id", "on"),
        "required": ("id", "on"),
    },
    "toggleLayer": {
        "description": "Toggle an existing base or overlay id. Pass on to force a state.",
        "fields": ("id", "on"),
        "required": ("id",),
    },
    "dropPin": {
        "description": "Place or move the current story pin (approximate coordinates; no street address lookup).",
        "fields": ("lat", "lon", "label"),
        "required": ("lat", "lon"),
    },
    "setLocation": {
        "description": "Alias of dropPin.",
        "fields": ("lat", "lon", "label"),
        "required": ("lat", "lon"),
    },
    "openCard": {
        "description": "Open a topic card or a story callout already in the episode (by id or slug).",
        "fields": ("id",),
        "required": ("id",),
    },
    "closeCard": {
        "description": "Close a topic card or a story callout by id or slug.",
        "fields": ("id",),
        "required": ("id",),
    },
    "closeAllCards": {"description": "Close every open card and callout.", "fields": (), "required": ()},
    "highlight": {
        "description": "Highlight a country by ISO A3 code, or clear when a3 is empty.",
        "fields": ("a3",),
        "required": (),
    },
    "loadEpisode": {
        "description": "Load a validated globedesk.episode/2 file from an allowlisted /episodes/ path.",
        "fields": ("url",),
        "required": ("url",),
    },
    "setStory": {
        "description": "Select a story by index, id, or slug.",
        "fields": ("index", "id"),
        "required": (),
    },
    "play": {"description": "Start the playback clock from the current time.", "fields": (), "required": ()},
    "pause": {"description": "Pause the clock so the viewer can explore.", "fields": (), "required": ()},
    "resume": {
        "description": "Clear pause-time viewer edits, restore the story state at the paused beat, and continue.",
        "fields": (),
        "required": (),
    },
    "seek": {
        "description": "Jump the clock to t seconds and show the story state at that time.",
        "fields": ("t",),
        "required": ("t",),
    },
    "status": {
        "description": "Read base, overlays, time, story index, camera, and open cards.",
        "fields": (),
        "required": (),
    },
    "listOutbound": {
        "description": "List allowlisted Open in… targets. Pass storyId to list only the targets that match that story. Does not open a URL.",
        "fields": ("storyId",),
        "required": (),
    },
    "listClaims": {
        "description": "List author-applied claim scores. Pass storyId to list ids and statuses for that story. Returns no label, value, or other page text.",
        "fields": ("storyId",),
        "required": (),
    },
    "setClaim": {
        "description": "Set an author-applied claim score on a fact. Updates the in-memory claims sidecar only, not the episode fact and not a file. Requires storyId, cardId, claimStatus, and factIndex or factLabel.",
        "fields": ("storyId", "cardId", "factIndex", "factLabel", "claimStatus", "sourceIds", "disagree"),
        "required": ("storyId", "cardId", "claimStatus"),
    },
    "openClaims": {
        "description": "Open the claims strip or editor rows for a story. If that story is already open, this is a no-op success.",
        "fields": ("storyId",),
        "required": ("storyId",),
    },
    "openResearch": {
        "description": "Open the research drawer for a story. If that drawer is already open, this is a no-op success.",
        "fields": ("storyId",),
        "required": ("storyId",),
    },
    "listResearch": {
        "description": "List research counts and ids for a story, plus gap labels. Does not return quote text.",
        "fields": ("storyId",),
        "required": ("storyId",),
    },
    "addGap": {
        "description": "Add a research gap on a story. Requires storyId and a gap id or label. Updates the in-memory research sidecar only.",
        "fields": ("storyId", "id", "label", "detail", "isGap"),
        "required": ("storyId",),
    },
    "closeGap": {
        "description": "Mark a research gap closed and append an update note. The gap row is kept. Requires storyId, a gap id or label, and a note. Updates the in-memory research sidecar only.",
        "fields": ("storyId", "id", "label", "note"),
        "required": ("storyId", "note"),
    },
    "listRecords": {
        "description": "List on-map and off-map record counts and ids. Pass layerId, storyId, or recordCatalogId to filter. Returns no source page bodies.",
        "fields": ("layerId", "storyId", "recordCatalogId"),
        "required": (),
    },
    "buildLayer": {
        "description": "Write cited, placed records from an in-memory catalog into an event layer. Never places an off-map row. Fails if an on-map row is missing a citation. Updates memory only.",
        "fields": ("recordCatalogId", "layerId", "name"),
        "required": (),
    },
    "frameLayer": {
        "description": "Fly to an event layer's bounds, clamped the same way as other camera commands.",
        "fields": ("id",),
        "required": ("id",),
    },
    "listGis": {
        "description": "List official GIS overlays: id, label, status, min zoom, and credit. Pass storyId to list only overlays named on that story. Does not return raw service URLs.",
        "fields": ("storyId",),
        "required": (),
    },
    "gisStatus": {
        "description": "Return the last official-GIS health token for an overlay id (ok, error, below-minzoom, off, skipped, or unknown).",
        "fields": ("id",),
        "required": ("id",),
    },
}

# Owner-required v1 set; the rest are the plan allowlist.
OWNER_COMMANDS = (
    "flyTo", "zoom", "toggleLayer", "dropPin", "openCard", "closeCard",
    "play", "pause", "resume",
)

NUMERIC = {
    "lat": "lat", "lon": "lon", "zoom": "zoom", "pitch": "pitch",
    "bearing": "bearing", "durationSec": "durationSec", "t": "t", "by": None,
    "index": None,
}

LOG_MEMORY = 200
_log_lock = threading.Lock()
_log_memory: deque = deque(maxlen=LOG_MEMORY)
_log_path: Path | None = None


def command_names() -> list[str]:
    return list(COMMANDS.keys())


def tools_payload() -> dict[str, Any]:
    tools = []
    for name, meta in COMMANDS.items():
        tools.append({
            "name": name,
            "description": meta["description"],
            "required": list(meta["required"]),
            "fields": list(meta["fields"]),
        })
    return {"schema": "globedesk.commands/1", "tools": tools, "required": list(OWNER_COMMANDS)}


def command_request_ok(headers, port: int) -> bool:
    """Host must be this loopback port. Origin, if present, must be the app."""
    if not tile_http.host_ok(headers, port):
        return False
    org = tile_http.header(headers, "Origin").strip().rstrip("/")
    if not org:
        return True
    return org in tile_http.allowed_origins(port)


def _is_num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and v not in (float("inf"), float("-inf"))


def _num(v: Any, lo: float, hi: float) -> tuple[bool, float]:
    if not _is_num(v):
        return False, 0.0
    n = float(v)
    if n < lo or n > hi:
        return False, n
    return True, n


def _str(v: Any, max_len: int) -> tuple[bool, str]:
    if not isinstance(v, str):
        return False, ""
    if len(v) > max_len:
        return False, v
    return True, v


def _id_list(val: Any, name: str) -> tuple[bool, list[str] | None, str]:
    if not isinstance(val, list):
        return False, None, f"{name} must be an array of short strings"
    out: list[str] = []
    for item in val:
        ok, s = _str(item, LIMITS["id"])
        if not ok or not s.strip():
            return False, None, f"{name} must be an array of short strings"
        out.append(s)
    return True, out, ""


def _disagree(val: Any) -> tuple[bool, list[dict[str, Any]] | None, str]:
    if not isinstance(val, list):
        return False, None, "disagree must be an array of groups"
    out: list[dict[str, Any]] = []
    for g in val:
        if not isinstance(g, dict):
            return False, None, "disagree group must be an object"
        extra = [k for k in g.keys() if k not in ("sourceIds", "position")]
        if extra:
            return False, None, f"unknown field: {extra[0]}"
        ok, ids, err = _id_list(g.get("sourceIds") or [], "disagree.sourceIds")
        if not ok:
            return False, None, err
        pos = g.get("position")
        ok, s = _str(pos, LIMITS["position"])
        if not ok or not s.strip():
            return False, None, "disagree position must be a non-empty string"
        out.append({"sourceIds": ids, "position": s})
    return True, out, ""


def _episode_url_ok(url: str) -> bool:
    if not url or not url.startswith("/episodes/") or ".." in url or url == "/episodes/":
        return False
    if not url.endswith(".json") and not url.endswith(".globedesk.json"):
        return False
    if not url.startswith("/episodes/") or url.count("/") != 2:
        return False
    return True


def validate_command(payload: Any) -> tuple[bool, str, dict[str, Any] | None]:
    """Return (ok, error, normalized). Normalized is {cmd, args}."""
    if not isinstance(payload, dict) or isinstance(payload, list):
        return False, "command must be a JSON object", None
    body = dict(payload)
    cmd = body.pop("cmd", None) or body.pop("command", None)
    if not isinstance(cmd, str) or not cmd:
        return False, "missing cmd", None
    if cmd not in COMMANDS:
        return False, f"unknown command: {cmd}", None
    if "args" in body:
        args_in = body.pop("args")
        if args_in is None:
            args_in = {}
        if not isinstance(args_in, dict):
            return False, "args must be an object", None
        if body:
            return False, "unknown field: " + next(iter(body)), None
        body = dict(args_in)
    meta = COMMANDS[cmd]
    allowed = set(meta["fields"])
    for key in body:
        if key not in allowed:
            return False, f"unknown field: {key}", None
    args: dict[str, Any] = {}
    for key in meta["fields"]:
        if key not in body or body[key] is None:
            continue
        val = body[key]
        if key in ("lat", "lon", "zoom", "pitch", "bearing", "durationSec", "t"):
            lo, hi = LIMITS[key]
            ok, n = _num(val, lo, hi)
            if not ok:
                return False, f"{key} must be a number between {lo} and {hi}", None
            args[key] = n
        elif key == "by":
            # Relative deltas share the span of the related axis, but may be signed.
            if not _is_num(val):
                return False, "by must be a number", None
            n = float(val)
            if abs(n) > 360:
                return False, "by is out of range", None
            args[key] = n
        elif key == "index":
            if not _is_num(val) or int(val) != val or val < 0 or val > 79:
                return False, "index must be an integer from 0 to 79", None
            args[key] = int(val)
        elif key == "on":
            if not isinstance(val, bool):
                return False, "on must be a boolean", None
            args[key] = val
        elif key in ("id", "storyId", "recordCatalogId", "layerId"):
            ok, s = _str(val, LIMITS["id"])
            if not ok:
                return False, f"{key} must be a short string", None
            if not s.strip():
                return False, f"{key} is empty", None
            args[key] = s
        elif key == "q":
            ok, s = _str(val, LIMITS["q"])
            if not ok:
                return False, "q must be a short string", None
            args[key] = s
        elif key == "label" or key == "name":
            ok, s = _str(val, LIMITS["label"])
            if not ok:
                return False, f"{key} must be a short string", None
            args[key] = s
        elif key == "url":
            ok, s = _str(val, 2000)
            if not ok:
                return False, "url must be a short string", None
            if not _episode_url_ok(s):
                return False, "url must be an allowlisted /episodes/ JSON path", None
            args[key] = s
        elif key == "a3":
            ok, s = _str(val, 8)
            if not ok:
                return False, "a3 must be a short string", None
            args[key] = s.upper()
        elif key == "cardId" or key == "factLabel":
            ok, s = _str(val, LIMITS["id"])
            if not ok:
                return False, f"{key} must be a short string", None
            if not s.strip():
                return False, f"{key} is empty", None
            args[key] = s
        elif key == "factIndex":
            if not _is_num(val) or int(val) != val or val < 0 or val > 399:
                return False, "factIndex must be an integer from 0 to 399", None
            args[key] = int(val)
        elif key == "claimStatus":
            if not isinstance(val, str) or val not in CLAIM_STATUS:
                return False, "claimStatus must be " + "|".join(CLAIM_STATUS), None
            args[key] = val
        elif key == "sourceIds":
            ok, ids, err = _id_list(val, "sourceIds")
            if not ok:
                return False, err, None
            args[key] = ids
        elif key == "disagree":
            ok, groups, err = _disagree(val)
            if not ok:
                return False, err, None
            args[key] = groups
        elif key == "note" or key == "detail":
            ok, s = _str(val, LIMITS["position"])
            if not ok or not s.strip():
                return False, f"{key} must be a non-empty string", None
            args[key] = s
        elif key == "isGap":
            if not isinstance(val, bool):
                return False, "isGap must be a boolean", None
            args[key] = val
    for req in meta["required"]:
        if req not in args:
            return False, f"missing {req}", None
    if cmd == "zoom" and "zoom" not in args and "by" not in args:
        return False, "zoom requires zoom or by", None
    if cmd == "tilt" and "pitch" not in args and "by" not in args:
        return False, "tilt requires pitch or by", None
    if cmd == "rotate" and "bearing" not in args and "by" not in args:
        return False, "rotate requires bearing or by", None
    if cmd == "setStory" and "index" not in args and "id" not in args:
        return False, "setStory requires index or id", None
    if cmd == "setClaim" and "factIndex" not in args and "factLabel" not in args:
        return False, "setClaim requires factIndex or factLabel", None
    if cmd == "addGap" and "id" not in args and "label" not in args:
        return False, "addGap requires id or label", None
    if cmd == "buildLayer" and "recordCatalogId" not in args and "layerId" not in args:
        return False, "buildLayer requires recordCatalogId or layerId", None
    if cmd == "closeGap" and "id" not in args and "label" not in args:
        return False, "closeGap requires id or label", None
    return True, "", {"cmd": cmd, "args": args}


def set_log_path(path: str | os.PathLike | None) -> None:
    global _log_path
    _log_path = Path(path) if path else None


def default_log_path(data_dir: str | os.PathLike | None) -> Path:
    if data_dir:
        return Path(data_dir) / "command-log.jsonl"
    return Path(tempfile.gettempdir()) / "globedesk-command-log.jsonl"


def _log_args(cmd: str | None, args: Any) -> dict[str, Any]:
    raw = args if isinstance(args, dict) else {}
    if cmd == "setClaim":
        out: dict[str, Any] = {}
        for key in ("storyId", "cardId", "factIndex", "claimStatus", "sourceIds"):
            if key in raw:
                out[key] = raw[key]
        if isinstance(raw.get("disagree"), list):
            out["disagree"] = [
                {"sourceIds": list(g.get("sourceIds") or [])}
                for g in raw["disagree"]
                if isinstance(g, dict)
            ]
        return out
    if cmd in ("addGap", "closeGap", "listResearch"):
        out = {}
        for key in ("storyId", "id", "label", "isGap"):
            if key in raw:
                out[key] = raw[key]
        return out
    return raw


def log_command(entry: dict[str, Any]) -> None:
    row = {
        "ts": round(time.time(), 3),
        "id": entry.get("id"),
        "cmd": entry.get("cmd"),
        "ok": entry.get("ok"),
        "error": entry.get("error"),
        "args": _log_args(entry.get("cmd"), entry.get("args") or {}),
    }
    with _log_lock:
        _log_memory.append(row)
        path = _log_path
        if path is None:
            return
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(row, separators=(",", ":")) + "\n")
        except OSError:
            pass


def recent_log(limit: int = 50) -> list[dict[str, Any]]:
    with _log_lock:
        items = list(_log_memory)
    return items[-max(1, min(int(limit), LOG_MEMORY)):]


def clear_log_memory() -> None:
    with _log_lock:
        _log_memory.clear()


DESK_TTL_SEC = 45.0


class CommandBus:
    """Queue from local agents to the open desk page.

    Each open desk registers when it polls. If more than one desk is connected
    and none is clearly focused, submit() rejects the command unless a desk id
    is given, so a command cannot silently land in a hidden window.
    """

    def __init__(self, wait_sec: float = 8.0, max_queue: int = 32):
        self.wait_sec = wait_sec
        self.max_queue = max_queue
        self._q: list[dict[str, Any]] = []
        self._cv = threading.Condition()
        self._pending: dict[str, dict[str, Any]] = {}
        self._desks: dict[str, dict[str, Any]] = {}

    def reset(self) -> None:
        with self._cv:
            self._q.clear()
            for p in self._pending.values():
                p["error"] = "reset"
                p["event"].set()
            self._pending.clear()
            self._desks.clear()

    def _prune_locked(self) -> None:
        now = time.time()
        dead = [i for i, d in self._desks.items() if now - d.get("lastSeen", 0) > DESK_TTL_SEC]
        for i in dead:
            self._desks.pop(i, None)

    def touch(self, desk_id: str, focused: bool = False, title: str = "") -> None:
        if not desk_id or not isinstance(desk_id, str) or len(desk_id) > 80:
            return
        now = time.time()
        with self._cv:
            rec = self._desks.get(desk_id) or {"id": desk_id}
            rec["lastSeen"] = now
            if title:
                rec["title"] = title[:200]
            if focused:
                rec["focused"] = True
                rec["focusedAt"] = now
            else:
                rec["focused"] = bool(rec.get("focused") and now - rec.get("focusedAt", 0) < 2)
            self._desks[desk_id] = rec
            self._cv.notify_all()

    def drop(self, desk_id: str) -> None:
        if not desk_id:
            return
        with self._cv:
            self._desks.pop(desk_id, None)
            self._cv.notify_all()

    def list_desks(self) -> list[dict[str, Any]]:
        with self._cv:
            self._prune_locked()
            out = []
            for d in self._desks.values():
                out.append({k: d[k] for k in ("id", "title", "focused", "lastSeen", "focusedAt") if k in d})
            return out

    def resolve_target(self, requested: str | None = None) -> tuple[str | None, str, list[dict[str, Any]]]:
        """Return (desk_id or None, error, live desks)."""
        with self._cv:
            self._prune_locked()
            live = list(self._desks.values())
        ids = [d["id"] for d in live]
        if requested:
            req = str(requested).strip()
            if req not in ids:
                return None, "unknown desk: " + req, live
            return req, "", live
        if len(ids) <= 1:
            return (ids[0] if ids else None), "", live
        focused = [d for d in live if d.get("focused")]
        focused.sort(key=lambda d: d.get("focusedAt") or 0, reverse=True)
        if focused:
            return focused[0]["id"], "", live
        return None, "multiple desks are connected; pass desk=<id> to target the window you are watching, or close the extra window", live

    def submit(self, normalized: dict[str, Any], wait_sec: float | None = None, desk: str | None = None) -> tuple[dict[str, Any], int]:
        cmd_id = uuid.uuid4().hex[:12]
        target, err, live = self.resolve_target(desk)
        if err:
            row = {"id": cmd_id, "cmd": normalized["cmd"], "args": normalized["args"], "ok": False, "error": err}
            log_command(row)
            return {"ok": False, "error": err, "id": cmd_id, "desks": [{"id": d["id"], "title": d.get("title", ""), "focused": bool(d.get("focused"))} for d in live]}, 409
        item = {"id": cmd_id, "cmd": normalized["cmd"], "args": normalized["args"], "desk": target}
        ev = threading.Event()
        with self._cv:
            if len(self._q) >= self.max_queue:
                row = {"id": cmd_id, "cmd": item["cmd"], "args": item["args"], "ok": False, "error": "command queue full"}
                log_command(row)
                return {"ok": False, "error": "command queue full", "id": cmd_id}, 429
            self._pending[cmd_id] = {"event": ev, "result": None}
            self._q.append(item)
            self._cv.notify_all()
        ok = ev.wait(self.wait_sec if wait_sec is None else wait_sec)
        with self._cv:
            rec = self._pending.pop(cmd_id, None)
            if rec and rec["result"] is not None:
                result = rec["result"]
            else:
                self._q = [x for x in self._q if x["id"] != cmd_id]
                result = {"ok": False, "error": "no desk connected", "id": cmd_id}
        status = 200 if result.get("ok") else (503 if result.get("error") == "no desk connected" else 200)
        if not ok and result.get("error") == "no desk connected":
            status = 503
        if result.get("error") and "multiple desks" in str(result.get("error")):
            status = 409
        log_command({
            "id": cmd_id,
            "cmd": item["cmd"],
            "args": item["args"],
            "ok": bool(result.get("ok")),
            "error": result.get("error"),
            "desk": target,
        })
        if target:
            result = dict(result)
            result.setdefault("desk", target)
        return result, status

    def take(self, wait_sec: float = 20.0, desk_id: str | None = None, focused: bool = False, title: str = "") -> dict[str, Any] | None:
        if desk_id:
            self.touch(desk_id, focused=focused, title=title)
        deadline = time.time() + max(0.0, wait_sec)
        with self._cv:
            while True:
                for i, item in enumerate(self._q):
                    assigned = item.get("desk")
                    if desk_id and assigned not in (None, desk_id):
                        continue
                    if assigned is None and desk_id:
                        item["desk"] = desk_id
                    return self._q.pop(i)
                remaining = deadline - time.time()
                if remaining <= 0:
                    return None
                self._cv.wait(remaining)

    def complete(self, cmd_id: str, result: dict[str, Any]) -> bool:
        if not cmd_id or not isinstance(result, dict):
            return False
        out = {
            "ok": bool(result.get("ok")),
            "id": cmd_id,
        }
        if "result" in result:
            out["result"] = result.get("result")
        if result.get("error"):
            out["error"] = str(result.get("error"))[:500]
        with self._cv:
            rec = self._pending.get(cmd_id)
            if not rec:
                return False
            rec["result"] = out
            rec["event"].set()
            return True


BUS = CommandBus()


def reset_for_tests() -> None:
    BUS.reset()
    clear_log_memory()
    set_log_path(None)
