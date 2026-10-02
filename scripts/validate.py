#!/usr/bin/env python3
"""Check data/<category>/*.yaml against agent/SCHEMA.md.

Usage:
  python3 scripts/validate.py                 # every category
  python3 scripts/validate.py data/journals   # one folder (or one file)

Exit status 1 when any error is found. Warnings never fail the run.
"""
from __future__ import annotations

import datetime as dt
import os
import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = pathlib.Path(os.environ.get("AER_DATA", ROOT / "data"))  # override for tests
CATEGORIES = ("conferences", "journals", "internships", "scholarships")

_taxonomy = yaml.safe_load((DATA / "fields.yaml").read_text(encoding="utf-8"))
FIELD_KEYS = {f["key"] for f in _taxonomy["fields"]}
COMMUNITIES = {c["key"] for c in _taxonomy["communities"]}

ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MONTH_RE = re.compile(r"^\d{4}-\d{2}$")
COUNTRY_RE = re.compile(r"^[A-Z]{2}$")
PLACEHOLDERS = {"n/a", "na", "tbd", "tba", "unknown", "none", "null", "-", "?"}

CONF_DEADLINE_KINDS = {"abstract", "paper", "supplementary", "rebuttal", "notification",
                       "camera-ready", "workshop-proposal", "late-breaking", "registration", "other"}
SCHOL_DEADLINE_KINDS = {"application", "internal", "recommendation", "interview", "result", "other"}


class Report:
    def __init__(self, path: pathlib.Path):
        self.path = path
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def err(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)


def is_date(v) -> bool:
    if isinstance(v, dt.date):
        return True
    return isinstance(v, str) and bool(DATE_RE.match(v)) and _parses(v)


def _parses(s: str) -> bool:
    try:
        dt.date.fromisoformat(s)
        return True
    except ValueError:
        return False


def is_url(v) -> bool:
    return isinstance(v, str) and v.startswith(("http://", "https://")) and " " not in v


def need(r: Report, d: dict, key: str, kind=None) -> bool:
    if key not in d or d[key] is None or d[key] == "":
        r.err(f"missing required key `{key}`")
        return False
    if kind is not None and not isinstance(d[key], kind):
        r.err(f"`{key}` should be {kind.__name__ if isinstance(kind, type) else kind}, got {type(d[key]).__name__}")
        return False
    return True


def enum(r: Report, d: dict, key: str, allowed: set, required=True) -> None:
    if key not in d:
        if required:
            r.err(f"missing required key `{key}`")
        return
    if d[key] not in allowed:
        r.err(f"`{key}: {d[key]}` not in {sorted(map(str, allowed))}")


ENUM_KEYS = {"citizenship", "work_mode"}  # their allowed values include "none" and "unknown"


def scan_placeholders(r: Report, node, where="") -> None:
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ENUM_KEYS:
                continue
            scan_placeholders(r, v, f"{where}.{k}" if where else str(k))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            scan_placeholders(r, v, f"{where}[{i}]")
    elif node is None:
        r.err(f"`{where}` is null — omit the key instead")
    elif isinstance(node, str) and node.strip().lower() in PLACEHOLDERS:
        r.err(f"`{where}` is a placeholder ({node!r}) — omit the key instead")


def common(r: Report, d: dict, cat: str) -> None:
    need(r, d, "id", str)
    if isinstance(d.get("id"), str):
        if not ID_RE.match(d["id"]):
            r.err(f"id `{d['id']}` must be lowercase ascii words joined by '-'")
        if d["id"] != r.path.stem:
            r.err(f"id `{d['id']}` must equal the file name `{r.path.stem}`")
    if need(r, d, "fields", list):
        allowed = FIELD_KEYS | ({"any"} if cat == "scholarships" else set())
        for f in d["fields"]:
            if f not in allowed:
                r.err(f"unknown field `{f}` (allowed: {sorted(allowed)})")
    if need(r, d, "fit", int) and d["fit"] not in (1, 2, 3):
        r.err("`fit` must be 1, 2 or 3")
    need(r, d, "take", str)
    if need(r, d, "sources", list):
        for s in d["sources"]:
            if not is_url(s):
                r.err(f"source is not a URL: {s!r}")
    if need(r, d, "last_verified") and not is_date(d["last_verified"]):
        r.err("`last_verified` must be YYYY-MM-DD")
    for k, v in (d.get("links") or {}).items():
        if not is_url(v):
            r.err(f"links.{k} is not a URL: {v!r}")
    scan_placeholders(r, d)


