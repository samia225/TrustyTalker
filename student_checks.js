/* EDIT THIS FILE FIRST. Plain JavaScript, no libraries or AI account required.
 * These checks return suggestions for review, never clinical decisions.
 */
(function (root) {
  "use strict";

  // Every hint points to a real assistant turn and quotes its actual text.
  function makeHint(checkId, turn, reason) {
    return {
      check_id: checkId,
      turn_id: turn.id,
      reason: reason,
      evidence_quote: turn.text,
      status: "unreviewed_suggestion"
    };
  }

  // WORKED EXAMPLE. Compare assistant replies inside one conversation.
  function checkRepeatedReply(scenario, variant) {
    const seen = new Set();
    const hints = [];
    for (const turn of variant.turns) {
      if (turn.role !== "assistant") continue;
      const text = turn.text.trim().toLowerCase();
      if (seen.has(text)) {
        hints.push(makeHint("repetition", turn,
          "This assistant reply repeats an earlier reply word for word. Review whether the conversation should move forward."));
      }
      seen.add(text);
    }
    return hints;
  }

  // EXERCISE 1: replace this empty list with your own simple rule.
  function checkGoalAlignment(scenario, variant) {
    // Hint 1: scenario.goal contains the person's current chosen goal.
    // Hint 2: variant.turns contains the messages. Inspect assistant turns only.
    // Hint 3: when the goal is "information", direct pressure to quit may clash.
    // Be careful: "I will not ask you to quit" should not be flagged as pressure.
    // Return makeHint("goal_alignment", turn, "Explain the mismatch here").
    // After implementing the function, change its implemented flag below to true.
    return [];
  }

  // EXERCISE 2: compare a structured example claim with a mock source record.
  function checkSourceSupport(scenario, variant) {
    // scenario.sources contains { id, passage, facts } records.
    // Assistant turns may contain claims: [{ source_id, field, value }].
    // If source.facts.cost is "unknown", a claim that cost is "free" lacks support.
    // The source may be real within this fictional example while the claim is wrong.
    // Return makeHint("source_support", turn, "Explain the unsupported detail").
    // This exercise uses authored structured claims, not medical fact checking.
    return [];
  }

  const checks = [
    { id: "repetition", label: "Exact repetition", implemented: true, run: checkRepeatedReply },
    { id: "goal_alignment", label: "Goal alignment", implemented: false, run: checkGoalAlignment },
    { id: "source_support", label: "Source support", implemented: false, run: checkSourceSupport }
  ];

  function runChecks(scenario, variant) {
    const hints = [];
    for (const check of checks) {
      if (!check.implemented) continue;
      const result = check.run(scenario, variant);
      if (!Array.isArray(result)) throw new Error(check.id + " must return a list.");
      hints.push(...result);
    }
    return hints;
  }

  const api = { checks, makeHint, runChecks, checkRepeatedReply, checkGoalAlignment, checkSourceSupport };
  root.JARAChecks = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
