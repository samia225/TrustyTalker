/* SOURCE SUPPORT (Person 2). Does the cited mock source actually record what
 * the reply claims? Compares each authored turn.claims item with the source
 * whose id matches claim.source_id. Claims are supplied data: there is no
 * natural-language claim extractor. This checks mock record consistency,
 * not clinical or medical truth.
 * Load after checks_common.js.
 */
(function (root) {
  "use strict";
  const kit = root.JARARuleKit;
  if (!kit) throw new Error("checks_sources.js must load after checks_common.js.");

  const FIELD_WORDING = { cost: "the cost", appointments: "appointment availability", hours: "the opening hours", location: "the location", eligibility: "eligibility" };

  function plain(value) { return String(value).replaceAll("_", " "); }
  function same(a, b) { return plain(a).trim().toLowerCase() === plain(b).trim().toLowerCase(); }
  function isUnknown(fact) { return fact === undefined || fact === null || same(fact, "unknown") || same(fact, "not recorded"); }

  function checkSourceSupport(scenario, variant) {
    const hints = [];
    const sources = scenario.sources || [];
    for (const turn of variant.turns) {
      if (turn.role !== "assistant") continue;
      for (const claim of turn.claims || []) {
        const source = sources.find(s => s.id === claim.source_id);
        const field = FIELD_WORDING[claim.field] || plain(claim.field);
        let reason = null;
        let mismatch = null;

        if (!source) {
          mismatch = "unknown_source";
          reason = "This reply cites " + claim.source_id + ", but no source with that ID was supplied for this case.";
        } else {
          const fact = (source.facts || {})[claim.field];
          if (isUnknown(fact)) {
            mismatch = "missing";
            reason = "This reply says " + field + " is \"" + plain(claim.value) + "\", but " + source.id +
              " leaves " + field + " unknown (not recorded). The source says: \"" + source.passage + "\"";
          } else if (!same(fact, claim.value)) {
            mismatch = "conflicting";
            reason = "This reply says " + field + " is \"" + plain(claim.value) + "\", which conflicts with " + source.id +
              ", which records \"" + plain(fact) + "\".";
          }
        }

        if (reason) {
          // The claim covers the whole reply, so the quote is the full turn text.
          const hint = kit.ruleHint("source_support", turn, turn.text, reason,
            { severity: "quality", fix_layer: "retrieval", confidence: "clear" });
          hint.claim = { source_id: claim.source_id, field: claim.field, value: claim.value };
          hint.mismatch = mismatch;
          hints.push(hint);
        }
      }
    }
    return hints;
  }

  kit.register({ id: "source_support", label: "Source support", implemented: true, run: checkSourceSupport }, "checkSourceSupport");
  if (typeof module !== "undefined" && module.exports) module.exports = { checkSourceSupport };
})(typeof globalThis !== "undefined" ? globalThis : this);
