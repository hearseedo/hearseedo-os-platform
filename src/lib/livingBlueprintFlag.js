// Living Blueprint rebuild — feature flag
// Mirrors the sipSpeakLearn/config.js pattern: the rebuilt shell only mounts
// when this returns true, and stays off production nav until Phase 7
// cutover approval (rebuild prompt section 20, Phase 7).
//
// Enable via any of:
//   • dev build (import.meta.env.DEV)
//   • owner/admin email
//   • localStorage flag: localStorage.setItem('living_blueprint_preview','1')

const OWNER_PREVIEW_EMAILS = [
  import.meta.env?.VITE_ADMIN_EMAIL,
  "waltho79@gmail.com",
  "hearseedo.english@gmail.com",
].filter(Boolean);

export const LIVING_BLUEPRINT_PREVIEW_ROUTE = "/preview/shell";

export function isLivingBlueprintEnabled(user) {
  try {
    if (import.meta.env?.DEV) return true;
    if (typeof localStorage !== "undefined" && localStorage.getItem("living_blueprint_preview") === "1") return true;
  } catch {}
  if (user?.email && OWNER_PREVIEW_EMAILS.includes(user.email)) return true;
  return false;
}
