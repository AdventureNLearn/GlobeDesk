#!/usr/bin/env python3
"""Contributor cards for the Community lane: strip contact fields and check a card. Local only, never commits.

Used by `tools/promote_layer.py --card`. Mirrors js/community-cards.js: a card is a public handle,
a one- or two-line description, Atlas topics, up to 3 public https links, a checked date and CC BY 4.0.
Email, phone, real name, address and location fields are removed. Owner repos and Learning Lab cards
in links stay allowed but are experimental references, never official sources.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = "globedesk.contributor-card/1"
ALLOWED = ("schema", "handle", "description", "topics", "links", "checked", "license")
CONTACT_KEY = re.compile(r"^(e-?mail|emails?|phone|tel|telephone|mobile|fax|address|street|city|zip|postcode|postal|location|lat|lng|lon|latitude|longitude|geo|coords?|real_?name|full_?name|first_?name|last_?name|surname|name|birth\w*|dob|age|owner\w*|occupant\w*|contact\w*)$", re.I)
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
PHONE = re.compile(r"\+?\d[\d\s().-]{7,}\d")
HANDLE = re.compile(r"^[a-z0-9][a-z0-9_-]{1,31}$")
LINK = re.compile(r"^https://[^\s\"'<>@]+$")
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def strip_contacts(card: dict) -> tuple[dict, list[str]]:
    removed: list[str] = []
    out = {}
    for k, v in card.items():
        if CONTACT_KEY.match(str(k)):
            removed.append(k)
            continue
        out[k] = v
    links = []
    for link in out.get("links") or []:
        if not isinstance(link, dict):
            continue
        url = str(link.get("url") or "")
        if re.match(r"^(mailto|tel):", url, re.I):
            removed.append("links[" + url.split(":")[0] + "]")
            continue
        links.append({"title": link.get("title"), "url": url})
    if "links" in out:
        out["links"] = links
    desc = str(out.get("description") or "")
    if EMAIL.search(desc):
        out["description"] = EMAIL.sub("[removed]", desc)
        removed.append("description[email]")
    desc = str(out.get("description") or "")
    for m in PHONE.findall(desc):
        if len(re.sub(r"\D", "", m)) >= 10:
            desc = desc.replace(m, "[removed]")
            removed.append("description[phone]")
    out["description"] = desc
    return out, removed


def categories() -> set[str]:
    data = json.loads((ROOT / "atlas" / "categories.json").read_text(encoding="utf-8"))
    ids = set()
    for c in data["categories"]:
        ids.add(c["id"])
        for s in c.get("subcategories", []):
            ids.add(c["id"] + "/" + s["id"])
    return ids


def check(card: dict) -> list[str]:
    errs: list[str] = []
    for k in card:
        if k not in ALLOWED:
            errs.append(f"unknown field: {k}")
    if card.get("schema") != SCHEMA:
        errs.append(f"schema must be {SCHEMA}")
    if not HANDLE.match(str(card.get("handle") or "")):
        errs.append("handle must be 2-32 lowercase letters, digits, - or _")
    desc = str(card.get("description") or "")
    if not desc.strip() or len(desc) > 240 or len(desc.split("\n")) > 2:
        errs.append("description must be one or two lines, at most 240 characters")
    if EMAIL.search(json.dumps(card)):
        errs.append("an email address is not allowed on a card")
    topics = card.get("topics")
    known = categories()
    if not isinstance(topics, list) or not 1 <= len(topics) <= 6:
        errs.append("topics: 1 to 6 Atlas categories")
    else:
        errs += [f"unknown Atlas category: {t}" for t in topics if t not in known]
    links = card.get("links")
    if not isinstance(links, list) or len(links) > 3:
        errs.append("links: a list of at most 3")
    else:
        for i, link in enumerate(links, 1):
            if not str(link.get("title") or "").strip() or not LINK.match(str(link.get("url") or "")):
                errs.append(f"link {i}: needs a title and a public https url")
    if not DAY.match(str(card.get("checked") or "")):
        errs.append("checked must be YYYY-MM-DD")
    if not str(card.get("license") or "").startswith("CC BY 4.0"):
        errs.append("license must be CC BY 4.0")
    return errs
