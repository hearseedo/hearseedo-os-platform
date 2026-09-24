// Shared profile-scoping helpers (P0, 2026-09-24 — see
// docs/PROFILE_CONTEXT_MIGRATION_PROPOSAL_2026-09-24.md). Reference
// implementation is src/eiken/storage.js + netlify/functions/eiken-progress.js,
// already proven in production — this module generalizes that SAME
// convention for Career Ready / Global Ready / Speak Ready rather than
// inventing a second pattern:
//
//   self profile  -> the existing legacy path/key, byte-for-byte unchanged
//                     (zero migration, zero behavior change for every
//                     existing single-profile account, forever)
//   member profile -> a new, separate, profile-scoped path/key
//
// Two distinct techniques for two distinct storage technologies (EIKEN
// already does both, separately, this just names them for reuse):
//   - Firestore: a real nested path (users/{uid}/familyMembers/{memberId}/...)
//     — required, because Firestore security rules check the uid path
//     segment itself; a fake/composite uid cannot be used here.
//   - localStorage: a composite key suffix (`${uid}:${profileId}`) — no
//     security rules involved, so the simpler technique EIKEN's own
//     storage.js already uses (`hsd-eiken-user:${activeMember.id}`) applies
//     directly.
import { doc } from "firebase/firestore";
import { db } from "./firebase";

export const SELF_PROFILE_ID = "self";

export function isSelfProfile(profileId) {
  return !profileId || profileId === SELF_PROFILE_ID;
}

/**
 * Firestore doc ref for a profile-scoped app data doc. Self keeps using the
 * existing legacy path; a real member profile gets its own doc nested under
 * users/{uid}/familyMembers/{memberId}/{scopedSubcollection}/{scopedDocId}.
 */
export function profileScopedDocRef(uid, profileId, legacyCollection, legacyDocId, scopedSubcollection, scopedDocId = "current") {
  return isSelfProfile(profileId)
    ? doc(db, "users", uid, legacyCollection, legacyDocId)
    : doc(db, "users", uid, "familyMembers", profileId, scopedSubcollection, scopedDocId);
}

/**
 * localStorage key identifier for a profile-scoped app data key. Self
 * returns `uid` unchanged (so `${prefix}_${uid}` matches today's existing
 * key exactly); a real member profile gets a distinct composite identifier
 * so a different profile's badges/XP/saved items never collide with
 * another's on the same device.
 */
export function profileScopedStorageUid(uid, profileId) {
  if (!uid) return uid;
  return isSelfProfile(profileId) ? uid : `${uid}:${profileId}`;
}
