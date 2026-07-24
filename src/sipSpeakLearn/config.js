// Sip Speak Learn — feature flag + config
// Self-contained flag so the app stays isolated from the rest of the platform.
// The /sip-speak-learn route only mounts when this returns true, and it is NOT
// linked from production navigation until Phase 8 integration is approved.
//
// Enable via any of:
//   • dev build (import.meta.env.DEV)
//   • admin email
//   • localStorage flag: localStorage.setItem('ssl_preview','1')
import { OWNER_PREVIEW_EMAILS } from "./constants";

export const SSL_ROUTE = "/sip-speak-learn";

// Spinning-drink media. Assets live in public/ssl/drinks/ as
// ssl-drink-{lessonId}-{cocktail|mocktail}.{mp4|png}.
//   DRINKS_MEDIA  — master switch (off = text-only drinks card, no requests)
//   DRINKS_FORMAT — "png" (transparent still + gentle CSS turn, current assets)
//                   or "video" (looping Sora .mp4, falls back to .png if missing)
export const DRINKS_MEDIA = true;
export const DRINKS_FORMAT = "png";

export function isSSLEnabled(user) {
  try {
    if (import.meta.env?.DEV) return true;
    if (typeof localStorage !== "undefined" && localStorage.getItem("ssl_preview") === "1") return true;
  } catch {}
  if (user?.email && OWNER_PREVIEW_EMAILS.includes(user.email)) return true;
  return false;
}
