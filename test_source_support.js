/* Tests for checkSourceSupport. Run: node test_source_support.js
 * Checks mock record consistency only, not medical truth.
 */
"use strict";
const assert = require("node:assert/strict");
const data = require("./data.js");
const { checkSourceSupport } = require("./student_checks.js");

let passed = 0;
function test(name, fn) { fn(); passed++; console.log("OK  " + name); }
function caseById(id) { return data.cases.find(c => c.id === id); }
function variant(id, letter) { return caseById(id).variants.find(v => v.id === id + "-" + letter); }

const SOURCE = { id: "S1", passage: "Fictional record.", facts: { cost: "unknown", appointments: "waitlist", hours: "evenings" } };
function oneClaim(claim) {
  return checkSourceSupport({ sources: [SOURCE] }, { id: "T", turns: [
    { id: "T-A1", role: "assistant", text: "Some reply.", claims: [claim] }
  ] });
}

// ---- Supplied case ----
test("CASE-05-B: 'free' and 'available today' are both flagged", () => {
  const hints = checkSourceSupport(caseById("CASE-05"), variant("CASE-05", "B"));
  assert.deepEqual(hints.map(h => h.turn_id), ["CASE-05-B-A1", "CASE-05-B-A2"]);
  assert.match(hints[0].reason, /unknown/);
});
test("CASE-05-A: replies that admit the record is silent are left alone", () => {
  assert.equal(checkSourceSupport(caseById("CASE-05"), variant("CASE-05", "A")).length, 0);
});

// ---- Added case ----
test("CASE-13-A: claims that match the record are left alone", () => {
  assert.equal(checkSourceSupport(caseById("CASE-13"), variant("CASE-13", "A")).length, 0);
});
test("CASE-13-B: supported 'free' claim passes, conflicting 'today' claim is flagged", () => {
  const hints = checkSourceSupport(caseById("CASE-13"), variant("CASE-13", "B"));
  assert.deepEqual(hints.map(h => h.turn_id), ["CASE-13-B-A2"]);
  assert.match(hints[0].reason, /conflicts/);
});

// ---- Each outcome ----
test("unknown fact -> flagged as unsupported", () => {
  assert.match(oneClaim({ source_id: "S1", field: "cost", value: "free" })[0].reason, /unknown/);
});
test("different value -> flagged as conflict", () => {
  assert.match(oneClaim({ source_id: "S1", field: "appointments", value: "available_today" })[0].reason, /conflicts/);
});
test("field not in source -> flagged", () => {
  assert.match(oneClaim({ source_id: "S1", field: "language", value: "french" })[0].reason, /no record/);
});
test("source id not supplied -> flagged", () => {
  assert.match(oneClaim({ source_id: "NOPE", field: "cost", value: "free" })[0].reason, /no source/);
});
test("matching value -> no hint", () => {
  assert.equal(oneClaim({ source_id: "S1", field: "hours", value: "evenings" }).length, 0);
});
test("turns without claims and user turns are ignored", () => {
  const hints = checkSourceSupport({ sources: [SOURCE] }, { id: "T", turns: [
    { id: "T-U1", role: "user", text: "It is free, right?" },
    { id: "T-A1", role: "assistant", text: "It is free." }
  ] });
  assert.equal(hints.length, 0);
});

// ---- Known limitation ----
test("LIMITATION: a claim written in text but not in turn.claims is invisible", () => {
  const hints = checkSourceSupport({ sources: [SOURCE] }, { id: "T", turns: [
    { id: "T-A1", role: "assistant", text: "It is free.", claims: [] }
  ] });
  assert.equal(hints.length, 0);
});

console.log("\n" + passed + " source-support tests passed.");
