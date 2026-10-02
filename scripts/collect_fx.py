#!/usr/bin/env python3
"""Refresh data/fx.yaml (units per 1 USD) from open.er-api.com — free, no key, no personal data."""
import datetime as dt
import pathlib
import sys

import requests
import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
FX = ROOT / "data" / "fx.yaml"


def main() -> int:
    doc = yaml.safe_load(FX.read_text(encoding="utf-8"))
    r = requests.get("https://open.er-api.com/v6/latest/USD", timeout=25)
    r.raise_for_status()
    rates = r.json()["rates"]
    for cur in list(doc["per_usd"]):
        if cur in rates:
            v = rates[cur]
            doc["per_usd"][cur] = round(v, 4) if v < 100 else round(v, 1)
    doc["date"] = dt.date.today()
    head = ("# Units of each currency per 1 USD — used only to put pay and award amounts on one axis.\n"
            "# Refreshed by scripts/collect_fx.py (open.er-api.com, no key). Approximate; never shown as a quote.\n")
    FX.write_text(head + yaml.safe_dump(doc, allow_unicode=True, sort_keys=False), encoding="utf-8")
    print(f"fx: {len(doc['per_usd'])} currencies as of {doc['date']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
