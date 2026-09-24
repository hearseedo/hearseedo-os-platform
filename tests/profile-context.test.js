// P0 — Jona profile identity. Unit tests for netlify/functions/_profileContext.js
// covering the directive's specific attack list (substitute another
// profile ID, access another household's profile, invalid/missing
// profileId) using a fake firestoreFetch — no real network/emulator needed.
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

test("self profile (no profileId) resolves the account's own doc", async () => {
  const db = { "/users/uid-jonathan": { name: field("Jonathan"), confidenceScore: field(80) } };
  const fetch = makeFakeFetch(db);
  const profile = await resolveProfileContext(fetch, fromFirestoreFields, "uid-jonathan", undefined);
  assert.equal(profile.name, "Jonathan");
  assert.equal(profile.isSelf, true);
  assert.deepEqual(fetch.calls, ["/users/uid-jonathan"]);
});

test("explicit 'self' profileId behaves identically to omitted", async () => {
  const db = { "/users/uid-jonathan": { name: field("Jonathan") } };
  const fetch = makeFakeFetch(db);
  const profile = await resolveProfileContext(fetch, fromFirestoreFields, "uid-jonathan", "self");
  assert.equal(profile.name, "Jonathan");
});

test("a real family-member profileId resolves that member's own doc, nested under the caller's uid", async () => {
  const db = {
    "/users/uid-waltho/familyMembers/emma-id": { name: field("Emma"), age: field(9), confidenceScore: field(65) },
  };
  const fetch = makeFakeFetch(db);
  const profile = await resolveProfileContext(fetch, fromFirestoreFields, "uid-waltho", "emma-id");
  assert.equal(profile.name, "Emma");
  assert.equal(profile.age, 9);
  assert.equal(profile.isSelf, false);
  assert.deepEqual(fetch.calls, ["/users/uid-waltho/familyMembers/emma-id"]);
});

// ── Attack cases (from the migration proposal's §11 test list) ────────────

test("attack: substituting another profile ID under the SAME account that doesn't exist falls back to self, never errors", async () => {
  const db = {
    "/users/uid-waltho": { name: field("Jonathan") },
    "/users/uid-waltho/familyMembers/emma-id": { name: field("Emma") },
    // "miley-id" deliberately absent — simulates a guessed/substituted id
  };
  const fetch = makeFakeFetch(db);
  const profile = await resolveProfileContext(fetch, fromFirestoreFields, "uid-waltho", "miley-id");
  assert.equal(profile.name, "Jonathan"); // safe fallback to self, never null/leaked
  assert.equal(profile.isSelf, true);
  assert.deepEqual(fetch.calls, ["/users/uid-waltho/familyMembers/miley-id", "/users/uid-waltho"]);
});

test("attack: supplying another HOUSEHOLD's real memberId structurally cannot reach it — path stays under the caller's own uid", async () => {
  // A different account's real family member exists in the fake DB, but
  // ONLY under ITS OWN uid's path — the attacker's uid is different, so the
  // path this function actually queries can never reach it. This is the
  // core security property: it's not a permission check that could have a
  // bug, it's that the path itself is constructed from the verified uid.
  const db = {
    "/users/uid-attacker": { name: field("Attacker") },
    "/users/uid-victim/familyMembers/victim-child-id": { name: field("Victim Child"), confidenceScore: field(40) },
  };
  const fetch = makeFakeFetch(db);
  const profile = await resolveProfileContext(fetch, fromFirestoreFields, "uid-attacker", "victim-child-id");
  assert.equal(profile.name, "Attacker"); // fell back to the attacker's OWN self context
  assert.notEqual(profile.name, "Victim Child");
  // Confirms the query never even reached the victim's path — it was
  // constructed under uid-attacker throughout, not uid-victim.
  assert.ok(fetch.calls.every(p => p.startsWith("/users/uid-attacker")));
});

test("missing/empty profileId behaves exactly like 'self'", async () => {
  const db = { "/users/uid-x": { name: field("X") } };
  const fetch = makeFakeFetch(db);
  const a = await resolveProfileContext(fetch, fromFirestoreFields, "uid-x", "");
  const b = await resolveProfileContext(fetch, fromFirestoreFields, "uid-x", null);
  const c = await resolveProfileContext(fetch, fromFirestoreFields, "uid-x", undefined);
  assert.equal(a.name, "X");
  assert.equal(b.name, "X");
  assert.equal(c.name, "X");
});

test("even self lookup failing (deleted/never-created account doc) returns null, not a throw", async () => {
  const fetch = makeFakeFetch({});
  const profile = await resolveProfileContext(fetch, fromFirestoreFields, "uid-ghost", undefined);
  assert.equal(profile, null);
});

test("a fetcher that throws (network error) never propagates — fails safe to null/self, never crashes the caller", async () => {
  const throwingFetch = async () => { throw new Error("boom"); };
  const profile = await resolveProfileContext(throwingFetch, fromFirestoreFields, "uid-x", "some-member");
  assert.equal(profile, null);
});

test("buildProfileContextLine never includes another profile's data — only whatever single profile object it's given", () => {
  const line = buildProfileContextLine({ name: "Emma", age: 9, confidenceScore: 65, isSelf: false });
  assert.match(line, /Emma/);
  assert.match(line, /never reference or reveal another household member/);
});

test("buildProfileContextLine returns empty string for null profile (safe default, no crash)", () => {
  assert.equal(buildProfileContextLine(null), "");
});
