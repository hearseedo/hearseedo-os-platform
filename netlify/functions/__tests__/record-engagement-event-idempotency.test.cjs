// Phase 3.4 (2026-09-12; rewritten same-day for the correctness-review
// follow-up) — integration-style tests for record-engagement-event.js
// against an in-memory Firestore TRANSACTION stand-in. Unlike the
// precondition-only mock this file used before the correctness review,
// makeMockFirestore() here models real Firestore optimistic-concurrency
// transaction semantics: every document a transaction reads is version-
// stamped, and :commit fails with ABORTED if any of those versions moved
// before the commit lands — the same contract the real Firestore REST API
// documents for interactive transactions, and the same thing
// record-engagement-event.js's runTransactionAttempt()/retry loop is
// designed against.
//
// No live Firebase project is available in this environment (no Java
// runtime for the emulator either — see docs/PHASE_3_3_DIAGNOSTICS.md);
// _firebaseAdmin's verifyIdToken/firestoreFetch are replaced with fakes
// before each fresh require of the handler. Run with:
//   node --test netlify/functions/__tests__/record-engagement-event-idempotency.test.cjs

const test = require("node:test");
const assert = require("node:assert/strict");

const firebaseAdmin = require("../_firebaseAdmin.js");
const { toFirestoreFields, fromFirestoreFields } = firebaseAdmin;
const REE_PATH = require.resolve("../record-engagement-event.js");

function freshHandler({ verifyIdToken, firestoreFetch }) {
  firebaseAdmin.verifyIdToken = verifyIdToken;
  firebaseAdmin.firestoreFetch = firestoreFetch;
  delete require.cache[REE_PATH];
  const mod = require(REE_PATH);
  mod.__resetRateLimitForTests();
  return mod;
}

function fakeUidResolver(uid) {
  return async () => uid;
}

const FAMILY_MEMBER_RE = /^\/users\/[^/]+\/familyMembers\/[^/]+$/;

function docNameToPath(fullName) {
  const marker = "/documents";
  const idx = fullName.indexOf(marker);
  return fullName.slice(idx + marker.length);
}

/**
 * In-memory Firestore TRANSACTION stand-in.
 *
 * - `docs`: path -> { fields, version }. version increments every time a
 *   document is written by any successful :commit.
 * - `transactions`: token -> Map(path -> versionAtRead). Populated by every
 *   transactional GET (`?transaction=<token>`).
 * - :commit(transaction, writes) succeeds only if every path that
 *   transaction read still has the SAME version it had at read time;
 *   otherwise it returns a 409 ABORTED, exactly like real Firestore.
 * - Successful commits and rollbacks both consume (delete) the
 *   transaction token, matching real Firestore (a token is single-use).
 *
 * `beforeCommit` (optional) lets a test inject a write from a *different*
 * transaction between this one's reads and its commit — the way a real
 * concurrent request would — to prove genuine conflict detection.
 */