def orientation(r: Report, d: dict) -> None:
    enum(r, d, "community", COMMUNITIES)
    if need(r, d, "tier", int) and d["tier"] not in (1, 2, 3):
        r.err("`tier` must be 1, 2 or 3")
    o = d.get("orientation")
    if not isinstance(o, dict):
        r.err("missing `orientation` mapping")
        return
    c = o.get("contribution")
    if not isinstance(c, (int, float)) or not -2 <= c <= 2:
        r.err("orientation.contribution must be a number in [-2, 2]")
    if not isinstance(o.get("summary"), str):
        r.err("orientation.summary (Korean text) is required")
    if not isinstance(o.get("values"), list) or not o.get("values"):
        r.err("orientation.values must be a non-empty list")


def check_deadlines(r: Report, items, kinds: set, where: str) -> None:
    if not isinstance(items, list):
        r.err(f"{where} must be a list")
        return
    for i, dl in enumerate(items):
        w = f"{where}[{i}]"
        if not isinstance(dl, dict):
            r.err(f"{w} must be a mapping")
            continue
        if dl.get("kind") not in kinds:
            r.err(f"{w}.kind `{dl.get('kind')}` not in {sorted(kinds)}")
        if dl.get("kind") == "other" and not dl.get("label"):
            r.err(f"{w}: kind `other` needs a `label`")
        if not is_date(dl.get("date")):
            r.err(f"{w}.date must be YYYY-MM-DD")
        if "estimated" in dl and not isinstance(dl["estimated"], bool):
            r.err(f"{w}.estimated must be true/false")


def check_place(r: Report, p: dict, where: str, need_coords=True) -> None:
    if not isinstance(p.get("city"), str):
        r.err(f"{where}.city is required")
    if not (isinstance(p.get("country"), str) and COUNTRY_RE.match(p["country"])):
        r.err(f"{where}.country must be an ISO alpha-2 code like US, KR")
    lat, lon = p.get("lat"), p.get("lon")
    if lat is None or lon is None:
        if need_coords:
            r.warn(f"{where}: lat/lon missing — the map will skip it")
    elif not (isinstance(lat, (int, float)) and isinstance(lon, (int, float)) and -90 <= lat <= 90 and -180 <= lon <= 180):
        r.err(f"{where}: lat/lon out of range")


def check_conference(r: Report, d: dict) -> None:
    common(r, d, "conferences")
    orientation(r, d)
    for k in ("acronym", "name", "organizer"):
        need(r, d, k, str)
    enum(r, d, "frequency", {"annual", "biennial", "irregular"})
    rv = d.get("review") or {}
    if rv:
        enum(r, rv, "blind", {"double", "single", "open"}, required=False)
        if "rebuttal" in rv and not isinstance(rv["rebuttal"], bool):
            r.err("review.rebuttal must be true/false")
        ar = rv.get("acceptance_rate")
        if ar is not None and not (isinstance(ar, dict) and isinstance(ar.get("value"), (int, float)) and 0 < ar["value"] < 1):
            r.err("review.acceptance_rate must be {value: 0.xx, year: YYYY}")
    eds = d.get("editions")
    if not isinstance(eds, list) or not eds:
        r.err("`editions` must list at least the next edition")
        return
    for i, e in enumerate(eds):
        w = f"editions[{i}]"
        if not isinstance(e.get("year"), int):
            r.err(f"{w}.year must be an integer")
        enum(r, e, "status", {"confirmed", "announced", "estimated"})
        for k in ("start", "end"):
            if k in e and not is_date(e[k]):
                r.err(f"{w}.{k} must be YYYY-MM-DD")
        if e.get("status") != "estimated" and not (is_date(e.get("start")) and is_date(e.get("end"))):
            r.err(f"{w}: a confirmed/announced edition needs start and end dates")
        if "city" in e or "country" in e:
            check_place(r, e, w)
        elif e.get("status") != "estimated":
            r.err(f"{w}: city and country are required unless status is estimated")
        if "url" in e and not is_url(e["url"]):
            r.err(f"{w}.url is not a URL")
        check_deadlines(r, e.get("deadlines", []), CONF_DEADLINE_KINDS, f"{w}.deadlines")


