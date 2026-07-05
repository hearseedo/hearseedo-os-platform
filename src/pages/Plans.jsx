import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { PLANS } from "../constants/plans";
import { useAuth } from "../hooks/useAuth";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const CURRENCIES = [
  { code: "jpy", symbol: "¥", label: "JPY", rate: 1 },
  { code: "usd", symbol: "$", label: "USD", rate: 0.0067 },
  { code: "gbp", symbol: "£", label: "GBP", rate: 0.0053 },
  { code: "eur", symbol: "€", label: "EUR", rate: 0.0062 },
  { code: "aud", symbol: "A$", label: "AUD", rate: 0.0103 },
];

const FOUNDING_DISCOUNT   = 0.15;
const FOUNDING_TOTAL      = 200;

function fmt(yen, currency) {
  if (yen === 0) return "Free";
  if (currency.code === "jpy") return `¥${yen.toLocaleString()}`;
  return `${currency.symbol}${(yen * currency.rate).toFixed(0)}`;
}

function foundingPrice(yen) {
  return Math.round(yen * (1 - FOUNDING_DISCOUNT));
}

export default function Plans() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const [billing, setBilling]     = useState("monthly");
  const [currency, setCurrency]   = useState(CURRENCIES[0]);
  const [loading, setLoading]     = useState(null);
  const [error, setError]         = useState("");
  const [spotsLeft, setSpotsLeft] = useState(null);
  const [isMobile, setIsMobile]   = useState(() => window.innerWidth < 700);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    fetch("/api/signup-counter")
      .then(r => r.json())
      .then(d => setSpotsLeft(d.spotsLeft ?? 0))
      .catch(() => setSpotsLeft(null));
  }, []);

  const foundingOpen = spotsLeft === null || spotsLeft > 0;
  const spotsTaken   = spotsLeft !== null ? FOUNDING_TOTAL - spotsLeft : null;
  const displayPlans = PLANS.filter(p => !p.legacy);

  async function handleCheckout(plan) {
    if (!user) { navigate("/"); return; }
    const priceId = billing === "yearly" ? plan.stripe?.yearly : plan.stripe?.monthly;
    if (!priceId) {
      setError("This plan is coming soon. Email us at hearseedo.english@gmail.com to be first in line.");
      return;
    }
    setLoading(plan.id);
    setError("");
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, planId: plan.id, uid: user.uid, email: user.email, billing }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; }
      else { setError(data.error || "Something went wrong. Please try again."); }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(null);
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, padding: isMobile ? "24px 16px" : "48px 20px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 4, textTransform: "uppercase", marginBottom: 12 }}>
            {foundingOpen ? "Founding Member Pricing" : "Pricing"}
          </div>
          <h1 style={{ fontSize: isMobile ? 26 : 38, fontWeight: 800, margin: "0 0 12px" }}>
            Simple Pricing. Everything Included.
          </h1>
          <p style={{ fontSize: 15, color: COLORS.textMuted, maxWidth: 480, margin: "0 auto 28px", lineHeight: 1.6 }}>
            Two plans. No bundles. No confusion. Every HSD app unlocked from day one.
          </p>

          {/* Founding badge */}
          {foundingOpen && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 12,
              background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.3)",
              borderRadius: 30, padding: "10px 22px", marginBottom: 32,
            }}>
              <span style={{ fontSize: 20 }}>🏅</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#C9A84C" }}>15% off — Founding Member Discount</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                  {spotsLeft !== null
                    ? `${spotsLeft} of ${FOUNDING_TOTAL} spots remaining · ${spotsTaken} members joined`
                    : `First ${FOUNDING_TOTAL} members only · Price locked for life`}
                </div>
              </div>
            </div>
          )}

          {/* Billing + currency controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", background: "#111", border: "1px solid #2a2a2a", borderRadius: 30, padding: 4, gap: 4 }}>
              {["monthly", "yearly"].map(b => (
                <button key={b} onClick={() => setBilling(b)} style={{
                  padding: "8px 20px", borderRadius: 24, border: "none",
                  background: billing === b ? COLORS.red : "transparent",
                  color: billing === b ? "#fff" : COLORS.textMuted,
                  fontSize: 13, fontWeight: billing === b ? 600 : 400, cursor: "pointer",
                }}>
                  {b === "monthly" ? "Monthly" : "Annual"}
                  {b === "yearly" && (
                    <span style={{ fontSize: 10, marginLeft: 6, color: billing === "yearly" ? "#ffcc00" : "#666" }}>
                      Save 17%
                    </span>
                  )}
                </button>
              ))}
            </div>
            <select
              value={currency.code}
              onChange={e => setCurrency(CURRENCIES.find(c => c.code === e.target.value))}
              style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.text, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
            >
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label} ({c.symbol})</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(224,16,16,0.1)", border: "1px solid rgba(224,16,16,0.3)", borderRadius: 10, padding: "12px 20px", color: "#ff6060", marginBottom: 28, textAlign: "center" }}>
            {error}
          </div>
        )}

        {/* ── Plan cards ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap: 20,
          marginBottom: 40,
        }}>
          {displayPlans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billing={billing}
              currency={currency}
              loading={loading === plan.id}
              currentPlan={user?.plan}
              foundingOpen={foundingOpen}
              onSubscribe={() => handleCheckout(plan)}
              onNavigate={() => navigate("/dashboard")}
            />
          ))}
        </div>

        {/* ── Workbook owner note ── */}
        <div style={{
          background: "rgba(68,136,255,0.06)", border: "1px solid rgba(68,136,255,0.2)",
          borderRadius: 12, padding: "16px 22px", marginBottom: 48,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <span style={{ fontSize: 24 }}>📖</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#4488ff", marginBottom: 3 }}>Workbook Owner? First Month Free.</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>
              Own any Hear See Do workbook? Your first month is on us.{" "}
              <a href="mailto:hearseedo.english@gmail.com" style={{ color: "#4488ff" }}>Email us</a> after sign-up with a photo of your book.
            </div>
          </div>
        </div>

        {/* ── AI message comparison ── */}
        <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 16, padding: 28, marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 20 }}>
            Jona AI Chat — Monthly Message Limits
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {displayPlans.map(plan => (
              <div key={plan.id} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: plan.color }}>
                  {plan.ai_msgs === 100 ? "∞" : plan.ai_msgs}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginTop: 4 }}>{plan.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>messages/month</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: COLORS.textDim, marginBottom: 48 }}>
          Secure payments by Stripe · Cancel anytime · Founding Member prices locked for life
        </p>

        <FeatureRequestCard user={user} isMobile={isMobile} />
      </div>
    </div>
  );
}

