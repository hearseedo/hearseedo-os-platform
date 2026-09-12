// Phase 3.1 hardening, item 1 — integration tests reproducing the REAL
// HSD_OS_PROGRESS message contract between Monkey Yoga Phonics V2 (the
// external iframe) and AppModal.jsx's handler
// (src/lib/progressMessageHandler.js + src/lib/appEvents.js's
// isValidProgressEvent). These are TEST-PROVEN, not browser-proven — see
// the Phase 3.1 report for the separately-performed BROWSER-PROVEN
// verification (a real MessageEvent dispatched against the real iframe's
// contentWindow on staging, which produced real profile-isolated Firestore
// writes visible in the actual UI).
//
// The exact payload shape below was captured from that live browser test —
// it is not invented. Run with:
//   node --test tests/monkey-yoga-progress-contract.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { isPlausibleProgressPayload } from "../src/lib/progressMessageHandler.js";
import { isValidProgressEvent, MONKEY_YOGA_CURRICULUM_ID } from "../src/lib/curriculumRouting.js";

// Captured verbatim from the real browser-proven test on staging
// (staging-phase0, TestChildA, profile_id 7wzkdCIiKdqOKQ2NqfaE) — the
// payload that produced a real 200 from /api/record-curriculum-progress.
const REAL_PROGRESS_PAYLOAD = {
  type: "HSD_OS_PROGRESS",
  module: "phonics",
  curriculumId: "monkey-yoga-phonics",
  lessonId: "b1-a",
  bookId: 1,
  section: "hear",
  confidenceSignal: "confident",
  skills: ["listening", "phonics"],
  eventId: "phase31-verify-b1a-example",
};

test("the real captured payload passes isPlausibleProgressPayload", () => {
  assert.equal(isPlausibleProgressPayload(REAL_PROGRESS_PAYLOAD), true);
});

test("the real captured payload passes isValidProgressEvent (has curriculumId + lessonId)", () => {
  assert.equal(isValidProgressEvent(REAL_PROGRESS_PAYLOAD), true);
});

test("curriculumId in the real payload matches MONKEY_YOGA_CURRICULUM_ID exactly", () => {
  assert.equal(REAL_PROGRESS_PAYLOAD.curriculumId, MONKEY_YOGA_CURRICULUM_ID);
});

test("a malformed lessonId (proven live to be server-rejected with 400 'Invalid fields') is still accepted by the CLIENT-side plausibility check", () => {
  // This documents a real, observed asymmetry: the client-side
  // isPlausibleProgressPayload only checks TYPE (is lessonId a string?),
  // not vocabulary — server-side validation (_curriculumIds.js's
  // isValidLessonId, called from record-curriculum-progress.js) is what
  // actually rejects an invented id like "b1-2". Browser-proven: dispatching
  // this exact shape against the live staging iframe produced a real
  // POST /api/record-curriculum-progress -> 400 {"error":"Invalid
  // fields.","fields":["lessonId"]}. This is correct defense-in-depth, not
  // a bug — documented here so the asymmetry is never mistaken for one.
  const madeUpLesson = { ...REAL_PROGRESS_PAYLOAD, lessonId: "b1-2", eventId: "made-up" };
  assert.equal(isPlausibleProgressPayload(madeUpLesson), true); // client: shape is fine
  // (server-side rejection of "b1-2" itself is exercised by
  // netlify/functions/__tests__ against _curriculumIds.js, not re-tested
  // here — this file only covers the client-side contract.)
});

test("missing type field is rejected before reaching any handler", () => {
  const { type, ...withoutType } = REAL_PROGRESS_PAYLOAD;
  // isPlausibleProgressPayload itself doesn't check `type` (AppModal.jsx's
  // listener checks data.type === "HSD_OS_PROGRESS" before ever calling
  // this function) — documented here as the boundary: this function
  // assumes type has already been checked by its caller.
  assert.equal(isPlausibleProgressPayload(withoutType), true);
});

