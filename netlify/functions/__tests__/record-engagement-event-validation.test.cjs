// Phase 3.4 (2026-09-12; updated same-day for the correctness-review
// follow-up) — pure validation/classification/rate-limit unit tests for
// record-engagement-event.js. No Firestore/network dependency. Run with:
//   node --test netlify/functions/__tests__/record-engagement-event-validation.test.cjs

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateEvent, isValidEventId, classifyCommitFailure, isNetworkError,
  isRateLimitedInMemory, resolveLearnerProfilePath, RATE_LIMIT_MAX_EVENTS,
  __resetRateLimitForTests, corsHeadersFor, ALLOWED_ORIGINS,
} = require("../record-engagement-event.js");
const { engagementDeltaFor, ENGAGEMENT_RULES_VERSION, ENGAGEMENT_DELTA_TABLE } = require("../_appEventAllowlist.js");

const VALID_EVENT_ID = "550e8400-e29b-41d4-a716-446655440000";

function validBody(overrides = {}) {
  return {
    profileId: "self",
    appId: "phonics",
    lessonType: "practice",
    isCorrect: true,
    reportedXp: 20,
    reportedScore: 90,
    eventId: VALID_EVENT_ID,
    ...overrides,
  };
}

test("a fully valid body has no validation errors", () => {
  assert.deepEqual(validateEvent(validBody()), []);
});

test("appId must be a real, known app id — not an arbitrary string", () => {
  assert.deepEqual(validateEvent(validBody({ appId: "not-a-real-app" })), ["appId"]);
  assert.deepEqual(validateEvent(validBody({ appId: "" })), ["appId"]);
  assert.deepEqual(validateEvent(validBody({ appId: undefined })), ["appId"]);
});

test("every real app id from constants/apps.js is accepted", () => {
  const realAppIds = [
    "phonics", "eiken", "speak", "wondercamp", "family", "music-album",
    "sipswitch", "innerkey", "monkeys-unlock", "career-ready", "global-ready", "speak-ready",
  ];
  for (const appId of realAppIds) {
    assert.deepEqual(validateEvent(validBody({ appId })), [], `${appId} should be valid`);
  }
});

test("lessonType must be one of the known values when present, but is optional", () => {
  assert.deepEqual(validateEvent(validBody({ lessonType: "practice" })), []);
  assert.deepEqual(validateEvent(validBody({ lessonType: "assessment" })), []);
  assert.deepEqual(validateEvent(validBody({ lessonType: undefined })), []);
  assert.deepEqual(validateEvent(validBody({ lessonType: "made-up-type" })), ["lessonType"]);
});

test("reportedXp must be a finite number within bounds", () => {
  assert.deepEqual(validateEvent(validBody({ reportedXp: 0 })), []);
  assert.deepEqual(validateEvent(validBody({ reportedXp: undefined })), []);
  assert.deepEqual(validateEvent(validBody({ reportedXp: -1 })), ["reportedXp"]);
  assert.deepEqual(validateEvent(validBody({ reportedXp: 100000 })), ["reportedXp"]);
  assert.deepEqual(validateEvent(validBody({ reportedXp: "20" })), ["reportedXp"]);
  assert.deepEqual(validateEvent(validBody({ reportedXp: NaN })), ["reportedXp"]);
});

test("isCorrect must be a boolean when present", () => {
  assert.deepEqual(validateEvent(validBody({ isCorrect: "yes" })), ["isCorrect"]);
  assert.deepEqual(validateEvent(validBody({ isCorrect: undefined })), []);
});

test("reportedScore must be a finite, bounded number or null when present", () => {
  assert.deepEqual(validateEvent(validBody({ reportedScore: null })), []);
  assert.deepEqual(validateEvent(validBody({ reportedScore: undefined })), []);
  assert.deepEqual(validateEvent(validBody({ reportedScore: "high" })), ["reportedScore"]);
  assert.deepEqual(validateEvent(validBody({ reportedScore: 100000 })), ["reportedScore"]);
});

