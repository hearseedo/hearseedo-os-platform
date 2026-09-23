// Living Blueprint rebuild — feature flag
// Phase 7 cutover (2026-07-25) flipped this to enabled-for-everyone; fully
// retired 2026-09-23 ahead of the October AI Summit, including the
// owner-preview allowlist that used to keep it reachable for the admin
// account — no one needs to reach it anymore. The real Student/Adult/
// Educator pathway pages (src/pathways/) are the thing people should land
// on now. Code is untouched, nothing deleted — every /preview/* route
// simply falls back to /dashboard, unconditionally.
//
// To bring it back for everyone: change ENABLED_FOR_ALL back to true.
// To bring it back just for yourself while testing: re-add an allowlist
// check here rather than flipping the global flag.

const ENABLED_FOR_ALL = false;

export const LIVING_BLUEPRINT_PREVIEW_ROUTE = "/preview/shell";

export function isLivingBlueprintEnabled() {
  return ENABLED_FOR_ALL;
}
