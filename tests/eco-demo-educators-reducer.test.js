// Phase 2 — unit tests for the Educators demo pathway's reducer
// (src/ecosystemDemo/educators/educatorsReducer.js). Pure logic, no
// network/DOM/Firestore dependency — run with:
//   node --test tests/eco-demo-educators-reducer.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { educatorsReducer, initialState } from "../src/ecosystemDemo/educators/educatorsReducer.js";

test("initialState: no learner selected, empty plan", () => {
  const state = initialState();
  assert.equal(state.selectedLearnerId, null);
  assert.deepEqual(state.planItems, []);
});

test("SELECT_LEARNER: changes which learner's evidence is shown, no plan mutation", () => {
  const state = educatorsReducer(initialState(), { type: "SELECT_LEARNER", learnerId: "learner-a" });
  assert.equal(state.selectedLearnerId, "learner-a");
  assert.deepEqual(state.planItems, []);
});

test("ADD_TO_PLAN: adds a real, selection-tied item", () => {
  let state = educatorsReducer(initialState(), { type: "SELECT_LEARNER", learnerId: "learner-a" });
  state = educatorsReducer(state, { type: "ADD_TO_PLAN", learnerId: "learner-a", suggestionKey: "educators_demo_learner_a_suggestion" });
  assert.equal(state.planItems.length, 1);
  assert.equal(state.planItems[0].learnerId, "learner-a");
});

test("ADD_TO_PLAN: switching to a different learner and adding again keeps both items", () => {
  let state = educatorsReducer(initialState(), { type: "SELECT_LEARNER", learnerId: "learner-a" });
  state = educatorsReducer(state, { type: "ADD_TO_PLAN", learnerId: "learner-a", suggestionKey: "s-a" });
  state = educatorsReducer(state, { type: "SELECT_LEARNER", learnerId: "learner-b" });
  state = educatorsReducer(state, { type: "ADD_TO_PLAN", learnerId: "learner-b", suggestionKey: "s-b" });
  assert.equal(state.planItems.length, 2);
});

test("ADD_TO_PLAN: adding the same learner+suggestion twice does not duplicate", () => {
  let state = educatorsReducer(initialState(), { type: "ADD_TO_PLAN", learnerId: "learner-a", suggestionKey: "s-a" });
  state = educatorsReducer(state, { type: "ADD_TO_PLAN", learnerId: "learner-a", suggestionKey: "s-a" });
  assert.equal(state.planItems.length, 1);
});

test("COMPLETE: marks status done without clearing the plan", () => {
  let state = educatorsReducer(initialState(), { type: "ADD_TO_PLAN", learnerId: "learner-a", suggestionKey: "s-a" });
  state = educatorsReducer(state, { type: "COMPLETE" });
  assert.equal(state.status, "done");
  assert.equal(state.planItems.length, 1);
});
