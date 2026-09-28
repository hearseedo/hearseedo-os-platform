// Containment patch (2026-09-27) — Ask Jona (chat.js) and Talk with Jona
// (live-token.js) are paused for everyone except an explicit adult-tester
// allowlist using their own "self" profile, while the Gemini Developer
// API's child-directed-use eligibility question (Blocker A) is unresolved.
// See netlify/functions/_approvedJonaTesters.js and
// docs/JONA_LIVE_SAFETY_GATE_B_STAGE2_PLAN_REV2_2026-09-26.md.
//
// This file covers THREE layers, and does not reuse or trust any prior
// commit's test results as current verification — every case here is
// re-derived and re-run against the code as it exists now:
//   1. The pure decision logic (isApprovedAdultTesterProfile) directly.
//   2. chat.js and live-token.js's own auth-rejection shape (missing/
//      invalid idToken -> rejected before any further check).
//   3. NEW: the actual handlers exercised end-to-end with every external
//      call (OAuth token exchange, Identity Toolkit, Firestore, the real
//      Gemini generateContent call, and the @google/genai SDK's
//      authTokens.create) mocked at the network/module boundary — no real
//      network call, no real credential, no real model call anywhere in
//      this file. This proves an approved tester's self profile actually
//      reaches the provider call (mocked to succeed), and that every
//      rejected case makes ZERO provider calls, not just that it returns
//      the right status code.
//
// Run with: npm run test:functions

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

// A throwaway RSA keypair generated fresh for this test run only — never a
// real credential. It only needs to be a syntactically valid RSA key so
// _firebaseAdmin.js's crypto.createSign(...).sign(privateKey) succeeds
// locally; the resulting JWT is never actually verified by anyone, because
// the OAuth token-exchange fetch itself is mocked below to always succeed
// regardless of the JWT's content.
const { privateKey: FAKE_SA_PRIVATE_KEY } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
process.env.FIREBASE_SA_PRIVATE_KEY = FAKE_SA_PRIVATE_KEY;
process.env.GEMINI_API_KEY = "test-key-not-real-never-sent-anywhere";
process.env.FIREBASE_API_KEY = "test-key-not-real-never-sent-anywhere";

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
  assert.equal(isApprovedAdultTesterProfile({ email: "attacker@example.com", profileId: "self" }), false);
});

// ── Handler-level auth-rejection shape (unchanged pattern) ──────────────

test("chat.js: rejects a request with no idToken (401), before reaching the containment check or any model call", async () => {
  const { handler } = require("../chat.js");
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ messages: [{ role: "user", text: "hi" }], profileId: "self" }),
  });
  assert.equal(res.statusCode, 401);
});

test("live-token.js: rejects a request with no idToken (401), before reaching the containment check", async () => {
  const { handler } = require("../live-token.js");
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ profileId: "self" }) });
  assert.equal(res.statusCode, 401);
});

// ── Full mocked-network handler exercises ───────────────────────────────
// Mocks every external call chat.js/live-token.js can reach: OAuth token
// exchange, Identity Toolkit, Firestore REST, the real Gemini
// generateContent endpoint, and (for live-token.js) the @google/genai SDK's
// authTokens.create. Nothing here reaches a real network endpoint.

const APPROVED_EMAIL = APPROVED_ADULT_TESTERS[0];

function installMockFetch({ identityUsers, geminiCalls }) {
  const original = global.fetch;
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "fake-access-token", expires_in: 3600 }) };
    }
    if (u.includes("identitytoolkit.googleapis.com")) {
      let idToken = null;
      try { idToken = JSON.parse(opts.body || "{}").idToken; } catch {}
      const user = identityUsers[idToken];
      return { ok: true, status: 200, json: async () => ({ users: user ? [user] : [] }) };
    }
    if (u.includes("generativelanguage.googleapis.com")) {
      geminiCalls.push(u);
      return {
        ok: true, status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "Mocked Jona reply — never a real model call." }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 6 },
        }),
      };
    }
    if (u.includes(":commit")) {
      return { ok: true, status: 200, json: async () => ({}) };
    }
    if (u.includes("firestore.googleapis.com")) {
      // Generic "document not found" — every reader in this codebase
      // already fails open to a safe default (free plan, count 0, no
      // active lock, DEFAULTS policy) on a 404, per its own comments.
      return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
  };
  return () => { global.fetch = original; };
}

function installFakeGoogleGenAI(mintCalls) {
  const resolved = require.resolve("@google/genai");
  const original = require.cache[resolved];
  class FakeGoogleGenAI {
    constructor(opts) { this.opts = opts; }
    get authTokens() {
      return {
        create: async (args) => {
          mintCalls.push(args);
          return { name: "auth_tokens/fake-token-for-tests-only" };
        },
      };
    }
  }
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { GoogleGenAI: FakeGoogleGenAI } };
  return () => {
    if (original) require.cache[resolved] = original;
    else delete require.cache[resolved];
  };
}

function freshHandler(modPath) {
  const resolved = require.resolve(modPath);
  delete require.cache[resolved];
  return require(modPath).handler;
}

// ── chat.js (Ask Jona) ───────────────────────────────────────────────────

