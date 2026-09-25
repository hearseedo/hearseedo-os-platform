// Talk with Jona (Gemini Live) — idle check-in/disconnect state machine.
// Exercises the exact bug found via manual testing 2026-09-25 (a spurious
// `interrupted` signal while Jona wasn't speaking doubled the idle wait to
// ~2 minutes instead of ~60s) plus the full intended state machine, using
// a fake scheduler so every test runs instantly and deterministically —
// no real waiting, no flakiness from real setTimeout.
// Run with:
//   node --test tests/idle-watch.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { createIdleWatch } from "../src/jona/idleWatch.js";

// Records every scheduled call as {id, fn, ms}; tests fire them manually
// by id to simulate exact elapsed time without waiting for it.
function makeFakeScheduler() {
  let nextId = 1;
  const scheduled = new Map();
  const schedule = (fn, ms) => {
    const id = nextId++;
    scheduled.set(id, { fn, ms });
    return id;
  };
  const unschedule = (id) => { scheduled.delete(id); };
  const fire = (id) => {
    const entry = scheduled.get(id);
    if (!entry) throw new Error(`no such scheduled timer: ${id}`);
    scheduled.delete(id);
    entry.fn();
  };
  const only = () => {
    const ids = [...scheduled.keys()];
    assert.equal(ids.length, 1, `expected exactly one pending timer, found ${ids.length}`);
    return ids[0];
  };
  return { schedule, unschedule, fire, only, pendingCount: () => scheduled.size, delays: () => [...scheduled.values()].map((v) => v.ms) };
}

function makeWatch(overrides = {}) {
  const sched = makeFakeScheduler();
  const checkIns = [];
  const disconnects = [];
  const watch = createIdleWatch({
    idleCheckSeconds: 45,
    idleDisconnectSeconds: 60,
    onCheckIn: () => checkIns.push(true),
    onDisconnect: () => disconnects.push(true),
    schedule: sched.schedule,
    unschedule: sched.unschedule,
    ...overrides,
  });
  return { watch, sched, checkIns, disconnects };
}

// 1. No user interaction -> check-in fires at exactly idleCheckSeconds.
test("no user interaction -> check-in scheduled at idleCheckSeconds (45s)", () => {
  const { watch, sched, checkIns } = makeWatch();
  watch.onEnterListening(true); // fresh arrival — e.g. onopen
  assert.equal(sched.delays()[0], 45 * 1000);
  sched.fire(sched.only());
  assert.equal(checkIns.length, 1);
  assert.equal(watch.getPhase(), "checkinSent");
});

// 2. The check-in completing does NOT restart a full 45s idle period — it
// starts only the remaining grace window (60-45=15s).
test("check-in completing starts only the 15s grace window, not a new 45s cycle", () => {
  const { watch, sched } = makeWatch();
  watch.onEnterListening(true);
  sched.fire(sched.only()); // 45s elapses -> check-in sent

  // Jona now speaks the check-in line (phase leaves listening)...
  watch.onLeaveListening();
  // ...and finishes it (phase returns to listening) — this is the
  // check-in's own completion, not a real reply.
  watch.onEnterListening(true);

  assert.equal(sched.pendingCount(), 1);
  assert.equal(sched.delays()[0], 15 * 1000, "grace window must be idleDisconnectSeconds - idleCheckSeconds, not another full 45s");
  assert.equal(watch.getPhase(), "awaitingFinal");
});

// 3. No response during the grace window -> disconnect at ~60s total
// (45 + 15), not ~120s.
test("no response after check-in -> disconnect fires, total schedule sums to idleDisconnectSeconds", () => {
  const { watch, sched, disconnects } = makeWatch();
  watch.onEnterListening(true);
  sched.fire(sched.only()); // t=45s: check-in sent
  watch.onLeaveListening();
  watch.onEnterListening(true); // check-in finished speaking -> awaitingFinal, 15s grace
  const finalId = sched.only();
  assert.equal(sched.delays()[0], 15 * 1000);
  sched.fire(finalId); // t=60s: grace window elapses
  assert.equal(disconnects.length, 1);
});

// 4. A genuine reply during the grace period cancels the disconnect and
// resets fully (a fresh 45s cycle starts, not a continuation).
test("user responds during the grace period -> disconnect cancelled, cycle resets", () => {
  const { watch, sched, disconnects } = makeWatch();
  watch.onEnterListening(true);
  sched.fire(sched.only()); // check-in sent
  watch.onLeaveListening();
  watch.onEnterListening(true); // awaitingFinal, 15s grace timer running

  // The learner actually replies: phase leaves listening (Jona responds)...
  watch.onLeaveListening(); // cancels the pending 15s disconnect
  assert.equal(sched.pendingCount(), 0, "the grace-window disconnect must be cancelled the moment the reply starts");
  // ...and Jona's reply finishes, returning to listening — a genuine
  // reply, so this resets fully back to a new 45s wait.
  watch.onEnterListening(true);

  assert.equal(watch.getPhase(), "active");
  assert.equal(sched.delays()[0], 45 * 1000, "a real reply must restart the full cycle, not resume a partial one");
  assert.equal(disconnects.length, 0);
});

