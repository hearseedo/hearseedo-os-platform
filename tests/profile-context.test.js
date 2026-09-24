// P0 — Jona profile identity. Unit tests for netlify/functions/_profileContext.js
// covering the directive's specific attack list (substitute another
// profile ID, access another household's profile, invalid/missing
// profileId) using a fake firestoreFetch — no real network/emulator needed.
//
// Fail-closed distinction (2026-09-24 hardening): "no profileId supplied"
// (self/legacy) and "an explicit profileId was supplied but is invalid"
// are different cases with different outcomes — see resolveProfileContext's
// return shape ({ ok: true, profile } vs { ok: false, reason }).
//
// Run with:
//   node --test tests/profile-context.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { resolveProfileContext, buildProfileContextLine } from "../netlify/functions/_profileContext.js";

// Minimal fake mirroring _firebaseAdmin.js's fromFirestoreFields shape
// closely enough for these tests (real one handles more types; not needed here).
function fromFirestoreFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    if ("stringValue" in v) obj[k] = v.stringValue;
    else if ("integerValue" in v) obj[k] = parseInt(v.integerValue, 10);
    else if ("doubleValue" in v) obj[k] = v.doubleValue;
  }
  return obj;
}

// A fake Firestore "database" keyed by path, so tests can assert exactly
// which paths get requested and control what each one returns — this is
// what lets us simulate "profile exists under a DIFFERENT uid" without a
// real emulator: that path is simply never in this fake DB, exactly what a
// real cross-account lookup would also find (a 404, structurally, since the
// path is always nested under the CALLER's own verified uid).
function makeFakeFetch(db) {
  const calls = [];
  const fetcher = async (path) => {
    calls.push(path);
    if (path in db) {
      return { ok: true, json: async () => ({ fields: db[path] }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  fetcher.calls = calls;
  return fetcher;
}

function field(v) {
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  throw new Error("unsupported");
}

test("self profile (no profileId) resolves ok:true with the account's own doc", async () => {
  const db = { "/users/uid-jonathan": { name: field("Jonathan"), confidenceScore: field(80) } };
  const fetch = makeFakeFetch(db);
  const result = await resolveProfileContext(fetch, fromFirestoreFields, "uid-jonathan", undefined);
  assert.equal(result.ok, true);
  assert.equal(result.profile.name, "Jonathan");
  assert.equal(result.profile.isSelf, true);
  assert.deepEqual(fetch.calls, ["/users/uid-jonathan"]);
});

test("explicit 'self' profileId behaves identically to omitted", async () => {
  const db = { "/users/uid-jonathan": { name: field("Jonathan") } };
  const fetch = makeFakeFetch(db);
  const result = await resolveProfileContext(fetch, fromFirestoreFields, "uid-jonathan", "self");
  assert.equal(result.ok, true);
  assert.equal(result.profile.name, "Jonathan");
});

test("a real family-member profileId resolves ok:true with that member's own doc, nested under the caller's uid", async () => {
  const db = {
    "/users/uid-waltho/familyMembers/emma-id": { name: field("Emma"), age: field(9), confidenceScore: field(65) },
  };
  const fetch = makeFakeFetch(db);
  const result = await resolveProfileContext(fetch, fromFirestoreFields, "uid-waltho", "emma-id");
  assert.equal(result.ok, true);
  assert.equal(result.profile.name, "Emma");
  assert.equal(result.profile.age, 9);
  assert.equal(result.profile.isSelf, false);
  assert.deepEqual(fetch.calls, ["/users/uid-waltho/familyMembers/emma-id"]);
});

// ── Fail-closed cases (2026-09-24 hardening) ───────────────────────────────

test("FAIL CLOSED: an explicit profileId that doesn't exist under this account returns ok:false, never falls back to self", async () => {
  const db = {
    "/users/uid-waltho": { name: field("Jonathan") },
    "/users/uid-waltho/familyMembers/emma-id": { name: field("Emma") },
    // "miley-id" deliberately absent — simulates a guessed/substituted/deleted id
  };
  const fetch = makeFakeFetch(db);
  const result = await resolveProfileContext(fetch, fromFirestoreFields, "uid-waltho", "miley-id");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "profile_not_found");
  assert.equal(result.profile, undefined); // no profile data leaks out on failure
  // Never queried self as a fallback — a mismatch fails closed, not silently.
  assert.deepEqual(fetch.calls, ["/users/uid-waltho/familyMembers/miley-id"]);
});

test("FAIL CLOSED: another household's real memberId still fails closed (structurally unreachable, and never falls back to self either)", async () => {
  const db = {
    "/users/uid-attacker": { name: field("Attacker") },
    "/users/uid-victim/familyMembers/victim-child-id": { name: field("Victim Child"), confidenceScore: field(40) },
  };
  const fetch = makeFakeFetch(db);
  const result = await resolveProfileContext(fetch, fromFirestoreFields, "uid-attacker", "victim-child-id");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "profile_not_found");
  // Confirms the query never even reached the victim's path — it was
  // constructed under uid-attacker throughout, not uid-victim — and it did
  // NOT quietly succeed as "Attacker" either; the caller must reject this.
  assert.ok(fetch.calls.every(p => p.startsWith("/users/uid-attacker")));
});

test("FAIL CLOSED: a lookup that throws (network error) for an explicit profileId also fails closed, not to self", async () => {
  const throwingFetch = async () => { throw new Error("boom"); };
  const result = await resolveProfileContext(throwingFetch, fromFirestoreFields, "uid-x", "some-member");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "profile_lookup_failed");
});

test("missing/empty profileId is NOT a failure — behaves exactly like 'self' (ok:true)", async () => {
  const db = { "/users/uid-x": { name: field("X") } };
  const fetch = makeFakeFetch(db);
  const a = await resolveProfileContext(fetch, fromFirestoreFields, "uid-x", "");
  const b = await resolveProfileContext(fetch, fromFirestoreFields, "uid-x", null);
  const c = await resolveProfileContext(fetch, fromFirestoreFields, "uid-x", undefined);
  assert.equal(a.ok, true); assert.equal(a.profile.name, "X");
  assert.equal(b.ok, true); assert.equal(b.profile.name, "X");
  assert.equal(c.ok, true); assert.equal(c.profile.name, "X");
});

test("self lookup failing (deleted/never-created account doc) is ok:true with a null profile, not a failure — no identity claim was made to violate", async () => {
  const fetch = makeFakeFetch({});
  const result = await resolveProfileContext(fetch, fromFirestoreFields, "uid-ghost", undefined);
  assert.equal(result.ok, true);
  assert.equal(result.profile, null);
});

test("self lookup throwing (network error) is also ok:true/null, never fails the whole request over a transient error", async () => {
  const throwingFetch = async () => { throw new Error("boom"); };
  const result = await resolveProfileContext(throwingFetch, fromFirestoreFields, "uid-x", undefined);
  assert.equal(result.ok, true);
  assert.equal(result.profile, null);
});

test("buildProfileContextLine never includes another profile's data — only whatever single profile object it's given", () => {
  const line = buildProfileContextLine({ name: "Emma", age: 9, confidenceScore: 65, isSelf: false });
  assert.match(line, /Emma/);
  assert.match(line, /never reference or reveal another household member/);
});

test("buildProfileContextLine returns empty string for null profile (safe default, no crash)", () => {
  assert.equal(buildProfileContextLine(null), "");
});
