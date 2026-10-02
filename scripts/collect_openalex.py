#!/usr/bin/env python3
"""Refresh open citation stats for journals that carry `openalex_id` → data/auto/openalex.json.

OpenAlex is free and needs no key. Never add a `mailto` parameter or any email address.
The site shows `two_year_mean_citedness` (an open analogue of the impact factor) next to the JIF.
"""
import datetime as dt
import json
import pathlib
import sys
import time

import requests
import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "auto" / "openalex.json"
UA = {"User-Agent": "academic-event-radar/1.0 (+https://github.com/jiseop-byeon/academic-event)"}


def main() -> int:
    ids = []
    for f in sorted((ROOT / "data" / "journals").glob("*.yaml")):
        d = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
        if d.get("openalex_id"):
            ids.append(str(d["openalex_id"]).rsplit("/", 1)[-1])
    out, errors = {}, []
    for sid in ids:
        try:
            r = requests.get(f"https://api.openalex.org/sources/{sid}", headers=UA, timeout=25)
            r.raise_for_status()
            j = r.json()
            s = j.get("summary_stats") or {}
            out[sid] = {
                "display_name": j.get("display_name"),
                "two_year_mean_citedness": s.get("2yr_mean_citedness"),
                "h_index": s.get("h_index"),
                "works_count": j.get("works_count"),
                "cited_by_count": j.get("cited_by_count"),
            }
        except Exception as exc:
            errors.append({"id": sid, "error": f"{type(exc).__name__}: {str(exc)[:120]}"})
        time.sleep(0.3)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"collected_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                               "sources": out, "errors": errors}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"openalex: {len(out)} sources refreshed, {len(errors)} errors")
    return 0


if __name__ == "__main__":
    sys.exit(main())
