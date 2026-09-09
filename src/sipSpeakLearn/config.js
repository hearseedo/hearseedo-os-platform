// Sip Speak Learn — feature flag + config
// Self-contained flag so the app stays isolated from the rest of the platform.
//
// Phase 8 cutover: flipped to enabled-for-everyone. The /sip-speak-learn
// route is already behind <ProtectedRoute> (App.jsx), so this only decides
// whether a signed-in user can reach it — it does not touch auth itself.
// To roll back instantly: change ENABLED_FOR_ALL to false below.
import { OWNER_PREVIEW_EMAILS } from "./constants";

const ENABLED_FOR_ALL = true;

export const SSL_ROUTE = "/sip-speak-learn";

// Spinning-drink media. Assets live in public/ssl/drinks/ as
// ssl-drink-{lessonId}-{cocktail|mocktail}.{mp4|png}.
//   DRINKS_MEDIA  — master switch (off = text-only drinks card, no requests)
//   DRINKS_FORMAT — "png" (transparent still + gentle CSS turn, current assets)
//                   or "video" (looping Sora .mp4, falls back to .png if missing)
export const DRINKS_MEDIA = true;
export const DRINKS_FORMAT = "png";

export function isSSLEnabled(user) {
  if (ENABLED_FOR_ALL) return true;
  try {
    if (import.meta.env?.DEV) return true;
    if (typeof localStorage !== "undefined" && localStorage.getItem("ssl_preview") === "1") return true;
  } catch {}
  if (user?.email && OWNER_PREVIEW_EMAILS.includes(user.email)) return true;
  return false;
}
