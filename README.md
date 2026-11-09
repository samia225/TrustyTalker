# TrustyTalker

Internal tool for MCRC Health that flags JARA replies in fictional conversations that ignore a person's goals, readiness to change, or earlier preferences. Built at natHacks 2026; all rights reserved by MCRC Health. Fictional data only.

The `base-code` tag is the MCRC starter kit as provided. See `START_HERE.txt` to run it.

## Repository layout

Open `index.html` by double-clicking it. No install, account or server is needed.

```
(root)      MCRC starter files. They stay here with their original names:
            index.html, app.js, data.js, student_checks.js, styles.css,
            check_starter.js, package.json, MANIFEST.json, *.txt, reference/
engine/     state_tracker.js (goal, readiness, preferences per turn), similarity.js (TF-IDF),
            validate.js (case checks before the checks run; validateHint for every flag)
checks/     extra rule-based checks: checks_common.js, checks_sources.js,
            checks_safety.js, checks_quality.js
ui/         timeline.js (loaded by index.html); review.js is NOT loaded (unused:
            the reviewer panel the page shows is built in app.js)
tests/      test_state_tracker.js, test_p1_checks.js, test_validate.js, test_p2_checks.js, expected.js (expected labels),
            second_labeller_sheet.md
judge/      AI judge script (Node only, separate from the page), criteria.md, examples.js
docs/       limitations and write-ups
handoff/    test cases handed to Person 4 (already added to data.js)
```

Script load order in `index.html` matters: data, engine, `student_checks.js`, checks, `tests/expected.js`, `app.js` last.

## Tests

```
node check_starter.js
node check_starter.js --exercise-goals
node check_starter.js --exercise-sources
node tests/test_state_tracker.js
node tests/test_p1_checks.js
node tests/test_validate.js
node tests/run_regression.js      # past failures + reviewer exports in tests/regressions/*.json
node tests/test_p2_checks.js
node judge/test_run_judge.js
```

## Test cases and labels

All conversations are fictional. None come from real people or real JARA output.

**Cases (`data.js`): 28 cases (59 conversations). Most have an Example A and an Example B; CASE-19 to CASE-21 have three versions.**

| Cases | Written by | What they cover |
|---|---|---|
| CASE-01, 02, 04, 05, 07, 09 | MCRC starter kit | Goal pressure, changed request, repetition, source support, saved-state claim, quoted readiness |
| CASE-10 to CASE-18 | Person 4, drafted with AI | Not ready to quit (the demo story), near-misses, indirect suicide risk, harm reduction, home opioid taper, clinic record, stigmatizing language |
| CASE-P2-01 to CASE-P2-10 | Person 2, drafted with AI | Crisis disclosures, naloxone refusal, unsafe mixing, sycophancy, diagnosis, language, premature advice, source support, overconfidence |
| CASE-19 to CASE-21 | MCRC (human-written scenarios from Tyler) | Each has MCRC's ideal (A), unacceptable (B) and suboptimal (C) reply: a drinking friend early in recovery, a home methadone taper, drinking after rehab |

AI-drafted cases are marked `"origin": "ai_drafted"` and were read and fixed by hand. New cases go at the end of `data.js` with unique IDs; only Person 4 edits that file.

**Expected labels (`tests/expected.js`).** For every conversation, the labels list which JARA turns should be flagged, by which check, and how serious it is (`critical` = safety failure, `quality` = lower-severity concern). They were written by reading the conversations before running the checks.

- 59 conversations labelled: 28 with nothing to flag, 44 flagged replies (17 critical, 27 quality). CASE-01-B-A1 and CASE-02-B-A2 ("you need to quit") were raised to critical as coercive, following Tyler's rule.
- CASE-19 to CASE-21 are labelled from MCRC's own ratings: unacceptable replies are critical, suboptimal ones are quality.
- Near-misses are included on purpose (for example CASE-11): replies that mention quitting but respect the person, and must not be flagged. CASE-14 was written as a near-miss, but Tyler (MCRC) found both versions too pushy, so it is now flagged (quality). The AI judge caught this and the rules did not.

**Second labeller.** Ghala (Person 3), who does not write checks, labelled CASE-13 to CASE-18 independently and agreed with every label (12 of 12 conversations, 8 of 8 flags). `tests/second_labeller_sheet.md` is a blank sheet for labelling more cases.

**MCRC review.** Tyler (MCRC) reviewed the labels on 2026-11-08 and agreed with them, including the demo story (CASE-10), CASE-15 and CASE-16 (both of its labels critical). He also confirmed the severity rules in `judge/criteria.md`. This is a preliminary review; clinician review is planned for Phase 1B.

**Judge files.** `judge/criteria.md` is the rule book pasted into the AI judge's prompt. `judge/examples.js` holds five bad replies confirmed by both labellers. Because those replies are also in `data.js`, judge results on CASE-13 to CASE-18 will look better than on the other cases.

**Limits.** The labels come from team members and a preliminary MCRC review, not a clinical validation. A case with no flags is not "safe" or "approved"; it only means the labellers found nothing these checks look for.
