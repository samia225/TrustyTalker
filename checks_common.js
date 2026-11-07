/* Shared helpers for the extra check files (checks_sources.js, checks_safety.js,
 * checks_quality.js). Plain JavaScript, no network, no AI.
 * Load AFTER student_checks.js and BEFORE the extra check files.
 */
(function (root) {
  "use strict";
  const J = root.JARAChecks;
  if (!J) throw new Error("checks_common.js must load after student_checks.js.");

  // Add a check to JARAChecks.checks, replacing a placeholder with the same ID.
  // Also exposes the function on JARAChecks (e.g. JARAChecks.checkSourceSupport).
  function register(check, functionName) {
    const index = J.checks.findIndex(c => c.id === check.id);
    if (index >= 0) J.checks[index] = check; else J.checks.push(check);
    if (functionName) J[functionName] = check.run;
  }

  // Build a hint with the starter fields plus the agreed extra fields.
  // The quote must appear word for word in the turn; if it does not, fall back
  // to the full turn text so the hint is never invalid.
  function ruleHint(checkId, turn, quote, reason, extra) {
    const hint = J.makeHint(checkId, turn, reason);
    if (quote && turn.text.includes(quote)) hint.evidence_quote = quote;
    hint.severity = extra.severity;          // "critical" | "quality"
    hint.fix_layer = extra.fix_layer;        // "prompt" | "safety_rule" | "retrieval" | "model"
    hint.source = "rule";                    // "rule" | "ai_judge"
    hint.confidence = extra.confidence || "clear"; // "clear" | "unsure" (unsure = needs review)
    return hint;
  }

  // Sentences with their exact text, so a sentence is always a valid quote.
  function sentencesOf(text) {
    return (text.match(/[^.!?]+[.!?]*/g) || [text]).map(s => s.trim()).filter(Boolean);
  }

  // Negation in the same clause, before the matched phrase.
  // "It is not safe to mix" is negated; "Mixing is safe, not risky" is not.
  const NEGATION = /\b(?:not|never|no|don't|do not|won't|doesn't|isn't|aren't|can't|cannot|shouldn't|nobody)\b|n't\b/i;
  function isNegated(sentence, matchIndex) {
    const before = sentence.slice(0, matchIndex);
    const clauseStart = Math.max(before.lastIndexOf(","), before.lastIndexOf(";"), before.toLowerCase().lastIndexOf(" but "));
    return NEGATION.test(before.slice(clauseStart + 1));
  }

  // Text inside quotation marks is someone else's words.
  function withoutQuotes(text) {
    return text.replace(/"[^"]*"|“[^”]*”/g, " ");
  }

  // First sentence of `text` matching `pattern` that is not negated, or null.
  function findSentence(text, pattern, options) {
    const allowNegated = options && options.allowNegated;
    for (const sentence of sentencesOf(text)) {
      const m = sentence.match(pattern);
      if (m && (allowNegated || !isNegated(sentence, m.index))) return { sentence, match: m[0] };
    }
    return null;
  }

  // Shorten a person's words for use inside a reason.
  function brief(text, max) {
    const limit = max || 90;
    const t = text.trim();
    return t.length <= limit ? t : t.slice(0, limit - 3).trimEnd() + "...";
  }

  root.JARARuleKit = { register, ruleHint, sentencesOf, isNegated, withoutQuotes, findSentence, brief };
  if (typeof module !== "undefined" && module.exports) module.exports = root.JARARuleKit;
})(typeof globalThis !== "undefined" ? globalThis : this);
