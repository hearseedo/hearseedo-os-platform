// HSD Family — activity progress + deterministic recommendation (Phase 3).
//
// Storage: users/{uid}/activityProgress/{activityId} for the "self" profile,
// users/{uid}/familyMembers/{profileId}/activityProgress/{activityId} for a
// child profile — reusing the exact per-profile subcollection pattern
// already established for learningPath in Phase 1 (see firestore.rules).
// No new top-level collection for progress data.
import { db } from "../lib/firebase";
import { doc, setDoc, getDocs, collection, serverTimestamp, increment, updateDoc } from "firebase/firestore";
import { SELF_PROFILE_ID, updateProfile } from "../lib/profiles";
import { CATEGORIES, getActivitiesByCategory, ALL_ACTIVITIES } from "./content";
import { logPathwayEvent } from "../lib/pathwayAnalytics";

function progressCollectionPath(uid, profileId) {
  return profileId === SELF_PROFILE_ID
    ? ["users", uid, "activityProgress"]
    : ["users", uid, "familyMembers", profileId, "activityProgress"];
}

export async function getActivityProgress(uid, profileId) {
  const snap = await getDocs(collection(db, ...progressCollectionPath(uid, profileId)));
  return Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
}

/** Marks an activity started — used for the "Continue Your Journey" last-activity signal. */
export async function recordActivityStarted(uid, profileId, activityId) {
  const ref = doc(db, ...progressCollectionPath(uid, profileId), activityId);
  await setDoc(ref, { activityId, startedAt: serverTimestamp(), completed: false }, { merge: true });
  logPathwayEvent(uid, "activity_started", { profileId, activityId });
}

/** Marks an activity completed and bumps the account-level counters Achievements.jsx already reads. */
export async function recordActivityCompleted(uid, profileId, activityId) {
  const ref = doc(db, ...progressCollectionPath(uid, profileId), activityId);
  await setDoc(ref, { activityId, completed: true, completedAt: serverTimestamp() }, { merge: true });

  const activity = ALL_ACTIVITIES.find(a => a.activityId === activityId);
  // Reuse the EXISTING achievement counter fields (Achievements.jsx already
  // reads xpEarned/lessonsCompleted) rather than inventing a second scoring
  // system — a completed Family activity counts as a lesson, same as any
  // other app's completion already does. familyXxxCompleted are new,
  // additive, per-category counters the new Family achievements (below)
  // check against.
  const targetDoc = profileId === SELF_PROFILE_ID
    ? doc(db, "users", uid)
    : doc(db, "users", uid, "familyMembers", profileId);
  const patch = {
    lessonsCompleted: increment(1),
    xpEarned: increment(20),
    familyActivitiesCompleted: increment(1),
  };
  if (activity?.category) patch[`family${activity.category[0].toUpperCase()}${activity.category.slice(1)}Completed`] = increment(1);
  await updateDoc(targetDoc, patch).catch(() => {});

  logPathwayEvent(uid, "activity_completed", { profileId, activityId });
}

export function recordActivityAbandoned(uid, profileId, activityId) {
  logPathwayEvent(uid, "activity_abandoned", { profileId, activityId });
}

/**
 * Deterministic recommendation (item 34) — no ML, just simple rules:
 * 1. An unfinished (started, not completed) activity, if one exists.
 * 2. Otherwise, the first not-yet-completed activity in HEAR -> SEE -> DO ->
 *    TALK -> CREATE order for this profile's age band (the learning loop,
 *    item 35 — not every activity needs every stage, but recommendations
 *    walk the categories in that order).
 * 3. If everything in scope is completed, recommend a Family Hub activity
 *    (item 6: never leave "what's next" empty).
 */
export function getRecommendedActivity(progress, ageBand) {
  const unfinished = Object.values(progress).find(p => p.startedAt && !p.completed);
  if (unfinished) return getActivitiesByCategory("hear", ageBand).concat(
    getActivitiesByCategory("see", ageBand), getActivitiesByCategory("do", ageBand),
    getActivitiesByCategory("talk", ageBand), getActivitiesByCategory("create", ageBand)
  ).find(a => a.activityId === unfinished.activityId) ?? null;

  const loopOrder = ["hear", "see", "do", "talk", "create"];
  for (const category of loopOrder) {
    const next = getActivitiesByCategory(category, ageBand).find(a => !progress[a.activityId]?.completed);
    if (next) return next;
  }
  return getActivitiesByCategory("hub", ageBand)[0] ?? null;
}

export function getLastActivity(progress) {
  const entries = Object.values(progress).filter(p => p.startedAt);
  if (entries.length === 0) return null;
  entries.sort((a, b) => (b.startedAt?.seconds ?? 0) - (a.startedAt?.seconds ?? 0));
  const last = entries[0];
  return ALL_ACTIVITIES.find(a => a.activityId === last.activityId) ?? null;
}

export function getCompletionStats(progress) {
  const stats = {};
  for (const cat of CATEGORIES) {
    const total = getActivitiesByCategory(cat).length;
    const done = getActivitiesByCategory(cat).filter(a => progress[a.activityId]?.completed).length;
    stats[cat] = { total, done };
  }
  return stats;
}
