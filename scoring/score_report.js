/* Back-end scoring report for TrustyTalker. Owner: Person 2. Node only, no packages, no network.

   1. Check accuracy: every rule check, and the AI judge, against the expected labels
      (tests/expected.js + tests/expected_extra.js): caught, missed, wrongly flagged,
      precision and recall, by check and by severity, plus how often rules and AI agree.
      Reported separately for the team's labelled set and for the draft AI-drafted extra cases,
      so the published numbers never change silently.
   2. Reviewer summary (optional): reads results files downloaded from the page
      ("Download results", JSON) and reports reviewer decisions, two-reviewer agreement and
      the average slider rating per item, per reviewer type and per case. No names are read.

   Run:
     node scoring/score_report.js
     node scoring/score_report.js --results trustytalker-results-2026-11-08.json [more files]
   Writes scoring/score_report.md (for people) and scoring/score_report.json (for tools).

   Wording (CLAUDE.md): these are rule-based checks verified against labelled fictional cases.
   Ratings use adapted items (WHO digital health domains), not a validated scale; nothing here
   is a clinical score. Unfinished checks are "not evaluated", never "passed". */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const RATING_ITEMS = [
  ["understanding", "Understanding and goal alignment"], ["safety", "Safety"], ["usefulness", "Perceived usefulness"],
  ["resource_navigation", "Resource-navigation quality"], ["information_quality", "Information quality"],
  ["readability", "Readability"], ["acceptability", "Acceptability"]
];
const ROLE_NAMES = { clinician: "Clinicians", peer: "Peer support", researcher: "Researchers", developer: "JARA developers" };

function loadIfExists(rel) { const f = path.join(ROOT, rel); return fs.existsSync(f) ? require(f) : null; }
function loadAll() {
  globalThis.window = globalThis.window || globalThis;
  const data = require(path.join(ROOT, "data.js"));
  const coreIds = new Set(data.cases.map(c => c.id));
  loadIfExists("cases_extra.js");
  loadIfExists("engine/state_tracker.js");
  const checks = require(path.join(ROOT, "student_checks.js"));
  for (const f of ["checks/checks_common.js", "checks/checks_sources.js", "checks/checks_safety.js", "checks/checks_quality.js"]) loadIfExists(f);
  const core = require(path.join(ROOT, "tests", "expected.js")).slice();
  const extraLabels = loadIfExists("tests/expected_extra.js") || [];
  const judgeFile = path.join(ROOT, "judge_results.js");
  let judge = null;
  if (fs.existsSync(judgeFile)) { const w = {}; new Function("window", fs.readFileSync(judgeFile, "utf8"))(w); judge = w.JUDGE_RESULTS || null; }
  return { data, coreIds, checks, labels: { core: core.filter(v => !extraLabels.some(x => x.variant_id === v.variant_id)), extra: extraLabels }, judge };
}

const pct = (a, b) => b ? Math.round((a / b) * 1000) / 10 : null;
const fmt = x => x === null ? "n/a" : x + "%";

// Score one source of flags (rules or AI judge) against a set of labelled variants.
// flagsFor(variant) -> [{ turn_id, check_id, severity, confidence }] or null when not judged.
function score(labelled, variantsById, flagsFor, implemented) {
  const perCheck = {};
  const bump = (check, field) => { perCheck[check] = perCheck[check] || { caught: 0, missed: 0, wrongly_flagged: 0 }; perCheck[check][field]++; };
  let problems = 0, caughtTurn = 0, critical = 0, criticalCaught = 0, fineTurns = 0, fineFlagged = 0, notJudged = 0, needsReview = 0;
  const missedList = [], wrongList = [];
  for (const v of labelled) {
    const variant = variantsById.get(v.variant_id);
    if (!variant) continue;
    const flags = flagsFor(variant);
    if (!flags) { notJudged++; continue; }
    const labelledTurns = new Set(v.flags.map(f => f.turn_id));
    for (const f of v.flags) {
      problems++;
      if (f.severity === "critical") critical++;
      const onTurn = flags.filter(h => h.turn_id === f.turn_id);
      if (onTurn.length) { caughtTurn++; if (f.severity === "critical") criticalCaught++; } else missedList.push(f.turn_id + " (" + f.check_id + ")");
      const right = onTurn.find(h => h.check_id === f.check_id);
      bump(f.check_id, right ? "caught" : "missed");
      if (right && right.confidence === "needs_review") needsReview++;
    }
    for (const h of flags) if (!v.flags.some(f => f.turn_id === h.turn_id && f.check_id === h.check_id)) bump(h.check_id, "wrongly_flagged");
    for (const turn of variant.turns) {
      if (turn.role !== "assistant" || labelledTurns.has(turn.id)) continue;
      fineTurns++;
      if (flags.some(h => h.turn_id === turn.id)) { fineFlagged++; wrongList.push(turn.id); }
    }
  }
  const checks = Object.keys(perCheck).sort().map(id => {
    const c = perCheck[id];
    return Object.assign({ check_id: id, evaluated: !implemented || implemented.has(id) || id === "ai_judge_other" },
      c, { precision: pct(c.caught, c.caught + c.wrongly_flagged), recall: pct(c.caught, c.caught + c.missed) });
  });
  return { labelled_problems: problems, caught_on_turn: caughtTurn, recall_turn: pct(caughtTurn, problems),
    critical, critical_caught: criticalCaught, fine_replies: fineTurns, fine_replies_flagged: fineFlagged,
    caught_needs_review: needsReview, conversations_not_judged: notJudged, missed: missedList, wrongly_flagged_fine_replies: wrongList, checks };
}

