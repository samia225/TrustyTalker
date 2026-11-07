# TrustyTalker

**Find the JARA replies that don't fit what the person asked for, and show exactly why.**

TrustyTalker is an evaluation tool built at natHacks 2026 for MCRC Health's JARA, an AI support platform for adults with substance-use and mental health concerns. It reviews fictional conversations and flags assistant replies that push a goal the person didn't choose, state facts their source doesn't support, or repeat themselves. Every flag points to the exact reply and quotes it word for word, so a reviewer can check it and the JARA team can retest it after a fix.

> All conversations are fictional. No real participant data, no live JARA connection, no clinical advice. Every flag is an *unreviewed suggestion*; judgment stays with human reviewers.

## Run it

1. Clone or download this repository.
2. Double-click **`index.html`**. It opens in Chrome or Edge. No install, account, or internet needed.
3. Pick a case (try **CASE-01**), click **Run checks**, and then **Export findings** to download the JSON.

**Tests** (optional, needs [Node.js](https://nodejs.org)):

```
npm test
```

This runs all 63 tests: MCRC's starter checks plus our own. To run only MCRC's checks: `node check_starter.js --exercise-goals --exercise-sources`.

## What it checks

| Check | Flags a reply when... | Example |
|---|---|---|
| **Goal alignment** | The person's goal is information, harm reduction, cut down, or undecided, but the reply pushes quitting. Negated sentences ("I will not ask you to quit") are left alone. | CASE-01, CASE-02, CASE-11, CASE-12 |
| **Source support** | A claim doesn't match the fictional source it cites: the source says "unknown", disagrees, lacks the field, or doesn't exist. | CASE-05, CASE-13 |
| **Repetition** (from MCRC's starter) | The assistant repeats an earlier reply word for word. | CASE-04 |

Each finding contains `check_id`, `turn_id`, `reason`, `evidence_quote` (exact text from the reply) and `status: "unreviewed_suggestion"`.

<!-- UPDATE AT CODE FREEZE: add confidence badges, summary bar, reviewer confirm/reject/unsure, goal timeline, expert agreement score -->

## Cases

10 fictional cases. Each has a good version (**A**) and a problematic version (**B**). MCRC provided CASE-01, 02, 04, 05, 07 and 09. We added:

| ID | Goal | Shows |
|---|---|---|
| CASE-11 | harm reduction | Pressure to quit vs. lowering-risk information |
| CASE-12 | cut down | Pressure flagged, plus one **known miss** (see Limitations) |
| CASE-13 | find treatment | One supported claim, one claim that conflicts with the source |
| CASE-14 | undecided | **Uncertain**: soft pressure with no keywords, zero flags, needs a human |

<!-- UPDATE: expert examples from the session with Tyler -->

## Results

- None of the good replies (Example A) are flagged.
- Every Example B mistake that a rule targets is flagged.
- 63 / 63 tests pass.
- Not covered yet: CASE-07 (claims a referral was saved), CASE-09 (readiness quoted from a friend), CASE-14 (soft pressure).

Sample exports and screenshots are in [`docs/exports`](docs/exports) and [`docs/screenshots`](docs/screenshots).

## Limitations

<!-- Fatima: replace or extend this section -->
- **Keyword rules miss soft pressure**, e.g. "the healthiest choice is a life without alcohol" (CASE-14).
- **A negation word hides pressure** in the same sentence: "You must quit drinking, not just cut down" is missed (CASE-12-B-A2).
- **False-positive risk:** reporting someone else's view ("your doctor said you should quit, but it's your choice") or answering a direct request for a quit plan may be flagged.
- Goals *stop*, *recovery support* and *find treatment* are not judged automatically.
- Source support only reads structured `claims`, not free text, and checks consistency with the record, not medical truth.
- An empty result is **not** a pass or a safety approval.

## File map

| File | What it is |
|---|---|
| `index.html`, `styles.css`, `app.js` | The page: shows cases, runs checks, highlights flags, exports JSON |
| `student_checks.js` | The checks |
| `data.js` | Fictional cases |
| `test_*.js`, `check_starter.js` | Automated tests |
| `docs/` | Project summary, About the project, submission answers, sample exports, screenshots, slides |
| `START_HERE.txt`, `TASKS.txt`, `REFERENCE.txt`, `SUBMISSION.txt` | MCRC's original instructions |

The `base-code` git tag is MCRC's starter kit exactly as provided. Everything after it was written during the natHacks 2026 weekend.

## Team and credits

**Team TrustyTalker:** Samia Rahman (team lead), Ghala Abdulfattah, Fatima Khalid, Mohammadhossein Naeiji

- Problem provider: Tyler Marshall, MCRC Health (JARA Mental Health & Addiction)
- Starter kit, data format and goal/readiness vocabulary: MCRC Health
- Event: natHacks 2026 (NeuroAlbertaTech)
- AI assistance: Claude (Anthropic) was used to help write code, tests and documentation. <!-- keep or edit per natHacks rules -->
- Related work we compared against: Promptfoo, HealthBench, VERA-MH

Ownership follows the natHacks 2026 rules and the team's IP agreement with MCRC Health.
