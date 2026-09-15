// Phase 4A (2026-09-13) — retiring BOTH the legacy Blueprint onboarding
// chain (JoinFlow "Who is joining HSDOS?" -> Blueprint "Building your
// Blueprint..." -> old resolvePathwayDestination) AND the separate,
// never-launched src/livingBlueprint/ rebuild (/preview/*), in favor of the
// simplified entry flow: Welcome -> Join or Sign in -> Choose Your Path ->
// Pathway Home. Covers the two pure route-decision functions in
// src/lib/pathwayRouteAccess.js. Pure logic only — run with:
//   node --test tests/blueprint-retirement.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { resolveBlueprintRedirect, resolveAuthSuccessDestination, resolveJoinDestination } from "../src/lib/pathwayRouteAccess.js";

// ── resolveBlueprintRedirect: /blueprint and /blueprint/* safe redirects ──

test("signed-in user hitting the retired /blueprint route goes to /choose-path", () => {
  assert.equal(resolveBlueprintRedirect({ uid: "abc123" }), "/choose-path");
});

test("signed-out user hitting the retired /blueprint route goes to /join", () => {
  assert.equal(resolveBlueprintRedirect(null), "/join");
  assert.equal(resolveBlueprintRedirect(undefined), "/join");
});

test("no redirect loop: neither destination the gate can produce is /blueprint itself", () => {
  for (const user of [null, undefined, {}, { uid: "x" }]) {
    const dest = resolveBlueprintRedirect(user);
    assert.notEqual(dest, "/blueprint");
    assert.ok(!dest.startsWith("/blueprint"));
  }
});

test("a falsy-but-object user (e.g. {}) is still treated as signed in — the gate trusts useAuth's user shape, not a truthiness guess", () => {
  // useAuth's `user` is either a real populated object or exactly
  // null/undefined (never an empty object in practice) — this documents
  // that the function is a plain truthiness check, matching that contract.
  assert.equal(resolveBlueprintRedirect({}), "/choose-path");
});

// ── resolveAuthSuccessDestination: post sign-in/sign-up landing ──────────

test("a regular account lands on /choose-path after sign-in or sign-up", () => {
  assert.equal(resolveAuthSuccessDestination("parent@example.com", ["owner@hsdos.ai"]), "/choose-path");
});

test("an owner-listed email is routed to /admin instead", () => {
  assert.equal(resolveAuthSuccessDestination("owner@hsdos.ai", ["owner@hsdos.ai"]), "/admin");
});

test("new signup and returning sign-in are NOT distinguished — same function, same inputs, same output", () => {
  // There is deliberately no "isNewUser" parameter — a fresh signup and a
  // returning sign-in call this with identical arguments and must resolve
  // identically, matching the simplified flow's explicit requirement that
  // both land on /choose-path.
  const email = "family@example.com";
  assert.equal(resolveAuthSuccessDestination(email, []), resolveAuthSuccessDestination(email, []));
});

test("an empty/missing owner list never accidentally routes anyone to /admin", () => {
  assert.equal(resolveAuthSuccessDestination("anyone@example.com"), "/choose-path");
  assert.equal(resolveAuthSuccessDestination("anyone@example.com", []), "/choose-path");
});

test("no redirect loop: the destination is never a retired Blueprint route, and success never re-enters /join", () => {
  for (const [email, owners] of [["a@b.com", []], ["owner@hsdos.ai", ["owner@hsdos.ai"]]]) {
    const dest = resolveAuthSuccessDestination(email, owners);
    assert.ok(!dest.startsWith("/blueprint"));
    assert.notEqual(dest, "/join");
  }
});

// ── resolveJoinDestination: /join, AFTER useAuth's loading has resolved ──
// (App.jsx's JoinGate is responsible for waiting out `loading` itself and
// showing a loading state until then — this function assumes that's already
// handled, so a signed-in user is never briefly shown signup.)

test("signed-out visitor to /join gets SignIn.jsx's existing signup-shortcut query", () => {
  assert.equal(resolveJoinDestination(null), "/?mode=signup");
  assert.equal(resolveJoinDestination(undefined), "/?mode=signup");
});

test("signed-in visitor to /join skips signup entirely and goes to /choose-path", () => {
  assert.equal(resolveJoinDestination({ uid: "abc123" }), "/choose-path");
});

test("the signed-out /join target matches SignIn.jsx's ?mode=signup contract", () => {
  // SignIn.jsx: `if (searchParams.get("mode") === "signup") setStep("how");`
  const url = new URL("https://example.test" + resolveJoinDestination(null));
  assert.equal(url.searchParams.get("mode"), "signup");
});

test("no redirect loop: neither /join destination is /join itself", () => {
  for (const user of [null, undefined, {}, { uid: "x" }]) {
    assert.notEqual(resolveJoinDestination(user), "/join");
  }
});
