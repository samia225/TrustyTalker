/* State tracker. Plain JavaScript, no libraries, no network.
 * Tracks what the person has said at every turn: goal, readiness, preferences and
 * declined items. The newest statement wins. Rule-based phrase matching only; it
 * reads fictional data and never makes clinical judgements.
 *
 * STARTING STATE: scenario.goal and scenario.readiness (case setup).
 *
 * AUTHORED OVERRIDE (used until Vatsal confirms how changes should be represented).
 * A USER turn may carry an optional state_update object. It beats inference from
 * that turn's text. Every field is optional:
 *   state_update: {
 *     goal: "information",            // a goal id from reference/support_choices.json
 *     readiness: "not_ready",         // a stated_readiness id, or "unsure"
 *     preferences: ["shorter"],       // added to the active preferences
 *     declined: ["screening"]         // added to the declined items
 *   }
 * Values outside the vocabulary are ignored and recorded in `uncertain`.
 * state_update on an assistant turn is ignored: only the person sets their state.
 *
 * OUTPUT of trackState(scenario, variant): one snapshot per turn, in turn order.
 * The snapshot at an assistant turn is the state in effect when that reply was given.
 *   {
 *     turn_id: "CASE-01-B-A2",
 *     goal:      { value, origin: "case_setup"|"user_text"|"authored", evidence_turn_id, quote },
 *     readiness: { same shape; value may be "unsure" or "not_supplied" },
 *     preferences: [ { kind, origin, evidence_turn_id, quote } ],
 *     declined:    [ { item, origin, evidence_turn_id, quote } ],
 *     uncertain:   [ { turn_id, note, quote } ]   // things deliberately NOT applied
 *   }
 */