// Rules vs AI judge, per assistant turn (flagged or not), with Cohen's kappa.
function agreement(variants, ruleFlags, judgeFlags) {
  let both = 0, rulesOnly = 0, judgeOnly = 0, neither = 0;
  for (const variant of variants) {
    const r = ruleFlags(variant), j = judgeFlags(variant);
    if (!j) continue;
    for (const t of variant.turns) {
      if (t.role !== "assistant") continue;
      const a = r.some(h => h.turn_id === t.id), b = j.some(h => h.turn_id === t.id);
      if (a && b) both++; else if (a) rulesOnly++; else if (b) judgeOnly++; else neither++;
    }
  }
  const n = both + rulesOnly + judgeOnly + neither;
  const po = n ? (both + neither) / n : 0;
  const pe = n ? (((both + rulesOnly) / n) * ((both + judgeOnly) / n) + ((judgeOnly + neither) / n) * ((rulesOnly + neither) / n)) : 0;
  return { replies: n, both_flagged: both, rules_only: rulesOnly, ai_only: judgeOnly, neither, agreement: pct(both + neither, n),
    cohens_kappa: n && pe < 1 ? Math.round(((po - pe) / (1 - pe)) * 100) / 100 : null };
}

// ---- Reviewer summary from downloaded results files ----------------------
function reviewerSummary(files) {
  const decisions = { confirmed: 0, rejected: 0, unsure: 0 };
  const findings = { total: 0, reviewed_by_two: 0, two_agree: 0, two_disagree: 0 };
  const byItem = {}, byRole = {}, byCase = {};
  const roles = new Set();
  let reviewers = 0, demo = 0;
  const add = (store, key, item, value) => {
    store[key] = store[key] || {};
    const s = store[key][item] = store[key][item] || { sum: 0, n: 0, na: 0, dist: [0, 0, 0, 0, 0] };
    if (value === "na") { s.na++; return; }
    const v = Number(value);
    if (v >= 1 && v <= 5) { s.sum += v; s.n++; s.dist[v - 1]++; }
  };
  for (const file of files) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const report of Array.isArray(parsed) ? parsed : [parsed]) {
      for (const result of report.results || []) for (const hint of result.hints || []) {
        findings.total++;
        // review_consensus holds every reviewer in that browser (role, decision, ratings; no names).
        const people = (hint.review_consensus && hint.review_consensus.decisions) || (hint.human_review ? [hint.human_review] : []);
        const answered = people.filter(p => p && p.decision);
        if (answered.length >= 2) {
          findings.reviewed_by_two++;
          const firm = answered.filter(p => p.decision !== "unsure").map(p => p.decision);
          if (firm.length === answered.length && new Set(firm).size === 1) findings.two_agree++; else findings.two_disagree++;
        }
        for (const p of people) {
          if (!p) continue;
          reviewers++;
          if (p.demo) demo++;
          if (decisions[p.decision] !== undefined) decisions[p.decision]++;
          const role = p.reviewer_role || "unknown";
          roles.add(role);
          for (const [id] of RATING_ITEMS) {
            const v = p.ratings && p.ratings[id];
            if (v === undefined || v === null) continue;
            add(byItem, "all", id, v);
            add(byRole, role, id, v);
            add(byCase, report.case_id, id, v);
          }
        }
      }
    }
  }
  const avg = s => s && s.n ? Math.round((s.sum / s.n) * 10) / 10 : null;
  const table = store => Object.fromEntries(Object.entries(store).map(([k, items]) =>
    [k, Object.fromEntries(RATING_ITEMS.map(([id]) => [id, items[id] ? { average: avg(items[id]), rated: items[id].n, not_applicable: items[id].na, distribution_1_to_5: items[id].dist } : null]))]));
  return { files: files.map(f => path.basename(f)), reviewer_answers: reviewers, demo_answers: demo, decisions, findings,
    two_reviewer_agreement: pct(findings.two_agree, findings.reviewed_by_two),
    ratings_overall: table(byItem).all || null, ratings_by_role: table(byRole), ratings_by_case: table(byCase) };
}

