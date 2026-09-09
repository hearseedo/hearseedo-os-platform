import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { PLANS } from "../constants/plans";
import { db, auth } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const PLAN_LIMITS = {
  free: 5, individual: 50, family: 100,
  "university-bundle": 150, organization: 999,
  phonics: 15, eiken: 15, sipswitch: 15, speak: 15, innerkey: 15, wondercamp: 15,
  kids_starter: 30, english_boost: 30, adult_growth: 30, adult_complete: 30,
  family_full: 30, family_core: 30, family_plus: 60, family_premium: 100, all_access: 100,
  "career-ready": 30, "global-ready": 30, "speak-ready": 30,
};

export default function Subscriptions({ user }) {
  const navigate = useNavigate();
  const [portalLoading, setPortalLoading] = useState(false);
  const [usedCount, setUsedCount] = useState(null);

  const planId        = user?.plan || "free";
  const plan          = PLANS.find(p => p.id === planId);
  const monthlyLimit  = plan?.aiAllowance ?? PLAN_LIMITS[planId] ?? 5;
  const isUnlimited   = planId === "organization" || planId === "all_access";
  const isFamily      = planId === "family" || planId.startsWith("family_");
  const canUpgrade    = planId === "free" || planId === "individual";
  const isPaid        = planId !== "free";
  const planColor     = plan?.color ?? COLORS.red;
  const familyMembers = user?.familyMembers ?? [];
  const maxMembers    = plan?.members ?? 5;

  useEffect(() => {
    if (!user?.uid || isUnlimited) { setUsedCount(0); return; }
    const monthJST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).slice(0, 7);
    getDoc(doc(db, "users", user.uid, "chatUsage", monthJST))
      .then(snap => setUsedCount(snap.exists() ? (snap.data().count ?? 0) : 0))
      .catch(() => setUsedCount(0));
  }, [user?.uid, isUnlimited]);

  const remaining  = isUnlimited ? Infinity : Math.max(0, monthlyLimit - (usedCount ?? 0));
  const fillRatio  = isUnlimited ? 1 : usedCount === null ? 1 : remaining / monthlyLimit;
  const barColor   = fillRatio > 0.5 ? COLORS.success : fillRatio > 0.2 ? COLORS.gold : COLORS.red;

  async function openPortal() {
    setPortalLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res  = await fetch("/api/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, email: user?.email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Could not open billing portal. Please contact support.");
    } catch {
      alert("Network error. Please try again.");
    }
    setPortalLoading(false);
  }

  const planDisplayName = plan?.name ?? "Explorer";
  const planNameJp      = plan?.nameJp ?? "エクスプローラー";

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>

      {/* ── Membership badge ──────────────────────────────────────────── */}
      <div style={{
        background: COLORS.card,
        border: "1px solid #1e1e1e",
        borderTop: `3px solid ${planColor}`,
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
          <img
            src="/assets/jona1.png"
            alt="Jona"
            style={{
              width: 52, height: 52, borderRadius: "50%",
              objectFit: "cover", objectPosition: "center 18%",
              flexShrink: 0,
              boxShadow: `0 0 16px ${planColor}44`,
            }}
          />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, lineHeight: 1.1 }}>
                {planDisplayName}
              </div>
              {plan?.badge && (
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                  textTransform: "uppercase", color: planColor,
                  background: `${planColor}1a`,
                  border: `1px solid ${planColor}44`,
                  borderRadius: 20, padding: "3px 10px",
                }}>
                  {plan.badge}
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>
              {planNameJp}
            </div>
            <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5, marginBottom: 16, maxWidth: 420 }}>
              {plan?.desc ?? "Start your English journey. No credit card needed."}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {canUpgrade && (
                <button
                  onClick={() => navigate("/plans")}
                  style={{
                    padding: "9px 20px", borderRadius: 8,
                    background: COLORS.red, border: "none",
                    color: "#fff", fontSize: 13, fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: `0 0 16px ${COLORS.redGlow}`,
                  }}
                >
                  Upgrade →
                </button>
              )}
              {isPaid && (
                <button
                  onClick={openPortal}
                  disabled={portalLoading}
                  style={{
                    padding: "9px 18px", borderRadius: 8,
                    background: "transparent", border: "1px solid #2a2a2a",
                    color: COLORS.textMuted, fontSize: 13, fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {portalLoading ? "Opening…" : "Manage billing"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Coaching Allowance ─────────────────────────────────────── */}
      <div style={{
        background: COLORS.card,
        border: "1px solid #1e1e1e",
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: COLORS.red,
          letterSpacing: 2, textTransform: "uppercase", marginBottom: 16,
        }}>
          Jona AI Coaching
        </div>

        {isUnlimited ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: COLORS.red, lineHeight: 1 }}>∞</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Unlimited sessions</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 3 }}>No monthly cap on your plan</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <img
                src="/assets/jona1.png"
                alt="Jona"
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  objectFit: "cover", objectPosition: "center 18%", flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
                  {usedCount === null
                    ? "Loading…"
                    : remaining === 0
                      ? "All sessions used this month"
                      : `${remaining} session${remaining !== 1 ? "s" : ""} remaining this month`}
                </div>
                {usedCount !== null && (
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                    {usedCount} of {monthlyLimit} used · Resets on the 1st
                  </div>
                )}
              </div>
            </div>

            <div style={{ height: 7, background: "#1e1e1e", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.round(fillRatio * 100)}%`,
                background: `linear-gradient(90deg, ${barColor}bb, ${barColor})`,
                borderRadius: 4,
                transition: "width 0.8s ease",
              }} />
            </div>

            {remaining === 0 && (
              <div style={{
                marginTop: 14, padding: "12px 16px",
                background: "rgba(224,16,16,0.06)",
                border: "1px solid rgba(224,16,16,0.15)",
                borderRadius: 10,
                fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6,
              }}>
                Your allowance renews on the 1st.{" "}
                {canUpgrade && (
                  <a
                    href="/plans"
                    style={{ color: COLORS.red, fontWeight: 600, textDecoration: "none" }}
                  >
                    Add a coaching pack →
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Family members ───────────────────────────────────────────── */}
      {isFamily && (
        <div style={{
          background: COLORS.card,
          border: "1px solid #1e1e1e",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: COLORS.red,
              letterSpacing: 2, textTransform: "uppercase",
            }}>
              Family Members
            </div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: familyMembers.length >= maxMembers ? COLORS.textMuted : COLORS.success,
            }}>
              {familyMembers.length}/{maxMembers} members
            </div>
          </div>

          {familyMembers.length === 0 ? (
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 14 }}>
              No family members added yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {familyMembers.map((m, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px",
                  background: "#0d0d0d", borderRadius: 10,
                  border: "1px solid #222",
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: `${planColor}22`,
                    border: `1px solid ${planColor}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: planColor, flexShrink: 0,
                  }}>
                    {(m.name ?? m.email ?? "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                      {m.name ?? m.email ?? `Member ${i + 1}`}
                    </div>
                    {m.email && m.name && (
                      <div style={{ fontSize: 11, color: COLORS.textMuted }}>{m.email}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {familyMembers.length < maxMembers && (
            <button
              onClick={() => navigate("/family")}
              style={{
                padding: "9px 18px", borderRadius: 8,
                background: "transparent",
                border: `1px solid ${planColor}44`,
                color: planColor, fontSize: 12, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Add family member →
            </button>
          )}
        </div>
      )}

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
