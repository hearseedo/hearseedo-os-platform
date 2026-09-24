// Jona safety-risk classifier (P0, 2026-09-24). Deliberately a narrow,
// swappable interface — every caller depends only on classifyRisk()'s
// { tier, category } return shape, never on how the tier was decided. P0
// implements the safest practical LIGHTWEIGHT approach (pattern matching on
// the latest user message) as an interim gate, explicitly NOT the final,
// sourced safeguarding policy (see docs/JONA_ARCHITECTURE_AUDIT_2026-09-24.md
// P0-C) — children can communicate distress indirectly, and this function is
// expected to be replaced or layered (e.g. a real classification call) later
// without any caller needing to change. Errs toward over-flagging: a false
// positive costs one unmetered, narrowly-scoped safety reply; a false
// negative costs a real child going unhelped, so the tradeoff is deliberate.

const TIERS = ["NORMAL", "SENSITIVE", "HIGH_RISK", "IMMEDIATE_DANGER"];

// IMMEDIATE_DANGER — explicit self-harm/suicide/acute-danger language.
const IMMEDIATE_DANGER_PATTERNS = [
  /\bkill(ing)? myself\b/i,
  /\bwant(ed)? to die\b/i,
  /\bend(ing)? my life\b/i,
  /\bsuicide\b/i,
  /\bhurt(ing)? myself\b/i,
  /\bcut(ting)? myself\b/i,
  /\bno reason to live\b/i,
  /\bdon'?t want to (live|be alive)\b/i,
  /\bbetter off (dead|without me)\b/i,
];

// HIGH_RISK — abuse, being hurt by someone, being told to keep a secret,
// fear of going home, exploitation-shaped language.
const HIGH_RISK_PATTERNS = [
  /\b(someone|he|she|they) (hurt|hurts|hit|hits|touch(ed|es)?) me\b/i,
  /\bscared to go home\b/i,
  /\bdon'?t tell (my parents|anyone|mom|dad)\b/i,
  /\bit'?s a secret\b/i,
  /\bafraid of (my|him|her|them)\b/i,
  /\bmakes? me feel (bad|scared|unsafe) when (he|she|they) touch/i,
];

// SENSITIVE — real but lower-acuity distress signals; still routed to the
// restricted safety pathway rather than normal Jona, but worded softer.
const SENSITIVE_PATTERNS = [
  /\bnobody (understands|likes|loves) me\b/i,
  /\bi feel (really )?(sad|alone|lonely|hopeless)\b/i,
  /\bi want to disappear\b/i,
  /\bi hate (myself|my life)\b/i,
  /\bno one would (notice|care|miss me)\b/i,
];

function matchAny(patterns, text) {
  return patterns.some((p) => p.test(text));
}

/**
 * Classifies the risk tier of a single user-authored message. `context` is
 * currently unused by this P0 implementation but is part of the interface
 * on purpose, so a future layered classifier (conversation history, learner
 * age, prior safety events) can use it without changing any call site.
 * @param {string} message
 * @param {{ profileId?: string }} [context]
 * @returns {Promise<{ tier: "NORMAL"|"SENSITIVE"|"HIGH_RISK"|"IMMEDIATE_DANGER", category: string|null }>}
 */
async function classifyRisk(message, context = {}) {
  const text = (message || "").trim();
  if (!text) return { tier: "NORMAL", category: null };

  if (matchAny(IMMEDIATE_DANGER_PATTERNS, text)) return { tier: "IMMEDIATE_DANGER", category: "self_harm_or_danger" };
  if (matchAny(HIGH_RISK_PATTERNS, text))        return { tier: "HIGH_RISK", category: "abuse_or_unsafe" };
  if (matchAny(SENSITIVE_PATTERNS, text))        return { tier: "SENSITIVE", category: "emotional_distress" };
  return { tier: "NORMAL", category: null };
}

module.exports = { classifyRisk, TIERS };
