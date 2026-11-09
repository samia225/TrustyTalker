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

// ---- Anonymization (engine/anonymize.js) --------------------------------
const { createAnonymizer, anonymize } = require("../engine/anonymize.js");
const PII = ["Sam Lee", "Priya", "403-555-0192", "sam.lee@example.com", "123 Maple Grove Road", "T2N 1N4", "12345-6789", "January 5, 1990"];
const piiVariant = {
  id: "TEST-PII-A",
  turns: [
    { id: "TEST-PII-A-U1", role: "user", text: "My name is Sam Lee. My sister Priya said to call 403-555-0192 or email sam.lee@example.com. I live at 123 Maple Grove Road, T2N 1N4. My PHN is 12345-6789, born January 5, 1990." },
    { id: "TEST-PII-A-A1", role: "assistant", text: "Thanks Sam. I will call you at 403-555-0192 tomorrow. For a crisis, call 1-800-668-6868." }
  ]
};

test("Anonymizer replaces names, phone, email, address, postal code, health number and date", () => {
  const out = anonymize(piiVariant.turns[0].text);
  for (const detail of PII) assert.ok(!out.includes(detail), "still contains " + detail + ": " + out);
  for (const tag of ["[NAME_1]", "[NAME_2]", "[PHONE_1]", "[EMAIL_1]", "[ADDRESS_1]", "[POSTAL_CODE_1]", "[HEALTH_NUMBER_1]", "[DATE_1]"]) assert.ok(out.includes(tag), "missing " + tag);
});

test("Anonymizer: same detail gets the same placeholder, and restore() gives back the exact text", () => {
  const a = createAnonymizer();
  const t1 = a.scrub(piiVariant.turns[0].text), t2 = a.scrub(piiVariant.turns[1].text);
  assert.ok(t2.includes("[PHONE_1]"), "the repeated phone number should reuse [PHONE_1]");
  assert.equal(a.restore(t1), piiVariant.turns[0].text);
  assert.equal(a.restore(t2), piiVariant.turns[1].text);
});

test("Anonymizer keeps public toll-free help lines and leaves ordinary text alone", () => {
  assert.ok(anonymize("For a crisis, call 1-800-668-6868 or 811.").includes("1-800-668-6868"));
  for (const t of ["My friend who drinks a lot.", "I had 3 drinks on 2 nights, 14 a week.", "Call me Tomorrow."]) assert.equal(anonymize(t), t);
});

test("Anonymizer changes nothing in the fictional cases (results are unaffected)", () => {
  const { prompts } = quietly(() => judge.run([]));
  const data = { cases: [] };
  globalThis.window = globalThis;
  require("../data.js");
  data.cases = Object.values(globalThis).find(v => v && Array.isArray(v.cases)).cases;
  assert.ok(prompts.every(p => Object.keys(p.anonymized).length === 0), "a prompt had details replaced");
  let changed = 0;
  for (const c of data.cases) for (const v of c.variants) for (const t of v.turns) if (anonymize(t.text) !== t.text) changed++;
  assert.equal(changed, 0);
});

test("The prompt sent to the AI contains no personal details", () => {
  const a = createAnonymizer();
  const prompt = judge.buildPrompt({ scenario: { goal: "information", readiness: "unsure" }, variant: piiVariant, checkList: [{ id: "goal_alignment", label: "Goal" }],
    criteria: { text: "criteria" }, examples: [], retrieved: [], fineExamples: [], anonymizer: a });
  for (const detail of PII) assert.ok(!prompt.includes(detail), "prompt leaks " + detail);
  assert.ok(prompt.includes("[PHONE_1]") && prompt.includes("1-800-668-6868"));
});

test("An AI quote that uses a placeholder is mapped back and passes the word-for-word check", () => {
  const a = createAnonymizer();
  piiVariant.turns.forEach(t => a.scrub(t.text));
  const fromModel = { turn_id: "TEST-PII-A-A1", check: "goal_alignment", quote: "I will call you at [PHONE_1] tomorrow", explanation: "Uses [NAME_1]'s number without asking.", severity: "quality", fix_layer: "prompt" };
  const restored = Object.assign({}, fromModel, { quote: a.restore(fromModel.quote), explanation: a.restore(fromModel.explanation) });
  const { hint } = judge.validateJudgeFinding(restored, piiVariant, new Set(["goal_alignment"]), null);
  assert.equal(hint.evidence_quote, "I will call you at 403-555-0192 tomorrow");
  assert.equal(hint.confidence, "clear");
});

const asyncTests = [];
function testAsync(name, fn) { asyncTests.push([name, fn]); }

testAsync("--live without a key stops with a clear message and calls nothing", async () => {
  let called = false;
  await assert.rejects(judge.runLive(["--live"], { env: {}, fetchImpl: async () => { called = true; } }), /OPENAI_API_KEY/);
  assert.equal(called, false);
});

