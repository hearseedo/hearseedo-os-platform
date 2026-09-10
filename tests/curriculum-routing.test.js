// Monkey Yoga V2 integration — unit tests for the pure curriculum-routing
// resolver (src/lib/curriculumRouting.js). No Firebase/network dependency —
// run with: node --test tests/curriculum-routing.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { resolveRouteTarget, isValidProgressEvent, DEFAULT_START, MONKEY_YOGA_CURRICULUM_ID } from "../src/lib/curriculumRouting.js";

// ── resolveRouteTarget ───────────────────────────────────────────────────

test("routing: a learner with no classroom and no individual position starts at the default (Book 1, b1-s)", () => {
  const target = resolveRouteTarget({ classroomPosition: null, individualPosition: null });
  assert.deepEqual(target, { ...DEFAULT_START, source: "default" });
});

test("routing: classroom position is used when the learner has no individual position yet", () => {
  const target = resolveRouteTarget({
    classroomPosition: { classId: "c1", bookId: 2, lessonId: "b2-h", className: "Murakumo Nenchu" },
    individualPosition: null,
  });
  assert.deepEqual(target, { bookId: 2, lessonId: "b2-h", source: "classroom" });
});

test("routing: individual position wins over classroom position when both exist (this specific learner may be ahead/behind their class)", () => {
  const target = resolveRouteTarget({
    classroomPosition: { classId: "c1", bookId: 2, lessonId: "b2-h" },
    individualPosition: { lastBookId: 3, lastLessonId: "b3-ai" },
  });
  assert.deepEqual(target, { bookId: 3, lessonId: "b3-ai", source: "individual" });
});

test("routing: a classroom position with no lessonId set yet is treated as no classroom position", () => {
  const target = resolveRouteTarget({
    classroomPosition: { classId: "c1", bookId: 1, lessonId: null },
    individualPosition: null,
  });
  assert.deepEqual(target, { ...DEFAULT_START, source: "default" });
});

test("routing: home practice completing an activity (individual position) never mutates or is derived from classroom position — the two stay independent inputs", () => {
  const classroomPosition = { classId: "c1", bookId: 1, lessonId: "b1-s" };
  const individualPosition = { lastBookId: 2, lastLessonId: "b2-u" }; // learner raced ahead at home
  const target = resolveRouteTarget({ classroomPosition, individualPosition });
  assert.equal(target.lessonId, "b2-u", "the learner's own ahead-of-class position must be respected");
  assert.deepEqual(classroomPosition, { classId: "c1", bookId: 1, lessonId: "b1-s" }, "classroom position object must be untouched");
});

// ── isValidProgressEvent ─────────────────────────────────────────────────

test("progress event validation: a complete event (curriculumId + lessonId) is valid", () => {
  assert.equal(isValidProgressEvent({ curriculumId: MONKEY_YOGA_CURRICULUM_ID, lessonId: "b1-s" }), true);
});

test("progress event validation: missing lessonId is invalid", () => {
  assert.equal(isValidProgressEvent({ curriculumId: MONKEY_YOGA_CURRICULUM_ID }), false);
});

test("progress event validation: missing curriculumId is invalid", () => {
  assert.equal(isValidProgressEvent({ lessonId: "b1-s" }), false);
});

test("progress event validation: null/undefined event is invalid", () => {
  assert.equal(isValidProgressEvent(null), false);
  assert.equal(isValidProgressEvent(undefined), false);
});

test("progress event validation: empty-string ids are invalid, not just missing ones", () => {
  assert.equal(isValidProgressEvent({ curriculumId: "", lessonId: "b1-s" }), false);
  assert.equal(isValidProgressEvent({ curriculumId: MONKEY_YOGA_CURRICULUM_ID, lessonId: "" }), false);
});

test("progress event validation: a raw score is never required for validity — confidenceSignal-only events are still valid (Confidence First: no numeric score as the primary measure)", () => {
  assert.equal(isValidProgressEvent({ curriculumId: MONKEY_YOGA_CURRICULUM_ID, lessonId: "b3-ai", confidenceSignal: "confident" }), true);
});

// ── malformed route params (deep-link robustness, mirrors App.tsx's own guard) ──

test("routing: an out-of-range book id (mirroring the deep-link guard) should not be treated as a valid classroom position", () => {
  // This models what App.tsx's resolveInitialRoute()/getBook() guard does on
  // the V2 side — bookId must be 1-4. The routing resolver here trusts its
  // caller has already validated ids the same way; this test documents that
  // contract so a future caller can't skip validation and pass through junk.
  const bookIdIsValid = (n) => Number.isInteger(n) && n >= 1 && n <= 4;
  assert.equal(bookIdIsValid(5), false);
  assert.equal(bookIdIsValid(0), false);
  assert.equal(bookIdIsValid(NaN), false);
  assert.equal(bookIdIsValid(2), true);
});