/* ── Plan card ─────────────────────────────────────────────────────────────── */
function PlanCard({ plan, billing, currency, loading, currentPlan, foundingOpen, onSubscribe, onNavigate }) {
  const isCurrent = currentPlan === plan.id;
  const isFree    = plan.price_monthly === 0;

  const rawPrice  = billing === "yearly" ? plan.price_yearly : plan.price_monthly;
  const dispPrice = (foundingOpen && !isFree) ? foundingPrice(rawPrice) : rawPrice;
  const regPrice  = rawPrice;
  const perMonth  = billing === "yearly" ? Math.round(dispPrice / 12) : null;

  const isFamily  = plan.id === "family";
  const featured  = isFamily;

  return (
    <div style={{
      background: "#0d0d0d",
      border: `1px solid ${featured ? plan.color + "55" : "#1e1e1e"}`,
      borderRadius: 18,
      padding: "28px 24px",
      position: "relative",
      display: "flex", flexDirection: "column",
      boxShadow: featured ? `0 0 40px ${plan.color}15` : "none",
    }}>
      {/* Badge */}
      {plan.badge && plan.badge !== "Free" && (
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          background: plan.color, color: "#fff",
          fontSize: 9, fontWeight: 800, padding: "4px 14px",
          borderRadius: 20, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap",
        }}>
          {plan.badge}
        </div>
      )}

      {/* Plan name */}
      <div style={{ fontSize: 11, fontWeight: 700, color: plan.color, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6, marginTop: plan.badge ? 8 : 0 }}>
        {plan.name}
      </div>
      <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 16 }}>{plan.nameJp}</div>

      {/* Price block */}
      <div style={{ marginBottom: 20 }}>
        {isFree ? (
          <div style={{ fontSize: 40, fontWeight: 900, color: plan.color, lineHeight: 1 }}>Free</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 40, fontWeight: 900, color: plan.color, lineHeight: 1 }}>
                {fmt(dispPrice, currency)}
              </span>
              <span style={{ fontSize: 13, color: COLORS.textMuted, paddingBottom: 5 }}>
                /{billing === "yearly" ? "yr" : "mo"}
              </span>
            </div>
            {billing === "yearly" && perMonth && (
              <div style={{ fontSize: 12, color: "#22c55e", marginBottom: 4 }}>
                {fmt(perMonth, currency)}/mo · 2 months free
              </div>
            )}
            {foundingOpen && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: "#444", textDecoration: "line-through" }}>
                  reg. {fmt(regPrice, currency)}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#C9A84C", background: "rgba(201,168,76,0.12)", padding: "2px 8px", borderRadius: 10, letterSpacing: 0.5 }}>
                  15% OFF
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 20, flexShrink: 0 }}>
        {plan.desc}
      </p>

      {/* Members (for family) */}
      {plan.members > 1 && (
        <div style={{
          background: `${plan.color}10`, border: `1px solid ${plan.color}25`,
          borderRadius: 10, padding: "10px 14px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>👨‍👩‍👧‍👦</span>
          <span style={{ fontSize: 12, color: plan.color, fontWeight: 600 }}>
            Up to {plan.members} members
          </span>
        </div>
      )}

      {/* Feature list */}
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, color: COLORS.textMuted, lineHeight: 1.4 }}>
            <span style={{ color: plan.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isFree ? (
        <button
          onClick={onNavigate}
          style={{
            width: "100%", padding: "13px 0",
            background: "transparent", border: `1.5px solid ${plan.color}`,
            borderRadius: 10, color: plan.color,
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          {isCurrent ? "You're on Free →" : "Start Free →"}
        </button>
      ) : (
        <button
          onClick={onSubscribe}
          disabled={loading || isCurrent}
          style={{
            width: "100%", padding: "13px 0",
            background: featured ? plan.color : "transparent",
            border: `1.5px solid ${isCurrent ? "#444" : plan.color}`,
            borderRadius: 10,
            color: featured ? "#fff" : (isCurrent ? "#555" : plan.color),
            fontSize: 14, fontWeight: 700, cursor: loading || isCurrent ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
            boxShadow: featured ? `0 4px 24px ${plan.color}35` : "none",
            transition: "opacity 0.15s",
          }}
        >
          {isCurrent
            ? "Current Plan"
            : loading
            ? "Redirecting…"
            : `Subscribe ${billing === "yearly" ? "Annually" : "Monthly"} →`}
        </button>
      )}
    </div>
  );
}

/* ── Feature request card ──────────────────────────────────────────────────── */
function FeatureRequestCard({ user, isMobile }) {
  const [text, setText]     = useState("");
  const [status, setStatus] = useState("idle");

  async function submit(e) {
    e.preventDefault();
    if (!text.trim() || status === "sending") return;
    setStatus("sending");
    try {
      await addDoc(collection(db, "featureRequests"), {
        uid:       user?.uid ?? null,
        email:     user?.email ?? null,
        request:   text.trim(),
        createdAt: serverTimestamp(),
        source:    "plans_page",
      });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: isMobile ? "24px 18px" : 32, maxWidth: 600, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
          Help Us Grow
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Have an idea? Let us know.</div>
        <p style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.7, margin: 0 }}>
          Don't see what you're looking for? Every message is read personally and your thoughts shape where we go next.
        </p>
      </div>

      {status === "done" ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🙌</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Got it — thank you!</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted }}>Jonathan reads every request personally.</div>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            required
            rows={4}
            placeholder="e.g. I'd love a reading comprehension feature for my 8-year-old..."
            style={{
              width: "100%", padding: "12px 14px",
              background: "#0a0a0a", border: "1px solid #2a2a2a",
              borderRadius: 10, color: COLORS.text,
              fontSize: 14, lineHeight: 1.6, resize: "vertical",
              fontFamily: "inherit", outline: "none", boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={e => { e.target.style.borderColor = COLORS.red; }}
            onBlur={e => { e.target.style.borderColor = "#2a2a2a"; }}
          />
          {user?.email && <div style={{ fontSize: 11, color: "#444" }}>Sending as {user.email}</div>}
          {status === "error" && <div style={{ fontSize: 12, color: "#ff6060" }}>Something went wrong — please try again.</div>}
          <button
            type="submit"
            disabled={status === "sending" || !text.trim()}
            style={{
              padding: "13px 0", background: COLORS.red, border: "none",
              borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: status === "sending" || !text.trim() ? "default" : "pointer",
              opacity: status === "sending" || !text.trim() ? 0.6 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {status === "sending" ? "Sending…" : "Send My Request →"}
          </button>
        </form>
      )}
    </div>
  );
}
