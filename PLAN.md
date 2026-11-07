# TrustyTalker team plan (natHacks 2026)

## In one line
A web page that checks JARA's fictional conversations turn by turn and flags replies that don't fit what the person asked for, with the exact quote, the turn, the reason, how serious it is and where JARA would need fixing.

## Why it matters
Someone tells JARA "I'm not ready to quit." Three messages later JARA hands them a quit plan, and they leave. This tool catches that on fictional conversations before a real person ever sees it. MCRC Health wants it to become part of JARA's continuous quality improvement and its Phase 1B evaluation.

## Who it's for
MCRC Health's JARA developers and researchers. People using JARA benefit indirectly.

## Source documents
Problem brief, Tyler's emails, Questions for Vatsal (Tyler's answers), START_HERE.txt, TASKS.txt, REFERENCE.txt, SUBMISSION.txt, the SIM-VAIL paper (Nature Medicine, 2026). Keep the brief, emails, contract and reports in Google Drive, not the repo.

## Starter kit facts (from START_HERE.txt and TASKS.txt)
- Plain HTML/JS. Open index.html by double-clicking. No terminal, account or install needed.
- Already working: case display, running enabled checks, highlighting the quoted turn, JSON export, one exact-repetition check (CASE-04 Example B).
- TODO: `checkGoalAlignment` (start with CASE-01) and `checkSourceSupport` (CASE-05).
- Do not rename starter files. Results are not saved on refresh; export first.
- Tests: `node check_starter.js`, then `--exercise-goals` and `--exercise-sources` (these fail until the rule is written).

## First hour (Fri 7 PM, everyone together)
1. 0-15 min: open index.html, run CASE-04, export one finding, find the quoted turn in the JSON.
2. 15-30 min: read `checkRepeatedReply` and `makeHint` in student_checks.js: how assistant turns are selected, compared and returned as hints.
3. 30-60 min: P1 writes `checkGoalAlignment` on CASE-01 (flag Example B, leave Example A alone), sets its `implemented` flag to true and refreshes. Everyone else agrees the hint format and state tracker output.

## Minimum demonstration (TASKS.txt, must all be true)
- [ ] Page opens from the folder with no accounts or installs.
- [ ] The repetition check still works.
- [ ] Goal rule flags an appropriate example and leaves an aligned example alone.
- [ ] At least three new fictional cases with unique IDs, running without broken UI.
- [ ] Every exported hint has a real assistant turn ID, literal quote and explanation.
- [ ] Unfinished checks stay visibly unevaluated.
- [ ] Failed or uncertain outcomes stay in the handoff, not replaced by claims of success.

## Core project (TASKS.txt)
1. Goal-alignment check in student_checks.js.
2. Each suggestion explained with an exact assistant quote and the real turn ID.
3. Test a mismatch AND a similar sentence that should not be flagged.
4. At least three new fictional cases in data.js with unique IDs.
5. Demo: a case, a response comparison, the finding, an exported JSON.
6. Describe what the rule cannot detect and at least one false-positive risk.
Second exercise: source support on CASE-05 (compare `turn.claims` to the source with the matching `source_id`).

## Verification (how we prove the checks work)
No ML or RL training this weekend: there is no clinician-labelled data, TASKS.txt rules out training, and a model trained on a few dozen fictional cases would only memorize them. AI is used in three other ways instead (see "Validation, guardrails, retrieval and the AI judge").

**MCRC research-tool scenarios** (P1 owns conversion)
1. Confirm with Tyler: are they all fictional, and can they go in the private repo?
2. Convert them once into the starter's case format with unique IDs.
3. Label each in advance: which turns should be flagged, by which check, and how severe. Two teammates label independently and compare.
4. Add near-misses for each check: similar replies that are fine and must not be flagged.
5. Hold back about a quarter as a held-out set (`tests/heldout/`). Nobody tunes rules against them.

**AI-drafted cases:** use Claude or ChatGPT to draft extra fictional conversations (an AI playing a person with a set goal or vulnerability, as in SIM-VAIL). Every one is reviewed and labelled by a teammate and marked `origin: "ai_drafted"`. Say so in the submission.

**Measure each check** on all cases: caught, missed, wrongly flagged, precision and recall. Report them in the summary, e.g. "goal alignment caught 9 of 10 seeded failures and wrongly flagged 1 of 12 aligned replies."

**Rules vs AI judge:** measure both against the labels, and their agreement with each other. Report which is more accurate on which check.

**Human agreement:** compare the tool's flags with the two teammates' labels, and the teammates with each other (the SIM-VAIL paper validated its judge the same way against clinicians).

