# TrustyTalker

**Slides:** [TrustyTalker presentation (Google Slides)](https://docs.google.com/presentation/d/1JGyxZ9rjJcRe2xCfBYWCW5StzpVJNszr/edit?usp=sharing&ouid=110349585327549657552&rtpof=true&sd=true)

TrustyTalker is a review tool for MCRC Health's JARA, a non-diagnostic support and resource-navigation chatbot for adults with substance use and mental health concerns. It reads fictional JARA conversations, keeps track of what the person has said (their goal, readiness to change, preferences and anything they declined), and flags JARA replies that do not fit, for example pushing someone to quit when they only asked for information. A human reviewer then decides whether each flag is a real problem.

Built at natHacks 2026 (Problem Provider Division) for MCRC Health. All rights reserved by MCRC Health. Fictional data only. The `base-code` tag is the MCRC starter kit as provided; everything after it was written during the natHacks weekend (Nov 6, 7 PM to Nov 9, 11 AM).

## What it does

- **Tracks the person, turn by turn.** Goal, readiness, preferences and declined items. The newest statement wins.
- **Runs 18 rule-based checks on every JARA reply.** They cover:
  - goal pressure and drift;
  - repetition;
  - unsupported service details;
  - missed crisis signs and unsafe advice;
  - unnecessary refusals;
  - diagnosis or medical advice instead of resources;
  - missing or wrong-region resources;
  - stigmatizing language;
  - sycophancy;
  - overconfidence.
- **Explains every flag.** Each flag quotes JARA's exact words, names the turn, gives a reason, says how serious it is (critical or quality) and where JARA would need fixing.
- **Shows an optional AI judge second opinion beside the rules.** It is clearly labelled as AI.
- **Lets reviewers decide.** Reviewers answer Yes / No / Not sure, rate the reply, see others' average scores, and can suggest a better reply. Suggestions are labelled with the reviewer's role and never as AI.
- **Exports the results.** Results export as JSON or CSV. Confirmed problems export as regression tests.

## How to access, set up and run

**Access.** Get the code from GitHub: <https://github.com/samia225/TrustyTalker>.
```
git clone https://github.com/samia225/TrustyTalker.git
```
You can also download the ZIP from GitHub (Code > Download ZIP) and unzip it.

**Set up.** Nothing to install for the app itself.

**Run the app.**
1. Open the folder and double-click `index.html`. It opens in any modern browser (Chrome, Edge, Firefox, Safari). No server, account or internet connection is needed.
2. Log in, sign up, or choose **Continue as a guest**. Then pick your reviewer role on Home.
3. Press **Start reviewing**, or **Browse cases** to open any case. The in-app guide (Home, then "See the step-by-step guide") walks through each step.

**Run the tests (optional).** These need [Node.js](https://nodejs.org) 18 or newer. There is no `npm install`. From the project folder:
```
node check_starter.js --exercise-goals
node tests/test_p1_checks.js
node scoring/score_report.js        # caught / missed / wrongly flagged, precision, recall
```
The full list is under [Tests](#tests).

**Run the AI judge (optional, not needed for the app).**
1. Put `OPENAI_API_KEY=...` in a `.env` file in the project folder. The file is gitignored; never commit a key.
2. Run `node judge/run_judge.js --live`.

Without a key, `node judge/run_judge.js` does a dry run with no network. Saved results are already included in `judge_results.js`.

## Dependencies and hardware

- **Hardware:** any laptop or desktop that can run a modern web browser. No special hardware was used or borrowed.
- **The app:** no dependencies. Plain HTML, CSS and JavaScript, with no frameworks, packages, build step or CDN. Its Content-Security-Policy blocks all network calls.
- **Tests and scoring:** Node.js 18 or newer, using built-in modules only (no packages).
- **AI judge (optional):** the OpenAI API (gpt-4o-mini), with a restricted key and fictional, anonymised data only. Approved by MCRC.
- **Details:** [docs/dependencies_and_services.md](docs/dependencies_and_services.md).

## Slides and demonstration

- **Slides:** [TrustyTalker presentation (Google Slides)](https://docs.google.com/presentation/d/1JGyxZ9rjJcRe2xCfBYWCW5StzpVJNszr/edit?usp=sharing&ouid=110349585327549657552&rtpof=true&sd=true)
- **Demo video:** _[add link]_
- **Live demo path:**
  1. Open `index.html` and continue as a guest. Choose **Clinician** on Home.
  2. Open CASE-10 ("Not ready to quit") from **Browse cases**.
  3. Compare Example A and B. B's last reply is flagged, with the AI judge's opinion and reviewer suggestions underneath.
  4. Press **Review this case**, answer Yes, and open **Others' scores**.
  5. Finish on Results and download.
- **Visual guide:** inside the app, with screenshots in [guide/](guide/).
- **Example exported findings:** [docs/example_export_CASE-01.json](docs/example_export_CASE-01.json).

## Written materials

- **Project summary (250 words):** [docs/project_summary.md](docs/project_summary.md)
- **About the project (600 words):** [docs/about_the_project.md](docs/about_the_project.md)
- **MCRC handover:** [docs/submission.md](docs/submission.md), answering SUBMISSION.txt.
- **What each check catches and misses:** [docs/p1_checks_limitations.md](docs/p1_checks_limitations.md) and [docs/p2_checks_limitations.md](docs/p2_checks_limitations.md).
- **Scoring report:** [scoring/score_report.md](scoring/score_report.md) (rules, AI judge, and agreement between them).

## Sources

- **Problem and starter kit:** MCRC Health's JARA problem brief and starter kit (`base-code` tag, including `reference/support_choices.json`), and Tyler (MCRC)'s quality criteria and answers.
- **Data:** every conversation is fictional.
  - CASE-19 to CASE-21 are MCRC's own human-written scenarios.
  - Cases marked `origin: "ai_drafted"` were drafted with AI, then read, fixed and labelled by the team.
  - No real participant data is used.
- **Research we drew on (ideas, not copied text):**
  - Hawk et al. (2025), stigmatizing language terms.
  - WHO digital health evaluation domains, for the adapted reviewer rating items (not a validated scale).
  - The SIM-VAIL paper (Nature Medicine, 2026), for simulated users and validating an AI judge against people.
- **Third-party code:** none is included.

## Credits

- **Team TrustyTalker:**
  - Samia Rahman (team lead)
  - Fatima Khalid
  - Ghala Abdulfattah
  - Mohammad Hossein Naiji
- **Problem provider:** MCRC Health. Tyler (MCRC) reviewed the labels and severity rules and supplied scenarios CASE-19 to CASE-21.
- **Event:** natHacks 2026, University of Alberta.

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
docs/       submission.md (MCRC checklist and answers), project_summary.md, about_the_project.md,
            p1/p2_checks_limitations.md, dependencies_and_services.md,
            example_export_CASE-01.json (a mismatch and a non-mismatch)
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
node tests/test_resource_checks.js
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

## How our development reports shaped TrustyTalker

- **Report #1 (Ideate):** set five criteria. Each one became a feature:

  | Criterion | Feature |
  |---|---|
  | Extensibility | Checks are separate files that register themselves |
  | Explainability | Every flag quotes JARA's exact words and gives a reason |
  | Reproducibility | JSON export and a regression runner (`tests/run_regression.js`) |
  | Reliability | Uncertain matches go to "needs review", never passed |
  | Privacy | Fictional data only; the page makes no network calls |

- **Report #2 (Innovate):** the Integrated JARA Evaluation Platform scored highest (49 of 55), and that is what we built. From the runner-up ideas:
  - The **rule-based test engine** (Python Test Suite) became our rule checks.
  - The **"what JARA should have known at each message"** view (Readiness-to-Change Tracker) became the state tracker and the tracked-state panel.
- **Report #3 (Implement):** the flowchart is how the app works: track the person's state, run the checks, flag or send to needs review, reviewer decides, export, rerun.
- **What changed:** Report #3 planned TypeScript, React, Vite and Vitest to match JARA's stack. MCRC's starter kit required plain JavaScript that opens with no install, so we kept the design and changed tools. The tests use Node's built-in test tools instead of Vitest.
- **Not built yet:** Report #2 also planned a version comparison (JARA before and after a change, side by side). The regression runner reruns past failures, but the side-by-side view is a next step.

## Demo: replies with reviewer scores

"Others' scores" shows the average of the other reviewers' ratings for a reply. Fixed fictional ratings are preloaded for six findings. They are marked "Demo reviewer (fictional)", load once per browser, and are cleared by **Remove demo reviews** on the Results page.

| Finding | Rated by |
|---|---|
| CASE-10-B-A2, goal alignment (demo story) | 2 clinicians, 2 peer support, 1 researcher. Best for showing the filter |
| CASE-02-B-A1, drift | 2 clinicians, 2 peer support, 1 researcher, 1 developer |
| CASE-P2-07-B-A1, respectful language | 2 clinicians, 2 peer support, 1 researcher |
| CASE-05-B-A1, source support | 2 clinicians, 1 researcher, 1 developer |
| CASE-01-B-A1, goal alignment (critical) | 2 clinicians |
| CASE-12-B-A2, crisis response (critical) | 2 clinicians |

The button stays locked until you answer Yes, No or Not sure, so others' scores cannot sway your own. Critical findings go to clinicians only.
