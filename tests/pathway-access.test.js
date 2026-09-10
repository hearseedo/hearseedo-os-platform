// Phase 1 — unit tests for the pathway access resolver (src/lib/pathwayAccess.js).
// Pure logic, no Firebase/network dependency — run with:
//   node --test tests/pathway-access.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  getAccessiblePathways, inferLegacyPathways, hasPathwayAccess, getPathwayState, PATHWAY_STATES,
  resolveCurrentPathway, resolvePathwayDestination,
} from "../src/lib/pathwayAccess.js";
import { PATHWAY_IDS } from "../src/constants/pathways.js";

test("admin gets every pathway regardless of account data", () => {
  const account = { subscriptions: [], plan: "free" };
  assert.deepEqual(getAccessiblePathways(account, true), PATHWAY_IDS);
});

test("account with explicit pathwayAccess uses it, ignoring subscriptions", () => {
  const account = {
    pathwayAccess: { family: { source: "beta" }, student: null, adult: null, educator: null },
    subscriptions: ["innerkey"], // would otherwise infer "adult"
  };
  assert.deepEqual(getAccessiblePathways(account), ["family"]);
});

test("legacy kids subscriptions infer the family pathway", () => {
  assert.deepEqual(inferLegacyPathways({ subscriptions: ["phonics", "wondercamp"] }), ["family"]);
});

test("legacy university subscriptions infer the student pathway", () => {
  assert.deepEqual(inferLegacyPathways({ subscriptions: ["career-ready", "global-ready"] }), ["student"]);
});

test("legacy adult subscriptions infer the adult pathway", () => {
  assert.deepEqual(inferLegacyPathways({ subscriptions: ["innerkey", "sipswitch"] }), ["adult"]);
});

test("accountType: family always includes the family pathway even without matching subscriptions", () => {
  assert.ok(inferLegacyPathways({ accountType: "family", subscriptions: [] }).includes("family"));
});

test("a mixed-subscription account infers multiple pathways", () => {
  const result = inferLegacyPathways({ subscriptions: ["phonics", "career-ready", "innerkey"] });
  assert.deepEqual(new Set(result), new Set(["family", "student", "adult"]));
});

test("a paying account with no recognizable app subscription still gets a conservative 'adult' default", () => {
  assert.deepEqual(inferLegacyPathways({ subscriptions: [], plan: "individual" }), ["adult"]);
});

test("a free account with nothing recognizable gets no pathway (not even the conservative default)", () => {
  assert.deepEqual(inferLegacyPathways({ subscriptions: [], plan: "free" }), []);
});

test("educator is never inferred — no existing signal for it (item 12: conservative defaults)", () => {
  const result = inferLegacyPathways({ subscriptions: ["phonics", "career-ready", "innerkey"], accountType: "family", plan: "family" });
  assert.ok(!result.includes("educator"));
});

test("hasPathwayAccess reflects the same resolution as getAccessiblePathways", () => {
  const account = { subscriptions: ["career-ready"] };
  assert.equal(hasPathwayAccess(account, "student"), true);
  assert.equal(hasPathwayAccess(account, "family"), false);
});

test("an account with an explicit but entirely-empty pathwayAccess map falls back to inference rather than losing all access", () => {
  const account = { pathwayAccess: { family: null, student: null, adult: null, educator: null }, subscriptions: ["innerkey"] };
  assert.deepEqual(getAccessiblePathways(account), ["adult"]);
});

test("no account (signed out) has no accessible pathways", () => {
  assert.deepEqual(getAccessiblePathways(null), []);
});

// ── Phase 2 — getPathwayState() ─────────────────────────────────────────────

test("educator is COMING_SOON regardless of access (disabled in config)", () => {
  assert.equal(getPathwayState("educator", { accessible: true, visitedPathways: ["educator"] }), PATHWAY_STATES.COMING_SOON);
});

test("an enabled pathway the account can't access is LOCKED", () => {
  assert.equal(getPathwayState("family", { accessible: false, visitedPathways: [] }), PATHWAY_STATES.LOCKED);
});

test("an accessible, never-visited pathway is ELIGIBLE (first-time)", () => {
  assert.equal(getPathwayState("student", { accessible: true, visitedPathways: [] }), PATHWAY_STATES.ELIGIBLE);
});

test("an accessible, previously-visited pathway is AVAILABLE (continue)", () => {
  assert.equal(getPathwayState("adult", { accessible: true, visitedPathways: ["adult"] }), PATHWAY_STATES.AVAILABLE);
});

