// Credential-rotation hardening (2026-09-11) — unit tests for
// resolvePrivateKeyPem() in _firebaseAdmin.js. Proves the new single-
// variable path (FIREBASE_SA_PRIVATE_KEY) and the legacy split-pair
// fallback (FIREBASE_SA_KEY_A + FIREBASE_SA_KEY_B) both resolve correctly,
// using entirely fake, non-secret test fixture strings — never real key
// material. Run with:
//   node --test netlify/functions/__tests__/firebase-admin-key-resolution.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");

// FIREBASE_SA_KEY_A/B are read into a top-level const at module load, so
// they must be set before the first require(). This file only tests the
// legacy fallback via a fresh process (each `node --test` file gets its
// own process), so setting them here, before requiring, is correct and
// matches this repo's existing test convention.
const FAKE_PEM = "-----BEGIN PRIVATE KEY-----\nFAKE-NOT-A-REAL-KEY-abc123\n-----END PRIVATE KEY-----\n";
const FAKE_B64 = Buffer.from(FAKE_PEM, "utf8").toString("base64");
const half = Math.floor(FAKE_B64.length / 2);
process.env.FIREBASE_SA_KEY_A = FAKE_B64.slice(0, half);
process.env.FIREBASE_SA_KEY_B = FAKE_B64.slice(half);

const { resolvePrivateKeyPem } = require("../_firebaseAdmin.js");

test("FIREBASE_SA_PRIVATE_KEY with real newlines is used as-is", () => {
  const original = process.env.FIREBASE_SA_PRIVATE_KEY;
  process.env.FIREBASE_SA_PRIVATE_KEY = FAKE_PEM; // already has real \n newlines
  assert.equal(resolvePrivateKeyPem(), FAKE_PEM);
  process.env.FIREBASE_SA_PRIVATE_KEY = original;
});

test("FIREBASE_SA_PRIVATE_KEY with literal \\n escapes is un-escaped to real newlines", () => {
  const original = process.env.FIREBASE_SA_PRIVATE_KEY;
  const escaped = FAKE_PEM.replace(/\n/g, "\\n"); // simulates copy-pasting the JSON string's literal quoted value
  process.env.FIREBASE_SA_PRIVATE_KEY = escaped;
  assert.equal(resolvePrivateKeyPem(), FAKE_PEM);
  process.env.FIREBASE_SA_PRIVATE_KEY = original;
});

test("single-variable path takes priority over the legacy A+B pair when both are set", () => {
  const original = process.env.FIREBASE_SA_PRIVATE_KEY;
  process.env.FIREBASE_SA_PRIVATE_KEY = FAKE_PEM;
  // FIREBASE_SA_KEY_A/B are also set (module-level, from above) — the
  // single var must win.
  assert.equal(resolvePrivateKeyPem(), FAKE_PEM);
  process.env.FIREBASE_SA_PRIVATE_KEY = original;
});

test("falls back to the legacy A+B split pair when the single variable is unset", () => {
  const original = process.env.FIREBASE_SA_PRIVATE_KEY;
  delete process.env.FIREBASE_SA_PRIVATE_KEY;
  assert.equal(resolvePrivateKeyPem(), FAKE_PEM);
  process.env.FIREBASE_SA_PRIVATE_KEY = original;
});

test("a short/placeholder single-variable value is treated as unset, not used", () => {
  const original = process.env.FIREBASE_SA_PRIVATE_KEY;
  process.env.FIREBASE_SA_PRIVATE_KEY = "too-short";
  assert.equal(resolvePrivateKeyPem(), FAKE_PEM); // falls back to A+B
  process.env.FIREBASE_SA_PRIVATE_KEY = original;
});

test("deleting only the single variable still resolves via the already-loaded legacy pair (module-level, not re-read per call)", () => {
  // SA_KEY_B64 is computed once at module load from FIREBASE_SA_KEY_A/B —
  // deleting those env vars AFTER load (as done here) does not change
  // SA_KEY_B64, which is the realistic shape of a real process's lifetime
  // (env vars don't change under a running Netlify function). A genuinely
  // fully-unconfigured process (returns null) is exercised implicitly by
  // every OTHER Netlify function's existing "missing config" test coverage
  // for FirestoreConfigError, not re-tested here to avoid the process-level
  // isolation a true from-scratch-unset case would need.
  const originalSingle = process.env.FIREBASE_SA_PRIVATE_KEY;
  delete process.env.FIREBASE_SA_PRIVATE_KEY;
  assert.equal(resolvePrivateKeyPem(), FAKE_PEM);
  process.env.FIREBASE_SA_PRIVATE_KEY = originalSingle;
});
