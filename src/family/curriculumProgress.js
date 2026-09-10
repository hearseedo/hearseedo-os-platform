// HSD OS AI — shared curriculum state, client side (2026-09-10).
//
// Security correction (Phase A/B review): reads and writes both now go
// through server-authenticated Netlify functions
// (get-classroom-position.js, record-curriculum-progress.js) instead of
// direct client-SDK Firestore calls. The browser can no longer read the
// full `classes` collection (would leak every family's uid/profileId/class
// membership to any signed-in stranger) or write curriculumProgress
// directly (would let a forged event skip server-side field validation) —
// see firestore.rules, both are now write:false / admin-only-read on the
// client side.
//
// Distinguishes the three kinds of "position" the architecture design calls
// for, and keeps them genuinely separate:
//   - classroomPosition — what the class/teacher is currently teaching
//     (read-only here, server-resolved via get-classroom-position.js)
//   - individualPosition — where this specific learner's own practice has
//     actually gotten to (this module reads it directly — client-SDK read
//     of one's own doc is still safe and unchanged; only WRITES moved
//     server-side)
//   - homePracticeLog — what was actually done at home (write-only from
//     here, via the server function; read directly for display)
//
// The one rule that matters most: completing home practice must NEVER
// advance classroomPosition. recordCurriculumProgressEvent() below has no
// code path that touches the classes collection at all — it can't, since
// it doesn't even have a reference to it.
import { db, auth } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { SELF_PROFILE_ID } from "../lib/profiles";
import { MONKEY_YOGA_CURRICULUM_ID, resolveRouteTarget, isValidProgressEvent } from "../lib/curriculumRouting";

export { MONKEY_YOGA_CURRICULUM_ID, resolveRouteTarget, isValidProgressEvent };

function curriculumDocPath(uid, profileId, curriculumId) {
  return profileId === SELF_PROFILE_ID
    ? ["users", uid, "curriculumProgress", curriculumId]
    : ["users", uid, "familyMembers", profileId, "curriculumProgress", curriculumId];
}

async function callFunction(path, payload) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

/**
 * Reads all three position types for one learner. classroomPosition can be
 * null (not in a class yet); individualPosition can be null (never
 * practised yet) — both are valid, normal states, not errors.
 */
export async function getCurriculumState(uid, profileId, curriculumId = MONKEY_YOGA_CURRICULUM_ID) {
  const ref = doc(db, ...curriculumDocPath(uid, profileId, curriculumId));
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);

  const [snap, classroomResult] = await Promise.all([
    getDoc(ref).catch(() => null),
    idToken ? callFunction("/api/get-classroom-position", { idToken, profileId }).catch(() => null) : Promise.resolve(null),
  ]);
  const individualPosition = snap?.exists() ? snap.data() : null;
  const classroomPosition = classroomResult?.classroomPosition ?? null;
  return { classroomPosition, individualPosition };
}

/**
 * Sends one HSD_OS_PROGRESS event from Monkey Yoga V2 to the server-
 * authenticated recorder. Validation, profile-ownership checks, and the
 * actual Firestore write all happen server-side now — this function is
 * just the authenticated transport.
 */
export async function recordCurriculumProgressEvent(uid, profileId, event) {
  if (!uid || !profileId || !isValidProgressEvent(event)) return;
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  if (!idToken) return;
  await callFunction("/api/record-curriculum-progress", { idToken, profileId, ...event }).catch(() => null);
}
