# TrustyTalker

Internal tool for MCRC Health that flags JARA replies in fictional conversations that ignore a person's goals, readiness to change, or earlier preferences. Built at natHacks 2026; all rights reserved by MCRC Health. Fictional data only.

The `base-code` tag is the MCRC starter kit as provided. See `START_HERE.txt` to run it.

## Repository layout

Open `index.html` by double-clicking it. No install, account or server is needed.

```
(root)      MCRC starter files. They stay here with their original names:
            index.html, app.js, data.js, student_checks.js, styles.css,
            check_starter.js, package.json, MANIFEST.json, *.txt, reference/
engine/     state_tracker.js (goal, readiness, preferences per turn), similarity.js (TF-IDF)
checks/     extra rule-based checks: checks_common.js, checks_sources.js,
            checks_safety.js, checks_quality.js
ui/         timeline.js, review.js (reviewer panel)
tests/      test_state_tracker.js, test_p2_checks.js, expected.js (expected labels),
            second_labeller_sheet.md
judge/      AI judge script (Node only, separate from the page), criteria.md, examples.js
docs/       limitations and write-ups
handoff/    test cases handed to Person 4 (already added to data.js)
```

Script load order in `index.html` matters: data, engine, `student_checks.js`, checks, ui, `app.js` last.

## Tests

```
node check_starter.js
node check_starter.js --exercise-goals
node check_starter.js --exercise-sources
node tests/test_state_tracker.js
node tests/test_p2_checks.js
node judge/test_run_judge.js
```

## Test cases and labels

All conversations are fictional. None come from real people or real JARA output.

**Cases (`data.js`): 25 cases, each with an Example A and an Example B (50 conversations).**

| Cases | Written by | What they cover |
|---|---|---|
| CASE-01, 02, 04, 05, 07, 09 | MCRC starter kit | Goal pressure, changed request, repetition, source support, saved-state claim, quoted readiness |
| CASE-10 to CASE-18 | Person 4, drafted with AI | Not ready to quit (the demo story), near-misses, indirect suicide risk, harm reduction, home opioid taper, clinic record, stigmatizing language |
| CASE-P2-01 to CASE-P2-10 | Person 2, drafted with AI | Crisis disclosures, naloxone refusal, unsafe mixing, sycophancy, diagnosis, language, premature advice, source support, overconfidence |

AI-drafted cases are marked `"origin": "ai_drafted"` and were read and fixed by hand. New cases go at the end of `data.js` with unique IDs; only Person 4 edits that file.

**Expected labels (`tests/expected.js`).** For every conversation, the labels list which JARA turns should be flagged, by which check, and how serious it is (`critical` = safety failure, `quality` = lower-severity concern). They were written by reading the conversations before running the checks.

- 50 conversations labelled: 27 with nothing to flag, 35 flagged replies (10 critical, 25 quality).
- Near-misses are included on purpose (for example CASE-11 and CASE-14): replies that mention quitting but respect the person, and must not be flagged.
- `drift` and `saved_state` are working check names; those rule-based checks are not built yet, so their labels are "not evaluated" for now.

**Second labeller.** Ghala (Person 3), who does not write checks, labelled CASE-13 to CASE-18 independently and agreed with every label (12 of 12 conversations, 8 of 8 flags). `tests/second_labeller_sheet.md` is a blank sheet for labelling more cases.

**Judge files.** `judge/criteria.md` is the rule book pasted into the AI judge's prompt. `judge/examples.js` holds five bad replies confirmed by both labellers. Because those replies are also in `data.js`, judge results on CASE-13 to CASE-18 will look better than on the other cases.

**Limits.** The labels come from team members, not clinicians. A case with no flags is not "safe" or "approved"; it only means the labellers found nothing these checks look for.
