// Phase 2 — unit tests for the Adults demo pathway's reducer
// (src/ecosystemDemo/adults/adultsReducer.js). Pure logic, no network/DOM
// dependency — run with:
//   node --test tests/eco-demo-adults-reducer.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { adultsReducer, initialState } from "../src/ecosystemDemo/adults/adultsReducer.js";

test("initialState: starts with no known slots and status ordering", () => {
  const state = initialState();
  assert.deepEqual(state.order, { drink: null, size: null, service: null });
  assert.equal(state.status, "ordering");
});

test("SUBMIT_MESSAGE: a complete request is accepted immediately, no forced follow-up", () => {
  const state = adultsReducer(initialState(), { type: "SUBMIT_MESSAGE", text: "A small coffee to go, please." });
  assert.equal(state.status, "complete");
  assert.deepEqual(state.order, { drink: "coffee", size: "small", service: "to go" });
});

test("SUBMIT_MESSAGE: an incomplete request stays in 'ordering' status", () => {
  const state = adultsReducer(initialState(), { type: "SUBMIT_MESSAGE", text: "Coffee, please" });
  assert.equal(state.status, "ordering");
  assert.equal(state.order.drink, "coffee");
  assert.equal(state.order.size, null);
});

test("SUBMIT_MESSAGE: slots accumulate across turns without losing earlier answers", () => {
  let state = adultsReducer(initialState(), { type: "SUBMIT_MESSAGE", text: "Coffee, please" });
  state = adultsReducer(state, { type: "SUBMIT_MESSAGE", text: "Small" });
  assert.equal(state.order.drink, "coffee");
  assert.equal(state.order.size, "small");
  assert.equal(state.status, "ordering");
  state = adultsReducer(state, { type: "SUBMIT_MESSAGE", text: "To go" });
  assert.equal(state.status, "complete");
});

test("SUBMIT_MESSAGE: records every visitor turn verbatim", () => {
  let state = adultsReducer(initialState(), { type: "SUBMIT_MESSAGE", text: "Coffee, please" });
  state = adultsReducer(state, { type: "SUBMIT_MESSAGE", text: "Small, to go" });
  assert.equal(state.turns.length, 2);
  assert.equal(state.turns[0].text, "Coffee, please");
  assert.equal(state.turns[1].text, "Small, to go");
});

test("SUBMIT_MESSAGE: a blank submission is ignored, not recorded as a turn", () => {
  const state = adultsReducer(initialState(), { type: "SUBMIT_MESSAGE", text: "   " });
  assert.deepEqual(state.turns, []);
});

test("REQUEST_HINT: sets usedHint without affecting the order", () => {
  const state = adultsReducer(initialState(), { type: "REQUEST_HINT" });
  assert.equal(state.usedHint, true);
  assert.deepEqual(state.order, { drink: null, size: null, service: null });
});

test("RESET: returns to a clean initial state", () => {
  let state = adultsReducer(initialState(), { type: "SUBMIT_MESSAGE", text: "A small coffee to go." });
  state = adultsReducer(state, { type: "RESET" });
  assert.deepEqual(state, initialState());
});