function makeMockFirestore({ familyMembersExist = true, onCommit } = {}) {
  const docs = new Map();
  const transactions = new Map();
  const commitCalls = [];
  let txCounter = 0;

  function currentVersion(path) {
    return docs.get(path)?.version ?? 0;
  }

  function applyWrites(writes) {
    for (const w of writes) {
      const path = docNameToPath(w.update.name);
      const existing = docs.get(path);
      docs.set(path, { fields: fromFirestoreFields(w.update.fields), version: (existing?.version ?? 0) + 1 });
    }
  }

  async function firestoreFetch(path, options = {}) {
    if (path === ":beginTransaction") {
      const token = `tx-${++txCounter}`;
      transactions.set(token, new Map());
      return { ok: true, status: 200, json: async () => ({ transaction: token }) };
    }

    if (path === ":rollback") {
      const body = JSON.parse(options.body);
      transactions.delete(body.transaction);
      return { ok: true, status: 200, json: async () => ({}) };
    }

    if (path === ":commit") {
      const body = JSON.parse(options.body);
      commitCalls.push(body);
      const reads = transactions.get(body.transaction);
      if (!reads) {
        return { ok: false, status: 400, json: async () => ({ error: { code: 400, status: "FAILED_PRECONDITION", message: "unknown transaction" } }) };
      }
      for (const [path, versionAtRead] of reads) {
        if (currentVersion(path) !== versionAtRead) {
          transactions.delete(body.transaction);
          return {
            ok: false,
            status: 409,
            json: async () => ({ error: { code: 409, status: "ABORTED", message: "Transaction lock timeout / contention." } }),
            text: async () => "ABORTED",
          };
        }
      }
      if (onCommit) onCommit(body);
      applyWrites(body.writes);
      transactions.delete(body.transaction);
      return { ok: true, status: 200, json: async () => ({}) };
    }

    // GET, optionally with ?transaction=<token>
    const [rawPath, query] = path.split("?");
    const params = new URLSearchParams(query ?? "");
    const txToken = params.get("transaction");

    if (FAMILY_MEMBER_RE.test(rawPath)) {
      return familyMembersExist ? { ok: true, status: 200 } : { ok: false, status: 404 };
    }

    if (txToken) {
      const reads = transactions.get(txToken);
      if (reads && !reads.has(rawPath)) reads.set(rawPath, currentVersion(rawPath));
    }

    if (docs.has(rawPath)) {
      return { ok: true, status: 200, json: async () => ({ fields: toFirestoreFields(docs.get(rawPath).fields) }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  }

  return { firestoreFetch, docs, commitCalls, transactions };
}

const EVENT_1 = "550e8400-e29b-41d4-a716-446655440000";
const EVENT_2 = "550e8400-e29b-41d4-a716-446655440001";

function validBody(overrides = {}) {
  return {
    idToken: "fake-token",
    profileId: "self",
    appId: "phonics",
    lessonType: "practice",
    isCorrect: true,
    reportedXp: 20,
    reportedScore: 90,
    eventId: EVENT_1,
    ...overrides,
  };
}

// ── Authentication ───────────────────────────────────────────────────────

test("unauthenticated request: missing idToken is rejected before any Firestore call", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });
  const body = validBody();
  delete body.idToken;
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(body) });
  assert.equal(res.statusCode, 401);
  assert.equal(mock.commitCalls.length, 0);
});

test("unauthenticated request: an invalid/expired idToken is rejected", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({
    verifyIdToken: async () => { throw new Error("invalid token"); },
    firestoreFetch: mock.firestoreFetch,
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 401);
  assert.equal(mock.commitCalls.length, 0);
});

// ── Malformed events ─────────────────────────────────────────────────────

test("malformed event: an unknown appId is rejected before any Firestore call", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ appId: "not-a-real-app" })) });
  assert.equal(res.statusCode, 400);
  assert.ok(JSON.parse(res.body).fields.includes("appId"));
  assert.equal(mock.commitCalls.length, 0);
});

test("malformed event: an oversized/garbled eventId is rejected", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ eventId: "bad id!" })) });
  assert.equal(res.statusCode, 400);
  assert.equal(mock.commitCalls.length, 0);
});

test("malformed event: an unexpected extra field (e.g. a would-be child name) is rejected outright", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });
  const body = { ...validBody(), childName: "Taro" };
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(body) });
  assert.equal(res.statusCode, 400);
  assert.ok(JSON.parse(res.body).fields.includes("unexpectedFields"));
  assert.equal(mock.commitCalls.length, 0);
});

// ── Ownership / cross-child / deleted / unknown profile ─────────────────

test("valid parent-to-child event: a real child profile succeeds and is written under the child's own path", async () => {
  const mock = makeMockFirestore({ familyMembersExist: true });
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("parent-1"), firestoreFetch: mock.firestoreFetch });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ profileId: "child-1" })) });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).success, true);
  const summaryPath = "/users/parent-1/familyMembers/child-1/learnerProfile/profile";
  assert.ok(mock.docs.has(summaryPath), "the child's own profile doc must exist after the event");
  assert.equal(mock.docs.get(summaryPath).fields.totalInteractions, 1);
});

test("unknown profile rejection: a profileId with no matching familyMembers doc is rejected, no writes", async () => {
  const mock = makeMockFirestore({ familyMembersExist: false });
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("parent-1"), firestoreFetch: mock.firestoreFetch });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ profileId: "no-such-child" })) });
  assert.equal(res.statusCode, 403);
  assert.equal(mock.commitCalls.length, 0, "no write is ever attempted for an unverified profile");
});

test("deleted profile rejection: a profileId that no longer resolves (deleted child) is rejected the same as unknown", async () => {
  const mock = makeMockFirestore({ familyMembersExist: false });
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("parent-1"), firestoreFetch: mock.firestoreFetch });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ profileId: "formerly-childA" })) });
  assert.equal(res.statusCode, 403);
  assert.equal(mock.commitCalls.length, 0);
});

