// Computes a World's access/progress state. Rebuild prompt section 11:
// locked access must always explain what's locked, why, what the user can
// still do, and what unlocks it — so this returns the reason, not just a
// boolean.
//
// The actual unlocked/locked decision is delegated to the real
// hooks/useSubscription.js checks instead of a second reimplementation —
// two bugs already came from drift: HSD Family showed "Locked" when the
// live app treats it as always free (isUnlocked has a hardcoded
// appId==="family" case), and Career/Global/Speak Ready are NOT actually
// free-for-everyone despite appRegistry.js declaring `subscriptionRequirements:
// ["free"]" — the real pages (CareerReady.jsx, GlobalReady.jsx,
// SpeakReady.jsx) gate on dedicated hasCareerReady()/hasGlobalReady()/
// hasSpeakReady() from useSubscription(), which check subscriptions/
// university-bundle/access-pass, not a "free" tier. Pass the whole
// useSubscription() return value so this routes to whichever check is
// actually real for that id.
import { APP_REGISTRY_MAP } from "../../constants/appRegistry";

const DEDICATED_CHECK = {
  "career-ready": "hasCareerReady",
  "global-ready": "hasGlobalReady",
  "speak-ready":  "hasSpeakReady",
};

export function getWorldAccess(world, user, subscription) {
  const app = APP_REGISTRY_MAP[world.id];
  const requirements = app?.subscriptionRequirements ?? [];

  let hasAccess;
  if (subscription) {
    const dedicated = DEDICATED_CHECK[world.id];
    hasAccess = dedicated ? subscription[dedicated]() : subscription.isUnlocked(world.id);
  } else {
    hasAccess = requirements.includes("free") || requirements.length === 0;
  }

  if (hasAccess) {
    return { status: "unlocked", reason: null };
  }

  return {
    status: "locked",
    reason: `Requires ${formatRequirements(requirements)}.`,
    unlockPath: "/plans",
    unlockLabel: "See plans",
  };
}

function formatRequirements(requirements) {
  const readable = requirements.filter(r => r !== "free");
  if (readable.length === 0) return "a paid plan";
  if (readable.length === 1) return `the ${readable[0]} plan`;
  return `one of: ${readable.join(", ")}`;
}
