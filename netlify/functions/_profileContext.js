// Jona profile identity resolution (P0, 2026-09-24 — see
// docs/PROFILE_CONTEXT_MIGRATION_PROPOSAL_2026-09-24.md §6). The client
// SENDS a profileId claim (whichever profile is active in its own UI) but
// that claim is NEVER trusted as-is: it only ever selects WHICH server-side
// document to look up, and that document is always fetched from a path
// nested under the caller's own verified uid
// (users/{uid} or users/{uid}/familyMembers/{profileId}) — there is no
// value of profileId a client could supply that reaches another account's
// data, by construction of the Firestore path itself. If the requested
// profile doesn't exist (bad id, deleted profile, typo, another
// household's id) this fails safe by falling back to the account owner's
// OWN "self" context — never to another real person's data, and never with
// an error that would reveal whether some other id exists. Returns only
// the small set of fields Jona actually needs for personalization — not
// the whole account/profile record.
//
// `firestoreFetch`/`fromFirestoreFields` are passed in (not required
// directly from _firebaseAdmin.js) so this module can be unit-tested with a
// fake fetcher, without a real network call or the Firestore emulator.

async function resolveProfileContext(firestoreFetch, fromFirestoreFields, uid, profileId) {
  const isSelf = !profileId || profileId === "self";
  const path = isSelf ? `/users/${uid}` : `/users/${uid}/familyMembers/${profileId}`;
  try {
    const res = await firestoreFetch(path);
    if (!res.ok) {
      if (!isSelf) return resolveProfileContext(firestoreFetch, fromFirestoreFields, uid, "self"); // fail safe: never another real profile
      return null;
    }
    const doc = await res.json();
    const data = fromFirestoreFields(doc.fields ?? {});
    return {
      name:            typeof data.name === "string" && data.name ? data.name : "there",
      isSelf,
      age:             typeof data.age === "number" ? data.age : null,
      ageBand:         typeof data.ageBand === "string" ? data.ageBand : null,
      confidenceScore: typeof data.confidenceScore === "number" ? data.confidenceScore : null,
      cefr:            typeof data.cefr === "string" ? data.cefr : null,
    };
  } catch {
    if (!isSelf) {
      try { return await resolveProfileContext(firestoreFetch, fromFirestoreFields, uid, "self"); } catch { return null; }
    }
    return null;
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

module.exports = { resolveProfileContext, buildProfileContextLine };
