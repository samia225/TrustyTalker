# Held-out cases (final scoring only)

Nothing here yet. Until this folder has labelled cases, the report says
**"Held-out result: not run"**. The extra AI-drafted cases (`cases_extra.js`,
CASE-AI-01 to 07) are the closest untuned check, because rules were not changed
to fit them. They are still development numbers.

## Rules
- **Who writes them:** someone who does not write or change checks.
- **When to label:** write the labels BEFORE running any check on the cases.
- **Who must not look:** anyone changing rules must not open these files. Do not
  tune rules against them, even after you see a miss. Record the miss as a known
  limitation instead.
- **What data:** fictional only. Mark AI-drafted cases `origin: "ai_drafted"`, and
  have a teammate review and label each one.
- **How to keep them hidden:** the page and the AI judge never load this folder.
  `judge/test_run_judge.js` checks that the judge prompt contains no held-out data.

## Format
One or more `.js` files, each exporting the cases and their labels:

```js
module.exports = {
  cases:  [ /* same shape as a case in data.js, with unique IDs such as "HO-01" */ ],
  labels: [ /* same shape as tests/expected.js: { variant_id, flags: [{ turn_id, check_id, severity, why }] } */ ]
};
```

## Run
```
node scoring/score_report.js
```
Held-out cases are checked with `engine/validate.js` first and scored as their own set
("Held-out cases (tests/heldout/, final scoring only)"). Problems with a file are
listed in the report instead of stopping it.
