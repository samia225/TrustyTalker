/* Anonymization: replaces personal details with placeholders such as [PHONE_1].
   Owner: Person 2. Plain JavaScript, no packages, no network. Works in the page and in Node.

   Used in two places:
   1. The page (app.js), when a JARA user's thumbs-down conversation is sent to TrustyTalker:
      the conversation and comment are anonymized before they become a case.
   2. The AI judge (judge/run_judge.js): every conversation is anonymized before it is sent
      to the model, and the model's quotes are mapped back so they can be checked word for word.

   Rule-based patterns only. It catches clearly shaped details: emails, web links, phone
   numbers, Canadian postal codes, street addresses, full dates, health card style numbers,
   and names that follow a cue ("my name is Sam", "my sister Priya").
   LIMITATION: it cannot catch everything. A name with no cue ("Tell Sam I said hi"),
   a workplace, a rare job or a small town can still identify someone. A person still
   checks before real data is used. Today all TrustyTalker data is fictional. */
(function (root) {
  "use strict";

  const RELATIONS = "sister|brother|mom|mother|mum|dad|father|wife|husband|partner|son|daughter|friend|boyfriend|girlfriend|" +
    "counsellor|counselor|therapist|doctor|nurse|sponsor|boss|cousin|aunt|uncle|grandma|grandmother|grandpa|grandfather|" +
    "roommate|coworker|co-worker|neighbour|neighbor|ex";
  const MONTHS = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
  const STREET = "Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Crescent|Cres|Court|Ct|Place|Pl|Trail|Terrace|Close|Highway|Hwy";
  const NAME = "[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?";

  // Order matters: emails and links first, so their digits are not read as phone numbers.
  // "keep" is the part of the match that stays (the cue word), "type" names the placeholder.
  const PATTERNS = [
    { type: "EMAIL", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
    { type: "LINK", re: /\b(?:https?:\/\/|www\.)[^\s)>\]]+/g },
    // Toll-free numbers (crisis and help lines such as 1-800-...) are public, not personal: kept.
    { type: "PHONE", re: /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
      test: m => !/^(?:\+?1[\s.-]?)?\(?8(?:00|33|44|55|66|77|88)\)?/.test(m) },
    { type: "HEALTH_NUMBER", re: /\b\d{4,5}[- ]?\d{3,4}(?:[- ]?\d{2,4})?\b/g, test: m => { const n = m.replace(/\D/g, "").length; return n >= 9 && n <= 12; } },
    { type: "POSTAL_CODE", re: /\b[A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TV-Z][ -]?\d[A-CEGHJ-NPR-TV-Z]\d\b/gi },
    { type: "ADDRESS", re: new RegExp("\\b\\d{1,5}\\s+(?:" + NAME + "\\s+){1,3}(?:" + STREET + ")\\b\\.?(?:\\s+(?:NW|NE|SW|SE))?", "g") },
    { type: "DATE", re: new RegExp("\\b(?:\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|(?:" + MONTHS + ")\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}|\\d{1,2}\\s+(?:" + MONTHS + ")\\.?\\s+\\d{4})\\b", "g") },
    { type: "NAME", re: new RegExp("(\\b(?:[Mm]y name is|[Mm]y name's|I am called|I'm called|[Cc]all me|I go by)\\s+)(" + NAME + "(?:\\s+" + NAME + ")?)", "g"), keep: 1 },
    { type: "NAME", re: new RegExp("(\\b[Mm]y\\s+(?:" + RELATIONS + "),?\\s+)(" + NAME + ")\\b", "g"), keep: 1 }
  ];
  // Capitalised words after a cue that are not names ("my friend Who", "call me Tomorrow").
  const NOT_NAMES = new Set(["I", "Who", "What", "When", "Where", "Why", "How", "And", "But", "Or", "So", "Then", "Today", "Tomorrow",
    "Tonight", "Yesterday", "Later", "Soon", "Again", "Back", "Please", "Thanks", "Okay", "Ok", "Yes", "No", "Not", "Is", "Was", "Has", "Had",
    "Said", "Says", "Thinks", "Told", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "JARA"]);

  // One anonymizer per conversation: the same detail always gets the same placeholder,
  // and restore() maps placeholders back (used to check the AI's quotes word for word).
  function createAnonymizer() {
    const byValue = new Map();   // "403-555-0192" -> "[PHONE_1]"
    const byToken = new Map();   // "[PHONE_1]" -> "403-555-0192"
    const counts = {};
    function tokenFor(type, value) {
      const k = type + "\u0000" + value;
      if (byValue.has(k)) return byValue.get(k);
      counts[type] = (counts[type] || 0) + 1;
      const token = "[" + type + "_" + counts[type] + "]";
      byValue.set(k, token);
      byToken.set(token, value);
      return token;
    }
    function scrub(text) {
      if (typeof text !== "string" || !text) return text;
      let out = text;
      for (const p of PATTERNS) {
        p.re.lastIndex = 0;
        out = out.replace(p.re, (...args) => {
          const match = args[0];
          if (p.keep) {
            const cue = args[1], value = args[2];
            if (NOT_NAMES.has(value.split(/\s+/)[0])) return match;
            return cue + tokenFor(p.type, value);
          }
          if (p.test && !p.test(match)) return match;
          return tokenFor(p.type, match);
        });
      }
      return out;
    }
    function restore(text) {
      if (typeof text !== "string" || !byToken.size) return text;
      return text.replace(/\[([A-Z_]+_\d+)\]/g, (m) => byToken.has(m) ? byToken.get(m) : m);
    }
    return {
      scrub, restore,
      summary: () => Object.assign({}, counts),
      replacedCount: () => Object.values(counts).reduce((a, b) => a + b, 0)
    };
  }

  // One-off helper: anonymize a single text.
  function anonymize(text) { return createAnonymizer().scrub(text); }

  // Which kinds of detail a text seems to contain (for a warning), without changing it.
  function findPersonalDetails(text) {
    const a = createAnonymizer();
    a.scrub(String(text || ""));
    return a.summary();
  }

  const api = { createAnonymizer, anonymize, findPersonalDetails };
  root.JARAAnonymize = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
