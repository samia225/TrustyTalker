/* Regression runner: node tests/run_regression.js. No npm install required.
 * Reruns every case in regression_cases.js plus any reviewer export dropped into
 * tests/regressions/*.json (schema trustytalker-regression-1). For each case it checks
 * that the check flags (or does not flag) the turn, with the expected severity when one
 * is given, and that the similar example raises nothing. Exits with code 1 on a failure.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const C = require(path.join(ROOT, "student_checks.js"));

function loadCases() {
  const list = require(path.join(ROOT, "regression_cases.js")).map(c => ({ file: "regression_cases.js", c }));
  const dir = path.join(__dirname, "regressions");
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir).filter(n => n.endsWith(".json")).sort()) {
      try { list.push({ file: "tests/regressions/" + name, c: JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) }); }
      catch (error) { list.push({ file: "tests/regressions/" + name, error: "not valid JSON: " + error.message }); }
    }
  }
  return list;
}

function scenarioFor(c) {
  const setup = c.setup || {};
  return { id: (c.source && c.source.case_id) || "REGRESSION", goal: setup.goal, readiness: setup.readiness,
    sources: setup.sources || [], application_state_observations: setup.application_state_observations || [] };
}

function runOne(c) {
  const problems = [];
  if (c.schema_version !== "trustytalker-regression-1") return ["schema_version is not trustytalker-regression-1"];
  const exp = c.expected_behavior || {};
  if (!C.checks.some(k => k.id === exp.check_id)) return ["unknown check " + JSON.stringify(exp.check_id)];
  const scenario = scenarioFor(c);
  const variant = { id: (c.source && c.source.variant_id) || "REGRESSION-V", turns: c.original_turns || [] };
  const hits = C.runChecks(scenario, variant).filter(h => h.check_id === exp.check_id && h.turn_id === exp.turn_id);
  if (exp.should_flag && !hits.length) problems.push(exp.check_id + " no longer flags " + exp.turn_id);
  if (!exp.should_flag && hits.length) problems.push(exp.check_id + " now flags " + exp.turn_id + " again: " + hits[0].reason);
  const severity = exp.severity || (exp.should_flag ? c.severity : null);
  if (exp.should_flag && hits.length && severity && hits[0].severity !== severity) {
    problems.push("severity is " + hits[0].severity + ", expected " + severity);
  }
  const similar = c.similar_case_should_pass;
  if (similar && Array.isArray(similar.turns)) {
    const extra = C.runChecks(scenario, { id: similar.variant_id || "SIMILAR", turns: similar.turns }).filter(h => h.check_id === exp.check_id);
    if (extra.length) problems.push("similar example " + similar.variant_id + " is now flagged at " + extra.map(h => h.turn_id).join(", "));
  }
  return problems;
}

let failed = 0;
const cases = loadCases();
for (const { file, c, error } of cases) {
  const problems = error ? [error] : runOne(c);
  const name = (c && c.regression_id) || file;
  if (problems.length) { failed++; console.log("FAIL " + name + " (" + file + "): " + problems.join("; ")); }
  else console.log("OK   " + name + (c.why ? " - " + c.why : ""));
}
console.log("\n" + (cases.length - failed) + " of " + cases.length + " regression cases passed.");
if (failed) process.exitCode = 1;
