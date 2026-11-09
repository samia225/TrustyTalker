# TrustyTalker

TrustyTalker is an internal review tool for **MCRC Health**. It checks conversations from **JARA**, MCRC's recovery-support chatbot, and flags replies that ignore what the person has said: their goal, their readiness to change, or preferences they stated earlier.

A reply that pushes someone to quit when they have said they aren't ready is a good example. It can damage trust and make people less likely to come back. TrustyTalker tracks each person's goal, readiness and preferences turn by turn. It then runs rule-based checks on every JARA reply, and a reviewer confirms or dismisses each flag.

Built at **natHacks 2026** for the MCRC Health JARA challenge. All rights reserved by MCRC Health. **All data is fictional**: no conversation comes from a real person or from real JARA output.

---

## How to run

1. Download or clone this repository.
2. Double-click `index.html`. You don't need to install anything, make an account or run a server.
3. Choose **CASE-10** (our demo story: a person who is not ready to quit). Step through the timeline to see which JARA reply is flagged, which check flagged it, and why.
4. Open any reviewer panel to confirm or dismiss a flag and export the result as JSON. `docs/example_export_CASE-01.json` shows an example export.

The page needs nothing extra. The **tests** and the **AI judge** need Node.js [version]. The AI judge also needs [API key / service]. See `docs/dependencies_and_services.md`.

`START_HERE.txt` is the original MCRC starter-kit guide. The `base-code` tag marks the starter kit exactly as MCRC provided it.

---

## Links

- Slides: 
- Repository: 

---

## Team

| Name | Role |
|---|---|
| Samia (Person 1) | State tracker; goal, drift, saved-state, near-repetition and declined-reask checks; case validation; regression suite; verification run |
| Fatima (Person 2) | Safety and quality checks; wrote CASE-P2-01 to P2-10 |
| Ghala Abdulfattah (Person 3) | Front end; independent second labeller |
| Hossein (Person 4) | Test cases (`data.js`) and expected labels |

MCRC Health contact: **Tyler**, who wrote the scenarios for CASE-19 to CASE-21 and reviewed the labels.

---

## How it works

1. **State tracking** (`engine/state_tracker.js`): for each turn, records the person's goal, how ready they are to change, and any preferences they've stated, such as "don't tell me to quit".
2. **Validation** (`engine/validate.js`): checks that each case is well formed before any checks run, and that every flag comes with a hint explaining it.
3. **Rule-based checks** (`student_checks.js`, `checks/`): flag replies that conflict with the tracked state, along with safety and quality problems such as missed crisis signals, unsafe mixing advice, sycophancy, diagnosing, stigmatizing language, overconfidence and claims without source support. Each flag is **critical** (a safety failure) or **quality** (a lower-severity concern).
4. **Similarity** (`engine/similarity.js`): TF-IDF comparison used to spot repetition and to check support against sources.
5. **AI judge** (`judge/`, optional, Node only, separate from the page): a second opinion that uses the rule book in `judge/criteria.md`. It caught a problem in CASE-14 that the rules missed.
6. **Reviewer panel** (built in `app.js`): a person makes the final call on every flag.

---

## Repository layout

```
(root)      MCRC starter files, kept with their original names:
            index.html, app.js, data.js, student_checks.js, styles.css,
            check_starter.js, package.json, MANIFEST.json, *.txt, reference/
engine/     state_tracker.js, similarity.js, validate.js
checks/     checks_common.js, checks_sources.js, checks_safety.js, checks_quality.js
ui/         timeline.js
tests/      test_state_tracker.js, test_p1_checks.js, test_validate.js, test_p2_checks.js,
            run_regression.js, regressions/*.json (past failures and reviewer exports),
            expected.js (expected labels), second_labeller_sheet.md
judge/      AI judge script, test_run_judge.js, criteria.md, examples.js
docs/       submission.md (MCRC checklist and answers), project_summary.md,
            about_the_project.md, p1_checks_limitations.md, p2_checks_limitations.md,
            dependencies_and_services.md, example_export_CASE-01.json
handoff/    test cases handed to Person 4 (already added to data.js)
```

