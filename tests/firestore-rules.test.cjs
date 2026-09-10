// Phase 0 security hardening (2026-09-09) — Firestore rules regression tests.
//
// Requires the Firebase emulator suite, which requires a Java runtime.
// Could NOT be executed in the session that wrote this file (no Java
// runtime was available on that machine) — run it yourself before trusting
// these rules changes in production:
//
//   npm install --save-dev @firebase/rules-unit-testing
//   firebase emulators:exec --only firestore "node --test tests/firestore-rules.test.cjs"
//
// (firebase-tools is already a devDependency; @firebase/rules-unit-testing
// is not yet installed — add it before running this file.)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "hsdos-rules-test",
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
});

test.after(async () => {
  await testEnv?.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

const ADMIN_EMAIL = "hearseedo.english@gmail.com";

test("a free user cannot grant themselves a paid plan", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  const db = alice.firestore();
  await assertFails(
    db.doc("users/alice").set({ plan: "all_access", subscriptions: ["eiken"] }, { merge: true })
  );
});

test("a free user cannot set planStatus to active", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(alice.firestore().doc("users/alice").set({ planStatus: "active" }, { merge: true }));
});

test("a user cannot grant themselves an access pass", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(
    alice.firestore().doc("users/alice").set(
      { accessPass: { status: "active", hasFullPlatformAccess: true, expiresAt: "2099-01-01", aiCreditsRemaining: 999 } },
      { merge: true }
    )
  );
});

test("a user cannot make themselves admin", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(alice.firestore().doc("users/alice").set({ isAdmin: true }, { merge: true }));
});

test("a user CAN still edit their own safe profile fields", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertSucceeds(
    alice.firestore().doc("users/alice").set({ name: "Alice", confidenceScore: 62, streak: 4 }, { merge: true })
  );
});

test("signed-out (unauthenticated) write to a user doc is denied", async () => {
  const anon = testEnv.unauthenticatedContext();
  await assertFails(anon.firestore().doc("users/alice").set({ plan: "all_access" }, { merge: true }));
});

test("the admin CAN edit another user's billing fields", async () => {
  const admin = testEnv.authenticatedContext("admin-uid", { email: ADMIN_EMAIL });
  await assertSucceeds(
    admin.firestore().doc("users/alice").set({ subscriptions: ["eiken", "wondercamp"] }, { merge: true })
  );
});

test("the second owner email (waltho79@gmail.com) is also recognized as admin", async () => {
  const owner2 = testEnv.authenticatedContext("owner2-uid", { email: "waltho79@gmail.com" });
  await assertSucceeds(
    owner2.firestore().doc("users/owner2-uid").set(
      { isAdmin: true, subscriptions: ["eiken"], plan: "individual", planStatus: "active" },
      { merge: true }
    )
  );
});

test("kill switch: unauthenticated write is denied", async () => {
  const anon = testEnv.unauthenticatedContext();
  await assertFails(anon.firestore().doc("config/killSwitch").set({ allEnabled: false }));
});

test("kill switch: a normal authenticated (non-admin) user cannot write it", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(alice.firestore().doc("config/killSwitch").set({ allEnabled: false }));
});

test("kill switch: the admin CAN write it", async () => {
  const admin = testEnv.authenticatedContext("admin-uid", { email: ADMIN_EMAIL });
  await assertSucceeds(admin.firestore().doc("config/killSwitch").set({ allEnabled: false }));
});

test("kill switch: read is public (any AI function polls it without auth)", async () => {
  const anon = testEnv.unauthenticatedContext();
  await assertSucceeds(anon.firestore().doc("config/killSwitch").get());
});

// ── Phase 1 — account/profile/pathway architecture (2026-09-09) ────────────

test("a user cannot self-grant pathwayAccess", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(
    alice.firestore().doc("users/alice").set(
      { pathwayAccess: { family: { source: "self-granted" } } },
      { merge: true }
    )
  );
});

test("the admin CAN set pathwayAccess for a user", async () => {
  const admin = testEnv.authenticatedContext("admin-uid", { email: ADMIN_EMAIL });
  await assertSucceeds(
    admin.firestore().doc("users/alice").set(
      { pathwayAccess: { family: { source: "beta" } } },
      { merge: true }
    )
  );
});

