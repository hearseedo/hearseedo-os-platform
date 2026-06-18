import { useAuth } from "./useAuth";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "";

export function useSubscription() {
  const { user } = useAuth();

  const subscriptions = user?.subscriptions ?? [];
  const plan          = user?.plan ?? "individual";
  const isAdmin       = user?.email === ADMIN_EMAIL;

  function isUnlocked(appId) {
    if (isAdmin) return true;
    if (appId === "family") return true;
    return subscriptions.includes(appId);
  }

  // Determine default orbit view based on what the user has
  function defaultView() {
    const hasKids  = subscriptions.some((id) => ["phonics", "eiken", "speak", "wondercamp"].includes(id));
    const hasAdult = subscriptions.some((id) => ["sipswitch", "innerkey"].includes(id));
    if (hasKids && !hasAdult) return "kids";
    if (hasAdult && !hasKids) return "adult";
    return "all";
  }

  return { isUnlocked, plan, subscriptions, defaultView };
}
