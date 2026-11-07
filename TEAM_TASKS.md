# TrustyTalker task split (draft)

## Person 1: Engine lead
**Owns:** `state_tracker.js`, `student_checks.js`, `validate.js`, `regression_cases.js`, `tests/` scripts

- Walk the team through `checkRepeatedReply` and `makeHint` at the start.
- Agree the hint format with everyone, including `severity`, `fix_layer` and `source`.
- State tracker: goal, readiness, preferences and declined items at every turn.
- `checkGoalAlignment` on CASE-01 (flag Example B, leave Example A alone), set `implemented` to true, pass `node check_starter.js --exercise-goals`.
- Drift check and extended repetition (near-repeats, re-asking declined questions).
- `validate.js` (case validation) and `validateHint` (every flag checked).
- Regression runner and verification script: caught, missed, wrongly flagged, precision and recall per check, rules vs AI judge.
- Held-out scoring after the feature freeze; share the numbers for the summary.
- Review and merge everyone's pull requests.

**Done when:** all Must checks pass their tests, every flag is validated, and the verification numbers are ready.

## Person 2: Checks and AI judge
**Owns:** `checks_sources.js`, `checks_safety.js`, TF-IDF similarity code, `judge/run_judge.js`

- TF-IDF similarity function (closest source passage, near-repetition score), shared with Person 1.
- `checkSourceSupport` on CASE-05 (compare `turn.claims` to the source with the matching `source_id`), pass `--exercise-sources`.
- Safety check: unsafe replies AND unnecessary refusals, marked `critical`.
- Information gathering and premature advice checks.
- If Vatsal approves: `judge/run_judge.js` (retrieve passages, build prompt, temperature 0, JSON output, validate with `validateHint`, write `judge_results.js`), with Person 1 on the prompt.
- A Could check if time allows (sycophancy or overconfidence).

**Done when:** source support and safety work with test cases, and the judge runs end to end (if approved).

## Person 3: Front end
**Owns:** `app.js`, `index.html`, `styles.css`, `timeline.js`, `review.js`. The only person who edits `app.js` and `index.html`.

- Sketch the four screens and show the team before building.
- Containers and script tags in `index.html` in the correct load order.
- Timeline: green / red / amber per turn, "first off track here" marker, tracked-state panel.
- Side-by-side Example A / B with the closest source passage.
- Reviewer panel: confirm / reject / modify / unsure + comment, kept separate from hints and included in the export.
- Summary view: critical first, "not evaluated" for unfinished checks.
- Load `judge_results.js` and show rule vs judge flags side by side (if built).
- Accessibility pass: buttons, labels, headings.

**Done when:** the demo story runs start to finish on the page with no console errors.

## Person 4: Test data, labels and the story
**Owns:** `cases_extra.js`, `tests/expected.js`, `tests/heldout/`, `judge/criteria.md`, `judge/examples.js`, README, slides, written reports

Every number in the pitch comes from these labels.

- Three new fictional cases with unique IDs, in the same format as `data.js`: one failure, one near-miss that must not be flagged, one high-risk mental health case.
- Convert MCRC's research-tool scenarios into the same format (once Tyler confirms they are fictional and allowed in the repo).
- Draft more cases with Claude or ChatGPT, check and fix each by hand, mark them `origin: "ai_drafted"`.
- Label every case in `tests/expected.js` (which turn, which check, what severity). Another teammate labels a sample independently to compare.
- Set aside about a quarter as the held-out set; keep it away from anyone writing rules.
- `judge/criteria.md` from Tyler's quality criteria, and `judge/examples.js` from confirmed failures.
- Optional small check: overly long replies (word count over a limit, marked `quality`), reviewed by Person 1.
- The demo story case (the "not ready to quit" person).
- 250-word summary and 600-word "about the project", using Person 1's numbers.
- Slides, README, backup demo video, rehearsal and timekeeping.

**Done when:** new and converted cases are labelled, the held-out set exists, and the slides, summaries and backup video are ready.

## Working together
- One branch per person. Pull requests into main; Person 1 reviews and merges.
- Ask for help after 30 minutes stuck.
- Only Person 3 edits `app.js` and `index.html`.
- Feature freeze before final testing; after that, only bug fixes, slides and rehearsal.
- Submit Monday by 10 AM (hard deadline 11 AM).
