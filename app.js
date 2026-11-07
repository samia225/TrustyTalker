/* Display and export plumbing. Most student work belongs in student_checks.js. */
(function () {
  "use strict";
  const data = window.JARAData;
  const api = window.JARAChecks;
  const select = document.getElementById("case-select");
  const runButton = document.getElementById("run-checks");
  const exportButton = document.getElementById("export-results");
  const status = document.getElementById("check-status");
  const summaryBar = document.getElementById("summary-bar");
  let report = null;
  // Reviewer decisions are kept apart from the automated hints. Key: variant|turn|check|index.
  let reviews = new Map();

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

  // ---- Goal timeline -----------------------------------------------------
  // Preferred source: JARAChecks.goalTimeline(scenario, variant) from student_checks.js,
  // returning either { turnId: goal } or [{ turn_id, goal }]. Fallbacks: turn.goal in
  // data.js, then the case-level scenario.goal.
  function goalsForVariant(scenario, variant) {
    let fromApi = null;
    if (typeof api.goalTimeline === "function") {
      try { fromApi = api.goalTimeline(scenario, variant); } catch (error) { fromApi = null; }
    }
    const lookup = new Map();
    if (Array.isArray(fromApi)) for (const item of fromApi) { if (item && item.turn_id) lookup.set(item.turn_id, item.goal); }
    else if (fromApi && typeof fromApi === "object") for (const [id, goal] of Object.entries(fromApi)) lookup.set(id, goal);
    let current = scenario.goal;
    return variant.turns.map(turn => {
      let value = lookup.get(turn.id);
      if (value && typeof value === "object") value = value.value || value.goal || null;
      if (value) current = value;
      else if (turn.goal) current = turn.goal;
      return current;
    });
  }

  function clearSummary() {
    summaryBar.replaceChildren();
    summaryBar.hidden = true;
  }

  function showCase() {
    const scenario = selectedCase();
    report = null;
    reviews = new Map();
    exportButton.disabled = true;
    status.className = "";
    status.textContent = "Run the checks to inspect this example. The unfinished checks are not evaluated.";
    clearSummary();
    document.getElementById("findings").replaceChildren();
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
      section.append(element("h3", variant.label));
      const goals = goalsForVariant(scenario, variant);
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
      let count = 0;
      for (const result of results) {
        result.hints.forEach((hint, index) => {
          count += 1;
          const level = confidenceOf(hint);
          const key = [result.variant_id, hint.turn_id, hint.check_id, index].join("|");
          const row = element("article", undefined, "finding finding-" + level);
          const heading = element("h3", result.variant_id + " / " + pretty(hint.check_id) + " ");
          heading.append(makeBadge(level));
          row.append(heading, element("p", hint.reason), element("blockquote", hint.evidence_quote),
            element("small", hint.turn_id + " | Automated suggestion, not a reviewed finding"),
            reviewControls(key, result.variant_id, hint));
          findings.append(row);
          const message = Array.from(document.querySelectorAll("[data-turn-id]")).find(node => node.dataset.turnId === hint.turn_id);
          if (message) {
            // A clear hint wins over an unsure one on the same turn.
            if (level === "clear") { message.classList.add("flagged"); message.classList.remove("flagged-review"); }
            else if (!message.classList.contains("flagged")) message.classList.add("flagged", "flagged-review");
          }
        });
      }
      markQuotes(results);
      renderSummary(scenario, results);
      status.className = "";
      status.textContent = count ? count + " suggestion" + (count === 1 ? "" : "s") + " to inspect. Unfinished checks remain unevaluated." : "No suggestions from the enabled checks. This is not a pass: read the examples and complete the unfinished checks.";
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
    return Array.from(document.querySelectorAll("#variants [data-turn-id]")).find(node => node.dataset.turnId === turnId);
  }
  function clearQuoteMarks() {
    for (const node of document.querySelectorAll("#variants [data-turn-id]")) {
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
    let flagged = 0, unsure = 0, clean = 0;
    for (const variant of scenario.variants) {
      const result = results.find(r => r.variant_id === variant.id);
      const hints = result ? result.hints : [];
      for (const turn of variant.turns) {
        if (turn.role !== "assistant") continue;
        const levels = hints.filter(h => h.turn_id === turn.id).map(confidenceOf);
        if (levels.includes("clear")) flagged += 1;
        else if (levels.length) unsure += 1;
        else clean += 1;
      }
    }
    summaryBar.replaceChildren(
      element("span", flagged + " flagged", "summary-item summary-flagged"),
      element("span", unsure + " unsure", "summary-item summary-unsure"),
      element("span", clean + " clean", "summary-item summary-clean"));
    summaryBar.title = "Counts assistant replies in both examples. Clean means no enabled check raised a suggestion. It is not a pass.";
    summaryBar.hidden = false;
  }

  // ---- Human review: confirmed / rejected / unsure + reason + evidence ----
  // Exact values requested by MCRC (Vatsal). Stored apart from the automated hint.
  const DECISIONS = [["confirmed", "Confirm"], ["rejected", "Reject"], ["unsure", "Unsure"]];
  function reviewControls(key, variantId, hint) {
    const box = element("div", undefined, "review");
    const group = element("div", undefined, "review-buttons");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Reviewer decision for " + hint.turn_id);

    const reason = element("textarea", undefined, "review-comment");
    reason.rows = 2;
    reason.placeholder = "Reason: why do you agree or disagree?";
    reason.setAttribute("aria-label", "Reviewer reason for " + hint.turn_id);
    const evidence = element("input", undefined, "review-evidence");
    evidence.type = "text";
    evidence.placeholder = "Evidence (leave blank to use the quoted text)";
    evidence.setAttribute("aria-label", "Reviewer evidence for " + hint.turn_id);

    const note = element("small", "Not reviewed yet", "review-note");
    const regression = element("button", "Save as regression case", "secondary regression-button");
    regression.type = "button";
    regression.hidden = true;
    regression.addEventListener("click", () => downloadRegression(key, variantId, hint));

    const saved = reviews.get(key);
    if (saved) { reason.value = saved.reason; evidence.value = saved.evidence; }

    function save(decision) {
      const previous = reviews.get(key) || {};
      reviews.set(key, {
        variant_id: variantId, turn_id: hint.turn_id, check_id: hint.check_id,
        decision: decision !== undefined ? decision : (previous.decision || null),
        reason: reason.value.trim(), evidence: evidence.value.trim(),
        reviewed_at: new Date().toISOString()
      });
      refresh();
    }
    function refresh() {
      const current = (reviews.get(key) || {}).decision || null;
      for (const button of group.querySelectorAll("button")) {
        button.setAttribute("aria-pressed", String(button.dataset.decision === current));
      }
      box.dataset.decision = current || "";
      note.textContent = current ? "Reviewer decision: " + current : "Not reviewed yet";
      regression.hidden = current !== "confirmed";
    }
    for (const [value, label] of DECISIONS) {
      const button = element("button", label, "review-button review-" + value);
      button.type = "button";
      button.dataset.decision = value;
      button.addEventListener("click", () => {
        const current = (reviews.get(key) || {}).decision;
        save(current === value ? null : value); // click again to undo
      });
      group.append(button);
    }
    reason.addEventListener("input", () => save());
    evidence.addEventListener("input", () => save());
    box.append(group, reason, evidence, note, regression);
    refresh();
    return box;
  }

  // human_review object for one hint, or null when nothing was entered.
  function humanReviewFor(key, hint) {
    const saved = reviews.get(key);
    if (!saved || (!saved.decision && !saved.reason && !saved.evidence)) return null;
    return {
      decision: saved.decision || null,
      reason: saved.reason,
      evidence: saved.evidence || hint.evidence_quote,
      reviewed_at: saved.reviewed_at
    };
  }

  // Builds the export. Every original field is kept as it was; each finding only
  // gains a separate human_review object, so automated and human judgement never mix.
  function buildExport() {
    const counts = { confirmed: 0, rejected: 0, unsure: 0, not_reviewed: 0 };
    const results = report.results.map(result => ({
      variant_id: result.variant_id,
      hints: result.hints.map((hint, index) => {
        const review = humanReviewFor([result.variant_id, hint.turn_id, hint.check_id, index].join("|"), hint);
        counts[review && review.decision ? review.decision : "not_reviewed"] += 1;
        return Object.assign({}, hint, { human_review: review });
      })
    }));
    return Object.assign({}, report, { human_review_summary: counts, results });
  }

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
    const review = humanReviewFor(key, hint);
    if (!variant || !review || review.decision !== "confirmed") return;
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
      human_review: review,
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
  // Uses JARABenchmark.run(data, checks) from benchmark.js (Samia), which returns
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

  if (!data || !api || !Array.isArray(data.cases) || !data.cases.length) {
    status.textContent = "Starter files are missing. Extract the full ZIP, then reopen index.html.";
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
