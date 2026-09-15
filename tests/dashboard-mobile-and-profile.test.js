// Phase 4B (2026-09-15) — static-source regression tests for two bugs found
// while live-testing Phase 4A's authenticated flows against staging
// (monkey-see-c4c28). Both bugs are pre-existing and unrelated to Phase 4A's
// Living Blueprint retirement (src/pages/Dashboard.jsx had zero changes in
// that branch) — this project has no React-rendering test harness
// (no jsdom/@testing-library), so — matching the existing convention in
// tests/no-direct-locked-writes.test.js — these read the source as TEXT and
// assert the exact structural facts that caused/fix each bug, rather than
// mounting the component. Run with:
//   node --test tests/dashboard-mobile-and-profile.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function read(relPath) {
  return readFileSync(path.join(ROOT, relPath), "utf8");
}

const dashboardSrc = read("src/pages/Dashboard.jsx");

// ── Bug 1: MobileDashboard crash below 768px ─────────────────────────────
// Root cause: MobileDashboard is a top-level function (not a closure over
// Dashboard()), but its body referenced `profileReady` and `isAdmin` from
// Dashboard()'s own useAuth() call — a ReferenceError at render time for
// any authenticated visitor under the 768px mobile breakpoint (useMobile.js).

test("MobileDashboard's signature declares profileReady and isAdmin as props", () => {
  const match = dashboardSrc.match(/function MobileDashboard\(\{([^}]*)\}\)/);
  assert.ok(match, "MobileDashboard's function signature must be found");
  const params = match[1];
  assert.ok(/\bprofileReady\b/.test(params), "profileReady must be a declared prop, not an out-of-scope reference");
  assert.ok(/\bisAdmin\b/.test(params), "isAdmin must be a declared prop, not an out-of-scope reference");
});

test("the <MobileDashboard /> call site passes profileReady and isAdmin through", () => {
  const callSite = dashboardSrc.match(/<MobileDashboard[\s\S]*?\/>/);
  assert.ok(callSite, "the MobileDashboard call site must be found");
  assert.ok(/profileReady=\{profileReady\}/.test(callSite[0]), "profileReady must be passed at the call site");
  assert.ok(/isAdmin=\{isAdmin\}/.test(callSite[0]), "isAdmin must be passed at the call site");
});

test("MobileDashboard's own body never re-declares profileReady/isAdmin as local state (would mask the real auth values)", () => {
  const start = dashboardSrc.indexOf("function MobileDashboard(");
  const nextFn = dashboardSrc.indexOf("\nfunction ", start + 1);
  const body = dashboardSrc.slice(start, nextFn === -1 ? undefined : nextFn);
  assert.ok(!/const\s+\[\s*profileReady/.test(body));
  assert.ok(!/const\s+\[\s*isAdmin/.test(body));
});

// ── Bug 2: active child-profile selection did not survive a refresh ─────
// Root cause: Dashboard() kept the selected family member in a plain
// `useState(null)` local to the component — lost on every remount/refresh.
// Fix: reuse the EXISTING, already-Firestore-persisted, already-unit-tested
// profile architecture (useAuth's currentProfile/setActiveProfile, backed by
// resolveCurrentProfile in pathwayRouteAccess.js and the activeProfileId
// field already used by PathwayEntry.jsx) instead of a second, competing,
// session-only selection mechanism.

test("Dashboard no longer keeps activeMember as its own useState", () => {
  assert.ok(
    !/const\s+\[\s*activeMember\s*,\s*setActiveMember\s*\]\s*=\s*useState/.test(dashboardSrc),
    "activeMember must not be local component state — it must derive from useAuth's currentProfile so it persists across a refresh"
  );
});

test("Dashboard derives activeMember from useAuth's currentProfile/setActiveProfile", () => {
  assert.ok(dashboardSrc.includes("currentProfile, setActiveProfile"), "Dashboard must destructure the existing profile architecture from useAuth()");
  assert.ok(/const activeMember = currentProfile/.test(dashboardSrc), "activeMember must be derived from currentProfile, not stored separately");
  assert.ok(/setActiveProfile\(member \? member\.id : SELF_PROFILE_ID\)/.test(dashboardSrc), "switching a member must persist via the existing setActiveProfile, not a local setter");
});

test("Dashboard does not introduce a second/competing profile-persistence mechanism (e.g. its own localStorage or sessionStorage key for the active profile)", () => {
  const activeProfileStorageCalls = (dashboardSrc.match(/(localStorage|sessionStorage)\.(setItem|getItem)\(["'][^"']*(activeMember|activeProfile|active_member|active_profile)/gi) ?? []);
  assert.equal(activeProfileStorageCalls.length, 0, "no new client-storage-based profile selector should exist alongside the existing Firestore-backed one");
});