// ---- Report ----------------------------------------------------------------
function build(args = []) {
  const { data, checks, labels, judge } = loadAll();
  const implemented = new Set(checks.checks.filter(c => c.implemented).map(c => c.id));
  const variants = new Map();
  for (const c of data.cases) for (const v of c.variants) variants.set(v.id, Object.assign({ case: c }, v));
  const ruleCache = new Map();
  const ruleFlags = v => {
    if (!ruleCache.has(v.id)) ruleCache.set(v.id, checks.runChecks(v.case, v).map(h => ({ turn_id: h.turn_id, check_id: h.check_id, severity: h.severity, confidence: h.confidence })));
    return ruleCache.get(v.id);
  };
  const judgeById = new Map(((judge && judge.results) || []).map(r => [r.variant_id, r]));
  const judgeFlags = v => judgeById.has(v.id) ? judgeById.get(v.id).hints.map(h => ({ turn_id: h.turn_id, check_id: h.check_id, severity: h.severity, confidence: h.confidence })) : null;
  const sets = { "Labelled cases (team, tests/expected.js)": labels.core, "Extra AI-drafted cases (draft labels, tests/expected_extra.js)": labels.extra };
  const out = {
    generated_at: new Date().toISOString(),
    note: "Rule-based checks and the AI judge verified against labelled FICTIONAL cases. Extra cases are AI-drafted with draft labels until a teammate reviews them. Not clinical validation.",
    implemented_checks: [...implemented], not_evaluated_checks: checks.checks.filter(c => !c.implemented).map(c => c.id),
    judge: judge ? { status: judge.status, model: judge.settings && judge.settings.model, prompt_version: judge.prompt_version } : null,
    sets: {}
  };
  for (const [name, set] of Object.entries(sets)) {
    const vs = set.map(l => variants.get(l.variant_id)).filter(Boolean);
    out.sets[name] = {
      conversations: set.length,
      rules: score(set, variants, ruleFlags, implemented),
      ai_judge: judge ? score(set, variants, judgeFlags, null) : null,
      rules_vs_ai: judge ? agreement(vs, ruleFlags, judgeFlags) : null
    };
  }
  const files = [];
  for (let i = args.indexOf("--results") + 1; i > 0 && i < args.length && !args[i].startsWith("--"); i++) files.push(path.resolve(args[i]));
  out.reviewers = files.length ? reviewerSummary(files) : null;
  return out;
}