def check_journal(r: Report, d: dict) -> None:
    common(r, d, "journals")
    orientation(r, d)
    for k in ("abbr", "name", "publisher"):
        need(r, d, k, str)
    enum(r, d, "access", {"subscription", "hybrid", "open-access"})
    m = d.get("metrics")
    if not isinstance(m, dict) or not m:
        r.err("`metrics` mapping is required (at least one metric)")
    else:
        for k in ("jif", "jif_5y", "citescore", "sjr"):
            v = m.get(k)
            if v is not None and not (isinstance(v, dict) and isinstance(v.get("value"), (int, float)) and isinstance(v.get("year"), int)):
                r.err(f"metrics.{k} must be {{value: number, year: YYYY}}")
        for k in ("jcr_quartile", "sjr"):
            v = m.get(k) or {}
            q = v.get("value") if k == "jcr_quartile" else v.get("quartile")
            if v and q is not None and q not in ("Q1", "Q2", "Q3", "Q4"):
                r.err(f"metrics.{k} quartile must be Q1–Q4")
        if "jif" not in m:
            r.warn("no JIF — fine for journals without one, but double-check")
    rv = d.get("review") or {}
    enum(r, rv, "blind", {"double", "single", "open"}, required=False)
    if "apc_usd" in d and not isinstance(d["apc_usd"], (int, float)):
        r.err("apc_usd must be a number")


def check_internship(r: Report, d: dict) -> None:
    common(r, d, "internships")
    for k in ("company", "title", "season"):
        need(r, d, k, str)
    enum(r, d, "org_type", {"bigtech", "robotics", "construction-robotics", "construction-tech",
                            "construction", "autonomy", "lab"})
    if need(r, d, "degree", list):
        for g in d["degree"]:
            if g not in ("phd", "ms", "bs"):
                r.err(f"degree `{g}` not in phd/ms/bs")
    if "start" in d and not (d["start"] == "flexible" or (isinstance(d["start"], str) and MONTH_RE.match(d["start"]))):
        r.err('start must be "YYYY-MM" or "flexible" (quoted)')
    dw = d.get("duration_weeks")
    if dw is not None and not (isinstance(dw, list) and len(dw) == 2 and all(isinstance(x, (int, float)) for x in dw)):
        r.err("duration_weeks must be [min, max]")
    if need(r, d, "locations", list):
        for i, p in enumerate(d["locations"]):
            check_place(r, p, f"locations[{i}]")
    enum(r, d, "work_mode", {"onsite", "hybrid", "remote", "unknown"})
    p = d.get("pay")
    if p is not None:
        if not isinstance(p.get("min"), (int, float)):
            r.err("pay.min must be a number")
        if "max" in p and not isinstance(p["max"], (int, float)):
            r.err("pay.max must be a number")
        enum(r, p, "unit", {"hour", "week", "month", "year"})
        enum(r, p, "source", {"posting", "levels.fyi", "glassdoor", "estimate"})
        if not isinstance(p.get("currency"), str):
            r.err("pay.currency is required (USD, KRW, EUR, …)")
    if need(r, d, "skills", list):
        for s in d["skills"]:
            if not (isinstance(s, str) and ID_RE.match(s)):
                r.err(f"skill tag `{s}` must be lowercase with '-'")
    enum(r, d, "citizenship", {"none", "us-person", "us-citizen", "local-work-permit", "unknown"})
    enum(r, d, "status", {"open", "upcoming", "rolling", "closed"})
    for k in ("posted", "deadline"):
        if k in d and not is_date(d[k]):
            r.err(f"{k} must be YYYY-MM-DD")
    if not is_url(d.get("apply_url")):
        r.err("apply_url must be a URL")


