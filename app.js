/* Display and export plumbing (Person 3). Checks live in student_checks.js and the
 * other teammates' files; the timeline is in timeline.js and the reviewer panel in review.js. */
(function () {
  "use strict";
  const data = window.JARAData;
  const api = window.JARAChecks;
  const timeline = window.JARATimeline;
  const review = window.JARAReview;
  const select = document.getElementById("case-select");
  const runButton = document.getElementById("run-checks");
  const exportButton = document.getElementById("export-results");
  const status = document.getElementById("check-status");
  const summaryBar = document.getElementById("summary-bar");
  let report = null;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function selectedCase() { return data.cases.find(item => item.id === select.value); }
  function pretty(value) { return String(value).replaceAll("_", " "); }

  // ---- Confidence badges -------------------------------------------------
  // A hint is "Needs reviewer" when the check marks it as uncertain. Agreed field
  // with the backend: hint.confidence = "clear" | "needs_review". A few synonyms
  // are accepted so the page keeps working if the wording changes.
  const UNSURE_VALUES = ["needs_review", "needs_reviewer", "unsure", "uncertain", "low"];
  function confidenceOf(hint) {
    const value = String(hint.confidence || "").toLowerCase();
    if (hint.needs_reviewer === true || UNSURE_VALUES.includes(value)) return "review";
    return "clear";
  }
  function makeBadge(level) {
    const badge = element("span", level === "review" ? "Needs reviewer" : "Clear", "badge badge-" + level);
    badge.title = level === "review"
      ? "The check is not sure. A person should decide."
      : "The check found a direct match for its rule. A person should still confirm it.";
    return badge;
  }

  // ---- Severity ----------------------------------------------------------
  // Agreed hint field: hint.severity ("critical" first). Hints without one sort last.
  const SEVERITY_ORDER = ["critical", "high", "warning", "medium", "quality", "low"];
  function severityRank(hint) {
    const i = SEVERITY_ORDER.indexOf(String(hint.severity || "").toLowerCase());
    return i < 0 ? SEVERITY_ORDER.length : i;
  }
  function isCritical(hint) { return String(hint.severity || "").toLowerCase() === "critical"; }

  // ---- Closest source passage -------------------------------------------
  // Uses Fatima's similarity.js: JARASimilarity.closestSource(scenario, turn) ->
  // { source_id, passage, score, cited } or null when nothing is close. A cited
  // source always comes first. If similarity.js is missing, a shared-word score stands in.
  function words(text) { return new Set(String(text).toLowerCase().match(/[a-z0-9']+/g) || []); }
  function closestSource(scenario, turn) {
    const sources = scenario.sources || [];
    if (!sources.length) return null;
    const sim = window.JARASimilarity;
    if (sim && typeof sim.closestSource === "function") {
      try {
        const found = sim.closestSource(scenario, turn);
        return found && found.passage ? Object.assign({ method: found.cited ? "TF-IDF, cited by the reply" : "TF-IDF" }, found) : null;
      } catch (error) { /* fall back below */ }
    }
    const a = words(turn.text);
    let best = null;
    for (const source of sources) {
      const b = words(source.passage);
      let shared = 0;
      for (const w of a) if (b.has(w)) shared += 1;
      const score = shared / Math.max(1, new Set([...a, ...b]).size);
      if (!best || score > best.score) best = { source_id: source.id, passage: source.passage, score, method: "word overlap" };
    }
    return best;
  }

  function clearSummary() {
    summaryBar.replaceChildren();
    summaryBar.hidden = true;
  }

  function showCase() {
    const scenario = selectedCase();
    report = null;
    review.reset();
    exportButton.disabled = true;
    status.className = "";
    status.textContent = "Run the checks to inspect this example. The unfinished checks are not evaluated.";
    clearSummary();
    document.getElementById("findings").replaceChildren();
    document.getElementById("judge-compare").replaceChildren();
    document.getElementById("case-description").textContent = scenario.description;
    const facts = document.getElementById("case-facts");
    facts.replaceChildren();
    for (const [label, value] of [["Current goal", scenario.goal], ["Readiness", scenario.readiness], ["Application state", "Not observed"]]) {
      const group = element("div");
      group.append(element("dt", label), element("dd", value.replaceAll("_", " ")));
      facts.append(group);
    }
    const sourceBox = document.getElementById("source-context");
    sourceBox.replaceChildren();
    if (!scenario.sources.length) sourceBox.append(element("p", "No source record is needed for this example."));
    for (const source of scenario.sources) {
      sourceBox.append(element("span", source.id, "source-id"), element("p", source.passage));
    }
    const variants = document.getElementById("variants");
    variants.replaceChildren();
    for (const variant of scenario.variants) {
      const section = element("section", undefined, "variant");
      section.setAttribute("aria-label", variant.label);
      section.append(element("h3", variant.label), timeline.render(scenario, variant));
      const goals = timeline.goalsForVariant(scenario, variant);
      variant.turns.forEach((turn, index) => {
        const message = element("div", undefined, "turn " + turn.role);
        message.dataset.turnId = turn.id;
        message.dataset.text = turn.text;
        const header = element("div", undefined, "turn-header");
        header.append(element("strong", turn.role === "user" ? "Person" : "Assistant"));
        const goal = goals[index];
        if (goal) {
          const changed = index > 0 && goals[index - 1] && goals[index - 1] !== goal;
          const label = element("span", (changed ? "Goal changed: " : "Goal: ") + pretty(goal), "goal-label" + (changed ? " goal-changed" : ""));
          label.title = changed ? "The goal in effect changed at this turn (was " + pretty(goals[index - 1]) + ")." : "Goal in effect at this turn.";
          header.append(label);
        }
        message.append(header, element("p", turn.text), element("span", turn.id, "turn-id"));
        if ((turn.claims || []).length) {
          message.append(element("span", "Source cited: " + turn.claims.map(c => c.source_id).join(", "), "turn-id"));
        }
        if (turn.role === "assistant") {
          const closest = closestSource(scenario, turn);
          if (closest) {
            const box = element("details", undefined, "closest-source");
            box.append(element("summary", "Closest source passage: " + closest.source_id),
              element("p", closest.passage),
              element("small", "Matched by " + closest.method + " (score " + Number(closest.score).toFixed(2) + ")", "muted"));
            message.append(box);
          }
        }
        section.append(message);
      });
      variants.append(section);
    }
  }

  // Structural evidence checks only. A valid quote does not prove a correct conclusion.
  function validateHints(hints, variant) {
    for (const hint of hints) {
      const turn = variant.turns.find(t => t.id === hint.turn_id && t.role === "assistant");
      if (!turn || typeof hint.evidence_quote !== "string" || !hint.evidence_quote.trim() || !turn.text.includes(hint.evidence_quote)) {
        throw new Error("A hint needs a real assistant turn and an exact quote from that turn.");
      }
      if (!api.checks.some(c => c.id === hint.check_id) || typeof hint.reason !== "string" || !hint.reason.trim() || hint.status !== "unreviewed_suggestion") {
        throw new Error("A hint needs a known check ID, a reason and unreviewed_suggestion status.");
      }
    }
  }

  function run() {
    const scenario = selectedCase();
    const findings = document.getElementById("findings");
    findings.replaceChildren();
    clearSummary();
    document.querySelectorAll(".turn.flagged").forEach(node => node.classList.remove("flagged", "flagged-review"));
    clearQuoteMarks();
    timeline.reset();
    document.getElementById("judge-compare").replaceChildren();
    report = null;
    exportButton.disabled = true;
    try {
      const results = scenario.variants.map(variant => {
        const hints = api.runChecks(scenario, variant);
        validateHints(hints, variant);
        return { variant_id: variant.id, hints };
      });
      report = {
        schema_version: "jara-junior-findings-1", dataset_version: data.version,
        generated_at: new Date().toISOString(), case_id: scenario.id,
        provenance: data.provenance, implemented_checks: api.checks.filter(c => c.implemented).map(c => c.id),
        unfinished_checks: api.checks.filter(c => !c.implemented).map(c => c.id),
        review_status: "unreviewed_suggestions", clinical_validation: "not_established",
        application_state_observed: false, results
      };
      // Keep each hint's original index (the review key uses it), then sort critical first.
      const ordered = [];
      for (const result of results) result.hints.forEach((hint, index) => ordered.push({ variantId: result.variant_id, hint, index }));
      ordered.sort((a, b) => severityRank(a.hint) - severityRank(b.hint));
      const count = ordered.length;
      for (const { variantId, hint, index } of ordered) {
        const level = confidenceOf(hint);
        const key = review.keyFor(variantId, hint, index);
        const row = element("article", undefined, "finding finding-" + level + (isCritical(hint) ? " finding-critical" : ""));
        const heading = element("h3", variantId + " / " + pretty(hint.check_id) + " ");
        if (hint.severity) heading.append(element("span", pretty(hint.severity), "badge badge-severity severity-" + String(hint.severity).toLowerCase()));
        heading.append(makeBadge(level));
        row.append(heading, element("p", hint.reason), element("blockquote", hint.evidence_quote),
          element("small", hint.turn_id + " | Automated suggestion, not a reviewed finding"),
          review.controls(key, variantId, hint, k => downloadRegression(k, variantId, hint)));
        findings.append(row);
        const message = turnNode(hint.turn_id);
        if (message) {
          // A clear hint wins over an unsure one on the same turn.
          if (level === "clear") { message.classList.add("flagged"); message.classList.remove("flagged-review"); }
          else if (!message.classList.contains("flagged")) message.classList.add("flagged", "flagged-review");
        }
      }
      markQuotes(results);
      for (const variant of scenario.variants) {
        const result = results.find(r => r.variant_id === variant.id);
        timeline.paint(variant, result ? result.hints : [], confidenceOf);
      }
      renderSummary(scenario, results);
      renderJudgeComparison(scenario, results);
      status.className = "";
      const anyUnfinished = api.checks.some(c => !c.implemented);
      status.textContent = count
        ? count + " suggestion" + (count === 1 ? "" : "s") + " to inspect." + (anyUnfinished ? " Unfinished checks remain unevaluated." : "")
        : "No suggestions from the enabled checks. This is not a pass: read the examples" + (anyUnfinished ? " and complete the unfinished checks." : " yourself too.");
      exportButton.disabled = false;
    } catch (error) {
      status.className = "error";
      status.textContent = "Check error: " + error.message + " Review student_checks.js, save it and refresh this page.";
    }
  }

  // ---- Exact-quote highlight --------------------------------------------
  // Wraps each hint's evidence_quote in <mark> inside its turn, so the exact
  // problem words stand out. Built with text nodes only (no innerHTML).
  function turnNode(turnId) {
    return Array.from(document.querySelectorAll("#variants .turn[data-turn-id]")).find(node => node.dataset.turnId === turnId);
  }
  function clearQuoteMarks() {
    for (const node of document.querySelectorAll("#variants .turn[data-turn-id]")) {
      const p = node.querySelector("p");
      if (p && node.dataset.text !== undefined) p.textContent = node.dataset.text;
    }
  }
  function markQuotes(results) {
    const byTurn = new Map();
    for (const result of results) for (const hint of result.hints) {
      if (!byTurn.has(hint.turn_id)) byTurn.set(hint.turn_id, []);
      byTurn.get(hint.turn_id).push(hint);
    }
    for (const [turnId, hints] of byTurn) {
      const node = turnNode(turnId);
      if (!node) continue;
      const p = node.querySelector("p");
      const text = node.dataset.text;
      // Collect [start, end, level] ranges; a Clear hint wins where ranges overlap.
      const ranges = [];
      for (const hint of hints) {
        const start = text.indexOf(hint.evidence_quote);
        if (start < 0 || !hint.evidence_quote) continue;
        ranges.push({ start, end: start + hint.evidence_quote.length, level: confidenceOf(hint) });
      }
      if (!ranges.length) continue;
      ranges.sort((a, b) => a.start - b.start);
      const merged = [];
      for (const r of ranges) {
        const last = merged[merged.length - 1];
        if (last && r.start <= last.end) {
          last.end = Math.max(last.end, r.end);
          if (r.level === "clear") last.level = "clear";
        } else merged.push(Object.assign({}, r));
      }
      p.replaceChildren();
      let cursor = 0;
      for (const r of merged) {
        if (r.start > cursor) p.append(document.createTextNode(text.slice(cursor, r.start)));
        const mark = element("mark", text.slice(r.start, r.end), "quote-mark quote-" + r.level);
        mark.title = "Quoted as evidence by the check";
        p.append(mark);
        cursor = r.end;
      }
      if (cursor < text.length) p.append(document.createTextNode(text.slice(cursor)));
    }
  }

  // ---- Summary bar -------------------------------------------------------
  // Counts assistant turns: flagged (at least one Clear hint), unsure (only
  // Needs-reviewer hints) and clean (no hint from the enabled checks).
  function renderSummary(scenario, results) {
    let critical = 0, flagged = 0, unsure = 0, clean = 0;
    for (const variant of scenario.variants) {
      const result = results.find(r => r.variant_id === variant.id);
      const hints = result ? result.hints : [];
      for (const turn of variant.turns) {
        if (turn.role !== "assistant") continue;
        const turnHints = hints.filter(h => h.turn_id === turn.id);
        const levels = turnHints.map(confidenceOf);
        if (turnHints.some(isCritical)) critical += 1;
        if (levels.includes("clear")) flagged += 1;
        else if (levels.length) unsure += 1;
        else clean += 1;
      }
    }
    const items = [];
    if (critical) items.push(element("span", critical + " critical", "summary-item summary-critical"));
    items.push(
      element("span", flagged + " flagged", "summary-item summary-flagged"),
      element("span", unsure + " unsure", "summary-item summary-unsure"),
      element("span", clean + " clean", "summary-item summary-clean"));
    // Unfinished checks are "not evaluated", never counted as clean.
    const unfinished = api.checks.filter(c => !c.implemented);
    if (unfinished.length) {
      const item = element("span", "Not evaluated: " + unfinished.map(c => c.label || pretty(c.id)).join(", "), "summary-item summary-not-evaluated");
      item.title = "These checks are not finished, so they did not run. Their problems would not show up here.";
      items.push(item);
    }
    summaryBar.replaceChildren(...items);
    summaryBar.title = "Counts assistant replies in both examples. Clean means no enabled check raised a suggestion. It is not a pass.";
    summaryBar.hidden = false;
  }

  // ---- Rules vs AI judge -------------------------------------------------
  // Shown only when Fatima's judge_results.js is loaded (written by judge/run_judge.js
  // as window.JUDGE_RESULTS). Accepted shapes: { results: [{ case_id, variant_id, hints: [...] }] },
  // the same as a plain array, or a flat array of hints that each carry variant_id.
  function judgeData() { return window.JUDGE_RESULTS || window.JARAJudgeResults || null; }
  function judgeHintsFor(variantId) {
    const raw = judgeData();
    if (!raw) return null;
    const list = Array.isArray(raw) ? raw : Array.isArray(raw.results) ? raw.results : [];
    const out = [];
    for (const item of list) {
      if (!item) continue;
      if (Array.isArray(item.hints)) { if (item.variant_id === variantId) out.push(...item.hints); }
      else if (item.variant_id === variantId) out.push(item);
    }
    return out;
  }
  function describe(hints) {
    return hints.length ? Array.from(new Set(hints.map(h => pretty(h.check_id)))).join(", ") : "No flag";
  }
  function renderJudgeComparison(scenario, results) {
    const box = document.getElementById("judge-compare");
    box.replaceChildren();
    const raw = judgeData();
    if (!raw) return;
    box.append(element("h2", "Rules vs AI judge"),
      element("p", "Each assistant turn, with what the rule checks and the AI judge flagged.", "muted"));
    if (raw.status && raw.status !== "judge_run") box.append(element("p", "Test data only: " + (raw.note || "not a real judge run."), "muted judge-note"));
    const table = element("table", undefined, "grid-table");
    const head = element("tr");
    for (const h of ["Turn", "Rule checks", "AI judge", "Agree?"]) head.append(element("th", h));
    table.append(element("thead"), element("tbody"));
    table.tHead.append(head);
    for (const variant of scenario.variants) {
      const ruleHints = (results.find(r => r.variant_id === variant.id) || { hints: [] }).hints;
      const judgeHints = judgeHintsFor(variant.id) || [];
      for (const turn of variant.turns) {
        if (turn.role !== "assistant") continue;
        const rules = ruleHints.filter(h => h.turn_id === turn.id);
        const judge = judgeHints.filter(h => h.turn_id === turn.id);
        const agree = (rules.length > 0) === (judge.length > 0);
        const tr = element("tr", undefined, agree ? "" : "row-disagree");
        const verdict = element("td");
        verdict.append(element("span", agree ? "Agree" : "Disagree", "verdict verdict-" + (agree ? "agree" : "other")));
        tr.append(element("td", turn.id), element("td", describe(rules)), element("td", describe(judge)), verdict);
        table.tBodies[0].append(tr);
      }
    }
    box.append(table);
  }

  function buildExport() { return review.attachToReport(report); }

  function downloadJSON(object, filename) {
    const blob = new Blob([JSON.stringify(object, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = element("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- Save as regression case ------------------------------------------
  // A confirmed finding becomes a test: the original turns, the expected behaviour,
  // the evidence and the dataset version, plus a similar example that should pass.
  function downloadRegression(key, variantId, hint) {
    const scenario = selectedCase();
    const variant = scenario.variants.find(v => v.id === variantId);
    const humanReview = review.humanReviewFor(key, hint);
    if (!variant || !humanReview || (humanReview.decision !== "confirmed" && humanReview.decision !== "modified")) return;
    const turnIndex = variant.turns.findIndex(t => t.id === hint.turn_id);
    // Similar case: another example in the same case where this check raises nothing.
    let similar = null;
    for (const other of scenario.variants) {
      if (other.id === variant.id) continue;
      let hits = [];
      try { hits = api.runChecks(scenario, other).filter(h => h.check_id === hint.check_id); } catch (error) { continue; }
      if (!hits.length) { similar = other; break; }
    }
    const regression = {
      schema_version: "trustytalker-regression-1",
      regression_id: "REG-" + hint.check_id + "-" + hint.turn_id,
      created_at: new Date().toISOString(),
      dataset_version: data.version,
      provenance: data.provenance,
      source: { case_id: scenario.id, variant_id: variant.id, turn_id: hint.turn_id },
      setup: { goal: scenario.goal, readiness: scenario.readiness, sources: scenario.sources },
      original_turns: variant.turns.slice(0, turnIndex + 1),
      expected_behavior: {
        check_id: hint.check_id,
        should_flag: true,
        turn_id: hint.turn_id,
        description: "The " + pretty(hint.check_id) + " check should flag turn " + hint.turn_id + "."
      },
      evidence: { quote: hint.evidence_quote, automated_reason: hint.reason },
      human_review: humanReview,
      similar_case_should_pass: similar
        ? {
            variant_id: similar.id,
            turns: similar.turns,
            expected_behavior: { check_id: hint.check_id, should_flag: false,
              description: "The " + pretty(hint.check_id) + " check should raise nothing for " + similar.id + "." }
          }
        : { variant_id: null, note: "No passing example in this case yet. Write a similar case that should not be flagged." },
      clinical_validation: "not_established"
    };
    downloadJSON(regression, regression.regression_id + ".json");
  }

  function download() {
    if (!report) return;
    downloadJSON(buildExport(), report.case_id + "-findings.json");
  }

  // ---- Expert benchmark panel -------------------------------------------
  // Uses JARABenchmark.run(data, checks) from benchmark.js (Fatima), which returns
  // { agree, total, agreement_rate, rows }. Row field names are read flexibly.
  function field(row, names) {
    for (const name of names) if (row && row[name] !== undefined && row[name] !== null && row[name] !== "") return row[name];
    return "";
  }
  const ROW = {
    caseId: r => field(r, ["case_id", "case", "scenario_id"]),
    variantId: r => field(r, ["variant_id", "variant", "example_id"]),
    expert: r => field(r, ["expert_label", "expert", "label", "expected"]),
    ours: r => field(r, ["our_label", "predicted", "found", "tool_label", "actual", "result"]),
    verdict: r => String(field(r, ["verdict"]) || "").toLowerCase(),
    note: r => field(r, ["reason", "note", "explanation"])
  };
  function formatRate(rate, agree, total) {
    let value = Number(rate);
    if (!isFinite(value)) value = total ? agree / total : 0;
    if (value <= 1) value *= 100;
    return Math.round(value) + "%";
  }
  let benchmark = null;
  function loadBenchmark() {
    benchmark = null;
    const B = window.JARABenchmark;
    if (!B || typeof B.run !== "function") return { error: "Benchmark not loaded yet. Add benchmark.js to the folder and the script line in index.html." };
    try {
      benchmark = B.run(window.JARAData, window.JARAChecks);
      if (!benchmark || !Array.isArray(benchmark.rows)) throw new Error("JARABenchmark.run did not return rows.");
      return { ok: true };
    } catch (error) { benchmark = null; return { error: "Benchmark error: " + error.message }; }
  }
  function renderBenchmark() {
    const panel = document.getElementById("benchmark-panel");
    const loaded = loadBenchmark();
    panel.replaceChildren(element("h2", "Agreement with expert examples"));
    if (loaded.error) { panel.append(element("p", loaded.error, "muted")); return; }
    const { agree, total, agreement_rate } = benchmark;
    const score = element("div", undefined, "bench-score");
    score.append(element("span", formatRate(agreement_rate, agree, total), "bench-rate"),
      element("span", "Our checks agree with the experts on " + agree + " of " + total + " examples.", "bench-text"));
    panel.append(score);
    const details = element("details", undefined, "bench-details");
    details.append(element("summary", "Show each example (" + benchmark.rows.length + ")"));
    const table = element("table", undefined, "grid-table");
    const head = element("tr");
    for (const h of ["Case", "Example", "Expert label", "Our checks", "Verdict"]) head.append(element("th", h));
    table.append(element("thead"), element("tbody"));
    table.tHead.append(head);
    for (const row of benchmark.rows) {
      const verdict = ROW.verdict(row);
      const tr = element("tr", undefined, verdict === "agree" ? "" : "row-disagree");
      tr.append(element("td", ROW.caseId(row)), element("td", ROW.variantId(row)),
        element("td", pretty(ROW.expert(row))), element("td", pretty(ROW.ours(row))));
      const cell = element("td");
      cell.append(element("span", verdict ? pretty(verdict) : "-", "verdict verdict-" + (verdict === "agree" ? "agree" : "other")));
      if (ROW.note(row)) cell.title = ROW.note(row);
      tr.append(cell);
      table.tBodies[0].append(tr);
    }
    details.append(table);
    panel.append(details);
  }

  // ---- All-cases overview grid ------------------------------------------
  function benchmarkRowFor(variantId) {
    return benchmark ? benchmark.rows.find(r => ROW.variantId(r) === variantId) : null;
  }
  function runAllCases() {
    const box = document.getElementById("all-cases");
    box.replaceChildren();
    renderBenchmark(); // refresh so the grid uses the latest benchmark
    const table = element("table", undefined, "grid-table all-cases-table");
    const head = element("tr");
    for (const h of ["Case", "Example", "Goal", "Expert label", "What we found", "Agree?"]) head.append(element("th", h));
    table.append(element("thead"), element("tbody"));
    table.tHead.append(head);
    let agreeCount = 0, compared = 0, errors = 0;
    for (const scenario of data.cases) {
      for (const variant of scenario.variants) {
        const tr = element("tr");
        let found;
        try {
          const hints = api.runChecks(scenario, variant);
          validateHints(hints, variant);
          const clear = hints.filter(h => confidenceOf(h) === "clear");
          const unsure = hints.filter(h => confidenceOf(h) === "review");
          const checksHit = Array.from(new Set(hints.map(h => pretty(h.check_id))));
          found = hints.length
            ? [clear.length ? clear.length + " flagged" : "", unsure.length ? unsure.length + " unsure" : ""].filter(Boolean).join(", ") + " (" + checksHit.join(", ") + ")"
            : "No suggestions";
          tr.className = clear.length ? "row-flagged" : unsure.length ? "row-unsure" : "";
        } catch (error) { found = "Check error"; errors += 1; tr.className = "row-error"; }
        const bench = benchmarkRowFor(variant.id);
        const expert = bench ? ROW.expert(bench) : (variant.expert_label || "");
        const verdict = bench ? ROW.verdict(bench) : "";
        if (verdict) { compared += 1; if (verdict === "agree") agreeCount += 1; }
        const caseCell = element("td");
        const link = element("button", scenario.id, "link-button");
        link.type = "button";
        link.title = "Open " + scenario.id + " below";
        link.addEventListener("click", () => {
          select.value = scenario.id; showCase(); run();
          document.getElementById("comparison").scrollIntoView({ behavior: "smooth", block: "start" });
        });
        caseCell.append(link);
        const verdictCell = element("td");
        verdictCell.append(element("span", verdict ? (verdict === "agree" ? "Agree" : "Disagree") : "-", "verdict verdict-" + (verdict ? (verdict === "agree" ? "agree" : "other") : "none")));
        if (verdict && verdict !== "agree") tr.classList.add("row-disagree");
        tr.append(caseCell, element("td", variant.label || variant.id), element("td", pretty(scenario.goal)),
          element("td", expert ? pretty(expert) : "-"), element("td", found), verdictCell);
        table.tBodies[0].append(tr);
      }
    }
    const variantsCount = data.cases.reduce((n, c) => n + c.variants.length, 0);
    const note = compared
      ? data.cases.length + " cases, " + variantsCount + " examples run. Agree with experts on " + agreeCount + " of " + compared + " labelled examples."
      : data.cases.length + " cases, " + variantsCount + " examples run. Expert labels are not loaded yet.";
    box.append(element("p", note + (errors ? " " + errors + " check error(s)." : ""), "muted"), table);
  }

  if (!data || !api || !timeline || !review || !Array.isArray(data.cases) || !data.cases.length) {
    status.textContent = "Starter files are missing (data.js, student_checks.js, timeline.js or review.js). Check the script tags in index.html.";
    status.className = "error";
    runButton.disabled = true;
    return;
  }
  for (const scenario of data.cases) {
    const option = element("option", scenario.id + " / " + scenario.title);
    option.value = scenario.id;
    select.append(option);
  }
  const ready = api.checks.filter(c => c.implemented).length;
  document.getElementById("coverage").textContent = ready + " of " + api.checks.length + " checks implemented. See student_checks.js.";
  select.addEventListener("change", showCase);
  runButton.addEventListener("click", run);
  exportButton.addEventListener("click", download);
  document.getElementById("run-all").addEventListener("click", runAllCases);
  renderBenchmark();
  select.value = "CASE-04";
  showCase();
})();
