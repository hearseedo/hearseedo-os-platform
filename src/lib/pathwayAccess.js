// HSD OS AI — pathway access resolver (Phase 1, 2026-09-09).
//
// ONE authoritative place that answers "which pathways can this account
// access" — nothing else in the app should compute this independently.
//
// Two sources, in priority order:
//   1. account.pathwayAccess (new, explicit, privileged field — see
//      firestore.rules: only the service account or admin can set it).
//      Shape: { family: {source, grantedAt} | null, student: ..., adult: ..., educator: ... }
//   2. Compatibility inference from the account's EXISTING plan/subscriptions/
//      accountType — used only when pathwayAccess is entirely absent, i.e.
//      an account that predates Phase 1. This is what lets existing users
//      keep working with no forced migration (Phase 1 item 12/13).
//
// This module has no Firestore imports — it's pure, so it's unit-testable
// and can be mirrored server-side without pulling in the client SDK. The
// SERVER-SIDE mirror lives in netlify/functions/_pathwayAccess.js — keep
// the inference logic below in sync with that file if you change it (same
// constraint as _pricePlanMap.js, for the same module-system-boundary
// reason: netlify/functions is CommonJS-scoped and can't import this file).

// Fully-specified extension (Vite handles either form) so this pure,
// Firebase-free module can also be imported directly under plain Node for
// unit tests — see tests/pathway-access.test.js.
import { PATHWAY_IDS, APP_PATHWAY_MAP, PATHWAYS } from "../constants/pathways.js";

// Phase 2 — the four card states the pathway selector must support. Purely
// derived from data already resolved elsewhere (accessiblePathways, the
// pathway's own `enabled` flag, and account.visitedPathways) — never a
// separate, hand-maintained authorization check.
export const PATHWAY_STATES = {
  AVAILABLE:    "available",     // accessible AND previously entered — "Continue"
  ELIGIBLE:     "eligible",      // accessible but never entered — "Get Started" (first-time onboarding)
  LOCKED:       "locked",        // pathway is enabled but this account has no entitlement
  COMING_SOON:  "coming_soon",   // pathway itself isn't released yet (enabled: false in config)
};

/**
 * Compatibility inference for accounts with no pathwayAccess field yet.
 * Conservative by design (Phase 1 item 12): only ever ADDS access based on
 * clear existing signals, never removes, and never invents educator access
 * (no reliable existing signal for "this is a teacher/school account").
 */
export function inferLegacyPathways(account) {
  const subs = account?.subscriptions ?? [];
  const accessible = new Set();

  for (const appId of subs) {
    const pathway = APP_PATHWAY_MAP[appId];
    if (pathway) accessible.add(pathway);
  }
  if (account?.accountType === "family") accessible.add("family");

  // Conservative default: a paying account with no clearer signal is
  // treated as "adult" (item 12: "Existing adult users → adult pathway"),
  // rather than left with no pathway at all.
  if (accessible.size === 0 && account?.plan && account.plan !== "free") {
    accessible.add("adult");
  }

  return [...accessible];
}

/**
 * Returns the list of pathway ids this account can currently access.
 * @param {object} account - the account object from useAuth's `user`
 *   (must include at least: pathwayAccess, plan, subscriptions, accountType, isAdmin)
 * @param {boolean} isAdmin - computed separately in useAuth (email allowlist),
 *   passed in rather than read from `account` since it isn't stored on the doc.
 */
export function getAccessiblePathways(account, isAdmin = false) {
  if (!account) return [];

  // Admins get every pathway — matches existing isAdmin behavior elsewhere
  // (useSubscription.js: isAdmin bypasses every other access check).
  if (isAdmin) return [...PATHWAY_IDS];

  if (account.pathwayAccess && typeof account.pathwayAccess === "object") {
    const explicit = PATHWAY_IDS.filter(id => !!account.pathwayAccess[id]);
    // Even an account with an explicit pathwayAccess map might have been
    // migrated before a newer pathway existed, or a grant might have been
    // revoked leaving the map present but empty for everything — in either
    // case, still fall back to inference rather than leaving the account
    // with zero pathways.
    if (explicit.length > 0) return explicit;
  }

  return inferLegacyPathways(account);
}

/** True if this account currently has access to a specific pathway. */
export function hasPathwayAccess(account, pathwayId, isAdmin = false) {
  return getAccessiblePathways(account, isAdmin).includes(pathwayId);
}

/**
 * Resolves the card/route state for one pathway — the single place the
 * selector, PathwayCard, and the route guard all ask "can this account see
 * this, and have they been here before". Data-authoritative: `accessible`
 * must come from getAccessiblePathways() (real entitlement data), never a
 * client-side guess.
 */
export function getPathwayState(pathwayId, { accessible, visitedPathways = [] }) {
  const config = PATHWAYS[pathwayId];
  if (!config?.enabled) return PATHWAY_STATES.COMING_SOON;
  if (!accessible) return PATHWAY_STATES.LOCKED;
  return visitedPathways.includes(pathwayId) ? PATHWAY_STATES.AVAILABLE : PATHWAY_STATES.ELIGIBLE;
}

// ── Pathway routing cutover (2026-09-10) ────────────────────────────────────
// Extracted from useAuth.jsx's inline logic (no behavior change) so it's a
// pure, unit-testable function — same reasoning as everything above: ONE
// place answers this question, shared by useAuth (computes `currentPathway`
// for every consumer), Blueprint.jsx (first entry after sign-in) and
// App.jsx's DashboardEntry (guards direct /dashboard visits), rather than
// three independent inline implementations that could drift.

/**
 * Resolves `lastUsedPathway` into the one this account can actually use
 * right now — null unless it's both set AND still in accessiblePathways
 * (covers "never chosen one", "invalid/unrecognized id", and "access since
 * revoked" in a single check). Deliberately NOT auto-selected otherwise —
 * an account with no valid current pathway must go through the selector.
 */
export function resolveCurrentPathway(account, accessiblePathways) {
  if (!account?.lastUsedPathway) return null;
  return accessiblePathways.includes(account.lastUsedPathway) ? account.lastUsedPathway : null;
}

/**
 * Where an authenticated account should land given its resolved
 * currentPathway. A pathway that's since become disabled/coming-soon isn't
 * special-cased here — routing into it is handled for free by
 * PathwayRoute's existing LOCKED/COMING_SOON guard, which bounces back to
 * /choose-path on its own.
 */
export function resolvePathwayDestination(currentPathway) {
  return currentPathway ? PATHWAYS[currentPathway].route : "/choose-path";
}
