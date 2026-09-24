// P0 — safety TTS exemption. Unit tests for
// netlify/functions/_safetyTtsGrant.js covering the explicit distinction
// required: a verified safety reply's audio may bypass the normal TTS
// rate cap, but this must never become a general bypass — no replay, no
// cross-account use, no effect on an ordinary (non-safety) request.
// Run with:
//   node --test tests/safety-tts-grant.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { consumeSafetyGrant } from "../netlify/functions/_safetyTtsGrant.js";

// Fake Firestore keyed by path, mirroring tests/profile-context.test.js's
// pattern — lets tests assert exactly which paths were touched and how.
function makeFakeFirestore(initialDocs = {}) {
  const docs = { ...initialDocs };
  const calls = [];
  const fetcher = async (path, options) => {
    calls.push({ path, method: options?.method ?? "GET" });
    const basePath = path.split("?")[0];
    if (!options || !options.method) {
      // GET
      if (!(basePath in docs)) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, json: async () => ({ fields: docs[basePath] }) };
    }
    // PATCH — merge the used field, simulating updateMask semantics
    const body = JSON.parse(options.body);
    docs[basePath] = { ...(docs[basePath] ?? {}), ...body.fields };
    return { ok: true, json: async () => ({ fields: docs[basePath] }) };
  };
  fetcher.calls = calls;
  fetcher.docs = docs;
  return fetcher;
}

const VALID_TOKEN = "a".repeat(32); // matches the /^[a-f0-9]{32}$/ shape chat.js's crypto.randomBytes(16).toString("hex") produces

test("a real, unused grant for this uid is consumed and returns true", async () => {
  const fetch = makeFakeFirestore({
    [`/users/uid-emma/safetyTtsGrants/${VALID_TOKEN}`]: { used: { booleanValue: false } },
  });
  const ok = await consumeSafetyGrant(fetch, "uid-emma", VALID_TOKEN);
  assert.equal(ok, true);
  // Confirms it's actually marked used, not just read.
  assert.equal(fetch.docs[`/users/uid-emma/safetyTtsGrants/${VALID_TOKEN}`].used.booleanValue, true);
});

test("REPLAY: the same token cannot be consumed twice", async () => {
  const fetch = makeFakeFirestore({
    [`/users/uid-emma/safetyTtsGrants/${VALID_TOKEN}`]: { used: { booleanValue: false } },
  });
  const first  = await consumeSafetyGrant(fetch, "uid-emma", VALID_TOKEN);
  const second = await consumeSafetyGrant(fetch, "uid-emma", VALID_TOKEN);
  assert.equal(first, true);
  assert.equal(second, false); // already used — fails closed, no second bypass
});

test("CROSS-ACCOUNT: a token that belongs to a different uid's path cannot be consumed by claiming a different uid", async () => {
  const fetch = makeFakeFirestore({
    [`/users/uid-victim/safetyTtsGrants/${VALID_TOKEN}`]: { used: { booleanValue: false } },
    // uid-attacker has no such grant — this is what actually happens when
    // an attacker who intercepted/guessed a token tries to use it under
    // their own uid; the path is constructed from THEIR uid, never reaches
    // the victim's document.
  });
  const ok = await consumeSafetyGrant(fetch, "uid-attacker", VALID_TOKEN);
  assert.equal(ok, false);
  assert.deepEqual(fetch.calls.map(c => c.path.split("?")[0]), [`/users/uid-attacker/safetyTtsGrants/${VALID_TOKEN}`]);
});

test("ORDINARY REQUEST: no token at all never bypasses anything", async () => {
  const fetch = makeFakeFirestore({});
  const ok = await consumeSafetyGrant(fetch, "uid-x", undefined);
  assert.equal(ok, false);
  assert.equal(fetch.calls.length, 0); // never even attempts a lookup — no wasted read for the common case
});

test("ORDINARY REQUEST: a client asserting an arbitrary/guessed token fails closed", async () => {
  const fetch = makeFakeFirestore({});
  const ok = await consumeSafetyGrant(fetch, "uid-x", "deadbeef".repeat(4));
  assert.equal(ok, false);
});

test("a malformed token (wrong shape) is rejected before any Firestore call", async () => {
  const fetch = makeFakeFirestore({});
  const ok = await consumeSafetyGrant(fetch, "uid-x", "not-a-real-token; DROP TABLE");
  assert.equal(ok, false);
  assert.equal(fetch.calls.length, 0);
});

test("a grant document that fails to load (network error) fails closed, never throws", async () => {
  const throwingFetch = async () => { throw new Error("boom"); };
  const ok = await consumeSafetyGrant(throwingFetch, "uid-x", VALID_TOKEN);
  assert.equal(ok, false);
});

test("missing uid never consumes a grant even with a valid-shaped token", async () => {
  const fetch = makeFakeFirestore({
    [`/users//safetyTtsGrants/${VALID_TOKEN}`]: { used: { booleanValue: false } },
  });
  const ok = await consumeSafetyGrant(fetch, undefined, VALID_TOKEN);
  assert.equal(ok, false);
  assert.equal(fetch.calls.length, 0);
});