test("a user CAN still set their own lastUsedPathway/activeProfileId (not privileged)", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertSucceeds(
    alice.firestore().doc("users/alice").set(
      { lastUsedPathway: "family", activeProfileId: "self", roles: ["parent"] },
      { merge: true }
    )
  );
});

test("profile ownership: a user cannot read another account's familyMembers profile", async () => {
  // Seed as alice (the owner) — familyMembers is owner-only, not even the
  // admin can write another account's family member docs (unlike the
  // billing fields on users/{uid} itself, which do have an admin carve-out).
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await alice.firestore().doc("users/alice/familyMembers/child1").set({ name: "Emma", age: 7 });

  const bob = testEnv.authenticatedContext("bob", { email: "bob@example.com" });
  await assertFails(bob.firestore().doc("users/alice/familyMembers/child1").get());
});

test("profile ownership: a user cannot write to another account's familyMembers profile", async () => {
  const bob = testEnv.authenticatedContext("bob", { email: "bob@example.com" });
  await assertFails(
    bob.firestore().doc("users/alice/familyMembers/child1").set({ name: "Hacked", age: 99 })
  );
});

test("profile ownership: the account owner CAN manage their own familyMembers profile", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertSucceeds(
    alice.firestore().doc("users/alice/familyMembers/child1").set({ name: "Emma", age: 7 })
  );
});

test("pathway events: a user can log an event about themselves", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertSucceeds(
    alice.firestore().collection("pathwayEvents").add({ uid: "alice", eventType: "pathway_selected", pathwayId: "family" })
  );
});

test("pathway events: a user cannot log an event impersonating another uid", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(
    alice.firestore().collection("pathwayEvents").add({ uid: "bob", eventType: "pathway_selected", pathwayId: "family" })
  );
});

test("pathway events: only the admin can read them", async () => {
  // Reuse one .firestore() instance per context (calling .firestore() more
  // than once per context within a test hit an unrelated rules-unit-testing
  // SDK quirk — "Firestore has already been started...").
  const carolDb = testEnv.authenticatedContext("carol", { email: "carol@example.com" }).firestore();
  await carolDb.doc("pathwayEvents/evt1").set({ uid: "carol", eventType: "pathway_selected", pathwayId: "family" });
  await assertFails(carolDb.doc("pathwayEvents/evt1").get());

  const adminDb = testEnv.authenticatedContext("admin-uid", { email: ADMIN_EMAIL }).firestore();
  await assertSucceeds(adminDb.doc("pathwayEvents/evt1").get());
});

// ── Phase 3 — HSD Family activity progress ──────────────────────────────────

test("activity progress: owner can write their own self-profile activity progress", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertSucceeds(
    alice.firestore().doc("users/alice/activityProgress/talk-first-hello").set({ completed: true })
  );
});

test("activity progress: a user cannot write another account's self-profile activity progress", async () => {
  const bob = testEnv.authenticatedContext("bob", { email: "bob@example.com" });
  await assertFails(
    bob.firestore().doc("users/alice/activityProgress/talk-first-hello").set({ completed: true })
  );
});

test("activity progress: owner can write a child profile's activity progress", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertSucceeds(
    alice.firestore().doc("users/alice/familyMembers/child1/activityProgress/hear-hello-song").set({ completed: true })
  );
});

test("activity progress: a user cannot read another account's child profile activity progress", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await alice.firestore().doc("users/alice/familyMembers/child1/activityProgress/hear-hello-song").set({ completed: true });

  const bob = testEnv.authenticatedContext("bob", { email: "bob@example.com" });
  await assertFails(bob.firestore().doc("users/alice/familyMembers/child1/activityProgress/hear-hello-song").get());
});

// ── Phase 4 — HSD Family private beta: betaInvites + familyFlags ────────────
// The core Phase 4 security requirement: beta access is server-authoritative.
// A client must NEVER be able to read, create, or claim a beta invite code
// directly — only the redeem-beta-invite.js function (via the admin SDK,
// which bypasses these rules entirely) may touch betaInvites.

test("betaInvites: a normal authenticated user cannot read an invite doc", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(alice.firestore().doc("betaInvites/HSD-FAMILY-0001").get());
});

