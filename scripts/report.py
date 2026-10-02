#!/usr/bin/env python3
"""Print the update agent's worklist: what is stale, past, estimated-but-soon, or newly collected.

  python3 scripts/report.py            # markdown worklist (what agent/AGENT.md step 2 reads)
  python3 scripts/report.py --today 2026-11-01

Rules (days are calendar days):
  conferences  no upcoming edition · estimated deadline/edition within 120 days · next submission
               deadline passed with no later edition · last_verified > 30
  journals     last_verified > 180 · JIF older than last year's JCR after July
  internships  open/rolling with deadline passed, posted > 90 or last_verified > 14 · upcoming > 14
  scholarships no future deadline (next cycle missing) · estimated deadline within 90 · last_verified > 30
  auto jobs    postings from the daily collector that are not curated yet
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def load(cat):
    for f in sorted((DATA / cat).glob("*.yaml")):
        yield f, yaml.safe_load(f.read_text(encoding="utf-8")) or {}


def as_date(v):
    if isinstance(v, dt.date):
        return v
    try:
        return dt.date.fromisoformat(str(v)[:10])
    except ValueError:
        return None


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--today")
    args = ap.parse_args(argv)
    today = as_date(args.today) if args.today else dt.date.today()

    def age(v):
        d = as_date(v)
        return (today - d).days if d else 10 ** 6

    work = {"conferences": [], "journals": [], "internships": [], "scholarships": []}

    for f, c in load("conferences"):
        why = []
        eds = c.get("editions") or []
        upcoming = [e for e in eds if not e.get("end") or as_date(e["end"]) >= today]
        if not upcoming:
            why.append("no upcoming edition — add the next one")
        for e in eds:
            soon = as_date(e.get("start"))
            if e.get("status") == "estimated" and soon and (soon - today).days <= 365:
                why.append(f"{e.get('year')} edition is still estimated — check if announced")
            for dl in e.get("deadlines") or []:
                d = as_date(dl.get("date"))
                est = dl.get("estimated") or e.get("status") == "estimated"
                if est and d and 0 <= (d - today).days <= 120 and dl.get("kind") in ("abstract", "paper"):
                    why.append(f"{e.get('year')} {dl['kind']} deadline {d} is estimated and within 120 days — confirm")
        subs = [as_date(dl["date"]) for e in eds for dl in e.get("deadlines") or []
                if dl.get("kind") in ("abstract", "paper") and as_date(dl.get("date"))]
        if subs and max(subs) < today:
            why.append("every known submission deadline has passed — add the following edition (estimated if needed)")
        if age(c.get("last_verified")) > 30:
            why.append(f"last verified {c.get('last_verified')}")
        if why:
            work["conferences"].append((f.stem, why))

    jcr_year = today.year - 1 if today.month >= 7 else today.year - 2
    for f, j in load("journals"):
        why = []
        jif = (j.get("metrics") or {}).get("jif")
        if jif and jif.get("year", 0) < jcr_year:
            why.append(f"JIF is from {jif.get('year')}; JCR {jcr_year + 1} release ({jcr_year} values) should be out")
        if age(j.get("last_verified")) > 180:
            why.append(f"last verified {j.get('last_verified')}")
        if why:
            work["journals"].append((f.stem, why))

    for f, i in load("internships"):
        why = []
        st = i.get("status")
        dl = as_date(i.get("deadline"))
        if st in ("open", "rolling"):
            if dl and dl < today:
                why.append(f"deadline {dl} passed — mark closed or find the new posting")
            if i.get("posted") and age(i.get("posted")) > 90:
                why.append(f"posted {i.get('posted')} (> 90 days) — still open?")
            if age(i.get("last_verified")) > 14:
                why.append(f"last verified {i.get('last_verified')} — still open?")
        elif st == "upcoming" and age(i.get("last_verified")) > 14:
            why.append("upcoming — has it opened?")
        elif st == "closed" and age(i.get("last_verified")) > 60:
            why.append("closed for 60+ days — delete the file unless the program recurs")
        if why:
            work["internships"].append((f.stem, why))

    for f, s in load("scholarships"):
        why = []
        dls = (s.get("cycle") or {}).get("deadlines") or []
        future = [x for x in dls if as_date(x.get("date")) and as_date(x["date"]) >= today and x.get("kind") not in ("result", "interview")]
        if not future and s.get("status") != "rolling":
            why.append("no future deadline — add the next cycle (estimated if not announced)")
        for x in future:
            d = as_date(x["date"])
            if x.get("estimated") and (d - today).days <= 90:
                why.append(f"{x.get('kind')} {d} is estimated and within 90 days — confirm")
        if age(s.get("last_verified")) > 30:
            why.append(f"last verified {s.get('last_verified')}")
        if why:
            work["scholarships"].append((f.stem, why))

    jobs = {}
    try:
        jobs = json.loads((DATA / "auto" / "jobs.json").read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    curated = set()
    for _, i in load("internships"):
        curated.add((i.get("apply_url") or "").rstrip("/"))
    new_jobs = [p for p in jobs.get("postings", []) if p.get("url", "").rstrip("/") not in curated]

    print(f"# Update worklist — {today}\n")
    total = 0
    for cat, rows in work.items():
        print(f"## {cat} ({len(rows)})")
        for stem, why in rows:
            print(f"- data/{cat}/{stem}.yaml: " + "; ".join(why))
        print()
        total += len(rows)
    print(f"## new auto-collected postings to review ({len(new_jobs)})")
    for p in new_jobs[:60]:
        print(f"- {p.get('company')} — {p.get('title')} · {p.get('location')} · posted {p.get('posted')} · {p.get('url')}")
    if len(new_jobs) > 60:
        print(f"- … {len(new_jobs) - 60} more in data/auto/jobs.json")
    for e in jobs.get("errors", []):
        print(f"- collector error: {e.get('company')} ({e.get('ats')}): {e.get('error')} — fix the watchlist entry")
    print(f"\n{total} items need attention.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
