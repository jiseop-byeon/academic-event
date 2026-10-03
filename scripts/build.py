#!/usr/bin/env python3
"""Build the static site into _site/.

  python3 scripts/build.py             # validate (fail on any error), bundle, write _site/
  python3 scripts/build.py --lenient   # skip invalid files with a warning (work in progress)

Writes _site/ (a copy of site/), _site/data.json (every item plus a derived event list),
_site/deadlines.ics (submission and application deadlines) and _site/all-events.ics
(also notifications, camera-ready dates and the conferences themselves).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import re
import shutil
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import iconlib  # noqa: E402
import validate  # noqa: E402

DATA = pathlib.Path(os.environ.get("AER_DATA", ROOT / "data"))  # override for tests
SITE = ROOT / "site"
OUT = pathlib.Path(os.environ.get("AER_OUT", ROOT / "_site"))  # local previews can build outside a synced folder
SITE_URL = "https://jiseop-byeon.github.io/academic-event/"
CATEGORIES = ("conferences", "journals", "internships", "scholarships", "programs")
HOURS_PER_MONTH = 40 * 52 / 12

CONF_KIND = {
    "abstract": "초록 마감", "paper": "논문 마감", "supplementary": "보충자료 마감",
    "rebuttal": "반박(rebuttal)", "notification": "결과 발표", "camera-ready": "최종본 마감",
    "workshop-proposal": "워크숍 제안 마감", "late-breaking": "LBR 마감", "registration": "등록 마감",
    "other": "기타",
}
SCHOL_KIND = {
    "application": "지원 마감", "internal": "학내 추천 마감", "recommendation": "추천서 마감",
    "interview": "면접", "result": "결과 발표", "other": "기타",
}
KIND_EN = {
    "abstract": "Abstract deadline", "paper": "Paper deadline", "supplementary": "Supplementary deadline",
    "rebuttal": "Rebuttal", "notification": "Notification", "camera-ready": "Camera-ready",
    "workshop-proposal": "Workshop proposals", "late-breaking": "Late-breaking deadline",
    "registration": "Registration deadline", "other": "Other", "application": "Application deadline",
    "internal": "Internal (university) deadline", "recommendation": "Recommendation letters due",
    "interview": "Interview", "result": "Results", "internship-deadline": "Application deadline", "event": "Conference",
    "program-application": "Application deadline", "program-registration": "Registration deadline",
    "program-nomination": "Nomination deadline", "program-event": "Event", "program-other": "Other",
}
PROGRAM_KIND = {"application": "지원 마감", "registration": "등록 마감", "nomination": "추천 마감", "event": "행사", "other": "기타"}
HANGUL = re.compile(r"[\uac00-\ud7a3]")


def labels(d: dict, kind: str, ko_default: str) -> tuple[str, str]:
    """(Korean label, English label) for a deadline."""
    lab = d.get("label")
    ko = lab or ko_default
    en = d.get("label_en") or (lab if lab and not HANGUL.search(lab) else KIND_EN.get(kind, kind))
    return ko, en
# Kinds that ask the owner to submit something; these go into deadlines.ics and the dashboard.
ACTION_KINDS = {"abstract", "paper", "late-breaking", "application", "internal", "recommendation",
                "internship-deadline", "program-application", "program-registration", "program-nomination"}
# workshop proposals and program events stay in all-events.ics only


def jsonable(o):
    if isinstance(o, (dt.date, dt.datetime)):
        return o.isoformat()
    if isinstance(o, dict):
        return {k: jsonable(v) for k, v in o.items()}
    if isinstance(o, list):
        return [jsonable(v) for v in o]
    return o


def load(cat: str, lenient: bool) -> tuple[list[dict], int]:
    items, errors = [], 0
    for path in sorted((DATA / cat).glob("*.yaml")):
        rep = validate.validate_file(path)
        if rep.errors:
            errors += len(rep.errors)
            for m in rep.errors:
                print(f"ERROR {path.relative_to(ROOT)}: {m}", file=sys.stderr)
            if lenient:
                continue
        items.append(jsonable(yaml.safe_load(path.read_text(encoding="utf-8"))))
    return items, errors


def read_json(path: pathlib.Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


# ---------------------------------------------------------------- normalization

def to_usd(value: float, currency: str, per_usd: dict) -> float | None:
    rate = per_usd.get((currency or "").upper())
    return None if not rate else value / rate


def norm_pay(p: dict, per_usd: dict) -> None:
    per_month = {"hour": HOURS_PER_MONTH, "week": 52 / 12, "month": 1, "year": 1 / 12}[p["unit"]]
    lo = to_usd(p["min"] * per_month, p["currency"], per_usd)
    hi = to_usd(p.get("max", p["min"]) * per_month, p["currency"], per_usd)
    if lo is not None:
        p["usd_month"] = [round(lo), round(hi)]


def norm_amount(a: dict, per_usd: dict) -> None:
    if not isinstance(a.get("value"), (int, float)):
        return
    lo = to_usd(a["value"], a.get("currency", "USD"), per_usd)
    hi = to_usd(a.get("max", a["value"]), a.get("currency", "USD"), per_usd)
    if lo is None:
        return
    unit = a.get("unit", "year")
    if unit == "month":
        lo, hi, unit = lo * 12, hi * 12, "year"
    a["usd"] = round(lo)
    a["usd_max"] = round(hi)
    a["usd_unit"] = "year" if unit == "year" else "once"


# ---------------------------------------------------------------- events

def build_events(b: dict) -> list[dict]:
    ev = []
    for c in b["conferences"]:
        for e in c.get("editions", []):
            name = f'{c["acronym"]} {e["year"]}'
            est_edition = e.get("status") == "estimated"
            countries = [e["country"]] if e.get("country") else []
            for d in e.get("deadlines", []):
                ko, en = labels(d, d["kind"], CONF_KIND[d["kind"]])
                ev.append({
                    "date": d["date"], "cat": "conferences", "id": c["id"], "name": name, "short": c["acronym"],
                    "kind": d["kind"], "label": ko, "label_en": en, "countries": countries,
                    "estimated": bool(d.get("estimated") or est_edition),
                    "tz": d.get("tz"), "time": d.get("time"), "fit": c["fit"], "fields": c["fields"],
                    "url": e.get("url") or (c.get("links") or {}).get("home"),
                })
            if e.get("start"):
                place = ", ".join(x for x in (e.get("city"), e.get("country")) if x)
                ev.append({
                    "date": e["start"], "end": e.get("end"), "cat": "conferences", "id": c["id"],
                    "name": name, "short": c["acronym"], "kind": "event", "label": "개최", "label_en": "Conference",
                    "place": place, "countries": countries,
                    "estimated": est_edition, "fit": c["fit"], "fields": c["fields"],
                    "url": e.get("url") or (c.get("links") or {}).get("home"),
                })
    for s in b["scholarships"]:
        for d in (s.get("cycle") or {}).get("deadlines", []):
            ko, en = labels(d, d["kind"], SCHOL_KIND[d["kind"]])
            ev.append({
                "date": d["date"], "cat": "scholarships", "id": s["id"], "name": s["name"],
                "short": re.sub(r"\s*\(.*\)\s*$", "", s["name"]), "countries": [],
                "kind": d["kind"], "label": ko, "label_en": en,
                "estimated": bool(d.get("estimated")), "tz": d.get("tz"), "fit": s["fit"],
                "fields": s["fields"], "url": s.get("apply_url") or (s.get("links") or {}).get("home"),
            })
    for p in b.get("programs", []):
        loc = p.get("location") or {}
        for d in (p.get("cycle") or {}).get("deadlines", []):
            kind = "program-" + d["kind"]
            ko, en = labels(d, kind, PROGRAM_KIND.get(d["kind"], d["kind"]))
            ev.append({
                "date": d["date"], "cat": "programs", "id": p["id"], "name": p["name"], "short": p["name"],
                "kind": kind, "label": ko, "label_en": en, "estimated": bool(d.get("estimated")),
                "fit": p["fit"], "fields": p["fields"], "countries": [loc["country"]] if loc.get("country") else [],
                "url": p.get("apply_url") or (p.get("links") or {}).get("home"),
            })
    for i in b["internships"]:
        if i.get("deadline"):
            ev.append({
                "date": i["deadline"], "cat": "internships", "id": i["id"],
                "name": f'{i["company"]} — {i["title"]}', "short": i["company"], "kind": "internship-deadline",
                "label": "지원 마감", "label_en": "Application deadline", "estimated": False,
                "countries": sorted({l["country"] for l in i.get("locations", []) if l.get("country")}), "fit": i["fit"], "fields": i["fields"],
                "url": i.get("apply_url"),
            })
    ev.sort(key=lambda x: (x["date"], x["cat"], x["name"]))
    return ev


# ---------------------------------------------------------------- iCalendar

def ics_text(s: str) -> str:
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def ics_fold(line: str) -> str:
    """Fold to 75 octets per line (RFC 5545 §3.1) without splitting a UTF-8 character."""
    b = line.encode("utf-8")
    parts, limit = [], 75
    while len(b) > limit:
        cut = limit
        while cut > 0 and (b[cut] & 0xC0) == 0x80:
            cut -= 1
        parts.append(b[:cut].decode("utf-8"))
        b = b[cut:]
        limit = 74  # continuation lines start with one space
    parts.append(b.decode("utf-8"))
    return "\r\n ".join(parts)


def write_ics(events: list[dict], path: pathlib.Path, name: str, stamp: str) -> int:
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//academic-event//radar//KO",
        "CALSCALE:GREGORIAN", "METHOD:PUBLISH", f"X-WR-CALNAME:{ics_text(name)}",
        "X-WR-TIMEZONE:UTC", "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    ]
    n = 0
    for e in events:
        start = dt.date.fromisoformat(e["date"])
        end = dt.date.fromisoformat(e.get("end") or e["date"]) + dt.timedelta(days=1)
        mark = " (est.)" if e.get("estimated") else ""
        summary = f'{e["name"]} · {e.get("label_en") or e["label"]}{mark}'
        desc = []
        if e.get("place"):
            desc.append(e["place"])
        if e.get("time") or e.get("tz"):
            desc.append("Due: " + " ".join(x for x in (e.get("time"), e.get("tz")) if x))
        if e.get("estimated"):
            desc.append("Estimated from past cycles — check the official announcement. / 과거 일정으로 추정한 날짜")
        desc.append(f'{SITE_URL}#/{e["cat"]}/{e["id"]}')
        lines += [
            "BEGIN:VEVENT",
            f'UID:{e["cat"]}-{e["id"]}-{e["kind"]}-{e["date"]}@jiseop-byeon.github.io',
            f"DTSTAMP:{stamp}",
            f"DTSTART;VALUE=DATE:{start:%Y%m%d}",
            f"DTEND;VALUE=DATE:{end:%Y%m%d}",
            ics_fold(f"SUMMARY:{ics_text(summary)}"),
            ics_fold(f"DESCRIPTION:{ics_text(chr(10).join(desc))}"),
        ]
        if e.get("url"):
            lines.append(ics_fold(f'URL:{e["url"]}'))
        lines += ["TRANSP:TRANSPARENT", "END:VEVENT"]
        n += 1
    lines.append("END:VCALENDAR")
    path.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8")
    return n


# ---------------------------------------------------------------- main

def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lenient", action="store_true", help="skip invalid files instead of failing")
    args = ap.parse_args(argv)

    taxonomy = yaml.safe_load((DATA / "fields.yaml").read_text(encoding="utf-8"))
    fx = yaml.safe_load((DATA / "fx.yaml").read_text(encoding="utf-8"))
    per_usd = fx["per_usd"]
    changelog = jsonable(yaml.safe_load((DATA / "changelog.yaml").read_text(encoding="utf-8")) or [])
    skills_path = DATA / "skill-links.yaml"
    skill_doc = yaml.safe_load(skills_path.read_text(encoding="utf-8")) if skills_path.exists() else {}
    skill_links = {k: {"url": skill_doc["base"] + v["path"], "label": v["label"]}
                   for k, v in (skill_doc.get("links") or {}).items()}

    bundle, total_errors = {}, 0
    for cat in CATEGORIES:
        bundle[cat], n = load(cat, args.lenient)
        total_errors += n
    if total_errors and not args.lenient:
        print(f"{total_errors} validation errors — fix them or build with --lenient", file=sys.stderr)
        return 1

    for i in bundle["internships"]:
        if i.get("pay"):
            norm_pay(i["pay"], per_usd)
    for s in bundle["scholarships"]:
        norm_amount(s["amount"], per_usd)

    openalex = read_json(DATA / "auto" / "openalex.json", {}).get("sources", {})
    for j in bundle["journals"]:
        if j.get("openalex_id") in openalex:
            j["openalex"] = openalex[j["openalex_id"]]

    companies = []
    for wl in sorted((ROOT / "agent").glob("watchlist*.yaml")):
        doc = yaml.safe_load(wl.read_text(encoding="utf-8")) or {}
        for c in (doc.get("companies") if isinstance(doc, dict) else doc) or []:
            companies.append({k: c.get(k) for k in ("name", "org_type", "careers", "ats", "relevant_now", "note", "note_en", "items")
                              if c.get(k) not in (None, "")})
    companies.sort(key=lambda c: (not c.get("relevant_now"), c.get("org_type") or "", (c.get("name") or "").lower()))

    icons = read_json(DATA / "auto" / "icons.json", {})
    careers = iconlib.careers_map(companies)
    def icon_for(h):
        f = (icons.get(h) or {}).get("file") if h else None
        return "icons/" + f if f else None
    for cat in CATEGORIES:
        for it in bundle[cat]:
            ic = icon_for(iconlib.icon_host(cat, it, careers))
            if ic:
                it["icon"] = ic
    for c in companies:
        h = iconlib.host(c.get("careers"))
        ic = icon_for(iconlib.ALIAS.get(h, h)) if iconlib.usable(h) else None
        if ic:
            c["icon"] = ic

    jobs = read_json(DATA / "auto" / "jobs.json", {"postings": []})
    curated_urls = {i.get("apply_url", "").rstrip("/") for i in bundle["internships"]}
    auto = [p for p in jobs.get("postings", []) if p.get("url", "").rstrip("/") not in curated_urls]

    now = dt.datetime.now(dt.timezone.utc)
    events = build_events(bundle)
    payload = {
        "meta": {
            "built_at": now.isoformat(timespec="seconds"),
            "site_url": SITE_URL,
            "fx": {"date": jsonable(fx.get("date")), "per_usd": per_usd},
            "jobs_collected_at": jobs.get("collected_at"),
            "counts": {c: len(bundle[c]) for c in CATEGORIES},
        },
        "fields": taxonomy["fields"],
        "communities": taxonomy["communities"],
        **bundle,
        "auto_jobs": auto,
        "companies": jsonable(companies),
        "events": events,
        "changelog": changelog,
        "skill_links": skill_links,
    }

    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SITE, OUT)
    (OUT / ".nojekyll").write_text("")
    if (DATA / "auto" / "icons").is_dir():
        shutil.copytree(DATA / "auto" / "icons", OUT / "icons")
    (OUT / "data.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    stamp = now.strftime("%Y%m%dT%H%M%SZ")
    keep_from = (now.date() - dt.timedelta(days=60)).isoformat()  # calendars need little history
    recent = [e for e in events if (e.get("end") or e["date"]) >= keep_from]
    action = [e for e in recent if e["kind"] in ACTION_KINDS]
    n1 = write_ics(action, OUT / "deadlines.ics", "Academic Event Radar · Deadlines", stamp)
    n2 = write_ics(recent, OUT / "all-events.ics", "Academic Event Radar · All events", stamp)

    counts = ", ".join(f"{len(bundle[c])} {c}" for c in CATEGORIES)
    print(f"built _site/: {counts}, {len(auto)} auto-collected postings; ics: {n1} deadlines, {n2} events")
    if total_errors:
        print(f"(lenient) skipped files with {total_errors} validation errors", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
