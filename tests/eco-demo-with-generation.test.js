// Phase 3 — unit tests for withGeneration (src/ecosystemDemo/withGeneration.js).
// Pure logic, no network/DOM dependency — run with:
//   node --test tests/eco-demo-with-generation.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { withGeneration } from "../src/ecosystemDemo/withGeneration.js";
import { studentsReducer, initialState as studentsInitial } from "../src/ecosystemDemo/students/studentsReducer.js";
import { adultsReducer, initialState as adultsInitial } from "../src/ecosystemDemo/adults/adultsReducer.js";

test("withGeneration: starts undefined/0-based and increments on a real transition", () => {
  const wrapped = withGeneration(studentsReducer);
  const s0 = studentsInitial();
  assert.equal(s0.generation, undefined);
  const s1 = wrapped(s0, { type: "SUBMIT_ATTEMPT", text: "I like football." });
  assert.equal(s1.generation, 1);
});

test("withGeneration: does not increment on a no-op action (unknown type / ignored input)", () => {
  const wrapped = withGeneration(studentsReducer);
  const s0 = studentsInitial();
  const s1 = wrapped(s0, { type: "SUBMIT_ATTEMPT", text: "   " }); // blank -> reducer returns same state
  assert.equal(s1, s0);
  assert.equal(s1.generation, undefined);
});

test("withGeneration: increments again on NEXT_QUESTION (a fresh state object, still a real transition)", () => {
  const wrapped = withGeneration(studentsReducer);
  let s = studentsInitial();
  s = wrapped(s, { type: "SUBMIT_ATTEMPT", text: "I like football because it's fun." });
  assert.equal(s.generation, 1);
  s = wrapped(s, { type: "NEXT_QUESTION", nextIndex: 1 });
  assert.equal(s.generation, 2);
});

test("withGeneration: each dispatched real action bumps generation exactly once, monotonically increasing, never resetting downward", () => {
  const wrapped = withGeneration(adultsReducer);
  let s = adultsInitial();
  s = wrapped(s, { type: "SUBMIT_MESSAGE", text: "Coffee, please" });
  assert.equal(s.generation, 1);
  s = wrapped(s, { type: "SUBMIT_MESSAGE", text: "Small, to go" });
  assert.equal(s.generation, 2);
  // This is the actual guarantee the invalidation mechanism depends on: even
  // though RESET returns a fresh initialState() (no attempts/turns/picks),
  // generation must keep climbing (3, not back down to 1) — otherwise a
  // reply captured before the FIRST submit (genAtSend=1) would wrongly look
  // "still current" again after a reset brought the counter back to 1.
  s = wrapped(s, { type: "RESET" });
  assert.equal(s.generation, 3);
});
