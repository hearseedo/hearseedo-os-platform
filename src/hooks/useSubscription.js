import { useAuth } from "./useAuth";

export function useSubscription() {
  const { user } = useAuth();

  const subscriptions = user?.subscriptions ?? [];
  const plan          = user?.plan ?? "individual";

  function isUnlocked(appId) {
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
