// Computes a World's access/progress state from the real subscription data
// already on the user profile (useAuth), against the real access rules in
// constants/appRegistry.js. Rebuild prompt section 11: locked access must
// always explain what's locked, why, what the user can still do, and what
// unlocks it — so this returns the reason, not just a boolean.
import { APP_REGISTRY_MAP } from "../../constants/appRegistry";

export function getWorldAccess(world, user) {
  const app = APP_REGISTRY_MAP[world.id];
  const requirements = app?.subscriptionRequirements ?? [];
  const isAdmin = !!user?.isAdmin;
  const subscriptions = user?.subscriptions ?? [];

  const isFree = requirements.includes("free") || requirements.length === 0;
  const hasAccess = isAdmin || isFree || requirements.some(r => subscriptions.includes(r));

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
