# Academic Event Radar

**https://jiseop-byeon.github.io/academic-event/**

Conferences, journals, internships and scholarships for construction physical AI — contact-rich
manipulation in construction, with robotics, navigation, HRI, computer vision and robot learning
around it. Agents find and verify the information; this repository holds it as data and publishes
it as a static site with a subscribable deadline calendar.

| Category | What each item records |
|---|---|
| 학회 Conferences | next edition (dates, city, country, venue), every deadline, acceptance rate, review process, h5-index, what the venue rewards (algorithm ↔ system), fit |
| 저널 Journals | JIF and 5-year JIF, JCR/SJR quartile, CiteScore, days to first decision, access and APC, orientation, fit |
| 인턴십 Internships | position, team, required/preferred knowledge, skill tags, pay (posted range, normalized to USD/month), season, duration, locations, citizenship requirement, status |
| 장학금 Scholarships | amount (normalized to USD/year), coverage, eligibility (Korean nationals, non-citizens at US universities, stage), documents, nomination, deadlines (incl. internal ones), organizer |

The site adds a dashboard (upcoming deadlines, 12-month deadline map, picks), a conference
timeline, a host-city world map, an orientation map, a submission planner, an internship pay
chart and skill-demand chart, a scholarship eligibility matrix, and a calendar with `.ics` feeds
(`deadlines.ics`, `all-events.ics`).

## How it stays current

```
official pages, job-board APIs, foundations
        │
        ├── daily · GitHub Actions ── scripts/collect_jobs.py      → data/auto/jobs.json
        │                             scripts/collect_fx.py        → data/fx.yaml
        │                             scripts/collect_openalex.py  → data/auto/openalex.json
        │
        └── weekly · update agent ─── agent/AGENT.md: scripts/report.py worklist → verify → edit data/*.yaml
                                        │
                        scripts/validate.py → scripts/build.py → GitHub Pages
```

- **Collectors** need no keys and send no personal data. Job boards to poll are listed in
  `agent/watchlist-*.yaml` (Greenhouse, Lever, Ashby, Workday, Amazon).
- **The update agent** is Claude following `agent/AGENT.md`; it can run as a scheduled cloud
  routine or locally with the project skill: open Claude Code in this folder and run
  `/update-radar`.
- `python3 scripts/report.py` prints what needs attention: stale items, estimated dates that are
  getting close, passed deadlines, newly collected postings.

## Data

One YAML file per item in `data/conferences/`, `data/journals/`, `data/internships/`,
`data/scholarships/`. The contract — every key, enum and judgment scale — is
[`agent/SCHEMA.md`](agent/SCHEMA.md). Dates inferred from past cycles carry `estimated: true` and
show on the site with ≈ and a dashed outline.

## Local

```bash
pip install pyyaml requests
python3 scripts/validate.py
python3 scripts/build.py
python3 -m http.server 8765 --directory _site
```

`scripts/make_world.py` regenerated `site/assets/world.js` from Natural Earth 1:110m (public
domain); it never needs to run again unless the map changes.

Always confirm dates and conditions on the official page before applying or submitting.
