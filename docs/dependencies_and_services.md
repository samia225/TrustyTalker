# Dependencies, licences and external services

This covers SUBMISSION.txt item 8.

## The page (index.html)
- **Dependencies:** none. Plain HTML, CSS and JavaScript. No frameworks, build step, npm
  packages, CDNs or web fonts.
- **Network:** none. The Content-Security-Policy in `index.html` blocks all network calls
  (`connect-src 'none'`). Checks in the page are rule-based.
- **How to start:** double-click `index.html`. No install, account or server.

## Node scripts (tests, scoring, AI judge)
- **Runtime:** Node.js only, using its built-in modules (`node:fs`, `node:path`,
  `node:crypto`, `node:assert`) and the built-in `fetch`.
- **Packages:** none. `package.json` lists no dependencies, and there is no `npm install`.

## External service: AI judge only (optional)
- **What:** `judge/run_judge.js` (and `judge/watch_added.js` for cases added in the page)
  call the OpenAI Chat Completions API. The page itself never calls it.
- **Model:** `gpt-4o-mini-2024-07-18` for the saved runs, at temperature 0 with JSON output.
- **Approval:** approved by Tyler (MCRC) on Nov 8.
- **Key:** a separate restricted key with about $5 of prepaid credit, kept in a local
  `.env` file (gitignored) as `OPENAI_API_KEY`. No key is in the repository.
- **Data sent:** fictional conversations only. Text is anonymised first by
  `engine/anonymize.js`, and the held-out folder is never sent (`judge/test_run_judge.js`
  checks this).
- **Cost limit:** each run is capped by `JUDGE_MAX_TOTAL_TOKENS`.
- **Results:** saved in `judge_results.js` and `judge/live_outputs_*.json`. Every AI flag
  goes through `validateHint` and is an unreviewed suggestion; a reviewer decides.
- **Without it:** delete or skip the judge. The page and all rule checks work the same,
  and the page shows no judge table.

## Licences and sources
- **Repository:** all rights reserved by MCRC Health (see README). Code written during
  natHacks 2026, after the `base-code` tag.
- **Third-party code:** none is included.
- **Data:**
  - All conversations are fictional. The provided cases are development examples, not
    clinically validated references.
  - CASE-19 to 21 are MCRC's own human-written scenarios, provided by Tyler (MCRC) for this project.
  - `reference/support_choices.json` is MCRC's vocabulary.
- **Ideas and wording drawn on, not copied as text:**
  - Hawk et al. (2025), for the stigmatizing terms list.
  - The WHO digital health domains, for the adapted reviewer rating items. These are
    not a validated scale.
  - The SIM-VAIL paper (Nature Medicine, 2026), for simulated users and judge validation
    against people.
- **Clinical material:** no licensed questionnaire text or clinical evidence corpus is
  included (REFERENCE.txt).
