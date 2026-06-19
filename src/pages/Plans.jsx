import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { PLANS } from "../constants/plans";
import { useAuth } from "../hooks/useAuth";
import { auth } from "../lib/firebase";

const CURRENCIES = [
  { code: "jpy", symbol: "¥", label: "JPY", rate: 1 },
  { code: "usd", symbol: "$", label: "USD", rate: 0.0067 },
  { code: "gbp", symbol: "£", label: "GBP", rate: 0.0053 },
  { code: "eur", symbol: "€", label: "EUR", rate: 0.0062 },
  { code: "aud", symbol: "A$", label: "AUD", rate: 0.0103 },
];

function formatPrice(yenAmount, currency, billing) {
  const amount = yenAmount * currency.rate;
  if (currency.code === "jpy") return `¥${yenAmount.toLocaleString()}`;
  return `${currency.symbol}${amount.toFixed(0)}`;
}

export default function Plans() {
  const { user }        = useAuth();
  const navigate        = useNavigate();
  const [billing, setBilling]     = useState("monthly");
  const [currency, setCurrency]   = useState(CURRENCIES[0]);
  const [loading, setLoading]     = useState(null);
  const [error, setError]         = useState("");

  const currentPlan = user?.plan || "free";

  async function handleCheckout(plan) {
    if (!user) { navigate("/"); return; }
    setLoading(plan.id);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const priceId = billing === "yearly" ? plan.stripe.yearly : plan.stripe.monthly;
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          planId: plan.id,
          uid: user.uid,
          email: user.email,
          billing,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    }
    setLoading(null);
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, padding: "40px 20px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 4, textTransform: "uppercase", marginBottom: 12 }}>
            Founding Member Pricing
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: "0 0 12px" }}>
            Unlock Your English Journey
          </h1>
          <p style={{ fontSize: 15, color: COLORS.textMuted, maxWidth: 520, margin: "0 auto 32px" }}>
            Choose the apps and bundles that fit your life. Cancel anytime.
          </p>

          {/* Billing + Currency controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
            {/* Billing toggle */}
            <div style={{ display: "flex", background: "#111", border: "1px solid #2a2a2a", borderRadius: 30, padding: 4, gap: 4 }}>
              {["monthly", "yearly"].map((b) => (
                <button key={b} onClick={() => setBilling(b)} style={{
                  padding: "8px 20px", borderRadius: 24, border: "none",
                  background: billing === b ? COLORS.red : "transparent",
                  color: billing === b ? "#fff" : COLORS.textMuted,
                  fontSize: 13, fontWeight: billing === b ? 600 : 400, cursor: "pointer",
                }}>
                  {b === "monthly" ? "Monthly" : "Yearly"}{b === "yearly" && <span style={{ fontSize: 10, marginLeft: 6, color: billing === "yearly" ? "#ffcc00" : "#666" }}>2 months free</span>}
                </button>
              ))}
            </div>

            {/* Currency picker */}
            <select
              value={currency.code}
              onChange={(e) => setCurrency(CURRENCIES.find(c => c.code === e.target.value))}
              style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.text, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.label} ({c.symbol})</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(224,16,16,0.1)", border: "1px solid rgba(224,16,16,0.3)", borderRadius: 10, padding: "12px 20px", color: "#ff6060", marginBottom: 24, textAlign: "center" }}>
            {error}
          </div>
        )}

        {/* Individual Apps */}
        <SectionLabel>Individual Apps</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 48 }}>
          {PLANS.filter(p => p.apps.length === 1).map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billing={billing}
              currency={currency}
              current={currentPlan === plan.id}
              loading={loading === plan.id}
              onSelect={() => handleCheckout(plan)}
            />
          ))}
        </div>

        {/* Bundles */}
        <SectionLabel>Bundles — Save More</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 48 }}>
          {PLANS.filter(p => p.apps.length > 1 && p.id !== "all_access").map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billing={billing}
              currency={currency}
              current={currentPlan === plan.id}
              loading={loading === plan.id}
              onSelect={() => handleCheckout(plan)}
            />
          ))}
        </div>

        {/* All Access */}
        <SectionLabel>All Access</SectionLabel>
        {PLANS.filter(p => p.id === "all_access").map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            billing={billing}
            currency={currency}
            current={currentPlan === plan.id}
            loading={loading === plan.id}
            onSelect={() => handleCheckout(plan)}
            featured
          />
        ))}

        {/* AI limits table */}
        <div style={{ marginTop: 64, background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 16, padding: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 20 }}>
            Kai AI Chat — Daily Message Limits
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            {[
              { label: "Free", msgs: 5 },
              { label: "Individual App", msgs: 15 },
              { label: "Bundle", msgs: 30 },
              { label: "All Access", msgs: "∞ Unlimited" },
            ].map(row => (
              <div key={row.label} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.red }}>{row.msgs}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>{row.label}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: COLORS.textDim, marginTop: 32 }}>
          Secure payments by Stripe · Cancel anytime · Founding Member prices locked for life
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
      {children}
    </div>
  );
}

