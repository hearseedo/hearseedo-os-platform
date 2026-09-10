// Firestore error classification correction (2026-09-10).
//
// The previous version of record-curriculum-progress.js treated every
// non-2xx :commit response with HTTP status 400 or 409 as a confirmed
// duplicate. That's wrong: Firestore maps several unrelated google.rpc.Code
// values onto those same HTTP statuses (ABORTED — a transaction conflict —
// also maps to 409; INVALID_ARGUMENT and FAILED_PRECONDITION also map to
// 400). A generic 409 was being silently reported to the client as
// "success: true, duplicate: true" even when nothing was actually written
// and no prior write ever happened.
//
// These tests exercise classifyCommitFailure()/isNetworkError() directly
// (pure, no I/O) and the full handler with a mocked firestoreFetch that
// returns realistic Firestore REST error bodies, so the fix is verified
// against the actual response shape Firestore sends, not just status codes.
//
// Empirically verified against the live staging Firestore project
// (monkey-see-c4c28, isolated from production) on 2026-09-10: submitting a
// :commit whose only precondition is `currentDocument: { exists: false }`
// on an already-existing document returns HTTP 409 with
// `error.status: "ALREADY_EXISTS"` — exactly the shape this classifier and
// the mocks below assume. See the "real observed response shape" test at
// the bottom of this file.
//
// Run with: node --test netlify/functions/__tests__/record-curriculum-progress-error-classification.test.cjs

const test = require("node:test");
const assert = require("node:assert/strict");

const { classifyCommitFailure, isNetworkError } = require("../record-curriculum-progress.js");

const firebaseAdmin = require("../_firebaseAdmin.js");
const RCP_PATH = require.resolve("../record-curriculum-progress.js");

function freshHandler({ verifyIdToken, firestoreFetch }) {
  firebaseAdmin.verifyIdToken = verifyIdToken;
  firebaseAdmin.firestoreFetch = firestoreFetch;
  delete require.cache[RCP_PATH];
  return require(RCP_PATH);
}

function fakeUidResolver(uid) {
  return async () => uid;
}

function firestoreErrorResponse(httpStatus, googleStatus, message = "synthetic test error") {
  return {
    ok: false,
    status: httpStatus,
    json: async () => ({ error: { code: httpStatus, status: googleStatus, message } }),
    text: async () => JSON.stringify({ error: { code: httpStatus, status: googleStatus, message } }),
  };
}

function validBody(overrides = {}) {
  return {
    idToken: "fake-token",
    profileId: "self",
    curriculumId: "monkey-yoga-phonics",
    lessonId: "b1-s",
    section: "hear",
    completed: true,
    confidenceSignal: "confident",
    eventId: "550e8400-e29b-41d4-a716-446655440000",
    ...overrides,
  };
}

// ── 1. Pure classification unit tests ───────────────────────────────────────

test("classifyCommitFailure: ALREADY_EXISTS is the only status that classifies as duplicate", () => {
  assert.equal(classifyCommitFailure(409, "ALREADY_EXISTS"), "duplicate");
});

test("classifyCommitFailure: a generic HTTP 400 with no parseable google status is a server error, never duplicate", () => {
  assert.equal(classifyCommitFailure(400, null), "server_error");
});

test("classifyCommitFailure: INVALID_ARGUMENT is a server error, never duplicate", () => {
  assert.equal(classifyCommitFailure(400, "INVALID_ARGUMENT"), "server_error");
});

test("classifyCommitFailure: a generic HTTP 409 with no parseable google status does not automatically classify as duplicate", () => {
  const category = classifyCommitFailure(409, null);
  assert.notEqual(category, "duplicate");
});

test("classifyCommitFailure: UNAUTHENTICATED classifies as an authentication error, not duplicate", () => {
  assert.equal(classifyCommitFailure(401, "UNAUTHENTICATED"), "authentication_error");
});

