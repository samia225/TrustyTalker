/* Reviewer panel (Person 3). Confirm / reject / modify / unsure + comment + evidence.
 * Reviewer decisions are stored here, apart from the automated hints, and only
 * join the hint in the export as a separate human_review object.
 * Exposes window.JARAReview; app.js calls it.
 */
(function (root) {
  "use strict";

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  const DECISIONS = [["confirmed", "Confirm"], ["rejected", "Reject"], ["modified", "Modify"], ["unsure", "Unsure"]];
  // Key: variant|turn|check|index. Cleared whenever the case changes.
  let reviews = new Map();

  function keyFor(variantId, hint, index) { return [variantId, hint.turn_id, hint.check_id, index].join("|"); }
  function reset() { reviews = new Map(); }

  // Builds the controls for one hint. onSaveRegression(key) is called by the
  // "Save as regression case" button, shown once the hint is confirmed or modified.
  function controls(key, variantId, hint, onSaveRegression) {
    const box = element("div", undefined, "review");
    const group = element("div", undefined, "review-buttons");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Reviewer decision for " + hint.turn_id);

    const reason = element("textarea", undefined, "review-comment");
    reason.rows = 2;
    reason.placeholder = "Comment: why do you agree or disagree?";
    reason.setAttribute("aria-label", "Reviewer comment for " + hint.turn_id);
    const evidence = element("input", undefined, "review-evidence");
    evidence.type = "text";
    evidence.placeholder = "Evidence (leave blank to use the quoted text)";
    evidence.setAttribute("aria-label", "Reviewer evidence for " + hint.turn_id);

    const note = element("small", "Not reviewed yet", "review-note");
    const regression = element("button", "Save as regression case", "secondary regression-button");
    regression.type = "button";
    regression.hidden = true;
    regression.addEventListener("click", () => onSaveRegression(key));

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
      reason.placeholder = current === "modified"
        ? "What should change? For example a different turn, check or severity."
        : "Comment: why do you agree or disagree?";
      note.textContent = current ? "Reviewer decision: " + current : "Not reviewed yet";
      regression.hidden = current !== "confirmed" && current !== "modified";
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

  // Copies the report and gives every hint its own human_review object.
  // Original hint fields are never changed.
  function attachToReport(report) {
    const counts = { confirmed: 0, rejected: 0, modified: 0, unsure: 0, not_reviewed: 0 };
    const results = report.results.map(result => ({
      variant_id: result.variant_id,
      hints: result.hints.map((hint, index) => {
        const review = humanReviewFor(keyFor(result.variant_id, hint, index), hint);
        counts[review && review.decision ? review.decision : "not_reviewed"] += 1;
        return Object.assign({}, hint, { human_review: review });
      })
    }));
    return Object.assign({}, report, { human_review_summary: counts, results });
  }

  root.JARAReview = { DECISIONS, keyFor, reset, controls, humanReviewFor, attachToReport };
})(typeof globalThis !== "undefined" ? globalThis : this);
