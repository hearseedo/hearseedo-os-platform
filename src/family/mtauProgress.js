// Monkeys Talk & Unlock — Family Firestore progress (Summit Readiness
// Sprint, 2026-09-17).
//
// The standalone reference product's progress lives in browser
// localStorage only, per-device, with no per-child separation (audited
// directly: `hsd-mtu-book2-progress-v1` in localStorage, never synced
// anywhere). That is prototype-only and is NOT reused here.
//
// Instead this extends the EXACT SAME per-profile subcollection pattern
// familyProgress.js already established for Family activities
// (users/{uid}/activityProgress/{docId} for the self profile,
// users/{uid}/familyMembers/{profileId}/activityProgress/{docId} for a
// child) — one more document shape in the same collection, not a second
// progress system. Doc id is `mtau-book{bookId}-lesson{lessonId}`.
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { SELF_PROFILE_ID } from "../lib/profiles";

function progressCollectionPath(uid, profileId) {
  return profileId === SELF_PROFILE_ID
    ? ["users", uid, "activityProgress"]
    : ["users", uid, "familyMembers", profileId, "activityProgress"];
}

export function mtauDocId(bookId, lessonId) {
  return `mtau-book${bookId}-lesson${lessonId}`;
}

/** Reads one lesson's progress doc, or null if never started. */
export async function getMTAULessonProgress(uid, profileId, bookId, lessonId) {
  const ref = doc(db, ...progressCollectionPath(uid, profileId), mtauDocId(bookId, lessonId));
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * Persists the learner's current position in the lesson (which step index
 * they're on) plus which steps have been completed so far. Called on every
 * step advance — this is what makes "leave mid-lesson, come back, resume
 * from the same step" work, the same way familyProgress.js's
 * recordActivityStarted establishes the "Continue Your Journey" signal.
 */
export async function recordMTAUStep(uid, profileId, bookId, lessonId, stepIndex, completedSteps) {
  const ref = doc(db, ...progressCollectionPath(uid, profileId), mtauDocId(bookId, lessonId));
  await setDoc(ref, {
    curriculum: "mtau",
    bookId, lessonId,
    currentStep: stepIndex,
    completedSteps,
    completed: false,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/** Marks the lesson fully complete — the one write that makes "Lesson 2 becomes recommended" possible once Lesson 2 exists. */
export async function recordMTAULessonCompleted(uid, profileId, bookId, lessonId, completedSteps) {
  const ref = doc(db, ...progressCollectionPath(uid, profileId), mtauDocId(bookId, lessonId));
  await setDoc(ref, {
    curriculum: "mtau",
    bookId, lessonId,
    completedSteps,
    completed: true,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Deterministic "what's next" for the MTAU journey screen — mirrors
 * familyProgress.js's getRecommendedActivity in spirit (simple rules, no
 * ML). This pass only has Lesson 1 of Book 1 migrated, so "next" beyond
 * that is reported as a label only (bookId/lessonId that isn't loadable
 * yet), never a fabricated navigable lesson.
 */
export function getMTAUNextLesson(lessonProgress) {
  if (!lessonProgress || !lessonProgress.completed) {
    return { bookId: 1, lessonId: 1, available: true };
  }
  // Lesson 1 complete — Lesson 2 is the recommended next step, but its
  // content hasn't been migrated this pass (scope: stop after Lesson 1).
  return { bookId: 1, lessonId: 2, available: false };
}
