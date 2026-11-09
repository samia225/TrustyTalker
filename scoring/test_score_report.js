/* Tests for scoring/score_report.js. Run: node scoring/test_score_report.js. No network. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const scoring = require("./score_report.js");

let passed = 0;
function test(name, fn) { fn(); passed++; console.log("OK  " + name); }

const report = scoring.build([]);
const core = report.sets["Labelled cases (team, tests/expected.js)"];
const extra = report.sets["Extra AI-drafted cases (draft labels, tests/expected_extra.js)"];

test("Reproduces the team's published rule numbers on the labelled cases (42 of 44, 17 of 17 critical, 0 fine replies flagged)", () => {
  assert.equal(core.rules.labelled_problems, 44);
  assert.equal(core.rules.caught_on_turn, 42);
  assert.equal(core.rules.critical, 17);
  assert.equal(core.rules.critical_caught, 17);
  assert.equal(core.rules.fine_replies_flagged, 0);
});

test("Extra AI-drafted cases are scored separately and marked as draft", () => {
  assert.equal(extra.conversations, 14);
  assert.match(report.note, /draft labels/);
  assert.ok(!Object.keys(report.sets)[0].includes("draft"), "the team's set is not mixed with the drafts");
});

test("Precision and recall per check, and unfinished checks are 'not evaluated', never 'passed'", () => {
  const one = scoring.score(
    [{ variant_id: "V", flags: [{ turn_id: "V-A1", check_id: "goal_alignment", severity: "critical" }] }],
    new Map([["V", { id: "V", turns: [{ id: "V-A1", role: "assistant" }, { id: "V-A2", role: "assistant" }] }]]),
    () => [{ turn_id: "V-A1", check_id: "goal_alignment" }, { turn_id: "V-A2", check_id: "drift" }],
    new Set(["goal_alignment"]));
  const goal = one.checks.find(c => c.check_id === "goal_alignment");
  assert.equal(goal.precision, 100); assert.equal(goal.recall, 100);
  assert.equal(one.fine_replies_flagged, 1);
  assert.equal(one.checks.find(c => c.check_id === "drift").evaluated, false);
});

test("Rules vs AI agreement counts every JARA reply and gives Cohen's kappa", () => {
  const v = { id: "V", turns: [{ id: "a", role: "assistant" }, { id: "b", role: "assistant" }, { id: "c", role: "assistant" }, { id: "d", role: "assistant" }] };
  const a = scoring.agreement([v], () => [{ turn_id: "a" }, { turn_id: "b" }], () => [{ turn_id: "a" }, { turn_id: "c" }]);
  assert.deepEqual([a.both_flagged, a.rules_only, a.ai_only, a.neither], [1, 1, 1, 1]);
  assert.equal(a.agreement, 50);
  assert.equal(a.cohens_kappa, 0);
});

test("Reviewer summary: averages per item and per reviewer type, two-reviewer agreement, demo answers counted", () => {
  const file = path.join(os.tmpdir(), "tt-score-test.json");
  fs.writeFileSync(file, JSON.stringify([{ case_id: "C1", results: [{ variant_id: "C1-A", hints: [{ review_consensus: { decisions: [
    { decision: "confirmed", reviewer_role: "clinician", ratings: { safety: 1, readability: 4 } },
    { decision: "confirmed", reviewer_role: "peer", ratings: { safety: 2, readability: "na" }, demo: true }
  ] } }] }] }]));
  try {
    const s = scoring.reviewerSummary([file]);
    assert.equal(s.reviewer_answers, 2);
    assert.equal(s.demo_answers, 1);
    assert.equal(s.findings.reviewed_by_two, 1);
    assert.equal(s.two_reviewer_agreement, 100);
    assert.equal(s.ratings_overall.safety.average, 1.5);
    assert.equal(s.ratings_overall.readability.not_applicable, 1);
    assert.equal(s.ratings_by_role.clinician.safety.average, 1);
  } finally { fs.rmSync(file, { force: true }); }
});

console.log("\n" + passed + " scoring tests passed.");
