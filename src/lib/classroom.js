// HSD OS AI — minimal classroom connection (2026-09-10).
//
// Deliberately NOT an LMS: no assignments, no grading, no homework
// deadlines, no attendance. The only capability is "a teacher/admin can
// say where this class currently is in a curriculum" — HSD Family reads
// that position, it never writes it (see src/family/curriculumProgress.js).
//
// SECURITY CORRECTION (Phase A/B review, 2026-09-10): `classes` is now
// admin-only read/write in firestore.rules — broad authenticated read was
// wrong, since learnerKeys ("uid:profileId") are user-linked identifiers a
// signed-in stranger should never be able to enumerate. The functions
// below therefore only work for an admin caller (used by Admin.jsx's
// Classes tab). A non-admin parent/learner resolving THEIR OWN classroom
// position must go through netlify/functions/get-classroom-position.js
// instead (called from src/family/curriculumProgress.js), which verifies
// identity server-side and returns only that one learner's own position —
// never the roster, never usable to enumerate other families.
//
// A learner is linked to a class via a composite key stored on the class
// document itself (learnerKeys: ["uid:profileId", ...]) rather than a field
// on the learner's own profile — additive-only, touches no existing user/
// familyMembers documents or their rules.
import { db } from "./firebase";
import {
  collection, doc, getDoc, getDocs, query, where, setDoc, arrayUnion, arrayRemove, serverTimestamp,
} from "firebase/firestore";

export function learnerKey(uid, profileId) {
  return `${uid}:${profileId}`;
}

/** The class (if any) this learner belongs to, or null. Admin-only — see
 * the file-level note above for why non-admin callers must use the
 * server-side get-classroom-position function instead. */
export async function getClassForLearner(uid, profileId) {
  const q = query(collection(db, "classes"), where("learnerKeys", "array-contains", learnerKey(uid, profileId)));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { classId: d.id, ...d.data() };
}

/** Just the curriculum position (item 5's "classroomPosition") — the only
 * thing HSD Family's routing actually needs; kept separate from the fuller
 * getClassForLearner() above so routing code doesn't need to know class
 * document shape at all. */
export async function getClassroomPosition(uid, profileId) {
  const cls = await getClassForLearner(uid, profileId);
  if (!cls || !cls.currentLessonId) return null;
  return { classId: cls.classId, bookId: cls.currentBookId ?? null, lessonId: cls.currentLessonId, className: cls.name ?? null };
}

export async function createClass({ name, curriculumId, teacherUid, learnerKeys = [] }) {
  const ref = doc(collection(db, "classes"));
  await setDoc(ref, {
    name, curriculumId, teacherUid, learnerKeys,
    currentBookId: 1, currentLessonId: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** The one real teacher/admin action this whole feature exists for. */
export async function setClassCurriculumPosition(classId, bookId, lessonId, teacherUid) {
  await setDoc(doc(db, "classes", classId), {
    currentBookId: bookId, currentLessonId: lessonId, updatedBy: teacherUid, updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function addLearnerToClass(classId, uid, profileId) {
  await setDoc(doc(db, "classes", classId), {
    learnerKeys: arrayUnion(learnerKey(uid, profileId)), updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function removeLearnerFromClass(classId, uid, profileId) {
  await setDoc(doc(db, "classes", classId), {
    learnerKeys: arrayRemove(learnerKey(uid, profileId)), updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getClass(classId) {
  const snap = await getDoc(doc(db, "classes", classId));
  return snap.exists() ? { classId, ...snap.data() } : null;
}

export async function listClasses() {
  const snap = await getDocs(collection(db, "classes"));
  return snap.docs.map(d => ({ classId: d.id, ...d.data() }));
}
