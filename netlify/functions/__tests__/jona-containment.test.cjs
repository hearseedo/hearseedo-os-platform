// Containment patch (2026-09-26) — Ask Jona (chat.js) and Talk with Jona
// (live-token.js) are paused for everyone except an explicit adult-tester
// allowlist using their own "self" profile, while the Gemini Developer
// API's child-directed-use eligibility question (Blocker A) is unresolved.
// See netlify/functions/_approvedJonaTesters.js and
// docs/JONA_LIVE_SAFETY_GATE_B_STAGE2_PLAN_REV2_2026-09-26.md.
//
// This file covers two layers:
//   1. The pure decision logic (isApprovedAdultTesterProfile) directly —
//      no network, no auth, fully deterministic — this is what actually
//      encodes the security-relevant rule and is the most important thing
//      to have real, runnable coverage for.
//   2. The same "missing/invalid idToken -> rejected before any model call"
//      shape the rest of this test suite already checks for other
//      endpoints (see ai-endpoints-auth.test.cjs), applied to chat.js.
//      Exercising the "approved tester, real token, self profile ->
//      allowed" happy path requires a live Firebase project to mint a real
//      ID token, same limitation already documented in that file, and is
//      not covered here.
//
// Run with: npm run test:functions

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "test-key-not-used-because-auth-check-runs-first";

const { isApprovedAdultTesterProfile, APPROVED_ADULT_TESTERS } = require("../_approvedJonaTesters.js");

// ── Pure decision logic ─────────────────────────────────────────────────

test("isApprovedAdultTesterProfile: denies an email not on the allowlist, even with profileId self", () => {
  assert.equal(isApprovedAdultTesterProfile({ email: "random-parent@example.com", profileId: "self" }), false);
});

test("isApprovedAdultTesterProfile: denies a missing/undefined email", () => {
  assert.equal(isApprovedAdultTesterProfile({ email: undefined, profileId: "self" }), false);
  assert.equal(isApprovedAdultTesterProfile({ email: null, profileId: "self" }), false);
  assert.equal(isApprovedAdultTesterProfile({ email: "", profileId: "self" }), false);
});

for (const email of APPROVED_ADULT_TESTERS) {
  test(`isApprovedAdultTesterProfile: allows an approved tester (${email}) on their own self profile`, () => {
    assert.equal(isApprovedAdultTesterProfile({ email, profileId: "self" }), true);
  });

  // 2026-09-28 hardening: profileId must be the EXPLICIT string "self" —
  // missing/null/blank is no longer treated as an implicit self, even for
  // an approved account. The real client always sends an explicit value
  // (see _approvedJonaTesters.js's own comment), so this costs nothing to
  // legitimate traffic; it only closes a hand-crafted request that omits
  // profileId from silently landing on the most-privileged interpretation.
  test(`isApprovedAdultTesterProfile: DENIES an approved tester (${email}) with profileId undefined — no implicit self`, () => {
    assert.equal(isApprovedAdultTesterProfile({ email, profileId: undefined }), false);
  });

  test(`isApprovedAdultTesterProfile: DENIES an approved tester (${email}) with profileId null — no implicit self`, () => {
    assert.equal(isApprovedAdultTesterProfile({ email, profileId: null }), false);
  });

  test(`isApprovedAdultTesterProfile: DENIES an approved tester (${email}) with profileId "" (blank) — no implicit self`, () => {
    assert.equal(isApprovedAdultTesterProfile({ email, profileId: "" }), false);
  });

  test(`isApprovedAdultTesterProfile: DENIES an approved tester's (${email}) non-self / family-member profile — the child-profile-under-admin-account case`, () => {
    assert.equal(isApprovedAdultTesterProfile({ email, profileId: "some-child-family-member-id" }), false);
  });

  test(`isApprovedAdultTesterProfile: DENIES an approved tester (${email}) with a manipulated/garbage profileId`, () => {
    assert.equal(isApprovedAdultTesterProfile({ email, profileId: "'; DROP TABLE profiles; --" }), false);
  });

  test(`isApprovedAdultTesterProfile: DENIES an approved tester (${email}) with profileId "Self" (case mismatch) — exact match only, not case-insensitive`, () => {
    assert.equal(isApprovedAdultTesterProfile({ email, profileId: "Self" }), false);
  });
}

test("isApprovedAdultTesterProfile: denies a non-approved email even with a manipulated profileId claiming self", () => {
  // Confirms there's no way to combine an unapproved account with a
  // forged-looking profileId to slip through — the email check alone
  // already fails closed regardless of what profileId claims.
  assert.equal(isApprovedAdultTesterProfile({ email: "attacker@example.com", profileId: "self" }), false);
});

// ── chat.js: fails closed before any model call, same shape as the rest
// of this endpoint's auth ───────────────────────────────────────────────

test("chat.js: rejects a request with no idToken (401), before reaching the containment check or any model call", async () => {
  const { handler } = require("../chat.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ messages: [{ role: "user", text: "hi" }], profileId: "self" }),
  });
  assert.equal(res.statusCode, 401);
});

test("chat.js: an invalid/unverifiable idToken is rejected, never treated as authenticated", async () => {
  const { handler } = require("../chat.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ messages: [{ role: "user", text: "hi" }], idToken: "not-a-real-token", profileId: "self" }),
  });
  assert.equal(res.statusCode, 401);
});

// ── live-token.js: same containment shape applied there ────────────────

test("live-token.js: rejects a request with no idToken (401), before reaching the containment check", async () => {
  const { handler } = require("../live-token.js");
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ profileId: "self" }) });
  assert.equal(res.statusCode, 401);
});

test("live-token.js: an invalid/unverifiable idToken is rejected, never treated as authenticated", async () => {
  const { handler } = require("../live-token.js");
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "not-a-real-token", profileId: "self" }) });
  assert.equal(res.statusCode, 401);
});
