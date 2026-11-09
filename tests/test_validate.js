/* Validation tests: node tests/test_validate.js. No npm install required. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const data = require(path.join(__dirname, "..", "data.js"));
const V = require(path.join(__dirname, "..", "engine", "validate.js"));
const C = require(path.join(__dirname, "..", "student_checks.js"));
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("OK  " + name); }

const clone = (x) => JSON.parse(JSON.stringify(x));
function goodData() {
  return { cases: [{ id: "PRACTICE", goal: "information", readiness: "not_supplied",
    sources: [{ id: "SRC-1", passage: "Open weekday evenings.", facts: { hours: "weekday_evenings" } }],
    variants: [{ id: "PRACTICE-A", turns: [
      { id: "PRACTICE-A-U1", role: "user", text: "When is it open?" },
      { id: "PRACTICE-A-A1", role: "assistant", text: "It is open weekday evenings.", claims: [{ source_id: "SRC-1", field: "hours", value: "weekday_evenings" }] }
    ] }] }] };
}
function problemsIn(mutate) {
  const d = goodData();
  mutate(d);
  return V.validateCases(d).errors.map(e => e.problem).join(" | ");
}

// ---- Input validation
test("Every case in data.js passes validation", () => {
  const result = V.validateCases(data);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});
test("Vocabulary matches reference/support_choices.json", () => {
  const ref = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "reference", "support_choices.json"), "utf8"));
  assert.deepEqual([...V.GOALS].sort(), Object.keys(ref.goals).sort());
  assert.deepEqual([...V.STATED_READINESS].sort(), Object.keys(ref.stated_readiness).sort());
});
test("A correct practice case passes", () => {
  assert.equal(V.validateCases(goodData()).ok, true);
});
test("Duplicate case, variant and turn IDs are reported", () => {
  assert.match(problemsIn(d => d.cases.push(clone(d.cases[0]))), /PRACTICE.*more than once/);
  assert.match(problemsIn(d => { d.cases[0].variants[0].turns[1].id = "PRACTICE-A-U1"; }), /PRACTICE-A-U1.*more than once/);
});
test("Missing turn ID, bad role and empty text are reported", () => {
  assert.match(problemsIn(d => { delete d.cases[0].variants[0].turns[0].id; }), /Turn has no ID/);
  assert.match(problemsIn(d => { d.cases[0].variants[0].turns[0].role = "bot"; }), /role "bot"/);
  assert.match(problemsIn(d => { d.cases[0].variants[0].turns[0].text = " "; }), /no text/);
});
test("Goal and readiness outside support_choices.json are reported", () => {
  assert.match(problemsIn(d => { d.cases[0].goal = "quit_now"; }), /goal "quit_now"/);
  assert.match(problemsIn(d => { d.cases[0].readiness = "very_ready"; }), /readiness "very_ready"/);
  assert.match(problemsIn(d => { d.cases[0].variants[0].turns[0].state_update = { goal: "x" }; }), /state_update.goal "x"/);
});
test("A claim pointing at a missing source is reported", () => {
  assert.match(problemsIn(d => { d.cases[0].variants[0].turns[1].claims[0].source_id = "SRC-9"; }), /SRC-9.*not in this case's sources/);
});
test("Broken input never throws", () => {
  for (const bad of [null, {}, { cases: "no" }, { cases: [null] }, { cases: [{ id: "X", variants: [null] }] }]) {
    const result = V.validateCases(bad);
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
  }
});

// ---- Output validation
const variant = goodData().cases[0].variants[0];
const hint = (extra) => Object.assign({ check_id: "source_support", turn_id: "PRACTICE-A-A1", reason: "Why.",
  evidence_quote: "open weekday evenings", status: "unreviewed_suggestion", severity: "quality", fix_layer: "prompt", source: "ai_judge" }, extra);
test("A correct hint passes", () => {
  assert.deepEqual(V.validateHint(hint(), variant), { ok: true, reason: "", problems: [] });
});
test("Invented turn ID, user turn, invented quote and missing explanation fail with a reason", () => {
  assert.match(V.validateHint(hint({ turn_id: "PRACTICE-A-A9" }), variant).reason, /not a turn/);
  assert.match(V.validateHint(hint({ turn_id: "PRACTICE-A-U1" }), variant).reason, /user turn/);
  assert.match(V.validateHint(hint({ evidence_quote: "open every day" }), variant).reason, /not found word for word/);
  assert.match(V.validateHint(hint({ reason: "" }), variant).reason, /no explanation/);
  assert.match(V.validateHint(hint({ severity: "high" }), variant).reason, /severity/);
  assert.equal(V.validateHint(null, variant).ok, false);
});
test("Every rule hint on data.js passes validateHint", () => {
  for (const scenario of data.cases) for (const v of scenario.variants) {
    for (const h of C.runChecks(scenario, v)) {
      const result = V.validateHint(h, v);
      assert.ok(result.ok, h.turn_id + " " + h.check_id + ": " + result.reason);
    }
  }
});
test("The AI judge picks up validate.js and sends an invented quote to needs review", () => {
  const judge = require(path.join(__dirname, "..", "judge", "run_judge.js"));
  const finding = { turn_id: "PRACTICE-A-A1", check: "source_support", quote: "open every day", explanation: "Wrong hours.", severity: "quality", fix_layer: "retrieval" };
  const { hint: h } = judge.validateJudgeFinding(finding, variant, new Set(["source_support"]), V);
  assert.equal(h.confidence, "needs_review");
  assert.match(h.reason, /Needs review/);
});

// ---- Page path: a minimal stand-in document (no browser needed)
function pageWith(dataForPage) {
  const made = [];
  const node = (tag) => {
    const n = { tag, id: "", className: "", textContent: "", children: [], attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; }, append(...c) { this.children.push(...c); }, remove() { this.removed = true; } };
    made.push(n);
    return n;
  };
  const main = node("main");
  main.prepend = (c) => main.children.unshift(c);
  const fakeRoot = { JARAData: dataForPage };
  const document = { readyState: "complete", body: main, addEventListener() {},
    getElementById: (id) => id === "main-content" ? main : null, createElement: node };
  const source = fs.readFileSync(path.join(__dirname, "..", "engine", "validate.js"), "utf8");
  new Function("globalThis", "document", "module", "console", source)(fakeRoot, document, undefined, { warn() {}, error() {} });
  return { main, api: fakeRoot.JARAValidate };
}
test("Page: problems are listed at the top of <main> as an alert", () => {
  const bad = goodData();
  bad.cases[0].goal = "quit_now";
  const { main, api } = pageWith(bad);
  const box = main.children[0];
  assert.equal(box.id, "validation-problems");
  assert.equal(box.attrs.role, "alert");
  assert.match(box.children[1].children[0].textContent, /PRACTICE: goal "quit_now"/);
  assert.equal(api.lastResult.ok, false);
});
test("Page: valid data adds nothing to the page", () => {
  const { main, api } = pageWith(goodData());
  assert.equal(main.children.length, 0);
  assert.equal(api.lastResult.ok, true);
});

console.log("\n" + passed + " validation tests passed.");