test("LOCKED takes priority over visited history (access can be revoked)", () => {
  assert.equal(getPathwayState("family", { accessible: false, visitedPathways: ["family"] }), PATHWAY_STATES.LOCKED);
});

// ── Pathway routing cutover (2026-09-10) ────────────────────────────────────
// resolveCurrentPathway / resolvePathwayDestination / shouldShowClassicDashboard
// — the shared logic behind Blueprint.jsx's post-sign-in resolution and
// App.jsx's DashboardEntry guard. Scenarios requested in the routing audit.

test("routing: new account with no pathway ever chosen -> /choose-path", () => {
  const account = { lastUsedPathway: null };
  const accessible = getAccessiblePathways(account, false);
  const current = resolveCurrentPathway(account, accessible);
  assert.equal(current, null);
  assert.equal(resolvePathwayDestination(current), "/choose-path");
});

test("routing: family lastUsedPathway -> /family", () => {
  const account = { pathwayAccess: { family: { source: "beta" } }, lastUsedPathway: "family" };
  const current = resolveCurrentPathway(account, getAccessiblePathways(account, false));
  assert.equal(current, "family");
  assert.equal(resolvePathwayDestination(current), "/family");
});

test("routing: student lastUsedPathway -> /student", () => {
  const account = { subscriptions: ["career-ready"], lastUsedPathway: "student" };
  const current = resolveCurrentPathway(account, getAccessiblePathways(account, false));
  assert.equal(current, "student");
  assert.equal(resolvePathwayDestination(current), "/student");
});

test("routing: adult lastUsedPathway -> /adult", () => {
  const account = { subscriptions: ["innerkey"], lastUsedPathway: "adult" };
  const current = resolveCurrentPathway(account, getAccessiblePathways(account, false));
  assert.equal(current, "adult");
  assert.equal(resolvePathwayDestination(current), "/adult");
});

test("routing: educator lastUsedPathway resolves to /educator, but PathwayRoute (not this module) bounces it to /choose-path since it's disabled", () => {
  // Only an explicit grant (never inference) can even produce "educator" here —
  // entitlement and release-stage (`enabled`) are deliberately separate checks.
  const account = { pathwayAccess: { educator: { source: "admin_grant" } }, lastUsedPathway: "educator" };
  const current = resolveCurrentPathway(account, getAccessiblePathways(account, false));
  assert.equal(current, "educator");
  assert.equal(resolvePathwayDestination(current), "/educator");
  assert.equal(getPathwayState("educator", { accessible: true, visitedPathways: ["educator"] }), PATHWAY_STATES.COMING_SOON);
});

test("routing: invalid/unrecognized lastUsedPathway string -> /choose-path", () => {
  const account = { subscriptions: [], lastUsedPathway: "not-a-real-pathway" };
  const current = resolveCurrentPathway(account, getAccessiblePathways(account, false));
  assert.equal(current, null);
  assert.equal(resolvePathwayDestination(current), "/choose-path");
});

test("routing: lastUsedPathway set but access has since been revoked -> /choose-path", () => {
  const account = { pathwayAccess: { family: null, student: null, adult: null, educator: null }, lastUsedPathway: "family" };
  const current = resolveCurrentPathway(account, getAccessiblePathways(account, false));
  // empty explicit map falls back to inference (existing behavior), and this
  // account has no inferrable signal either -> genuinely no access
  assert.equal(getAccessiblePathways(account, false).includes("family"), false);
  assert.equal(current, null);
  assert.equal(resolvePathwayDestination(current), "/choose-path");
});

test("routing: multi-path account -> lands on its last-used one, not the others", () => {
  const account = { subscriptions: ["innerkey", "career-ready"], lastUsedPathway: "student" };
  const accessible = getAccessiblePathways(account, false);
  assert.ok(accessible.includes("student") && accessible.includes("adult"), "account should have multiple accessible pathways");
  const current = resolveCurrentPathway(account, accessible);
  assert.equal(current, "student");
  assert.equal(resolvePathwayDestination(current), "/student");
});

test("routing: existing legacy account (pre-Phase-1, no pathwayAccess field) infers a pathway and routes there", () => {
  const account = { subscriptions: ["phonics"], lastUsedPathway: "family" };
  const current = resolveCurrentPathway(account, getAccessiblePathways(account, false));
  assert.equal(current, "family");
  assert.equal(resolvePathwayDestination(current), "/family");
});