// 5. Jona speaking (a normal reply, not idle-related) never counts against
// the learner — leaving "listening" always clears any pending idle timer.
test("Jona speaking clears the idle timer — time spent speaking is never counted as user idle", () => {
  const { watch, sched } = makeWatch();
  watch.onEnterListening(true); // 45s timer armed
  assert.equal(sched.pendingCount(), 1);
  watch.onLeaveListening(); // Jona starts responding to something
  assert.equal(sched.pendingCount(), 0, "no idle timer should keep running while Jona is speaking");
});

// 6. This is the actual production bug (2026-09-25): a barge-in-shaped
// signal arriving while Jona was NOT speaking (background noise / VAD
// false-positive) must be ignored — it must not restart the cycle.
test("a barge-in signal while Jona was NOT actually speaking is ignored (the ~2-minute bug)", () => {
  const { watch, sched } = makeWatch();
  watch.onEnterListening(true); // 45s timer armed, watch is now waiting
  const originalTimerId = sched.only();

  // Simulate: 20s into the wait, a spurious `interrupted` message arrives
  // even though nothing was actually being said (TalkWithJona.jsx passes
  // wasActuallySpeaking=false for exactly this case).
  watch.onBargeIn(false);

  // The original 45s timer must still be the one pending — untouched.
  assert.equal(sched.pendingCount(), 1);
  assert.equal(sched.only(), originalTimerId, "a spurious/noise signal must not cancel or replace the real idle timer");
});

// 7. A genuine barge-in (Jona actually mid-speech, interrupted for real)
// IS real activity and does reset the cycle, same as any other reply.
test("a real barge-in (Jona was actually speaking) resets the idle cycle", () => {
  const { watch, sched } = makeWatch();
  watch.onEnterListening(true);
  sched.fire(sched.only()); // check-in sent -> checkinSent
  watch.onLeaveListening(); // Jona begins speaking the check-in

  // The learner interrupts Jona's check-in mid-sentence — a real barge-in.
  watch.onBargeIn(true);

  assert.equal(watch.getPhase(), "active", "a real barge-in must fully reset, not slot into the check-in's grace window");
  assert.equal(sched.delays()[0], 45 * 1000);
});

// 8. Background noise/insignificant signals must never trivially keep a
// session alive indefinitely by continually resetting the timer — repeated
// spurious barge-ins while not speaking must have zero cumulative effect.
test("repeated spurious noise signals never extend or reset the idle timer", () => {
  const { watch, sched } = makeWatch();
  watch.onEnterListening(true);
  const originalTimerId = sched.only();
  for (let i = 0; i < 5; i++) watch.onBargeIn(false);
  assert.equal(sched.pendingCount(), 1);
  assert.equal(sched.only(), originalTimerId);
  assert.equal(watch.getPhase(), "active");
});

test("stop() cancels any pending timer and silences all further callbacks", () => {
  const { watch, sched, checkIns, disconnects } = makeWatch();
  watch.onEnterListening(true);
  watch.stop();
  assert.equal(sched.pendingCount(), 0);
  // Calls after stop() must be no-ops, not throw and not schedule anything.
  watch.onEnterListening(true);
  watch.onLeaveListening();
  watch.onBargeIn(true);
  watch.resetOnInteraction(true);
  assert.equal(sched.pendingCount(), 0);
  assert.equal(checkIns.length, 0);
  assert.equal(disconnects.length, 0);
});

test("a deliberate UI interaction while listening resets the cycle (not required, but supported)", () => {
  const { watch, sched } = makeWatch();
  watch.onEnterListening(true);
  sched.fire(sched.only()); // near the end of the window, learner taps the card
  watch.resetOnInteraction(true);
  assert.equal(watch.getPhase(), "active");
  assert.equal(sched.delays()[0], 45 * 1000);
});

test("idleDisconnectSeconds shorter than idleCheckSeconds still gets a sane (floored) grace window", () => {
  const { watch, sched, disconnects } = makeWatch({ idleCheckSeconds: 45, idleDisconnectSeconds: 50 });
  watch.onEnterListening(true);
  sched.fire(sched.only());
  watch.onLeaveListening();
  watch.onEnterListening(true);
  assert.equal(sched.delays()[0], 5 * 1000, "grace window must floor at 5s rather than go to 0/negative");
  sched.fire(sched.only());
  assert.equal(disconnects.length, 1);
});
