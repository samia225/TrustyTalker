/* Expected results for every case, using ALL enabled checks.
 * Run: node test_new_cases.js
 * If a rule changes, this file shows exactly which finding appeared or disappeared.
 */
"use strict";
const assert = require("node:assert/strict");
const data = require("./data.js");
const checks = require("./student_checks.js");

let passed = 0;
function test(name, fn) { fn(); passed++; console.log("OK  " + name); }

// variant id -> list of "check_id@turn_id" we expect. Empty list = no suggestions.
const EXPECTED = {
  "CASE-04-A": [], "CASE-04-B": ["repetition@CASE-04-B-A2"],
  "CASE-01-A": [], "CASE-01-B": ["goal_alignment@CASE-01-B-A1", "goal_alignment@CASE-01-B-A2"],
  "CASE-05-A": [], "CASE-05-B": ["source_support@CASE-05-B-A1", "source_support@CASE-05-B-A2"],
  "CASE-07-A": [], "CASE-07-B": [],   // no check for saved-state claims yet
  "CASE-09-A": [], "CASE-09-B": [],   // no check for quoted readiness yet
  "CASE-02-A": [], "CASE-02-B": ["goal_alignment@CASE-02-B-A2"],
  // Added by TrustyTalker
  "CASE-11-A": [], "CASE-11-B": ["goal_alignment@CASE-11-B-A1", "goal_alignment@CASE-11-B-A2"],
  "CASE-12-A": [], "CASE-12-B": ["goal_alignment@CASE-12-B-A1"],   // B-A2 is a known miss ("not")
  "CASE-13-A": [], "CASE-13-B": ["source_support@CASE-13-B-A2"],
  "CASE-14-A": [], "CASE-14-B": []    // uncertain: soft pressure, needs human review
};

test("At least three cases were added with unique IDs", () => {
  const added = data.cases.filter(c => ["CASE-11", "CASE-12", "CASE-13", "CASE-14"].includes(c.id));
  assert.equal(added.length, 4);
  assert.equal(new Set(data.cases.map(c => c.id)).size, data.cases.length);
});

for (const c of data.cases) for (const v of c.variants) {
  test(v.id + " -> " + (EXPECTED[v.id].length ? EXPECTED[v.id].join(", ") : "no suggestions"), () => {
    const got = checks.runChecks(c, v).map(h => h.check_id + "@" + h.turn_id);
    assert.deepEqual(got, EXPECTED[v.id]);
  });
}

console.log("\n" + passed + " case tests passed.");