(function (root) {
  "use strict";

  // Copied from reference/support_choices.json (the page cannot fetch JSON files).
  const GOALS = ["information", "harm_reduction", "cut_down", "stop", "find_treatment", "recovery_support", "undecided"];
  const READINESS = ["not_ready", "exploring", "ready_for_step", "making_changes", "maintaining_changes", "unsure", "not_supplied"];

  // Phrase lists, checked in order; the first match inside a clause is used.
  const GOAL_PHRASES = [
    ["information", /\b(only|just) (want|need|looking for|after) (some |more )?information\b|\binformation only\b|\bjust (want|need) to (learn|know)\b/i],
    ["harm_reduction", /\bharm reduction\b|\b(use|using|drink|drinking) (more )?safely\b/i],
    ["cut_down", /\bI (want|would like|have decided|plan|am trying|'m trying) to cut (down|back)\b/i],
    ["stop", /\bI (want|would like|have decided|plan|am ready|'m ready) to (quit|stop (drinking|using))\b/i],
    ["find_treatment", /\bI (want|would like|need) (to find|help finding|help to find) (a |some )?(treatment|program|programme|rehab)\b/i],
    ["recovery_support", /\b(want|need|looking for) recovery support\b/i],
    ["undecided", /\b(I am|I'm) (still )?(not sure|unsure) what I want\b/i]
  ];
  const READINESS_PHRASES = [
    ["not_ready", /\b(I am|I'm) not ready\b/i],
    ["exploring", /\b(I am|I'm) (just |only )?(exploring|looking at) (my )?options\b/i],
    ["ready_for_step", /\b(I am|I'm) ready to (try|take) (a |one )?(small )?step\b/i],
    ["making_changes", /\b(I am|I'm) already (making changes|cutting (down|back))\b/i],
    ["maintaining_changes", /\b(I am|I'm) (maintaining|keeping up) (the )?changes\b/i],
    ["unsure", /\b(I am|I'm) (still )?(unsure|not sure)\b/i]
  ];
  const PREFERENCE_PHRASES = [
    ["shorter", /\b(make (that|it|this)( \w+)? shorter|shorter (please|answers?|replies|reply)|keep it (short|brief)|be (more )?brief|less text)\b/i],
    ["no_quit_plan", /\b(do not|don't|dont) (turn this into|make this into|make this|give me|start) (a |an )?(plan to quit|quit(ting)? plan|abstinence plan)\b|\b(do not|don't|dont) (ask|tell|push|pressure) me to (quit|stop)\b|\bI (do not|don't|dont) want to (quit|stop)\b/i]
  ];
  const DECLINE_WORDS = /\b(no thanks|no thank you|rather not|do not want|don't want|dont want|skip|not now|decline|not comfortable)\b/i;
  const DECLINE_ITEMS = [
    ["screening", /\b(screening|questionnaire|assessment|survey)\b/i],
    ["referral", /\breferral\b/i],
    ["questions", /\bquestions?\b/i]
  ];
  // A clause reporting someone or something else ("my friend said", "my old setup
  // says") does not describe the speaker's own current state.
  const REPORTED = /\b(said|says|told|tells|thinks|suggested|suggests)\b/i;
  const SELF_REPORT = /\bI (said|told|think|thought)\b/i;
  const QUOTED = /"[^"]*"|“[^”]*”/g;

  function initialState(scenario) {
    const readiness = scenario.readiness || "not_supplied";
    return {
      goal: { value: scenario.goal || null, origin: "case_setup", evidence_turn_id: null, quote: null },
      readiness: { value: readiness, origin: "case_setup", evidence_turn_id: null, quote: null },
      preferences: [],
      declined: [],
      uncertain: []
    };
  }

  function copyState(state, turnId) {
    return {
      turn_id: turnId,
      goal: Object.assign({}, state.goal),
      readiness: Object.assign({}, state.readiness),
      preferences: state.preferences.map(p => Object.assign({}, p)),
      declined: state.declined.map(d => Object.assign({}, d)),
      uncertain: state.uncertain.map(u => Object.assign({}, u))
    };
  }

  // Newest statement of the same kind replaces the older one.
  function addUnique(list, key, entry) {
    const index = list.findIndex(item => item[key] === entry[key]);
    if (index >= 0) list.splice(index, 1);
    list.push(entry);
  }

  // Split into clauses so "old setup says X, but today I want Y" keeps Y.
  function clauses(text) {
    return text.split(/[.!?;]+|\bbut\b|\bhowever\b/i).map(c => c.trim()).filter(Boolean);
  }

  function firstMatch(phrases, clause) {
    for (const [value, pattern] of phrases) {
      const match = clause.match(pattern);
      if (match) return { value, quote: match[0] };
    }
    return null;
  }

  function applyAuthored(state, turn) {
    const update = turn.state_update;
    if (!update || typeof update !== "object") return;
    const note = (text) => state.uncertain.push({ turn_id: turn.id, note: text, quote: null });
    if (update.goal !== undefined) {
      if (GOALS.includes(update.goal)) state.goal = { value: update.goal, origin: "authored", evidence_turn_id: turn.id, quote: null };
      else note("state_update.goal " + JSON.stringify(update.goal) + " is not in the goal vocabulary; ignored.");
    }
    if (update.readiness !== undefined) {
      if (READINESS.includes(update.readiness)) state.readiness = { value: update.readiness, origin: "authored", evidence_turn_id: turn.id, quote: null };
      else note("state_update.readiness " + JSON.stringify(update.readiness) + " is not in the readiness vocabulary; ignored.");
    }
    for (const kind of Array.isArray(update.preferences) ? update.preferences : []) {
      addUnique(state.preferences, "kind", { kind: String(kind), origin: "authored", evidence_turn_id: turn.id, quote: null });
    }
    for (const item of Array.isArray(update.declined) ? update.declined : []) {
      addUnique(state.declined, "item", { item: String(item), origin: "authored", evidence_turn_id: turn.id, quote: null });
    }
  }

  function inferFromText(state, turn, skip) {
    const original = typeof turn.text === "string" ? turn.text : "";
    if (QUOTED.test(original)) {
      state.uncertain.push({ turn_id: turn.id, note: "Quoted speech was ignored: it may be someone else's words.", quote: null });
    }
    QUOTED.lastIndex = 0;
    const text = original.replace(QUOTED, " ");
    for (const clause of clauses(text)) {
      const goal = firstMatch(GOAL_PHRASES, clause);
      const readiness = firstMatch(READINESS_PHRASES, clause);
      const preference = firstMatch(PREFERENCE_PHRASES, clause);
      if (REPORTED.test(clause) && !SELF_REPORT.test(clause)) {
        if (goal || readiness || preference) {
          state.uncertain.push({ turn_id: turn.id, note: "A reported statement was not applied as the person's own state.", quote: clause });
        }
        continue;
      }
      if (goal && !skip.goal) state.goal = { value: goal.value, origin: "user_text", evidence_turn_id: turn.id, quote: goal.quote };
      if (readiness && !skip.readiness) state.readiness = { value: readiness.value, origin: "user_text", evidence_turn_id: turn.id, quote: readiness.quote };
      if (preference) addUnique(state.preferences, "kind", { kind: preference.value, origin: "user_text", evidence_turn_id: turn.id, quote: preference.quote });
      if (DECLINE_WORDS.test(clause)) {
        const item = firstMatch(DECLINE_ITEMS, clause);
        if (item) addUnique(state.declined, "item", { item: item.value, origin: "user_text", evidence_turn_id: turn.id, quote: clause });
      }
    }
  }

  function trackState(scenario, variant) {
    const state = initialState(scenario);
    const snapshots = [];
    for (const turn of variant.turns) {
      if (turn.role === "user") {
        const update = turn.state_update && typeof turn.state_update === "object" ? turn.state_update : {};
        // Authored values win for this turn: inference may not overwrite them.
        const skip = {
          goal: GOALS.includes(update.goal),
          readiness: READINESS.includes(update.readiness)
        };
        inferFromText(state, turn, skip);
        applyAuthored(state, turn);
      }
      snapshots.push(copyState(state, turn.id));
    }
    return snapshots;
  }

  // State in effect at one turn, or null if the turn is not in the variant.
  function stateAt(scenario, variant, turnId) {
    return trackState(scenario, variant).find(s => s.turn_id === turnId) || null;
  }

  // Shape app.js already reads for the per-turn goal labels.
  function goalTimeline(scenario, variant) {
    return trackState(scenario, variant).map(s => ({ turn_id: s.turn_id, goal: s.goal.value }));
  }

  const api = { trackState, stateAt, goalTimeline, GOALS, READINESS };
  root.JARAState = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
