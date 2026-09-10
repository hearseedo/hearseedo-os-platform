// Staging bug fix (2026-09-10) — regression tests for
// src/lib/progressMessageHandler.js. Proves the AppModal.jsx handleMessage
// bug is actually fixed: a legacy appProgress write failure must never
// prevent processAppEvent() (and therefore curriculum-progress recording)
// from running. No Firebase dependency — run with:
//   node --test tests/progress-message-handler.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { isPlausibleProgressPayload, handleProgressMessage } from "../src/lib/progressMessageHandler.js";

test("a rejected legacy appProgress write does not prevent processEvent from running", async () => {
  let processEventCalled = false;
  const result = await handleProgressMessage({
    legacyWrite: async () => { throw new Error("permission-denied"); },
    processEvent: async () => { processEventCalled = true; return { ok: true, curriculumSync: { ok: true, duplicate: false } }; },
    log: () => {},
  });
  assert.equal(processEventCalled, true, "processEvent must run even though legacyWrite rejected");
  assert.deepEqual(result, { ok: true, curriculumSync: { ok: true, duplicate: false } });
});

test("processEvent is called exactly once after the legacy write fails", async () => {
  let calls = 0;
  await handleProgressMessage({
    legacyWrite: async () => { throw new Error("permission-denied"); },
    processEvent: async () => { calls += 1; return { ok: true }; },
    log: () => {},
  });
  assert.equal(calls, 1);
});

test("processEvent is called exactly once when the legacy write succeeds too", async () => {
  let legacyCalls = 0;
  let processCalls = 0;
  await handleProgressMessage({
    legacyWrite: async () => { legacyCalls += 1; },
    processEvent: async () => { processCalls += 1; return { ok: true }; },
    log: () => {},
  });
  assert.equal(legacyCalls, 1);
  assert.equal(processCalls, 1);
});

test("a successful curriculum sync result is returned accurately", async () => {
  const result = await handleProgressMessage({
    legacyWrite: async () => {},
    processEvent: async () => ({ ok: true, curriculumSync: { ok: true, duplicate: false } }),
    log: () => {},
  });
  assert.equal(result.curriculumSync.ok, true);
  assert.equal(result.curriculumSync.duplicate, false);
});

test("a confirmed duplicate result is returned accurately", async () => {
  const result = await handleProgressMessage({
    legacyWrite: async () => {},
    processEvent: async () => ({ ok: true, curriculumSync: { ok: true, duplicate: true } }),
    log: () => {},
  });
  assert.equal(result.curriculumSync.ok, true);
  assert.equal(result.curriculumSync.duplicate, true);
});

test("a retryable failure result reaches the caller so the retry flow can act on it", async () => {
  const result = await handleProgressMessage({
    legacyWrite: async () => {},
    processEvent: async () => ({ ok: true, curriculumSync: { ok: false, recoverable: true } }),
    log: () => {},
  });
  assert.equal(result.curriculumSync.ok, false);
  assert.equal(result.curriculumSync.recoverable, true);
});

test("a non-retryable failure is visible in the result, never silently reported as saved", async () => {
  const result = await handleProgressMessage({
    legacyWrite: async () => {},
    processEvent: async () => ({ ok: true, curriculumSync: { ok: false, recoverable: false } }),
    log: () => {},
  });
  assert.equal(result.curriculumSync.ok, false);
  assert.equal(result.curriculumSync.recoverable, false);
  assert.notEqual(result.curriculumSync.ok, true);
});

test("a malformed event is rejected by isPlausibleProgressPayload before handleProgressMessage would ever be called", () => {
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

test("existing non-phonics event behaviour does not regress: legacy write and processEvent both still run for an event with no curriculumId", async () => {
  let legacyCalls = 0;
  let processCalls = 0;
  const result = await handleProgressMessage({
    legacyWrite: async () => { legacyCalls += 1; },
    processEvent: async () => { processCalls += 1; return { ok: true, totalInteractions: 5, newEngagement: 60, curriculumSync: null }; },
    log: () => {},
  });
  assert.equal(legacyCalls, 1);
  assert.equal(processCalls, 1);
  assert.equal(result.curriculumSync, null, "non-curriculum events correctly carry no curriculumSync");
});

test("no sensitive information appears in the sanitized log message when the legacy write fails", async () => {
  const logged = [];
  await handleProgressMessage({
    legacyWrite: async () => { throw new Error("permission-denied for uid abc123-secret-profile-xyz"); },
    processEvent: async () => ({ ok: true }),
    log: (msg) => logged.push(msg),
  });
  assert.equal(logged.length, 1);
  assert.ok(!logged[0].includes("abc123-secret-profile-xyz"), "must not leak the uid/profile from the thrown error");
  assert.ok(!logged[0].includes("permission-denied for uid"), "must not leak the raw error message at all");
});

test("a legacyWrite that succeeds never logs anything", async () => {
  const logged = [];
  await handleProgressMessage({
    legacyWrite: async () => {},
    processEvent: async () => ({ ok: true }),
    log: (msg) => logged.push(msg),
  });
  assert.equal(logged.length, 0);
});