function PlanCard({ plan, billing, currency, current, loading, onSelect, featured }) {
  const price = billing === "yearly" ? plan.price_yearly : plan.price_monthly;
  const displayPrice = formatPrice(price, currency, billing);
  const perMonth = billing === "yearly"
    ? formatPrice(Math.round(plan.price_yearly / 12), currency, "monthly")
    : null;

  return (
    <div style={{
      background: featured ? "linear-gradient(135deg, #1a0000, #0d0000)" : COLORS.card,
      border: `1px solid ${featured ? "rgba(224,16,16,0.4)" : current ? plan.color + "66" : "#1e1e1e"}`,
      borderRadius: 16, padding: featured ? "28px 24px" : "20px",
      position: "relative", transition: "all 0.2s",
      boxShadow: featured ? "0 0 40px rgba(224,16,16,0.1)" : "none",
    }}>
      {plan.badge && (
        <div style={{
          position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
          background: plan.id === "all_access" ? COLORS.red : plan.color,
          color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 12px",
          borderRadius: 20, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap",
        }}>{plan.badge}</div>
      )}
      {current && (
        <div style={{ position: "absolute", top: 12, right: 12, fontSize: 9, fontWeight: 700, color: COLORS.success, border: `1px solid ${COLORS.success}`, padding: "2px 8px", borderRadius: 10, letterSpacing: 1 }}>
          ACTIVE
        </div>
      )}

      <div style={{ fontSize: featured ? 18 : 14, fontWeight: 700, marginBottom: 6 }}>{plan.name}</div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 14, lineHeight: 1.5 }}>{plan.desc}</div>

      <div style={{ marginBottom: 4 }}>
        <span style={{ fontSize: featured ? 32 : 26, fontWeight: 800, color: plan.color }}>{displayPrice}</span>
        <span style={{ fontSize: 12, color: COLORS.textMuted }}>/{billing === "yearly" ? "yr" : "mo"}</span>
      </div>
      {perMonth && (
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{perMonth}/mo · 2 months free</div>
      )}
      <div style={{ fontSize: 10, color: "#555", marginBottom: 16 }}>
        Founding price · reg. ¥{plan.reg_price.toLocaleString()}
      </div>

      <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 16 }}>
        🤖 {plan.ai_msgs === 100 ? "∞ Unlimited" : `${plan.ai_msgs} AI msgs/day`}
      </div>

      <button
        onClick={onSelect}
        disabled={loading || current}
        style={{
          width: "100%", padding: "10px 0",
          background: current ? "transparent" : plan.id === "all_access" ? COLORS.red : "transparent",
          border: `1px solid ${current ? "#333" : plan.color}`,
          borderRadius: 8, color: current ? "#555" : plan.id === "all_access" ? "#fff" : plan.color,
          fontSize: 13, fontWeight: 600, cursor: current ? "default" : "pointer",
          transition: "all 0.2s",
        }}
      >
        {loading ? "Redirecting…" : current ? "Current Plan" : "Subscribe →"}
      </button>
    </div>
  );
}
