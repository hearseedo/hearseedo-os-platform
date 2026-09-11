// Phase 3.2 hardening (2026-09-12) — tests for the account-loading/
// pathway-route bug: a denied or slow-to-resolve Firestore listener was
// indistinguishable from a genuine "this pathway is locked" answer, so
// PathwayRoute redirected entitled accounts to /choose-path as though
// they had no access. Covers refresh, direct-route entry, deleted-profile
// restoration, and cross-child isolation, per the explicit Phase 3.2
// requirements. Pure logic only — run with:
//   node --test tests/pathway-route-access.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { resolvePathwayRouteAccess, resolveCurrentProfile } from "../src/lib/pathwayRouteAccess.js";
import { PATHWAY_STATES } from "../src/lib/pathwayAccess.js";

const BASE = { loading: false, profileError: null, profileReady: true, pathwayState: PATHWAY_STATES.AVAILABLE, pathwayId: "family", familyEnabled: true };

// ── The core state machine ──────────────────────────────────────────────

test("Firebase Auth still resolving -> loading, regardless of anything else", () => {
  const r = resolvePathwayRouteAccess({ ...BASE, loading: true, profileError: "permission-denied" });
  assert.equal(r.decision, "loading");
});

test("a profile load error is NEVER treated as locked/redirect, even with a stale LOCKED pathwayState", () => {
  const r = resolvePathwayRouteAccess({ ...BASE, profileError: "permission-denied", pathwayState: PATHWAY_STATES.LOCKED });
  assert.equal(r.decision, "error");
  assert.equal(r.reason, "permission-denied");
});

test("still waiting on the first account snapshot -> loading, not redirect (this is the exact original bug)", () => {
  // Before this fix, `pathwayState` would be undefined/LOCKED-by-inference
  // here because profile hadn't loaded yet, and the old code had no way to
  // tell that apart from a real, resolved LOCKED answer.
  const r = resolvePathwayRouteAccess({ ...BASE, profileReady: false, pathwayState: undefined });
  assert.equal(r.decision, "loading");
});

test("REGRESSION: profileReady false must never fall through to redirect even if pathwayState happens to look LOCKED", () => {
  const r = resolvePathwayRouteAccess({ ...BASE, profileReady: false, pathwayState: PATHWAY_STATES.LOCKED });
  assert.equal(r.decision, "loading");
  assert.notEqual(r.decision, "redirect");
});

test("a genuinely resolved LOCKED pathway redirects, once profile is actually ready", () => {
  const r = resolvePathwayRouteAccess({ ...BASE, pathwayState: PATHWAY_STATES.LOCKED });
  assert.equal(r.decision, "redirect");
  assert.equal(r.reason, PATHWAY_STATES.LOCKED);
});

test("a genuinely resolved COMING_SOON pathway redirects", () => {
  const r = resolvePathwayRouteAccess({ ...BASE, pathwayState: PATHWAY_STATES.COMING_SOON });
  assert.equal(r.decision, "redirect");
});

test("family kill-switch disabled redirects only for the family pathway", () => {
  assert.equal(resolvePathwayRouteAccess({ ...BASE, familyEnabled: false }).decision, "redirect");
  assert.equal(resolvePathwayRouteAccess({ ...BASE, pathwayId: "student", familyEnabled: false }).decision, "allow");
});

test("a fully resolved, unlocked, enabled pathway allows access", () => {
  assert.equal(resolvePathwayRouteAccess(BASE).decision, "allow");
});

// ── Direct-route entry (typing the URL, no prior navigation) ────────────

test("direct-route entry: same decision logic applies regardless of how the route was reached — no special-casing needed, proven by these inputs alone being sufficient", () => {
  // resolvePathwayRouteAccess takes no notion of "how we got here" at all
  // by design — this is what makes direct URL entry, a client-side nav,
  // and a full refresh all go through the identical, race-free check.
  const freshLoad = resolvePathwayRouteAccess({ ...BASE, loading: true, profileReady: false, profileError: null, pathwayState: undefined });
  assert.equal(freshLoad.decision, "loading");
});

// ── Refresh: the exact original bug reproduction ─────────────────────────

test("REGRESSION: refreshing mid-error must show the error state, never silently redirect as if locked", () => {
  // Simulates a hard refresh landing while the account-doc listener is
  // still erroring (e.g. a transient rules propagation delay) —
  // profileReady is still false AND profileError is set.
  const r = resolvePathwayRouteAccess({ ...BASE, profileReady: false, profileError: "permission-denied", pathwayState: undefined });
  assert.equal(r.decision, "error");
});

// ── currentProfile restoration: deleted profile + cross-child isolation ──

const parentSelf = { id: "self", name: "Parent" };
const childA = { id: "childA-uid", name: "TestChildA" };
const childB = { id: "childB-uid", name: "TestChildB" };
const liveProfiles = [parentSelf, childA, childB];

test("restores the persisted activeProfileId when it matches a live profile", () => {
  assert.deepEqual(resolveCurrentProfile(liveProfiles, "childA-uid"), childA);
});

test("cross-child isolation: resolving childA's id never returns childB's profile or vice versa", () => {
  const resolvedA = resolveCurrentProfile(liveProfiles, "childA-uid");
  const resolvedB = resolveCurrentProfile(liveProfiles, "childB-uid");
  assert.equal(resolvedA.id, "childA-uid");
  assert.equal(resolvedB.id, "childB-uid");
  assert.notEqual(resolvedA.id, resolvedB.id);
});

test("DELETED PROFILE: an activeProfileId no longer present in live familyMembers falls back to the account owner, never a stale/ghost profile", () => {
  // childA was deleted — profiles list no longer contains it, but the
  // account doc's activeProfileId field hasn't been updated yet (a real,
  // expected race: the field is a preference, not re-validated on delete).
  const afterDeletion = [parentSelf, childB]; // childA removed
  const resolved = resolveCurrentProfile(afterDeletion, "childA-uid");
  assert.equal(resolved.id, "self");
  assert.notEqual(resolved.id, "childA-uid");
});

test("DELETED PROFILE: falling back never accidentally picks a different child instead of the account owner", () => {
  const afterDeletion = [parentSelf, childB];
  const resolved = resolveCurrentProfile(afterDeletion, "childA-uid");
  assert.notEqual(resolved.id, childB.id); // must not silently become "childB" just because it's next in the array
  assert.equal(resolved.id, parentSelf.id);
});

test("an empty profiles list (e.g. familyMembers still loading) resolves to null, never throws", () => {
  assert.equal(resolveCurrentProfile([], "childA-uid"), null);
  assert.equal(resolveCurrentProfile([], null), null);
});

test("a null/undefined activeProfileId falls back to the first profile (the account owner, by convention)", () => {
  assert.deepEqual(resolveCurrentProfile(liveProfiles, null), parentSelf);
  assert.deepEqual(resolveCurrentProfile(liveProfiles, undefined), parentSelf);
});
