// Gate B Stage 4V fix — tests for live-safety-timing.js (the missing
// client-side T4-T6 latency points). Metadata/timing only: confirms no
// transcript/reply text can ever be persisted through this endpoint,
// regardless of what a caller sends.
//
// Run with: npm run test:functions

const test = require("node:test");
const assert = require("node:assert/strict");

const firebaseAdmin = require("../_firebaseAdmin.js");
const HANDLER_PATH = require.resolve("../live-safety-timing.js");

const UID = "test-uid-timing";
const SESSION_ID = "session-timing-1";

function freshHandler(firestoreFetch) {
  firebaseAdmin.firestoreFetch = firestoreFetch;
  delete require.cache[HANDLER_PATH];
  return require(HANDLER_PATH);
}

function mockIdentityFetch(uid) {
  return async (url) => {
    if (String(url).includes("identitytoolkit")) return { ok: true, json: async () => ({ users: [{ localId: uid }] }) };
    throw new Error(`Unexpected global fetch call: ${url}`);
  };
}

let originalFetch;
test.beforeEach(() => { originalFetch = global.fetch; process.env.FIREBASE_API_KEY = "test-key"; });
test.afterEach(() => { global.fetch = originalFetch; });

test("rejects a request missing sessionId/eventId (400) before any network call", async () => {
  const { handler } = freshHandler(async () => { throw new Error("must not be called"); });
  global.fetch = async () => { throw new Error("must not be called"); };
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "x" }) });
  assert.equal(res.statusCode, 400);
});

test("rejects an unverifiable idToken (401)", async () => {
  const { handler } = freshHandler(async () => ({ ok: true, json: async () => ({}) }));
  global.fetch = async () => ({ ok: false });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "bad", sessionId: SESSION_ID, eventId: "e1", audioMutedAt: 123 }) });
  assert.equal(res.statusCode, 401);
});

test("rejects a sessionId that doesn't exist under this uid (404)", async () => {
  const { handler } = freshHandler(async () => ({ ok: false, status: 404, json: async () => ({}) }));
  global.fetch = mockIdentityFetch(UID);
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "ok", sessionId: "nope", eventId: "e1", audioMutedAt: 123 }) });
  assert.equal(res.statusCode, 404);
});

test("stores only the allowed finite-number timing fields, never arbitrary/text fields", async () => {
  let committedBody = null;
  const firestoreFetch = async (path, options = {}) => {
    if (path === `/users/${UID}/liveSessions/${SESSION_ID}`) return { ok: true, json: async () => ({ fields: {} }) };
    if (path.startsWith(`/users/${UID}/liveSessions/${SESSION_ID}/latencyLog/`)) {
      committedBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({}) };
    }
    throw new Error(`unexpected firestoreFetch path: ${path}`);
  };
  const { handler } = freshHandler(firestoreFetch);
  global.fetch = mockIdentityFetch(UID);
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({
      idToken: "ok", sessionId: SESSION_ID, eventId: "escalation-1",
      directiveReceivedAt: 1000, audioMutedAt: 1050, restrictedResponseBeginAt: 3000,
      transcriptText: "this must never be stored", reply: "neither must this",
    }),
  });
  assert.equal(res.statusCode, 200);
  assert.ok(committedBody, "expected a Firestore write to have happened");
  const fieldNames = Object.keys(committedBody.fields);
  assert.deepEqual(fieldNames.sort(), ["audioMutedAt", "directiveReceivedAt", "restrictedResponseBeginAt"]);
  assert.equal(committedBody.fields.audioMutedAt.integerValue, "1050");
  assert.ok(!("transcriptText" in committedBody.fields));
  assert.ok(!("reply" in committedBody.fields));
});

test("a non-finite/garbage timing value for a field is silently dropped, not stored", async () => {
  let committedBody = null;
  const firestoreFetch = async (path, options = {}) => {
    if (path === `/users/${UID}/liveSessions/${SESSION_ID}`) return { ok: true, json: async () => ({ fields: {} }) };
    committedBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({}) };
  };
  const { handler } = freshHandler(firestoreFetch);
  global.fetch = mockIdentityFetch(UID);
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ idToken: "ok", sessionId: SESSION_ID, eventId: "e2", audioMutedAt: "not-a-number", directiveReceivedAt: 500 }),
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(committedBody.fields), ["directiveReceivedAt"]);
});

test("no valid timing fields at all -> 400, no Firestore write attempted", async () => {
  const firestoreFetch = async (path) => {
    if (path === `/users/${UID}/liveSessions/${SESSION_ID}`) return { ok: true, json: async () => ({ fields: {} }) };
    throw new Error("must not write when nothing valid was given");
  };
  const { handler } = freshHandler(firestoreFetch);
  global.fetch = mockIdentityFetch(UID);
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "ok", sessionId: SESSION_ID, eventId: "e3" }) });
  assert.equal(res.statusCode, 400);
});
