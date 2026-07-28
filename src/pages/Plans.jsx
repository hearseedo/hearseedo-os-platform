import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { ACTIVE_PLANS } from "../constants/plans";
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

const FOUNDING_DISCOUNT = 0.15;
const FOUNDING_TOTAL    = 200;

function fmt(yen, currency) {
  if (yen === 0) return "Free";
  if (currency.code === "jpy") return `¥${yen.toLocaleString()}`;
  return `${currency.symbol}${(yen * currency.rate).toFixed(0)}`;
}

function foundingPrice(yen) {
  return Math.round(yen * (1 - FOUNDING_DISCOUNT));
}

// Outcomes-only copy — no app names anywhere
const CARD_COPY = {
  free: {
    for:      "For anyone starting their English journey",
    outcome:  "Start your confidence journey. No credit card needed.",
    sessions: "5 AI coaching sessions per month",
    cta:      "Join free →",
  },
  individual: {
    for:      "For adults serious about daily English progress",
    outcome:  "Your personal AI coach, available every day.",
    sessions: "50 AI coaching sessions per month",
    cta:      "Start coaching →",
  },
  family: {
    for:      "For families learning English together",
    outcome:  "One AI confidence platform for the whole family.",
    sessions: "100 shared sessions per month · up to 5 members",
    cta:      "Start your family →",
  },
  "university-bundle": {
    for:      "For Japanese students building career and global readiness",
    outcome:  "Intensive AI coaching for career success and global opportunities.",
    sessions: "150 AI sessions per month — 3× more than Individual",
    cta:      "Start your journey →",
  },
  organization: {
    for:      "For schools, companies, and language programs",
    outcome:  "Empower your organization with custom AI-powered English coaching.",
    sessions: "Custom AI allowance · unlimited members",
    cta:      "Contact us →",
  },
};

export default function Plans() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [billing, setBilling]     = useState("monthly");
  const [currency, setCurrency]   = useState(CURRENCIES[0]);
  const [loading, setLoading]     = useState(null);
  const [error, setError]         = useState("");
  const [spotsLeft, setSpotsLeft] = useState(null);
  const [isMobile, setIsMobile]   = useState(() => window.innerWidth < 720);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 720);
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

  // Row 1: Explorer, Individual, Family | Row 2: University+, Organization
  const row1 = ACTIVE_PLANS.filter(p => ["free", "individual", "family"].includes(p.id));
  const row2 = ACTIVE_PLANS.filter(p => ["university-bundle", "organization"].includes(p.id));

  async function handleCheckout(plan) {
    if (plan.contactOnly) {
      window.location.href = "mailto:hearseedo.english@gmail.com?subject=Organization%20Plan%20Inquiry";
      return;
    }
    if (plan.price_monthly === 0) {
      navigate(user ? "/dashboard" : "/");
      return;
    }
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
    <div style={{
      minHeight: "100vh", color: COLORS.text, padding: isMobile ? "28px 16px" : "52px 24px",
      background: "radial-gradient(circle at 50% 0%, #131a2c 0%, #050608 60%), url('/assets/bg/midnight-nebula.png') center/cover",
    }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: "#C9A84C", letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>
            {foundingOpen ? "Founding Member Pricing" : "Pricing"}
          </div>
          <h1 style={{ fontSize: isMobile ? 30 : 44, fontWeight: 900, margin: "0 0 14px", lineHeight: 1.05, letterSpacing: -0.5 }}>
            Choose your path.
          </h1>
          <p style={{ fontSize: 15, color: COLORS.textMuted, maxWidth: 460, margin: "0 auto 32px", lineHeight: 1.7 }}>
            Every plan is built around real confidence in English. Start free, grow at your own pace, cancel anytime.
          </p>

          {/* Founding badge */}
          {foundingOpen && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 14,
              background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.22)",
              borderRadius: 32, padding: "10px 22px", marginBottom: 32,
            }}>
              <span style={{ fontSize: 17 }}>🏅</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#C9A84C" }}>
                  15% off · Founding Member Discount
                </div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                  {spotsLeft !== null
                    ? `${spotsLeft} of ${FOUNDING_TOTAL} spots remaining · ${spotsTaken} members joined`
                    : `First ${FOUNDING_TOTAL} members only · Price locked for life`}
                </div>
              </div>
            </div>
          )}

          {/* Billing toggle + currency */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", background: "#111", border: "1px solid #222", borderRadius: 32, padding: 4, gap: 4 }}>
              {["monthly", "yearly"].map(b => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  style={{
                    padding: "8px 20px", borderRadius: 26, border: "none",
                    background: billing === b ? "#C9A84C" : "transparent",
                    color: billing === b ? "#0a0a0a" : COLORS.textMuted,
                    fontSize: 13, fontWeight: billing === b ? 700 : 400,
                    cursor: "pointer", transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {b === "monthly" ? "Monthly" : "Annual"}
                  {b === "yearly" && (
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                      textTransform: "uppercase",
                      color: billing === "yearly" ? "#22c55e" : "#444",
                      background: billing === "yearly" ? "rgba(34,197,94,0.15)" : "transparent",
                      padding: billing === "yearly" ? "2px 6px" : 0,
                      borderRadius: 6,
                    }}>
                      Best Value
                    </span>
                  )}
                </button>
              ))}
            </div>
            <select
              value={currency.code}
              onChange={e => setCurrency(CURRENCIES.find(c => c.code === e.target.value))}
              style={{
                background: "#111", border: "1px solid #222", borderRadius: 8,
                color: COLORS.text, padding: "8px 12px", fontSize: 13,
                cursor: "pointer", outline: "none",
              }}
            >
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label} ({c.symbol})</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div style={{
            background: "rgba(224,16,16,0.08)", border: "1px solid rgba(224,16,16,0.22)",
            borderRadius: 10, padding: "12px 20px", color: "#ff6060",
            marginBottom: 28, textAlign: "center", fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* ── Row 1: Explorer · Individual · Family ───────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap: 18,
          marginBottom: 18,
          alignItems: "start",
        }}>
          {row1.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billing={billing}
              currency={currency}
              loading={loading === plan.id}
              currentPlan={user?.plan}
              foundingOpen={foundingOpen}
              onAction={() => handleCheckout(plan)}
            />
          ))}
        </div>

        {/* ── Row 2: University+ · Organization ──────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 18,
          marginBottom: 52,
          alignItems: "start",
        }}>
          {row2.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billing={billing}
              currency={currency}
              loading={loading === plan.id}
              currentPlan={user?.plan}
              foundingOpen={foundingOpen}
              onAction={() => handleCheckout(plan)}
            />
          ))}
        </div>

        {/* ── Workbook note ───────────────────────────────────────────────── */}
        <div style={{
          background: "rgba(68,136,255,0.05)", border: "1px solid rgba(68,136,255,0.14)",
          borderRadius: 12, padding: "16px 22px", marginBottom: 48,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <span style={{ fontSize: 22 }}>📖</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#4488ff", marginBottom: 3 }}>
              Workbook Owner? First Month Free.
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>
              Own any Hear See Do workbook? Your first month is on us.{" "}
              <a href="mailto:hearseedo.english@gmail.com" style={{ color: "#4488ff" }}>Email us</a>{" "}
              after sign-up with a photo of your book.
            </div>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: COLORS.textDim, marginBottom: 44 }}>
          Secure payments by Stripe · Cancel anytime · Founding Member prices locked for life
        </p>

        <FeatureRequestCard user={user} isMobile={isMobile} />
      </div>
    </div>
  );
}

