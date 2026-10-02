---
name: update-radar
description: Run the Academic Event Radar update agent — re-verify and refresh conferences, journals, internships and scholarships in data/ by following agent/AGENT.md, then validate, build, commit and push. Use when asked to update, refresh or check the radar's data.
---

Read `agent/AGENT.md` and follow its procedure exactly, using `agent/SCHEMA.md` as the data
contract. Start with `python3 scripts/report.py` for the worklist. The privacy rules in AGENT.md
are hard rules: no email address in any web request, no logins or form submissions, nothing about
the owner's visa or career plans in any file.
