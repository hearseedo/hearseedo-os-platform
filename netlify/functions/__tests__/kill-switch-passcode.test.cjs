// Staging-isolation hardening (2026-09-16) — regression tests for
// kill-switch.js's passcode handling. Before this fix, a missing
// SHUTDOWN_PASSCODE env var silently fell back to a hardcoded source-code
// value ("HSD-STOP-2026") — anyone who read the source (or this repo,
// being public/shared) could disable every AI endpoint on any deployment
// that hadn't set the real env var. There must be no built-in/default
// passcode anywhere. Uses only a fake, test-only passcode value — never
// any real one. Run with:
//   node --test netlify/functions/__tests__/kill-switch-passcode.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");

const HANDLER_PATH = require.resolve("../kill-switch.js");
const FAKE_PASSCODE = "test-only-fake-passcode-not-real";

function freshHandler() {
  delete require.cache[HANDLER_PATH];
  return require(HANDLER_PATH).handler;
}

test("with SHUTDOWN_PASSCODE unset, every request fails closed, regardless of what passcode is guessed", async () => {
  const original = process.env.SHUTDOWN_PASSCODE;
  delete process.env.SHUTDOWN_PASSCODE;
  try {
    const handler = freshHandler();
    const res = await handler({
      httpMethod: "POST",
      body: JSON.stringify({ action: "status", passcode: FAKE_PASSCODE }),
    });
    assert.equal(res.statusCode, 503);
    assert.equal(JSON.parse(res.body).error, "Server not configured");
  } finally {
    if (original === undefined) delete process.env.SHUTDOWN_PASSCODE; else process.env.SHUTDOWN_PASSCODE = original;
  }
});

test("with SHUTDOWN_PASSCODE unset, an empty-string passcode attempt also fails closed", async () => {
  const original = process.env.SHUTDOWN_PASSCODE;
  delete process.env.SHUTDOWN_PASSCODE;
  try {
    const handler = freshHandler();
    const res = await handler({ httpMethod: "POST", body: JSON.stringify({ action: "status", passcode: "" }) });
    assert.equal(res.statusCode, 503);
  } finally {
    if (original === undefined) delete process.env.SHUTDOWN_PASSCODE; else process.env.SHUTDOWN_PASSCODE = original;
  }
});

test("no hardcoded passcode is present anywhere in the source file", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(require.resolve("../kill-switch.js"), "utf8");
  const assignment = src.match(/PASSCODE\s*=[^;]*/)?.[0] ?? "";
  assert.ok(!/\|\|\s*["'][A-Za-z0-9-]+["']/.test(assignment), "PASSCODE must not have a string-literal fallback");
  assert.match(assignment, /\|\|\s*null/, "PASSCODE must fall back to null, never a literal value, when unset");
});

test("with SHUTDOWN_PASSCODE configured, a wrong passcode is still rejected (403), not treated as a config error", async () => {
  const original = process.env.SHUTDOWN_PASSCODE;
  process.env.SHUTDOWN_PASSCODE = FAKE_PASSCODE;
  try {
    const handler = freshHandler();
    const res = await handler({ httpMethod: "POST", body: JSON.stringify({ action: "status", passcode: "wrong-guess" }) });
    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).error, "Invalid passcode");
  } finally {
    if (original === undefined) delete process.env.SHUTDOWN_PASSCODE; else process.env.SHUTDOWN_PASSCODE = original;
  }
});

test("with SHUTDOWN_PASSCODE configured, the correct passcode is accepted and reaches the Firestore call (status action)", async () => {
  const original = process.env.SHUTDOWN_PASSCODE;
  process.env.SHUTDOWN_PASSCODE = FAKE_PASSCODE;
  const firebaseAdmin = require("../_firebaseAdmin.js");
  const originalFetch = firebaseAdmin.firestoreFetch;
  firebaseAdmin.firestoreFetch = async () => ({ status: 404 });
  try {
    const handler = freshHandler();
    const res = await handler({ httpMethod: "POST", body: JSON.stringify({ action: "status", passcode: FAKE_PASSCODE }) });
    assert.equal(res.statusCode, 200, "the correct passcode must not be rejected");
  } finally {
    firebaseAdmin.firestoreFetch = originalFetch;
    if (original === undefined) delete process.env.SHUTDOWN_PASSCODE; else process.env.SHUTDOWN_PASSCODE = original;
  }
});

test("no credential/passcode value ever appears in an error response body", async () => {
  const original = process.env.SHUTDOWN_PASSCODE;
  delete process.env.SHUTDOWN_PASSCODE;
  try {
    const handler = freshHandler();
    const res = await handler({ httpMethod: "POST", body: JSON.stringify({ action: "status", passcode: "anything" }) });
    assert.ok(!res.body.includes("HSD-STOP-2026"));
    assert.ok(!res.body.toLowerCase().includes("passcode is"), "the response should not restate configuration detail");
  } finally {
    if (original === undefined) delete process.env.SHUTDOWN_PASSCODE; else process.env.SHUTDOWN_PASSCODE = original;
  }
});