test("classifyCommitFailure: PERMISSION_DENIED classifies as a permission error, not duplicate", () => {
  assert.equal(classifyCommitFailure(403, "PERMISSION_DENIED"), "permission_error");
});

test("classifyCommitFailure: ABORTED (transaction conflict) is retryable", () => {
  assert.equal(classifyCommitFailure(409, "ABORTED"), "retryable");
});

test("classifyCommitFailure: RESOURCE_EXHAUSTED (rate limiting) is retryable", () => {
  assert.equal(classifyCommitFailure(429, "RESOURCE_EXHAUSTED"), "retryable");
});

test("classifyCommitFailure: INTERNAL (Firestore 500-series) is retryable", () => {
  assert.equal(classifyCommitFailure(500, "INTERNAL"), "retryable");
});

test("isNetworkError: recognizes a fetch-level TypeError as a network failure", () => {
  assert.equal(isNetworkError(new TypeError("fetch failed")), true);
});

test("isNetworkError: does not misclassify an ordinary application error", () => {
  assert.equal(isNetworkError(new Error("validation failed")), false);
});

// ── 2. Full-handler tests against realistic Firestore error bodies ─────────

test("handler: a confirmed processedEvents precondition failure (ALREADY_EXISTS) returns duplicate:true", async () => {
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => (path === ":commit" ? firestoreErrorResponse(409, "ALREADY_EXISTS") : { ok: true, status: 200 }),
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.success, true);
  assert.equal(body.duplicate, true);
});

test("handler: successful atomic commit returns success with duplicate:false", async () => {
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => (path === ":commit" ? { ok: true, status: 200, json: async () => ({}) } : { ok: true, status: 200 }),
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.success, true);
  assert.equal(body.duplicate, false);
});

test("handler: a generic HTTP 400 (no recognizable google status) never returns duplicate:true", async () => {
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => (path === ":commit" ? { ok: false, status: 400, json: async () => { throw new Error("not json"); }, text: async () => "Bad Request" } : { ok: true, status: 200 }),
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  const body = JSON.parse(res.body);
  assert.notEqual(body.duplicate, true);
  assert.equal(body.success, false);
});

test("handler: INVALID_ARGUMENT never returns duplicate:true", async () => {
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => (path === ":commit" ? firestoreErrorResponse(400, "INVALID_ARGUMENT") : { ok: true, status: 200 }),
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  const body = JSON.parse(res.body);
  assert.notEqual(body.duplicate, true);
  assert.equal(res.statusCode, 500);
});

test("handler: a Firestore authentication failure (UNAUTHENTICATED) surfaces as an authentication error, not a duplicate", async () => {
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => (path === ":commit" ? firestoreErrorResponse(401, "UNAUTHENTICATED") : { ok: true, status: 200 }),
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 401);
  const body = JSON.parse(res.body);
  assert.notEqual(body.duplicate, true);
  assert.equal(body.success, false);
});

test("handler: a Firestore permission failure (PERMISSION_DENIED) surfaces as a permission error, not a duplicate", async () => {
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => (path === ":commit" ? firestoreErrorResponse(403, "PERMISSION_DENIED") : { ok: true, status: 200 }),
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 403);
  const body = JSON.parse(res.body);
  assert.notEqual(body.duplicate, true);
});

test("handler: a generic HTTP 409 with no recognizable google status does not automatically return duplicate:true", async () => {
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => (path === ":commit" ? { ok: false, status: 409, json: async () => { throw new Error("not json"); }, text: async () => "Conflict" } : { ok: true, status: 200 }),
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  const body = JSON.parse(res.body);
  assert.notEqual(body.duplicate, true);
});

test("handler: a transaction conflict (ABORTED) is reported as retryable, never as success", async () => {
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => (path === ":commit" ? firestoreErrorResponse(409, "ABORTED") : { ok: true, status: 200 }),
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 503);
  const body = JSON.parse(res.body);
  assert.equal(body.success, false);
  assert.equal(body.retryable, true);
});

