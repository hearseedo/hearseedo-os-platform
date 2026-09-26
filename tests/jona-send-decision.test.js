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
import { resolveJonaAction, performLiveSend, DEMO_ERROR_FALLBACK } from "../src/jona/jonaSendDecision.js";

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

// ── performLiveSend — the ordinary caller ACTUALLY sending, with a MOCKED
// sendMessage. Closes the previously-open gap: resolveJonaAction only
// proved branch selection; this proves the "send" branch's own execution
// (success, reply, safetyToken, and error recovery) with no real network
// or model call, no DOM renderer, no real account. ────────────────────────

test("performLiveSend: a mocked successful sendMessage yields the reply and its safetyToken", async () => {
  const mockSendMessage = async (messages, user, lang, context, onMeta) => {
    onMeta({ safetyToken: "mock-token-abc" });
    return "This is a mocked reply.";
  };
  const result = await performLiveSend({
    sendMessage: mockSendMessage,
    messages: [{ role: "user", text: "hello" }],
    user: { uid: "mock-uid-123" },
    lang: "en",
    context: { pathway: "students" },
    errorFallback: "fallback",
  });
  assert.deepEqual(result, { ok: true, reply: "This is a mocked reply.", safetyToken: "mock-token-abc" });
});

test("performLiveSend: a mocked successful sendMessage that never calls onMeta yields a null safetyToken (never undefined/crash)", async () => {
  const mockSendMessage = async () => "reply with no meta call";
  const result = await performLiveSend({
    sendMessage: mockSendMessage,
    messages: [],
    user: { uid: "mock-uid-123" },
    lang: "en",
    context: null,
    errorFallback: "fallback",
  });
  assert.deepEqual(result, { ok: true, reply: "reply with no meta call", safetyToken: null });
});

test("performLiveSend: a mocked sendMessage that REJECTS is caught and recovered as an error result, never an unhandled throw", async () => {
  const mockSendMessage = async () => { throw new Error("simulated network failure"); };
  const result = await performLiveSend({
    sendMessage: mockSendMessage,
    messages: [{ role: "user", text: "hello" }],
    user: { uid: "mock-uid-123" },
    lang: "en",
    context: {},
    errorFallback: "fallback message",
  });
  assert.deepEqual(result, { ok: false, error: "simulated network failure" });
});

test("performLiveSend: a rejection with no .message falls back to the caller-supplied errorFallback", async () => {
  const mockSendMessage = async () => { throw { code: "no-message-field" }; };
  const result = await performLiveSend({
    sendMessage: mockSendMessage,
    messages: [],
    user: { uid: "mock-uid-123" },
    lang: "en",
    context: {},
    errorFallback: "fallback message",
  });
  assert.deepEqual(result, { ok: false, error: "fallback message" });
});

test("performLiveSend: after a failure, a subsequent call with a working mock succeeds — proves the caller can recover and retry, not get stuck", async () => {
  let callCount = 0;
  const flakySendMessage = async () => {
    callCount += 1;
    if (callCount === 1) throw new Error("first attempt fails");
    return "second attempt succeeds";
  };
  const first = await performLiveSend({
    sendMessage: flakySendMessage, messages: [], user: { uid: "u" }, lang: "en", context: {}, errorFallback: "fallback",
  });
  assert.equal(first.ok, false);
  const second = await performLiveSend({
    sendMessage: flakySendMessage, messages: [], user: { uid: "u" }, lang: "en", context: {}, errorFallback: "fallback",
  });
  assert.deepEqual(second, { ok: true, reply: "second attempt succeeds", safetyToken: null });
});
