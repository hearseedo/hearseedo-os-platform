// Gate B Stage 4 — regression tests for live-transcript-classify.js's
// hardening: duplicate/replay chunk protection, partial-vs-final
// confusion, out-of-order classifier results (a slower older verdict must
// never overwrite a newer, higher-risk state), profile/session mismatch,
// and malformed-classifier-output-is-a-failure-not-NORMAL.
//
// No live Firebase/Gemini project is available in this environment (same
// constraint as record-curriculum-progress-idempotency.test.cjs) — both
// _firebaseAdmin's exports and the global fetch used for idToken
// verification / the Gemini classifier call are replaced with in-memory
// fakes before each fresh require of the handler.
//
// Run with: npm run test:functions

const test = require("node:test");
const assert = require("node:assert/strict");

const firebaseAdmin = require("../_firebaseAdmin.js");
const LTC_PATH = require.resolve("../live-transcript-classify.js");

const UID = "test-uid-123";
const SESSION_ID = "session-abc";

function docName(path) {
  return `projects/${firebaseAdmin.PROJECT_ID}/databases/(default)/documents${path}`;
}

// In-memory Firestore stand-in supporting exactly the operations
// live-transcript-classify.js performs: plain GET, the createIfAbsent
// dedupe write, and :commit with update+updateMask(+currentDocument
// precondition) for the compare-and-swap session-state write.
function makeMockFirestore(initialDocs = {}) {
  const docs = new Map(); // path -> { fields: {...}, updateTime: string }
  let updateCounter = 0;

  for (const [path, fields] of Object.entries(initialDocs)) {
    updateCounter += 1;
    docs.set(path, { fields, updateTime: `t${updateCounter}` });
  }

  function pathFromResourceName(name) {
    const marker = "/documents";
    const idx = name.indexOf(marker);
    return name.slice(idx + marker.length);
  }

  async function firestoreFetch(path, options = {}) {
    if (path === ":commit") {
      const body = JSON.parse(options.body);
      for (const w of body.writes) {
        const targetPath = pathFromResourceName(w.update.name);
        const existing = docs.get(targetPath);
        if (w.currentDocument?.updateTime && (!existing || existing.updateTime !== w.currentDocument.updateTime)) {
          return { ok: false, status: 409, json: async () => ({ error: { status: "FAILED_PRECONDITION" } }), text: async () => "precondition failed" };
        }
      }
      for (const w of body.writes) {
        const targetPath = pathFromResourceName(w.update.name);
        const existing = docs.get(targetPath) || { fields: {} };
        updateCounter += 1;
        docs.set(targetPath, { fields: { ...existing.fields, ...w.update.fields }, updateTime: `t${updateCounter}` });
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }

    // Plain GET
    const doc = docs.get(path);
    if (!doc) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ fields: doc.fields, updateTime: doc.updateTime }) };
  }

  const created = new Set();
  async function createIfAbsent(path, fields) {
    if (created.has(path)) return false;
    created.add(path);
    return true;
  }

  return { firestoreFetch, createIfAbsent, docs, pathFromResourceName };
}

function freshHandler({ firestoreFetch, createIfAbsent }) {
  firebaseAdmin.firestoreFetch = firestoreFetch;
  firebaseAdmin.createIfAbsent = createIfAbsent;
  delete require.cache[LTC_PATH];
  delete require.cache[require.resolve("../_safetyEngine.js")];
  return require(LTC_PATH);
}

function mockIdentityFetch(uid) {
  return async (url) => {
    if (String(url).includes("identitytoolkit")) {
      return { ok: true, json: async () => ({ users: [{ localId: uid }] }) };
    }
    throw new Error(`Unexpected global fetch call in test: ${url}`);
  };
}

function mockIdentityAndGeminiFetch(uid, classifierJsonText, { ok = true } = {}) {
  return async (url) => {
    const u = String(url);
    if (u.includes("identitytoolkit")) {
      return { ok: true, json: async () => ({ users: [{ localId: uid }] }) };
    }
    if (u.includes("generativelanguage")) {
      return {
        ok,
        status: ok ? 200 : 503,
        text: async () => classifierJsonText,
        json: async () => ({ candidates: [{ content: { parts: [{ text: classifierJsonText }] } }] }),
      };
    }
    throw new Error(`Unexpected global fetch call in test: ${u}`);
  };
}

function validClassificationJson(tier) {
  return JSON.stringify({ register: "personal", intent: "none", imminence: "none", tier, confidence: "high", reasoning: "test" });
}

