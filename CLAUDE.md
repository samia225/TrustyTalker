# TrustyTalker: instructions for Claude Code

Full team plan: @PLAN.md

## What this is
An internal evaluation tool for MCRC Health's JARA, a non-diagnostic, non-prescriptive AI support and resource-navigation chatbot for adults with substance-use and mental health concerns. TrustyTalker reads FICTIONAL multi-turn conversations, tracks what the person has said (goal, readiness to change, preferences, declined items) and flags JARA replies that do not fit what the person asked for. Users are JARA's developers and researchers, not people seeking support.

Built on MCRC's starter kit (git tag `base-code`, prepared Nov 4 2026). Before changing anything, read START_HERE.txt, TASKS.txt, REFERENCE.txt (data and finding contract) and SUBMISSION.txt.

## Hard constraints (never break)
- Plain JavaScript, HTML and CSS only. No frameworks, build steps, npm packages or CDNs. (JS vs TypeScript is pending Vatsal; do not convert unless told.)
- The page must open by double-clicking index.html: no installs, accounts or server.
- Do not rename any starter file. New files are fine.
- The Content-Security-Policy in index.html blocks inline `<script>`, `onclick=` attributes, inline `style=` and `<style>`, and all network calls. Code goes in .js files, styling in styles.css; change appearance by toggling CSS classes.
- The PAGE has no fetch, no AI or LLM calls and no network access. Checks in the page are rule-based.
- AI is only allowed in the separate Node script in `judge/` (pending Vatsal's approval). Never wire network or AI calls into the page.
- No model training, fine-tuning or RL anywhere.
- Fictional data only. Never add real patient conversations or personal information. The provided cases are development examples, not clinically validated references.
- Script load order in index.html matters: data.js, extra case files, state_tracker.js, student_checks.js and other check files, UI files, app.js last. A wrong order causes a blank page or "is not defined" errors.
- Never produce clinical scoring, diagnoses or clinical recommendations.

## How checks work (from TASKS.txt)
- Loop over `variant.turns` with a for loop. Skip any turn whose role is not assistant.
- Read `scenario.goal` (and the tracked state) to decide what fits.
- Create every result with `makeHint(checkName, turn, explanation)`, e.g. `makeHint("goal_alignment", turn, "...")`. Copy the pattern in `checkRepeatedReply`.
- Always return a list, even when empty.
- Never hardcode a case ID or a turn ID.
- When a check works, set its `implemented` flag to true in `checks`. Unfinished checks must stay visibly unevaluated.
- Preserve the person's ability to be unsure: uncertain matches go to "needs review", not flagged or passed.
- Goal alignment reference case: CASE-01. Goal is information. Example B pressures the person to quit and must be flagged. Example A says "I will not ask you to quit" and must NOT be flagged. A keyword-only rule will miss this; that limitation goes in the submission.
- Source support reference case: CASE-05. Compare each `turn.claims` item with the source matching its `source_id`. Claims are supplied data; do not build a natural-language claim extractor. Flag missing or conflicting facts with evidence. This checks mock record consistency, not clinical or medical truth.
- Repetition reference case: CASE-04 (Example B gives one exact-repetition hint). Keep it working.

## Test scenarios and verification
- MCRC gave us test scenarios from its research tool. Do not commit them until Tyler confirms they are fictional and allowed in the repo. Never use any that come from real participants.
- Convert them once into the starter's case format (same shape as data.js), with unique IDs.
- Every test case has expected labels written BEFORE running the checks: which assistant turns should be flagged, by which check, and with what severity. Store them in `tests/expected.js`.
- Include near-miss cases for every check: a similar reply that is fine and must NOT be flagged (like CASE-01 Example A).
- Held-out cases live in `tests/heldout/`. Do not open, read or tune rules against them. They are only run for final scoring.
- Verification output per check: caught (true positives), missed (false negatives), wrongly flagged (false positives), plus precision and recall. Show "not evaluated" for unfinished checks.
- No ML or RL training this weekend: there is no clinician-labelled data and TASKS.txt rules out training. Do not add model training, fine-tuning or learned weights.
- AI-drafted test conversations are allowed, but every one must be reviewed and labelled by a teammate and marked `origin: "ai_drafted"` in the case.
- Verification compares rules AND the AI judge against the expected labels, plus agreement between them.

## Page features: validation, guardrails, retrieval
- `validate.js`: before checks run, confirm every case has a unique ID, every turn has an ID and a role, and goal/readiness values come from `reference/support_choices.json`. Show errors on the page; do not crash.
- `validateHint(hint, variant)`: every flag (rule or AI) must reference an existing assistant turn, quote text found word for word in it, and have an explanation. Failures go to "needs review" with the reason.
- Text similarity (TF-IDF + cosine) in plain JS, no training: used for near-repetition and for finding the closest source passage to show beside each reply.
- Review-and-improve loop: reviewer-confirmed failures go to `judge/examples.js`; rejected flags and misses go to `regression_cases.js` and `tests/expected.js`; then rules are adjusted and all tests rerun.

## AI judge (judge/ folder, Node only, pending Vatsal)
- `judge/run_judge.js`: for each assistant turn, retrieve the most relevant source passages (same TF-IDF code), build a prompt with `judge/criteria.md` (Tyler's quality criteria), a few reviewer-confirmed bad examples from `judge/examples.js`, the conversation and the retrieved passages, then call the model.
- Settings: temperature 0, fixed JSON output (turn_id, check, quote, explanation, severity, fix_layer, or "unsure"). The judge may only use the criteria given.
- Run every judge result through `validateHint`. LLMs can invent quotes or turn IDs; invalid results go to "needs review".
- Write results to `judge_results.js` as `window.JUDGE_RESULTS = {...};` (NOT a .json file: the page's CSP blocks fetch). Load it with a script tag before app.js.
- Every hint carries `source: "rule"` or `source: "ai_judge"`. Where rules and judge disagree, mark the turn "needs review".
- API keys go in `.env` (already gitignored). Never hardcode or commit a key. Send only fictional data.

## Extra hint fields (only after checking REFERENCE.txt)
Do not remove or rename any field makeHint already produces. Add these as extra fields:
- `severity`: "critical" (safety failure, unacceptable regardless of other qualities, release-blocking) or "quality" (lower-severity concern).
- `fix_layer`: likely place to fix JARA: "prompt", "safety_rule", "retrieval" or "model".
- `source`: "rule" or "ai_judge".

## Guardrails on the tool's own output
- Every hint must reference a real assistant turn ID, quote text that appears word for word in that turn, and include an explanation. Hints that fail validation go to "needs review" with the reason shown, never silently dropped.
- Unfinished checks display "not evaluated", never "passed". Zero suggestions does not mean a case is correct.
- Never label anything "approved" or "clinically safe". Never turn a hint into an automatic clinical approval.
- Reviewer decisions (confirm / reject / modify / unsure + comment) are stored separately from automated hints and included in the export.
- Failed or uncertain outcomes stay in the export rather than being replaced with a claim of success.
- Do not assume JARA's prompt-based safeguards are adequate on their own.

## Commands
- Starter tests: `node check_starter.js`
- After the goal rule: `node check_starter.js --exercise-goals`
- After the source rule: `node check_starter.js --exercise-sources`
- Exercise commands fail on purpose until the rule is written.
- Optional local server (serve only this folder): `python -m http.server 8765 --bind 127.0.0.1`, then open http://127.0.0.1:8765/

## Debugging
- Changes not showing: save, then Ctrl+Shift+R in the browser.
- Page stops responding or check error: F12 > Console, read the first error and line number. Usually a missing bracket or quote, or a check that does not return a list of correctly shaped hints.
- Results are not saved on refresh; export first.

## Working style
- Keep changes small and explain them. Match the existing code style.
- Keep accessibility: real `<button>` elements, labelled inputs, headings, and the existing aria attributes.
- Only edit files the current task owns (see the ownership table in PLAN.md). Ask before editing app.js or index.html.
- New fictional cases need unique IDs and must not break the UI.
- Wording: never say "training", "ML" or "RL" about what we built. In the page, say "source retrieval". Only the judge script may be called "retrieval-augmented verification", and only once it works. Say "few-shot examples from reviewed failures" and "review-and-improve loop", not "recursive training".
