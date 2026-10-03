"""Which web host stands for an item's logo. Shared by collect_icons.py and build.py.

Conferences use their series site, journals their publisher, internships the company's own site
(never the job board), scholarships and programs the organizer's site.
"""
from __future__ import annotations

import urllib.parse

# Hosts that never identify the item itself: job boards, aggregators, archives, forms.
SKIP = (
    "greenhouse.io", "lever.co", "ashbyhq.com", "myworkdayjobs.com", "workday.com", "smartrecruiters.com",
    "icims.com", "jobvite.com", "bamboohr.com", "rippling.com", "gem.com", "eightfold.ai", "linkedin.com",
    "levels.fyi", "glassdoor.com", "simplify.jobs", "builtin.com", "wellfound.com", "indeed.com",
    "web.archive.org", "letpub.com.cn", "bioxbio.com", "scholar.google.com", "openalex.org", "dblp.org",
    "wikicfp.com", "github.com", "qualtrics.com", "docs.google.com", "forms.gle", "nsf.gov", "myhuiban.com",
)
# A publisher's journal platform → the host whose icon is the publisher's mark.
ALIAS = {
    "ieeexplore.ieee.org": "ieee.org", "journals.sagepub.com": "sagepub.com", "link.springer.com": "springer.com",
    "onlinelibrary.wiley.com": "wiley.com", "dl.acm.org": "acm.org", "pubsonline.informs.org": "informs.org",
    "ascelibrary.org": "asce.org", "www.sciencedirect.com": "sciencedirect.com",
    # sub-sites whose own favicon is missing or tiny → the parent organization's mark
    "research.google": "google.com", "cvpr.thecvf.com": "thecvf.com", "iccv.thecvf.com": "thecvf.com",
    "eccv.ecva.net": "ecva.net", "ukc.ksea.org": "ksea.org", "groups.oist.jp": "oist.jp", "new.chisv.org": "chi.acm.org",
}


# Companies whose only links are job boards: their own site, for the logo (keys = company_key()).
COMPANY_DOMAIN = {
    "nvidia": "nvidia.com", "apptronik": "apptronik.com", "caterpillar": "caterpillar.com", "general motors": "gm.com",
    "kodiak robotics": "kodiak.ai", "physical intelligence": "physicalintelligence.company", "anybotics": "anybotics.com",
    "argonne national laboratory": "anl.gov", "autodesk": "autodesk.com", "bosch research": "bosch.com",
    "built robotics": "builtrobotics.com", "canvas": "canvas.build", "collaborative robotics": "co.bot",
    "dexterity": "dexterity.ai", "diligent robotics": "diligentrobotics.com", "disney research": "disneyresearch.com",
    "doosan bobcat": "bobcat.com", "doosan robotics": "doosanrobotics.com", "doxel": "doxel.ai",
    "gravis robotics": "gravisrobotics.com", "hyundai motor group": "hyundaimotorgroup.com", "intel labs": "intel.com",
    "kict 한국건설기술연구원": "kict.re.kr", "kist 한국과학기술연구원": "kist.re.kr", "kajima": "kajima.co.jp",
    "komatsu": "komatsu.com", "matic": "maticrobots.com", "may mobility": "maymobility.com", "miovision": "miovision.com",
    "monumental": "monumental.co", "motional": "motional.com", "nuro": "nuro.ai", "obayashi": "obayashi.co.jp",
    "openai": "openai.com", "promise robotics": "promiserobotics.com", "reframe systems": "reframe.systems",
    "rugged robotics": "ruggedrobotics.com", "seoul robotics": "seoulrobotics.org", "shimizu": "shimz.co.jp",
    "sony ai": "ai.sony", "teleo": "teleo.ai", "woven by toyota": "woven.toyota", "zoox": "zoox.com",
}


def host(url: str | None) -> str:
    h = urllib.parse.urlparse(url or "").netloc.lower().split(":")[0]
    return h[4:] if h.startswith("www.") else h


def usable(h: str) -> bool:
    return bool(h) and "." in h and not any(h == s or h.endswith("." + s) for s in SKIP)


def company_key(name: str) -> str:
    return (name or "").split(" (")[0].split(" / ")[0].strip().lower()


def careers_map(companies: list[dict]) -> dict[str, str]:
    """company name (lower, before any parenthesis) → its careers URL from the watchlists."""
    out = {}
    for c in companies:
        if c.get("careers"):
            out.setdefault(company_key(c.get("name", "")), c["careers"])
    return out


def company_host(name: str, careers_url: str | None = None) -> str | None:
    known = COMPANY_DOMAIN.get(company_key(name))
    if known:
        return known
    h = host(careers_url)
    return ALIAS.get(h, h) if usable(h) else None


def icon_host(cat: str, item: dict, careers: dict[str, str] | None = None) -> str | None:
    links = item.get("links") or {}
    cands: list[str | None] = []
    if cat == "conferences":
        cands.append(links.get("home"))
        cands += [e.get("url") for e in item.get("editions") or []]
    elif cat == "journals":
        cands.append(links.get("home"))
    elif cat == "internships":
        known = COMPANY_DOMAIN.get(company_key(item.get("company", "")))
        if known:
            return known
        if careers:
            cands.append(careers.get(company_key(item.get("company", ""))))
        cands += [item.get("apply_url")] + list(item.get("sources") or [])
    else:
        cands += [item.get("apply_url"), links.get("home")] + list(item.get("sources") or [])
    for u in cands:
        h = host(u)
        if usable(h):
            return ALIAS.get(h, ALIAS.get("www." + h, h))
    return None
