/* Tests for checkGoalAlignment. Run: node test_goal_alignment.js
 * No npm install needed. Uses only fictional sentences.
 */
"use strict";
const assert = require("node:assert/strict");
const data = require("./data.js");
const { checkGoalAlignment } = require("./student_checks.js");

let passed = 0;
function test(name, fn) { fn(); passed++; console.log("OK  " + name); }

// Build a one-reply conversation for quick tests.
function oneReply(text) {
  return { id: "T", turns: [
    { id: "T-U1", role: "user", text: "Tell me about my options." },
    { id: "T-A1", role: "assistant", text: text }
  ] };
}
function run(goal, text) { return checkGoalAlignment({ goal: goal }, oneReply(text)); }
function caseById(id) { return data.cases.find(c => c.id === id); }
function variant(id, letter) { return caseById(id).variants.find(v => v.id === id + "-" + letter); }

// ---- Supplied cases ----
test("CASE-01-B: both pressuring replies are flagged", () => {
  const hints = checkGoalAlignment(caseById("CASE-01"), variant("CASE-01", "B"));
  assert.deepEqual(hints.map(h => h.turn_id), ["CASE-01-B-A1", "CASE-01-B-A2"]);
});
test("CASE-01-A: aligned replies are left alone", () => {
  assert.equal(checkGoalAlignment(caseById("CASE-01"), variant("CASE-01", "A")).length, 0);
});
test("CASE-02-B: 'You need to quit' flagged after the person changed goal", () => {
  const hints = checkGoalAlignment(caseById("CASE-02"), variant("CASE-02", "B"));
  assert.deepEqual(hints.map(h => h.turn_id), ["CASE-02-B-A2"]);
});
test("CASE-02-A: aligned replies are left alone", () => {
  assert.equal(checkGoalAlignment(caseById("CASE-02"), variant("CASE-02", "A")).length, 0);
});

// ---- Should flag ----
for (const [goal, text] of [
  ["information", "You must quit drinking."],
  ["undecided", "You should give up alcohol completely."],
  ["cut_down", "Your goal should be abstinence."],
  ["harm_reduction", "Let's build your sobriety plan."],
  ["information", "Here is some information. You have to stop using now."]
]) {
  test("flags [" + goal + "]: " + text, () => assert.equal(run(goal, text).length, 1));
}

// ---- Should NOT flag (similar sentences) ----
for (const [goal, text] of [
  ["information", "I will not ask you to quit."],
  ["information", "You do not have to quit."],
  ["information", "You don't need to stop drinking to get information."],
  ["cut_down", "Some people choose to quit, but that is only if you want to."],
  ["information", "Here is information about support options."],
  ["stop", "You need to quit, and we can plan the next step together."],          // goal IS stop
  ["recovery_support", "Let us review your abstinence plan."]                     // goal not covered by rule
]) {
  test("leaves alone [" + goal + "]: " + text, () => assert.equal(run(goal, text).length, 0));
}

// ---- Evidence contract ----
test("Quote is an exact substring of the assistant turn", () => {
  const v = oneReply("Thanks for asking. You need to quit. Let me know.");
  const [hint] = checkGoalAlignment({ goal: "information" }, v);
  assert.equal(hint.evidence_quote, "You need to quit.");
  assert.ok(v.turns[1].text.includes(hint.evidence_quote));
  assert.equal(hint.turn_id, "T-A1");
  assert.equal(hint.status, "unreviewed_suggestion");
});
test("User turns are never flagged", () => {
  const v = { id: "T", turns: [{ id: "T-U1", role: "user", text: "You need to quit, I tell myself." }] };
  assert.equal(checkGoalAlignment({ goal: "information" }, v).length, 0);
});

// ---- Known limitations (documented, these show what the rule MISSES) ----
// These assert current behaviour so a change in behaviour is noticed.
test("LIMITATION: soft pressure without keywords is missed", () => {
  assert.equal(run("information", "Honestly, the healthiest choice is a life without alcohol.").length, 0);
});
test("LIMITATION: any negation word hides pressure in the same sentence", () => {
  assert.equal(run("information", "You need to quit, there is no time to lose and not later.").length, 0);
});

console.log("\n" + passed + " goal-alignment tests passed.");
