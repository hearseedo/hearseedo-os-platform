// Phase 0 security hardening (2026-09-09) — regression tests for the four
// previously-unauthenticated AI endpoints (pronunciation-check, assessment-score,
// coaching-card, learning-path). These endpoints must all reject a request
// missing idToken with 401 BEFORE making any network call, which makes this
// test cheap and reliable to run with no live Firebase/Gemini credentials.
//
// Run with: node --test netlify/functions/__tests__/ai-endpoints-auth.test.js
//
// NOTE: this does not cover "invalid token -> rejected" or "valid token ->
// succeeds", since those require either a live Firebase project (to mint a
// real ID token) or mocking the global fetch used by _firebaseAdmin.js's
// verifyIdToken. Covering those is recommended as a follow-up once a test
// Firebase project / emulator is available in CI.

const test = require("node:test");
const assert = require("node:assert/strict");

// Each handler checks for GEMINI_API_KEY (503 if absent) and polls the
// public config/killSwitch doc BEFORE reaching the idToken check this test
// targets — set a dummy key so that gate doesn't mask the 401 we're testing
// for. The killSwitch check is wrapped in try/catch and defaults to "not
// killed" on any network error, so it's safe to run without network access.
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "test-key-not-used-because-auth-check-runs-first";

const ENDPOINTS = [
  { name: "pronunciation-check", path: "../pronunciation-check.js" },
  { name: "assessment-score",    path: "../assessment-score.js" },
  { name: "coaching-card",       path: "../coaching-card.js" },
  { name: "learning-path",       path: "../learning-path.js" },
];

for (const { name, path } of ENDPOINTS) {
  test(`${name}: rejects a request with no idToken (401)`, async () => {
    const { handler } = require(path);
    const res = await handler({
      httpMethod: "POST",
      body: JSON.stringify({ uid: "attacker-supplied-uid", plan: "all_access" }),
    });
    assert.equal(res.statusCode, 401, `${name} should reject a missing idToken with 401, got ${res.statusCode}`);
  });

  test(`${name}: a client-supplied uid alone (no idToken) is never sufficient`, async () => {
    const { handler } = require(path);
    // Same as above, but explicitly named to document the exact regression
    // this Phase 0 fix targets: identity must come from a verified token,
    // never from a client-supplied uid/sso_token field.
    const res = await handler({
      httpMethod: "POST",
      body: JSON.stringify({ uid: "attacker-supplied-uid", sso_token: "attacker-supplied-uid" }),
    });
    assert.equal(res.statusCode, 401);
  });
}

// Billing endpoints found to have the same class of issue during the Phase 0
// follow-up pass: create-checkout.js additionally must never trust a
// client-supplied planId (must derive it from priceId instead).
test("create-checkout: rejects a request with no idToken (400, missing required field)", async () => {
  const { handler } = require("../create-checkout.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ priceId: "price_1TpbitIxMNaZk137A5viyNCb", email: "attacker@example.com" }),
  });
  assert.equal(res.statusCode, 400);
});

test("create-checkout: rejects an unrecognized priceId even with other fields present", async () => {
  const { handler } = require("../create-checkout.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ priceId: "price_totally_made_up", idToken: "irrelevant-invalid-token", email: "a@example.com" }),
  });
  // Whichever check fails first (invalid token vs unrecognized price), the
  // request must never reach Stripe — both are 4xx, never a checkout URL.
  assert.ok(res.statusCode >= 400 && res.statusCode < 500, `expected a 4xx rejection, got ${res.statusCode}`);
  const body = JSON.parse(res.body);
  assert.ok(!body.url, "must never return a checkout URL for an unverified/unrecognized request");
});

test("customer-portal: rejects a request with no idToken (400)", async () => {
  const { handler } = require("../customer-portal.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ email: "victim@example.com" }),
  });
  assert.equal(res.statusCode, 400);
});

// Phase 4 — HSD Family private beta invite redemption. Same class of check:
// beta access must never be grantable without a verified identity.
test("redeem-beta-invite: rejects a request with no idToken (401)", async () => {
  const { handler } = require("../redeem-beta-invite.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ code: "HSD-FAMILY-0001" }),
  });
  assert.equal(res.statusCode, 401);
});

test("redeem-beta-invite: rejects a request with no code (400)", async () => {
  const { handler } = require("../redeem-beta-invite.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ idToken: "irrelevant-invalid-token" }),
  });
  assert.equal(res.statusCode, 400);
});

test("redeem-beta-invite: rejects non-POST methods", async () => {
  const { handler } = require("../redeem-beta-invite.js");
  const res = await handler({ httpMethod: "GET" });
  assert.equal(res.statusCode, 405);
});
