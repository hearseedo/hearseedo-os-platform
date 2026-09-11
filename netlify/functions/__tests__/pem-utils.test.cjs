// Credential-rotation hardening (2026-09-11) — unit tests for
// normalizePem() in _pemUtils.js. Covers a REAL production bug found
// while rotating FIREBASE_SA_PRIVATE_KEY: Netlify's environment-variable
// field stripped every newline from a pasted multi-line PEM, producing a
// value with the correct BEGIN/END markers and correct length but zero
// newline characters of any kind — which Node's crypto module rejected
// with "error:1E08010C:DECODER routines::unsupported". Uses entirely
// fake, non-secret test fixture strings. Run with:
//   node --test netlify/functions/__tests__/pem-utils.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizePem } = require("../_pemUtils.js");

const FAKE_BODY = "FAKENOTAREALKEYabc123DEFghi456";
const FAKE_PEM_WITH_NEWLINES = `-----BEGIN PRIVATE KEY-----\n${FAKE_BODY}\n-----END PRIVATE KEY-----\n`;

test("a PEM with real newlines already present is returned unchanged", () => {
  assert.equal(normalizePem(FAKE_PEM_WITH_NEWLINES), FAKE_PEM_WITH_NEWLINES);
});

test("literal \\n escape sequences (copied from a JSON string) are unescaped to real newlines", () => {
  const escaped = FAKE_PEM_WITH_NEWLINES.replace(/\n/g, "\\n");
  const result = normalizePem(escaped);
  assert.ok(result.includes("\n"));
  assert.ok(!result.includes("\\n"));
  assert.ok(result.startsWith("-----BEGIN PRIVATE KEY-----\n"));
  assert.ok(result.trim().endsWith("-----END PRIVATE KEY-----"));
});

test("REGRESSION: a PEM with every newline stripped entirely is repaired using the BEGIN/END markers", () => {
  // This is the exact real-world shape observed: Netlify's env var field
  // silently collapsed a multi-line paste into one continuous line.
  const flattened = `-----BEGIN PRIVATE KEY-----${FAKE_BODY}-----END PRIVATE KEY-----`;
  assert.equal(flattened.includes("\n"), false); // sanity: the input really has zero newlines
  const result = normalizePem(flattened);
  assert.ok(result.startsWith("-----BEGIN PRIVATE KEY-----\n"));
  assert.ok(result.includes(`\n${FAKE_BODY}`));
  assert.ok(result.endsWith("\n-----END PRIVATE KEY-----"));
  assert.equal((result.match(/\n/g) || []).length, 2); // exactly the two we reinserted
});

test("REGRESSION case also works for a differently-named PEM block (e.g. RSA PRIVATE KEY)", () => {
  const flattened = `-----BEGIN RSA PRIVATE KEY-----${FAKE_BODY}-----END RSA PRIVATE KEY-----`;
  const result = normalizePem(flattened);
  assert.ok(result.startsWith("-----BEGIN RSA PRIVATE KEY-----\n"));
  assert.ok(result.endsWith("\n-----END RSA PRIVATE KEY-----"));
});

test("a falsy/empty input passes through without throwing", () => {
  assert.equal(normalizePem(""), "");
  assert.equal(normalizePem(null), null);
  assert.equal(normalizePem(undefined), undefined);
});

test("a value with no newlines and no recognizable BEGIN/END markers is left alone (not a PEM at all — nothing safe to repair)", () => {
  const junk = "not-a-pem-value-at-all";
  assert.equal(normalizePem(junk), junk);
});
