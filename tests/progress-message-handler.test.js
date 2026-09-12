// Regression tests for src/lib/progressMessageHandler.js.
//
// Phase 3.4 (2026-09-12): this file used to test handleProgressMessage(),
// which isolated a legacy users/{uid}/appProgress write from
// processAppEvent() so the (always-permission-denied) legacy write's
// failure could never block curriculum-progress recording. That legacy
// write has been removed outright (nothing ever read that collection — see
// docs/PHASE_3_3_DIAGNOSTICS.md and docs/PHASE_3_4_DATA_MODEL.md), so
// handleProgressMessage() no longer exists; AppModal.jsx calls
// processAppEvent() directly. Only isPlausibleProgressPayload() remains to
// test here. Run with:
//   node --test tests/progress-message-handler.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { isPlausibleProgressPayload } from "../src/lib/progressMessageHandler.js";

test("a malformed event is rejected by isPlausibleProgressPayload before processAppEvent would ever be called", () => {
  assert.equal(isPlausibleProgressPayload({ module: 123 }), false);
  assert.equal(isPlausibleProgressPayload({ profileId: 42 }), false);
  assert.equal(isPlausibleProgressPayload({ lessonId: {} }), false);
  assert.equal(isPlausibleProgressPayload({ curriculumId: [] }), false);
  assert.equal(isPlausibleProgressPayload(null), false);
  assert.equal(isPlausibleProgressPayload("not an object"), false);
});

test("a well-formed event (with or without curriculumId) passes isPlausibleProgressPayload", () => {
  assert.equal(isPlausibleProgressPayload({ module: "phonics", lessonId: "b1-s", curriculumId: "monkey-yoga-phonics" }), true);
  // Existing non-phonics event shape (no curriculumId at all) must not regress —
  // still plausible, still gets processed by processAppEvent() the same as before.
  assert.equal(isPlausibleProgressPayload({ module: "eiken", lessonsToday: 3 }), true);
});
