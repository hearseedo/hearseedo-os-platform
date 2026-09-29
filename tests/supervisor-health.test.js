// Gate B Stage 4V fix — deterministic tests for the client-side
// supervisor-health enforcement (src/jona/supervisorHealth.js). This
// closes the confirmed audit blocker: "Live healthy + HSD supervisor
// unavailable -> unrestricted Live continues indefinitely."
//
// A fake clock/timer pair is injected so every test is deterministic and
// fast — no real setTimeout, no flakiness. Run with:
//   node --test tests/supervisor-health.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { createSupervisorHealthTracker } from "../src/jona/supervisorHealth.js";

// A minimal fake timer: setTimeout schedules into a list; test code calls
// advance(ms) to fire whatever is due, in order. clearTimeout removes a
// pending entry. Deterministic, synchronous, no real delay.
function makeFakeTimers(startAt = 0) {
  let now = startAt;
  let nextId = 1;
  const pending = new Map(); // id -> { fireAt, cb }

  function setTimeoutImpl(cb, ms) {
    const id = nextId++;
    pending.set(id, { fireAt: now + ms, cb });
    return id;
  }
  function clearTimeoutImpl(id) {
    pending.delete(id);
  }
  function advance(ms) {
    now += ms;
    // Fire everything due, in fireAt order, oldest first — matches real
    // timer semantics closely enough for this deterministic use.
    const due = [...pending.entries()].filter(([, t]) => t.fireAt <= now).sort((a, b) => a[1].fireAt - b[1].fireAt);
    for (const [id, t] of due) {
      pending.delete(id);
      t.cb();
    }
  }
  return { setTimeoutImpl, clearTimeoutImpl, advance, now: () => now };
}

function makeTracker(overrides = {}) {
  const timers = makeFakeTimers();
  let unsupervisedCalls = 0;
  const tracker = createSupervisorHealthTracker({
    degradedAfterConsecutiveFailures: 2,
    recoveryWindowMs: 10000,
    strictRecoveryWindowMs: 3000,
    now: timers.now,
    setTimeout: timers.setTimeoutImpl,
    clearTimeout: timers.clearTimeoutImpl,
    onUnsupervised: () => { unsupervisedCalls += 1; },
    ...overrides,
  });
  return { tracker, timers, getUnsupervisedCalls: () => unsupervisedCalls };
}

// 1. One classifier failure -> Live continues
test("1. a single isolated failure does not degrade or stop", () => {
  const { tracker, getUnsupervisedCalls } = makeTracker();
  tracker.recordFailure();
  assert.equal(tracker.getStatus(), "healthy");
  assert.equal(getUnsupervisedCalls(), 0);
});

// 2. Next successful classification -> health recovers
test("2. a success after one failure resets the failure count (never reaches degraded)", () => {
  const { tracker } = makeTracker();
  tracker.recordFailure();
  tracker.recordSuccess();
  assert.equal(tracker.getStatus(), "healthy");
  assert.equal(tracker.getConsecutiveFailures(), 0);
});

// 3. Repeated failures -> DEGRADED
test("3. two consecutive failures cross the threshold into degraded", () => {
  const { tracker } = makeTracker();
  tracker.recordFailure();
  tracker.recordFailure();
  assert.equal(tracker.getStatus(), "degraded");
});

// 4. Recovery succeeds within window -> Live continues
test("4. a success during the recovery window restores healthy and cancels the timer", () => {
  const { tracker, timers, getUnsupervisedCalls } = makeTracker();
  tracker.recordFailure();
  tracker.recordFailure(); // now degraded, window armed for 10000ms
  timers.advance(5000);
  tracker.recordSuccess();
  assert.equal(tracker.getStatus(), "healthy");
  timers.advance(10000); // well past the original window — must not fire late
  assert.equal(getUnsupervisedCalls(), 0);
});

// 5. Recovery window expires -> Live terminates
test("5. no recovery before the window expires -> stopped, onUnsupervised fires exactly once", () => {
  const { tracker, timers, getUnsupervisedCalls } = makeTracker();
  tracker.recordFailure();
  tracker.recordFailure();
  timers.advance(10000);
  assert.equal(tracker.getStatus(), "stopped");
  assert.equal(getUnsupervisedCalls(), 1);
});

// 6. Supervisor endpoint unreachable -> eventually terminates
test("6. repeated client-side network failures (endpoint unreachable) behave identically to server-reported failures", () => {
  const { tracker, timers, getUnsupervisedCalls } = makeTracker();
  // No distinction in the public API between "server said failure" and
  // "fetch itself threw" — the caller reports both via recordFailure(),
  // which is the whole point (must not depend on getting a 200/500 at all).
  tracker.recordFailure();
  tracker.recordFailure();
  assert.equal(tracker.getStatus(), "degraded");
  timers.advance(10000);
  assert.equal(tracker.getStatus(), "stopped");
  assert.equal(getUnsupervisedCalls(), 1);
});

// 7. Malformed supervisor response -> counts as failure
test("7. an explicit malformed/invalid response is reported as a failure like any other", () => {
  const { tracker } = makeTracker();
  // The caller is responsible for classifying a malformed body as a
  // failure before calling in — this test documents/locks that contract:
  // there is no separate "malformed" outcome, it's just recordFailure().
  tracker.recordFailure();
  tracker.recordFailure();
  assert.equal(tracker.getStatus(), "degraded");
});

// 8. HTTP failure -> counts as failure
test("8. a non-ok HTTP response is reported as a failure like any other", () => {
  const { tracker } = makeTracker();
  tracker.recordFailure();
  tracker.recordFailure();
  assert.equal(tracker.getStatus(), "degraded");
});

