#!/usr/bin/env python3
"""Daily collector: poll public job-board APIs for internship postings → data/auto/jobs.json.

Reads every agent/watchlist*.yaml (entries: name, org_type, ats, board / host / tenant / site,
careers). Supported `ats`: greenhouse, lever, ashby, workday, amazon. Anything else is skipped.
Keeps postings whose title says intern / student researcher and that look relevant to
robotics, vision, physical AI or construction. No API keys, no logins, and never an email
address in any request.

  python3 scripts/collect_jobs.py            # write data/auto/jobs.json
  python3 scripts/collect_jobs.py --dry-run  # print a summary only
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import pathlib
import re
import sys
import time
import urllib.parse

import requests
import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "auto" / "jobs.json"
UA = {"User-Agent": "academic-event-radar/1.0 (+https://github.com/jiseop-byeon/academic-event)",
      "Accept": "application/json", "Accept-Encoding": "gzip, deflate"}
TIMEOUT = 25

INTERN = re.compile(r"\b(intern(ship)?s?|co-?op|student researcher|phd residency|working student|praktikum)\b", re.I)
TOPIC = re.compile(
    r"robot|manipulat|grasp|perception|computer vision|\bvision\b|\b3d\b|slam|navigation|autonom|embodied|"
    r"physical ai|reinforcement|imitation|motion planning|\bcontrols?\b|mechatronic|haptic|teleoperat|"
    r"simulation|machine learning|deep learning|\bml\b|\bai\b|lidar|sensor fusion|construction|"
    r"humanoid|locomotion|kinematic|research scientist|applied scientist", re.I)
OFFSCOPE = re.compile(
    r"financ|accounting|marketing|sales|legal|recruit|talent|people|human resources|supply chain|procure|"
    r"sourcing|technician|facilit|business|communications|graphic|content|brand|\bcnc\b|machinist|tax|audit", re.I)
# Big companies post hundreds of internships; require a topic word in the title there.
TITLE_TOPIC_ONLY = {"bigtech", "autonomy"}
MAX_AGE_DAYS = 150


def clean(text: str) -> str:
    text = html.unescape(text or "")
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


PAY = re.compile(
    r"\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*([kK])?\s*(?:USD)?\s*(?:-|–|—|to)\s*\$?\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*([kK])?"
    r"(?:\s*(?:USD|usd))?(?:\s*(?:per|/|an?)\s*(hour|hr|month|year|yr|annum|week))?", re.I)


def find_pay(text: str) -> str | None:
    m = PAY.search(text or "")
    if not m:
        return None
    lo = float(m.group(1).replace(",", "")) * (1000 if m.group(2) else 1)
    hi = float(m.group(3).replace(",", "")) * (1000 if m.group(4) else 1)
    unit = (m.group(5) or "").lower()
    if not unit:
        unit = "hr" if hi < 400 else "mo" if hi < 40000 else "yr"
    unit = {"hour": "hr", "month": "mo", "year": "yr", "annum": "yr", "week": "wk"}.get(unit, unit)
    fmt = (lambda v: f"${v:,.0f}") if hi >= 1000 else (lambda v: f"${v:g}")
    return f"{fmt(lo)}–{fmt(hi)}/{unit}"


def relevant(title: str, body: str, org_type: str) -> list[str] | None:
    if not INTERN.search(title) or OFFSCOPE.search(title):
        return None
    hits = sorted({m.group(0).lower() for m in TOPIC.finditer(title)})
    if hits:
        return hits
    if org_type in TITLE_TOPIC_ONLY:
        return None
    hits = sorted({m.group(0).lower() for m in TOPIC.finditer(body[:4000])})
    return hits or ["intern"]


def iso(value) -> str | None:
    if value is None:
        return None
    try:
        if isinstance(value, (int, float)):  # epoch ms
            return dt.datetime.fromtimestamp(value / 1000, dt.timezone.utc).date().isoformat()
        return dt.date.fromisoformat(str(value)[:10]).isoformat()
    except ValueError:
        return None


def workday_posted(text: str) -> str | None:
    today = dt.date.today()
    t = (text or "").lower()
    if "today" in t:
        return today.isoformat()
    if "yesterday" in t:
        return (today - dt.timedelta(days=1)).isoformat()
    m = re.search(r"(\d+)\+?\s*days?", t)
    return (today - dt.timedelta(days=int(m.group(1)))).isoformat() if m else None


# ---------------------------------------------------------------- fetchers → (title, location, url, posted, body, pay)

def greenhouse(c):
    r = requests.get(f"https://boards-api.greenhouse.io/v1/boards/{c['board']}/jobs", params={"content": "true"}, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    for j in r.json().get("jobs", []):
        body = clean(j.get("content", ""))
        yield j.get("title", ""), (j.get("location") or {}).get("name", ""), j.get("absolute_url"), iso(j.get("first_published") or j.get("updated_at")), body, find_pay(body)


def lever(c):
    r = requests.get(f"https://api.lever.co/v0/postings/{c['board']}", params={"mode": "json"}, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    for j in r.json():
        body = clean(j.get("descriptionPlain") or j.get("description", "")) + " " + " ".join(clean(x.get("content", "")) for x in j.get("lists", []))
        pay = None
        sr = j.get("salaryRange") or {}
        if sr.get("min"):
            unit = {"per-hour-wage": "hr", "per-month-salary": "mo", "per-year-salary": "yr"}.get(sr.get("interval"), "")
            pay = f"${sr['min']:,}–${sr.get('max', sr['min']):,}/{unit}".replace("/", "/" if unit else "")
        cat = j.get("categories") or {}
        yield j.get("text", ""), cat.get("location", ""), j.get("hostedUrl"), iso(j.get("createdAt")), body, pay or find_pay(body)


def ashby(c):
    r = requests.get(f"https://api.ashbyhq.com/posting-api/job-board/{c['board']}", params={"includeCompensation": "true"}, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    for j in r.json().get("jobs", []):
        body = clean(j.get("descriptionPlain") or j.get("descriptionHtml", ""))
        comp = (j.get("compensation") or {}).get("compensationTierSummary") or (j.get("compensation") or {}).get("scrapeableCompensationSalarySummary")
        yield j.get("title", ""), j.get("location", ""), j.get("jobUrl"), iso(j.get("publishedAt")), body, comp or find_pay(body)


def workday_parts(c):
    host, tenant, site = c.get("host"), c.get("tenant"), c.get("site")
    board = c.get("board") or ""
    if "/" in board and not (tenant and site):
        tenant, site = board.split("/", 1)
    if not host or not site:
        u = urllib.parse.urlparse(c.get("careers") or "")
        if "myworkdayjobs.com" in u.netloc:
            host = host or u.netloc
            parts = [p for p in u.path.split("/") if p and not re.match(r"^[a-z]{2}-[A-Z]{2}$", p)]
            site = site or (parts[0] if parts else None)
    tenant = tenant or (host.split(".")[0] if host else None)
    if not (host and tenant and site):
        raise ValueError("workday entry needs host + tenant + site (or a myworkdayjobs.com careers URL)")
    return host, tenant, site


def workday(c):
    host, tenant, site = workday_parts(c)
    api = f"https://{host}/wday/cxs/{tenant}/{site}/jobs"
    for query in c.get("queries") or ["intern"]:
        seen = 0
        for offset in range(0, 100, 20):
            r = requests.post(api, json={"appliedFacets": {}, "limit": 20, "offset": offset, "searchText": query},
                              headers={**UA, "Content-Type": "application/json"}, timeout=TIMEOUT)
            r.raise_for_status()
            data = r.json()
            posts = data.get("jobPostings", [])
            for j in posts:
                path = j.get("externalPath", "")
                yield j.get("title", ""), j.get("locationsText", ""), f"https://{host}/en-US/{site}{path}", workday_posted(j.get("postedOn")), "", None
            seen += len(posts)
            if not posts or seen >= data.get("total", 0):
                break
            time.sleep(0.4)


def amazon(c):
    queries = c.get("queries") or ["robotics intern", "applied scientist intern", "computer vision intern"]
    for q in queries:
        r = requests.get("https://www.amazon.jobs/en/search.json",
                         params={"base_query": q, "result_limit": 100, "sort": "recent"}, headers=UA, timeout=TIMEOUT)
        r.raise_for_status()
        for j in r.json().get("jobs", []):
            body = clean(j.get("description", "")) + " " + clean(j.get("basic_qualifications", ""))
            posted = None
            try:
                posted = dt.datetime.strptime(j.get("posted_date", ""), "%B %d, %Y").date().isoformat()
            except ValueError:
                pass
            yield j.get("title", ""), j.get("normalized_location") or j.get("location", ""), "https://www.amazon.jobs" + j.get("job_path", ""), posted, body, find_pay(body)
        time.sleep(0.4)


FETCH = {"greenhouse": greenhouse, "lever": lever, "ashby": ashby, "workday": workday, "amazon": amazon}


def normalize(c: dict) -> dict:
    """Accept the spellings the watchlists use: `board` or `token`; Workday as top-level keys or a `workday:` map."""
    c = dict(c)
    c["board"] = c.get("board") or c.get("token")
    wd = c.get("workday") if isinstance(c.get("workday"), dict) else {}
    for k in ("host", "tenant", "site"):
        if not c.get(k) and wd.get(k):
            c[k] = wd[k]
    return c


def load_watchlist() -> list[dict]:
    out, seen = [], set()
    for f in sorted((ROOT / "agent").glob("watchlist*.yaml")):
        doc = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
        items = doc.get("companies", []) if isinstance(doc, dict) else doc
        for c in map(normalize, items or []):
            key = (c.get("name"), c.get("ats"), str(c.get("board") or c.get("host")))
            if key in seen:
                continue
            seen.add(key)
            out.append(c)
    return out


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    cutoff = (dt.date.today() - dt.timedelta(days=MAX_AGE_DAYS)).isoformat()
    postings, errors, polled = {}, [], 0
    for c in load_watchlist():
        ats = (c.get("ats") or "").lower()
        if ats not in FETCH:
            continue
        if ats in ("greenhouse", "lever", "ashby") and not c.get("board"):
            continue
        polled += 1
        try:
            for title, loc, url, posted, body, pay in FETCH[ats](c):
                if not url:
                    continue
                hits = relevant(title, body, c.get("org_type", ""))
                if not hits or (posted and posted < cutoff):
                    continue
                postings[url] = {
                    "id": f"{ats}:{c.get('board') or c.get('host') or c['name']}:{url.rstrip('/').rsplit('/', 1)[-1]}",
                    "company": c.get("name"), "org_type": c.get("org_type"), "title": title.strip(),
                    "location": (loc or "").strip(), "url": url, "posted": posted, "pay": pay, "matched": hits[:6],
                }
        except Exception as exc:  # one broken board must not stop the run
            errors.append({"company": c.get("name"), "ats": ats, "error": f"{type(exc).__name__}: {str(exc)[:160]}"})
        time.sleep(0.5)

    items = sorted(postings.values(), key=lambda p: (p.get("posted") or "", p["company"] or ""), reverse=True)
    result = {
        "collected_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "boards_polled": polled, "postings": items[:400], "errors": errors,
    }
    print(f"polled {polled} boards: {len(items)} relevant internship postings, {len(errors)} errors")
    for e in errors:
        print(f"  ! {e['company']} ({e['ats']}): {e['error']}")
    if not args.dry_run:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