def check_scholarship(r: Report, d: dict) -> None:
    common(r, d, "scholarships")
    for k in ("name", "organizer"):
        need(r, d, k, str)
    enum(r, d, "org_type", {"korean-foundation", "korean-government", "industry", "us-government",
                            "society", "university", "other"})
    enum(r, d, "type", {"fellowship", "scholarship", "travel-grant", "research-grant", "award"})
    a = d.get("amount")
    if not isinstance(a, dict):
        r.err("`amount` mapping is required")
    else:
        if not isinstance(a.get("summary"), str):
            r.err("amount.summary is required")
        if "value" in a:
            if not isinstance(a["value"], (int, float)):
                r.err("amount.value must be a number")
            enum(r, a, "unit", {"year", "month", "total", "one-time"})
            if not isinstance(a.get("currency"), str):
                r.err("amount.currency is required with amount.value")
    e = d.get("eligibility")
    if not isinstance(e, dict):
        r.err("`eligibility` mapping is required")
    else:
        for k in ("korean_ok", "international_in_us_ok", "us_citizen_only"):
            if k not in e:
                r.err(f"eligibility.{k} (true/false) is required")
            elif not isinstance(e[k], bool):
                r.err(f"eligibility.{k} must be true/false")
    if "nomination" in d and not isinstance(d["nomination"], bool):
        r.err("nomination must be true/false")
    c = d.get("cycle")
    if not isinstance(c, dict):
        r.err("`cycle` mapping is required")
    else:
        check_deadlines(r, c.get("deadlines", []), SCHOL_DEADLINE_KINDS, "cycle.deadlines")
    enum(r, d, "status", {"open", "upcoming", "closed", "rolling"})
    if not is_url(d.get("apply_url") or (d.get("links") or {}).get("home")):
        r.err("apply_url or links.home must be a URL")


CHECKERS = {
    "conferences": check_conference,
    "journals": check_journal,
    "internships": check_internship,
    "scholarships": check_scholarship,
}


def files_for(args: list[str]) -> list[pathlib.Path]:
    if not args:
        return sorted(p for c in CATEGORIES for p in (DATA / c).glob("*.yaml"))
    out: list[pathlib.Path] = []
    for a in args:
        p = pathlib.Path(a)
        if not p.is_absolute():
            p = (pathlib.Path.cwd() / p).resolve()
        out += sorted(p.glob("*.yaml")) if p.is_dir() else [p]
    return out


def validate_file(path: pathlib.Path) -> Report:
    r = Report(path)
    cat = path.parent.name
    if cat not in CHECKERS:
        r.err(f"file is not inside data/<{'|'.join(CATEGORIES)}>/")
        return r
    try:
        d = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        r.err(f"YAML syntax: {exc}")
        return r
    if not isinstance(d, dict):
        r.err("top level must be a mapping")
        return r
    CHECKERS[cat](r, d)
    return r


def main(argv: list[str]) -> int:
    files = files_for(argv)
    n_err = n_warn = 0
    for f in files:
        r = validate_file(f)
        rel = f.relative_to(ROOT) if f.is_relative_to(ROOT) else f
        for m in r.errors:
            print(f"ERROR {rel}: {m}")
        for m in r.warnings:
            print(f"warn  {rel}: {m}")
        n_err += len(r.errors)
        n_warn += len(r.warnings)
    print(f"{len(files)} files checked: {n_err} errors, {n_warn} warnings")
    return 1 if n_err else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
