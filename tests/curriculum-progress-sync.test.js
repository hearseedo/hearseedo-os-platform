// Client retry-behaviour correction (2026-09-10) — unit tests for the pure
// retry/backoff logic (src/lib/curriculumProgressSync.js). No Firebase/
// network dependency (curriculumProgress.js's actual fetch/idToken plumbing
// is import.meta.env-coupled and can't run under plain node --test — same
// reasoning documented in curriculum-routing.test.js) — run with:
//   node --test tests/curriculum-progress-sync.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { sendCurriculumProgressWithRetry, DEFAULT_MAX_ATTEMPTS } from "../src/lib/curriculumProgressSync.js";

const noopSleep = async () => {};

function okResult(duplicate = false) {
  return { ok: true, status: 200, body: { success: true, duplicate } };
}
function retryableResult(status = 503) {
  return { ok: false, status, body: { success: false, error: "retry me", retryable: true } };
}
function fatalResult(status = 400) {
  return { ok: false, status, body: { success: false, error: "bad request" } };
}

test("a successful send returns ok:true without retrying", async () => {
  let calls = 0;
  const postFn = async () => { calls += 1; return okResult(false); };
  const result = await sendCurriculumProgressWithRetry(postFn, { eventId: "e1" }, { sleep: noopSleep });
  assert.deepEqual(result, { ok: true, duplicate: false });
  assert.equal(calls, 1);
});

test("a confirmed duplicate returns ok:true, duplicate:true, without retrying", async () => {
  let calls = 0;
  const postFn = async () => { calls += 1; return okResult(true); };
  const result = await sendCurriculumProgressWithRetry(postFn, { eventId: "e1" }, { sleep: noopSleep });
  assert.deepEqual(result, { ok: true, duplicate: true });
  assert.equal(calls, 1);
});

test("a non-retryable failure stops immediately — never burns attempts on something that can't succeed", async () => {
  let calls = 0;
  const postFn = async () => { calls += 1; return fatalResult(); };
  const result = await sendCurriculumProgressWithRetry(postFn, { eventId: "e1" }, { sleep: noopSleep });
  assert.deepEqual(result, { ok: false, recoverable: false });
  assert.equal(calls, 1, "a non-retryable failure must not be retried");
});

test("a retryable failure is retried up to maxAttempts, then reported as recoverable — never as success", async () => {
  let calls = 0;
  const postFn = async () => { calls += 1; return retryableResult(); };
  const result = await sendCurriculumProgressWithRetry(postFn, { eventId: "e1" }, { maxAttempts: 3, sleep: noopSleep });
  assert.deepEqual(result, { ok: false, recoverable: true });
  assert.equal(calls, 3, "should use exactly the configured attempt limit, not more");
});

test("retry exhaustion never claims the progress was saved", async () => {
  const postFn = async () => retryableResult();
  const result = await sendCurriculumProgressWithRetry(postFn, { eventId: "e1" }, { maxAttempts: 2, sleep: noopSleep });
  assert.equal(result.ok, false);
  assert.notEqual(result.ok, true);
});

test("a network-level throw (request never reached the server) is retried the same as a retryable server response", async () => {
  let calls = 0;
  const postFn = async () => { calls += 1; throw new TypeError("fetch failed"); };
  const result = await sendCurriculumProgressWithRetry(postFn, { eventId: "e1" }, { maxAttempts: 3, sleep: noopSleep });
  assert.deepEqual(result, { ok: false, recoverable: true });
  assert.equal(calls, 3);
});

test("a retry that eventually succeeds (e.g. transient failure then recovery) reports success", async () => {
  let calls = 0;
  const postFn = async () => {
    calls += 1;
    return calls < 2 ? retryableResult() : okResult(false);
  };
  const result = await sendCurriculumProgressWithRetry(postFn, { eventId: "e1" }, { maxAttempts: 3, sleep: noopSleep });
  assert.deepEqual(result, { ok: true, duplicate: false });
  assert.equal(calls, 2);
});

test("every retry resends the exact same payload object — the eventId is never regenerated for a transport retry", async () => {
  const payload = { eventId: "stable-attempt-id-123", lessonId: "b1-s" };
  const seenPayloads = [];
  const postFn = async (p) => { seenPayloads.push(p); return retryableResult(); };
  await sendCurriculumProgressWithRetry(postFn, payload, { maxAttempts: 3, sleep: noopSleep });
  assert.equal(seenPayloads.length, 3);
  for (const p of seenPayloads) {
    assert.equal(p, payload, "must be the identical object reference, not a copy with a new eventId");
    assert.equal(p.eventId, "stable-attempt-id-123");
  }
});

test("backoff delay grows between attempts (exponential) and is invoked one fewer time than the attempt count", async () => {
  const delays = [];
  const sleep = async (ms) => { delays.push(ms); };
  const postFn = async () => retryableResult();
  await sendCurriculumProgressWithRetry(postFn, { eventId: "e1" }, { maxAttempts: 3, baseDelayMs: 500, sleep });
  assert.deepEqual(delays, [500, 1000]);
});

test("default maxAttempts is a small, bounded number (not unlimited retries)", () => {
  assert.equal(DEFAULT_MAX_ATTEMPTS, 3);
});