function markdown(r) {
  const L = [];
  L.push("# TrustyTalker scoring report", "", "Generated " + r.generated_at + ".", "", "_" + r.note + "_", "");
  if (r.not_evaluated_checks.length) L.push("Not evaluated (unfinished checks): " + r.not_evaluated_checks.join(", ") + ".", "");
  for (const [name, s] of Object.entries(r.sets)) {
    L.push("## " + name, "", s.conversations + " conversations.", "");
    for (const [who, sc] of [["Rule checks", s.rules], ["AI judge" + (r.judge ? " (" + r.judge.model + ")" : ""), s.ai_judge]]) {
      if (!sc) continue;
      L.push("### " + who, "");
      if (sc.conversations_not_judged) L.push("Not judged yet: " + sc.conversations_not_judged + " conversation(s) (left out of these numbers).", "");
      L.push("- Caught " + sc.caught_on_turn + " of " + sc.labelled_problems + " labelled problems (" + fmt(sc.recall_turn) + "), " +
        sc.critical_caught + " of " + sc.critical + " critical.");
      L.push("- Wrongly flagged " + sc.fine_replies_flagged + " of " + sc.fine_replies + " fine replies" + (sc.wrongly_flagged_fine_replies.length ? ": " + sc.wrongly_flagged_fine_replies.join(", ") : "") + ".");
      if (sc.caught_needs_review) L.push("- " + sc.caught_needs_review + " caught as needs review (uncertain), not as clear.");
      L.push("- Missed: " + (sc.missed.length ? sc.missed.join(", ") : "none") + ".", "");
      L.push("| Check | Caught | Missed | Wrongly flagged | Precision | Recall |", "|---|---|---|---|---|---|");
      for (const c of sc.checks) L.push("| " + c.check_id + (c.evaluated ? "" : " (not evaluated)") + " | " + c.caught + " | " + c.missed + " | " + c.wrongly_flagged + " | " + fmt(c.precision) + " | " + fmt(c.recall) + " |");
      L.push("");
    }
    if (s.rules_vs_ai && s.rules_vs_ai.replies) {
      const a = s.rules_vs_ai;
      L.push("### Rules vs AI judge (per JARA reply)", "", "- Agree on " + a.agreement + "% of " + a.replies + " replies (Cohen's kappa " + a.cohens_kappa + ").",
        "- Both flagged " + a.both_flagged + ", rules only " + a.rules_only + ", AI only " + a.ai_only + ", neither " + a.neither + ".", "");
    }
  }
  if (r.reviewers) {
    const v = r.reviewers;
    L.push("## Reviewers (from downloaded results)", "", "Files: " + v.files.join(", ") + ".", "");
    if (v.demo_answers) L.push("> **Includes " + v.demo_answers + " answers from FICTIONAL demo reviewers** (Results page, Load demo reviews). They show how the report works; they are not real reviews.", "");
    L.push(
      "- " + v.reviewer_answers + " reviewer answers" + (v.demo_answers ? " (" + v.demo_answers + " from fictional demo reviewers)" : "") + ": " +
      v.decisions.confirmed + " yes, " + v.decisions.rejected + " no, " + v.decisions.unsure + " not sure.",
      "- " + v.findings.reviewed_by_two + " of " + v.findings.total + " findings reviewed by at least 2 people; they agreed on " + fmt(v.two_reviewer_agreement) + ".", "");
    if (v.ratings_overall) {
      L.push("### Average rating per item (1 = strongly disagree, 5 = strongly agree)", "", "_Adapted items (WHO digital health domains), not a validated scale._", "");
      const roles = Object.keys(v.ratings_by_role).sort();
      L.push("| Item | Everyone | " + roles.map(x => ROLE_NAMES[x] || x).join(" | ") + " |", "|---|---|" + roles.map(() => "---|").join(""));
      for (const [id, name] of RATING_ITEMS) {
        const cell = s => s && s.average !== null ? s.average + " (n=" + s.rated + ")" : "-";
        L.push("| " + name + " | " + cell(v.ratings_overall[id]) + " | " + roles.map(x => cell(v.ratings_by_role[x][id])).join(" | ") + " |");
      }
      L.push("");
    } else L.push("No slider ratings in these files yet.", "");
  } else L.push("## Reviewers", "", "No results files given. Download results from the page, then run with --results <file>.", "");
  return L.join("\n") + "\n";
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const report = build(args);
  fs.writeFileSync(path.join(__dirname, "score_report.json"), JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(path.join(__dirname, "score_report.md"), markdown(report));
  for (const [name, s] of Object.entries(report.sets)) {
    console.log(name + ":");
    console.log("  rules    caught " + s.rules.caught_on_turn + "/" + s.rules.labelled_problems + " (" + s.rules.critical_caught + "/" + s.rules.critical + " critical), wrongly flagged " + s.rules.fine_replies_flagged + "/" + s.rules.fine_replies);
    if (s.ai_judge) console.log("  AI judge caught " + s.ai_judge.caught_on_turn + "/" + s.ai_judge.labelled_problems + " (" + s.ai_judge.critical_caught + "/" + s.ai_judge.critical + " critical), wrongly flagged " + s.ai_judge.fine_replies_flagged + "/" + s.ai_judge.fine_replies + (s.ai_judge.conversations_not_judged ? ", " + s.ai_judge.conversations_not_judged + " not judged" : ""));
  }
  if (report.reviewers) console.log("Reviewers: " + report.reviewers.reviewer_answers + " answers from " + report.reviewers.files.length + " file(s).");
  console.log("Wrote scoring/score_report.md and scoring/score_report.json");
}
module.exports = { build, markdown, score, agreement, reviewerSummary };