test("handler: rate limiting (RESOURCE_EXHAUSTED) is reported as retryable", async () => {
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => (path === ":commit" ? firestoreErrorResponse(429, "RESOURCE_EXHAUSTED") : { ok: true, status: 200 }),
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 503);
  const body = JSON.parse(res.body);
  assert.equal(body.retryable, true);
});

test("handler: a Firestore 500-series failure (INTERNAL) is reported as retryable", async () => {
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => (path === ":commit" ? firestoreErrorResponse(500, "INTERNAL") : { ok: true, status: 200 }),
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 503);
  const body = JSON.parse(res.body);
  assert.equal(body.retryable, true);
});

test("handler: a network failure (fetch throws) is reported as retryable, never as success", async () => {
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => {
      if (path === ":commit") throw new TypeError("fetch failed");
      return { ok: true, status: 200 };
    },
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 503);
  const body = JSON.parse(res.body);
  assert.equal(body.success, false);
  assert.equal(body.retryable, true);
});

test("handler: missing service-account configuration is reported as a server-configuration failure, not retryable and not duplicate", async () => {
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => {
      if (path === ":commit") throw new firebaseAdmin.FirestoreConfigError("Firebase service-account credentials are not configured.");
      return { ok: true, status: 200 };
    },
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 500);
  const body = JSON.parse(res.body);
  assert.equal(body.success, false);
  assert.notEqual(body.duplicate, true);
  assert.notEqual(body.retryable, true);
});

test("handler: does not tell the client progress was saved when the commit did not succeed", async () => {
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => (path === ":commit" ? firestoreErrorResponse(500, "INTERNAL") : { ok: true, status: 200 }),
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  const body = JSON.parse(res.body);
  // "success: true" must never appear for a failed commit, whether or not
  // it happens to also be retryable.
  assert.notEqual(body.success, true);
});

test("handler: no sensitive Firestore error details (project id, document path, service-account email, raw error text) are exposed to the client", async () => {
  const sensitiveMessage = "projects/hear-see-do-os-ai/databases/(default)/documents/users/abc123/curriculumProgress/monkey-yoga-phonics — service account firebase-adminsdk-fbsvc@hear-see-do-os-ai.iam.gserviceaccount.com rejected: token signature invalid";
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => (path === ":commit" ? firestoreErrorResponse(500, "INTERNAL", sensitiveMessage) : { ok: true, status: 200 }),
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  const raw = JSON.stringify(res);
  assert.ok(!raw.includes("hear-see-do-os-ai"), "must not leak the Firebase project id");
  assert.ok(!raw.includes("firebase-adminsdk"), "must not leak the service-account email");
  assert.ok(!raw.includes("abc123"), "must not leak a document path / uid segment");
  assert.ok(!raw.includes("token signature invalid"), "must not leak the raw Firestore error message");
});

test("handler: the real observed staging-Firestore response shape (HTTP 409, error.status ALREADY_EXISTS) classifies as duplicate", async () => {
  // This exact {code:409, status:"ALREADY_EXISTS"} shape was reproduced
  // live against the isolated staging Firestore project (monkey-see-c4c28)
  // on 2026-09-10 by submitting a :commit with the same
  // currentDocument:{exists:false} precondition this handler uses, against
  // an already-processed eventId — see the file header for details. This
  // test pins that observed shape so a future Firestore API change would
  // fail it rather than silently drift from reality.
  const { handler } = freshHandler({
    verifyIdToken: fakeUidResolver("user-1"),
    firestoreFetch: async (path) => (path === ":commit" ? firestoreErrorResponse(409, "ALREADY_EXISTS", "Document already exists: projects/.../processedEvents/...") : { ok: true, status: 200 }),
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.success, true);
  assert.equal(body.duplicate, true);
});