let originalFetch;
test.beforeEach(() => { originalFetch = global.fetch; process.env.FIREBASE_API_KEY = "test-key"; process.env.GEMINI_API_KEY = "test-key"; });
test.afterEach(() => { global.fetch = originalFetch; });

// ── Basic auth / validation ─────────────────────────────────────────────

test("rejects a request missing sessionId/chunkId (400) before any network call", async () => {
  const mockFs = makeMockFirestore();
  const { handler } = freshHandler(mockFs);
  global.fetch = async () => { throw new Error("must not be called"); };
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "x" }) });
  assert.equal(res.statusCode, 400);
});

test("rejects an unverifiable idToken (401)", async () => {
  const mockFs = makeMockFirestore();
  const { handler } = freshHandler(mockFs);
  global.fetch = async () => ({ ok: false });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "bad", sessionId: SESSION_ID, chunkId: "c1" }) });
  assert.equal(res.statusCode, 401);
});

test("rejects a sessionId that doesn't exist under this uid (404)", async () => {
  const mockFs = makeMockFirestore();
  const { handler } = freshHandler(mockFs);
  global.fetch = mockIdentityFetch(UID);
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "ok", sessionId: "nope", chunkId: "c1" }) });
  assert.equal(res.statusCode, 404);
});

// ── Profile/session mismatch ────────────────────────────────────────────

test("rejects a profileId that doesn't match the session's own stored profileId (403)", async () => {
  const mockFs = makeMockFirestore({
    [`/users/${UID}/liveSessions/${SESSION_ID}`]: { profileId: { stringValue: "emma" } },
  });
  const { handler } = freshHandler(mockFs);
  global.fetch = mockIdentityFetch(UID);
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ idToken: "ok", sessionId: SESSION_ID, chunkId: "c1", profileId: "someone-else", text: "hi", isFinal: true }),
  });
  assert.equal(res.statusCode, 403);
});

test("allows a matching profileId (self on both sides, or an identical explicit id)", async () => {
  const mockFs = makeMockFirestore({
    [`/users/${UID}/liveSessions/${SESSION_ID}`]: { profileId: { nullValue: null } },
  });
  const { handler } = freshHandler(mockFs);
  global.fetch = mockIdentityAndGeminiFetch(UID, validClassificationJson("NORMAL"));
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ idToken: "ok", sessionId: SESSION_ID, chunkId: "c1", profileId: "self", text: "hello there", isFinal: true }),
  });
  assert.equal(res.statusCode, 200);
});

// ── Duplicate / replay protection ────────────────────────────────────────

test("a duplicate chunkId is never reclassified — returns duplicate:true without a second model call", async () => {
  const mockFs = makeMockFirestore({
    [`/users/${UID}/liveSessions/${SESSION_ID}`]: { profileId: { nullValue: null } },
  });
  let geminiCalls = 0;
  global.fetch = async (url) => {
    if (String(url).includes("identitytoolkit")) return { ok: true, json: async () => ({ users: [{ localId: UID }] }) };
    if (String(url).includes("generativelanguage")) {
      geminiCalls += 1;
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: validClassificationJson("NORMAL") }] } }] }) };
    }
    throw new Error("unexpected");
  };

  const { handler } = freshHandler(mockFs);
  const makeReq = () => ({ httpMethod: "POST", body: JSON.stringify({ idToken: "ok", sessionId: SESSION_ID, chunkId: "dup-1", profileId: "self", text: "hello", isFinal: true }) });

  const first = await handler(makeReq());
  assert.equal(first.statusCode, 200);
  assert.equal(geminiCalls, 1);

  const second = await handler(makeReq());
  assert.equal(second.statusCode, 200);
  assert.equal(JSON.parse(second.body).duplicate, true);
  assert.equal(geminiCalls, 1, "the duplicate must not trigger a second classification call");
});

// ── Partial vs final ─────────────────────────────────────────────────────

test("a non-final (partial) transcript chunk is acknowledged but never classified", async () => {
  const mockFs = makeMockFirestore({
    [`/users/${UID}/liveSessions/${SESSION_ID}`]: { profileId: { nullValue: null } },
  });
  let geminiCalls = 0;
  global.fetch = async (url) => {
    if (String(url).includes("identitytoolkit")) return { ok: true, json: async () => ({ users: [{ localId: UID }] }) };
    geminiCalls += 1;
    throw new Error("must not classify a partial chunk");
  };
  const { handler } = freshHandler(mockFs);
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "ok", sessionId: SESSION_ID, chunkId: "partial-1", profileId: "self", text: "I want to", isFinal: false }) });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).skipped, true);
  assert.equal(geminiCalls, 0);
});

