// Living Blueprint rebuild — feature flag
// Phase 7 cutover (2026-07-25) flipped this to enabled-for-everyone; rolled
// back 2026-09-23 ahead of the October AI Summit — the real Student/Adult/
// Educator pathway pages (src/pathways/) are now the thing people should
// land on, and Living Blueprint's own /preview/* experience was causing
// confusion (looks like a second, older site). Code is untouched, nothing
// deleted — only unreachable for everyone except the owner-preview
// allowlist below, same as before the July flip.
//
// To re-enable for everyone: change ENABLED_FOR_ALL back to true.

const ENABLED_FOR_ALL = false;

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
