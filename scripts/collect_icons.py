#!/usr/bin/env python3
"""Fetch one small logo per item host → data/auto/icons/<host>.png (64×64) and data/auto/icons.json.

Incremental: hosts that already have an icon are skipped; hosts without a usable icon are retried
after 14 days. Sources, in order: Google's public favicon service (sz=64; only an HTTP 200 with an
image of at least 32 px counts), then the site's own <link rel="…icon…"> tags, then
/apple-touch-icon.png and /favicon.ico. No keys, no logins, never an email address in a request.

  python3 scripts/collect_icons.py           # fetch what is missing
  python3 scripts/collect_icons.py --retry   # also retry hosts that failed before
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import io
import json
import pathlib
import re
import sys
import urllib.parse

import requests
import yaml
from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import iconlib  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "auto" / "icons"
MANIFEST = ROOT / "data" / "auto" / "icons.json"
CATEGORIES = ("conferences", "journals", "internships", "scholarships", "programs")
UA = {"User-Agent": "academic-event-radar/1.0 (+https://github.com/jiseop-byeon/academic-event)",
      "Accept-Encoding": "gzip, deflate"}
SIZE, MIN_SRC, RETRY_DAYS = 64, 32, 14
LINK = re.compile(r"<link\b[^>]*>", re.I)


def needed_hosts() -> list[str]:
    companies = []
    for wl in sorted((ROOT / "agent").glob("watchlist*.yaml")):
        doc = yaml.safe_load(wl.read_text(encoding="utf-8")) or {}
        companies += (doc.get("companies") if isinstance(doc, dict) else doc) or []
    careers = iconlib.careers_map(companies)
    hosts = set()
    for c in companies:  # the Companies tab shows each tracked company's own mark
        h = iconlib.company_host(c.get("name", ""), c.get("careers"))
        if h:
            hosts.add(h)
    for cat in CATEGORIES:
        for f in sorted((ROOT / "data" / cat).glob("*.yaml")):
            h = iconlib.icon_host(cat, yaml.safe_load(f.read_text(encoding="utf-8")) or {}, careers)
            if h:
                hosts.add(h)
    return sorted(hosts)


def to_png(data: bytes) -> bytes | None:
    im = Image.open(io.BytesIO(data))  # ICO files open at their largest size
    if max(im.size) < MIN_SRC:
        return None
    im = im.convert("RGBA")
    im.thumbnail((SIZE, SIZE), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2), im)
    buf = io.BytesIO()
    canvas.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def site_candidates(h: str) -> list[str]:
    out = []
    try:
        r = requests.get(f"https://{h}/", headers=UA, timeout=12)
        html, base = r.text[:300000], r.url
        found = []
        for tag in LINK.findall(html):
            rel = re.search(r"""rel=["']([^"']+)["']""", tag, re.I)
            href = re.search(r"""href=["']([^"']+)["']""", tag, re.I)
            if not rel or not href or "icon" not in rel.group(1).lower():
                continue
            size = re.search(r"""sizes=["'](\d+)x\d+""", tag, re.I)
            s = int(size.group(1)) if size else (180 if "apple" in rel.group(1).lower() else 32)
            found.append((s, urllib.parse.urljoin(base, href.group(1))))
        out = [u for _, u in sorted(found, reverse=True)]
    except requests.RequestException:
        pass
    return out + [f"https://{h}/apple-touch-icon.png", f"https://{h}/favicon.ico"]


def fetch(h: str) -> tuple[str, bytes | None, str | None]:
    try:
        r = requests.get("https://www.google.com/s2/favicons", params={"domain": h, "sz": SIZE}, headers=UA, timeout=12)
        if r.status_code == 200:
            png = to_png(r.content)
            if png:
                return h, png, "google-s2"
    except Exception:
        pass
    for u in site_candidates(h)[:6]:
        if u.lower().split("?")[0].endswith(".svg"):
            continue
        try:
            r = requests.get(u, headers=UA, timeout=12)
            if r.status_code == 200 and r.content:
                png = to_png(r.content)
                if png:
                    return h, png, "site"
        except Exception:
            continue
    return h, None, None


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--retry", action="store_true", help="retry hosts that had no usable icon")
    args = ap.parse_args(argv)
    OUT.mkdir(parents=True, exist_ok=True)
    try:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        manifest = {}
    today = dt.date.today()
    needed = needed_hosts()
    for h in [h for h in manifest if h not in needed]:  # an item changed its host or was removed
        f = manifest.pop(h).get("file")
        if f and (OUT / f).exists() and not any(m.get("file") == f for m in manifest.values()):
            (OUT / f).unlink()
    todo = []
    for h in needed:
        m = manifest.get(h)
        if m and m.get("file") and (OUT / m["file"]).exists():
            continue
        if m and not m.get("file") and not args.retry:
            tried = dt.date.fromisoformat(m.get("checked", "1970-01-01"))
            if (today - tried).days < RETRY_DAYS:
                continue
        todo.append(h)
    got = 0
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        for h, png, src in pool.map(fetch, todo):
            if png:
                name = h + ".png"
                (OUT / name).write_bytes(png)
                manifest[h] = {"file": name, "source": src, "checked": today.isoformat()}
                got += 1
            else:
                manifest[h] = {"file": None, "checked": today.isoformat()}
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), indent=1) + "\n", encoding="utf-8")
    have = sum(1 for m in manifest.values() if m.get("file"))
    print(f"icons: fetched {got} of {len(todo)} new hosts; {have} hosts have an icon")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
