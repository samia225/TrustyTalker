/* Display and export plumbing. Most student work belongs in student_checks.js. */
(function () {
  "use strict";
  const data = window.JARAData;
  const api = window.JARAChecks;
  const select = document.getElementById("case-select");
  const runButton = document.getElementById("run-checks");
  const exportButton = document.getElementById("export-results");
  const status = document.getElementById("check-status");
  let report = null;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function selectedCase() { return data.cases.find(item => item.id === select.value); }

  function showCase() {
    const scenario = selectedCase();
    report = null;
    exportButton.disabled = true;
    status.className = "";
    status.textContent = "Run the checks to inspect this example. The unfinished checks are not evaluated.";
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
      for (const turn of variant.turns) {
        const message = element("div", undefined, "turn " + turn.role);
        message.dataset.turnId = turn.id;
        message.append(element("strong", turn.role === "user" ? "Person" : "Assistant"), element("p", turn.text), element("span", turn.id, "turn-id"));
        if ((turn.claims || []).length) {
          message.append(element("span", "Source cited: " + turn.claims.map(c => c.source_id).join(", "), "turn-id"));
        }
        section.append(message);
      }
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
    document.querySelectorAll(".turn.flagged").forEach(node => node.classList.remove("flagged"));
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
        for (const hint of result.hints) {
          count += 1;
          const row = element("article", undefined, "finding");
          row.append(element("h3", result.variant_id + " / " + hint.check_id.replaceAll("_", " ")),
            element("p", hint.reason), element("blockquote", hint.evidence_quote),
            element("small", hint.turn_id + " | Automated suggestion, not a reviewed finding"));
          findings.append(row);
          const message = Array.from(document.querySelectorAll("[data-turn-id]")).find(node => node.dataset.turnId === hint.turn_id);
          if (message) message.classList.add("flagged");
        }
      }
      status.className = "";
      status.textContent = count ? count + " suggestion" + (count === 1 ? "" : "s") + " to inspect. Unfinished checks remain unevaluated." : "No suggestions from the enabled checks. This is not a pass: read the examples and complete the unfinished checks.";
      exportButton.disabled = false;
    } catch (error) {
      status.className = "error";
      status.textContent = "Check error: " + error.message + " Review student_checks.js, save it and refresh this page.";
    }
  }

  function download() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2) + "\n"], { type: "application/json" });
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
