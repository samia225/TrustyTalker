/* State tracker tests: node tests/test_state_tracker.js. No npm install required. */
"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const data = require(path.join(__dirname, "..", "data.js"));
const S = require(path.join(__dirname, "..", "state_tracker.js"));
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("OK  " + name); }

// A one-turn practice conversation; readiness starts at ready_for_step from case setup.
function readinessAfter(text) {
  const scenario = { id: "PRACTICE", goal: "information", readiness: "ready_for_step" };
  const variant = { id: "PRACTICE-A", turns: [{ id: "PRACTICE-U1", role: "user", text: text }] };
  return S.trackState(scenario, variant)[0].readiness;
}

test("CASE-01: 'I have not decided to change my drinking' sets readiness to exploring", () => {
  const scenario = data.cases.find(c => c.id === "CASE-01");
  for (const variant of scenario.variants) {
    const readiness = S.trackState(scenario, variant)[0].readiness;
    assert.equal(readiness.value, "exploring", variant.id);
    assert.equal(readiness.origin, "user_text");
    assert.equal(readiness.evidence_turn_id, variant.id + "-U1");
    assert.ok(variant.turns[0].text.includes(readiness.quote), "quote is literal text from the turn");
  }
});

test("Undecided phrasings set readiness to exploring", () => {
  for (const text of ["I haven't decided whether to cut down.", "I have not yet decided anything.",
    "I'm not sure I want to change.", "I am still not sure if I want to quit.", "I don't know if I want to stop."]) {
    assert.equal(readinessAfter(text).value, "exploring", text);
  }
});

test("Near-misses keep the case setup readiness", () => {
  for (const text of ["I have decided to try a small step.", "My partner has not decided yet.",
    "I only want information."]) {
    assert.equal(readinessAfter(text).value, "ready_for_step", text);
  }
});

test("Quoted speech guard: someone else's 'I have not decided' does not change readiness", () => {
  for (const text of ['My friend said, "I have not decided to change."', "My friend said I'm not sure I want to change."]) {
    const scenario = { id: "PRACTICE", goal: "information", readiness: "ready_for_step" };
    const variant = { id: "PRACTICE-A", turns: [{ id: "PRACTICE-U1", role: "user", text: text }] };
    const snapshot = S.trackState(scenario, variant)[0];
    assert.equal(snapshot.readiness.value, "ready_for_step", text);
    assert.ok(snapshot.uncertain.length > 0, "the ignored statement is recorded as uncertain: " + text);
  }
});

test("Newest statement wins: a later 'I am ready to try a small step' replaces exploring", () => {
  const scenario = { id: "PRACTICE", goal: "information", readiness: "not_supplied" };
  const variant = { id: "PRACTICE-A", turns: [
    { id: "PRACTICE-U1", role: "user", text: "I have not decided to change." },
    { id: "PRACTICE-U2", role: "user", text: "Actually, I am ready to try a small step." }] };
  const states = S.trackState(scenario, variant);
  assert.equal(states[0].readiness.value, "exploring");
  assert.equal(states[1].readiness.value, "ready_for_step");
});

test("An authored state_update still beats the inferred readiness", () => {
  const scenario = { id: "PRACTICE", goal: "information", readiness: "ready_for_step" };
  const variant = { id: "PRACTICE-A", turns: [{ id: "PRACTICE-U1", role: "user",
    text: "I have not decided to change.", state_update: { readiness: "not_ready" } }] };
  assert.equal(S.trackState(scenario, variant)[0].readiness.value, "not_ready");
});

console.log("\n" + passed + " state tracker tests passed.");
