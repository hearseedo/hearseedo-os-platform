import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

// Referral badge thresholds
export const REFERRAL_TIERS = [
  { id: "legacy_founder", min: 250, label: "Legacy Founder", subtitle: "Top 100", image: "/assets/badges/legacy-founder.svg", color: "#C9A84C", glow: "rgba(201,168,76,0.4)" },
  { id: "visionary",      min: 250, label: "Visionary",      subtitle: "250+",     image: "/assets/badges/visionary.svg",      color: "#C9A84C", glow: "rgba(201,168,76,0.35)" },
  { id: "pioneer",        min: 100, label: "Pioneer",        subtitle: "100+",     image: "/assets/badges/pioneer.svg",        color: "#e01010", glow: "rgba(224,16,16,0.4)" },
  { id: "ambassador",     min: 50,  label: "Ambassador",     subtitle: "50+",      image: "/assets/badges/ambassador.svg",     color: "#aaaaaa", glow: "rgba(170,170,170,0.3)" },
];

// Returns the badge id based on referral count and whether they're in the top 100
export function getReferralBadge(referralCount, isTop100 = false) {
  if (!referralCount || referralCount < 50) return null;
  if (referralCount >= 250 && isTop100) return "legacy_founder";
  if (referralCount >= 250) return "visionary";
  if (referralCount >= 100) return "pioneer";
  return "ambassador";
}

export function getReferralTierConfig(badgeId) {
  return REFERRAL_TIERS.find(t => t.id === badgeId) ?? null;
}

// Returns the referral link for a user — ref param IS the uid (simple, no extra storage)
export function getReferralLink(uid) {
  const base = window.location.origin;
  return `${base}/signin?ref=${uid}&mode=signup`;
}

// Called after a new user signs up — server-side via apply-referral function
export async function applyReferral(referredUid, referrerUid) {
  if (!referredUid || !referrerUid || referredUid === referrerUid) return;
  try {
    await fetch("/api/apply-referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referredUid, referrerUid }),
    });
  } catch (e) {
    console.error("applyReferral error:", e);
  }
}

// Read pending referral code from sessionStorage (set when landing on signup page)
export function getPendingReferrer() {
  return sessionStorage.getItem("hsd_referrer") ?? null;
}

export function setPendingReferrer(uid) {
  if (uid) sessionStorage.setItem("hsd_referrer", uid);
}

export function clearPendingReferrer() {
  sessionStorage.removeItem("hsd_referrer");
}
