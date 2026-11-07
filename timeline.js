/* Timeline (Person 3). One coloured stop per turn, a "first off track here" marker
 * and a tracked-state panel. Exposes window.JARATimeline; app.js calls it.
 *
 * Colours after checks run:  green = no hint, amber = only "needs reviewer" hints,
 * red = at least one clear hint. Grey = person turn, or checks not run yet.
 *
 * Tracked state comes from Person 1's state tracker when it is loaded:
 *   JARAStateTracker.track(scenario, variant) -> [{ turn_id, goal, readiness, preferences: [], declined: [] }]
 * Without it, the panel falls back to the goal data and the case readiness.
 */
(function (root) {
  "use strict";

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function pretty(value) { return String(value).replaceAll("_", " "); }

  // Goal per turn. Order of preference: JARAChecks.goalTimeline, turn.goal, scenario.goal.
  function goalsForVariant(scenario, variant) {
    const api = root.JARAChecks || {};
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

  // State per turn, same length as variant.turns.
  function stateForVariant(scenario, variant) {
    const tracker = root.JARAStateTracker;
    let tracked = null;
    if (tracker && typeof tracker.track === "function") {
      try { tracked = tracker.track(scenario, variant); } catch (error) { tracked = null; }
    }
    const byTurn = new Map();
    if (Array.isArray(tracked)) for (const s of tracked) if (s && s.turn_id) byTurn.set(s.turn_id, s);
    const goals = goalsForVariant(scenario, variant);
    return variant.turns.map((turn, i) => {
      const s = byTurn.get(turn.id) || {};
      return {
        turn_id: turn.id,
        goal: s.goal || goals[i] || null,
        readiness: s.readiness || scenario.readiness || null,
        preferences: Array.isArray(s.preferences) ? s.preferences : [],
        declined: Array.isArray(s.declined) ? s.declined : [],
        from_tracker: byTurn.has(turn.id)
      };
    });
  }

  function renderState(panel, state, turnLabel) {
    panel.replaceChildren(element("h4", "Tracked state at " + turnLabel, "state-heading"));
    const list = element("dl", undefined, "state-list");
    const rows = [
      ["Goal", state.goal ? pretty(state.goal) : "Not known"],
      ["Readiness", state.readiness ? pretty(state.readiness) : "Not known"],
      ["Preferences", state.preferences.length ? state.preferences.map(pretty).join(", ") : "None recorded"],
      ["Declined", state.declined.length ? state.declined.map(pretty).join(", ") : "None recorded"]
    ];
    for (const [label, value] of rows) {
      const group = element("div");
      group.append(element("dt", label), element("dd", value));
      list.append(group);
    }
    panel.append(list);
    if (!state.from_tracker) panel.append(element("small", "State tracker not loaded yet: showing goal data and case readiness only.", "state-note"));
  }

  // Builds the timeline for one example. Call paint() after checks run.
  function render(scenario, variant) {
    const states = stateForVariant(scenario, variant);
    const box = element("div", undefined, "timeline");
    box.dataset.variantId = variant.id;
    const strip = element("ol", undefined, "timeline-strip");
    strip.setAttribute("aria-label", "Turn timeline for " + (variant.label || variant.id));
    const panel = element("div", undefined, "state-panel");
    panel.setAttribute("aria-live", "polite");
    let selected = null;

    variant.turns.forEach((turn, i) => {
      const item = element("li", undefined, "timeline-item");
      const who = turn.role === "user" ? "Person" : "Assistant";
      const stop = element("button", String(i + 1), "timeline-stop stop-" + (turn.role === "user" ? "user" : "pending"));
      stop.type = "button";
      stop.dataset.turnId = turn.id;
      stop.dataset.role = turn.role;
      stop.dataset.label = who + " turn " + (i + 1);
      stop.setAttribute("aria-label", stop.dataset.label + ", not checked yet");
      stop.setAttribute("aria-pressed", "false");
      stop.addEventListener("click", () => {
        if (selected) selected.setAttribute("aria-pressed", "false");
        selected = stop;
        stop.setAttribute("aria-pressed", "true");
        renderState(panel, states[i], stop.dataset.label);
        const message = document.querySelector('#variants .turn[data-turn-id="' + CSS.escape(turn.id) + '"]');
        if (message) message.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      item.append(stop);
      strip.append(item);
    });

    const legend = element("p", undefined, "timeline-legend");
    for (const [cls, text] of [["ok", "No issue"], ["review", "Needs reviewer"], ["flag", "Flagged"], ["user", "Person"]]) {
      const key = element("span", undefined, "legend-key");
      key.append(element("span", "", "legend-dot stop-" + cls), document.createTextNode(text));
      legend.append(key);
    }
    renderState(panel, states[states.length - 1], "the last turn");
    box.append(strip, legend, panel);
    return box;
  }

  // Colours each assistant stop from the hints and marks the first red turn.
  // levelOf(hint) returns "clear" or "review".
  function paint(variant, hints, levelOf) {
    const box = document.querySelector('.timeline[data-variant-id="' + CSS.escape(variant.id) + '"]');
    if (!box) return null;
    box.querySelectorAll(".off-track-marker").forEach(node => node.remove());
    let firstOff = null;
    for (const stop of box.querySelectorAll(".timeline-stop")) {
      if (stop.dataset.role !== "assistant") continue;
      const levels = hints.filter(h => h.turn_id === stop.dataset.turnId).map(levelOf);
      const state = levels.includes("clear") ? "flag" : levels.length ? "review" : "ok";
      stop.className = "timeline-stop stop-" + state;
      const words = { flag: "flagged", review: "needs reviewer", ok: "no issue found" }[state];
      stop.setAttribute("aria-label", stop.dataset.label + ", " + words);
      if (state === "flag" && !firstOff) firstOff = stop;
    }
    if (firstOff) {
      firstOff.parentElement.append(element("span", "First off track here", "off-track-marker"));
      const message = document.querySelector('#variants .turn[data-turn-id="' + CSS.escape(firstOff.dataset.turnId) + '"]');
      if (message) message.prepend(element("span", "First off track here", "off-track-marker off-track-inline"));
    }
    return firstOff ? firstOff.dataset.turnId : null;
  }

  // Back to grey (used when switching case or re-running).
  function reset() {
    document.querySelectorAll(".off-track-marker").forEach(node => node.remove());
    for (const stop of document.querySelectorAll(".timeline-stop")) {
      if (stop.dataset.role === "assistant") {
        stop.className = "timeline-stop stop-pending";
        stop.setAttribute("aria-label", stop.dataset.label + ", not checked yet");
      }
    }
  }

  root.JARATimeline = { goalsForVariant, stateForVariant, render, paint, reset };
})(typeof globalThis !== "undefined" ? globalThis : this);
