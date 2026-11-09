# TrustyTalker

**Try it now:** <https://samia225.github.io/TrustyTalker/> (works in any web browser, nothing to install)

**Slides:** [TrustyTalker presentation (Google Slides)](https://docs.google.com/presentation/d/1JGyxZ9rjJcRe2xCfBYWCW5StzpVJNszr/edit?usp=sharing&ouid=110349585327549657552&rtpof=true&sd=true)

**Code:** <https://github.com/samia225/TrustyTalker>

---

## What is TrustyTalker?

**JARA** is a chatbot that MCRC Health is building to support adults with alcohol, drug and mental health concerns. It gives information and points people to services. It does not diagnose or prescribe.

Sometimes a chatbot reply sounds kind but misses what the person actually asked for. For example, someone says *"I'm not ready to quit, I just want information"*, and the chatbot replies *"You need to quit. Here is your plan."* Replies like that can push people away.

**TrustyTalker finds those replies before real people ever see them.** It reads practice conversations (all made up, no real people), keeps track of what the person has said they want, and flags JARA replies that don't fit. A human reviewer then decides whether each flag is a real problem.

### What it checks
TrustyTalker runs **18 automatic checks** on every JARA reply. In plain words, it looks for replies that:
- push the person toward a goal they didn't choose, or forget what they said earlier;
- repeat themselves, or ask again about something the person already declined;
- miss signs that someone may be in danger, or give unsafe advice;
- refuse to share safety information, like where to get naloxone;
- give medical advice or a diagnosis instead of pointing to a doctor, pharmacist, clinic or health line;
- suggest a service in the wrong place, for example Tennessee for someone in Alberta;
- state service details that the records don't support;
- use stigmatizing words, agree with something risky, or sound more certain than they should.

Every flag shows JARA's **exact words**, **why** it was flagged, **how serious** it is (critical or lower), and **where** JARA would need fixing.

### People stay in charge
- **An AI second opinion.** An AI model gave a second opinion on each reply ahead of time. It is always clearly labelled **AI JUDGE**, and it only suggests.
- **Reviewers decide.** Each reviewer is a clinician, peer support worker, researcher or JARA developer. They answer **Yes / No / Not sure**, rate the reply, and can **suggest a better reply**. Suggestions are labelled with the reviewer's role, never as AI.
- **Mistakes are retested.** Confirmed problems become tests that are rerun every time JARA changes.

### How well it works so far
On 59 labelled practice conversations:
- the checks found **42 of 44** problem replies, including **all 17 critical** ones;
- they flagged **none** of the good replies.

These are early results, because the team saw every case while building the checks. Review by clinicians is the next step.

## How to try it (no technical knowledge needed)

1. Open **<https://samia225.github.io/TrustyTalker/>**. To use it without the internet, download the code instead (see "For developers") and double-click the file `index.html`.
2. Choose **Continue as a guest**. You can also sign up; the account is saved only in your own browser.
3. On Home, choose who you are, for example **Clinician**. A small helper called **Trusty** shows you around.
4. Press **Start reviewing**. For each flagged reply, read the conversation and answer **Yes**, **No** or **Not sure**, with one sentence on why.
5. Go to **Results** to see your decisions and download them.

**A good example to look at:** **Browse cases → CASE-10 ("Not ready to quit")**. Compare the two versions of the conversation. Then scroll to the last JARA reply in Example B to see the flag, the AI's opinion and reviewers' suggestions.

**Is my data sent anywhere?** No. The page runs entirely in your browser and makes no internet connections. Your answers stay on your computer until you download them.

**What do I need?** Any laptop or desktop with a modern web browser (Chrome, Edge, Firefox or Safari). No special hardware.

## For developers: set up and run

**Get the code**
```
git clone https://github.com/samia225/TrustyTalker.git
```
You can also use **Code → Download ZIP** on GitHub.

**Run the app.** Open `index.html` in a browser.
- There is no build step, server or package install.
- The app is plain HTML, CSS and JavaScript with no dependencies.
- Its Content-Security-Policy blocks all network calls.

**Run the tests (optional).** These need [Node.js](https://nodejs.org) 18 or newer. There is no `npm install`. From the project folder:
```
node check_starter.js --exercise-goals
node tests/test_p1_checks.js
node scoring/score_report.js        # per-check caught / missed / wrongly flagged, precision, recall
```
The full list is under [Tests](#tests).

**The AI judge (optional, runs on your computer, never inside the page)**
1. Put `OPENAI_API_KEY=...` in a `.env` file in the project folder. The file is gitignored; never commit a key.
2. Run one of these:

| Command | What it does |
|---|---|
| `node judge/run_judge.js --live` | Asks the AI model (gpt-4o-mini) for a second opinion on every conversation and saves the results to `judge_results.js`, which the page shows |
| `node judge/watch_added.js` | Runs in the background. When a reviewer adds a new case in the page, it sends that case to the AI judge automatically. The open page then shows the AI's opinion within a few seconds, without a refresh. Leave it running; stop with **Ctrl+C** |
| `node judge/run_judge.js` | Dry run: builds the prompts without calling the AI |

- **What is sent:** only fictional conversations, anonymised first. Each run has a token limit.
- **Without a key:** the app still works fully, and the saved AI results in `judge_results.js` are still shown.

**Dependencies**

| Part | Needs |
|---|---|
| The app | A web browser |
| Tests and scoring | Node.js 18+, built-in modules only |
| AI judge (optional) | The OpenAI API, with a restricted key approved by MCRC |

Details are in [docs/dependencies_and_services.md](docs/dependencies_and_services.md).

## Slides, demo and written materials

- **Live demo:** <https://samia225.github.io/TrustyTalker/>
- **Slides:** [TrustyTalker presentation (Google Slides)](https://docs.google.com/presentation/d/1JGyxZ9rjJcRe2xCfBYWCW5StzpVJNszr/edit?usp=sharing&ouid=110349585327549657552&rtpof=true&sd=true)
- **Visual guide:** inside the app (Home, then "See the step-by-step guide"), with screenshots in [guide/](guide/)
- **Project summary (250 words):** [docs/project_summary.md](docs/project_summary.md)
- **About the project (600 words):** [docs/about_the_project.md](docs/about_the_project.md)
- **MCRC handover:** [docs/submission.md](docs/submission.md)
- **What each check catches and misses:** [docs/p1_checks_limitations.md](docs/p1_checks_limitations.md) and [docs/p2_checks_limitations.md](docs/p2_checks_limitations.md)
- **Scoring report:** [scoring/score_report.md](scoring/score_report.md)
- **Example exported results:** [docs/example_export_CASE-01.json](docs/example_export_CASE-01.json)

## Sources

- **Problem and starter kit:** MCRC Health's JARA problem brief and starter kit (the `base-code` git tag, including `reference/support_choices.json`), plus Tyler (MCRC)'s quality criteria and answers.
- **Conversations:** every conversation is made up.
  - CASE-19 to CASE-21 were written by MCRC.
  - Cases marked `origin: "ai_drafted"` were drafted with AI, then read, fixed and labelled by the team.
  - No real people's conversations or personal information are used.
- **Research we drew on (ideas, not copied text):**
  - Hawk et al. (2025), stigmatizing language.
  - WHO digital health evaluation domains, for the reviewer rating questions (not a validated scale).
  - The SIM-VAIL paper (Nature Medicine, 2026), for practice conversations and checking an AI judge against people.
- **Third-party code:** none is included.

## Credits

- **Team TrustyTalker:**
  - Samia Rahman (team lead)
  - Fatima Khalid
  - Ghala Abdulfattah
  - Mohammad Hossein Naiji
- **Problem provider:** MCRC Health. Tyler (MCRC) reviewed our labels and severity rules and wrote scenarios CASE-19 to CASE-21.
- **Event:** natHacks 2026, University of Alberta. All rights reserved by MCRC Health.
- **Code history:** the starter kit is tagged `base-code`. Everything after it was written during the natHacks weekend (Nov 6, 7 PM to Nov 9, 11 AM).

---

# Technical details

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
