// HSD OS AI — canonical app-engagement-event vocabulary, for server-side
// VALIDATION and PROGRESSION-DERIVATION (Phase 3.4, 2026-09-12; delta
// table versioned and decoupled from client-supplied numbers in the
// Phase 3.4 correctness-review follow-up, same day).
//
// Mirrors the pattern already established by _curriculumIds.js: a small,
// manually-maintained allowlist so record-engagement-event.js can reject
// anything outside real, known values instead of trusting whatever a
// client (or a compromised/malicious iframe posting a forged message)
// sends. Kept separate from _curriculumIds.js because these two systems
// are deliberately independent — curriculum position (Monkey Yoga V2 only)
// and generic engagement/skill/confidence tracking (every app) must remain
// separate, per the Phase 3.4 product decision.
//
// VALID_APP_IDS mirrors src/constants/apps.js's real app ids exactly —
// update both together if an app is ever added/removed/renamed.
const VALID_APP_IDS = new Set([
  "phonics", "eiken", "speak", "wondercamp", "family", "music-album",
  "sipswitch", "innerkey", "monkeys-unlock", "career-ready", "global-ready",
  "speak-ready",
]);

// Which skills a given app's activity plausibly touches. Apps not listed
// fall back to ["vocabulary"], matching prior behaviour exactly (see
// appEvents.js's SKILL_MAP before Phase 3.4).
const APP_SKILL_MAP = {
  eiken:            ["vocabulary", "reading", "listening", "speaking"],
  phonics:          ["pronunciation", "reading", "listening"],
  speak:            ["speaking", "grammar"],
  sipswitch:        ["listening", "speaking", "vocabulary"],
  wondercamp:       ["vocabulary", "reading", "grammar"],
  family:           ["speaking", "listening", "vocabulary"],
  innerkey:         ["mindset", "speaking"],
  "monkeys-unlock": ["speaking", "listening", "vocabulary"],
  "career-ready":   ["vocabulary", "reading"],
  "global-ready":   ["vocabulary", "speaking"],
  "speak-ready":    ["speaking", "listening"],
  "music-album":    ["listening"],
};

const VALID_LESSON_TYPES = new Set(["practice", "assessment", "review", "conversation"]);

// ── Versioned, server-only engagement-delta table ──────────────────────
//
// Correctness-review correction (2026-09-12): the original version of this
// file derived engagementDelta from a client-supplied `xp` number
// (`isCorrect ? Math.min(xp / 4, 15) : 5`), which meant a client that
// simply reported a higher `xp` value could push its OWN engagement score
// up faster — the delta was capped at 15, but "capped" is not the same as
// "not client-influenced", and the raw client number still directly fed a
// progression calculation. It no longer does: a client's reported xp/score
// are now stored ONLY as labeled evidence on the interaction log entry
// (`reportedXp`, `reportedScore` — see record-engagement-event.js), never
// read back into engagementScore/skills at all. The ONLY inputs that
// affect the actual delta are `appId`'s fixed skill list (above) and
// `lessonType` + `isCorrect`, both checked against small closed
// allowlists (VALID_APP_IDS / VALID_LESSON_TYPES) — so the full space of
// possible deltas is exactly `VALID_LESSON_TYPES.size * 2`, entirely fixed
// by this table, not by anything a client can scale.
//
// ENGAGEMENT_RULES_VERSION is bumped whenever this table's values change,
// and stored on every interaction log entry — so a future analysis can
// tell "this delta came from ruleset v1" apart from a later revision
// without needing to infer it from the surrounding data.
const ENGAGEMENT_RULES_VERSION = 1;
const ENGAGEMENT_DELTA_TABLE = {
  practice:     { correct: 10, incorrect: -5 },
  assessment:   { correct: 15, incorrect: -8 },
  review:       { correct: 6,  incorrect: -3 },
  conversation: { correct: 8,  incorrect: -2 },
};

// Bounds for the client's reported xp/score — these are stored as evidence
// only (never used to derive progression) but are still capped so a
// malformed/hostile payload can't bloat a document or a log.
const MAX_REPORTED_XP = 1000;
const MAX_REPORTED_SCORE = 1000;

function isValidAppId(v) {
  return typeof v === "string" && VALID_APP_IDS.has(v);
}

function isValidLessonType(v) {
  return v === undefined || (typeof v === "string" && VALID_LESSON_TYPES.has(v));
}

function skillsForApp(appId) {
  return APP_SKILL_MAP[appId] ?? ["vocabulary"];
}

/**
 * The ONLY function that decides how much an event moves engagementScore.
 * Never accepts a client-supplied magnitude — lessonType is checked
 * against VALID_LESSON_TYPES before this is ever called (unknown types are
 * rejected at validation, not silently defaulted here).
 */
function engagementDeltaFor(lessonType, isCorrect) {
  const rule = ENGAGEMENT_DELTA_TABLE[lessonType] ?? ENGAGEMENT_DELTA_TABLE.practice;
  return isCorrect ? rule.correct : rule.incorrect;
}

module.exports = {
  VALID_APP_IDS, APP_SKILL_MAP, VALID_LESSON_TYPES,
  ENGAGEMENT_RULES_VERSION, ENGAGEMENT_DELTA_TABLE,
  MAX_REPORTED_XP, MAX_REPORTED_SCORE,
  isValidAppId, isValidLessonType, skillsForApp, engagementDeltaFor,
};
