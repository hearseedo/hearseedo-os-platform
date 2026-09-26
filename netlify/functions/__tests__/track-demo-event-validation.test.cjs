// Phase 3 — server-side validation tests for track-demo-event.js, run
// entirely locally with the network mocked (global.fetch replaced), so
// this exercises the REAL handler code path — not just the earlier
// client-side payload capture, which only proved what the CLIENT sends,
// not what the SERVER would accept or reject.
//
// A synthetic, throwaway RSA keypair is generated locally purely so the
// handler's own JWT-signing step (crypto.createSign(...).sign(privateKey))
// succeeds without a real service-account credential — this is not a real
// secret, never touches the network, and is discarded when the process
// exits.
//
// Run with: npm run test:functions

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const { privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
process.env.FIREBASE_SA_PRIVATE_KEY = privateKey;

const { handler, sanitizeMeta, VALID_EVENTS, VALID_PATHWAYS } = require("../track-demo-event.js");

// ── sanitizeMeta: field-specific validation, direct ─────────────────────

test("sanitizeMeta: drops an unknown field entirely, never stores/passes it through", () => {
  const result = sanitizeMeta({ notAnAllowedField: "some text", hasReason: true });
  assert.deepEqual(result, { hasReason: true });
  assert.ok(!("notAnAllowedField" in result));
});

test("sanitizeMeta: drops a boolean-shaped field given a non-boolean value", () => {
  const result = sanitizeMeta({ hasReason: "true" }); // string, not boolean
  assert.deepEqual(result, {});
});

test("sanitizeMeta: drops addedReason given a non-boolean (e.g. 1/0 instead of true/false)", () => {
  const result = sanitizeMeta({ addedReason: 1 });
  assert.deepEqual(result, {});
});

test("sanitizeMeta: drops an id-shaped field containing an arbitrary/unsafe string", () => {
  const result = sanitizeMeta({ promptId: "not a real learner id; DROP TABLE users;--" });
  assert.deepEqual(result, {});
});

test("sanitizeMeta: drops an id-shaped field that's an arbitrary long free-text string within the old 64-char limit", () => {
  const result = sanitizeMeta({ target: "the visitor typed a whole sentence here instead of an id" });
  assert.deepEqual(result, {});
});

test("sanitizeMeta: accepts a genuinely safe id-shaped string", () => {
  const result = sanitizeMeta({ promptId: "learner-a" });
  assert.deepEqual(result, { promptId: "learner-a" });
});

test("sanitizeMeta: drops pathwayId if it isn't one of the real four pathways", () => {
  const result = sanitizeMeta({ pathwayId: "attacker-supplied-pathway" });
  assert.deepEqual(result, {});
});

test("sanitizeMeta: drops questionsCompleted given a non-integer, negative, or absurdly large number", () => {
  assert.deepEqual(sanitizeMeta({ questionsCompleted: 1.5 }), {});
  assert.deepEqual(sanitizeMeta({ questionsCompleted: -1 }), {});
  assert.deepEqual(sanitizeMeta({ questionsCompleted: 999999 }), {});
});

test("sanitizeMeta: accepts a genuinely valid questionsCompleted", () => {
  assert.deepEqual(sanitizeMeta({ questionsCompleted: 2 }), { questionsCompleted: 2 });
});

test("sanitizeMeta: wrong top-level type (string, number, array) yields empty object, never throws", () => {
  assert.deepEqual(sanitizeMeta("a string"), {});
  assert.deepEqual(sanitizeMeta(42), {});
  assert.deepEqual(sanitizeMeta(["array", "of", "strings"]), {});
  assert.deepEqual(sanitizeMeta(null), {});
  assert.deepEqual(sanitizeMeta(undefined), {});
});

test("sanitizeMeta: a mix of valid and invalid fields keeps only the valid ones", () => {
  const result = sanitizeMeta({
    hasReason: true,
    promptId: "bad id with spaces!!",
    questionsCompleted: 3,
    unknownField: "whatever",
  });
  assert.deepEqual(result, { hasReason: true, questionsCompleted: 3 });
});

// ── Full handler, network mocked: confirm invalid TOP-LEVEL fields never
// reach the mocked Firestore write, and confirm arbitrary/invalid meta is
// simply never part of the write payload regardless of validity ─────────

test("handler: rejects an unrecognized event (400) before any network call", async () => {
  const calls = [];
  global.fetch = async (url, opts) => { calls.push({ url, body: opts?.body }); return { ok: true, json: async () => ({}) }; };
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ event: "not_a_real_event" }) });
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0, "must not make any network call for a rejected event name");
});

test("handler: rejects event as a non-string (wrong type) with 400, no network call", async () => {
  const calls = [];
  global.fetch = async (url, opts) => { calls.push({ url, body: opts?.body }); return { ok: true, json: async () => ({}) }; };
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ event: 12345 }) });
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("handler: rejects an invalid/unknown pathwayId with 400, no network call", async () => {
  const calls = [];
  global.fetch = async (url, opts) => { calls.push({ url, body: opts?.body }); return { ok: true, json: async () => ({}) }; };
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ event: "eco_demo_entry", pathwayId: "not-a-real-pathway" }) });
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("handler: full request/response cycle — captures the exact Firestore commit body and confirms it contains no meta, no free text, ever", async () => {
  const capturedCalls = [];
  global.fetch = async (url, opts) => {
    capturedCalls.push({ url, body: opts?.body });
    if (url.includes("oauth2.googleapis.com")) {
      return { ok: true, json: async () => ({ access_token: "fake-token-for-local-test-only" }) };
    }
    return { ok: true, text: async () => "{}" };
  };

  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({
      event: "adults_task_completed",
      pathwayId: "adult",
      meta: {
        // Simulates an attacker or a bug accidentally including the
        // visitor's actual typed order text in the payload.
        typedOrderText: "SYNTHETIC_SECRET_SERVER_TEST_XY77 a small coffee to go",
        hasReason: true,
      },
    }),
  });

  assert.equal(res.statusCode, 200);
  const commitCall = capturedCalls.find((c) => c.url.includes("firestore.googleapis.com"));
  assert.ok(commitCall, "expected a Firestore commit call");
  assert.ok(!commitCall.body.includes("SYNTHETIC_SECRET_SERVER_TEST_XY77"), "the synthetic secret text must never appear in the Firestore write body");
  assert.ok(!commitCall.body.includes("typedOrderText"), "no meta field name appears in the Firestore write body");
  assert.ok(!commitCall.body.includes("meta"), "the word 'meta' itself never appears — meta is not written at all, confirming it's discarded server-side as designed");
});

test("handler: OPTIONS/GET are handled without any network call", async () => {
  const calls = [];
  global.fetch = async (url) => { calls.push(url); return { ok: true, json: async () => ({}) }; };
  const optionsRes = await handler({ httpMethod: "OPTIONS" });
  assert.equal(optionsRes.statusCode, 204);
  const getRes = await handler({ httpMethod: "GET" });
  assert.equal(getRes.statusCode, 405);
  assert.equal(calls.length, 0);
});

test("VALID_EVENTS and VALID_PATHWAYS are non-empty, real allowlists (sanity check that exports work)", () => {
  assert.ok(VALID_EVENTS.size > 0);
  assert.ok(VALID_PATHWAYS.has("student"));
  assert.ok(!VALID_PATHWAYS.has("attacker-supplied-pathway"));
});
