// Monkey Party — pure game logic (no React, no network). Mirrors
// src/eiken/placementEngine.js's shape: deterministic, unit-testable.

const CORE_MODES = ["would_you_rather", "category_rush", "answer_or_challenge", "beat_the_monkey"];

// Quick Mix cycles through the 4 core modes without repeating the same mode
// twice in a row where avoidable, matching the spec's example sequence
// (Would You Rather, Category Rush, Answer, Beat the Monkey, Challenge Round).
export function buildQuickMixSequence(roundCount) {
  const sequence = [];
  let last = null;
  for (let i = 0; i < roundCount; i++) {
    const options = CORE_MODES.filter(m => m !== last);
    const next = options[Math.floor(Math.random() * options.length)];
    sequence.push(next);
    last = next;
  }
  return sequence;
}

export function clampStars(n) {
  return Math.max(0, Math.min(3, Math.round(n)));
}

// Aggregates a completed session's per-round scores into summary stats —
// used for the end-of-session screen and for progress/admin tracking.
export function summarizeSession(rounds) {
  if (rounds.length === 0) {
    return {
      totalScore: 0, roundCount: 0, braveryAverage: 0, clarityAverage: 0,
      englishAverage: 0, powerAverage: 0, speakingSeconds: 0,
      bestRound: null, strongestCategory: null, mostPlayedMode: null,
      beatMonkeyCount: 0, targetCompletedCount: 0,
    };
  }

  const sum = (key) => rounds.reduce((s, r) => s + (r.evaluation?.[key] ?? 0), 0);
  const braveryAverage = sum("braveryScore") / rounds.length;
  const clarityAverage = sum("clarityScore") / rounds.length;
  const englishAverage = sum("englishScore") / rounds.length;
  const powerAverage   = sum("powerScore") / rounds.length;
  const totalScore     = rounds.reduce((s, r) => s + (r.evaluation?.totalPoints ?? 0), 0);
  const speakingSeconds = rounds.reduce((s, r) => s + (r.speakingSeconds ?? 0), 0);

  const bestRound = rounds.reduce((best, r) =>
    (r.evaluation?.totalPoints ?? 0) > (best?.evaluation?.totalPoints ?? -1) ? r : best, null);

  const modeCounts = {};
  for (const r of rounds) modeCounts[r.mode] = (modeCounts[r.mode] ?? 0) + 1;
  const mostPlayedMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const topicCounts = {};
  for (const r of rounds) {
    if (!r.topic) continue;
    const key = r.topic;
    topicCounts[key] = (topicCounts[key] ?? 0) + (r.evaluation?.totalPoints ?? 0);
  }
  const strongestCategory = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    totalScore,
    roundCount: rounds.length,
    braveryAverage: Math.round(braveryAverage * 10) / 10,
    clarityAverage: Math.round(clarityAverage * 10) / 10,
    englishAverage: Math.round(englishAverage * 10) / 10,
    powerAverage: Math.round(powerAverage * 10) / 10,
    speakingSeconds,
    bestRound,
    strongestCategory,
    mostPlayedMode,
    beatMonkeyCount: rounds.filter(r => r.evaluation?.beatTheMonkey).length,
    targetCompletedCount: rounds.filter(r => r.evaluation?.targetCompleted).length,
  };
}

export function resultTierForCount(count) {
  if (count >= 10) return "Monkey Master";
  if (count >= 7)  return "Gold";
  if (count >= 4)  return "Silver";
  return "Bronze";
}

// Lightweight client-side dedup for Category Rush's "live" accepted-answers
// list while the timer is running — optimistic, not authoritative. The full
// transcript still gets one authoritative Gemini validation pass when the
// round ends (see monkeyPartyPrompt.js), so a few false positives here just
// get quietly corrected in the final count rather than costing an extra call.
export function normalizeAnswer(text) {
  return text.trim().toLowerCase().replace(/^(a|an|the)\s+/, "").replace(/[.!?]+$/, "");
}

export function addCandidateAnswer(existingList, rawText) {
  const normalized = normalizeAnswer(rawText);
  if (!normalized) return existingList;
  if (existingList.some(a => normalizeAnswer(a) === normalized)) return existingList;
  return [...existingList, rawText.trim()];
}

// ─── Badges (rewards) ─────────────────────────────────────────────────────────
// Derives this session's contribution to each lifetime counter — the caller
// adds these deltas onto the running totals (stored locally, mirroring how
// xp/stars/sessions already accumulate) before checking unlock conditions.
export function sessionBadgeDeltas(rounds, config) {
  return {
    roundsTotal: rounds.length,
    clarity3Count: rounds.filter(r => clampStars(r.evaluation?.clarityScore) === 3).length,
    power3Count: rounds.filter(r => clampStars(r.evaluation?.powerScore) === 3).length,
    categoryGoldCount: rounds.filter(r => r.mode === "category_rush" && (r.evaluation?.totalPoints ?? 0) >= 9).length,
    beatCount: rounds.filter(r => r.evaluation?.beatTheMonkey).length,
    quickMixCompleted: config?.mode === "quick_mix" ? 1 : 0,
  };
}

// cumulative: the running lifetime totals (already includes this session's
// deltas) — pass the *new* totals in, get back which badges are now unlocked.
export function computeMonkeyPartyBadgeUnlocks(cumulative) {
  const unlocked = new Set();
  if ((cumulative.monkeyPartyRoundsTotal ?? 0) >= 10) unlocked.add("mp_brave_speaker");
  if ((cumulative.monkeyPartyClarity3Count ?? 0) >= 5) unlocked.add("mp_clear_communicator");
  if ((cumulative.monkeyPartyPower3Count ?? 0) >= 5) unlocked.add("mp_reason_master");
  if ((cumulative.monkeyPartyCategoryGoldCount ?? 0) >= 1) unlocked.add("mp_category_champion");
  if ((cumulative.monkeyPartyBeatCount ?? 0) >= 5) unlocked.add("mp_monkey_beater");
  if ((cumulative.monkeyPartyStreak ?? 0) >= 5) unlocked.add("mp_five_day_streak");
  if ((cumulative.monkeyPartyQuickMixCount ?? 0) >= 10) unlocked.add("mp_quick_mix_champion");
  return unlocked;
}
