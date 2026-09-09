import { useAuth } from "./useAuth";

const OWNER_EMAILS = [import.meta.env.VITE_ADMIN_EMAIL, "waltho79@gmail.com"].filter(Boolean);

export function useSubscription() {
  const { user } = useAuth();

  const subscriptions = user?.subscriptions ?? [];
  const plan          = user?.plan ?? "individual";
  const isAdmin       = OWNER_EMAILS.includes(user?.email);

  // Access pass: 1 month full platform access via promotional code
  function hasAccessPass() {
    if (isAdmin) return true;
    const pass = user?.accessPass;
    if (!pass || pass.status !== "active") return false;
    if (!pass.expiresAt) return false;
    return new Date(pass.expiresAt) > new Date();
  }

  // Bundle plans that unlock all standard apps when active
  const BUNDLE_PLANS = ["individual", "family", "university-bundle", "all_access",
    "family_core", "family_plus", "family_premium", "kids_starter",
    "english_boost", "adult_growth", "adult_complete", "adult_bundle"];

  function isUnlocked(appId) {
    if (isAdmin) return true;
    if (hasAccessPass()) return true;
    if (appId === "family") return true;
    // Sip Speak Learn isn't part of the subscription model (see
    // constants/experiences.js) — free for any signed-in user, same as family.
    if (appId === "sip-speak-learn") return true;
    // The HSD Album tile is always reachable — its 4 seasonal CDs are free for
    // everyone, and the 5 premium CDs are gated inside the album site itself
    // (same Firebase project, checked client-side against this same user doc).
    if (appId === "music-album") return true;
    // Workbook bonus: 1 free month of full access
    if (user?.workbookBonusRedeemed) {
      const endRaw = user?.workbookBonusEndDate;
      if (endRaw) {
        const end = endRaw?.toDate ? endRaw.toDate() : new Date(endRaw);
        if (new Date() < end) return true;
      }
    }
    // Plan-level fallback: bundle plans unlock everything even if subscriptions[] is stale
    if (user?.planStatus === "active" && BUNDLE_PLANS.includes(plan)) return true;
    return subscriptions.includes(appId);
  }

  const hasUniversityBundle = user?.planStatus === "active" && plan === "university-bundle";

  function hasCareerReady() {
    if (isAdmin) return true;
    if (hasAccessPass()) return true;
    if (hasUniversityBundle) return true;
    return subscriptions.includes("career-ready") || subscriptions.includes("university");
  }

  function hasGlobalReady() {
    if (isAdmin) return true;
    if (hasAccessPass()) return true;
    if (hasUniversityBundle) return true;
    return subscriptions.includes("global-ready") || subscriptions.includes("university");
  }

  function hasSpeakReady() {
    if (isAdmin) return true;
    if (hasAccessPass()) return true;
    if (hasUniversityBundle) return true;
    return subscriptions.includes("speak-ready") || subscriptions.includes("university");
  }

  function hasUniversity() {
    return isAdmin || hasAccessPass() || hasUniversityBundle ||
      subscriptions.some(s => ["career-ready","global-ready","speak-ready","university"].includes(s));
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

  return { isUnlocked, hasAccessPass, plan, subscriptions, defaultView, workbookDaysRemaining, hasCareerReady, hasGlobalReady, hasSpeakReady, hasUniversity };
}