test("profileId must be a short non-empty string", () => {
  assert.deepEqual(validateEvent(validBody({ profileId: "" })), ["profileId"]);
  assert.deepEqual(validateEvent(validBody({ profileId: undefined })), ["profileId"]);
  assert.deepEqual(validateEvent(validBody({ profileId: "a".repeat(65) })), ["profileId"]);
  assert.deepEqual(validateEvent(validBody({ profileId: "child-uid-abc123" })), []);
});

test("malformed event: multiple invalid fields are all reported together", () => {
  const errors = validateEvent({ profileId: "", appId: "bogus", eventId: "short" });
  assert.ok(errors.includes("profileId"));
  assert.ok(errors.includes("appId"));
  assert.ok(errors.includes("eventId"));
});

// ── Unexpected/unallowed fields (child-data protection) ──────────────────

test("unexpected fields are rejected outright — a payload cannot smuggle in extra data", () => {
  const errors = validateEvent(validBody({ childName: "Taro", transcript: "hello there" }));
  assert.ok(errors.includes("unexpectedFields"));
});

test("a payload with only allowed fields never triggers unexpectedFields", () => {
  assert.ok(!validateEvent(validBody()).includes("unexpectedFields"));
});

// ── eventId format (idempotency key) ────────────────────────────────────

