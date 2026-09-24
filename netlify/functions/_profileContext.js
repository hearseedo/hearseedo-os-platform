// Jona profile identity resolution (P0, 2026-09-24 — see
// docs/PROFILE_CONTEXT_MIGRATION_PROPOSAL_2026-09-24.md §6). The client
// SENDS a profileId claim (whichever profile is active in its own UI) but
// that claim is NEVER trusted as-is: it only ever selects WHICH server-side
// document to look up, and that document is always fetched from a path
// nested under the caller's own verified uid
// (users/{uid} or users/{uid}/familyMembers/{profileId}) — there is no
// value of profileId a client could supply that reaches another account's
// data, by construction of the Firestore path itself.
//
// FAIL-CLOSED distinction (2026-09-24 hardening, in response to review):
// "no profileId supplied at all" and "a profileId was supplied but is
// invalid/unauthorized" are NOT the same case and must not be handled the
// same way.
//   - No profileId (undefined/null/"") -> legitimate legacy/self behavior.
//     Always resolves to the account's own "self" context. This is the
//     normal shape for every existing single-profile caller and is never
//     an error.
//   - profileId === "self" explicitly -> same as above, by definition.
//   - A real, non-self profileId was supplied but doesn't resolve (bad id,
//     deleted profile, wrong household, or the lookup itself fails) ->
//     FAILS CLOSED. This must NEVER silently resolve to the self profile
//     instead — a caller who explicitly asked for "Emma" must not silently
//     get "the account owner" back with no indication anything went wrong.
//     Identity must never change invisibly. The caller (chat.js) is
//     expected to turn `ok: false` into an actual rejected request, not
//     quietly proceed.
// A transient failure to read the SELF profile's own doc (e.g. a Firestore
// hiccup) is different again — there was no identity claim to violate, so
// this returns `ok: true, profile: null` (personalization just isn't
// available this turn), not a failure.
//
// Returns only the small set of fields Jona actually needs for
// personalization — not the whole account/profile record.
//
// `firestoreFetch`/`fromFirestoreFields` are passed in (not required
// directly from _firebaseAdmin.js) so this module can be unit-tested with a
// fake fetcher, without a real network call or the Firestore emulator.

function isNoProfileIdSupplied(profileId) {
  return profileId === undefined || profileId === null || profileId === "";
}

function isSelfProfileId(profileId) {
  return isNoProfileIdSupplied(profileId) || profileId === "self";
}

async function fetchProfileDoc(firestoreFetch, fromFirestoreFields, path) {
  const res = await firestoreFetch(path);
  if (!res.ok) return null;
  const doc = await res.json();
  const data = fromFirestoreFields(doc.fields ?? {});
  return {
    name:            typeof data.name === "string" && data.name ? data.name : "there",
    age:             typeof data.age === "number" ? data.age : null,
    ageBand:         typeof data.ageBand === "string" ? data.ageBand : null,
    confidenceScore: typeof data.confidenceScore === "number" ? data.confidenceScore : null,
    cefr:            typeof data.cefr === "string" ? data.cefr : null,
  };
}

/**
 * @returns {Promise<{ ok: true, profile: object|null } | { ok: false, reason: string }>}
 */
async function resolveProfileContext(firestoreFetch, fromFirestoreFields, uid, profileId) {
  if (isSelfProfileId(profileId)) {
    try {
      const profile = await fetchProfileDoc(firestoreFetch, fromFirestoreFields, `/users/${uid}`);
      return { ok: true, profile: profile ? { ...profile, isSelf: true } : null };
    } catch {
      return { ok: true, profile: null }; // transient — not an identity failure
    }
  }

  // Explicit, non-self profileId — must resolve, or fail closed.
  try {
    const profile = await fetchProfileDoc(firestoreFetch, fromFirestoreFields, `/users/${uid}/familyMembers/${profileId}`);
    if (!profile) return { ok: false, reason: "profile_not_found" };
    return { ok: true, profile: { ...profile, isSelf: false } };
  } catch {
    return { ok: false, reason: "profile_lookup_failed" };
  }
}

function buildProfileContextLine(profile) {
  if (!profile) return "";
  const parts = [`name: ${profile.name}`];
  if (profile.age != null) parts.push(`age: ${profile.age}`);
  else if (profile.ageBand) parts.push(`age band: ${profile.ageBand}`);
  if (profile.confidenceScore != null) parts.push(`confidence score: ${profile.confidenceScore}%`);
  if (profile.cefr) parts.push(`CEFR level: ${profile.cefr}`);
  return `\n\nYou are talking to this specific person right now — ${parts.join(", ")}. Address and personalize your response for THIS person only — never reference or reveal another household member's name, progress, or details, even if this account has other profiles.`;
}

module.exports = { resolveProfileContext, buildProfileContextLine, isSelfProfileId, isNoProfileIdSupplied };