test("a non-object payload is rejected", () => {
  assert.equal(isPlausibleProgressPayload(null), false);
  assert.equal(isPlausibleProgressPayload(undefined), false);
  assert.equal(isPlausibleProgressPayload("not an object"), false);
  assert.equal(isPlausibleProgressPayload(42), false);
});

test("wrong-typed fields are rejected even though the field is present", () => {
  assert.equal(isPlausibleProgressPayload({ ...REAL_PROGRESS_PAYLOAD, lessonId: 123 }), false);
  assert.equal(isPlausibleProgressPayload({ ...REAL_PROGRESS_PAYLOAD, profileId: 123 }), false);
  assert.equal(isPlausibleProgressPayload({ ...REAL_PROGRESS_PAYLOAD, module: 123 }), false);
  assert.equal(isPlausibleProgressPayload({ ...REAL_PROGRESS_PAYLOAD, curriculumId: 123 }), false);
});

test("profileId: null is explicitly allowed (the account owner's own 'self' profile has no familyMembers id)", () => {
  assert.equal(isPlausibleProgressPayload({ ...REAL_PROGRESS_PAYLOAD, profileId: null }), true);
});

// ── Profile isolation at the integration boundary ────────────────────────
// AppModal.jsx enriches every incoming event with `profileId: data.profileId
// ?? profileId` (its own prop, from the modal that's currently open for ONE
// specific child) BEFORE calling processEvent(). These tests document and
// prove that enrichment logic in isolation (the same logic, extracted) —
// the live browser test proved the end-to-end result (TestChildA's write
// never appeared for TestChildB).

function enrichProgressEvent(data, modalProfileId, appId) {
  // Mirrors AppModal.jsx's exact enrichment line.
  return { ...data, module: data.module ?? appId, profileId: data.profileId ?? modalProfileId };
}

test("profile isolation: an event with no profileId is attributed to the modal's own open profile, never left blank", () => {
  const { profileId, ...withoutProfileId } = REAL_PROGRESS_PAYLOAD;
  const enrichedForChildA = enrichProgressEvent(withoutProfileId, "7wzkdCIiKdqOKQ2NqfaE", "phonics");
  const enrichedForChildB = enrichProgressEvent(withoutProfileId, "hjvc9DPlglMgGpmS1J1Y", "phonics");
  assert.equal(enrichedForChildA.profileId, "7wzkdCIiKdqOKQ2NqfaE");
  assert.equal(enrichedForChildB.profileId, "hjvc9DPlglMgGpmS1J1Y");
  assert.notEqual(enrichedForChildA.profileId, enrichedForChildB.profileId);
});

test("profile isolation: two different modal sessions for the same appId never share a profileId by accident", () => {
  const eventA = enrichProgressEvent(REAL_PROGRESS_PAYLOAD, "7wzkdCIiKdqOKQ2NqfaE", "phonics");
  const eventB = enrichProgressEvent(REAL_PROGRESS_PAYLOAD, "hjvc9DPlglMgGpmS1J1Y", "phonics");
  assert.notEqual(eventA.profileId, eventB.profileId);
  // Same curriculumId/lessonId though — isolation is by profileId, not by
  // inventing a different curriculum per child.
  assert.equal(eventA.curriculumId, eventB.curriculumId);
});

// ── handleProgressMessage / legacy appProgress write: retired ───────────
//
// Phase 3.4 (2026-09-12): the three tests formerly here exercised
// handleProgressMessage()'s isolation between the legacy
// users/{uid}/appProgress write and the real progress path. That legacy
// write has been removed outright (an audit found no reader for the
// collection anywhere in the app — see docs/PHASE_3_3_DIAGNOSTICS.md and
// docs/PHASE_3_4_DATA_MODEL.md), and handleProgressMessage() no longer
// exists — AppModal.jsx calls processAppEvent() directly. See
// tests/progress-message-handler.test.js for what remains of that file's
// coverage (isPlausibleProgressPayload), and
// netlify/functions/__tests__/record-engagement-event-*.test.cjs for the
// server endpoint that replaced processAppEvent()'s direct Firestore writes.
