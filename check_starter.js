/* Optional terminal checks: node check_starter.js. No npm install required. */
"use strict";
const assert = require("node:assert/strict");
const data = require("./data.js");
const checks = require("./student_checks.js");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("OK  " + name); }
function scenario(id) { return data.cases.find(c => c.id === id); }
function variant(id, letter) { return scenario(id).variants.find(v => v.id === id + "-" + letter); }

test("The starter cases and any added cases have unique IDs", () => {
  assert.ok(data.cases.length >= 6, "Keep the six supplied cases when adding new ones.");
  assert.equal(new Set(data.cases.map(c => c.id)).size, data.cases.length);
  assert.equal(data.provenance, "authored_fiction_not_observed_jara");
});
test("All turn IDs are unique and replies are text", () => {
  const ids = [];
  for (const c of data.cases) for (const v of c.variants) for (const t of v.turns) {
    assert.ok(t.text.trim());
    assert.ok(["user", "assistant"].includes(t.role));
    ids.push(t.id);
  }
  assert.equal(new Set(ids).size, ids.length);
});
test("Worked example detects the repeated reply", () => {
  assert.equal(checks.checkRepeatedReply(scenario("CASE-04"), variant("CASE-04", "B")).length, 1);
});
test("Worked example leaves different replies alone", () => {
  assert.equal(checks.checkRepeatedReply(scenario("CASE-04"), variant("CASE-04", "A")).length, 0);
});
test("Every enabled check returns literal evidence from an assistant turn", () => {
  for (const c of data.cases) for (const v of c.variants) for (const h of checks.runChecks(c,v)) {
    const turn = v.turns.find(t => t.id === h.turn_id);
    assert.equal(turn.role, "assistant");
    assert.ok(turn.text.includes(h.evidence_quote));
    assert.equal(h.status, "unreviewed_suggestion");
  }
});
test("Structured claims point to available fictional sources", () => {
  for (const c of data.cases) for (const v of c.variants) for (const t of v.turns) for (const claim of t.claims || []) {
    assert.ok(c.sources.some(s => s.id === claim.source_id));
  }
});

if (process.argv.includes("--exercise-goals")) {
  test("Goal exercise flags direct pressure for information-only request", () => {
    assert.ok(checks.checkGoalAlignment(scenario("CASE-01"),variant("CASE-01","B")).length > 0,
      "Exercise is unfinished: implement checkGoalAlignment in student_checks.js.");
  });
  test("Goal exercise accepts the aligned example", () => {
    assert.equal(checks.checkGoalAlignment(scenario("CASE-01"),variant("CASE-01","A")).length, 0);
  });
  test("Goal exercise handles negated pressure", () => {
    const v = {id:"PRACTICE",turns:[{id:"PRACTICE-A1",role:"assistant",text:"I will not ask you to quit. We can stay with information."}]};
    assert.equal(checks.checkGoalAlignment(scenario("CASE-01"),v).length,0);
  });
}
if (process.argv.includes("--exercise-sources")) {
  test("Source exercise flags a claim absent from the mock record", () => {
    assert.ok(checks.checkSourceSupport(scenario("CASE-05"),variant("CASE-05","B")).length > 0,
      "Exercise is unfinished: implement checkSourceSupport in student_checks.js.");
  });
  test("Source exercise accepts the uncertain response", () => {
    assert.equal(checks.checkSourceSupport(scenario("CASE-05"),variant("CASE-05","A")).length,0);
  });
}
console.log("\n" + passed + " checks passed.");
if (!process.argv.some(a => a.startsWith("--exercise-"))) {
  console.log("Goal/source exercises are intentionally unfinished and were NOT tested by this command.");
}
