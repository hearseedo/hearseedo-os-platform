// Founding Member = first 200 PAYING users — awarded by Stripe webhook, not on signup

export const FOUNDING_LIMIT = 200;

// The single founding member badge
export const FOUNDING_BADGE = {
  id:       "founding_member",
  name:     "Founding Member",
  subtitle: "001 / 200",
  image:    "/assets/badges/founding-member.svg",
  color:    "#e01010",
  glow:     "rgba(224,16,16,0.4)",
};

// Referral badges — awarded based on active paying referrals
export const REFERRAL_BADGES = {
  visionary: {
    id:       "visionary",
    name:     "Visionary",
    subtitle: "250+",
    image:    "/assets/badges/visionary.svg",
    color:    "#C9A84C",
    glow:     "rgba(201,168,76,0.4)",
  },
  pioneer: {
    id:       "pioneer",
    name:     "Pioneer",
    subtitle: "100+",
    image:    "/assets/badges/pioneer.svg",
    color:    "#e01010",
    glow:     "rgba(224,16,16,0.4)",
  },
  ambassador: {
    id:       "ambassador",
    name:     "Ambassador",
    subtitle: "50+",
    image:    "/assets/badges/ambassador.svg",
    color:    "#aaaaaa",
    glow:     "rgba(170,170,170,0.3)",
  },
};

// Legacy Founder is the top 100 referrers — computed in admin, stored as isLegacyFounder flag
export const LEGACY_FOUNDER_BADGE = {
  id:       "legacy_founder",
  name:     "Legacy Founder",
  subtitle: "Top 100",
  image:    "/assets/badges/legacy-founder.svg",
  color:    "#C9A84C",
  glow:     "rgba(201,168,76,0.5)",
};

// Contributor badge — manually awarded by admin when a user's idea ships
export const CONTRIBUTOR_BADGE = {
  id:       "contributor",
  name:     "Contributor",
  subtitle: "Idea shipped",
  image:    "/assets/badges/contributor.svg",
  color:    "#06b6d4",
  glow:     "rgba(6,182,212,0.4)",
};

export function getBadgeConfig(badgeId) {
  if (badgeId === "founding_member") return FOUNDING_BADGE;
  if (badgeId === "legacy_founder")  return LEGACY_FOUNDER_BADGE;
  if (badgeId === "contributor")     return CONTRIBUTOR_BADGE;
  return REFERRAL_BADGES[badgeId] ?? null;
}
