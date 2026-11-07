# About the Project (max 600 words)

> Draft. Lines marked [TEAM] need a real detail from one of us. Delete this note before submitting.

## Inspiration

Many people who use a substance-use support tool never chose to quit. They may want information, want to cut down, or be unsure. A chatbot that answers every message with "you need to quit" isn't neutral: it can push people away from support they came looking for. MCRC Health wants to catch these problems before testing JARA with real participants. We liked that the question wasn't "build a better chatbot" but "how do you know when a chatbot is wrong, and can you prove it?" As students, we know how fast someone stops listening when they feel judged, and we wanted to help JARA meet people where they are instead of where a script expects them to be.

## What we learned

- **Explainable beats clever.** A score for a whole conversation doesn't help a developer fix anything. The JARA team needs to point to the exact reply that failed and say why. So every finding carries the turn ID and the literal quoted words.
- **"No flags" is not "safe."** An empty result only means our rules found nothing. We built uncertain cases on purpose, like soft pressure with no keywords, so reviewers never read silence as approval.
- **Negation is hard.** "I will not ask you to quit" and "You need to quit" share most of their words. Handling that taught us how quickly keyword rules break, and why judgment calls belong with a human reviewer.
- **Readiness to change and motivational interviewing**: why meeting people where they are matters more than steering them to one outcome. [TEAM: anything specific from research or Tyler's session.]

## How we built it

Through three Development Reports we defined five success criteria (extensibility, explainability, reproducibility, reliability, privacy), scored five ideas against them, and chose an integrated evaluation platform (49 of 55).

We built on MCRC's offline starter kit in plain JavaScript and HTML: no installs, accounts, or internet. We had planned React, but stayed with MCRC's format so their team can keep extending it.

- `student_checks.js` holds the rules: goal alignment, source support, and repetition.
- `data.js` holds fictional conversations, each with a good version (A) and a problematic version (B). We added four cases, including one with a known failure and one uncertain case. [UPDATE: expert examples from the session with Tyler.]
- The interface shows both conversations side by side, highlights flagged replies, and exports JSON. [UPDATE AT CODE FREEZE: confidence badges, summary bar, reviewer confirm / reject / unsure buttons, goal timeline, expert agreement score.]
- 63 automated Node.js tests cover flags, non-flags, and documented limitations. Each of us owned separate files and branches to avoid conflicts.

## Challenges

- **No live JARA access.** We could only use fictional, authored conversations, so we designed every check to work on a simple, documented data format a future adapter could fill in.
- **False positives vs. false negatives.** Skipping any sentence with "not" protects "I will not ask you to quit", but it also hides "You must quit drinking, not just cut down." We kept that miss in our data (CASE-12) instead of hiding it.
- **Knowing where rules should stop.** For goals like recovery support, talk of abstinence can be appropriate, so we chose not to judge them automatically.
- **Teamwork under time pressure.** [TEAM: e.g. merge conflicts, scheduling around Tyler's session, line-ending issues between Windows machines.]

## What's next

Checks for saved-state claims, quoted readiness, and changed preferences, plus an adapter for JARA test transcripts so cases can be re-run after every update.