Developer note: script load order in `index.html` matters (data, engine, `student_checks.js`, checks, `tests/expected.js`, then `app.js` last).

---

## Running the tests

```bash
node check_starter.js
node check_starter.js --exercise-goals
node check_starter.js --exercise-sources
node tests/test_state_tracker.js
node tests/test_p1_checks.js
node tests/test_validate.js
node tests/test_p2_checks.js
node tests/run_regression.js
node judge/test_run_judge.js
```

---

## Test cases

`data.js` holds **28 cases (59 conversations)**. Most cases have an Example A and an Example B. CASE-19 to CASE-21 have three versions each.

| Cases | Written by | What they cover |
|---|---|---|
| CASE-01, 02, 04, 05, 07, 09 | MCRC starter kit | Goal pressure, changed request, repetition, source support, saved-state claim, quoted readiness |
| CASE-10 to CASE-18 | Person 4, drafted with AI | Not ready to quit (the demo story), near-misses, indirect suicide risk, harm reduction, home opioid taper, clinic record, stigmatizing language |
| CASE-P2-01 to CASE-P2-10 | Person 2, drafted with AI | Crisis disclosures, naloxone refusal, unsafe mixing, sycophancy, diagnosis, language, premature advice, source support, overconfidence |
| CASE-19 to CASE-21 | MCRC (human-written scenarios from Tyler) | MCRC's ideal (A), unacceptable (B) and suboptimal (C) replies: a drinking friend early in recovery, a home methadone taper, drinking after rehab |

AI-drafted cases are marked `"origin": "ai_drafted"`. Each one was read and corrected by hand. New cases go at the end of `data.js` with unique IDs, and only Person 4 edits that file.

---

## Expected labels

`tests/expected.js` lists, for every conversation, which JARA turns should be flagged, by which check, and how serious each flag is. The labels were written by reading the conversations **before** running the checks.

- **59 conversations labelled:** 28 with nothing to flag, and **44 flagged replies** in the rest (17 critical, 27 quality).
- CASE-01-B-A1 and CASE-02-B-A2 ("you need to quit") were raised to critical as coercive, following Tyler's rule.
- CASE-19 to CASE-21 are labelled from MCRC's own ratings: unacceptable replies are critical, and suboptimal ones are quality.
- **Near-misses are included on purpose.** CASE-11, for example, has replies that mention quitting but still respect the person, and these must not be flagged. CASE-14 was written as a near-miss, but Tyler found both versions too pushy, so it is now flagged (quality). The AI judge caught this; the rules did not.

**Second labeller.** Ghala (Person 3), who does not write checks, labelled CASE-13 to CASE-18 on her own and agreed with every label: 12 of 12 conversations and 8 of 8 flags. `tests/second_labeller_sheet.md` is a blank sheet for labelling more cases.

**MCRC review.** Tyler (MCRC) reviewed the labels on 2026-11-08 and agreed with them, including the demo story (CASE-10), CASE-15 and CASE-16 (both of its labels critical). He also confirmed the severity rules in `judge/criteria.md`. This is a preliminary review. Clinician review is planned for Phase 1B.

**Judge files.** `judge/criteria.md` is the rule book pasted into the AI judge's prompt. `judge/examples.js` holds five bad replies that both labellers confirmed. Those replies also appear in `data.js`, so judge results on CASE-13 to CASE-18 will look better than on the other cases.

---

## Limits

- The labels come from team members and a preliminary MCRC review, not from a clinical validation.
- A case with no flags is **not** "safe" or "approved". It only means the labellers found nothing these checks look for.
- The rule-based checks have known gaps, listed in `docs/p1_checks_limitations.md` and `docs/p2_checks_limitations.md`.
