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

// Phase A/B security corrections (2026-09-10) — Monkey Yoga V2 integration.
// Classroom position and curriculum-progress writes must never be
// obtainable/writable without a verified identity, same class of check as
// every other endpoint above.
test("get-classroom-position: rejects a request with no idToken (401)", async () => {
  const { handler } = require("../get-classroom-position.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ profileId: "self" }),
  });
  assert.equal(res.statusCode, 401);
});

test("get-classroom-position: rejects a request with no profileId (400)", async () => {
  const { handler } = require("../get-classroom-position.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ idToken: "irrelevant-invalid-token" }),
  });
  assert.equal(res.statusCode, 400);
});

test("get-classroom-position: rejects non-POST methods", async () => {
  const { handler } = require("../get-classroom-position.js");
  const res = await handler({ httpMethod: "GET" });
  assert.equal(res.statusCode, 405);
});

test("record-curriculum-progress: rejects a request with no idToken (401) even with otherwise-valid fields", async () => {
  const { handler } = require("../record-curriculum-progress.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ profileId: "self", curriculumId: "monkey-yoga-phonics", lessonId: "b1-s", eventId: "b1-s:hear:1" }),
  });
  assert.equal(res.statusCode, 401);
});

test("record-curriculum-progress: rejects an invalid/unrecognized lessonId even with a real idToken shape (400, before any Firestore call)", async () => {
  const { handler } = require("../record-curriculum-progress.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ idToken: "irrelevant-invalid-token", profileId: "self", curriculumId: "monkey-yoga-phonics", lessonId: "not-a-real-lesson", eventId: "x:hear:1" }),
  });
  assert.equal(res.statusCode, 400);
  const body = JSON.parse(res.body);
  assert.ok(body.fields.includes("lessonId"));
});

test("record-curriculum-progress: rejects an unrecognized curriculumId (validation runs before auth verification, so this never even reaches the token check)", async () => {
  const { handler } = require("../record-curriculum-progress.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ idToken: "irrelevant-invalid-token", profileId: "self", curriculumId: "some-other-app", lessonId: "b1-s", eventId: "x:hear:1" }),
  });
  assert.equal(res.statusCode, 400);
});

test("record-curriculum-progress: rejects an oversized skillsPracticed array", async () => {
  const { handler } = require("../record-curriculum-progress.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({
      idToken: "irrelevant-invalid-token", profileId: "self", curriculumId: "monkey-yoga-phonics", lessonId: "b1-s", eventId: "x:hear:1",
      skillsPracticed: ["listening", "movement", "visual_recognition", "blending", "writing", "application", "phonics", "sight_words", "one-too-many"],
    }),
  });
  assert.equal(res.statusCode, 400);
});

test("record-curriculum-progress: rejects an unrecognized skill value", async () => {
  const { handler } = require("../record-curriculum-progress.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ idToken: "x", profileId: "self", curriculumId: "monkey-yoga-phonics", lessonId: "b1-s", eventId: "x:hear:1", skillsPracticed: ["made_up_skill"] }),
  });
  assert.equal(res.statusCode, 400);
});

test("record-curriculum-progress: rejects an invalid confidenceSignal (not one of the manual's Emerging/Developing/Confident values — never a raw score)", async () => {
  const { handler } = require("../record-curriculum-progress.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ idToken: "x", profileId: "self", curriculumId: "monkey-yoga-phonics", lessonId: "b1-s", eventId: "x:hear:1", confidenceSignal: "95%" }),
  });
  assert.equal(res.statusCode, 400);
});

test("record-curriculum-progress: rejects a missing eventId (dedup key is required, not optional)", async () => {
  const { handler } = require("../record-curriculum-progress.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ idToken: "x", profileId: "self", curriculumId: "monkey-yoga-phonics", lessonId: "b1-s" }),
  });
  assert.equal(res.statusCode, 400);
  const body = JSON.parse(res.body);
  assert.ok(body.fields.includes("eventId"));
});

test("record-curriculum-progress: a fully valid payload passes field validation (fails later only on the unverifiable token, proving validation and auth are checked independently)", async () => {
  const { validateEvent } = require("../record-curriculum-progress.js");
  const errors = validateEvent({
    profileId: "self", curriculumId: "monkey-yoga-phonics", lessonId: "b2-h", section: "hear",
    completed: true, skillsPracticed: ["listening", "phonics"], confidenceSignal: "confident",
    // A real crypto.randomUUID()-shaped id (correction, 2026-09-10) — eventId
    // is no longer a free-form string, it's format-checked.
    eventId: "550e8400-e29b-41d4-a716-446655440000",
  });
  assert.deepEqual(errors, []);
});

test("record-curriculum-progress: rejects non-POST methods", async () => {
  const { handler } = require("../record-curriculum-progress.js");
  const res = await handler({ httpMethod: "GET" });
  assert.equal(res.statusCode, 405);
});
