import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { PLANS } from "../constants/plans";
import { APPS } from "../constants/apps";

export default function Subscriptions({ user }) {
  const navigate   = useNavigate();
  const [portalLoading, setPortalLoading] = useState(false);
  const planId     = user?.plan || "free";
  const plan       = PLANS.find(p => p.id === planId);
  const subs       = user?.subscriptions || [];
  const aiLimit    = user?.aiMsgLimit ?? 5;
  const subId      = user?.stripeSubId;
  const updatedAt  = user?.planUpdatedAt ? new Date(user.planUpdatedAt).toLocaleDateString("en-GB") : null;

  const unlockedApps = APPS.filter(a => subs.includes(a.id));
  const lockedApps   = APPS.filter(a => !subs.includes(a.id));

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Could not open billing portal. Please contact support.");
    } catch {
      alert("Network error. Please try again.");
    }
    setPortalLoading(false);
  }

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>

      {/* Current plan banner */}
      <div style={{
        background: planId === "free"
          ? "#0d0d0d"
          : "linear-gradient(135deg, #1a0000, #0d0000)",
        border: `1px solid ${planId === "free" ? "#2a2a2a" : "rgba(224,16,16,0.3)"}`,
        borderRadius: 16, padding: 24, marginBottom: 24,
        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
      }}>
        <img src="/assets/jona.png" alt="Jona" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", filter: "drop-shadow(0 0 10px rgba(224,16,16,0.5))", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
            {planId === "free" ? "Free Plan" : "Active Subscription"}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            {plan?.name ?? "Free"}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>
            {planId === "free"
              ? "Upgrade to unlock apps and increase your AI chat limit."
              : `${aiLimit === 100 ? "∞ Unlimited" : aiLimit} AI messages/day · ${unlockedApps.length} app${unlockedApps.length !== 1 ? "s" : ""} unlocked`}
          </div>
          {updatedAt && <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>Last updated {updatedAt}</div>}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {planId !== "free" && (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              style={{
                padding: "9px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: "transparent", border: "1px solid #2a2a2a",
                color: COLORS.textMuted, cursor: "pointer",
              }}
            >
              {portalLoading ? "Opening…" : "Manage / Cancel"}
            </button>
          )}
          <button
            onClick={() => navigate("/plans")}
            style={{
              padding: "9px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: COLORS.red, border: "none", color: "#fff", cursor: "pointer",
            }}
          >
            {planId === "free" ? "Choose a Plan →" : "Change Plan →"}
          </button>
        </div>
      </div>

      {/* AI Chat usage */}
      <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
          Jona AI Chat
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div>
            <div style={{ fontSize: 32, fontWeight: 800, color: aiLimit === 100 ? COLORS.red : COLORS.text }}>
              {aiLimit === 100 ? "∞" : aiLimit}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>messages per day</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 6, background: "#1e1e1e", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: aiLimit === 100 ? "100%" : `${(aiLimit / 100) * 100}%`,
                background: aiLimit === 100
                  ? `linear-gradient(90deg, ${COLORS.red}, #ff6b35)`
                  : `linear-gradient(90deg, #2a2a2a, ${COLORS.red})`,
                borderRadius: 3, transition: "width 1s ease",
              }} />
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6 }}>
              {aiLimit === 100
                ? "Unlimited — All Access plan"
                : aiLimit <= 5
                  ? "Upgrade to unlock more AI conversations"
                  : `${aiLimit} daily messages included with your plan`}
            </div>
          </div>
        </div>
      </div>

      {/* Unlocked apps */}
      {unlockedApps.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.success, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
            ✓ Unlocked Apps ({unlockedApps.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 12 }}>
            {unlockedApps.map(app => <AppTile key={app.id} app={app} unlocked />)}
          </div>
        </div>
      )}

      {/* Locked apps */}
      {lockedApps.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
            Locked Apps ({lockedApps.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 12 }}>
            {lockedApps.map(app => <AppTile key={app.id} app={app} unlocked={false} />)}
          </div>
        </div>
      )}

      {planId === "free" && (
        <div style={{ textAlign: "center", marginTop: 32, padding: 24, background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Ready to unlock the full HSD experience?</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16 }}>
            Individual apps from ¥833/mo · Bundles from ¥1,853/mo · All Access ¥4,680/mo
          </div>
          <button
            onClick={() => navigate("/plans")}
            style={{ padding: "12px 32px", background: COLORS.red, border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 0 20px rgba(224,16,16,0.3)" }}
          >
            View All Plans →
          </button>
        </div>
      )}

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

function AppTile({ app, unlocked }) {
  return (
    <div style={{
      background: COLORS.card, border: `1px solid ${unlocked ? "#2a2a2a" : "#1a1a1a"}`,
      borderRadius: 12, padding: 16, textAlign: "center",
      opacity: unlocked ? 1 : 0.45,
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", margin: "0 auto 10px", position: "relative" }}>
        <img src={app.image} alt={app.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: unlocked ? "none" : "grayscale(1)" }} />
        {!unlocked && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🔒</div>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: unlocked ? COLORS.text : COLORS.textMuted, marginBottom: 4 }}>{app.name}</div>
      {unlocked
        ? <div style={{ fontSize: 10, color: COLORS.success }}>✓ Active</div>
        : <div style={{ fontSize: 10, color: "#555" }}>Locked</div>
      }
    </div>
  );
}
