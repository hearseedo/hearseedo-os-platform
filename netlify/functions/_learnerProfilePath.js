// HSD OS AI — the ONE shared resolver for "where does this learner's
// engagement/confidence data live" (Phase 3.4, 2026-09-12).
//
// Every current and future reader/writer of this data — record-engagement-
// event.js today, and any later feature (a Jona-facing summary, a parent
// dashboard, an admin tool) — MUST call resolveLearnerProfilePath(uid,
// profileId) rather than reimplementing the self-vs-child branch inline.
// The whole point of centralizing this in one function is that a future
// feature literally cannot "accidentally read the parent when a child is
// selected" — there is only one place that decides the path, and it's
// covered by netlify/functions/__tests__/record-engagement-event-*.test.cjs.
//
// See docs/PHASE_3_4_DATA_MODEL.md for the full data-model writeup,
// including why "self" intentionally still resolves to the pre-existing
// learnerProfiles/{uid} doc (adult/single-user compatibility) while a real
// child profile resolves to a new, additive location nested under that
// child's own familyMembers/{profileId} document.
const SELF_PROFILE_ID = "self";

/**
 * @param {string} uid - the AUTHENTICATED account's uid (from verifyIdToken
 *   — never a client-supplied value).
 * @param {string} profileId - "self", or a familyMembers/{profileId} id.
 *   Ownership of a non-"self" profileId must be verified by the caller
 *   (see record-engagement-event.js) before trusting any path this
 *   function returns — this function only computes the PATH, it performs
 *   no authorization check of its own.
 * @returns {string} the Firestore REST document path (no leading
 *   "/documents", matching this codebase's other firestoreFetch(path) calls)
 *   for this learner's engagement/confidence summary document.
 */
function resolveLearnerProfilePath(uid, profileId) {
  return profileId === SELF_PROFILE_ID
    ? `/learnerProfiles/${uid}`
    : `/users/${uid}/familyMembers/${profileId}/learnerProfile/profile`;
}

module.exports = { resolveLearnerProfilePath, SELF_PROFILE_ID };
