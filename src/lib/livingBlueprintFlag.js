// Living Blueprint rebuild — feature flag
// Phase 7 cutover (2026-07-25): flipped to enabled-for-everyone. This does
// NOT replace any live route — /dashboard, /welcome etc. are untouched.
// It only makes /preview/* reachable for every signed-in user instead of
// just admins/dev. Full authenticated-flow testing (real subscriptions,
// real family data, real AI credits) was NOT completed before this flip —
// acceptable here because there are no paying users yet, but revisit before
// ever doing a real route-replacement cutover.
//
// To roll back instantly: change ENABLED_FOR_ALL to false below — every
// /preview/* route immediately falls back to /dashboard for non-admins.

const ENABLED_FOR_ALL = true;

const OWNER_PREVIEW_EMAILS = [
  import.meta.env?.VITE_ADMIN_EMAIL,
  "waltho79@gmail.com",
  "hearseedo.english@gmail.com",
].filter(Boolean);

export const LIVING_BLUEPRINT_PREVIEW_ROUTE = "/preview/shell";

export function isLivingBlueprintEnabled(user) {
  if (ENABLED_FOR_ALL) return true;
  try {
    if (import.meta.env?.DEV) return true;
    if (typeof localStorage !== "undefined" && localStorage.getItem("living_blueprint_preview") === "1") return true;
  } catch {}
  if (user?.email && OWNER_PREVIEW_EMAILS.includes(user.email)) return true;
  return false;
}
