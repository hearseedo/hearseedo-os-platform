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
import { getMigratedLessonIds, getMTAUBookLessonCount, getMTAUBook } from "./mtauContent";

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

/**
 * Persists confidenceBefore/confidenceAfter (1-5 self-rating) onto the SAME
 * per-lesson progress doc used for step/completion tracking — not a
 * separate collection. Written immediately when the learner picks a rating
 * (not just at lesson completion) so it survives refresh/resume the same
 * way currentStep does.
 */
export async function recordMTAUConfidence(uid, profileId, bookId, lessonId, phase, value) {
  const ref = doc(db, ...progressCollectionPath(uid, profileId), mtauDocId(bookId, lessonId));
  const field = phase === "before" ? "confidenceBefore" : "confidenceAfter";
  await setDoc(ref, {
    curriculum: "mtau",
    bookId, lessonId,
    [field]: value,
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
 * Reads every migrated lesson's progress for a book in one go — the
 * primary read the journey screen needs (was previously Lesson-1-only).
 */
export async function getMTAUBookProgress(uid, profileId, bookId) {
  const lessonIds = getMigratedLessonIds(bookId);
  const entries = await Promise.all(
    lessonIds.map(async lessonId => [lessonId, await getMTAULessonProgress(uid, profileId, bookId, lessonId)])
  );
  return Object.fromEntries(entries); // { [lessonId]: progressDocOrNull }
}

/**
 * Deterministic "what's current / what's next" for a book — mirrors
 * familyProgress.js's getRecommendedActivity in spirit (simple rules, no
 * ML), generalized across however many lessons are actually migrated for
 * this book (was hardcoded to Lesson 1 -> Lesson 2 only; now data-driven
 * off getMigratedLessonIds, so it needed zero changes when Lessons 2/3
 * were added).
 *
 * progressByLessonId: { [lessonId]: progressDocOrNull }, e.g. from
 * getMTAUBookProgress above.
 */
export function getMTAUCurrentLesson(bookId, progressByLessonId) {
  const migratedIds = getMigratedLessonIds(bookId);
  if (migratedIds.length === 0) return null; // nothing migrated for this book at all

  for (const lessonId of migratedIds) {
    const p = progressByLessonId[lessonId];
    if (!p || !p.completed) {
      return { bookId, lessonId, available: true, status: p ? "in_progress" : "not_started" };
    }
  }
  // Every migrated lesson is complete — the real next lesson (by number)
  // may or may not have been migrated yet.
  const nextLessonId = migratedIds[migratedIds.length - 1] + 1;
  return { bookId, lessonId: nextLessonId, available: false, status: "not_migrated" };
}

/**
 * Whether a book is genuinely, fully complete — every real lesson the
 * curriculum has (not just every currently-migrated lesson) is migrated
 * AND completed. Deliberately requires getMTAUBookLessonCount to know the
 * real total first: this is what stops "15 of 15 migrated" from ever being
 * mistaken for "book complete" while lessons 16-18 still existed only as
 * summary metadata. No lesson-number is hardcoded here — a book with a
 * different real length would just work.
 */
export function isMTAUBookComplete(bookId, progressByLessonId) {
  const migratedIds = getMigratedLessonIds(bookId);
  if (migratedIds.length === 0) return false;
  const totalLessons = getMTAUBookLessonCount(bookId);
  if (totalLessons == null || migratedIds.length < totalLessons) return false;
  return migratedIds.every(lessonId => progressByLessonId[lessonId]?.completed);
}

/**
 * Certificate-ready hook (not a certificate generator): a plain, derived
 * summary of a genuinely completed book, built only from real completed-
 * lesson docs — never a temporary UI flag. Returns null until
 * isMTAUBookComplete is true. A future certificate feature can read this
 * directly instead of re-deriving completion state itself.
 */
export function getMTAUBookCompletionRecord(bookId, progressByLessonId) {
  if (!isMTAUBookComplete(bookId, progressByLessonId)) return null;
  const migratedIds = getMigratedLessonIds(bookId);
  const book = getMTAUBook(bookId);
  const completedAtTimestamps = migratedIds
    .map(lessonId => progressByLessonId[lessonId]?.completedAt)
    .filter(Boolean);
  return {
    bookId,
    city: book?.city ?? null,
    cefr: book?.cefr ?? null,
    eiken: book?.eiken ?? null,
    lessonsCompleted: migratedIds.length,
    totalLessons: migratedIds.length,
    // Firestore serverTimestamp sentinels resolve to real Timestamps once
    // read back — the latest one is an honest "book completed at" moment.
    completedAt: completedAtTimestamps.length > 0 ? completedAtTimestamps[completedAtTimestamps.length - 1] : null,
  };
}
