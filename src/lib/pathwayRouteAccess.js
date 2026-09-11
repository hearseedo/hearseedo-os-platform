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
