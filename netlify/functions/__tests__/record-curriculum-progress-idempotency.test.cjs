// Event-id idempotency correction (2026-09-10) — regression tests for
// record-curriculum-progress.js's atomic dedup design. See
// docs/ACTIVE_ARCHITECTURE.md and the function's own comments for the full
// design: a single Firestore :commit call whose processedEvents write
// carries `currentDocument: { exists: false }`, so the existence check and
// every other write in the same request are applied atomically together.
//
// No live Firebase project is available in this environment (same
// constraint noted in ai-endpoints-auth.test.cjs), so _firebaseAdmin's
// verifyIdToken/firestoreFetch are replaced with in-memory fakes before
// each fresh require of the handler. Run with:
//   node --test netlify/functions/__tests__/record-curriculum-progress-idempotency.test.cjs

const test = require("node:test");
const assert = require("node:assert/strict");

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

/**
 * In-memory Firestore stand-in that enforces the same contract the real
 * :commit endpoint does: every write's `currentDocument: { exists: false }`
 * precondition is evaluated for the WHOLE batch before any write is
 * applied, with no await in between, so two calls racing in the same tick
 * can never both see exists:false and both succeed — exactly the guarantee
 * record-curriculum-progress.js's design relies on instead of an explicit
 * beginTransaction/commit pair.
 */
function makeMockFirestore({ familyMembersExist = true } = {}) {
  const docs = new Set();
  const commitCalls = [];

  async function firestoreFetch(path, options = {}) {
    if (path === ":commit") {
      const body = JSON.parse(options.body);
      commitCalls.push(body);
      for (const w of body.writes) {
        if (w.currentDocument && w.currentDocument.exists === false && docs.has(w.update.name)) {
          return {
            ok: false,
            status: 409,
            json: async () => ({ error: { code: 409, status: "ALREADY_EXISTS", message: "Document already exists." } }),
            text: async () => "ALREADY_EXISTS",
          };
        }
      }
      for (const w of body.writes) docs.add(w.update.name);
      return { ok: true, status: 200, json: async () => ({}) };
    }
    if (path.includes("/familyMembers/")) {
      return familyMembersExist ? { ok: true, status: 200 } : { ok: false, status: 404 };
    }
    throw new Error(`Unexpected firestoreFetch call in test: ${path}`);
  }

  return { firestoreFetch, docs, commitCalls };
}

const VALID_EVENT_1 = "550e8400-e29b-41d4-a716-446655440000";
const VALID_EVENT_2 = "550e8400-e29b-41d4-a716-446655440001";

function validBody(overrides = {}) {
  return {
    idToken: "fake-token",
    profileId: "self",
    curriculumId: "monkey-yoga-phonics",
    lessonId: "b1-s",
    section: "hear",
    completed: true,
    confidenceSignal: "confident",
    eventId: VALID_EVENT_1,
    ...overrides,
  };
}

test("immediate retry with the same eventId produces exactly one record", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });

  const res1 = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  const res2 = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });

  assert.equal(res1.statusCode, 200);
  assert.equal(JSON.parse(res1.body).duplicate, false);
  assert.equal(res2.statusCode, 200);
  assert.equal(JSON.parse(res2.body).duplicate, true);
  assert.equal(mock.commitCalls.length, 2, "both attempts reach Firestore");
  assert.equal(mock.docs.size, 3, "only the first attempt's writes actually landed: marker + summary + log entry");
});

test("a delayed retry (separate later request) with the same eventId still produces exactly one record", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });

  const res1 = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  await new Promise((r) => setTimeout(r, 20)); // nothing time-based in the key, so a delay changes nothing
  const res2 = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });

  assert.equal(JSON.parse(res1.body).duplicate, false);
  assert.equal(JSON.parse(res2.body).duplicate, true);
  assert.equal(mock.docs.size, 3);
});

test("two simultaneous submissions with the same eventId still produce exactly one record", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });

  const [res1, res2] = await Promise.all([
    handler({ httpMethod: "POST", body: JSON.stringify(validBody()) }),
    handler({ httpMethod: "POST", body: JSON.stringify(validBody()) }),
  ]);

  const duplicateFlags = [res1, res2].map((r) => JSON.parse(r.body).duplicate).sort();
  assert.deepEqual(duplicateFlags, [false, true], "exactly one of the two concurrent submissions must win");
  assert.equal(mock.docs.size, 3, "only one set of records was ever written");
});

test("a new eventId for the same lesson/section creates a genuinely new attempt record", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });

  const res1 = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ eventId: VALID_EVENT_1 })) });
  const res2 = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ eventId: VALID_EVENT_2 })) });

  assert.equal(JSON.parse(res1.body).duplicate, false);
  assert.equal(JSON.parse(res2.body).duplicate, false, "a genuinely new attempt must never be suppressed as a duplicate");
  assert.equal(mock.commitCalls.length, 2);
  // 2 processedEvents markers + 2 homePracticeLog entries + 1 shared summary
  // doc (same curriculumProgress doc, updated twice) = 5 distinct names.
  assert.equal(mock.docs.size, 5, "both attempts wrote their own marker and log entry");
});

test("malformed eventIds are rejected before any Firestore call", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });

  const badIds = ["short", "has a space", "has:colons:in:it", "has/slashes", "", null, 12345];
  for (const bad of badIds) {
    const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ eventId: bad })) });
    assert.equal(res.statusCode, 400, `expected 400 for malformed eventId ${JSON.stringify(bad)}`);
    const respBody = JSON.parse(res.body);
    assert.ok(respBody.fields.includes("eventId"));
  }
  assert.equal(mock.commitCalls.length, 0, "no Firestore write is ever attempted for a malformed eventId");
});

test("an oversized eventId is rejected", async () => {
  const mock = makeMockFirestore();
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });

  const oversized = "a".repeat(65); // one over the 64-char cap
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ eventId: oversized })) });
  assert.equal(res.statusCode, 400);
  assert.equal(mock.commitCalls.length, 0);
});

test("one profile cannot reuse another profile's eventId to affect their record (scoped by uid+profileId path, not eventId alone)", async () => {
  const mock = makeMockFirestore({ familyMembersExist: true });
  const { handler } = freshHandler({ verifyIdToken: fakeUidResolver("user-1"), firestoreFetch: mock.firestoreFetch });

  const resSelf = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ profileId: "self", eventId: VALID_EVENT_1 })) });
  const resChild = await handler({ httpMethod: "POST", body: JSON.stringify(validBody({ profileId: "child-1", eventId: VALID_EVENT_1 })) });

  assert.equal(JSON.parse(resSelf.body).duplicate, false);
  assert.equal(JSON.parse(resChild.body).duplicate, false, "the same eventId under a different profile path is a distinct record, not a duplicate");
  assert.equal(mock.docs.size, 6, "two fully separate sets of records, one per profile");
});

test("isValidEventId / validateEvent accept the real generateAttemptId() shape and reject malformed shapes", () => {
  const { validateEvent, isValidEventId } = require(RCP_PATH);
  assert.equal(isValidEventId("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isValidEventId("not valid!"), false);
  assert.equal(isValidEventId("a".repeat(65)), false);
  assert.equal(isValidEventId("short"), false);

  const errors = validateEvent({
    profileId: "self", curriculumId: "monkey-yoga-phonics", lessonId: "b2-h", section: "hear",
    completed: true, skillsPracticed: ["listening", "phonics"], confidenceSignal: "confident",
    eventId: "550e8400-e29b-41d4-a716-446655440000",
  });
  assert.deepEqual(errors, []);
});