/* ── Plan card ─────────────────────────────────────────────────────────────── */
function PlanCard({ plan, billing, currency, loading, currentPlan, foundingOpen, onAction }) {
  const copy      = CARD_COPY[plan.id] || {};
  const isCurrent = currentPlan === plan.id;
  const isFree    = plan.price_monthly === 0;
  const isOrg     = !!plan.contactOnly;
  const isFamily  = plan.id === "family";   // hero card — gets the glow

  const rawPrice  = billing === "yearly" ? plan.price_yearly : plan.price_monthly;
  const dispPrice = (!isFree && !isOrg && foundingOpen) ? foundingPrice(rawPrice) : rawPrice;
  const perMonth  = (billing === "yearly" && !isFree && !isOrg) ? Math.round(dispPrice / 12) : null;

  const accentColor = isOrg ? "#333" : plan.color;

  return (
    <div
      style={{
        background: "#0d0d0d",
        border: `1px solid ${isFamily ? plan.color + "40" : "#1a1a1a"}`,
        borderTop: `3px solid ${accentColor}`,
        borderRadius: 18,
        padding: isFamily ? "32px 26px" : "28px 24px",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        boxShadow: isFamily ? `0 0 60px ${plan.color}12` : "none",
        opacity: isOrg ? 0.85 : 1,
      }}
    >
      {/* Badge */}
      {plan.badge && (
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          background: plan.badge === "Best Value" ? plan.color : "rgba(245,158,11,0.12)",
          border: plan.badge === "Best Value" ? "none" : "1px solid rgba(245,158,11,0.35)",
          color: plan.badge === "Best Value" ? "#fff" : "#f59e0b",
          fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
          padding: "4px 16px", borderRadius: 20,
          textTransform: "uppercase", whiteSpace: "nowrap",
        }}>
          {plan.badge}
        </div>
      )}

      {/* Plan name + Japanese */}
      <div style={{ marginTop: plan.badge ? 12 : 0, marginBottom: 6 }}>
        <div style={{
          fontSize: 10, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase",
          color: isOrg ? "#555" : plan.color,
        }}>
          {plan.name}
        </div>
        {plan.nameJp && (
          <div style={{ fontSize: 10, color: "#3a3a3a", marginTop: 2 }}>{plan.nameJp}</div>
        )}
      </div>

      {/* Audience tag */}
      <div style={{ fontSize: 11, color: "#555", marginBottom: 14, lineHeight: 1.5 }}>
        {copy.for}
      </div>

      {/* Outcome sentence — the core sell */}
      <p style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.65, margin: "0 0 22px", fontWeight: 400 }}>
        {copy.outcome}
      </p>

      {/* Price block */}
      <div style={{ marginBottom: 18 }}>
        {isFree ? (
          <div>
            <div style={{ fontSize: 40, fontWeight: 900, color: plan.color, lineHeight: 1 }}>Free</div>
            <div style={{ fontSize: 11, color: "#3a3a3a", marginTop: 5 }}>forever</div>
          </div>
        ) : isOrg ? (
          <div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#555", lineHeight: 1 }}>Custom</div>
            <div style={{ fontSize: 11, color: "#3a3a3a", marginTop: 5 }}>tailored to your organization</div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 40, fontWeight: 900, color: plan.color, lineHeight: 1 }}>
                {fmt(dispPrice, currency)}
              </span>
              <span style={{ fontSize: 13, color: COLORS.textMuted, paddingBottom: 5 }}>
                /{billing === "yearly" ? "yr" : "mo"}
              </span>
            </div>
            {perMonth && (
              <div style={{ fontSize: 12, color: "#22c55e", marginBottom: 4 }}>
                {fmt(perMonth, currency)}/mo · 2 months free
              </div>
            )}
            {foundingOpen && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                <span style={{ fontSize: 11, color: "#333", textDecoration: "line-through" }}>
                  {fmt(rawPrice, currency)}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 800, color: "#C9A84C",
                  background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)",
                  padding: "2px 8px", borderRadius: 8, letterSpacing: 0.5,
                }}>
                  FOUNDING 15% OFF
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI sessions pill — natural language, no table */}
      <div style={{
        background: isOrg ? "transparent" : `${plan.color}0c`,
        border: `1px solid ${isOrg ? "#222" : plan.color + "20"}`,
        borderRadius: 10, padding: "10px 14px",
        marginBottom: 24, flex: 1,
      }}>
        <span style={{ fontSize: 12, color: isOrg ? "#444" : plan.color, fontWeight: 600, lineHeight: 1.5 }}>
          ✦ {copy.sessions}
        </span>
      </div>

      {/* CTA */}
      {isOrg ? (
        <button
          onClick={onAction}
          style={{
            width: "100%", padding: "13px 0",
            background: "transparent", border: "1.5px solid #2a2a2a",
            borderRadius: 12, color: "#666",
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          {copy.cta}
        </button>
      ) : isFree ? (
        <button
          onClick={onAction}
          style={{
            width: "100%", padding: "13px 0",
            background: "transparent", border: `1.5px solid ${plan.color}44`,
            borderRadius: 12, color: plan.color,
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          {isCurrent ? "On Explorer →" : copy.cta}
        </button>
      ) : (
        <button
          onClick={onAction}
          disabled={loading || isCurrent}
          style={{
            width: "100%", padding: "14px 0",
            background: isCurrent ? "transparent" : isFamily ? plan.color : `${plan.color}16`,
            border: `1.5px solid ${isCurrent ? "#2a2a2a" : plan.color}`,
            borderRadius: 12,
            color: isCurrent ? "#444" : isFamily ? "#fff" : plan.color,
            fontSize: 14, fontWeight: 700,
            cursor: loading || isCurrent ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
            boxShadow: isFamily && !isCurrent ? `0 4px 20px ${plan.color}30` : "none",
            transition: "opacity 0.15s",
          }}
        >
          {isCurrent ? "Current plan" : loading ? "Redirecting…" : copy.cta}
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
    <div style={{
      background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16,
      padding: isMobile ? "24px 18px" : 32, maxWidth: 600, margin: "0 auto",
    }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#C9A84C", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
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
            onFocus={e => { e.target.style.borderColor = "#C9A84C"; }}
            onBlur={e => { e.target.style.borderColor = "#2a2a2a"; }}
          />
          {user?.email && <div style={{ fontSize: 11, color: "#444" }}>Sending as {user.email}</div>}
          {status === "error" && <div style={{ fontSize: 12, color: "#ff6060" }}>Something went wrong — please try again.</div>}
          <button
            type="submit"
            disabled={status === "sending" || !text.trim()}
            style={{
              padding: "13px 0", background: "#C9A84C", border: "none",
              borderRadius: 10, color: "#0a0a0a", fontSize: 14, fontWeight: 700,
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
