// HSD OS AI — pure curriculum-routing logic (2026-09-10).
//
// No Firebase import, deliberately — same reasoning as src/lib/pathwayAccess.js:
// this is the one place that answers "given classroom/individual position,
// where should this learner actually go", and it needs to be directly
// unit-testable without a Firestore emulator. src/family/curriculumProgress.js
// (which does the actual Firestore reads/writes) imports and re-exports these.
export const MONKEY_YOGA_CURRICULUM_ID = "monkey-yoga-phonics";

// The only starting point this module invents — book 1, lesson 1 in Monkey
// Yoga V2's own numbering. Every other position comes from real classroom/
// individual data; this is just where a learner with neither yet begins.
export const DEFAULT_START = { bookId: 1, lessonId: "b1-s" };

/**
 * Where HSD Family should actually route this learner right now. Individual
 * position (the learner's own last practised place) wins when it exists —
 * it reflects reality for THIS child, who may be ahead of or behind their
 * class. Classroom position is the fallback for a learner who hasn't
 * started yet. Never invents a position beyond DEFAULT_START.
 */
export function resolveRouteTarget({ classroomPosition, individualPosition } = {}) {
  if (individualPosition?.lastLessonId) {
    return { bookId: individualPosition.lastBookId ?? null, lessonId: individualPosition.lastLessonId, source: "individual" };
  }
  if (classroomPosition?.lessonId) {
    return { bookId: classroomPosition.bookId ?? null, lessonId: classroomPosition.lessonId, source: "classroom" };
  }
  return { ...DEFAULT_START, source: "default" };
}

/**
 * A progress event is only ever recorded if it can actually be attributed
 * to a specific curriculum position — anything less is worse than nothing
 * (a phantom "progress" entry with no lessonId would corrupt
 * resolveRouteTarget() above).
 */
export function isValidProgressEvent(event) {
  return !!(event && typeof event.curriculumId === "string" && event.curriculumId.length > 0
    && typeof event.lessonId === "string" && event.lessonId.length > 0);
}