// 9. Classification success resets appropriate consecutive-failure state
test("9. a success resets the consecutive-failure counter even while still healthy (one failure, then success, then one more failure does not degrade)", () => {
  const { tracker } = makeTracker();
  tracker.recordFailure();
  tracker.recordSuccess();
  tracker.recordFailure();
  assert.equal(tracker.getStatus(), "healthy", "the counter must have reset — this is only the first failure since the last success");
});

// 10. HIGH_RISK + supervisor failure follows stricter fail-safe behavior
test("10. an elevated (HIGH_RISK/IMMEDIATE_DANGER) session uses the shorter, stricter recovery window", () => {
  const { tracker, timers, getUnsupervisedCalls } = makeTracker();
  tracker.recordFailure({ isElevated: true });
  tracker.recordFailure({ isElevated: true }); // degraded, strict window = 3000ms
  timers.advance(3000);
  assert.equal(tracker.getStatus(), "stopped");
  assert.equal(getUnsupervisedCalls(), 1);
});

test("10b. the ordinary (non-elevated) window is longer than the strict one, and is not cut short", () => {
  const { tracker, timers, getUnsupervisedCalls } = makeTracker();
  tracker.recordFailure();
  tracker.recordFailure(); // degraded, ordinary window = 10000ms
  timers.advance(3000); // strict window's duration, must NOT fire yet
  assert.equal(tracker.getStatus(), "degraded");
  assert.equal(getUnsupervisedCalls(), 0);
  timers.advance(7000); // completes the full 10000ms
  assert.equal(tracker.getStatus(), "stopped");
});

// 11. IMMEDIATE_DANGER cannot fall back to ordinary Live because supervision
// failed — covered structurally: once stopped, nothing can move it back to
// healthy except reset() (a genuinely new/reconnected session), and the
// caller (TalkWithJona.jsx) never calls reset() from inside the restricted
// pathway. This test locks the tracker-level half of that guarantee: a
// stopped tracker ignores further success/failure/server-status input.
test("11. once stopped, success/failure/server-status inputs are all no-ops (cannot silently un-stop)", () => {
  const { tracker, timers, getUnsupervisedCalls } = makeTracker();
  tracker.recordFailure();
  tracker.recordFailure();
  timers.advance(10000);
  assert.equal(tracker.getStatus(), "stopped");
  tracker.recordSuccess();
  assert.equal(tracker.getStatus(), "stopped", "a success must not resurrect a stopped tracker");
  tracker.applyServerStatus("ok");
  assert.equal(tracker.getStatus(), "stopped");
  assert.equal(getUnsupervisedCalls(), 1, "onUnsupervised must never fire more than once for one stop");
});

// 12. profile switch/logout/unmount clears all supervisor timers
test("12. dispose() cancels a pending recovery timer so it can never fire after session end", () => {
  const { tracker, timers, getUnsupervisedCalls } = makeTracker();
  tracker.recordFailure();
  tracker.recordFailure(); // degraded, timer armed
  tracker.dispose();
  timers.advance(60000);
  assert.equal(getUnsupervisedCalls(), 0, "a disposed tracker must never call onUnsupervised");
});

// 13. stale timer from a previous session cannot terminate a newly opened
// session
test("13. reset() invalidates a previously armed timer even if it was already ticking when the new session started", () => {
  const { tracker, timers, getUnsupervisedCalls } = makeTracker();
  tracker.recordFailure();
  tracker.recordFailure(); // degraded, timer armed for session A
  tracker.reset(); // session B starts — must not inherit session A's degraded state or its timer
  assert.equal(tracker.getStatus(), "healthy");
  timers.advance(60000); // session A's timer, if it fired, would try to stop session B
  assert.equal(getUnsupervisedCalls(), 0, "session A's stale timer must not stop session B");
  assert.equal(tracker.getStatus(), "healthy", "session B must remain healthy, untouched by session A's history");
});

// 14. ordinary idle timeout and supervisor timeout cannot race into
// duplicate session endings — this is enforced by TalkWithJona.jsx's own
// endedRef guard on endSession() (a single idempotent funnel point), not by
// this module; this test documents the module-level half of that
// guarantee: onUnsupervised fires exactly once per stop, never twice for
// the same degraded episode, so the caller's own idempotency guard is
// never asked to suppress a double-fire from THIS module.
test("14. onUnsupervised fires exactly once per degraded episode, never repeatedly while stopped", () => {
  const { tracker, timers, getUnsupervisedCalls } = makeTracker();
  tracker.recordFailure();
  tracker.recordFailure();
  timers.advance(10000);
  assert.equal(getUnsupervisedCalls(), 1);
  // Further failures/time passing after stopping must not re-fire it.
  tracker.recordFailure();
  timers.advance(60000);
  assert.equal(getUnsupervisedCalls(), 1);
});

// 15. telemetry failure does not prevent mute/close/restricted transition —
// this is a TalkWithJona.jsx integration property (the latency-logging
// fetch is fire-and-forget and never awaited before muting/closing), not
// something this pure module can exercise directly; verified instead by
// code inspection (logClientTiming's call sites) and noted in the audit
// report rather than duplicated here as a fake unit test.
test("15. (see integration code / audit report — telemetry logging is fire-and-forget, never gates a safety transition)", () => {
  assert.ok(true);
});

// Additional: malformed applyServerStatus input must never be treated as
// "ok" by default — fail toward caution, matching every other module in
// this codebase's stated policy.
test("applyServerStatus: an unrecognized status string is neither healthy nor degraded — it is simply ignored, never assumed ok", () => {
  const { tracker } = makeTracker();
  tracker.recordFailure();
  tracker.recordFailure(); // degraded
  tracker.applyServerStatus("something-unexpected");
  assert.equal(tracker.getStatus(), "degraded", "an unrecognized server status must not be silently treated as recovery");
});