test("isValidEventId accepts the real generateEventId() shape and rejects malformed shapes", () => {
  assert.equal(isValidEventId("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isValidEventId("not valid!"), false);
  assert.equal(isValidEventId("a".repeat(65)), false);
  assert.equal(isValidEventId("short"), false);
  assert.equal(isValidEventId(null), false);
  assert.equal(isValidEventId(12345), false);
});

// ── resolveLearnerProfilePath: the one shared self-vs-child resolver ────

test("resolveLearnerProfilePath routes 'self' to the existing learnerProfiles/{uid} doc (adult/single-user compatibility)", () => {
  assert.equal(resolveLearnerProfilePath("uid-1", "self"), "/learnerProfiles/uid-1");
});

test("resolveLearnerProfilePath routes a child profileId to the new nested per-child location, never learnerProfiles", () => {
  const path = resolveLearnerProfilePath("uid-1", "child-abc");
  assert.equal(path, "/users/uid-1/familyMembers/child-abc/learnerProfile/profile");
  assert.ok(!path.includes("learnerProfiles"), "child data must never land in the flat parent-uid collection");
});

test("resolveLearnerProfilePath never mixes uid and profileId across two different families", () => {
  const pathA = resolveLearnerProfilePath("parent-A", "childX");
  const pathB = resolveLearnerProfilePath("parent-B", "childX");
  assert.notEqual(pathA, pathB, "the same profileId string under two different accounts must resolve to two distinct paths");
});

// ── Commit-failure classification ────────────────────────────────────────

test("ALREADY_EXISTS classifies as duplicate", () => {
  assert.equal(classifyCommitFailure(409, "ALREADY_EXISTS"), "duplicate");
});

test("UNAUTHENTICATED and PERMISSION_DENIED classify distinctly", () => {
  assert.equal(classifyCommitFailure(401, "UNAUTHENTICATED"), "authentication_error");
  assert.equal(classifyCommitFailure(403, "PERMISSION_DENIED"), "permission_error");
});

test("ABORTED (transaction contention) classifies as retryable — this is what drives the transaction-retry loop", () => {
  assert.equal(classifyCommitFailure(409, "ABORTED"), "retryable");
});

test("other transient Firestore failures also classify as retryable", () => {
  for (const status of ["RESOURCE_EXHAUSTED", "UNAVAILABLE", "DEADLINE_EXCEEDED", "INTERNAL", "UNKNOWN", "DATA_LOSS"]) {
    assert.equal(classifyCommitFailure(500, status), "retryable");
  }
});

test("an unparseable response never defaults to duplicate", () => {
  assert.equal(classifyCommitFailure(409, null), "server_error");
  assert.equal(classifyCommitFailure(400, null), "server_error");
});

test("isNetworkError recognizes fetch-level failures", () => {
  assert.equal(isNetworkError(new TypeError("fetch failed")), true);
  assert.equal(isNetworkError({ cause: new Error("ECONNRESET") }), true);
  assert.equal(isNetworkError(new Error("some other error")), false);
  assert.equal(isNetworkError(null), false);
});

// ── In-memory pre-filter: explicitly NOT the security guarantee ─────────

test("in-memory pre-filter: the first RATE_LIMIT_MAX_EVENTS events for one (uid,profileId) are allowed, the next is not", () => {
  __resetRateLimitForTests();
  const now = 1_000_000;
  let limited = false;
  for (let i = 0; i < RATE_LIMIT_MAX_EVENTS; i++) {
    limited = isRateLimitedInMemory("uid-1", "self", now + i);
    assert.equal(limited, false, `event ${i} should not be pre-filtered`);
  }
  limited = isRateLimitedInMemory("uid-1", "self", now + RATE_LIMIT_MAX_EVENTS);
  assert.equal(limited, true);
});

test("in-memory pre-filter is scoped per (uid,profileId) — one child's burst never throttles a sibling on the same account", () => {
  __resetRateLimitForTests();
  const now = 2_000_000;
  for (let i = 0; i < RATE_LIMIT_MAX_EVENTS + 5; i++) isRateLimitedInMemory("parent-1", "childA", now + i);
  assert.equal(isRateLimitedInMemory("parent-1", "childB", now), false, "childB must not be affected by childA's burst");
  assert.equal(isRateLimitedInMemory("parent-2", "self", now), false, "a different account entirely must not be affected either");
});

test("in-memory pre-filter recovers once the window has passed", () => {
  __resetRateLimitForTests();
  const now = 3_000_000;
  for (let i = 0; i < RATE_LIMIT_MAX_EVENTS + 1; i++) isRateLimitedInMemory("uid-1", "self", now + i);
  assert.equal(isRateLimitedInMemory("uid-1", "self", now + 61_000), false);
});

// ── Versioned, server-only engagement-delta table (correctness-review) ──

test("engagementDeltaFor never varies with anything the client controls beyond lessonType/isCorrect", () => {
  // Same lessonType + isCorrect always yields the exact same delta, no
  // matter what xp/score a caller might have claimed — those aren't even
  // parameters to this function.
  assert.equal(engagementDeltaFor("practice", true), ENGAGEMENT_DELTA_TABLE.practice.correct);
  assert.equal(engagementDeltaFor("practice", false), ENGAGEMENT_DELTA_TABLE.practice.incorrect);
  assert.equal(engagementDeltaFor("assessment", true), ENGAGEMENT_DELTA_TABLE.assessment.correct);
});

test("an unrecognized lessonType falls back to the practice rule rather than an unbounded value", () => {
  assert.equal(engagementDeltaFor("not-a-real-type", true), ENGAGEMENT_DELTA_TABLE.practice.correct);
});

test("ENGAGEMENT_RULES_VERSION is a positive integer, present for future auditability", () => {
  assert.equal(typeof ENGAGEMENT_RULES_VERSION, "number");
  assert.ok(ENGAGEMENT_RULES_VERSION >= 1);
});

// ── CORS: defense-in-depth only ──────────────────────────────────────────

test("corsHeadersFor reflects back a known app origin", () => {
  const knownOrigin = [...ALLOWED_ORIGINS][0];
  const headers = corsHeadersFor({ headers: { origin: knownOrigin } });
  assert.equal(headers["Access-Control-Allow-Origin"], knownOrigin);
});

test("corsHeadersFor never reflects back an unknown/arbitrary origin", () => {
  const headers = corsHeadersFor({ headers: { origin: "https://evil.example.com" } });
  assert.notEqual(headers["Access-Control-Allow-Origin"], "https://evil.example.com");
});

test("corsHeadersFor defaults sanely when no origin header is present", () => {
  const headers = corsHeadersFor({ headers: {} });
  assert.ok(ALLOWED_ORIGINS.has(headers["Access-Control-Allow-Origin"]));
});
