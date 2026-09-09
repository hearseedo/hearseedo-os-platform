// Monkey Yoga Phonics V2 — staging preview feature flag.
// Mirrors the sipSpeakLearn / Living Blueprint pattern: the /dev/phonics-v2
// route only mounts when this returns true, and it is NOT linked from any
// production navigation. Deliberately NOT "enabled for all" — this preview
// writes real progress via the real processAppEvent(), so it stays scoped to
// dev builds, the admin owner emails, or an explicit localStorage flag.
//
// Enable via any of:
//   • dev build (import.meta.env.DEV)
//   • owner/admin email
//   • localStorage flag: localStorage.setItem('phonics_v2_preview','1')
//
// This does NOT touch the live "phonics" app card, route, or iframe URL in
// apps.js — V1 keeps running exactly as it does today.

const OWNER_PREVIEW_EMAILS = [
  "hearseedo.english@gmail.com",
  "waltho79@gmail.com",
];

export const PHONICS_V2_PREVIEW_ROUTE = "/dev/phonics-v2";

// Where V2 is currently reachable. Points at the local dev server for now;
// swap to a deployed staging URL once V2 has one, without touching this file
// shape (still not the live phonics iframeUrl in apps.js).
export const PHONICS_V2_URL = import.meta.env?.VITE_PHONICS_V2_URL || "http://localhost:5175";

export function isPhonicsV2PreviewEnabled(user) {
  try {
    if (import.meta.env?.DEV) return true;
    if (typeof localStorage !== "undefined" && localStorage.getItem("phonics_v2_preview") === "1") return true;
  } catch {}
  if (user?.email && OWNER_PREVIEW_EMAILS.includes(user.email)) return true;
  return false;
}
