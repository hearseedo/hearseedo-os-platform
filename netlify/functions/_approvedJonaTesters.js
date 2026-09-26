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
const { isSelfProfileId } = require("./_profileContext");

const APPROVED_ADULT_TESTERS = ["hearseedo.english@gmail.com", "waltho79@gmail.com"];

/**
 * @param {{ email: string|null|undefined, profileId: string|null|undefined }} params
 * @returns {boolean}
 */
function isApprovedAdultTesterProfile({ email, profileId }) {
  if (!email || !APPROVED_ADULT_TESTERS.includes(email)) return false;
  return isSelfProfileId(profileId);
}

module.exports = { APPROVED_ADULT_TESTERS, isApprovedAdultTesterProfile };
