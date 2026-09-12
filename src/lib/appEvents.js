// HSD OS — App Event Processor (Phase 3.4, 2026-09-12).
//
// Receives learning events from individual apps (via postMessage or REST)
// and forwards them for engagement/skill/confidence tracking.
//
// Phase 3.4 correction: this used to write learnerProfiles/{uid} (+
// interactions/confidenceHistory) directly via the client Firestore SDK.
// firestore.rules has denied that write outright since Phase 0 (2026-09-09)
// — "server writes via /api/intelligence and /api/chat" was the stated
// intent, but no such server write ever existed, so every one of these
// writes has always failed, silently, since the rule was introduced (see
// docs/PHASE_3_3_DIAGNOSTICS.md). It's also the wrong identity for a child
// profile: every write landed on the PARENT account's uid regardless of
// which child actually generated the event.
//
// Fixed by routing through record-engagement-event.js (an authenticated
// Netlify Function): it verifies the caller's ID token, verifies the
// claimed profileId actually belongs to that account, derives engagement/
// skill/confidence changes server-side, and writes to the correct
// self-vs-child-scoped location. See that function's own header comment
// for the full data-model decision.
import { auth } from "./firebase";
import { recordCurriculumProgressEvent } from "../family/curriculumProgress";
import { SELF_PROFILE_ID } from "./profiles";

// Same opaque-id contract the curriculum-progress path already uses
// (see src/family/curriculumProgress.js / netlify/functions/
// record-curriculum-progress.js) — a random, unguessable idempotency key,
// never parsed for meaning either client- or server-side.
function generateEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function callFunction(path, payload) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

/**
 * Sends one HSD_OS_PROGRESS event's engagement/skill data to the server-
 * authenticated recorder. Never throws — a tracking failure must never
 * interrupt the learner's activity (Phase 3.4 item 2). Logs exactly one
 * structured, non-sensitive diagnostic line on failure: no event contents
 * (appId aside, which is not sensitive), no uid, no profileId.
 */
async function recordEngagementEvent(profileId, event) {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  if (!idToken) return { ok: false };

  try {
    // reportedXp/reportedScore (renamed from xp/score, correctness-review
    // correction 2026-09-12): these are stored server-side purely as
    // labeled, client-REPORTED evidence — they never influence
    // engagementScore/skills, which the server derives entirely from
    // (appId, lessonType, isCorrect) against its own versioned table (see
    // netlify/functions/_appEventAllowlist.js). The field names are
    // renamed here specifically so nothing reading this payload could
    // mistake them for an authoritative progression input.
    const { ok, status, body } = await callFunction("/api/record-engagement-event", {
      idToken,
      profileId,
      appId: event.module ?? "unknown",
      lessonType: event.lessonType ?? "practice",
      isCorrect: event.isCorrect ?? true,
      reportedXp: event.xp ?? 0,
      reportedScore: event.score ?? null,
      eventId: generateEventId(),
    });
    if (!ok) {
      console.warn("[engagement] event recording failed", { status: status ?? null });
      return { ok: false };
    }
    return { ok: true, engagementScore: body?.engagementScore ?? null };
  } catch {
    console.warn("[engagement] event recording failed", { status: null });
    return { ok: false };
  }
}

// Called whenever an app sends HSD_OS_PROGRESS (via postMessage or REST).
// Returns { ok, engagementScore, curriculumSync } on success, or
// { ok: false, curriculumSync } when the engagement call itself failed —
// curriculumSync (correction, 2026-09-10) is recordCurriculumProgressEvent()'s
// own honest status, never swallowed, so a caller that cares (AppModal.jsx)
// can tell the family when a curriculum-progress write genuinely failed
// independent of whether engagement tracking succeeded.
export async function processAppEvent(uid, event) {
  if (!uid) return { curriculumSync: null };

  const profileId = event.profileId || SELF_PROFILE_ID;

  // Curriculum-aware apps (Monkey Yoga V2 today) carry a curriculumId in
  // addition to the generic fields below — routed into the profile-scoped
  // curriculum state (src/family/curriculumProgress.js), completely
  // separate storage from engagement/confidence tracking (Phase 3.4 item 3:
  // "curriculum progress and engagement/confidence tracking must remain
  // separate but use the same validated learner identity" — both this call
  // and recordEngagementEvent below independently verify profileId against
  // the same familyMembers ownership check server-side).
  let curriculumSync = null;
  if (event.curriculumId) {
    curriculumSync = await recordCurriculumProgressEvent(uid, profileId, event)
      .catch(() => ({ ok: false, recoverable: true }));
  }

  // Engagement/skill/confidence tracking is isolated in its own try/catch
  // (recordEngagementEvent already never throws, but this is defense in
  // depth) so it can never affect curriculumSync above, in either
  // direction — an activity's curriculum progress is never blocked by a
  // failed or slow analytics call, and vice versa.
  let engagement;
  try {
    engagement = await recordEngagementEvent(profileId, event);
  } catch {
    engagement = { ok: false };
  }

  return { ok: engagement.ok, engagementScore: engagement.engagementScore ?? null, curriculumSync };
}