// ── Session already ended ────────────────────────────────────────────────

test("a chunk for an already-ended session is skipped, never classified or written", async () => {
  const mockFs = makeMockFirestore({
    [`/users/${UID}/liveSessions/${SESSION_ID}`]: { profileId: { nullValue: null }, endedAt: { timestampValue: new Date().toISOString() } },
  });
  const { handler } = freshHandler(mockFs);
  global.fetch = mockIdentityFetch(UID);
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "ok", sessionId: SESSION_ID, chunkId: "c1", profileId: "self", text: "hello", isFinal: true }) });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).skipped, true);
});

// ── Malformed classifier output is a supervisor failure, never NORMAL ──────

test("malformed classifier JSON results in a supervisor-failure response, and the session's tier is never written to NORMAL because of it", async () => {
  const sessionPath = `/users/${UID}/liveSessions/${SESSION_ID}`;
  const mockFs = makeMockFirestore({
    [sessionPath]: { profileId: { nullValue: null }, safetyTier: { stringValue: "HIGH_RISK" } },
  });
  global.fetch = mockIdentityAndGeminiFetch(UID, "not valid json at all");
  const { handler } = freshHandler(mockFs);
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "ok", sessionId: SESSION_ID, chunkId: "c1", profileId: "self", text: "something", isFinal: true }) });
  assert.equal(res.statusCode, 502);
  assert.equal(JSON.parse(res.body).error, "supervisor_failure");
  // The sticky HIGH_RISK tier must be untouched by a failed classification.
  assert.equal(mockFs.docs.get(sessionPath).fields.safetyTier?.stringValue, "HIGH_RISK");
});

// ── Out-of-order verdicts: a slower older verdict must never overwrite a
//    newer, higher-risk state (the compare-and-swap write). ────────────────

test("a slow NORMAL verdict arriving after a fast IMMEDIATE_DANGER verdict does not downgrade the session", async () => {
  const sessionPath = `/users/${UID}/liveSessions/${SESSION_ID}`;
  const mockFs = makeMockFirestore({ [sessionPath]: { profileId: { nullValue: null } } });

  // First call: classify as IMMEDIATE_DANGER (simulates the FASTER, LATER
  // utterance's verdict landing first).
  global.fetch = mockIdentityAndGeminiFetch(UID, validClassificationJson("IMMEDIATE_DANGER"));
  const { handler } = freshHandler(mockFs);
  const first = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "ok", sessionId: SESSION_ID, chunkId: "chunk-2-fast", profileId: "self", text: "immediate danger text", isFinal: true }) });
  assert.equal(first.statusCode, 200);
  assert.equal(JSON.parse(first.body).tier, "IMMEDIATE_DANGER");

  // Second call: a SLOWER, EARLIER utterance's NORMAL verdict finally
  // arrives. Because of the sticky monotonic rule, this must never pull
  // the session back down to NORMAL.
  global.fetch = mockIdentityAndGeminiFetch(UID, validClassificationJson("NORMAL"));
  const second = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "ok", sessionId: SESSION_ID, chunkId: "chunk-1-slow", profileId: "self", text: "normal text", isFinal: true }) });
  assert.equal(second.statusCode, 200);
  assert.equal(JSON.parse(second.body).tier, "IMMEDIATE_DANGER", "the sticky tier must survive an out-of-order lower verdict");

  assert.equal(mockFs.docs.get(sessionPath).fields.safetyTier?.stringValue, "IMMEDIATE_DANGER");
});

test("escalating classification writes an interventionDirective matching the approved Stage 3 Revision action names", async () => {
  const sessionPath = `/users/${UID}/liveSessions/${SESSION_ID}`;
  const mockFs = makeMockFirestore({ [sessionPath]: { profileId: { nullValue: null } } });
  global.fetch = mockIdentityAndGeminiFetch(UID, validClassificationJson("IMMEDIATE_DANGER"));
  const { handler } = freshHandler(mockFs);
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "ok", sessionId: SESSION_ID, chunkId: "c1", profileId: "self", text: "danger", isFinal: true }) });
  assert.equal(res.statusCode, 200);
  const stored = mockFs.docs.get(sessionPath).fields;
  assert.equal(stored.interventionDirective?.mapValue?.fields?.action?.stringValue, "restricted_safety_pathway");
});
