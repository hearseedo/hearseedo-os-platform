// Phase 3 — unit tests for resolveJonaAction (src/jona/jonaSendDecision.js),
// the pure decision logic extracted from GlobalJonaAssistant's send().
// Pure logic, no network/DOM dependency, no real model call — run with:
//   node --test tests/jona-send-decision.test.js
//
// This file covers two things explicitly requested for closing the shared-
// component regression gap:
//   1. Local script-failure handling (a demoScript that throws, returns
//      nothing usable, or has no matching/_default line) — never an
//      exception that reaches the caller, never a fall-through to a live
//      request.
//   2. What an ORDINARY (non-demo) caller's branch selection looks like
//      with a MOCKED authenticated user — a plain object standing in for
//      a real Firebase user, never a real account/network call — proving
//      the code correctly reaches the "would call sendMessage" branch
//      rather than silently doing nothing or misrouting to the demo path.
//
// This tests branch SELECTION only, not execution of the real sendMessage()
// call itself (that requires the full component + network, and is
// separately marked NOT RUN in the acceptance report for authenticated
// production behavior — this test does not claim to cover that).
import test from "node:test";
import assert from "node:assert/strict";
import { resolveJonaAction, DEMO_ERROR_FALLBACK } from "../src/jona/jonaSendDecision.js";

// ── Demo path — happy cases ─────────────────────────────────────────────

test("resolveJonaAction: demoScript as a plain object, exact match", () => {
  const result = resolveJonaAction({
    demoScript: { "hello": "hi there" },
    demoState: null,
    user: null,
    trimmed: "hello",
  });
  assert.deepEqual(result, { type: "demo", reply: "hi there" });
});

test("resolveJonaAction: demoScript as a function of demoState, exact match", () => {
  const result = resolveJonaAction({
    demoScript: (state) => ({ "Is my answer okay?": state?.hasReason ? "yes" : "not yet" }),
    demoState: { hasReason: true },
    user: null,
    trimmed: "Is my answer okay?",
  });
  assert.deepEqual(result, { type: "demo", reply: "yes" });
});

test("resolveJonaAction: no exact match falls back to _default", () => {
  const result = resolveJonaAction({
    demoScript: { "hello": "hi", "_default": "I don't have a scripted answer for that." },
    demoState: null,
    user: null,
    trimmed: "something unscripted",
  });
  assert.deepEqual(result, { type: "demo", reply: "I don't have a scripted answer for that." });
});

// ── Demo path — local failure handling (never a live call, never a throw) ─

test("resolveJonaAction: a demoScript function that THROWS is caught locally, never propagates", () => {
  const result = resolveJonaAction({
    demoScript: () => { throw new Error("broken script"); },
    demoState: null,
    user: null,
    trimmed: "hello",
  });
  assert.deepEqual(result, { type: "demo_error" });
});

test("resolveJonaAction: a demoScript function returning undefined is a local failure, not a crash", () => {
  const result = resolveJonaAction({
    demoScript: () => undefined,
    demoState: null,
    user: null,
    trimmed: "hello",
  });
  assert.deepEqual(result, { type: "demo_error" });
});

test("resolveJonaAction: a demoScript function returning a string (not a table) is a local failure", () => {
  const result = resolveJonaAction({
    demoScript: () => "not a script table",
    demoState: null,
    user: null,
    trimmed: "hello",
  });
  assert.deepEqual(result, { type: "demo_error" });
});

test("resolveJonaAction: a script table with no matching line and no _default is a local failure", () => {
  const result = resolveJonaAction({
    demoScript: { "only this key": "reply" },
    demoState: null,
    user: null,
    trimmed: "something else entirely",
  });
  assert.deepEqual(result, { type: "demo_error" });
});

test("resolveJonaAction: an empty-string reply (falsy) is treated as a local failure, not shown as a blank message", () => {
  const result = resolveJonaAction({
    demoScript: { "hello": "", "_default": "" },
    demoState: null,
    user: null,
    trimmed: "hello",
  });
  assert.deepEqual(result, { type: "demo_error" });
});

test("DEMO_ERROR_FALLBACK is a real, non-empty, local message (never network-derived)", () => {
  assert.equal(typeof DEMO_ERROR_FALLBACK, "string");
  assert.ok(DEMO_ERROR_FALLBACK.length > 0);
});

// ── Ordinary (non-demo) path — including a MOCKED authenticated caller ───

test("resolveJonaAction: no demoScript, no user -> requires_auth (never attempts a send)", () => {
  const result = resolveJonaAction({
    demoScript: undefined,
    demoState: undefined,
    user: null,
    trimmed: "hello",
  });
  assert.deepEqual(result, { type: "requires_auth" });
});

test("resolveJonaAction: no demoScript, MOCKED authenticated user -> send (the ordinary production branch is correctly reached)", () => {
  // A plain object standing in for a real Firebase user — no real account,
  // no network, no auth SDK involved. This is what "mocked authenticated
  // caller" means for this pure decision function: proving the code routes
  // to the real sendMessage() branch for a signed-in caller, without this
  // test itself ever calling sendMessage() or touching the network.
  const mockAuthenticatedUser = { uid: "mock-uid-123", activeProfileId: "mock-profile-1", email: "mock@example.com" };
  const result = resolveJonaAction({
    demoScript: undefined,
    demoState: undefined,
    user: mockAuthenticatedUser,
    trimmed: "What does this word mean?",
  });
  assert.deepEqual(result, { type: "send" });
});

test("resolveJonaAction: demoScript present ALWAYS wins over an authenticated user — a demo call site can never accidentally reach the live path", () => {
  const mockAuthenticatedUser = { uid: "mock-uid-123" };
  const result = resolveJonaAction({
    demoScript: { "_default": "scripted reply" },
    demoState: null,
    user: mockAuthenticatedUser,
    trimmed: "anything",
  });
  assert.deepEqual(result, { type: "demo", reply: "scripted reply" });
});