test("cross-child rejection: the same profileId string under two different accounts never collides", async () => {
  const mockA = makeMockFirestore({ familyMembersExist: true });
  const { handler: handlerA } = freshHandler({ verifyIdToken: fakeUidResolver("parent-A"), firestoreFetch: mockA.firestoreFetch });
  await handlerA({ httpMethod: "POST", body: JSON.stringify(validBody({ profileId: "child-shared-id", eventId: EVENT_1 })) });

  const mockB = makeMockFirestore({ familyMembersExist: true });
  const { handler: handlerB } = freshHandler({ verifyIdToken: fakeUidResolver("parent-B"), firestoreFetch: mockB.firestoreFetch });
  await handlerB({ httpMethod: "POST", body: JSON.stringify(validBody({ profileId: "child-shared-id", eventId: EVENT_1 })) });

  assert.ok(mockA.docs.has("/users/parent-A/familyMembers/child-shared-id/learnerProfile/profile"));
  assert.ok(mockB.docs.has("/users/parent-B/familyMembers/child-shared-id/learnerProfile/profile"));
  assert.ok(!mockA.docs.has("/users/parent-B/familyMembers/child-shared-id/learnerProfile/profile"));
  assert.ok(!mockB.docs.has("/users/parent-A/familyMembers/child-shared-id/learnerProfile/profile"));
});

// ── Atomicity: failure before / during commit ────────────────────────────

test("ATOMICITY: failure before commit (forbidden profile) writes nothing at all — no marker, no profile doc, no interaction, no rate-limit doc", async () => {
  const mock = makeMockFirestore({ familyMembersExist: false });
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("parent-1"), firestoreFetch: mock.firestoreFetch });
  await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ profileId: "no-such-child" })) });
  assert.equal(mock.docs.size, 0, "not a single document may exist after a rejected-before-commit request");
  assert.equal(mock.commitCalls.length, 0);
});

test("ATOMICITY: a thrown error between beginTransaction and commit leaves the transaction rolled back and writes nothing", async () => {
  const mock = makeMockFirestore();
  // Force the FIRST transactional read (the profile summary GET) to throw,
  // simulating a mid-processing failure after the transaction has begun
  // but before any write is attempted. Deliberately NOT phrased to match
  // isNetworkError()'s heuristics (no "network"/ECONN*/etc. in the
  // message) — this proves the general "unexpected exception" path is
  // also non-destructive, not just the network-specific one.
  let readCount = 0;
  const throwingFetch = async (path, options) => {
    if (!path.startsWith(":") && path.includes("?transaction=")) {
      readCount += 1;
      if (readCount === 1) throw new Error("simulated mid-transaction processing failure");
    }
    return mock.firestoreFetch(path, options);
  };
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: throwingFetch });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.notEqual(res.statusCode, 200, "an unexpected mid-transaction error must never be reported as success");
  assert.equal(mock.commitCalls.length, 0, "a failure before commit must never reach :commit at all");
  assert.equal(mock.docs.size, 0, "nothing may be written when processing fails before commit");
});

test("ATOMICITY: a hard commit failure (not ABORTED) leaves no processedEvents marker — the event is NOT marked complete", async () => {
  const mock = makeMockFirestore();
  const failingCommitFetch = async (path, options) => {
    if (path === ":commit") {
      return { ok: false, status: 500, json: async () => ({ error: { code: 13, status: "INTERNAL", message: "simulated internal error" } }) };
    }
    return mock.firestoreFetch(path, options);
  };
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: failingCommitFetch });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).retryable, true);
  assert.equal(mock.docs.size, 0, "the processedEvents marker (and everything else) must not exist after a failed commit");
});

