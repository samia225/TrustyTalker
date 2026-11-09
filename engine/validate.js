/* Validation (Person 1). Plain JavaScript, no libraries, no network.
 *
 * validateCases(data)        Input check, run before any check: unique IDs, every
 *                            turn has an ID, a role and text, goal and readiness come
 *                            from reference/support_choices.json, claims point to a
 *                            real source. Returns { ok, errors: [{ where, problem }] }.
 * validateHint(hint, variant) Output check for every flag, rule or AI judge: a real
 *                            assistant turn, a quote found word for word in it, an
 *                            explanation. Returns { ok, reason, problems }. A failing
 *                            hint goes to "needs review" with the reason; it is never
 *                            dropped silently (see judge/run_judge.js and student_checks.js).
 *
 * In the page, the cases in data.js are validated when the page loads and any problem
 * is listed at the top of the page. The page keeps working: validation never throws.
 */
(function (root) {
  "use strict";

  // Copied from reference/support_choices.json (the page cannot fetch JSON files).
  // tests/test_validate.js fails if this copy drifts from the JSON file.
  const GOALS = ["information", "harm_reduction", "cut_down", "stop", "find_treatment", "recovery_support", "undecided"];
  const STATED_READINESS = ["not_ready", "exploring", "ready_for_step", "making_changes", "maintaining_changes"];
  // Case setup may also say readiness was not given. "unsure" is allowed in a
  // state_update because the person may say they are unsure.
  const CASE_READINESS = STATED_READINESS.concat(["not_supplied"]);
  const UPDATE_READINESS = CASE_READINESS.concat(["unsure"]);
  const ROLES = ["user", "assistant"];
  const SEVERITIES = ["critical", "quality"];
  const FIX_LAYERS = ["prompt", "safety_rule", "retrieval", "model"];
  const SOURCES = ["rule", "ai_judge"];

  const isText = (value) => typeof value === "string" && value.trim() !== "";

  function validateCases(data) {
    const errors = [];
    const add = (where, problem) => errors.push({ where, problem });
    if (!data || !Array.isArray(data.cases)) {
      add("data.js", "No list of cases found (expected window.JARAData.cases).");
      return { ok: false, errors };
    }
    const seen = new Map(); // every case, variant and turn ID must be unique across the file
    const unique = (id, where) => {
      if (seen.has(id)) add(where, "ID " + JSON.stringify(id) + " is used more than once (also at " + seen.get(id) + ").");
      else seen.set(id, where);
    };
    data.cases.forEach((scenario, ci) => {
      const caseWhere = isText(scenario && scenario.id) ? scenario.id : "case #" + (ci + 1);
      if (!scenario || typeof scenario !== "object") { add(caseWhere, "Case is not an object."); return; }
      if (!isText(scenario.id)) add(caseWhere, "Case has no ID.");
      else unique(scenario.id, caseWhere);
      if (!GOALS.includes(scenario.goal)) add(caseWhere, "goal " + JSON.stringify(scenario.goal) + " is not in support_choices.json (" + GOALS.join(", ") + ").");
      if (!CASE_READINESS.includes(scenario.readiness)) add(caseWhere, "readiness " + JSON.stringify(scenario.readiness) + " is not in support_choices.json or \"not_supplied\".");
      const sources = Array.isArray(scenario.sources) ? scenario.sources : [];
      if (scenario.sources !== undefined && !Array.isArray(scenario.sources)) add(caseWhere, "sources must be a list.");
      const sourceIds = new Set(sources.map(s => s && s.id));
      if (!Array.isArray(scenario.variants) || !scenario.variants.length) { add(caseWhere, "Case has no variants."); return; }
      scenario.variants.forEach((variant, vi) => {
        const variantWhere = isText(variant && variant.id) ? variant.id : caseWhere + " variant #" + (vi + 1);
        if (!variant || typeof variant !== "object") { add(variantWhere, "Variant is not an object."); return; }
        if (!isText(variant.id)) add(variantWhere, "Variant has no ID.");
        else unique(variant.id, variantWhere);
        if (!Array.isArray(variant.turns) || !variant.turns.length) { add(variantWhere, "Variant has no turns."); return; }
        variant.turns.forEach((turn, ti) => {
          const turnWhere = isText(turn && turn.id) ? turn.id : variantWhere + " turn #" + (ti + 1);
          if (!turn || typeof turn !== "object") { add(turnWhere, "Turn is not an object."); return; }
          if (!isText(turn.id)) add(turnWhere, "Turn has no ID.");
          else unique(turn.id, turnWhere);
          if (!ROLES.includes(turn.role)) add(turnWhere, "role " + JSON.stringify(turn.role) + " must be \"user\" or \"assistant\".");
          if (!isText(turn.text)) add(turnWhere, "Turn has no text.");
          if (turn.claims !== undefined) {
            if (!Array.isArray(turn.claims)) add(turnWhere, "claims must be a list.");
            else turn.claims.forEach((claim, k) => {
              if (!claim || !isText(claim.source_id) || !isText(claim.field)) add(turnWhere, "claim #" + (k + 1) + " needs source_id and field.");
              else if (!sourceIds.has(claim.source_id)) add(turnWhere, "claim #" + (k + 1) + " points to source " + JSON.stringify(claim.source_id) + ", which is not in this case's sources.");
            });
          }
          const update = turn.state_update;
          if (update !== undefined) {
            if (turn.role !== "user") add(turnWhere, "state_update is only read on user turns; it is ignored here.");
            if (!update || typeof update !== "object") add(turnWhere, "state_update must be an object.");
            else {
              if (update.goal !== undefined && !GOALS.includes(update.goal)) add(turnWhere, "state_update.goal " + JSON.stringify(update.goal) + " is not in support_choices.json.");
              if (update.readiness !== undefined && !UPDATE_READINESS.includes(update.readiness)) add(turnWhere, "state_update.readiness " + JSON.stringify(update.readiness) + " is not in support_choices.json.");
            }
          }
        });
      });
    });
    return { ok: errors.length === 0, errors };
  }

  // Same rules for a rule hint and an AI judge hint. Never throws.
  function validateHint(hint, variant) {
    const problems = [];
    if (!hint || typeof hint !== "object") return { ok: false, reason: "the finding is not an object", problems: ["the finding is not an object"] };
    const turns = variant && Array.isArray(variant.turns) ? variant.turns : [];
    const turn = turns.find(t => t && t.id === hint.turn_id);
    if (!turn) problems.push("turn_id " + JSON.stringify(hint.turn_id) + " is not a turn in " + (variant && variant.id));
    else if (turn.role !== "assistant") problems.push("turn_id " + hint.turn_id + " is a " + turn.role + " turn, not an assistant reply");
    if (!isText(hint.evidence_quote)) problems.push("no quote");
    else if (turn && turn.role === "assistant" && !String(turn.text).includes(hint.evidence_quote)) problems.push("the quote is not found word for word in " + hint.turn_id);
    if (!isText(hint.reason)) problems.push("no explanation");
    if (!isText(hint.check_id)) problems.push("no check_id");
    if (hint.severity !== undefined && !SEVERITIES.includes(hint.severity)) problems.push("severity " + JSON.stringify(hint.severity) + " is not critical or quality");
    if (hint.fix_layer !== undefined && !FIX_LAYERS.includes(hint.fix_layer)) problems.push("fix_layer " + JSON.stringify(hint.fix_layer) + " is unknown");
    if (hint.source !== undefined && !SOURCES.includes(hint.source)) problems.push("source " + JSON.stringify(hint.source) + " is not rule or ai_judge");
    return { ok: problems.length === 0, reason: problems.join("; "), problems };
  }

  // ---- Page: list problems in data.js at the top of the page, never crash.
  function showProblems(result) {
    const main = document.getElementById("main-content") || document.body;
    if (!main) return;
    const old = document.getElementById("validation-problems");
    if (old) old.remove();
    if (result.ok) return;
    const box = document.createElement("section");
    box.id = "validation-problems";
    box.setAttribute("role", "alert");
    box.setAttribute("aria-labelledby", "validation-heading");
    const heading = document.createElement("h2");
    heading.id = "validation-heading";
    heading.className = "form-error";
    heading.textContent = "Case data problems (" + result.errors.length + "). Checks still run, but results for these cases may be wrong.";
    const list = document.createElement("ul");
    for (const error of result.errors) {
      const item = document.createElement("li");
      item.className = "form-error";
      item.textContent = error.where + ": " + error.problem;
      list.append(item);
    }
    box.append(heading, list);
    main.prepend(box);
  }

  const api = { validateCases, validateHint, GOALS, STATED_READINESS, CASE_READINESS, UPDATE_READINESS, lastResult: null };
  root.JARAValidate = api;

  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    const runOnPage = () => {
      try {
        api.lastResult = validateCases(root.JARAData);
        showProblems(api.lastResult);
        if (!api.lastResult.ok && typeof console !== "undefined") console.warn("TrustyTalker: case data problems", api.lastResult.errors);
      } catch (error) {
        if (typeof console !== "undefined") console.error("TrustyTalker: validation could not run", error);
      }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", runOnPage);
    else runOnPage();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
