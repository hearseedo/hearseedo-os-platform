// Students demo pathway — deterministic "does this answer include a reason"
// check. This is a bounded lexical heuristic, not real language
// understanding: it looks for a small set of reason-connective words/phrases
// at a word boundary. It will miss a reason phrased without any of these
// connectives (rare in this constrained "activity + why" exercise) — that
// limitation is real and should be stated to the visitor, not hidden behind
// confident-sounding feedback.
export const REASON_CONNECTIVES = [
  "because",
  "since",
  "so that",
  "so i",
  "that's why",
  "it makes me",
  "it's fun because",
];

function toRegex(phrase) {
  // Word-boundary anchored on both ends so e.g. "since" doesn't match inside
  // another word, and multi-word phrases match as a literal sequence.
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

const CONNECTIVE_PATTERNS = REASON_CONNECTIVES.map((phrase) => ({ phrase, pattern: toRegex(phrase) }));

/**
 * @param {string} text
 * @returns {{ hasReason: boolean, matchedConnective: string|null }}
 */
export function hasReasonClause(text) {
  const normalized = (text ?? "").trim();
  if (!normalized) return { hasReason: false, matchedConnective: null };
  const match = CONNECTIVE_PATTERNS.find(({ pattern }) => pattern.test(normalized));
  return { hasReason: !!match, matchedConnective: match?.phrase ?? null };
}

/**
 * Compares the current attempt against the previous one (if any) to decide
 * what actually changed. Never forces a fake "add a reason" step when the
 * first answer already has one — that's the specific dishonest pattern this
 * function exists to prevent.
 *
 * @param {string} currentText
 * @param {string|null} previousText
 * @returns {{
 *   hasReason: boolean,
 *   needsReason: boolean,
 *   addedReason: boolean,
 *   hadReasonFromStart: boolean,
 * }}
 */
export function evaluateAttempt(currentText, previousText = null) {
  const current = hasReasonClause(currentText);
  if (previousText == null) {
    return {
      hasReason: current.hasReason,
      needsReason: !current.hasReason,
      addedReason: false,
      hadReasonFromStart: current.hasReason,
    };
  }
  const previous = hasReasonClause(previousText);
  return {
    hasReason: current.hasReason,
    needsReason: false, // a retry never forces another fake "add a reason" prompt
    addedReason: !previous.hasReason && current.hasReason,
    hadReasonFromStart: previous.hasReason,
  };
}
