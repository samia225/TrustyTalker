/* Display, review and export (Person 3, Ghala). Checks live in student_checks.js and
 * checks/; similarity and state tracking in engine/. */
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
  // Prototype UI state: finding cards and turn comments by key, plus the active finding.
  let findingCards = [];          // [{ key, row, hint, variantId }]
  let turnComments = new Map();   // key -> inline comment button under the turn
  let activeIndex = -1;
  // WCAG 2.1.4: single-letter shortcuts can be switched off (e.g. for voice control users).
  let shortcutsOn = true;
  // Findings page filter: "all", "needs" (unsure or not reviewed) or "decided".
  let findingFilter = "all";

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
  function makeSeverityBadge(hint) {
    const value = String(hint.severity || "").toLowerCase();
    const badge = element("span", value === "critical" ? "Critical" : pretty(value), "badge badge-severity severity-" + value);
    badge.title = value === "critical" ? "Safety problem. Review this first." : "Lower-severity quality concern.";
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
    // Reviews are kept across cases (keys include the variant ID), so switching
    // cases no longer throws away a reviewer's work.
    exportButton.disabled = true;
    status.className = "";
    status.textContent = "Running the checks for this case...";
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
    const single = scenario.variants.length === 1;
    document.getElementById("comparison-heading").textContent = single ? "The conversation" : "Two possible conversations";
    document.querySelector(".comparison-heading > p").textContent = single
      ? "Read it. Does each reply follow the person's request?"
      : "Read both. Which reply follows the person's request?";
    const variants = document.getElementById("variants");
    variants.replaceChildren();
    variants.classList.toggle("single", single);
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
    clearPrototype();
    document.querySelectorAll(".turn.flagged").forEach(node => node.classList.remove("flagged", "flagged-review"));
    clearQuoteMarks();
    const judgeBox = document.getElementById("judge-compare");
    if (judgeBox) judgeBox.replaceChildren();
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
      // Keep each hint's original index (the review key and the export use it),
      // then show critical findings first.
      const ordered = [];
      for (const result of results) result.hints.forEach((hint, index) => ordered.push({ variantId: result.variant_id, hint, index }));
      // Within the same severity, Clear findings come before Needs-reviewer ones.
      ordered.sort((a, b) => severityRank(a.hint) - severityRank(b.hint) ||
        (confidenceOf(a.hint) === "clear" ? 0 : 1) - (confidenceOf(b.hint) === "clear" ? 0 : 1));
      const count = ordered.length;
      for (const { variantId, hint, index } of ordered) {
        const level = confidenceOf(hint);
        const key = [variantId, hint.turn_id, hint.check_id, index].join("|");
        const row = element("article", undefined, "finding finding-" + level + (isCritical(hint) ? " finding-critical" : ""));
        row.id = "finding-" + findingCards.length;
        row.tabIndex = -1;
        row.dataset.key = key;
        const heading = element("h3", variantId + " / " + pretty(hint.check_id) + " ");
        if (hint.severity) heading.append(makeSeverityBadge(hint), document.createTextNode(" "));
        heading.append(makeBadge(level));
        const meta = hint.turn_id + " | " + (hint.source === "ai_judge" ? "AI judge suggestion" : "Automated suggestion") +
          ", not a reviewed finding" + (hint.fix_layer ? " | Fix in: " + pretty(hint.fix_layer) : "");
        const back = element("button", "Show in conversation", "link-button back-to-turn");
        back.type = "button";
        back.addEventListener("click", () => focusTurn(hint.turn_id));
        row.append(heading, element("p", hint.reason), element("blockquote", hint.evidence_quote),
          element("small", meta), back, reviewControls(key, variantId, hint));
        row.addEventListener("focusin", () => setActive(findingCards.findIndex(f => f.key === key), false));
        row.addEventListener("click", () => setActive(findingCards.findIndex(f => f.key === key), false));
        findings.append(row);
        findingCards.push({ key, row, hint, variantId, level });
        const message = turnNode(hint.turn_id);
        if (message) {
          // A clear hint wins over an unsure one on the same turn.
          if (level === "clear") { message.classList.add("flagged"); message.classList.remove("flagged-review"); }
          else if (!message.classList.contains("flagged")) message.classList.add("flagged", "flagged-review");
        }
      }
      markQuotes(results);
      addTurnComments();
      renderSummary(scenario, results);
      renderJudgeComparison(scenario, results);
      buildFindingFilters();
      renderProgress();
      status.className = "";
      const critical = ordered.filter(o => isCritical(o.hint)).length;
      const anyUnfinished = api.checks.some(c => !c.implemented);
      status.textContent = count
        ? count + " suggestion" + (count === 1 ? "" : "s") + " to inspect" + (critical ? ", " + critical + " critical (shown first)" : "") + "." + (anyUnfinished ? " Unfinished checks remain unevaluated." : "")
        : "No suggestions from the enabled checks. This is not a pass: read the examples yourself" + (anyUnfinished ? " and complete the unfinished checks." : " too.");
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
        mark.title = "Go to the finding for these words";
        mark.tabIndex = 0;
        mark.setAttribute("role", "button");
        mark.dataset.turnId = turnId;
        const goToFinding = () => {
          const index = findingCards.findIndex(f => f.hint.turn_id === turnId && text.slice(r.start, r.end).includes(f.hint.evidence_quote));
          setActive(index >= 0 ? index : findingCards.findIndex(f => f.hint.turn_id === turnId), true);
        };
        mark.addEventListener("click", goToFinding);
        mark.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); goToFinding(); } });
        p.append(mark);
        cursor = r.end;
      }
      if (cursor < text.length) p.append(document.createTextNode(text.slice(cursor)));
    }
  }

  // ---- Prototype: inline comments, jump links, progress, shortcuts -------
  // Patterns borrowed from GitHub reviews (comment pinned under the turn),
  // Grammarly (click the marked words to open the explanation) and review
  // queues in AI evaluation tools (progress counter, keyboard shortcuts).
  function clearPrototype() {
    document.querySelectorAll(".turn-comments").forEach(node => node.remove());
    findingCards = [];
    turnComments = new Map();
    activeIndex = -1;
    const progress = document.getElementById("review-progress");
    if (progress) { progress.replaceChildren(); progress.hidden = true; }
    const filters = document.getElementById("finding-filters");
    if (filters) { filters.replaceChildren(); filters.hidden = true; }
    const empty = document.getElementById("findings-empty");
    if (empty) empty.hidden = true;
  }
  function flash(node) {
    node.classList.remove("flash");
    void node.offsetWidth; // restart the animation
    node.classList.add("flash");
  }
  function focusTurn(turnId) {
    const node = turnNode(turnId);
    if (!node) return;
    navigate("conversation", true);
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    flash(node);
  }
  function setActive(index, scroll) {
    if (index < 0 || index >= findingCards.length) return;
    findingCards.forEach((f, i) => f.row.classList.toggle("is-active", i === index));
    activeIndex = index;
    const { row } = findingCards[index];
    if (scroll) {
      navigate("findings", true);
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.focus({ preventScroll: true });
      flash(row);
    }
  }
  function decisionLabel(key) {
    const saved = reviews.get(key);
    return saved && saved.decision ? saved.decision : "not reviewed";
  }
  function addTurnComments() {
    findingCards.forEach((f, index) => {
      const node = turnNode(f.hint.turn_id);
      if (!node) return;
      let list = node.querySelector(".turn-comments");
      if (!list) { list = element("div", undefined, "turn-comments"); node.append(list); }
      const comment = element("button", undefined, "turn-comment turn-comment-" + f.level);
      comment.type = "button";
      comment.addEventListener("click", () => setActive(index, true));
      list.append(comment);
      turnComments.set(f.key, comment);
      updateTurnComment(f.key);
    });
  }
  function updateTurnComment(key) {
    const comment = turnComments.get(key);
    const card = findingCards.find(f => f.key === key);
    if (!comment || !card) return;
    const decision = decisionLabel(key);
    comment.replaceChildren(
      element("span", pretty(card.hint.check_id), "turn-comment-check"),
      element("span", card.level === "review" ? "Needs reviewer" : "Clear", "turn-comment-level"),
      element("span", decision, "turn-comment-decision decision-" + decision.replace(" ", "-")),
      element("span", "Review", "turn-comment-go"));
    comment.setAttribute("aria-label", pretty(card.hint.check_id) + " finding on " + card.hint.turn_id + ", " + decision + ". Go to review.");
  }
  function renderProgress() {
    const box = document.getElementById("review-progress");
    if (!box) return;
    const total = findingCards.length;
    if (!total) {
      box.hidden = true;
      updateFindingFilterCounts();
      const next = document.querySelector(".view-next:not(.view-prev)");
      if (next) next.textContent = "Go to findings";
      return;
    }
    const done = findingCards.filter(f => decisionLabel(f.key) !== "not reviewed").length;
    const bar = element("div", undefined, "progress-bar");
    const fill = element("div", undefined, "progress-fill");
    fill.style.width = Math.round(100 * done / total) + "%"; // CSSOM, allowed by the CSP
    bar.append(fill);
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", String(total));
    bar.setAttribute("aria-valuenow", String(done));
    bar.setAttribute("aria-label", "Findings reviewed");
    const keys = element("p", undefined, "shortcut-help");
    for (const [k, label] of [["J", "next"], ["K", "previous"], ["C", "confirm"], ["R", "reject"], ["U", "unsure"]]) {
      keys.append(element("kbd", k), document.createTextNode(" " + label + "  "));
    }
    const toggle = element("button", "Shortcuts", "shortcut-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-pressed", String(shortcutsOn));
    toggle.title = "Turn the single-letter keyboard shortcuts on or off";
    toggle.addEventListener("click", () => { shortcutsOn = !shortcutsOn; renderProgress(); });
    keys.classList.toggle("is-off", !shortcutsOn);
    keys.prepend(toggle);
    box.replaceChildren(element("strong", "Reviewed " + done + " of " + total), bar, keys);
    updateFindingFilterCounts();
    const next = document.querySelector(".view-next:not(.view-prev)");
    if (next) next.textContent = "Go to findings (" + (total - done) + " to review)";
    updateCaseList();
    updateHero();
    box.hidden = false;
  }
  document.addEventListener("keydown", event => {
    const tag = (event.target.tagName || "").toLowerCase();
    if (["input", "textarea", "select"].includes(tag) || event.metaKey || event.ctrlKey || event.altKey) return;
    const openDialog = document.getElementById("add-case-dialog");
    if (openDialog && openDialog.open) return;
    if (!shortcutsOn || !findingCards.length || currentView === "cases") return;
    const key = event.key.toLowerCase();
    if (key === "j" || key === "k") {
      event.preventDefault();
      const step = key === "j" ? 1 : -1;
      let i = activeIndex + step;
      while (i >= 0 && i < findingCards.length && findingCards[i].row.hidden) i += step;
      if (i >= 0 && i < findingCards.length) setActive(i, true);
    }
    else if (["c", "r", "u"].includes(key) && activeIndex >= 0) {
      const value = { c: "confirmed", r: "rejected", u: "unsure" }[key];
      const button = findingCards[activeIndex].row.querySelector('.review-button[data-decision="' + value + '"]');
      if (button) { event.preventDefault(); button.click(); }
    }
  });

  // ---- Findings filter: "Needs a decision" -------------------------------
  // Needs a decision = marked Unsure or not reviewed yet. A card that gets a
  // decision stays on screen until the filter is chosen again, so it never
  // disappears under the reviewer's pointer.
  const FINDING_FILTERS = [
    ["all", "All", () => true],
    ["needs", "Needs a decision", f => ["unsure", "not reviewed"].includes(decisionLabel(f.key))],
    ["critical", "Critical", f => isCritical(f.hint)],
    ["decided", "Decided", f => ["confirmed", "rejected"].includes(decisionLabel(f.key))]
  ];
  function buildFindingFilters() {
    const box = document.getElementById("finding-filters");
    if (!box) return;
    box.replaceChildren();
    box.hidden = !findingCards.length;
    if (!findingCards.length) return;
    for (const [key, label] of FINDING_FILTERS) {
      if (key === "critical" && !findingCards.some(f => isCritical(f.hint))) continue;
      const button = element("button", label, "filter-button");
      button.type = "button";
      button.dataset.filter = key;
      button.dataset.label = label;
      button.addEventListener("click", () => { findingFilter = key; applyFindingFilter(); });
      box.append(button);
    }
    if (!box.querySelector('[data-filter="' + findingFilter + '"]')) findingFilter = "all";
    applyFindingFilter();
  }
  function applyFindingFilter() {
    const test = (FINDING_FILTERS.find(f => f[0] === findingFilter) || FINDING_FILTERS[0])[2];
    let shown = 0;
    for (const card of findingCards) { card.row.hidden = !test(card); if (!card.row.hidden) shown += 1; }
    for (const button of document.querySelectorAll("#finding-filters .filter-button")) {
      button.setAttribute("aria-pressed", String(button.dataset.filter === findingFilter));
    }
    const empty = document.getElementById("findings-empty");
    if (empty) {
      empty.hidden = shown > 0 || !findingCards.length;
      empty.textContent = findingFilter === "needs" ? "Every finding in this case has a decision. Export when you are ready." : "No findings match this filter.";
    }
    updateFindingFilterCounts();
  }
  function updateFindingFilterCounts() {
    for (const button of document.querySelectorAll("#finding-filters .filter-button")) {
      const test = (FINDING_FILTERS.find(f => f[0] === button.dataset.filter) || FINDING_FILTERS[0])[2];
      button.textContent = button.dataset.label + " (" + findingCards.filter(test).length + ")";
    }
  }

  // ---- Import findings ---------------------------------------------------
  // Reviews live in this page only and vanish on refresh. Export saves them;
  // Import reads that exported file back and restores every human_review.
  // The file is read locally with FileReader; nothing is uploaded.
  function importFindings(file) {
    const note = document.getElementById("import-status");
    const say = (text, isError) => { note.textContent = text; note.className = isError ? "import-status error" : "import-status"; };
    if (!file) return;
    file.text().then(text => {
      let parsed;
      try { parsed = JSON.parse(text); } catch (error) { throw new Error("This file is not valid JSON."); }
      const reports = Array.isArray(parsed) ? parsed : [parsed];
      let restored = 0, skipped = 0, lastCase = null;
      for (const one of reports) {
        if (!one || one.schema_version !== "jara-junior-findings-1" || !Array.isArray(one.results)) {
          throw new Error("This is not a TrustyTalker findings export (schema jara-junior-findings-1).");
        }
        const scenario = data.cases.find(c => c.id === one.case_id);
        if (!scenario) { skipped += 1; continue; }
        lastCase = scenario.id;
        for (const result of one.results) {
          const variant = scenario.variants.find(v => v.id === result.variant_id);
          if (!variant || !Array.isArray(result.hints)) continue;
          let current = [];
          try { current = api.runChecks(scenario, variant); } catch (error) { current = []; }
          result.hints.forEach((hint, index) => {
            const hr = hint && hint.human_review;
            if (!hr) return;
            // Same position and same finding: use it. Otherwise find the finding by turn and check.
            let at = current[index] && current[index].turn_id === hint.turn_id && current[index].check_id === hint.check_id ? index : -1;
            if (at < 0) at = current.findIndex(h => h.turn_id === hint.turn_id && h.check_id === hint.check_id);
            if (at < 0) { skipped += 1; return; }
            const decision = ["confirmed", "rejected", "unsure"].includes(hr.decision) ? hr.decision : null;
            reviews.set([variant.id, hint.turn_id, hint.check_id, at].join("|"), {
              variant_id: variant.id, turn_id: hint.turn_id, check_id: hint.check_id, decision,
              reason: String(hr.reason || ""),
              evidence: hr.evidence && hr.evidence !== hint.evidence_quote ? String(hr.evidence) : "",
              reviewed_at: hr.reviewed_at || new Date().toISOString()
            });
            restored += 1;
          });
        }
      }
      if (lastCase) { openCase(lastCase); navigate("findings"); }
      say("Restored " + restored + " review" + (restored === 1 ? "" : "s") + (lastCase ? " for " + lastCase : "") + "." +
        (skipped ? " " + skipped + " could not be matched to the current checks and were left out." : ""), false);
    }).catch(error => say("Import failed: " + error.message, true));
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
        if (turnHints.some(isCritical)) critical += 1;
        const levels = turnHints.map(confidenceOf);
        if (levels.includes("clear")) flagged += 1;
        else if (levels.length) unsure += 1;
        else clean += 1;
      }
    }
    summaryBar.replaceChildren(
      ...(critical ? [element("span", critical + " critical", "summary-item summary-critical")] : []),
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
      note.textContent = current ? "Reviewer decision: " + current + ". Add a reason below." : "Choose Confirm, Reject or Unsure. A box for your reason appears next.";
      regression.hidden = current !== "confirmed";
      updateTurnComment(key);
      renderProgress();
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

  // ---- Rules vs AI judge -------------------------------------------------
  // Shown only when Fatima's judge_results.js is loaded (written by judge/run_judge.js
  // as window.JUDGE_RESULTS). Accepted shapes: { results: [{ case_id, variant_id, hints }] },
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
  function describeChecks(hints) {
    return hints.length ? Array.from(new Set(hints.map(h => pretty(h.check_id)))).join(", ") : "No flag";
  }
  function renderJudgeComparison(scenario, results) {
    const box = document.getElementById("judge-compare");
    if (!box) return;
    box.replaceChildren();
    const raw = judgeData();
    if (!raw || (!Array.isArray(raw) && !Array.isArray(raw.results))) {
      const judgeStatus = window.JUDGE_STATUS;
      if (judgeStatus && judgeStatus.status) box.append(element("p", "AI judge: " + (judgeStatus.note || pretty(judgeStatus.status)), "muted judge-note"));
      return;
    }
    box.append(element("h2", "Rules vs AI judge"),
      element("p", "Each assistant reply, with what the rule checks and the AI judge flagged. The judge only suggests; a reviewer decides.", "muted"));
    if (raw.status && raw.status !== "judge_run") box.append(element("p", "Test data only: " + (raw.note || "not a real judge run."), "muted judge-note"));
    const table = element("table", undefined, "grid-table");
    const head = element("tr");
    for (const h of ["Turn", "Rule checks", "AI judge", "Agree?"]) { const th = element("th", h); th.scope = "col"; head.append(th); }
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
        tr.append(element("td", turn.id), element("td", describeChecks(rules)), element("td", describeChecks(judge)), verdict);
        table.tBodies[0].append(tr);
      }
    }
    const scroller = element("div", undefined, "grid-scroll");
    scroller.append(table);
    box.append(scroller);
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

  // ---- Agreement with the answer key ------------------------------------
  // First choice: JARABenchmark.run(data, checks) from benchmark.js, returning
  // { agree, total, agreement_rate, rows }. Until that file exists, the page
  // scores itself against tests/expected.js (window.EXPECTED_LABELS), the
  // hand-written answer key labelled before the checks were run.
  // Match rule: an example agrees when the checks flag exactly the replies the
  // answer key flags (both empty counts as agreeing).
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
  function shortTurn(turnId) { return String(turnId).split("-").pop(); }
  function labelFor(turnIds, checkIds) {
    if (!turnIds.length) return "Nothing flagged";
    return "Flag " + turnIds.map(shortTurn).join(", ") + " (" + Array.from(new Set(checkIds)).map(pretty).join(", ") + ")";
  }
  function builtInBenchmark() {
    const key = window.EXPECTED_LABELS;
    if (!Array.isArray(key) || !key.length) return null;
    const byVariant = new Map(key.map(e => [e.variant_id, e]));
    const rows = [];
    let agree = 0, missed = 0, missedCritical = 0, extra = 0;
    for (const scenario of data.cases) {
      for (const variant of scenario.variants) {
        const expected = byVariant.get(variant.id);
        if (!expected) continue;
        let hints = [];
        try { hints = api.runChecks(scenario, variant); } catch (error) { hints = null; }
        const want = Array.from(new Set((expected.flags || []).map(f => f.turn_id)));
        const got = hints ? Array.from(new Set(hints.map(h => h.turn_id))) : [];
        const missing = want.filter(t => !got.includes(t));
        const surplus = got.filter(t => !want.includes(t));
        missed += missing.length;
        extra += surplus.length;
        missedCritical += (expected.flags || []).filter(f => missing.includes(f.turn_id) && f.severity === "critical")
          .map(f => f.turn_id).filter((t, i, all) => all.indexOf(t) === i).length;
        const same = hints && !missing.length && !surplus.length;
        if (same) agree += 1;
        const notes = [];
        if (!hints) notes.push("Check error.");
        if (missing.length) notes.push("Missed " + missing.map(shortTurn).join(", ") + ".");
        if (surplus.length) notes.push("Also flagged " + surplus.map(shortTurn).join(", ") + ".");
        rows.push({
          case_id: scenario.id, variant_id: variant.id,
          expert_label: labelFor(want, (expected.flags || []).map(f => f.check_id)),
          our_label: hints ? labelFor(got, hints.map(h => h.check_id)) : "Check error",
          verdict: same ? "agree" : (missing.length && got.length) || (surplus.length && want.length) ? "partial" : "disagree",
          note: notes.join(" ")
        });
      }
    }
    if (!rows.length) return null;
    return { agree, total: rows.length, agreement_rate: agree / rows.length, rows, missed, missedCritical, extra,
      source: "tests/expected.js" };
  }
  let benchmark = null;
  function loadBenchmark() {
    benchmark = null;
    const B = window.JARABenchmark;
    if (B && typeof B.run === "function") {
      try {
        benchmark = B.run(window.JARAData, window.JARAChecks);
        if (!benchmark || !Array.isArray(benchmark.rows)) throw new Error("JARABenchmark.run did not return rows.");
        benchmark.source = benchmark.source || "benchmark.js";
        return { ok: true };
      } catch (error) { benchmark = null; /* fall back to the answer key below */ }
    }
    benchmark = builtInBenchmark();
    return benchmark ? { ok: true } : { error: "Answer key not loaded. Check that tests/expected.js is in the folder and in index.html." };
  }
  function renderBenchmark() {
    const panel = document.getElementById("benchmark-panel");
    const loaded = loadBenchmark();
    panel.replaceChildren(element("h2", "Agreement with the answer key"));
    if (loaded.error) { panel.append(element("p", loaded.error, "muted")); return; }
    const { agree, total, agreement_rate } = benchmark;
    const score = element("div", undefined, "bench-score");
    score.append(element("span", formatRate(agreement_rate, agree, total), "bench-rate"),
      element("span", "Our checks flag exactly the replies the answer key flags in " + agree + " of " + total + " examples.", "bench-text"));
    panel.append(score);
    if (benchmark.missed !== undefined) {
      const misses = element("p", undefined, "bench-misses");
      misses.append(element("strong", benchmark.missed + " missed"), document.createTextNode(" (should have been flagged"),
        document.createTextNode(benchmark.missedCritical ? ", " + benchmark.missedCritical + " of them critical) · " : ") · "),
        element("strong", benchmark.extra + " extra"), document.createTextNode(" (flagged but not in the key)"));
      panel.append(misses);
    }
    panel.append(element("p", "Answer key: " + benchmark.source + ", labelled by the team before the checks ran. Not clinically validated.", "muted bench-source"));
    const details = element("details", undefined, "bench-details");
    details.append(element("summary", "Show each example (" + benchmark.rows.length + ")"));
    const table = element("table", undefined, "grid-table");
    const head = element("tr");
    for (const h of ["Case", "Example", "Answer key", "Our checks", "Verdict"]) { const th = element("th", h); th.scope = "col"; head.append(th); }
    table.append(element("thead"), element("tbody"));
    table.tHead.append(head);
    const order = { disagree: 0, partial: 1, agree: 2 };
    const rows = benchmark.rows.slice().sort((a, b) => (order[ROW.verdict(a)] ?? 1) - (order[ROW.verdict(b)] ?? 1));
    for (const row of rows) {
      const verdict = ROW.verdict(row);
      const tr = element("tr", undefined, verdict === "agree" ? "" : "row-disagree");
      tr.append(element("td", ROW.caseId(row)), element("td", ROW.variantId(row)),
        element("td", pretty(ROW.expert(row))), element("td", pretty(ROW.ours(row))));
      const cell = element("td");
      cell.append(element("span", verdict ? pretty(verdict) : "-", "verdict verdict-" + (verdict === "agree" ? "agree" : "other")));
      if (ROW.note(row)) cell.append(element("small", " " + ROW.note(row), "bench-note"));
      tr.append(cell);
      table.tBodies[0].append(tr);
    }
    const scroller = element("div", undefined, "grid-scroll");
    scroller.append(table);
    details.append(scroller);
    panel.append(details);
  }

  // ---- All-cases overview grid ------------------------------------------
  function benchmarkRowFor(variantId) {
    return benchmark ? benchmark.rows.find(r => ROW.variantId(r) === variantId) : null;
  }

  // ---- All cases table (also the case picker) ----------------------------
  // One row per example: case, example, goal, expert label, what our checks
  // found and whether that agrees with the expert. Click a row to open it.
  let caseFilter = "all";
  let gridRows = []; // [{ caseId, variantId, tr, flagged, unsure, disagree }]
  function reviewedCount(caseId) {
    let n = 0;
    for (const r of reviews.values()) if (r.decision && String(r.variant_id).startsWith(caseId + "-")) n += 1;
    return n;
  }
  const GRID_FILTERS = [
    ["all", "All", () => true],
    ["flagged", "Flagged", r => r.flagged || r.unsure],
    ["critical", "Critical", r => r.critical],
    ["disagree", "Disagreements", r => r.disagree],
    ["clean", "No suggestions", r => !r.flagged && !r.unsure && !r.error]
  ];
  function buildCaseList() {
    const box = document.getElementById("case-grid");
    box.replaceChildren();
    gridRows = [];
    const table = element("table", undefined, "grid-table all-cases-table");
    const caption = element("caption", "All cases. Choose a case to open it below.", "visually-hidden");
    const head = element("tr");
    for (const h of ["Case", "Example", "Goal", "Answer key", "What we found", "Agree?"]) {
      const th = element("th", h); th.scope = "col"; head.append(th);
    }
    table.append(caption, element("thead"), element("tbody"));
    table.tHead.append(head);
    let agree = 0, compared = 0;
    for (const scenario of data.cases) {
      scenario.variants.forEach((variant, vIndex) => {
        const tr = element("tr");
        tr.dataset.caseId = scenario.id;
        let found, flagged = false, unsure = false, error = false;
        try {
          const hints = api.runChecks(scenario, variant);
          validateHints(hints, variant);
          const clear = hints.filter(h => confidenceOf(h) === "clear").length;
          const maybe = hints.filter(h => confidenceOf(h) === "review").length;
          flagged = clear > 0; unsure = !flagged && maybe > 0;
          const names = Array.from(new Set(hints.map(h => pretty(h.check_id))));
          found = hints.length ? [clear ? clear + " flagged" : "", maybe ? maybe + " unsure" : ""].filter(Boolean).join(", ") + " (" + names.join(", ") + ")" : "No suggestions";
        } catch (err) { found = "Check error"; error = true; }
        tr.className = flagged ? "row-flagged" : unsure ? "row-unsure" : error ? "row-error" : "";
        const bench = benchmarkRowFor(variant.id);
        const expert = bench ? ROW.expert(bench) : (variant.expert_label || "");
        const verdict = bench ? ROW.verdict(bench) : "";
        if (verdict) { compared += 1; if (verdict === "agree") agree += 1; }
        const disagree = !!verdict && verdict !== "agree";
        let critical = false;
        try { critical = api.runChecks(scenario, variant).some(isCritical); } catch (err) { critical = false; }
        if (disagree) tr.classList.add("row-disagree");

        const caseCell = element("td");
        const open = element("button", scenario.id, "link-button case-open");
        open.type = "button";
        open.dataset.caseId = scenario.id;
        open.setAttribute("aria-label", "Open " + scenario.id + ", " + scenario.title + ", " + (variant.label || variant.id));
        open.addEventListener("click", event => { event.stopPropagation(); openCase(scenario.id, true); });
        caseCell.append(open);
        if (vIndex === 0 && scenario.origin === "reviewer_added") caseCell.append(element("span", "Added", "case-tag"));
        const verdictCell = element("td");
        verdictCell.append(element("span", verdict ? (verdict === "agree" ? "Agree" : verdict === "partial" ? "Partly" : "Disagree") : "-", "verdict verdict-" + (verdict ? (verdict === "agree" ? "agree" : "other") : "none")));
        const foundCell = element("td");
        if (critical) foundCell.append(element("span", "Critical", "badge badge-severity severity-critical"), document.createTextNode(" "));
        foundCell.append(document.createTextNode(found));
        tr.append(caseCell, element("td", variant.label || variant.id), element("td", pretty(scenario.goal || "")),
          element("td", expert ? pretty(expert) : "-"), foundCell, verdictCell);
        tr.addEventListener("click", () => openCase(scenario.id, true)); // mouse: whole row; keyboard: the case button
        table.tBodies[0].append(tr);
        gridRows.push({ caseId: scenario.id, variantId: variant.id, tr, flagged, unsure, error, disagree, critical });
      });
    }
    const examples = gridRows.length;
    const note = data.cases.length + " cases, " + examples + " examples run. " +
      (compared ? "Matches the answer key on " + agree + " of " + compared + " labelled examples." : "Answer key not loaded yet.");
    const filters = element("div", undefined, "grid-filters");
    filters.setAttribute("role", "group");
    filters.setAttribute("aria-label", "Show rows");
    for (const [key, label, test] of GRID_FILTERS) {
      const button = element("button", label + " (" + gridRows.filter(test).length + ")", "filter-button");
      button.type = "button";
      button.dataset.filter = key;
      button.addEventListener("click", () => { caseFilter = key; applyCaseFilter(); });
      filters.append(button);
    }
    const scroller = element("div", undefined, "grid-scroll");
    scroller.append(table);
    const empty = element("p", "No examples match this filter.", "muted case-list-empty");
    empty.id = "case-list-empty";
    box.append(element("p", note, "muted"), filters, scroller, empty);
    applyCaseFilter();
    updateCaseList();
  }
  function applyCaseFilter() {
    const test = (GRID_FILTERS.find(f => f[0] === caseFilter) || GRID_FILTERS[0])[2];
    let shown = 0;
    for (const row of gridRows) { row.tr.hidden = !test(row); if (!row.tr.hidden) shown += 1; }
    for (const button of document.querySelectorAll("#case-grid .filter-button")) {
      button.setAttribute("aria-pressed", String(button.dataset.filter === caseFilter));
    }
    const empty = document.getElementById("case-list-empty");
    if (empty) empty.hidden = shown > 0;
  }
  function updateCaseList() {
    for (const row of gridRows) {
      const current = row.caseId === select.value;
      row.tr.classList.toggle("is-current", current);
    }
    for (const button of document.querySelectorAll(".case-open")) {
      if (button.dataset.caseId === select.value) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
  }

  // ---- Hero: breadcrumb, live stats and the summary bar ------------------
  function updateHero() {
    const scenario = selectedCase();
    if (!scenario) return;
    const setText = (id, text) => { const node = document.getElementById(id); if (node) node.textContent = text; };
    setText("crumb-case", scenario.id);
    setText("sum-case", scenario.id + " · " + scenario.title);
    setText("sum-goal", pretty(scenario.goal || "-"));
    setText("sum-ready", pretty(scenario.readiness || "-"));
    const caseTotal = caseHints(scenario);
    setText("sum-reviewed", caseTotal ? reviewedCount(scenario.id) + " of " + caseTotal + " findings" : "Nothing to review");
    const examples = gridRows.length;
    const flagged = gridRows.filter(r => r.flagged || r.unsure).length;
    let reviewed = 0;
    for (const r of reviews.values()) if (r.decision) reviewed += 1;
    setText("hero-stats", data.cases.length + " cases · " + examples + " examples · " + flagged + " flagged · " + reviewed + " reviewed");
  }
  function caseHints(scenario) {
    let n = 0;
    for (const variant of scenario.variants) {
      try { n += api.runChecks(scenario, variant).length; } catch (error) { /* counted as an error in the table */ }
    }
    return n;
  }

  function openCase(id, scroll) {
    select.value = id;
    showCase();
    run();
    updateCaseList();
    updateHero();
    if (scroll) navigate("conversation");
  }

  // ---- Pages (same tab) --------------------------------------------------
  // Three pages share this one file: all cases, the conversation and the
  // findings. The address ends in #cases, #conversation or #findings, so the
  // browser's own Back button works and each page can be linked to.
  const VIEWS = { cases: "All cases", conversation: "Conversation", findings: "Findings" };
  let currentView = "cases";
  function viewFromHash() {
    const name = (location.hash || "").replace("#", "");
    return Object.prototype.hasOwnProperty.call(VIEWS, name) ? name : null;
  }
  function showView(name, keepScroll) {
    currentView = name;
    for (const view of document.querySelectorAll("[data-view]")) view.hidden = view.dataset.view !== name;
    for (const link of document.querySelectorAll("[data-nav]")) {
      if (link.dataset.nav === name) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    }
    const onCase = name !== "cases";
    document.getElementById("crumb-case-item").hidden = !onCase;
    document.getElementById("crumb-page-item").hidden = !onCase;
    document.getElementById("crumb-page").textContent = VIEWS[name];
    const title = document.getElementById("hero-title");
    title.textContent = name === "cases" ? "Review JARA conversations" : name === "conversation" ? "The conversation" : "Findings to review";
    document.title = (onCase ? VIEWS[name] + " · " + select.value + " · " : "") + "TrustyTalker";
    if (!keepScroll) {
      window.scrollTo(0, 0);
      const main = document.getElementById("main-content");
      if (main && document.activeElement !== main) main.focus({ preventScroll: true });
    }
  }
  function navigate(name, keepScroll) {
    if (currentView === name) return;
    if (("#" + name) !== location.hash) history.pushState(null, "", "#" + name);
    showView(name, keepScroll);
  }
  window.addEventListener("hashchange", () => { const v = viewFromHash(); if (v) showView(v); });
  window.addEventListener("popstate", () => { showView(viewFromHash() || "cases"); });

  // ---- Light / dark mode -------------------------------------------------
  // Follows the computer's setting until the person picks one; the choice is
  // remembered in this browser when storage is available.
  const themeButton = document.getElementById("theme-toggle");
  const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function storedTheme() { try { return localStorage.getItem("tt-theme"); } catch (error) { return null; } }
  function effectiveTheme() {
    const set = document.documentElement.dataset.theme;
    if (set === "dark" || set === "light") return set;
    return darkQuery && darkQuery.matches ? "dark" : "light";
  }
  function paintThemeButton() {
    // One fixed name ("Dark mode") plus a pressed state is how screen readers
    // expect a toggle; the switch drawn in CSS shows the same state visually.
    themeButton.setAttribute("aria-pressed", String(effectiveTheme() === "dark"));
  }
  const saved = storedTheme();
  if (saved === "dark" || saved === "light") document.documentElement.dataset.theme = saved;
  themeButton.addEventListener("click", () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("tt-theme", next); } catch (error) { /* storage unavailable: still works for this visit */ }
    paintThemeButton();
  });
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener("change", paintThemeButton);
  paintThemeButton();

  // ---- Add your own case -----------------------------------------------
  // Builds a case in the starter's format from typed lines (P: / J:). It lives
  // in this page only and is marked origin "reviewer_added".
  const dialog = document.getElementById("add-case-dialog");
  const addError = document.getElementById("add-error");
  let addOpener = null;
  function fillChoices(selectId, values, preferred) {
    const box = document.getElementById(selectId);
    box.replaceChildren();
    for (const value of values) {
      const option = element("option", pretty(value));
      option.value = value;
      box.append(option);
    }
    if (values.includes(preferred)) box.value = preferred;
  }
  function parseTurns(text, prefix) {
    const turns = [];
    let u = 0, a = 0;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const [index, line] of lines.entries()) {
      const match = line.match(/^([PJ])\s*:\s*(.+)$/i);
      if (!match) throw new Error("Line " + (index + 1) + " needs to start with P: or J:.");
      const role = match[1].toUpperCase() === "P" ? "user" : "assistant";
      const id = prefix + "-" + (role === "user" ? "U" + (++u) : "A" + (++a));
      turns.push({ id, role, text: match[2] });
    }
    if (!turns.some(t => t.role === "user") || !turns.some(t => t.role === "assistant")) {
      throw new Error("Each example needs at least one P: line and one J: line.");
    }
    return turns;
  }
  function nextCustomId() {
    let n = 1;
    while (data.cases.some(c => c.id === "CUSTOM-" + String(n).padStart(2, "0"))) n += 1;
    return "CUSTOM-" + String(n).padStart(2, "0");
  }
  function openAddCase() {
    addOpener = document.activeElement;
    const goals = Array.from(new Set(data.cases.map(c => c.goal))).filter(Boolean);
    const readiness = Array.from(new Set(data.cases.map(c => c.readiness))).filter(Boolean);
    fillChoices("add-goal", goals, "information");
    fillChoices("add-readiness", readiness, readiness[0]);
    addError.textContent = "";
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", "");
    document.getElementById("add-title").focus();
  }
  function closeAddCase() {
    if (dialog.close) dialog.close(); else dialog.removeAttribute("open");
    if (addOpener && addOpener.focus) addOpener.focus();
  }
  function saveAddCase() {
    const id = nextCustomId();
    const title = document.getElementById("add-title").value.trim() || "My case";
    const textA = document.getElementById("add-a").value;
    const textB = document.getElementById("add-b").value;
    try {
      const variants = [{ id: id + "-A", label: "Example A", turns: parseTurns(textA, id + "-A") }];
      if (textB.trim()) variants.push({ id: id + "-B", label: "Example B", turns: parseTurns(textB, id + "-B") });
      const scenario = {
        id, title,
        description: "Added by a reviewer in this page. Fictional, not saved to data.js.",
        goal: document.getElementById("add-goal").value,
        readiness: document.getElementById("add-readiness").value,
        sources: [], variants, origin: "reviewer_added"
      };
      data.cases.push(scenario);
      const option = element("option", scenario.id + " / " + scenario.title);
      option.value = scenario.id;
      select.append(option);
      buildCaseList();
      caseFilter = "all";
      applyCaseFilter();
      if (dialog.close) dialog.close(); else dialog.removeAttribute("open");
      ["add-title", "add-a", "add-b"].forEach(f => { document.getElementById(f).value = ""; });
      openCase(scenario.id, true);
      const item = document.querySelector('.case-open[data-case-id="' + scenario.id + '"]');
      if (item) item.focus({ preventScroll: true });
    } catch (error) {
      addError.textContent = error.message;
    }
  }
  document.getElementById("add-case").addEventListener("click", openAddCase);
  document.getElementById("run-all").addEventListener("click", () => { renderBenchmark(); buildCaseList(); });
  document.getElementById("add-case-close").addEventListener("click", closeAddCase);
  document.getElementById("add-cancel").addEventListener("click", closeAddCase);
  document.getElementById("add-save").addEventListener("click", saveAddCase);
  dialog.addEventListener("cancel", () => { setTimeout(() => { if (addOpener && addOpener.focus) addOpener.focus(); }, 0); });

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
  // Change case dropdown in the summary card: opens the case and stays on the
  // current page (no surprise page change while choosing, WCAG 3.2.2).
  select.addEventListener("change", () => {
    openCase(select.value);
    document.title = (currentView !== "cases" ? VIEWS[currentView] + " · " + select.value + " · " : "") + "TrustyTalker";
    const status = document.getElementById("case-switch-status");
    if (status) status.textContent = "Showing " + select.value + ".";
  });
  runButton.addEventListener("click", run);
  exportButton.addEventListener("click", download);
  const importInput = document.getElementById("import-file");
  document.getElementById("import-results").addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", () => { importFindings(importInput.files[0]); importInput.value = ""; });
  renderBenchmark();
  buildCaseList();
  openCase(data.cases.some(c => c.id === "CASE-01") ? "CASE-01" : data.cases[0].id);
  showView(viewFromHash() || "cases", true);
})();
