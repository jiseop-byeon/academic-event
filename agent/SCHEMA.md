# Data schema

One YAML file per item: `data/<category>/<id>.yaml`, where `<id>` is the file name
(lowercase ASCII, words joined by `-`). `python3 scripts/validate.py` checks every rule below.

Scope (owner's decision, 2026-10-02)

- **Only prestigious venues and Q1 journals** — the ones every graduate student in the field knows.
  No regional, second-tier or predatory venues. A journal must be Q1: JCR quartile from an official
  page, or else the Scopus CiteScore quartile (record it as `metrics.citescore.quartile` with its
  `category`). Fields covered: construction & civil (incl. transportation), robotics, physical AI,
  manipulation, navigation/SLAM/sensor fusion, computer vision, AR/XR, HRI and human intent, haptics, ML,
  explainable AI (XAI) and interpretability.
- **Scholarships**: only ones a Korean national enrolled as an international *graduate* student at
  a US university can apply for — civil, engineering or computer science (transportation included).
  Leave out US-citizen-only, undergraduate-only and pre-enrollment-only programs.
- **Internships**: MS/PhD level, open to international students (no US-citizen / US-person
  requirement), in the fields above.

Language: **English is the site's main language; Korean is the second.** Every Korean free-text
field has an English twin with the suffix `_en`: `take_en`, `orientation.summary_en`,
`editions[].notes_en`, `review.speed_note_en`, `conference_link_en`, `eligibility_note_en`,
scholarship `amount.summary_en`, `duration_en`, `eligibility.where_enrolled_en`,
`eligibility.stage_en`, `eligibility.notes_en`, `requirements_en`, `cycle.typical_en`, and a
deadline's `label_en` when its `label` is Korean. Watchlist entries get `note_en`.

General rules

- Dates are `YYYY-MM-DD`. A month-only date (internship `start`) is the string `"YYYY-MM"`.
- Double-quote every free-text string.
- `fields:` uses the keys in `data/fields.yaml`: construction, transportation, robotics,
  physical-ai, manipulation, navigation, vision, ar, hri (incl. human intent), haptics, ml, xai
  (explainable AI / interpretability) (scholarships may use `any`).
- `country:` is an ISO 3166-1 alpha-2 code (`US`, `KR`, `AT`, `JP`, `DE`, …).
- `lat`/`lon`: city centre, two decimals.
- Omit a key you could not verify. Never write placeholders such as `"N/A"`, `"TBD"` or `null`.
- `estimated: true` on any date (or `status: estimated` on an edition) that you inferred from the
  historical pattern instead of reading it on an official page.
- `summary`, `take`, `notes`: Korean (technical terms may stay English). Names, titles, skills: English.
- `sources`: the URLs the facts came from, official pages first.
- `last_verified`: the date you checked the item.

Shared judgment scales (the editor's opinion; keep them consistent across items)

- `tier` — standing **within its own community**: `1` flagship (ICRA, CVPR, NeurIPS, T-RO, IJRR,
  Automation in Construction, ISARC for construction automation) · `2` strong, major
  (Humanoids, CASE, WACV, RA-L, JFR, ASCE JCCE, EG-ICE) · `3` specialized or regional
  (UR, ICCAS, CONVR).
- `orientation.contribution` — what counts as a publishable contribution, −2…+2:
  `-2` theory/algorithm first; a system without a new method rarely gets in (ICML, ICLR, WAFR) ·
  `-1` new method first, strong experiments expected (CVPR, CoRL, RSS, T-RO) ·
  `0` both a new method and a strong system are accepted (ICRA, IROS, RA-L) ·
  `+1` system integration and real-world validation valued; modest algorithmic novelty is fine
  (CASE, JFR, ISER) · `+2` an application, case study or deployed system is enough (ISARC, ASCE CRC).
- `community` — the primary audience: `ml`, `vision`, `robotics`, `hri` (also haptics), `xr`
  (AR/VR/HCI), `transportation`, `construction`.
- `fit` — relevance to the site owner, 1…3. The owner is a Korean PhD student in civil/construction
  engineering at a US university (UT Austin, PhD year 1), working on construction physical AI:
  contact-rich manipulation in construction (core), navigation and HRI (support), with perception.
  `3` a direct target · `2` relevant, occasionally a fit · `1` adjacent; listed for reference.
- `take` — one Korean sentence: should the owner aim at it, and why.

---

Every example below is taken from (or shaped like) a real file in `data/`; when in doubt, read the
file itself rather than copying a value from here.

## Conference — `data/conferences/<series-id>.yaml`

One file per series (`icra.yaml`). `editions` holds the next upcoming edition (conference dates in
the future). If that edition's paper deadline has already passed, add the following edition too,
with whatever is known (`status: estimated` and `estimated: true` deadlines from the usual pattern).

```yaml
id: icra
acronym: "ICRA"
name: "IEEE International Conference on Robotics and Automation"
organizer: "IEEE Robotics and Automation Society (RAS)"
fields: [robotics, manipulation, navigation, physical-ai]
community: robotics
tier: 1
rankings:                      # each key optional
  core: "A*"                   # CORE / ICORE conference rank
  h5_index: 135                # Google Scholar Metrics h5-index
  h5_year: 2025
frequency: annual              # annual | biennial | irregular
paper_format: "6 pages + up to 2 pages of references, IEEE two-column"
review:
  blind: double                # double | single | open
  rebuttal: false              # true | false
  acceptance_rate: {value: 0.39, year: 2025, note: "1,606 of 4,255 submissions"}
proceedings: "IEEE Xplore"
journal_track: "RA-L papers can be presented at ICRA"     # optional
attendance: "~7,000"           # optional
orientation:
  contribution: 0
  summary: "한국어 2–3문장: 무엇을 높이 사는지, 전형적인 논문, 심사에서 흔한 지적."
  values: ["real-robot experiments", "broad scope"]       # 2–5 short English tags
fit: 3
take: "한국어 한 문장."
editions:
  - year: 2027
    status: confirmed          # confirmed (official site) | announced (place/date only) | estimated
    start: 2027-05-24
    end: 2027-05-28
    city: "Seoul"
    country: KR
    venue: "COEX"                      # optional
    lat: 37.57
    lon: 126.98
    url: "https://2027.ieee-icra.org/"
    deadlines:
      - {kind: paper, date: 2026-09-16, tz: "PT", time: "23:59"}
      - {kind: notification, date: 2027-01-31}
  - year: 2028
    status: announced
    start: 2028-05-15
    end: 2028-05-19
    city: "Rio de Janeiro"
    country: BR
    lat: -22.91
    lon: -43.17
    deadlines:
      - {kind: paper, date: 2027-09-15, tz: "PT", estimated: true}
    notes: "optional Korean note"
links:
  home: "https://..."
  cfp: "https://..."
sources: ["https://..."]
last_verified: 2026-10-02
```

Deadline `kind`: `abstract`, `paper`, `supplementary`, `rebuttal`, `notification`,
`camera-ready`, `workshop-proposal`, `late-breaking`, `registration`, `other` (with `label:`).
Optional per deadline: `tz` (`AoE`, `UTC`, `PT`, `ET`, `CT`, `CET`, `KST`, `JST`, …), `time` ("23:59"),
`label`, `estimated`.

## Journal — `data/journals/<id>.yaml`

```yaml
id: t-ro
abbr: "T-RO"
name: "IEEE Transactions on Robotics"
publisher: "IEEE"
issn: "1552-3098"
eissn: "1941-0468"
fields: [robotics, manipulation, navigation]
community: robotics
tier: 1
metrics:                        # each key optional; year = the data year (JCR 2025 release → 2024)
  jif: {value: 10.5, year: 2024}
  jif_5y: {value: 11.2, year: 2024}
  jcr_quartile: {value: Q1, category: "Robotics", year: 2024}
  citescore: {value: 17.6, year: 2024, quartile: Q1, category: "Control and Systems Engineering", rank: "5/390"}
  sjr: {value: 3.1, quartile: Q1, category: "Computer Science Applications", year: 2024}
  h_index: 234                  # SCImago h-index
  h5_index: {value: 120, year: 2025}            # Google Scholar Metrics (useful where there is no JIF)
  papers_published: {value: 1395, year: 2025}   # only for journals with no other metric
review:
  blind: double                 # double | single | open
  first_decision_days: 90       # typical days to first decision, if the journal publishes it
  acceptance_rate: 0.20         # if published
  speed_note: "한국어: 심사 속도에 대한 메모"
access: hybrid                  # subscription | hybrid | open-access
apc_usd: 2495                   # open-access charge in USD, if any
length: "Regular paper: 12 pages, up to 20 with overlength charges"
article_types: ["regular", "short", "survey"]
conference_link: "한국어: 연계 학회 (예: RA-L 논문은 ICRA/IROS에서 발표 가능)"
orientation:
  contribution: -1
  summary: "한국어 2–3문장"
  values: ["theoretical depth", "extensive experiments"]
fit: 3
take: "한국어 한 문장."
openalex_id: "S2764453849"      # optional: OpenAlex source id, used for auto-refreshed citation stats
links:
  home: "https://..."
  submit: "https://..."
  guide: "https://..."
sources: ["https://..."]
last_verified: 2026-10-02
```

## Internship — `data/internships/<id>.yaml`

One file per posting (or per company program when a single posting covers several teams).
Id: `<company>-<short-title>-<season-year>`.

```yaml
id: nvidia-research-intern-robotics-seattle-2027
company: "NVIDIA"
org_type: bigtech      # bigtech | robotics | construction-robotics | construction-tech | construction | autonomy | lab
team: "NVIDIA Research — Seattle Robotics Lab"
title: "PhD Research Intern, Robotics - Summer 2027"
fields: [manipulation, physical-ai, robotics]
degree: [phd]                   # phd | ms | bs
season: "Summer 2027"
start: "2027-05"                # "YYYY-MM" or "flexible"
duration: "12 weeks minimum"
duration_weeks: [12, 24]        # [min, max]
locations:
  - {city: "Seattle", region: "WA", country: US, lat: 47.61, lon: -122.33}
work_mode: onsite               # onsite | hybrid | remote | unknown
pay:
  min: 38
  max: 94
  currency: USD
  unit: hour                    # hour | week | month | year
  source: posting               # posting | levels.fyi | glassdoor | estimate
  note: "posted US base range"
required: ["Enrolled in a PhD in CS, EE, ME or related", "Python", "PyTorch"]
preferred: ["First-author papers at CoRL, RSS or ICRA"]
skills: ["python", "pytorch", "reinforcement-learning", "imitation-learning", "isaac-sim"]
responsibilities: ["one line each, 1–3 lines"]
citizenship: none               # none | us-person | us-citizen | local-work-permit | unknown
eligibility_note: "한국어: 유학생 지원 가능 여부 등"
status: open                    # open | upcoming | rolling | closed
posted: 2026-09-30
deadline: 2026-11-30            # only if the posting states one
apply_url: "https://..."
fit: 3
take: "한국어 한 문장."
sources: ["https://..."]
last_verified: 2026-10-02
```

`skills` are lowercase tags with `-` (`python`, `cpp`, `pytorch`, `jax`, `ros`, `ros2`, `isaac-sim`,
`mujoco`, `reinforcement-learning`, `imitation-learning`, `vla`, `diffusion-policy`, `slam`,
`3d-vision`, `computer-vision`, `motion-planning`, `control`, `force-control`, `tactile-sensing`,
`state-estimation`, `sensor-fusion`, `lidar`, `simulation`, `bim`, `point-cloud`,
`hardware`, `embedded`, `llm`, `foundation-models`, …). Reuse an existing tag before inventing one.

## Scholarship — `data/scholarships/<id>.yaml`

```yaml
id: google-phd-fellowship
name: "Google PhD Fellowship Program (United States & Canada)"
organizer: "Google Research"
org_type: industry            # korean-foundation | korean-government | industry | us-government | society | university | other
type: fellowship              # fellowship | scholarship | travel-grant | research-grant | award
fields: [ml, vision]          # or [any]
amount:
  summary: "연 $85,000 (학비·수수료, 생활비, 출장, 장비), 최대 2년"
  value: 85000                # number in `currency` per `unit`, for charts (best documented figure)
  max: 85000                  # optional upper bound
  currency: USD
  unit: year                  # year | month | total | one-time
  covers: ["tuition", "fees", "stipend", "travel"]
  estimated: false
duration: "최대 2년"
eligibility:
  nationality: ["any"]        # ISO codes, or ["any"]
  where_enrolled: "한국어: 재학/입학 조건"
  stage: "한국어: 학위 단계 조건"
  korean_ok: true
  international_in_us_ok: true   # can a non-US citizen enrolled at a US university apply?
  us_citizen_only: false
  notes: "한국어 메모"
requirements: ["CV", "연구 제안서 (최대 3쪽)", "추천서"]
nomination: true              # true if the university must nominate
awards_per_year: "약 40명"
cycle:
  typical: "매년 3–5월 대학 추천 접수"
  deadlines:
    - {kind: internal, date: 2027-02-15, label: "대학 내부 추천 마감", estimated: true}
    - {kind: application, date: 2027-04-30, estimated: true}
    - {kind: result, date: 2027-08-31, estimated: true}
status: upcoming              # open | upcoming | closed | rolling
apply_url: "https://..."
fit: 3
take: "한국어 한 문장."
links:
  home: "https://..."
sources: ["https://..."]
last_verified: 2026-10-02
```

Scholarship deadline `kind`: `application`, `internal` (university nomination), `recommendation`,
`interview`, `result`, `other` (with `label:`).

## Program / activity — `data/programs/<id>.yaml`

Things a graduate student can *join* rather than apply to as a job or award: campus research
communities and seminar series, student organizations, certificate (portfolio) programs, doctoral
consortia, summer schools, competitions, society student programs, entrepreneurship programs,
volunteer roles. One file per program.

```yaml
id: texas-robotics
name: "Texas Robotics"
organizer: "The University of Texas at Austin"
scope: ut-austin              # ut-austin | us | international | online
kind: research-community      # research-community | seminar | student-org | certificate | doctoral-consortium |
                              # summer-school | competition | society | entrepreneurship | volunteer | mentoring
audience: [phd, ms]           # phd | ms | bs — who can take part
fields: [robotics, physical-ai, hri]
summary: "한국어 2–3문장: 무엇인가"
summary_en: "English twin"
activities: ["한국어: 할 수 있는 일, 1–4개"]
activities_en: ["English twin"]
benefits: ["한국어: 얻는 것 (네트워킹, 연구 협업, 자금, 이력)"]
benefits_en: ["English twin"]
commitment: "한국어: 시간·빈도 (예: 매주 금요일 세미나, 1주 집중)"
commitment_en: "English twin"
cost: {value: 0, currency: USD, note: "free for UT students"}    # optional
location: {city: "Austin", region: "TX", country: US, lat: 30.28, lon: -97.74}   # omit for online
eligibility:
  international_ok: true      # can an international graduate student at a US university join?
  ut_only: true               # limited to UT Austin students?
  notes: "한국어"
  notes_en: "English twin"
cycle:
  typical: "한국어: 보통 언제 (예: 매 학기 초 모집)"
  typical_en: "English twin"
  deadlines:
    - {kind: application, date: 2026-11-15, label: "...", label_en: "...", estimated: true}
    - {kind: event, date: 2027-04-10, label_en: "Texas Robotics Symposium"}
status: ongoing               # open | upcoming | rolling | ongoing | closed
apply_url: "https://..."      # where to join / apply
fit: 3
take: "한국어 한 문장"
take_en: "English twin"
links: {home: "https://..."}
sources: ["https://..."]
last_verified: 2026-10-02
```

Program deadline `kind`: `application`, `registration`, `nomination`, `event`, `other` (with `label`).
