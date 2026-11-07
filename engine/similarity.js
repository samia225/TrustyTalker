/* TEXT SIMILARITY (Person 2). TF-IDF + cosine similarity in plain JavaScript.
 * Nothing is learned or trained: word weights are counted from the texts given
 * at the time of the call. No network, no AI. Works in the browser and Node.
 *
 * Used for:
 *   (a) source retrieval: the closest source passage to show beside a reply
 *       (closestSource, rankPassages; also used by the judge script)
 *   (b) near-repetition: how similar each assistant reply is to an earlier one
 *       (nearRepeats; shared with Person 1's repetition check)
 *
 * Load anywhere before app.js. It does not depend on other files.
 */
(function (root) {
  "use strict";

  // Common words that carry little meaning. Negations (not, no, never) are
  // deliberately KEPT so "is free" and "is not free" do not look identical.
  const STOP_WORDS = new Set(("a an and are as at be been but by can could did do does for from had has have he her " +
    "him his i if in into is it its just me my of on or our she so than that the their them then there these they " +
    "this to too us was we were what when where which who will with would you your yours").split(" "));

  // Lowercase words, without stop words. Light suffix stripping so "options"
  // matches "option" and "appointments" matches "appointment".
  function tokenize(text) {
    const words = String(text || "").toLowerCase().replace(/[‘’]/g, "'").match(/[a-z0-9]+(?:'[a-z]+)?/g) || [];
    const tokens = [];
    for (let w of words) {
      w = w.replace(/'(?:s|re|ve|ll|d|m)$/, "").replace(/n't$/, " not").trim();
      for (const part of w.split(" ")) {
        let t = part;
        if (t.length > 4 && t.endsWith("ies")) t = t.slice(0, -3) + "y";
        else if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
        if (t && !STOP_WORDS.has(t)) tokens.push(t);
      }
    }
    return tokens;
  }

  // Build TF-IDF vectors for a list of texts. Smoothed IDF (as in common
  // libraries) so even a two-text corpus gives useful, non-zero weights.
  function buildIndex(texts) {
    const docs = texts.map(tokenize);
    const df = new Map();
    for (const tokens of docs) for (const t of new Set(tokens)) df.set(t, (df.get(t) || 0) + 1);
    const n = texts.length;
    function idf(term) { return Math.log((1 + n) / (1 + (df.get(term) || 0))) + 1; }
    function vectorize(textOrTokens) {
      const tokens = Array.isArray(textOrTokens) ? textOrTokens : tokenize(textOrTokens);
      const counts = new Map();
      for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
      const vector = new Map();
      let norm = 0;
      for (const [t, c] of counts) { const w = c * idf(t); vector.set(t, w); norm += w * w; }
      norm = Math.sqrt(norm);
      if (norm) for (const [t, w] of vector) vector.set(t, w / norm);
      return vector;
    }
    return { vectorize, vectors: docs.map(vectorize) };
  }

  // Cosine similarity of two unit vectors (Maps): 0 = nothing shared, 1 = same words.
  function cosine(a, b) {
    const [small, large] = a.size <= b.size ? [a, b] : [b, a];
    let dot = 0;
    for (const [t, w] of small) { const v = large.get(t); if (v) dot += w * v; }
    return Math.min(1, Math.max(0, dot));
  }

  // Similarity of two texts. `corpus` (optional) gives more stable word weights.
  function similarity(textA, textB, corpus) {
    const index = buildIndex((corpus && corpus.length ? corpus : []).concat([textA, textB]));
    return round(cosine(index.vectorize(textA), index.vectorize(textB)));
  }

  // Rank passages (strings) by similarity to `query`, best first.
  // Returns [{ index, score }], skipping scores below `minScore` (default 0.05).
  function rankPassages(query, passages, options) {
    const minScore = options && options.minScore !== undefined ? options.minScore : 0.05;
    const limit = options && options.limit ? options.limit : passages.length;
    const index = buildIndex(passages.concat([query]));
    const q = index.vectorize(query);
    return passages
      .map((p, i) => ({ index: i, score: round(cosine(q, index.vectors[i])) }))
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, limit);
  }

  // Text used to represent a source: its passage plus its structured facts.
  function sourceText(source) {
    const facts = Object.entries(source.facts || {}).map(([k, v]) => k + " " + String(v).replaceAll("_", " ")).join(". ");
    return [source.passage || "", facts].filter(Boolean).join(" ");
  }

  // The source in this case closest to a reply (or any text). For display beside
  // the reply. Returns { source_id, passage, score } or null when nothing is close.
  // `turnOrText` may be a turn object or a string. A cited source (turn.claims)
  // is always returned first, with cited: true, whatever its score.
  function closestSource(scenario, turnOrText, options) {
    const sources = (scenario && scenario.sources) || [];
    if (!sources.length) return null;
    const text = typeof turnOrText === "string" ? turnOrText : (turnOrText && turnOrText.text) || "";
    const cited = typeof turnOrText === "object" && turnOrText && (turnOrText.claims || []).map(c => c.source_id);
    if (cited && cited.length) {
      const source = sources.find(s => s.id === cited[0]);
      if (source) {
        const score = similarity(text, sourceText(source), sources.map(sourceText));
        return { source_id: source.id, passage: source.passage, score, cited: true };
      }
    }
    const ranked = rankPassages(text, sources.map(sourceText), options);
    if (!ranked.length) return null;
    const best = sources[ranked[0].index];
    return { source_id: best.id, passage: best.passage, score: ranked[0].score, cited: false };
  }

  // Compare each assistant reply with every earlier assistant reply in the same
  // conversation. Returns [{ turn_id, earlier_turn_id, score, exact }] for pairs
  // at or above `threshold` (default 0.8). The repetition CHECK itself belongs
  // to Person 1; this only supplies the score.
  function nearRepeats(variant, threshold) {
    const limit = threshold === undefined ? 0.8 : threshold;
    const replies = variant.turns.filter(t => t.role === "assistant");
    if (replies.length < 2) return [];
    const index = buildIndex(replies.map(t => t.text));
    const pairs = [];
    for (let i = 1; i < replies.length; i++) {
      let best = null;
      for (let j = 0; j < i; j++) {
        const score = round(cosine(index.vectors[i], index.vectors[j]));
        if (!best || score > best.score) best = { j, score };
      }
      if (best && best.score >= limit) {
        pairs.push({ turn_id: replies[i].id, earlier_turn_id: replies[best.j].id, score: best.score,
          exact: replies[i].text.trim().toLowerCase() === replies[best.j].text.trim().toLowerCase() });
      }
    }
    return pairs;
  }

  function round(x) { return Math.round(x * 1000) / 1000; }

  const api = { tokenize, buildIndex, cosine, similarity, rankPassages, sourceText, closestSource, nearRepeats };
  root.JARASimilarity = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
