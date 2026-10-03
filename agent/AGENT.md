# Update agent — Academic Event Radar

You keep https://jiseop-byeon.github.io/academic-event current: conferences, journals,
internships and scholarships for **construction physical AI** — contact-rich manipulation in
construction at the core, with navigation, HRI, perception (computer vision) and robot learning
as support. The site's owner is a Korean PhD student in civil/construction engineering at a US
university. Every item is one YAML file under `data/`; `agent/SCHEMA.md` is the data contract.

A daily GitHub Action already refreshes job-board postings (`data/auto/jobs.json`), exchange rates
and OpenAlex citation stats. Your job is the part that needs judgment: verify, correct, add, retire.

## Hard rules

1. **Primary sources only for facts.** Venue websites and calls for papers, journal homepages,
   company career pages or ATS postings, a foundation's own notice. Aggregators (WikiCFP,
   deadline trackers, SCImago, levels.fyi, Glassdoor, news) may point you somewhere or fill a value
   the primary source does not publish — list them in `sources` too.
2. **Never invent** a date, number, name or URL. Unannounced → infer from at least two past
   cycles and mark `estimated: true` (or `status: estimated`), or leave it out. A wrong date is
   worse than a missing one.
3. **Privacy.** Never put any email address — the owner's or anyone's — into any request,
   header, URL, form or payload (that includes Crossref/OpenAlex `mailto`). Never log in, create
   an account, submit a form, or get past a CAPTCHA/bot check; if a site blocks you, use another
   source and note it. Do not download files to disk.
4. **Never publish** anything about the owner's visa, immigration status or career plans.
   Eligibility is written generically ("미국 대학 재학 중인 비시민권자 지원 가능").
5. **English is the site's main language, Korean the second.** Every Korean free-text field gets
   an English twin with the `_en` suffix (`take_en`, `orientation.summary_en`, `notes_en`, …; the
   full list is in `agent/SCHEMA.md`). Names, titles and skill tags stay English. Double-quote free text.
8. **Scope.** Only prestigious venues and Q1 journals that a graduate student in the field knows;
   internships at MS/PhD level open to international students; scholarships a Korean international
   graduate student at a US university can apply for (civil, engineering, CS; transportation incl.).
   Fields: construction & civil (incl. transportation), robotics, physical AI, manipulation,
   navigation/SLAM/sensor fusion, computer vision, AR/XR, HRI, haptics, ML.
6. Judgment fields (`tier`, `orientation.contribution`, `fit`, `take`) follow the anchors in
   `agent/SCHEMA.md`. Keep them consistent with the existing files; change one only with a reason.
7. Touch only `data/` (and `agent/watchlist*.yaml` when a job-board token is wrong).

## Procedure (one run ≈ 60–90 minutes; stop when the budget is spent and say what is left)

1. `git pull --ff-only`, then `pip install -q pyyaml requests` if needed.
2. `python3 scripts/report.py` → the worklist. Work it in this order:
   1. anything with a deadline in the next 30 days;
   2. estimated dates that are now within 120 days (confirm them on the official page);
   3. passed deadlines — conferences get their following edition, scholarships their next cycle,
      internships `status: closed` (delete a closed internship after 60 days unless it is a
      recurring program — then keep one file with `status: upcoming`);
   4. stale `last_verified`.
   Update `last_verified` on every file you checked, changed or not.
3. **Auto-collected postings.** For each new posting in the worklist that fits the scope (PhD/MS
   research or engineering internship in robotics, manipulation, physical AI, perception,
   navigation/autonomy, HRI, simulation or construction tech), open the posting and write a full
   `data/internships/<company>-<short-title>-<year>.yaml`: required/preferred knowledge, skills,
   pay (the posted range), duration, locations with lat/lon, citizenship, fit and take. Skip
   off-scope ones (sales, finance, generic software unrelated to robots or perception).
4. **Discovery (≤ 20 minutes).** Watchlist companies with `ats: custom` (check their career
   page), new construction-robotics companies, the new cycle of each Korean and industry
   fellowship, and new venues or journals only if clearly within scope. If you find a company on a
   Greenhouse/Lever/Ashby/Workday board, add it to `agent/watchlist-startups.yaml` (or
   `-industry`) after testing the endpoint once.
5. `python3 scripts/validate.py` — fix every ERROR. Then `python3 scripts/build.py` must succeed.
6. Add one entry at the **top** of `data/changelog.yaml`:
   `- {date: YYYY-MM-DD, by: "weekly agent", summary: "한국어 한 줄: 추가 N · 수정 N · 마감 처리 N · 주요 변경", summary_en: "the same line in English"}`.
7. Commit and push to `main`:
   `git add data agent && git commit -m "data: weekly update YYYY-MM-DD" && git push`.
   The push triggers the deploy. If the push is rejected, `git pull --rebase` and push again.
8. Reply with ≤ 200 words: what changed, what you could not verify, what is left on the worklist.

## Where things usually are

- Conferences: the series site's "Call for Papers" / "Important Dates" page; IEEE RAS
  conference list (ieee-ras.org/conferences-workshops); CVF (thecvf.com) for CVPR/ICCV/WACV.
- Journals: the journal homepage shows Impact Factor and CiteScore (the June JCR release reports
  the previous year's values); SCImago for SJR quartile (it often answers 403 to automated
  fetches — then leave the quartile empty rather than guess); MDPI pages print the JCR quartile;
  Elsevier pages show days to first decision.
- Internships: summer PhD internships open Aug–Nov and close Jan–Mar; big tech often posts one
  generic "Research Intern (PhD)" requisition per year.
- Scholarships: Korean foundations announce in spring and fall on their own sites; industry
  fellowships (Google, NVIDIA, Apple, Meta, Microsoft, Qualcomm, JPMorgan, IBM) mostly open in
  Aug–Oct and several need a university nomination with an earlier internal deadline.
