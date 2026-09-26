// Phase 1 — unit tests for the Students demo pathway's reason-clause
// heuristic (src/ecosystemDemo/students/evaluateAttempt.js).
// Pure logic, no network dependency — run with:
//   node --test tests/eco-demo-students-evaluate.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { hasReasonClause, evaluateAttempt } from "../src/ecosystemDemo/students/evaluateAttempt.js";

test("hasReasonClause: detects 'because'", () => {
  assert.equal(hasReasonClause("I like football because it's fun.").hasReason, true);
});

test("hasReasonClause: detects 'since'", () => {
  assert.equal(hasReasonClause("I like reading since it helps me relax.").hasReason, true);
});

test("hasReasonClause: no connective present", () => {
  assert.equal(hasReasonClause("I like football.").hasReason, false);
});

test("hasReasonClause: empty/blank input", () => {
  assert.equal(hasReasonClause("").hasReason, false);
  assert.equal(hasReasonClause("   ").hasReason, false);
});

test("hasReasonClause: word-boundary guard — 'was' must not match 'as'-shaped substrings", () => {
  // Regression guard: a naive substring check on a short connective could
  // false-positive inside an unrelated word. "since" is not a substring of
  // "was", but this test documents the intended boundary behavior for any
  // future connective addition.
  assert.equal(hasReasonClause("It was a nice day.").hasReason, false);
});

test("hasReasonClause: multi-word connective 'so that' matches as a phrase", () => {
  assert.equal(hasReasonClause("I practise so that I feel confident.").hasReason, true);
});

test("evaluateAttempt: first attempt with no reason -> needsReason true", () => {
  const result = evaluateAttempt("I like football.", null);
  assert.equal(result.hasReason, false);
  assert.equal(result.needsReason, true);
  assert.equal(result.addedReason, false);
  assert.equal(result.hadReasonFromStart, false);
});

test("evaluateAttempt: first attempt already has a reason -> needsReason false, never forces a fake add-reason step", () => {
  const result = evaluateAttempt("I like football because I enjoy playing with my friends.", null);
  assert.equal(result.hasReason, true);
  assert.equal(result.needsReason, false);
  assert.equal(result.hadReasonFromStart, true);
});

test("evaluateAttempt: retry genuinely adds a reason", () => {
  const result = evaluateAttempt("I like football because it's fun with my friends.", "I like football.");
  assert.equal(result.addedReason, true);
  assert.equal(result.hadReasonFromStart, false);
  assert.equal(result.needsReason, false);
});

test("evaluateAttempt: retry still missing a reason is never falsely marked as added", () => {
  const result = evaluateAttempt("I like football a lot.", "I like football.");
  assert.equal(result.addedReason, false);
  assert.equal(result.hasReason, false);
});

test("evaluateAttempt: retry that already had a reason from the start is not double-counted as 'added'", () => {
  const result = evaluateAttempt("I like football because it's exciting.", "I like football because it's fun.");
  assert.equal(result.hadReasonFromStart, true);
  assert.equal(result.addedReason, false);
});