test("RETRY AFTER FAILURE (separate request): resubmitting the same event after a NON-retryable commit failure succeeds exactly once", async () => {
  // Uses a googleStatus that classifies as "server_error" (not
  // "retryable"), so the handler's own internal retry-on-ABORTED loop does
  // NOT absorb it within one call — this proves a genuinely separate
  // client retry (a second HTTP request) still lands exactly once, on top
  // of (not in place of) the in-function ABORTED retry loop covered by the
  // CONCURRENCY tests below.
  const mock = makeMockFirestore();
  let firstCommitShouldFail = true;
  const flakyFetch = async (path, options) => {
    if (path === ":commit" && firstCommitShouldFail) {
      firstCommitShouldFail = false;
      return { ok: false, status: 400, json: async () => ({ error: { code: 9, status: "FAILED_PRECONDITION", message: "simulated non-retryable failure" } }) };
    }
    return mock.firestoreFetch(path, options);
  };
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: flakyFetch });

  const res1 = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res1.statusCode, 500, "the first attempt genuinely failed and must be reported honestly, not as success");
  assert.equal(mock.docs.size, 0);

  const res2 = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res2.statusCode, 200);
  assert.equal(JSON.parse(res2.body).duplicate, false, "the retry is a genuinely fresh success, not a false duplicate");
  assert.equal(mock.docs.get("/learnerProfiles/user-1").fields.totalInteractions, 1, "exactly one increment total, from the one successful attempt");
});

// ── Idempotency / duplicate events ───────────────────────────────────────

test("duplicate event: resending the same eventId after a confirmed success is reported as a confirmed duplicate, not double-counted", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });

  const res1 = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  const res2 = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });

  assert.equal(JSON.parse(res1.body).duplicate, false);
  assert.equal(JSON.parse(res2.body).duplicate, true);
  assert.equal(mock.docs.get("/learnerProfiles/user-1").fields.totalInteractions, 1, "the duplicate must never re-apply the increment");
});

test("CONCURRENCY: two simultaneous submissions with the SAME eventId still produce exactly one increment", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });

  const [res1, res2] = await Promise.all([
    handler({ httpMethod: "POST", body: JSON.stringify(validBody({ eventId: EVENT_1 })) }),
    handler({ httpMethod: "POST", body: JSON.stringify(validBody({ eventId: EVENT_1 })) }),
  ]);
  assert.equal(res1.statusCode, 200);
  assert.equal(res2.statusCode, 200);
  const flags = [res1, res2].map((r) => JSON.parse(r.body).duplicate).sort();
  // Thanks to the automatic retry-on-ABORTED loop, the "loser" of the
  // commit race retries and lands on "duplicate", never on a raw failure.
  assert.deepEqual(flags, [false, true]);
  assert.equal(mock.docs.get("/learnerProfiles/user-1").fields.totalInteractions, 1, "exactly one increment, never two, even though both requests ran concurrently");
});

test("CONCURRENCY: two simultaneous DIFFERENT events for the same profile do not overwrite each other — both are eventually reflected", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });

  const [res1, res2] = await Promise.all([
    handler({ httpMethod: "POST", body: JSON.stringify(validBody({ eventId: EVENT_1 })) }),
    handler({ httpMethod: "POST", body: JSON.stringify(validBody({ eventId: EVENT_2 })) }),
  ]);
  assert.equal(res1.statusCode, 200);
  assert.equal(res2.statusCode, 200);
  assert.equal(JSON.parse(res1.body).duplicate, false);
  assert.equal(JSON.parse(res2.body).duplicate, false, "a genuinely different event must never be reported as a duplicate of the other");
  // The retry loop means whichever transaction lost the commit race
  // re-reads the post-conflict state and applies its OWN increment on top
  // — never silently discarding it, never clobbering the winner's write.
  assert.equal(mock.docs.get("/learnerProfiles/user-1").fields.totalInteractions, 2, "both concurrent events must be reflected — neither is lost");
  assert.ok(mock.docs.has("/learnerProfiles/user-1/interactions/" + EVENT_1));
  assert.ok(mock.docs.has("/learnerProfiles/user-1/interactions/" + EVENT_2));
});

test("a new eventId for the same profile is a genuinely new event, correctly incrementing totalInteractions", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });

  await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ eventId: EVENT_1 })) });
  const res2 = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ eventId: EVENT_2 })) });

  assert.equal(JSON.parse(res2.body).duplicate, false);
  assert.equal(mock.docs.get("/learnerProfiles/user-1").fields.totalInteractions, 2);
});

// ── Rate limiting (persisted, transactional — the authoritative control) ─

