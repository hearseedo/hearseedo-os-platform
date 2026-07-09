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
    if (appId === "career-ready") return true;
    if (appId === "global-ready") return true;
    // Workbook bonus: 1 free month of full access
    if (user?.workbookBonusRedeemed) {
      const endRaw = user?.workbookBonusEndDate;
      if (endRaw) {
        const end = endRaw?.toDate ? endRaw.toDate() : new Date(endRaw);
        if (new Date() < end) return true;
      }
    }
    return subscriptions.includes(appId);
  }

  // Days remaining on workbook free trial (-1 if not active)
  function workbookDaysRemaining() {
    if (!user?.workbookBonusRedeemed) return -1;
    const endRaw = user?.workbookBonusEndDate;
    if (!endRaw) return -1;
    const end  = endRaw?.toDate ? endRaw.toDate() : new Date(endRaw);
    const diff = Math.ceil((end - new Date()) / 86400000);
    return diff > 0 ? diff : 0;
  }

  // Determine default orbit view based on what the user has
  function defaultView() {
    const hasKids  = subscriptions.some((id) => ["phonics", "eiken", "speak", "wondercamp"].includes(id));
    const hasAdult = subscriptions.some((id) => ["sipswitch", "innerkey"].includes(id));
    if (hasKids && !hasAdult) return "kids";
    if (hasAdult && !hasKids) return "adult";
    return "all";
  }

  return { isUnlocked, plan, subscriptions, defaultView, workbookDaysRemaining };
}