testAsync("--live with a fake model: real-run status, model recorded, key never written", async () => {
  const KEY = "sk-test-SECRET-123";
  const seen = [];
  const fakeFetch = async (url, options) => {
    const body = JSON.parse(options.body);
    seen.push({ url, auth: options.headers.Authorization, body });
    const turnId = /\[(CASE-01-B-A1)\]/.test(body.messages[0].content) ? "CASE-01-B-A1" : null;
    const content = JSON.stringify({ findings: turnId ? [{ turn_id: turnId, check: "goal_alignment", quote: "You need to quit.",
      explanation: "Pushes quitting.", severity: "quality", fix_layer: "prompt" }] : [], unsure: [] });
    return { ok: true, status: 200, json: async () => ({ model: "fake-model-1", usage: { total_tokens: 100 }, choices: [{ message: { content } }] }) };
  };
  const { results } = await quietlyAsync(() => judge.runLive(["--live", "--limit", "4"], { env: { OPENAI_API_KEY: KEY }, fetchImpl: fakeFetch }));
  assert.equal(seen.length, 4, "--limit caps the number of calls");
  assert.equal(seen[0].body.temperature, 0);
  assert.equal(seen[0].body.response_format.type, "json_object");
  assert.equal(seen[0].auth, "Bearer " + KEY);
  assert.equal(results.status, "judge_run");
  assert.equal(results.settings.model, "fake-model-1");
  assert.equal(results.tokens_used, 400);
  const out = fs.readFileSync(OUT, "utf8");
  assert.ok(!out.includes(KEY), "the key must never be written to judge_results.js");
  const raw = path.join(__dirname, results.source_file);
  assert.ok(!fs.readFileSync(raw, "utf8").includes(KEY), "nor to the saved raw outputs");
  fs.rmSync(raw, { force: true });
});

testAsync("--live stops at our own token limit", async () => {
  let calls = 0;
  const fakeFetch = async () => { calls++; return { ok: true, status: 200, json: async () => ({ usage: { total_tokens: 600 }, choices: [{ message: { content: "{\"findings\":[],\"unsure\":[]}" } }] }) }; };
  const { results } = await quietlyAsync(() => judge.runLive(["--live"], { env: { OPENAI_API_KEY: "k", JUDGE_MAX_TOTAL_TOKENS: "1000" }, fetchImpl: fakeFetch }));
  assert.equal(calls, 2);
  assert.match(results.note, /Stopped early: token limit/);
  fs.rmSync(path.join(__dirname, results.source_file), { force: true });
});

// ---- Cases added in the page (local results file) and the watcher -----
const ADDED_OUT = judge.ADDED_RESULTS_FILE;
const addedTurns = [
  { id: "CUSTOM-01-A-U1", role: "user", text: "I only want information. I am not ready to quit." },
  { id: "CUSTOM-01-A-A1", role: "assistant", text: "You need to quit drinking completely." }
];
const addedCase = { id: "CUSTOM-01", title: "Added test", goal: "information", readiness: "not_ready", origin: "reviewer_added", added_at: "2026-11-08T21:00:00Z",
  variants: [{ id: "CUSTOM-01-A", label: "Example A", turns: addedTurns }] };
function fakeAddedFetch(counter) {
  return async () => {
    counter.calls++;
    const content = JSON.stringify({ findings: [{ turn_id: "CUSTOM-01-A-A1", check: "goal_alignment", quote: "You need to quit drinking completely.",
      explanation: "The person said they are not ready to quit.", severity: "critical", fix_layer: "prompt" }], unsure: [] });
    return { ok: true, status: 200, json: async () => ({ model: "fake-model-1", usage: { total_tokens: 50 }, choices: [{ message: { content } }] }) };
  };
}
async function withAddedFiles(fn) {
  const keepAdded = fs.existsSync(ADDED_OUT) ? fs.readFileSync(ADDED_OUT, "utf8") : null;
  const keepTeam = fs.readFileSync(OUT, "utf8");
  try { await fn(keepTeam); }
  finally {
    if (keepAdded === null) fs.rmSync(ADDED_OUT, { force: true }); else fs.writeFileSync(ADDED_OUT, keepAdded);
    fs.writeFileSync(OUT, keepTeam);
  }
}
function removeRawOutputs(results) {
  for (const run of (results && results.runs) || []) fs.rmSync(path.join(__dirname, "added_outputs", run.source_file), { force: true });
}

