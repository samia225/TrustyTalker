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
      if (lookup.has(turn.id) && lookup.get(turn.id)) current = lookup.get(turn.id);
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
      renderSummary(scenario, results);
      status.className = "";
      status.textContent = count ? count + " suggestion" + (count === 1 ? "" : "s") + " to inspect. Unfinished checks remain unevaluated." : "No suggestions from the enabled checks. This is not a pass: read the examples and complete the unfinished checks.";
      exportButton.disabled = false;
    } catch (error) {
      status.className = "error";
      status.textContent = "Check error: " + error.message + " Review student_checks.js, save it and refresh this page.";
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

  // ---- Review buttons + comment -----------------------------------------
  const DECISIONS = [["confirm", "Confirm"], ["reject", "Reject"], ["unsure", "Unsure"]];
  function reviewControls(key, variantId, hint) {
    const box = element("div", undefined, "review");
    const group = element("div", undefined, "review-buttons");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Reviewer decision for " + hint.turn_id);
    const comment = element("textarea", undefined, "review-comment");
    comment.rows = 2;
    comment.placeholder = "Add a comment (optional)";
    comment.setAttribute("aria-label", "Reviewer comment for " + hint.turn_id);
    const note = element("small", "Not reviewed yet", "review-note");

    const saved = reviews.get(key);
    if (saved) comment.value = saved.comment;

    function save(decision) {
      const previous = reviews.get(key) || {};
      reviews.set(key, {
        variant_id: variantId, turn_id: hint.turn_id, check_id: hint.check_id,
        decision: decision !== undefined ? decision : (previous.decision || null),
        comment: comment.value.trim(), reviewed_at: new Date().toISOString()
      });
      refresh();
    }
    function refresh() {
      const current = (reviews.get(key) || {}).decision || null;
      for (const button of group.querySelectorAll("button")) {
        button.setAttribute("aria-pressed", String(button.dataset.decision === current));
      }
      box.dataset.decision = current || "";
      note.textContent = current ? "Reviewer: " + current : "Not reviewed yet";
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
    comment.addEventListener("input", () => save());
    box.append(group, comment, note);
    refresh();
    return box;
  }

  function reviewerDecisions() {
    return Array.from(reviews.values()).filter(r => r.decision || r.comment);
  }

  function download() {
    if (!report) return;
    // Human judgement is exported next to, never merged into, the automated hints.
    const decisions = reviewerDecisions();
    const output = Object.assign({}, report, {
      reviewer_decisions: decisions,
      reviewer_summary: {
        confirm: decisions.filter(d => d.decision === "confirm").length,
        reject: decisions.filter(d => d.decision === "reject").length,
        unsure: decisions.filter(d => d.decision === "unsure").length,
        undecided: report.results.reduce((n, r) => n + r.hints.length, 0) - decisions.filter(d => d.decision).length
      }
    });
    const blob = new Blob([JSON.stringify(output, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = element("a");
    link.href = url;
    link.download = report.case_id + "-findings.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  select.value = "CASE-04";
  showCase();
})();
