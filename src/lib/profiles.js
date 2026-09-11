// HSD OS AI — profile/learner accessor (Phase 1, 2026-09-09).
//
// Canonical API for "the learner profiles this account owns". Physically
// unchanged from the existing data: profiles ARE users/{uid}/familyMembers/{id}
// docs, plus one synthesized "self" profile representing the account owner,
// backed by fields that already live on the root users/{uid} doc
// (confidenceScore, streak, cefr, etc.) rather than a literal Firestore doc.
//
// Why not a real doc for the owner's own profile? Moving those fields into
// a subcollection doc would be a destructive migration touching every
// existing read of user.confidenceScore/streak/cefr/etc. across the app
// (Dashboard.jsx, ParentView.jsx, Achievements.jsx, and more) for a
// same-session task. This module instead gives the NEW pathway/profile
// code one consistent shape to read from today, and is the seam where a
// real migration could later move the owner's fields into a doc without
// changing any caller of getProfiles()/getProfile().
//
// See docs/PHASE_1_ARCHITECTURE.md for the full account/profile/pathway
// design and the audit of the two pre-existing, partially-overlapping
// learner models (users/{uid}.familyMembers vs. the separate
// learnerProfiles/{uid} collection) that led to this design.

import { db } from "./firebase";
import { collection, doc, addDoc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";

export const SELF_PROFILE_ID = "self";

/** Synthesizes the account owner's own "profile" from their account fields. */
export function buildSelfProfile(account) {
  if (!account) return null;
  return {
    id:              SELF_PROFILE_ID,
    profileType:     "owner",
    name:            account.name,
    age:             null,
    cefr:            account.cefr ?? null,
    confidenceScore: account.confidenceScore ?? 0,
    primaryApp:      null,
    assessmentDone:  account.assessmentDone ?? false,
    // Not a real Firestore doc — owned implicitly by the account itself.
    ownerAccountId:  account.uid,
    isVirtual:       true,
  };
}

/**
 * Combines the synthesized self profile with the real familyMembers docs
 * into one list — the canonical "all profiles this account can select"
 * used by the profile switcher.
 * @param {object} account - user object from useAuth
 * @param {Array} familyMembers - raw familyMembers subcollection docs, each
 *   with an `id` (already how Dashboard.jsx/ParentView.jsx read them today)
 */
export function getProfiles(account, familyMembers = []) {
  const self = buildSelfProfile(account);
  const members = familyMembers.map(m => ({
    ...m,
    profileType:    m.profileType ?? "child",
    ownerAccountId: account?.uid ?? null,
    isVirtual:      false,
  }));
  return self ? [self, ...members] : members;
}

export function getProfile(account, familyMembers, profileId) {
  return getProfiles(account, familyMembers).find(p => p.id === profileId) ?? null;
}

/**
 * Live subscription to an account's familyMembers subcollection.
 * `onError` (Phase 3.2 hardening, 2026-09-12) is optional for backward
 * compatibility but should always be passed by real callers — without it,
 * a denied/failed listener silently leaves `onChange` never called again,
 * which looks identical to "this account has no family members" to
 * anything downstream. Never falls back to a cached/previous list on
 * error; that decision belongs to the caller.
 */
export function subscribeToFamilyMembers(uid, onChange, onError) {
  return onSnapshot(
    collection(db, "users", uid, "familyMembers"),
    (snap) => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  );
}

/**
 * Creates a new (non-self) profile under this account.
 * relationship/permissions are new, optional, additive fields (Phase 1
 * item 8) — existing familyMembers docs simply won't have them, which is
 * fine since every reader treats them as optional.
 */
export async function createProfile(uid, { name, age, primaryApp, relationship = "child", ageBand = null, interests = [], confidenceGoal = null }) {
  return addDoc(collection(db, "users", uid, "familyMembers"), {
    name:            name.trim(),
    age:             age ?? null,
    // Phase 3 (HSD Family, item 4): ageBand is the primary categorization
    // used by content.js's getActivitiesByCategory(category, ageBand) —
    // prefer this over the precise `age` integer, which is kept only for
    // backward compatibility with pre-Phase-3 callers (EIKEN placement etc).
    ageBand,
    interests,
    confidenceGoal,
    primaryApp:      primaryApp ?? null,
    confidenceScore: 0,
    cefr:            null,
    assessmentDone:  false,
    profileType:     relationship === "child" ? "child" : "member",
    relationship,
    createdAt:       serverTimestamp(),
    consentGiven:    true,
    consentedAt:     serverTimestamp(),
    consentedByUid:  uid,
  });
}

export async function updateProfile(uid, profileId, patch) {
  if (profileId === SELF_PROFILE_ID) {
    // Self profile fields live on the root account doc, not a subdoc — and
    // several of them (plan, subscriptions, etc.) are privileged. This
    // helper only ever touches the same non-privileged fields the rest of
    // the app already writes to users/{uid} directly (confidenceScore,
    // cefr, etc.), never billing/pathway-entitlement fields.
    return updateDoc(doc(db, "users", uid), patch);
  }
  return updateDoc(doc(db, "users", uid, "familyMembers", profileId), patch);
}
