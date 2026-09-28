// Containment (2026-09-26) — single source of truth for who may reach
// Gemini-backed Jona generation (Ask Jona via chat.js, Talk with Jona via
// live-token.js) while the Gemini Developer API's child-directed-use
// eligibility question is unresolved. See
// docs/JONA_LIVE_SAFETY_GATE_B_STAGE2_PLAN_REV2_2026-09-26.md, Blocker A.
//
// This is a temporary pause on PUBLIC generation, not a resolution of the
// underlying eligibility question, and lifting it later does not by itself
// authorize child access — that still requires Blocker A to be resolved
// (see the plan doc) before any release decision.
//
// A caller may reach generation only if BOTH hold:
//   (a) the authenticated account's own email is on this explicit
//       allowlist, AND
//   (b) the request is for that account's own "self" profile — never a
//       family member profile, even one configured under an approved
//       account. Being an approved tester's family member is not the same
//       as being the approved tester; this closes the specific gap where a
//       child profile nested under an admin/tester account would otherwise
//       still reach generation.
//
// Deliberately a hand-maintained array, not a Firestore-backed flag, so it
// can never be widened by a stray config write while this containment is
// in effect (same reasoning live-token.js's own admin allowlist already
// uses).
//
// Deliberately NOT _profileContext.js's isSelfProfileId (2026-09-28
// hardening) — that helper treats a MISSING profileId (undefined/null/"")
// as equivalent to an explicit "self", which is the right, lenient
// behavior for its own purpose (personalization for legacy single-profile
// callers). It is the wrong behavior for a security gate: this file's own
// caller (the real client, both chat.js's sendMessage in src/lib/claude.js
// and TalkWithJona.jsx's POST body) ALWAYS sends an explicit profileId —
// either the literal string "self" or a real family-member id — because
// useAuth.jsx's own activeProfileId already defaults to "self" client-side
// (`profile?.activeProfileId ?? SELF_PROFILE_ID`) before it ever reaches a
// network call. So requiring the literal string here costs nothing against
// any real request. What it closes: a hand-crafted request (bypassing the
// web client, but still using a real approved account's real idToken) that
// omits profileId entirely must not be silently treated as self just
// because "self" is the friendly default elsewhere in this codebase.
// Unresolved must fail closed, not normalize to the most-privileged case.
const APPROVED_ADULT_TESTERS = ["hearseedo.english@gmail.com", "waltho79@gmail.com"];

/**
 * @param {{ email: string|null|undefined, profileId: string|null|undefined }} params
 * @returns {boolean}
 */
function isApprovedAdultTesterProfile({ email, profileId }) {
  if (!email || !APPROVED_ADULT_TESTERS.includes(email)) return false;
  return profileId === "self";
}

module.exports = { APPROVED_ADULT_TESTERS, isApprovedAdultTesterProfile };
