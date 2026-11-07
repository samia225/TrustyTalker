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
tests/      test_state_tracker.js, test_p2_checks.js
judge/      AI judge script (Node only, separate from the page)
docs/       limitations and write-ups
handoff/    test cases waiting to be added to the data
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
