import { ACCESS_CODES, INACTIVE_CODES } from "../constants/accessCodes";
import { db, auth } from "./firebase";
import { doc, updateDoc, increment, serverTimestamp, setDoc } from "firebase/firestore";

// ── Validation ────────────────────────────────────────────────────────────────

export function validateAccessCode(code) {
  const trimmed = (code || "").trim().toUpperCase();
  if (INACTIVE_CODES.includes(trimmed)) return { valid: false, error: "expired" };
  const definition = ACCESS_CODES[trimmed];
  if (!definition) return { valid: false, error: "invalid" };
  if (!definition.active) return { valid: false, error: "expired" };
  return { valid: true, code: trimmed, definition };
}

// ── Activation ────────────────────────────────────────────────────────────────

export async function activateAccessCode(user, code) {
  const { valid, error, definition } = validateAccessCode(code);
  if (!valid) return { success: false, error };

  // accessPass grants hasFullPlatformAccess — a privileged, access-granting
  // field. As of the Phase 0 security hardening, firestore.rules denies
  // client writes to it, so the actual validate-and-write now happens
  // server-side (redeem-access-code.js), authenticated by the caller's own
  // Firebase ID token. onSnapshot in useAuth still propagates the resulting
  // change automatically once the server has written it.
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) return { success: false, error: "invalid" };

  let result;
  try {
    const res = await fetch("/api/redeem-access-code", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ idToken, code }),
    });
    result = await res.json();
  } catch {
    return { success: false, error: "invalid" };
  }

  if (!result?.success) return { success: false, error: result?.error ?? "invalid" };

  const { accessPass } = result;

  // Track in localStorage for admin panel (MVP)
  // TODO: Replace with Firestore collection write — e.g. addDoc(collection(db, "accessCodeActivations"), {...})
  trackAdminActivation(user, accessPass);
  trackAdminEvent({
    eventType:       "access_code_activated",
    userId:          user.uid,
    email:           user.email,
    description:     `Activated ${code}`,
    accessCodeUsed:  code,
    campaignCategory: definition.campaignCategory,
    learningPath:    null,
    creditsRemaining: definition.aiCredits,
  });

  return { success: true, accessPass };
}

// ── Credit Management ─────────────────────────────────────────────────────────

export async function deductAICredit(user, context = {}) {
  if (!user?.uid) return { allowed: false };
  const pass = user.accessPass;
  if (!pass || pass.status !== "active") return { allowed: false, reason: "no_pass" };
  if (!isAccessActive(pass)) return { allowed: false, reason: "expired" };
  if ((pass.aiCreditsRemaining ?? 0) <= 0) return { allowed: false, reason: "no_credits" };

  // Decrement in Firestore atomically
  // TODO: Use a Netlify function / transaction for server-side credit guard.
  // NOTE: this function is not currently called from any UI (dead code as of
  // the Phase 0 audit). accessPass is now a privileged field per
  // firestore.rules, so this direct client write will fail with
  // permission-denied if this function is ever wired up — that's intentional
  // fail-safe behavior until it's rebuilt as a server endpoint like
  // redeem-access-code.js.
  await updateDoc(doc(db, "users", user.uid), {
    "accessPass.aiCreditsRemaining": increment(-1),
    "accessPass.aiCreditsUsed":      increment(1),
  });

  const remaining = (pass.aiCreditsRemaining ?? 1) - 1;

  trackAdminEvent({
    eventType:        "ai_credit_used",
    userId:           user.uid,
    email:            user.email,
    description:      `Used 1 AI credit${context.section ? ` in ${context.section}` : ""}`,
    accessCodeUsed:   pass.accessCodeUsed,
    campaignCategory: pass.campaignCategory,
    learningPath:     context.learningPath ?? null,
    creditsRemaining: remaining,
  });

  return { allowed: true, remaining };
}

export function getRemainingCredits(user) {
  return user?.accessPass?.aiCreditsRemaining ?? 0;
}

export function hasCreditAvailable(user) {
  return getRemainingCredits(user) > 0 && isAccessActive(user?.accessPass);
}

// ── Status Helpers ─────────────────────────────────────────────────────────────

export function isAccessActive(accessPass) {
  if (!accessPass) return false;
  if (accessPass.status !== "active") return false;
  if (!accessPass.expiresAt) return false;
  return new Date(accessPass.expiresAt) > new Date();
}

