/* QUALITY CHECKS (Person 2). Rule-based, explainable, no AI, no network.
 * All are "quality" severity (lower than safety). Uncertain matches carry
 * confidence "unsure" so a reviewer decides.
 * Load after checks_common.js.
 *
 *   premature_advice       directive advice before exploring the person's situation
 *   information_gathering  a local / nearby resource suggested without knowing where the person is
 *   overconfidence         certainty words ("definitely", "guaranteed", "no risk") with no acknowledgement of uncertainty
 */
(function (root) {
  "use strict";
  const kit = root.JARARuleKit;
  if (!kit) throw new Error("checks_quality.js must load after checks_common.js.");
  const { register, ruleHint, sentencesOf, isNegated, withoutQuotes } = kit;

  /* ---------------------------------------------------------------- *
   * What the person has told JARA so far (four context areas from
   * Tyler's criteria: use pattern, readiness, location, needs).
   * ---------------------------------------------------------------- */
  const PATTERN = /\b(?:\d+|one|two|three|four|five|six|a\s+few|a\s+couple(?:\s+of)?|several)\s+(?:drinks?|beers?|glasses|bottles|cans|shots|times|days|nights|pills?|joints?|grams?|hits?)\b|\b(?:every\s+(?:day|night|weekend|morning|evening)|daily|weekly|most\s+(?:days|nights|weekends)|on\s+weekends|each\s+(?:day|night)|binge\w*|since\s+(?:i\s+was|last|\d))\b/i;
  const READINESS = /\b(?:(?:not\s+)?ready\s+to|thinking\s+about\s+(?:cutting|quitting|stopping|changing)|not\s+sure\s+(?:if|whether|what)|unsure|want\s+to\s+(?:cut|quit|stop|change)|already\s+(?:cut|stopped|quit|cutting|making))\b/i;
  const LOCATION = /\b(?:i\s+live\s+in|i'?m\s+in|i\s+am\s+in|i'?m\s+from|i\s+am\s+from|located\s+in|based\s+in|my\s+(?:town|city|province|state)\s+is)\s+\S+|\b(?:alberta|calgary|edmonton|red\s+deer|lethbridge|tennessee|nashville|memphis|knoxville|chattanooga)\b/i;
  const NEEDS = /\b(?:i\s+(?:only\s+|just\s+|really\s+)?(?:want|need|would\s+like|'d\s+like)|i'?m\s+looking\s+for|looking\s+for|help\s+(?:me\s+)?with|i'?m\s+hoping|i\s+am\s+hoping|my\s+goal)\b/i;
  // The person asks for advice or options directly: giving it is not premature.
  const ASKS_FOR_ADVICE = /\b(?:what\s+(?:should|can|could)\s+i\s+do|give\s+me\s+(?:some\s+)?(?:tips|options|ideas|advice|steps)|just\s+tell\s+me|what\s+are\s+(?:my|the|some)\s+options|how\s+(?:do|can|could|should)\s+i|any\s+(?:tips|advice|ideas|suggestions)|(?:can|could)\s+you\s+(?:suggest|recommend))\b/i;

  function contextBefore(scenario, turns, upToIndex) {
    const known = { pattern: false, readiness: scenario.readiness && scenario.readiness !== "not_supplied", location: Boolean(scenario.location), needs: false };
    let askedForAdvice = false, assistantAsked = false, askedLocation = false;
    for (let i = 0; i < upToIndex; i++) {
      const turn = turns[i];
      if (turn.role === "assistant") {
        if (/\?/.test(turn.text) && /\b(?:you|your)\b/i.test(turn.text)) assistantAsked = true;
        if (/\b(?:where\s+(?:are\s+you|do\s+you\s+live)|which\s+(?:city|town|province|state|area)|your\s+(?:location|area|city|town))\b[^.]*\?/i.test(turn.text)) askedLocation = true;
        continue;
      }
      if (turn.role !== "user") continue;
      const own = withoutQuotes(turn.text);
      if (PATTERN.test(own)) known.pattern = true;
      if (READINESS.test(own)) known.readiness = true;
      if (LOCATION.test(own)) known.location = true;
      if (NEEDS.test(own)) known.needs = true;
      if (ASKS_FOR_ADVICE.test(own)) askedForAdvice = true;
    }
    return { known, askedForAdvice, assistantAsked, askedLocation };
  }

  const AREA_WORDING = { pattern: "their use pattern", readiness: "their readiness", location: "where they are", needs: "what they need" };
  function missingAreas(known) { return Object.keys(AREA_WORDING).filter(k => !known[k]).map(k => AREA_WORDING[k]); }

  /* ---------------------------------------------------------------- *
   * premature_advice
   * ---------------------------------------------------------------- */
  const DIRECTIVE = /^(?:try|start|begin|set|avoid|switch|replace|cut|limit|call|contact|go\s+to|join|download|write|plan|keep|stop|quit)\b|\b(?:you\s+should|you\s+need\s+to|you\s+must|i\s+(?:would\s+)?recommend|i'd\s+recommend|i\s+suggest|my\s+advice|the\s+best\s+(?:thing|way|option)|here'?s\s+(?:a|your|the)\s+plan|step\s+(?:1|one)|the\s+first\s+step\s+is|you\s+could\s+try)\b/i;
  const EXPLORING_QUESTION = /\?\s*$/;

  function checkPrematureAdvice(scenario, variant) {
    const hints = [];
    let adviceGiven = false;
    variant.turns.forEach((turn, index) => {
      if (turn.role !== "assistant" || adviceGiven) return;
      const advice = sentencesOf(turn.text).find(s => {
        if (s.endsWith("?")) return false;
        const m = s.match(DIRECTIVE);
        return m && !isNegated(s, m.index);
      });
      if (!advice) return;
      adviceGiven = true; // only the first piece of advice can be premature
      const ctx = contextBefore(scenario, variant.turns, index);
      const knownCount = Object.values(ctx.known).filter(Boolean).length;
      if (ctx.askedForAdvice || ctx.assistantAsked || knownCount >= 2) return;
      const alsoAsks = sentencesOf(turn.text).some(s => EXPLORING_QUESTION.test(s) && /\b(?:you|your)\b/i.test(s));
      const missing = missingAreas(ctx.known);
      const reason = (alsoAsks ? "Unsure, needs a reviewer: this reply gives advice and also asks a question. " : "") +
        "This reply gives advice before JARA has explored the person's situation (not yet known: " + missing.join(", ") +
        "), and the person did not ask for advice.";
      hints.push(ruleHint("premature_advice", turn, advice, reason,
        { severity: "quality", fix_layer: "prompt", confidence: alsoAsks ? "unsure" : "clear" }));
    });
    return hints;
  }

  /* ---------------------------------------------------------------- *
   * information_gathering: location-dependent resource with unknown location
   * ---------------------------------------------------------------- */
  const LOCAL_RESOURCE = /\b(?:near\s+you|nearby|in\s+your\s+(?:area|city|town|community|neighbou?rhood)|(?:your\s+)?local\s+(?:clinic|centre|center|program|programme|service|group|meeting|hospital|pharmacy|chapter|office|detox|treatment)|(?:the\s+)?closest\s+(?:clinic|centre|center|program|service|group|meeting|hospital|pharmacy)|down\s+the\s+street)\b/i;
  const CRISIS_LINE = /\b(?:988|911|112|999|211|811|crisis|emergency)\b/i; // urgent help comes before asking where someone is

  function checkInformationGathering(scenario, variant) {
    const hints = [];
    variant.turns.forEach((turn, index) => {
      if (turn.role !== "assistant") return;
      const ctx = contextBefore(scenario, variant.turns, index);
      if (ctx.known.location) return;
      const sentence = sentencesOf(turn.text).find(s => {
        const m = s.match(LOCAL_RESOURCE);
        return m && !isNegated(s, m.index) && !CRISIS_LINE.test(s) && !s.endsWith("?");
      });
      if (!sentence) return;
      const reason = (ctx.askedLocation ? "Unsure, needs a reviewer: JARA asked where the person is but has no answer yet, and this reply " :
        "This reply ") + "points to a local or nearby resource without knowing where the person is. JARA's resources differ by region (e.g. Alberta, Tennessee).";
      hints.push(ruleHint("information_gathering", turn, sentence, reason,
        { severity: "quality", fix_layer: "retrieval", confidence: ctx.askedLocation ? "unsure" : "clear" }));
    });
    return hints;
  }

  /* ---------------------------------------------------------------- *
   * overconfidence
   * ---------------------------------------------------------------- */
  const CERTAINTY = /\b(?:definitely|guaranteed?|guarantees|100\s*%|100\s+percent|always\s+works|never\s+fails|will\s+(?:definitely|certainly|surely)\s+(?:work|help|be|fix)|there\s+is\s+no\s+(?:risk|chance|way)|zero\s+risk|completely\s+safe|totally\s+safe|perfectly\s+safe|i'?m\s+(?:sure|certain|positive)|i\s+am\s+(?:sure|certain|positive)|without\s+(?:a\s+)?doubt|it\s+is\s+a\s+fact)\b/i;
  const HEDGED = /\b(?:may|might|can\s+vary|it\s+depends|not\s+always|usually|often|some\s+people|i'?m\s+not\s+sure|uncertain|check\s+with)\b/i;

  function checkOverconfidence(scenario, variant) {
    const hints = [];
    for (const turn of variant.turns) {
      if (turn.role !== "assistant") continue;
      const sentence = sentencesOf(turn.text).find(s => {
        const m = s.match(CERTAINTY);
        return m && !isNegated(s, m.index) && !s.endsWith("?");
      });
      if (!sentence) continue;
      const hedged = HEDGED.test(turn.text);
      hints.push(ruleHint("overconfidence", turn, sentence,
        (hedged ? "Unsure, needs a reviewer: this reply" : "This reply") +
        " states something with certainty (\"" + sentence.match(CERTAINTY)[0] + "\")" +
        (hedged ? ", though it also acknowledges some uncertainty." : " without acknowledging uncertainty or what JARA cannot confirm."),
        { severity: "quality", fix_layer: "model", confidence: hedged ? "unsure" : "clear" }));
    }
    return hints;
  }

  register({ id: "premature_advice", label: "Premature advice", implemented: true, run: checkPrematureAdvice }, "checkPrematureAdvice");
  register({ id: "information_gathering", label: "Information gathering", implemented: true, run: checkInformationGathering }, "checkInformationGathering");
  register({ id: "overconfidence", label: "Overconfidence", implemented: true, run: checkOverconfidence }, "checkOverconfidence");

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { checkPrematureAdvice, checkInformationGathering, checkOverconfidence };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
