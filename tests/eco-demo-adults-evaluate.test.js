// Phase 2 — unit tests for the Adults demo pathway's order-slot heuristic
// (src/ecosystemDemo/adults/evaluateOrder.js). Pure logic, no network
// dependency — run with:
//   node --test tests/eco-demo-adults-evaluate.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateOrder, nextMissingSlot } from "../src/ecosystemDemo/adults/evaluateOrder.js";

test("evaluateOrder: detects drink only", () => {
  assert.deepEqual(evaluateOrder("Coffee, please"), { drink: "coffee", size: null, service: null });
});

test("evaluateOrder: detects drink, size, and service all at once", () => {
  const result = evaluateOrder("A small coffee to go, please.");
  assert.equal(result.drink, "coffee");
  assert.equal(result.size, "small");
  assert.equal(result.service, "to go");
});

test("evaluateOrder: recognizes 'for here'", () => {
  assert.equal(evaluateOrder("A large tea for here.").service, "for here");
});

test("evaluateOrder: unrecognized phrasing yields nulls, not a guess", () => {
  assert.deepEqual(evaluateOrder("Something refreshing, surprise me."), { drink: null, size: null, service: null });
});

test("nextMissingSlot: asks for drink first if nothing is known", () => {
  assert.equal(nextMissingSlot({ drink: null, size: null, service: null }), "drink");
});

test("nextMissingSlot: asks for size once drink is known", () => {
  assert.equal(nextMissingSlot({ drink: "coffee", size: null, service: null }), "size");
});

test("nextMissingSlot: asks for service once drink and size are known", () => {
  assert.equal(nextMissingSlot({ drink: "coffee", size: "small", service: null }), "service");
});

test("nextMissingSlot: null (complete) once all three are known — accepted immediately, never re-asked", () => {
  assert.equal(nextMissingSlot({ drink: "coffee", size: "small", service: "to go" }), null);
});
