// Phase 3.4 (2026-09-12) — static-source regression test: confirms the two
// client-side code paths that used to attempt denied direct writes
// (src/lib/appEvents.js's processAppEvent, src/hooks/useAuth.jsx's
// initLearnerProfile call, and AppModal.jsx's legacy appProgress write) no
// longer contain a client Firestore write to a firestore.rules-locked
// collection. Reads the source as TEXT rather than importing the modules —
// several of them import ../lib/firebase (the real Firebase client SDK),
// which this project's other tests deliberately avoid importing (see
// curriculumRouting.js's own header comment for why). A text scan is a
// simpler, equally direct way to prove "no setDoc/updateDoc/addDoc against
// this path remains" without needing a Firebase app instance. Run with:
//   node --test tests/no-direct-locked-writes.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function read(relPath) {
  return readFileSync(path.join(ROOT, relPath), "utf8");
}

test("appEvents.js no longer imports the Firestore client SDK at all", () => {
  const src = read("src/lib/appEvents.js");
  assert.ok(!src.includes("firebase/firestore"), "processAppEvent() must go through the server endpoint, not a direct Firestore write");
  assert.ok(!/\bsetDoc\(|\bupdateDoc\(|\baddDoc\(/.test(src), "no direct Firestore write call may remain");
});

test("appEvents.js calls the server-authenticated engagement endpoint", () => {
  const src = read("src/lib/appEvents.js");
  assert.ok(src.includes("/api/record-engagement-event"));
});

test("useAuth.jsx no longer calls initLearnerProfile", () => {
  const src = read("src/hooks/useAuth.jsx");
  assert.ok(!src.includes("initLearnerProfile"), "the eager, uncaught client-side profile-creation write must be gone");
});

test("learnerProfile.js no longer exports initLearnerProfile", () => {
  const src = read("src/lib/learnerProfile.js");
  assert.ok(!/export\s+(async\s+)?function\s+initLearnerProfile/.test(src));
});

test("AppModal.jsx no longer attempts the legacy appProgress write", () => {
  const src = read("src/components/AppModal.jsx");
  // The word "appProgress" may still appear in an explanatory comment about
  // why the write was removed — what must be gone is any actual Firestore
  // write call (setDoc/updateDoc/addDoc) and the appProgress path itself.
  assert.ok(!/\bsetDoc\(|\bupdateDoc\(|\baddDoc\(/.test(src), "AppModal.jsx must no longer perform any direct Firestore write");
  assert.ok(!src.includes('"appProgress"'), "the legacy collection name must no longer appear as a live path segment");
  assert.ok(!src.includes("handleProgressMessage"), "the retired isolation wrapper must no longer be imported/used");
});

test("progressMessageHandler.js no longer exports handleProgressMessage (nothing left to isolate)", () => {
  const src = read("src/lib/progressMessageHandler.js");
  assert.ok(!/export\s+(async\s+)?function\s+handleProgressMessage/.test(src));
  assert.ok(src.includes("isPlausibleProgressPayload"), "payload validation must still be exported");
});

test("the server-authenticated engagement function exists and never trusts a client-supplied uid", () => {
  const src = read("netlify/functions/record-engagement-event.js");
  assert.ok(src.includes("verifyIdToken"), "must verify the caller's ID token server-side");
  assert.ok(!/uid\s*[:=]\s*body\.uid/.test(src), "uid must come only from the verified token, never a client-supplied field");
});

test("engagement processing is a real Firestore transaction, not a bare :commit", () => {
  const src = read("netlify/functions/record-engagement-event.js");
  assert.ok(src.includes(":beginTransaction"), "the marker/profile/interaction/confidenceHistory/rateLimit writes must share one atomic transaction");
  assert.ok(src.includes(":rollback"), "every early-exit path must explicitly roll back");
});

test("engagement delta is never derived from a client-supplied numeric field", () => {
  const src = read("netlify/functions/_appEventAllowlist.js");
  assert.ok(!/engagementDeltaFor\([^)]*xp/i.test(src), "engagementDeltaFor must not take an xp/score parameter");
  const reeSrc = read("netlify/functions/record-engagement-event.js");
  assert.ok(!/reportedXp|reportedScore/.test(reeSrc.match(/engagementDeltaFor\([^)]*\)/)?.[0] ?? ""), "the actual call site must not pass reportedXp/reportedScore into the delta function");
});

test("appEvents.js sends reported evidence under clearly-labeled field names, not xp/score", () => {
  const src = read("src/lib/appEvents.js");
  assert.ok(src.includes("reportedXp") && src.includes("reportedScore"));
});

test("record-engagement-event.js uses the one shared self-vs-child resolver, not an inline duplicate", () => {
  const src = read("netlify/functions/record-engagement-event.js");
  assert.ok(src.includes("resolveLearnerProfilePath"), "must import the shared resolver from _learnerProfilePath.js rather than recompute the path inline");
  assert.ok(src.includes('require("./_learnerProfilePath")'));
});
