import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { FOUNDING_LIMIT } from "../lib/founding";
import { COLORS } from "../constants/colors";

const DISMISS_KEY = "hsd_founding_banner_dismissed";
const GOLD        = "#C9A84C";

export default function FoundingBanner({ user, navigate }) {
  const [count,     setCount]     = useState(null);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "meta", "signups"), snap => {
      setCount(snap.exists() ? (snap.data().count ?? 0) : 0);
    });
    return unsub;
  }, []);

  // Hide for existing founding members, org/all-access, or if window closed
  if (user?.isFoundingMember)                             return null;
  if (["organization", "all_access"].includes(user?.plan)) return null;
  if (count !== null && count >= FOUNDING_LIMIT)          return null;
  if (dismissed)                                          return null;

  const spotsLeft = count === null ? null : FOUNDING_LIMIT - count;
  const pct       = count === null ? 0 : Math.min(100, (count / FOUNDING_LIMIT) * 100);
  const urgent    = spotsLeft !== null && spotsLeft <= 20;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div style={{
      position:     "relative",
      background:   "linear-gradient(135deg, #1a1400 0%, #0e0e0e 100%)",
      border:       `1px solid ${GOLD}55`,
      borderRadius: 14,
      padding:      "16px 18px",
      overflow:     "hidden",
    }}>
      {/* Subtle gold shimmer line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${GOLD}88, transparent)`,
      }} />

      {/* Dismiss */}
      <button
        onClick={dismiss}
        style={{
          position: "absolute", top: 10, right: 12,
          background: "none", border: "none", cursor: "pointer",
          color: COLORS.textMuted, fontSize: 16, lineHeight: 1, padding: 4,
        }}
        aria-label="Dismiss"
      >×</button>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>🏅</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: GOLD, letterSpacing: 1.5, textTransform: "uppercase" }}>
            Founding Member Offer
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 1 }}>
            {spotsLeft === null
              ? "Loading…"
              : urgent
                ? `Only ${spotsLeft} spots left — window closing soon`
                : `${spotsLeft} of ${FOUNDING_LIMIT} spots remaining`}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "#1e1e1e", borderRadius: 4, marginBottom: 12, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width:  `${pct}%`,
          background: `linear-gradient(90deg, ${GOLD}, #e01010)`,
          borderRadius: 4,
          transition: "width 0.6s ease",
        }} />
      </div>

      {/* Copy + CTA */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.5, flex: 1 }}>
          Join now and lock in <strong style={{ color: GOLD }}>15% off every plan, forever.</strong>
          <br />
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>Price never increases for founding members.</span>
        </div>
        <button
          onClick={() => navigate("/plans")}
          style={{
            background:   `linear-gradient(135deg, ${GOLD}, #a8843a)`,
            border:       "none",
            borderRadius: 10,
            color:        "#0a0a0a",
            fontWeight:   800,
            fontSize:     13,
            padding:      "10px 18px",
            cursor:       "pointer",
            whiteSpace:   "nowrap",
            flexShrink:   0,
            boxShadow:    `0 4px 16px ${GOLD}44`,
          }}
        >
          Claim Your Spot →
        </button>
      </div>
    </div>
  );
}
