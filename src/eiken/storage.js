// EIKEN Monkey — local persistence (mirrors src/careerReady/storage.js).
// Fast-path localStorage cache for the current session, keyed per-child on
// family plans so siblings' grade/XP/progress stay independent instead of
// blending into one shared record (Phase 0). Backed by /api/eiken-progress
// (Phase 0, firebase-admin) for durable cross-device sync of the fields that
// matter for confidence/skill tracking and dashboards.
import { auth } from "../lib/firebase";

const storageKey = (activeMember) =>
  activeMember?.id ? `hsd-eiken-user:${activeMember.id}` : "hsd-eiken-user";

const DEFAULT_STATE = {
  coach: null, level: null, xp: 0, stars: 0, sessions: 0,
  monkeyPartyBest: 0, monkeyPartyStreak: 0, monkeyPartyLastPlayed: null,
  // Lifetime counters — badge unlock conditions need cumulative totals across
  // sessions, not just the just-completed session's summary.
  monkeyPartyRoundsTotal: 0, monkeyPartyClarity3Count: 0, monkeyPartyPower3Count: 0,
  monkeyPartyCategoryGoldCount: 0, monkeyPartyBeatCount: 0, monkeyPartyQuickMixCount: 0,
};

// Daily play-streak helper (JST, matching the rest of the platform's
// day-boundary convention in netlify/functions/*.js). Call once per
// completed session: increments if played yesterday, holds if already
// played today, resets to 1 otherwise.
export function nextMonkeyPartyStreak(prevStreak, lastPlayed) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  if (lastPlayed === today) return { streak: prevStreak || 1, lastPlayed: today };
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const streak = lastPlayed === yesterday ? (prevStreak || 0) + 1 : 1;
  return { streak, lastPlayed: today };
}

export function getEikenLocalState(activeMember) {
  try {
    const raw = localStorage.getItem(storageKey(activeMember));
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveEikenLocalState(activeMember, state) {
  try {
    localStorage.setItem(storageKey(activeMember), JSON.stringify(state));
  } catch {}
}

// ── Durable sync via the Phase 0 authenticated write endpoint ──────────────
// Fire-and-forget by design (mirrors updateMemorySummary in careerReady/memory.js)
// — local state is the source of truth for the current session; this just
// keeps the server copy (used by parent/teacher dashboards) eventually consistent.
async function callEikenProgress(op, { activeMember, data, collection, docId } = {}) {
  if (!auth.currentUser) return null;
  try {
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch("/api/eiken-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, memberId: activeMember?.id, op, data, collection, docId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function initEikenProgress(activeMember) {
  return callEikenProgress("init", { activeMember });
}

export function syncEikenProgress(activeMember, { eiken, skills } = {}) {
  return callEikenProgress("update", { activeMember, data: { eiken, skills } });
}

export function logEikenInteraction(activeMember, interaction) {
  return callEikenProgress("logInteraction", { activeMember, data: interaction });
}

// Phase 7 schema: genuinely separate record types, each its own subcollection
// under the profile doc (matches the interactions/confidenceHistory precedent).
export function logPlacementResult(activeMember, summary) {
  return callEikenProgress("logRecord", { activeMember, collection: "eikenPlacementResults", data: summary });
}

export function logMockAttempt(activeMember, attempt) {
  return callEikenProgress("logRecord", { activeMember, collection: "eikenMockAttempts", data: attempt });
}

// Keyed by achievementId (not auto-id) so re-checking unlocks never creates
// duplicate unlock records — merge-set is naturally idempotent.
export function logAchievementUnlock(activeMember, achievementId, achievementData) {
  return callEikenProgress("logRecord", { activeMember, collection: "eikenAchievements", docId: achievementId, data: achievementData });
}

// Monkey Party — extends the same activity-log pattern (activityType field
// distinguishes it within the shared collection family, per the spec's own
// suggestion, rather than a parallel progress system).
export function logMonkeyPartySession(activeMember, session) {
  return callEikenProgress("logRecord", { activeMember, collection: "monkeyPartySessions", data: { activityType: "monkey_party", ...session } });
}