**Where ML fits later (next-steps slide):** the reviewer panel records every confirm and reject decision. Over Phase 1B that builds the clinician-labelled data that's missing now. MCRC could then train a classifier on it and verify it with this same test set and agreement measures.

## Validation, guardrails, retrieval and the AI judge
| Idea | Where | What it actually is |
|---|---|---|
| Validation | Page (`validate.js`) | Cases are well-formed before checks run |
| Guardrails | Page + judge | Hard rules on what the tool and the AI judge may output |
| Retrieval (RAG) | Judge script | Relevant source passages given to the AI judge |
| Bad-example learning | Judge script | Few-shot examples from reviewer-confirmed failures in the prompt |
| "Recursive" loop | Both | Review-and-improve loop: corrections feed rules, examples and tests |
| Output validation | Page + judge | `validateHint` checks every flag, rule or AI, before it's shown |

**In the page (works regardless of Vatsal's answer):** validation, guardrails, `validateHint`, TF-IDF similarity for near-repetition and closest source passage, the review-and-improve loop.

**AI judge (separate Node script, only if Vatsal approves):**
1. For each assistant turn, retrieve the closest source passages (same TF-IDF code).
2. Prompt the model with Tyler's criteria, a few confirmed bad examples, the conversation and the passages.
3. Temperature 0, fixed JSON output, "unsure" allowed.
4. Validate every result with `validateHint` (LLMs can invent quotes).
5. Write `judge_results.js` (not JSON: the page can't fetch files) and show judge flags beside rule flags.
6. Rules and judge disagree: the turn goes to "needs review".
If Vatsal says no: keep the page features and skip the judge.

**Layout**
```
index.html, app.js, data.js ...   page (rules, validation, UI)
state_tracker.js, validate.js     page engine
judge/
  run_judge.js    retrieve, prompt, call AI, validate, write judge_results.js
  examples.js     reviewer-confirmed bad examples
  criteria.md     Tyler's quality criteria
judge_results.js  generated, loaded by the page
tests/
  expected.js     labelled answers
  heldout/        final scoring only
```
API keys go in `.env` (already gitignored). Fictional data only.

**Owners:** P1 `validate.js` and `validateHint`. P3 TF-IDF retrieval and `judge/run_judge.js`. P2 `judge/examples.js` and `criteria.md`. P4 loading `judge_results.js` and showing rule vs judge side by side. Everyone labels AI-drafted cases.

**Priority:** page validation and guardrails are Must. TF-IDF retrieval is Should. AI judge and few-shot examples are Should, after all Musts, and only with Vatsal's approval.

## Goals and checks
Severity: **critical** = safety failure, unacceptable regardless of other qualities, release-blocking. **quality** = lower-severity concern.
Fix layer: prompt / safety rule / retrieval / model.

| Goal | Check | Owner | Priority |
|---|---|---|---|
| Readiness to change / MI (TASKS core, Tyler) | Goal alignment (CASE-01) | P1 | Must |
| Consistency (brief) | Repetition: keep CASE-04 working, add near-repeats and re-asking declined questions | P1 | Must |
| Drift / inconsistent personalization (brief, Tyler) | Changed preference, forgotten context, quoted readiness | P1 | Must |
| Accuracy (brief, TASKS 2nd exercise) | Source support (CASE-05) + closest-passage source retrieval | P3 | Must |
| Reproducibility (brief) | JSON export + rerun comparison | P4 | Must |
| Safety (brief, Tyler) | Unsafe replies AND unnecessary refusals (e.g. naloxone question) | P2 | Should |
| Inconsistent risk recognition (Tyler) | Risk raised indirectly or across several turns | P2 | Should |
| Information gathering (Tyler) | Advice before enough context (pattern, readiness, location, needs) | P3 | Should |
| Premature advice-giving (Tyler) | Jumps to solutions instead of exploring | P3 | Should |
| Reviewer judgment kept separate (TASKS, Tyler) | Reviewer panel: confirm / reject / modify / unsure + comment | P4 | Should |
| Severity and fix layer (Tyler) | Extra fields on every hint; critical shown first | P1 + P4 | Should |
| Sycophancy (Tyler) | Agreeing with false or harmful statements | P2 | Could |
| Stigmatizing, judgmental or coercive language (Tyler) | Language check | P2 | Could |
| Scope and transparency (Tyler) | Diagnosis, prescribing, misstating JARA's role or confidentiality | P2 | Could |
| Overconfidence (Tyler) | Overly certain claims, no acknowledgement of uncertainty | P3 | Could |
| Excessive or generic replies (Tyler, brief) | Length and generic-content check | P3 | Could |
| Resource navigation (Tyler) | Resource does not fit the person's location (JARA starts with Alberta, Tennessee) | P3 | Could |
| Next steps fit circumstances (Tyler) | Contradictions / recommendation mismatch | P3 | Could |
| Unverified saved-state claims (TASKS optional) | Reply claims to remember something never said | P1 | Could |

Build all Musts end to end before any Should. Build Shoulds before Coulds.

Mental health scope (Tyler): prioritise core substance-use scenarios plus high-risk mental health presentations (e.g. suicidal ideation). Design the case format so depression, psychosis, mania and trauma scenarios can be added later. Check how JARA handles disclosures, not whether it diagnoses.

## Roles
See TEAM_TASKS.md for who owns which files and tasks. It is the only source of truth for roles.

- Person 1: Engine lead (state tracker, goal alignment, drift, repetition, validation, verification, merges)
- Person 2: Checks and AI judge (source support, safety, information gathering, judge script)
- Person 3: Front end (app.js, index.html, timeline, comparison, reviewer panel, summary)
- Person 4: Test data, labels and the story (cases, labels, held-out set, slides, reports)

Every check owner writes their own test cases: one that should be flagged and one similar one that should not. Write them in the starter's case format and include at least one high-risk mental health case.

## Shared rules
- One branch per person. Pull requests into main. Merge at least twice a day.
- Only P4 edits app.js and index.html. Send P4 the script tag or container you need.
- Agree the hint format and state tracker output on Friday night before building on them.
- Plain JavaScript only. No frameworks, servers, network calls or AI models (see CLAUDE.md).
- Fictional data only. Provided cases are development examples, not clinical references.

## Pending answers from Tyler
- Are the research-tool test scenarios all fictional, and can they be committed to the private repo?

## Pending answers from Vatsal
- Can we run an AI judge in a separate Node script? Which model, whose API key, any cost limit? Is sending fictional data to an outside API fine?
- JavaScript or TypeScript? Vitest or Deno?
- How should changing goals, preferences and readiness be represented?
- Can a reviewer adjudication field be added to the export?
- Is the Nov 4 kit the latest, and does a fuller package (8 personas, 12 scenarios) exist?
- Which starter components should not be modified (beyond filenames)?
- Can we get a JARA testing environment or accounts this weekend?

## Schedule
- **Fri 7 PM to ~1 AM:** first hour together, state tracker, goal alignment on CASE-01, hint format agreed, layouts sketched, first new cases, research-tool scenarios converted and labelled (held-out set set aside). Fix Report 3 (stack, scenario count, IP answer) and submit by 11:59 PM.
- **Sat:** source support, safety, timeline, comparison view, severity fields, validate.js and validateHint, TF-IDF retrieval. AI judge script if Vatsal approved. Draft extra cases with AI and label them. Merge at lunch and dinner. Show Tyler progress.
- **Sun:** drift, information gathering, premature advice, reviewer panel, summary, regression suite, Coulds if time. **Feature freeze 6 PM**, then run final verification on the held-out set and record the numbers. Then slides, summaries, backup demo video, rehearsal.
- **Mon:** final test 9 AM. **Submit by 10 AM** (hard deadline 11 AM, no late submissions). Judging from 12 PM.

## Demo (5 minutes + 5 minutes Q&A)
1. 0:00 Problem: the "not ready to quit" story.
2. 0:30 Live demo: open a case, run checks, timeline shows the first off-track turn and severity, compare A/B with source passage, rule vs AI judge side by side (if built), reviewer modifies or marks one flag Unsure with a comment, export, fix the reply and rerun.
3. 3:30 Limits: what the rules cannot detect (keyword limits), one false-positive risk, every reviewer correction becomes a regression test.
4. 4:30 Next steps: Phase 1B, reviewer role in JARA's login, release-blocking critical tests. Close.

## Submission
- Project summary (max 250 words): problem, approach, results with verification numbers per check.
- About the project (max 600 words): inspiration, how we built it, what we learned, challenges.
- Repo with README. Follow SUBMISSION.txt for MCRC's handover requirements.
- Include rule limitations, at least one false-positive risk, and uncertain/failed results.
- Fictional data only. Code written during natHacks only (everything after tag `base-code`).

## Words to avoid in the pitch
Never say "training", "ML" or "RL" about what we built; ML training belongs only in next steps. Say "rule-based checks verified against labelled cases", "few-shot examples from reviewed failures" and "every reviewer correction becomes a regression test". Say "retrieval-augmented verification" only if the AI judge with retrieval actually works.