export function getUserAccessStatus(accessPass) {
  if (!accessPass) return "none";
  if (accessPass.status === "active" && isAccessActive(accessPass)) {
    if ((accessPass.aiCreditsRemaining ?? 0) === 0) return "credits_used";
    if ((accessPass.aiCreditsRemaining ?? 0) <= 5)  return "low_credits";
    return "active";
  }
  return "expired";
}

export function calculateExpiryDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function formatExpiry(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-JP", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function daysUntilExpiry(isoString) {
  if (!isoString) return 0;
  const diff = new Date(isoString) - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
}

// ── Admin localStorage tracking (MVP) ─────────────────────────────────────────
// TODO: Replace all localStorage calls below with Firestore writes

function trackAdminActivation(user, accessPass) {
  const key     = "hsd_admin_signups";
  const existing = JSON.parse(localStorage.getItem(key) || "[]");
  const record  = {
    userId:            user.uid,
    name:              user.name ?? user.email?.split("@")[0],
    email:             user.email,
    userType:          deriveUserType(accessPass.campaignCategory),
    accessCodeUsed:    accessPass.accessCodeUsed,
    campaignCategory:  accessPass.campaignCategory,
    source:            accessPass.source,
    selectedPath:      deriveDefaultPath(accessPass.campaignCategory),
    mainGoal:          "",
    signupTime:        new Date().toISOString(),
    lastActiveTime:    new Date().toISOString(),
    aiCreditsGranted:  accessPass.aiCreditsGranted,
    aiCreditsUsed:     0,
    aiCreditsRemaining: accessPass.aiCreditsGranted,
    accessStatus:      "active",
    activatedAt:       accessPass.activatedAt,
    expiresAt:         accessPass.expiresAt,
    sessionsCompleted: 0,
    confidenceScore:   0,
    savedPhrases:      0,
    badges:            [],
  };
  const idx = existing.findIndex(r => r.userId === user.uid);
  if (idx >= 0) existing[idx] = record;
  else existing.unshift(record);
  localStorage.setItem(key, JSON.stringify(existing));
  window.dispatchEvent(new Event("hsd_admin_update"));
}

export function trackAdminEvent(event) {
  const key    = "hsd_admin_events";
  const events = JSON.parse(localStorage.getItem(key) || "[]");
  events.unshift({ ...event, eventId: `ev_${Date.now()}`, timestamp: new Date().toISOString() });
  localStorage.setItem(key, JSON.stringify(events.slice(0, 200)));
  window.dispatchEvent(new Event("hsd_admin_update"));
}

export function trackPracticeSession(user, session) {
  const key      = "hsd_admin_signups";
  const signups  = JSON.parse(localStorage.getItem(key) || "[]");
  const idx      = signups.findIndex(r => r.userId === user.uid);
  if (idx >= 0) {
    signups[idx].sessionsCompleted = (signups[idx].sessionsCompleted ?? 0) + 1;
    signups[idx].lastActiveTime    = new Date().toISOString();
    if (session.confidenceScoreAfter) signups[idx].confidenceScore = session.confidenceScoreAfter;
    localStorage.setItem(key, JSON.stringify(signups));
    window.dispatchEvent(new Event("hsd_admin_update"));
  }
  trackAdminEvent({
    eventType:        "session_completed",
    userId:           user.uid,
    email:            user.email,
    description:      `Completed ${session.practiceType ?? "practice"} session`,
    accessCodeUsed:   user.accessPass?.accessCodeUsed,
    campaignCategory: user.accessPass?.campaignCategory,
    learningPath:     session.learningPath,
    creditsRemaining: getRemainingCredits(user),
  });
}

function deriveUserType(category) {
  const map = {
    "Kindergarten":             "Parent",
    "University":               "University Student",
    "Family":                   "Parent",
    "Teacher":                  "Teacher",
    "Workshop / Event / Partner": "Workshop Attendee",
  };
  return map[category] ?? "Adult Learner";
}

function deriveDefaultPath(category) {
  const map = {
    "Kindergarten":             "Kids Path",
    "University":               "University Path",
    "Family":                   "Family Path",
    "Teacher":                  "Adult Path",
    "Workshop / Event / Partner": "Adult Path",
  };
  return map[category] ?? "Adult Path";
}