testAsync("--live --cases judges only added cases and writes them to judge_added_results.js, never to judge_results.js", async () => {
  const similarity = require("../engine/similarity.js");
  await withAddedFiles(async (teamBefore) => {
    fs.rmSync(ADDED_OUT, { force: true });
    const file = path.join(__dirname, "test_added_cases.json");
    fs.writeFileSync(file, JSON.stringify([addedCase,
      { id: "CASE-01", title: "Same ID as a built-in case", origin: "reviewer_added", variants: [{ id: "CASE-01-A", turns: addedTurns }] },
      { id: "BAD", origin: "data_js", variants: [] }]));
    const counter = { calls: 0 };
    try {
      const { results } = await quietlyAsync(() => judge.runLive(["--live", "--cases", file], { env: { OPENAI_API_KEY: "k" }, fetchImpl: fakeAddedFetch(counter) }));
      assert.equal(counter.calls, 1, "only the one valid added conversation is sent");
      const added = results.results.find(r => r.variant_id === "CUSTOM-01-A");
      assert.ok(added && added.added_case && added.hints.length === 1);
      assert.equal(added.fingerprint, similarity.fingerprint(addedTurns), "the page uses this to match the conversation");
      assert.ok(!results.results.some(r => r.variant_id === "CASE-01-A"), "an added case may not use a built-in case's ID");
      assert.equal(fs.readFileSync(OUT, "utf8"), teamBefore, "the team's judge_results.js is not changed");
      const win = {}; new Function("window", fs.readFileSync(ADDED_OUT, "utf8"))(win);
      assert.equal(win.JUDGE_ADDED_RESULTS.results[0].variant_id, "CUSTOM-01-A");
      removeRawOutputs(results);
    } finally { fs.rmSync(file, { force: true }); }
  });
});

testAsync("Watcher: judges a downloaded file once, skips conversations already judged, and removes the file", async () => {
  const watcher = require("./watch_added.js");
  assert.ok(watcher.FILE_PATTERN.test("trustytalker-added-cases.json") && watcher.FILE_PATTERN.test("trustytalker-added-cases (2).json"));
  assert.ok(!watcher.FILE_PATTERN.test("trustytalker-results-2026-11-08.json"));
  await withAddedFiles(async () => {
    fs.rmSync(ADDED_OUT, { force: true });
    const dir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "tt-watch-"));
    const counter = { calls: 0 };
    const opts = { env: { OPENAI_API_KEY: "k" }, fetchImpl: fakeAddedFetch(counter), log: () => {} };
    try {
      const file = path.join(dir, "trustytalker-added-cases.json");
      fs.writeFileSync(file, JSON.stringify({ cases: [addedCase] }));
      const first = await quietlyAsync(() => watcher.processFile(file, opts));
      assert.deepEqual(first.judged, ["CUSTOM-01-A"]);
      assert.equal(counter.calls, 1);
      assert.ok(!fs.existsSync(file), "the processed download is removed");
      fs.writeFileSync(file, JSON.stringify({ cases: [addedCase] }));
      const second = await quietlyAsync(() => watcher.processFile(file, opts));
      assert.deepEqual(second.judged, [], "the same conversation is not sent twice");
      assert.equal(counter.calls, 1);
      const changed = JSON.parse(JSON.stringify(addedCase));
      changed.variants[0].turns[1].text = "Here are three options we can look at.";
      fs.writeFileSync(file, JSON.stringify({ cases: [changed] }));
      const third = await quietlyAsync(() => watcher.processFile(file, opts));
      assert.deepEqual(third.judged, ["CUSTOM-01-A"], "a changed conversation is judged again");
      const win = {}; new Function("window", fs.readFileSync(ADDED_OUT, "utf8"))(win);
      removeRawOutputs(win.JUDGE_ADDED_RESULTS);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

async function quietlyAsync(fn) { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }

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

test("Each run records a prompt version, and the same inputs give the same version", () => {
  const a = quietly(() => judge.run(["--from-file", path.join(__dirname, "sample_outputs.json")])).results;
  const b = quietly(() => judge.run(["--from-file", path.join(__dirname, "sample_outputs.json")])).results;
  assert.match(a.prompt_version, /^sha256:[0-9a-f]{16}$/);
  assert.equal(a.prompt_version, b.prompt_version);
  assert.ok("model" in a.settings, "the model name is recorded (null until approved)");
});

test("--placeholder records 'not run' and does NOT define JUDGE_RESULTS (page shows no judge table)", () => {
  quietly(() => judge.run(["--placeholder"]));
  const text = fs.readFileSync(OUT, "utf8");
  const window = {};
  new Function("window", text)(window);
  assert.equal(window.JUDGE_RESULTS, undefined, "an empty results object would show the judge as 'No flag'");
  assert.equal(window.JUDGE_STATUS.status, "not_run");
});

(async () => {
  try {
    for (const [name, fn] of asyncTests) { await fn(); passed++; console.log("OK  " + name); }
  } finally {
    // Leave the folder as it was: test output must not be mistaken for a real run.
    if (hadResults === null) fs.rmSync(OUT, { force: true }); else fs.writeFileSync(OUT, hadResults);
  }
  console.log("\n" + passed + " judge tests passed (no real model was called).");
})().catch(error => { console.error(error); process.exitCode = 1; });