test("betaInvites: a normal authenticated user cannot create an invite doc", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(
    alice.firestore().doc("betaInvites/HSD-FAMILY-0001").set({ status: "unused" })
  );
});

test("betaInvites: a normal authenticated user cannot mark an invite as used (cannot self-grant beta access client-side)", async () => {
  const adminDb = testEnv.authenticatedContext("admin-uid", { email: ADMIN_EMAIL }).firestore();
  await adminDb.doc("betaInvites/HSD-FAMILY-0002").set({ status: "unused" });

  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(
    alice.firestore().doc("betaInvites/HSD-FAMILY-0002").update({ status: "used", usedByUid: "alice" })
  );
});

test("betaInvites: an unauthenticated client cannot read or write invite docs", async () => {
  const anonDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(anonDb.doc("betaInvites/HSD-FAMILY-0003").get());
  await assertFails(anonDb.doc("betaInvites/HSD-FAMILY-0003").set({ status: "unused" }));
});

test("betaInvites: the admin CAN read and write invite docs directly (console management)", async () => {
  const adminDb = testEnv.authenticatedContext("admin-uid", { email: ADMIN_EMAIL }).firestore();
  await assertSucceeds(adminDb.doc("betaInvites/HSD-FAMILY-0004").set({ status: "unused" }));
  await assertSucceeds(adminDb.doc("betaInvites/HSD-FAMILY-0004").get());
});

test("familyFlags (kill switch): read is public (any client can check familyEnabled/jonaFamilyEnabled without auth)", async () => {
  const adminDb = testEnv.authenticatedContext("admin-uid", { email: ADMIN_EMAIL }).firestore();
  await adminDb.doc("familyFlags/current").set({ familyEnabled: true });

  const anon = testEnv.unauthenticatedContext();
  await assertSucceeds(anon.firestore().doc("familyFlags/current").get());
});

test("familyFlags (kill switch): a normal authenticated user cannot write it", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(
    alice.firestore().doc("familyFlags/current").set({ familyEnabled: false })
  );
});

test("familyFlags (kill switch): unauthenticated write is denied", async () => {
  const anon = testEnv.unauthenticatedContext();
  await assertFails(anon.firestore().doc("familyFlags/current").set({ familyEnabled: false }));
});

test("familyFlags (kill switch): the admin CAN write it (flip the switch to disable Family/Jona instantly)", async () => {
  const adminDb = testEnv.authenticatedContext("admin-uid", { email: ADMIN_EMAIL }).firestore();
  await assertSucceeds(adminDb.doc("familyFlags/current").set({ familyEnabled: false, jonaFamilyEnabled: false }));
});

test("familyFlags (kill switch): delete is never allowed, even for the admin (matches the config/killSwitch pattern — flip, never remove)", async () => {
  const adminDb = testEnv.authenticatedContext("admin-uid", { email: ADMIN_EMAIL }).firestore();
  await adminDb.doc("familyFlags/current").set({ familyEnabled: true });
  await assertFails(adminDb.doc("familyFlags/current").delete());
});

// ── Phase 5 — Monkey Yoga V2 integration: curriculumProgress + classes ──────
// SECURITY CORRECTION (2026-09-10): curriculumProgress writes moved
// server-side (netlify/functions/record-curriculum-progress.js, using the
// service account) — the client SDK can no longer write this collection at
// all, even for the account's own owner. classes moved from
// "any authenticated user can read" to admin-only both ways — non-admin
// lookups go through netlify/functions/get-classroom-position.js instead.
// withSecurityRulesDisabled() seeds data the way the service
// account/admin SDK actually would in production (bypassing rules
// entirely), so these tests seed state the same way the real write path
// does rather than pretending the client SDK can do it.

test("curriculumProgress: the client SDK cannot write it AT ALL, even for the account's own owner — writes are server-only now", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(
    alice.firestore().doc("users/alice/curriculumProgress/monkey-yoga-phonics").set({ lastBookId: 1, lastLessonId: "b1-s" })
  );
});

test("curriculumProgress: owner CAN still read their own self-profile curriculum position (server-written, client-read is unchanged/safe)", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("users/alice/curriculumProgress/monkey-yoga-phonics").set({ lastBookId: 1, lastLessonId: "b1-s" });
  });
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertSucceeds(alice.firestore().doc("users/alice/curriculumProgress/monkey-yoga-phonics").get());
});

