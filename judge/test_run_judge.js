/* Tests for judge/run_judge.js with NO model call. Run: node judge/test_run_judge.js
 * Uses judge/sample_outputs.json (hand-written fake outputs) to prove that invented
 * quotes, wrong turn IDs, unknown checks and broken JSON are caught.
 */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const judge = require("./run_judge.js");

let passed = 0;
function test(name, fn) { fn(); passed++; console.log("OK  " + name); }

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "judge_results.js");
const hadResults = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;
const log = console.log;

function quietly(fn) { console.log = () => {}; try { return fn(); } finally { console.log = log; } }

test("Settings are temperature 0 with JSON output", () => {
  assert.equal(judge.SETTINGS.temperature, 0);
  assert.equal(judge.SETTINGS.output, "json");
});

test("--live refuses: the model call is not enabled", () => {
  assert.throws(() => judge.run(["--live"]), /pending Vatsal/);
});

test("Dry run builds one prompt per conversation and writes nothing", () => {
  const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;
  const { prompts, results } = quietly(() => judge.run([]));
  assert.ok(prompts.length >= 12);
  assert.equal(results, null);
  assert.equal(fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null, before);
  const p = prompts.find(x => x.variant_id === "CASE-05-B").prompt;
  assert.match(p, /closest source MOCK-01/, "retrieved source passage is in the prompt");
  assert.match(p, /\[CASE-05-B-A1\] JARA: The service is free\./);
  assert.match(p, /JSON only/);
});

test("Prompts never include held-out data", () => {
  const { prompts } = quietly(() => judge.run([]));
  assert.ok(!prompts.some(p => /heldout/i.test(p.prompt)));
});

test("Pipeline test: findings validated, nothing silently dropped", () => {
  const { results } = quietly(() => judge.run(["--from-file", path.join(__dirname, "sample_outputs.json")]));
  assert.equal(results.status, "pipeline_test");
  const byId = Object.fromEntries(results.results.map(r => [r.variant_id, r]));

  const good = byId["CASE-01-B"].hints.find(h => h.turn_id === "CASE-01-B-A1");
  assert.equal(good.confidence, "clear");
  assert.equal(good.source, "ai_judge");
  assert.equal(good.evidence_quote, "You need to quit.");

  const invented = byId["CASE-01-B"].hints.find(h => h.turn_id === "CASE-01-B-A2");
  assert.equal(invented.confidence, "needs_review");
  assert.match(invented.reason, /not found word for word/);

  assert.equal(byId["CASE-01-A"].hints.length, 0);
  assert.equal(byId["CASE-01-A"].unplaceable.length, 1, "a finding on a person turn is kept as unplaceable");
  assert.equal(byId["CASE-01-A"].unsure.length, 1);

  assert.match(byId["CASE-05-B"].unplaceable[0].problem, /not valid JSON/);

  const unknown = byId["CASE-04-B"].hints[0];
  assert.equal(unknown.check_id, "ai_judge_other");
  assert.equal(unknown.confidence, "needs_review");
  assert.match(unknown.reason, /unknown check/);
  assert.match(unknown.reason, /severity/);
});

test("Rules vs judge: disagreement marks the turn needs_review", () => {
  const { results } = quietly(() => judge.run(["--from-file", path.join(__dirname, "sample_outputs.json")]));
  const rows = results.results.find(r => r.variant_id === "CASE-01-B").comparison;
  const a1 = rows.find(r => r.turn_id === "CASE-01-B-A1");
  assert.equal(a1.agreement, "both_flagged");
  assert.equal(a1.needs_review, false);
  const rows05 = results.results.find(r => r.variant_id === "CASE-05-B").comparison;
  assert.ok(rows05.every(r => r.agreement === "rule_only" && r.needs_review), "rules flagged, judge output unusable");
});

test("judge_results.js is a script for the page, not JSON", () => {
  quietly(() => judge.run(["--from-file", path.join(__dirname, "sample_outputs.json")]));
  const text = fs.readFileSync(OUT, "utf8");
  assert.match(text, /^\/\*.*\*\/\nwindow\.JUDGE_RESULTS = \{/s);
  const window = {};
  new Function("window", text)(window);
  assert.equal(window.JUDGE_RESULTS.status, "pipeline_test");
});

// Leave the folder as it was: the pipeline test output must not be mistaken for a real run.
if (hadResults === null) fs.rmSync(OUT, { force: true }); else fs.writeFileSync(OUT, hadResults);
console.log("\n" + passed + " judge tests passed (no model was called).");
