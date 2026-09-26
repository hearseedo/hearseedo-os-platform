// Phase 1 — unit tests for the Students demo pathway's reducer
// (src/ecosystemDemo/students/studentsReducer.js). Pure logic, no
// network/DOM dependency — run with:
//   node --test tests/eco-demo-students-reducer.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { studentsReducer, initialState } from "../src/ecosystemDemo/students/studentsReducer.js";

test("initialState: starts clean at the given question index", () => {
  const state = initialState(0);
  assert.equal(state.questionIndex, 0);
  assert.deepEqual(state.attempts, []);
  assert.equal(state.status, "answering");
  assert.equal(state.priorObservation, null);
});

test("SUBMIT_ATTEMPT: appends an attempt with source 'typed' when no starter was used", () => {
  const state = studentsReducer(initialState(), { type: "SUBMIT_ATTEMPT", text: "I like football." });
  assert.equal(state.attempts.length, 1);
  assert.equal(state.attempts[0].source, "typed");
  assert.equal(state.attempts[0].hasReason, false);
  assert.equal(state.status, "reviewing");
});

test("USE_STARTER then SUBMIT_ATTEMPT: labels the attempt as 'starter', never silently as independent work", () => {
  let state = studentsReducer(initialState(), { type: "USE_STARTER", starterId: "s1" });
  state = studentsReducer(state, { type: "SUBMIT_ATTEMPT", text: "I like football because it's fun." });
  assert.equal(state.attempts[0].source, "starter");
  assert.equal(state.attempts[0].startedFromStarterId, "s1");
  assert.equal(state.attempts[0].hasReason, true);
});

test("SUBMIT_ATTEMPT: a blank/whitespace-only submission is ignored, not recorded as an attempt", () => {
  const state = studentsReducer(initialState(), { type: "SUBMIT_ATTEMPT", text: "   " });
  assert.deepEqual(state.attempts, []);
});

test("RETRY: clears the starter flag but never discards attempt history", () => {
  let state = studentsReducer(initialState(), { type: "SUBMIT_ATTEMPT", text: "I like football." });
  state = studentsReducer(state, { type: "RETRY" });
  assert.equal(state.usedStarterId, null);
  assert.equal(state.attempts.length, 1);
  state = studentsReducer(state, { type: "SUBMIT_ATTEMPT", text: "I like football because it's fun." });
  assert.equal(state.attempts.length, 2);
  assert.equal(state.status, "retried");
});

test("REQUEST_HELP: sets usedHint and increments the count, does not touch attempts", () => {
  let state = studentsReducer(initialState(), { type: "REQUEST_HELP" });
  assert.equal(state.usedHint, true);
  assert.equal(state.helpRequestedCount, 1);
  state = studentsReducer(state, { type: "REQUEST_HELP" });
  assert.equal(state.helpRequestedCount, 2);
});

test("REVEAL_MODEL_ANSWER: sets modelAnswerRevealed and counts as a hint used", () => {
  const state = studentsReducer(initialState(), { type: "REVEAL_MODEL_ANSWER" });
  assert.equal(state.modelAnswerRevealed, true);
  assert.equal(state.usedHint, true);
});

test("NEXT_QUESTION: resets per-question fields but carries a real observation forward", () => {
  let state = studentsReducer(initialState(0), { type: "SUBMIT_ATTEMPT", text: "I like football." });
  state = studentsReducer(state, { type: "SUBMIT_ATTEMPT", text: "I like football because it's fun." });
  state = studentsReducer(state, { type: "REQUEST_HELP" });
  const next = studentsReducer(state, { type: "NEXT_QUESTION", nextIndex: 1 });
  assert.equal(next.questionIndex, 1);
  assert.deepEqual(next.attempts, []);
  assert.equal(next.usedHint, false);
  assert.equal(next.priorObservation, "added_reason");
});

test("NEXT_QUESTION: observation reflects a reason present from the very first attempt (never claims 'added')", () => {
  const state = studentsReducer(initialState(0), { type: "SUBMIT_ATTEMPT", text: "I like reading because it's relaxing." });
  const next = studentsReducer(state, { type: "NEXT_QUESTION", nextIndex: 1 });
  assert.equal(next.priorObservation, "reason_from_start");
});

test("NEXT_QUESTION: observation reflects a reason still missing at hand-off", () => {
  const state = studentsReducer(initialState(0), { type: "SUBMIT_ATTEMPT", text: "I like football." });
  const next = studentsReducer(state, { type: "NEXT_QUESTION", nextIndex: 1 });
  assert.equal(next.priorObservation, "present_no_reason");
});

test("COMPLETE: marks status done without altering recorded attempts", () => {
  let state = studentsReducer(initialState(), { type: "SUBMIT_ATTEMPT", text: "I like football because it's fun." });
  state = studentsReducer(state, { type: "COMPLETE" });
  assert.equal(state.status, "done");
  assert.equal(state.attempts.length, 1);
});

test("unknown action type is a no-op", () => {
  const state = initialState();
  assert.deepEqual(studentsReducer(state, { type: "NOT_A_REAL_ACTION" }), state);
});
