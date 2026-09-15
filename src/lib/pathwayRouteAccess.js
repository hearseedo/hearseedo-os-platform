// Phase 3.2 hardening (2026-09-12) — pure decision logic for
// PathwayRoute.jsx, extracted for the same reason curriculumRouting.js and
// pathwayAccess.js are pure: this needs to be directly unit-testable
// without mounting React or a Firestore emulator.
//
// Distinguishes FOUR states, where the original code only had two
// ("loading" vs "resolved"). The bug this fixes: a denied/failed Firestore
// listener left `profileReady` false and `pathwayStates` empty forever,
// which the old code could not tell apart from "these pathwayStates are a
// genuine, resolved LOCKED answer" — so it redirected to /choose-path as
// though access had been checked and denied, when really it was never
// checked at all.
import { PATHWAY_STATES } from "./pathwayAccess.js";

/**
 * @typedef {"loading"|"error"|"redirect"|"allow"} PathwayRouteDecision
 *
 * @param {object} params
 * @param {boolean} params.loading - Firebase Auth itself still resolving
 * @param {string|null} params.profileError - set if the account-doc or
 *   familyMembers listener errored (see useAuth.jsx)
 * @param {boolean} params.profileReady - true once the first account-doc
 *   snapshot has been received (success OR the initial load, NOT set on error)
 * @param {string|undefined} params.pathwayState - pathwayStates[pathwayId]
 * @param {string} params.pathwayId
 * @param {boolean} params.familyEnabled - family kill-switch flag
 * @returns {{ decision: PathwayRouteDecision, reason?: string }}
 */
export function resolvePathwayRouteAccess({ loading, profileError, profileReady, pathwayState, pathwayId, familyEnabled }) {
  if (loading) return { decision: "loading" };

  // Never treated as "locked" and never redirects — a load error means we
  // don't know the real answer, not that the answer is "no access".
  if (profileError) return { decision: "error", reason: profileError };

  // Still waiting on the first real snapshot — same "we don't know yet"
  // principle as above, just the normal (non-error) path through it.
  if (!profileReady) return { decision: "loading" };

  if (pathwayState === PATHWAY_STATES.LOCKED || pathwayState === PATHWAY_STATES.COMING_SOON) {
    return { decision: "redirect", reason: pathwayState };
  }
  if (pathwayId === "family" && !familyEnabled) {
    return { decision: "redirect", reason: "disabled" };
  }
  return { decision: "allow" };
}

/**
 * Resolves which profile should be considered "current" for an account,
 * validating the persisted activeProfileId against the LIVE familyMembers
 * list rather than trusting it blindly. Mirrors useAuth.jsx's
 * currentProfile derivation exactly — extracted here so the restoration
 * behavior (including the deleted-profile and cross-child-isolation
 * cases) is directly testable.
 *
 * @param {Array<{id: string}>} profiles - getProfiles(account, familyMembers) output
 * @param {string|null|undefined} activeProfileId
 * @returns {object|null}
 */
export function resolveCurrentProfile(profiles, activeProfileId) {
  return profiles.find(p => p.id === activeProfileId) ?? profiles[0] ?? null;
}

// Phase 4A (2026-09-13) — retiring the legacy Blueprint onboarding chain
// (JoinFlow "Who is joining HSDOS?" -> Blueprint "Building your
// Blueprint..." -> old resolvePathwayDestination) and the separate,
// never-launched src/livingBlueprint/ rebuild, in favor of the simplified
// entry flow: Welcome -> Join or Sign in -> Choose Your Path -> Pathway
// Home. Pure decision functions so the retired-route redirects and the
// post-auth landing are directly unit-testable.

/**
 * Where a signed-in vs signed-out visitor to a retired Blueprint URL
 * (/blueprint, /blueprint/*) should land. Never redirects back into the
 * retired system itself, so it can't produce a redirect loop.
 * @param {object|null|undefined} user - useAuth's `user` (real object or null/undefined)
 * @returns {"/choose-path"|"/join"}
 */
export function resolveBlueprintRedirect(user) {
  return user ? "/choose-path" : "/join";
}

/**
 * Where the /join compatibility route should land, once Firebase Auth has
 * resolved (callers must gate on useAuth's `loading` themselves and show a
 * loading state first — this function assumes that's already handled, so it
 * never has to guess and never briefly sends an authenticated user through
 * signup). Signed-out visitors get SignIn.jsx's existing ?mode=signup
 * shortcut (the same state one click of "Begin Your Journey" produces, so no
 * second click is required); signed-in visitors skip signup entirely and go
 * straight to the pathway selector.
 * @param {object|null|undefined} user - useAuth's `user`, AFTER loading has resolved
 * @returns {"/choose-path"|"/?mode=signup"}
 */
export function resolveJoinDestination(user) {
  return user ? "/choose-path" : "/?mode=signup";
}

/**
 * Where a successful sign-in or sign-up should land. Deliberately takes no
 * "isNewUser" flag — a fresh signup and a returning sign-in resolve
 * identically, matching the simplified flow's requirement that both land
 * on /choose-path.
 * @param {string} email
 * @param {string[]} [ownerEmails]
 * @returns {"/admin"|"/choose-path"}
 */
export function resolveAuthSuccessDestination(email, ownerEmails = []) {
  return ownerEmails.includes(email) ? "/admin" : "/choose-path";
}