test("persisted rate limit: a burst of events for one profile beyond the limit is rejected with 429, and the profile is left in a consistent state", async () => {
  const mock = makeMockFirestore();
  const { handler, RATE_LIMIT_MAX_EVENTS } = freshHandler({ verifyIdToken: fakeUidResolver("burst-uid"), firestoreFetch: mock.firestoreFetch });

  let statuses = [];
  for (let i = 0; i <= RATE_LIMIT_MAX_EVENTS; i++) {
    const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ eventId: `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, "0")}` })) });
    statuses.push(res.statusCode);
  }
  assert.equal(statuses[statuses.length - 1], 429, "the event beyond the per-minute limit must be rejected");
  assert.equal(mock.docs.get("/learnerProfiles/burst-uid").fields.totalInteractions, RATE_LIMIT_MAX_EVENTS, "the rejected event must not have incremented anything");
});

test("persisted rate limit never mixes two children on the same account", async () => {
  const mock = makeMockFirestore({ familyMembersExist: true });
  const { handler, RATE_LIMIT_MAX_EVENTS } = freshHandler({ verifyIdToken: fakeUidResolver("parent-1"), firestoreFetch: mock.firestoreFetch });

  for (let i = 0; i <= RATE_LIMIT_MAX_EVENTS; i++) {
    await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ profileId: "childA", eventId: `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, "0")}` })) });
  }
  const resSibling = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ profileId: "childB", eventId: "550e8400-e29b-41d4-a716-446655449999" })) });
  assert.equal(resSibling.statusCode, 200, "childB must not be rate-limited by childA's burst");
});

// ── Adult/single-user compatibility ──────────────────────────────────────

test("adult/single-user compatibility: profileId 'self' writes to the pre-existing learnerProfiles/{uid} path unchanged", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("adult-uid"), firestoreFetch: mock.firestoreFetch });

  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ profileId: "self" })) });
  assert.equal(res.statusCode, 200);
  assert.ok(mock.docs.has("/learnerProfiles/adult-uid"), "self must land in the exact same doc Dashboard.jsx/ParentView.jsx already read");
  assert.ok(!Array.from(mock.docs.keys()).some((k) => k.includes("familyMembers")), "self must never touch the familyMembers tree");
});

test("adult/single-user compatibility: no familyMembers ownership check is ever performed for 'self'", async () => {
  const mock = makeMockFirestore({ familyMembersExist: false });
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("adult-uid"), firestoreFetch: mock.firestoreFetch });

  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ profileId: "self" })) });
  assert.equal(res.statusCode, 200);
});

// ── Curriculum progress independence (Phase 3.4 item 3) ─────────────────

test("this endpoint never touches curriculumProgress — engagement and curriculum tracking remain fully separate storage", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });
  await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.ok(!Array.from(mock.docs.keys()).some((k) => k.includes("curriculumProgress")), "record-engagement-event.js must never write curriculumProgress");
});

// ── Engagement derivation is server-only ─────────────────────────────────

test("engagement score is derived server-side from the versioned table, never from a client-supplied number", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });

  const resLowClaim = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ eventId: EVENT_1, reportedXp: 1 })) });
  const mock2 = makeMockFirestore();
  const { handler: handler2 } = freshHandler({ verifyIdToken: fakeUidResolver("user-2"), firestoreFetch: mock2.firestoreFetch });
  const resHighClaim = await handler2({ httpMethod: "POST", body: JSON.stringify(validBody({ eventId: EVENT_1, reportedXp: 999 })) });

  const scoreLow = JSON.parse(resLowClaim.body).engagementScore;
  const scoreHigh = JSON.parse(resHighClaim.body).engagementScore;
  assert.equal(scoreLow, scoreHigh, "reportedXp must never change the derived engagement score — only lessonType/isCorrect may");
});

test("reportedXp/reportedScore are stored as separate evidence fields on the interaction log, distinct from engagementScore", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });
  await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ reportedXp: 42, reportedScore: 77 })) });
  const interaction = mock.docs.get(`/learnerProfiles/user-1/interactions/${EVENT_1}`).fields;
  assert.equal(interaction.reportedXp, 42);
  assert.equal(interaction.reportedScore, 77);
  assert.notEqual(interaction.reportedXp, interaction.engagementScore);
});

// ── TTL / retention fields ────────────────────────────────────────────────

test("the processedEvents marker and rateLimit doc both carry an expiresAt field", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });
  await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.ok(mock.docs.get(`/learnerProfiles/user-1/processedEvents/${EVENT_1}`).fields.expiresAt);
  assert.ok(mock.docs.get("/learnerProfiles/user-1/rateLimit/current").fields.expiresAt);
});