test("chat.js: approved tester, self profile -> reaches and succeeds against the (mocked) Gemini call", async () => {
  const geminiCalls = [];
  const restoreFetch = installMockFetch({
    identityUsers: { "tok-approved-self": { localId: "uid-approved-1", email: APPROVED_EMAIL } },
    geminiCalls,
  });
  try {
    const handler = freshHandler("../chat.js");
    const res = await handler({
      httpMethod: "POST",
      body: JSON.stringify({ messages: [{ role: "user", text: "What is a synonym for happy?" }], idToken: "tok-approved-self", profileId: "self" }),
    });
    assert.equal(res.statusCode, 200);
    assert.equal(geminiCalls.length, 1, "expected exactly one (mocked) Gemini call for an approved self-profile caller");
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.content, "Mocked Jona reply — never a real model call.");
  } finally {
    restoreFetch();
  }
});

test("chat.js: non-approved account -> denied (503), ZERO Gemini calls", async () => {
  const geminiCalls = [];
  const restoreFetch = installMockFetch({
    identityUsers: { "tok-random-parent": { localId: "uid-random-1", email: "random-parent@example.com" } },
    geminiCalls,
  });
  try {
    const handler = freshHandler("../chat.js");
    const res = await handler({
      httpMethod: "POST",
      body: JSON.stringify({ messages: [{ role: "user", text: "hi" }], idToken: "tok-random-parent", profileId: "self" }),
    });
    assert.equal(res.statusCode, 503);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.error, "jona_paused");
    assert.ok(!/ask jona/i.test(parsed.message), "denial message must not point to Ask Jona as a workaround");
    assert.equal(geminiCalls.length, 0, "a denied caller must never reach the model");
  } finally {
    restoreFetch();
  }
});

test("chat.js: approved account, but a non-self (child/family-member) profileId -> denied (503), ZERO Gemini calls", async () => {
  const geminiCalls = [];
  const restoreFetch = installMockFetch({
    identityUsers: { "tok-approved-child": { localId: "uid-approved-1", email: APPROVED_EMAIL } },
    geminiCalls,
  });
  try {
    const handler = freshHandler("../chat.js");
    const res = await handler({
      httpMethod: "POST",
      body: JSON.stringify({ messages: [{ role: "user", text: "hi" }], idToken: "tok-approved-child", profileId: "child-profile-abc123" }),
    });
    assert.equal(res.statusCode, 503);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.error, "jona_paused");
    assert.equal(geminiCalls.length, 0, "an approved account's child/family-member profile must never reach the model — this is the exact gap containment closes");
  } finally {
    restoreFetch();
  }
});

// ── live-token.js (Talk with Jona) ───────────────────────────────────────

test("live-token.js: approved tester, self profile -> reaches and succeeds against the (mocked) authTokens.create", async () => {
  const mintCalls = [];
  const restoreFetch = installMockFetch({
    identityUsers: { "tok-approved-self-live": { localId: "uid-approved-2", email: APPROVED_EMAIL } },
    geminiCalls: [],
  });
  const restoreGenAI = installFakeGoogleGenAI(mintCalls);
  try {
    const handler = freshHandler("../live-token.js");
    const res = await handler({
      httpMethod: "POST",
      body: JSON.stringify({ idToken: "tok-approved-self-live", profileId: "self", pathway: "family", appName: "test", lesson: "test" }),
    });
    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}: ${res.body}`);
    assert.equal(mintCalls.length, 1, "expected exactly one (mocked) authTokens.create call for an approved self-profile caller");
    const parsed = JSON.parse(res.body);
    assert.ok(parsed.token, "expected a minted token field in the response");
  } finally {
    restoreFetch();
    restoreGenAI();
  }
});

test("live-token.js: non-approved account -> denied (403), ZERO authTokens.create calls", async () => {
  const mintCalls = [];
  const restoreFetch = installMockFetch({
    identityUsers: { "tok-random-live": { localId: "uid-random-2", email: "random-parent@example.com" } },
    geminiCalls: [],
  });
  const restoreGenAI = installFakeGoogleGenAI(mintCalls);
  try {
    const handler = freshHandler("../live-token.js");
    const res = await handler({
      httpMethod: "POST",
      body: JSON.stringify({ idToken: "tok-random-live", profileId: "self" }),
    });
    assert.equal(res.statusCode, 403);
    const parsed = JSON.parse(res.body);
    assert.ok(!/ask jona/i.test(parsed.error), "restricted Live must not suggest Ask Jona as an available workaround");
    assert.equal(mintCalls.length, 0, "a denied caller must never mint a credential");
  } finally {
    restoreFetch();
    restoreGenAI();
  }
});

test("live-token.js: approved account, but a non-self (child/family-member) profileId -> denied (403), ZERO authTokens.create calls", async () => {
  const mintCalls = [];
  const restoreFetch = installMockFetch({
    identityUsers: { "tok-approved-child-live": { localId: "uid-approved-2", email: APPROVED_EMAIL } },
    geminiCalls: [],
  });
  const restoreGenAI = installFakeGoogleGenAI(mintCalls);
  try {
    const handler = freshHandler("../live-token.js");
    const res = await handler({
      httpMethod: "POST",
      body: JSON.stringify({ idToken: "tok-approved-child-live", profileId: "child-profile-xyz789" }),
    });
    assert.equal(res.statusCode, 403);
    const parsed = JSON.parse(res.body);
    assert.ok(!/ask jona/i.test(parsed.error), "restricted Live must not suggest Ask Jona as an available workaround");
    assert.equal(mintCalls.length, 0, "an approved account's child/family-member profile must never mint a Live credential — this is the exact gap containment closes");
  } finally {
    restoreFetch();
    restoreGenAI();
  }
});