test("curriculumProgress: a user cannot read another account's curriculum position", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("users/alice/curriculumProgress/monkey-yoga-phonics").set({ lastBookId: 1, lastLessonId: "b1-s" });
  });
  const bob = testEnv.authenticatedContext("bob", { email: "bob@example.com" });
  await assertFails(bob.firestore().doc("users/alice/curriculumProgress/monkey-yoga-phonics").get());
});

test("curriculumProgress: the client SDK cannot write a child profile's curriculum position either", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(
    alice.firestore().doc("users/alice/familyMembers/child1/curriculumProgress/monkey-yoga-phonics").set({ lastBookId: 2, lastLessonId: "b2-h" })
  );
});

test("curriculumProgress: homePracticeLog is also server-write-only, client read-only for the owner", async () => {
  const aliceDb = testEnv.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
  await assertFails(
    aliceDb.doc("users/alice/curriculumProgress/monkey-yoga-phonics/homePracticeLog/entry1").set({ lessonId: "b1-s", completed: true })
  );
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("users/alice/curriculumProgress/monkey-yoga-phonics/homePracticeLog/entry1").set({ lessonId: "b1-s", completed: true });
  });
  await assertSucceeds(aliceDb.doc("users/alice/curriculumProgress/monkey-yoga-phonics/homePracticeLog/entry1").get());
});

test("curriculumProgress: a user cannot read another account's homePracticeLog", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("users/alice/curriculumProgress/monkey-yoga-phonics/homePracticeLog/entry1").set({ lessonId: "b1-s", completed: true });
  });
  const bob = testEnv.authenticatedContext("bob", { email: "bob@example.com" });
  await assertFails(bob.firestore().doc("users/alice/curriculumProgress/monkey-yoga-phonics/homePracticeLog/entry1").get());
});

test("curriculumProgress: processedEvents (idempotency markers) are never readable or writable client-side, even by the owner", async () => {
  const aliceDb = testEnv.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
  await assertFails(
    aliceDb.doc("users/alice/curriculumProgress/monkey-yoga-phonics/processedEvents/evt1").set({ recordedAt: "now" })
  );
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("users/alice/curriculumProgress/monkey-yoga-phonics/processedEvents/evt1").set({ recordedAt: "now" });
  });
  await assertFails(aliceDb.doc("users/alice/curriculumProgress/monkey-yoga-phonics/processedEvents/evt1").get());
});

test("classes: an unrelated signed-in user cannot read a class (security correction — was previously any-authenticated-read, now admin-only)", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("classes/class1").set({ name: "Test Class", currentBookId: 1, currentLessonId: "b1-s", learnerKeys: ["alice:self"] });
  });
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(alice.firestore().doc("classes/class1").get());
});

test("classes: unauthenticated read is denied", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("classes/class1").set({ name: "Test Class" });
  });
  const anonDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(anonDb.doc("classes/class1").get());
});

test("classes: a normal (non-admin) authenticated user cannot create a class", async () => {
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(alice.firestore().doc("classes/class1").set({ name: "Test Class" }));
});

test("classes: a normal user cannot modify classroom position even for a class they belong to — one parent cannot obtain or alter another family's information, and cannot alter their own class's authoritative position either", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("classes/class1").set({ name: "Test Class", currentBookId: 1, currentLessonId: "b1-s", learnerKeys: ["alice:self"] });
  });
  const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" });
  await assertFails(
    alice.firestore().doc("classes/class1").set({ currentBookId: 4, currentLessonId: "b4-l18" }, { merge: true })
  );
});

test("classes: the admin CAN create, read, and update a class's curriculum position (the one role currently allowed to manage classrooms — no separate 'teacher' auth role exists yet)", async () => {
  const adminDb = testEnv.authenticatedContext("admin-uid", { email: ADMIN_EMAIL }).firestore();
  await assertSucceeds(adminDb.doc("classes/class1").set({ name: "Test Class", currentBookId: 1, currentLessonId: "b1-s", learnerKeys: [] }));
  await assertSucceeds(adminDb.doc("classes/class1").get());
  await assertSucceeds(adminDb.doc("classes/class1").update({ currentBookId: 2, currentLessonId: "b2-h" }));
});
