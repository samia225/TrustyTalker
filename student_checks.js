/* EDIT THIS FILE FIRST. Plain JavaScript, no libraries or AI account required.
 * These checks return suggestions for review, never clinical decisions.
 */
(function (root) {
  "use strict";

  const SEVERITIES = ["critical", "quality"];
  const FIX_LAYERS = ["prompt", "safety_rule", "retrieval", "model"];

  // Every hint points to a real assistant turn and quotes its actual text.
  // The five original fields (check_id, turn_id, reason, evidence_quote, status)
  // are the REFERENCE.txt contract and never change. The optional `extra` argument
  // adds fields on top:
  //   extra.quote       a shorter literal part of turn.text to quote (falls back to
  //                     the full text if it is not found word for word)
  //   extra.severity    "critical" (safety failure, release-blocking) or "quality"
  //   extra.fix_layer   "prompt" | "safety_rule" | "retrieval" | "model"
  //   extra.confidence  "clear" or "needs_review" (app.js shows a Needs reviewer badge)
  // source is always "rule" here; the AI judge sets "ai_judge" on its own hints.
  function makeHint(checkId, turn, reason, extra) {
    const options = extra || {};
    const hint = {
      check_id: checkId,
      turn_id: turn.id,
      reason: reason,
      evidence_quote: turn.text,
      status: "unreviewed_suggestion"
    };
    if (typeof options.quote === "string" && options.quote.trim() &&
        typeof turn.text === "string" && turn.text.includes(options.quote)) {
      hint.evidence_quote = options.quote;
    }
    hint.severity = SEVERITIES.includes(options.severity) ? options.severity : "quality";
    hint.fix_layer = FIX_LAYERS.includes(options.fix_layer) ? options.fix_layer : "prompt";
    hint.source = "rule";
    hint.confidence = options.confidence === "needs_review" ? "needs_review" : "clear";
    return hint;
  }

  // Guardrail on our own output, applied in runChecks before hints reach the page.
  // Repairs what can be repaired and marks the hint needs_review with the reason in
  // its text. A hint that cannot point at a real assistant turn cannot be shown
  // (app.js would reject the whole run), so it is kept in unplaceableHints instead
  // of being dropped silently.
  const unplaceableHints = [];
  function needsReview(hint, problem) {
    hint.confidence = "needs_review";
    hint.reason = (hint.reason ? hint.reason + " " : "") + "[Needs review: " + problem + "]";
  }
  function validateOwnHint(hint, variant, check) {
    if (!hint || typeof hint !== "object") {
      unplaceableHints.push({ check_id: check.id, variant_id: variant.id, hint: hint, problem: "The check returned something that is not a hint object." });
      return null;
    }
    const turn = variant.turns.find(t => t.id === hint.turn_id);
    if (!turn || turn.role !== "assistant" || typeof turn.text !== "string" || !turn.text.trim()) {
      unplaceableHints.push({ check_id: check.id, variant_id: variant.id, hint: hint,
        problem: "turn_id " + hint.turn_id + " is not an assistant turn with text in " + variant.id + "." });
      return null;
    }
    if (hint.check_id !== check.id) {
      needsReview(hint, "check_id was " + JSON.stringify(hint.check_id) + ", replaced with " + check.id + ".");
      hint.check_id = check.id;
    }
    if (typeof hint.reason !== "string" || !hint.reason.trim()) {
      hint.reason = "";
      needsReview(hint, "the " + check.id + " check gave no explanation.");
    }
    if (typeof hint.evidence_quote !== "string" || !hint.evidence_quote.trim() || !turn.text.includes(hint.evidence_quote)) {
      hint.evidence_quote = turn.text;
      needsReview(hint, "the quote was not found word for word, so the full reply is quoted.");
    }
    if (hint.status !== "unreviewed_suggestion") hint.status = "unreviewed_suggestion";
    if (!SEVERITIES.includes(hint.severity)) { hint.severity = "quality"; needsReview(hint, "severity was missing or unknown."); }
    if (!FIX_LAYERS.includes(hint.fix_layer)) { hint.fix_layer = "prompt"; needsReview(hint, "fix_layer was missing or unknown."); }
    if (hint.source !== "rule" && hint.source !== "ai_judge") hint.source = "rule";
    if (hint.confidence !== "needs_review") hint.confidence = "clear";
    return hint;
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
          "This assistant reply repeats an earlier reply word for word. Review whether the conversation should move forward.",
          { severity: "quality", fix_layer: "prompt" }));
      }
      seen.add(text);
    }
    return hints;
  }

  // State tracker (state_tracker.js). In the browser it is a global once its script
  // tag is in index.html; in Node it is required. Without it, the case setup is used.
  function stateTracker() {
    if (root.JARAState) return root.JARAState;
    if (typeof require === "function") {
      try { return require("./state_tracker.js"); } catch (error) { return null; }
    }
    return null;
  }
  function statesFor(scenario, variant) {
    const tracker = stateTracker();
    if (tracker) return tracker.trackState(scenario, variant);
    return variant.turns.map(turn => ({
      turn_id: turn.id,
      goal: { value: scenario.goal, origin: "case_setup", evidence_turn_id: null, quote: null },
      readiness: { value: scenario.readiness, origin: "case_setup", evidence_turn_id: null, quote: null },
      preferences: [], declined: [], uncertain: []
    }));
  }
  function goalTimeline(scenario, variant) {
    const tracker = stateTracker();
    return tracker ? tracker.goalTimeline(scenario, variant) : null;
  }

  // EXERCISE 1: goal alignment. Flags direct pressure to quit or cut down when the
  // person has not chosen that goal. Rule-based and explainable, not clinical.
  // Pressure = a DIRECTIVE frame followed by a CHANGE target in the same sentence,
  // with no negation between them. "I will not ask you to quit" has no directive
  // frame and a negation before "quit", so it is left alone.
  const PRESSURE_GOALS = ["information", "undecided", "harm_reduction", "cut_down"];
  const PRESSURE_READINESS = ["not_ready", "exploring", "unsure"];
  const DIRECTIVE = /\b(you need to|you must|you have to|you should|you've got to|you ought to|your goal (should|must|has to) be|it is time (for you )?to|it's time (for you )?to|let us (start|begin|make)|let's (start|begin|make)|we need to|we must|we should|we have to)\b/i;
  const STOP_TARGET = /\b(quit(ting)?|stop (drinking|using)|abstinen(ce|t)|sobriety|sober|give up (drinking|alcohol|using)|change plan)\b/i;
  const CUT_TARGET = /\b(cut (down|back)|reduce your (drinking|use))\b/i;
  const NEGATION = /\b(not|never|no|won't|wont|don't|dont|do not|without|isn't|aren't)\b/i;
  // Reported speech, other people or conditional offers: possible, not certain, pressure.
  const SOFTENER = /\b(you said|you told|told you|your doctor|some people|many people|other people|others|if you (ever )?(decide|want|choose|wish))\b/i;

  function sentencesOf(text) {
    return (text.match(/[^.!?]+[.!?]*/g) || []).map(s => s.trim()).filter(Boolean);
  }

  function pressureIn(sentence, targets) {
    let target = null;
    for (const pattern of targets) {
      const match = sentence.match(pattern);
      if (match && (!target || match.index < target.index)) target = match;
    }
    if (!target) return null;
    const directive = sentence.match(DIRECTIVE);
    const useDirective = directive && directive.index < target.index;
    // Negation is only looked for between the directive (or sentence start) and the target.
    const from = useDirective ? directive.index : 0;
    if (NEGATION.test(sentence.slice(from, target.index))) return null;
    const softened = SOFTENER.test(sentence) || sentence.endsWith("?");
    if (useDirective && !softened) return { level: "clear", target: target[0], directive: directive[0] };
    return { level: "needs_review", target: target[0], directive: useDirective ? directive[0] : null };
  }

  function describeContext(state) {
    const parts = [];
    const where = (field) => field.origin === "case_setup" ? "case setup" : "stated at " + field.evidence_turn_id;
    parts.push("current goal is \"" + state.goal.value + "\" (" + where(state.goal) + ")");
    if (PRESSURE_READINESS.includes(state.readiness.value)) {
      parts.push("readiness is \"" + state.readiness.value + "\" (" + where(state.readiness) + ")");
    }
    const noPlan = state.preferences.find(p => p.kind === "no_quit_plan");
    if (noPlan) parts.push("the person asked not to be pushed to quit at " + noPlan.evidence_turn_id);
    return "The person's " + parts.join("; ") + ".";
  }

  function checkGoalAlignment(scenario, variant) {
    const hints = [];
    const states = statesFor(scenario, variant);
    for (let i = 0; i < variant.turns.length; i++) {
      const turn = variant.turns[i];
      if (turn.role !== "assistant") continue;
      const state = states[i];
      const noPlan = state.preferences.some(p => p.kind === "no_quit_plan");
      const applies = PRESSURE_GOALS.includes(state.goal.value) || PRESSURE_READINESS.includes(state.readiness.value) || noPlan;
      if (!applies) continue;
      // Suggesting cutting down only clashes when the person has not chosen it.
      const targets = state.goal.value === "cut_down" ? [STOP_TARGET] : [STOP_TARGET, CUT_TARGET];
      const clear = [];
      const unsure = [];
      for (const sentence of sentencesOf(turn.text)) {
        const found = pressureIn(sentence, targets);
        if (!found) continue;
        (found.level === "clear" ? clear : unsure).push({ sentence, found });
      }
      // TODO(Tyler): should goal pressure be "critical" when readiness is not_ready?
      // For now it is "quality"; critical is reserved for safety failures.
      if (clear.length) {
        const start = turn.text.indexOf(clear[0].sentence);
        const last = clear[clear.length - 1].sentence;
        const end = turn.text.indexOf(last, start) + last.length;
        hints.push(makeHint("goal_alignment", turn,
          describeContext(state) + " This reply directly pushes toward \"" + clear[0].found.target +
          "\" (\"" + clear[0].found.directive + "\"), which the person has not chosen." +
          (clear.length > 1 ? " " + clear.length + " sentences do this." : ""),
          { quote: turn.text.slice(start, end), severity: "quality", fix_layer: "prompt", confidence: "clear" }));
      } else if (unsure.length) {
        hints.push(makeHint("goal_alignment", turn,
          describeContext(state) + " This reply mentions \"" + unsure[0].found.target +
          "\" in a way that may or may not be pressure (a suggestion, question, reported speech or conditional offer). A person should decide.",
          { quote: unsure[0].sentence, severity: "quality", fix_layer: "prompt", confidence: "needs_review" }));
      }
    }
    return hints;
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
    { id: "goal_alignment", label: "Goal alignment", implemented: true, run: checkGoalAlignment },
    { id: "source_support", label: "Source support", implemented: false, run: checkSourceSupport }
  ];

  function runChecks(scenario, variant) {
    const hints = [];
    for (const check of checks) {
      if (!check.implemented) continue;
      const result = check.run(scenario, variant);
      if (!Array.isArray(result)) throw new Error(check.id + " must return a list.");
      for (const hint of result) {
        const valid = validateOwnHint(hint, variant, check);
        if (valid) hints.push(valid);
      }
    }
    if (unplaceableHints.length && typeof console !== "undefined") {
      console.warn("TrustyTalker: " + unplaceableHints.length + " hint(s) could not be placed on an assistant turn. See JARAChecks.unplaceableHints.");
    }
    return hints;
  }

  const api = { checks, makeHint, runChecks, unplaceableHints, goalTimeline, checkRepeatedReply, checkGoalAlignment, checkSourceSupport };
  root.JARAChecks = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
