import { useNavigate } from "react-router-dom";
import { TOKENS } from "../../constants/tokens";
import { useSubscription } from "../../hooks/useSubscription";
import { AI_LIMITS, ACTIVE_PLANS } from "../../constants/plans";

// Rebuild prompt section 14 — Membership and access, inside HSDOS (not a
// second payment flow — real plan/access data via useSubscription.js, and
// "upgrade" hands off to the existing live /plans + Stripe flow).
export default function MembershipPanel({ user }) {
  const navigate = useNavigate();
  const { plan, subscriptions, hasAccessPass, workbookDaysRemaining } = useSubscription();

  const planInfo = ACTIVE_PLANS.find(p => p.id === plan);
  const aiLimit = AI_LIMITS[plan];
  const workbookDays = workbookDaysRemaining();

  return (
    <div>
      <div style={{ marginBottom: TOKENS.space[5] }}>
        <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 4 }}>MEMBERSHIP & ACCESS</div>
        <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800 }}>{planInfo?.name ?? plan}</h1>
      </div>

      <div style={{ display: "flex", gap: TOKENS.space[3], marginBottom: TOKENS.space[5], flexWrap: "wrap" }}>
        <Tile label="Plan" value={planInfo?.name ?? plan} />
        <Tile label="Monthly AI Messages" value={aiLimit != null ? aiLimit : "Not tracked per-plan"} sub="Per-user usage isn't tracked yet — only the plan limit." />
        {hasAccessPass() && <Tile label="Access Pass" value="Active" sub="Full platform access" />}
        {workbookDays > 0 && <Tile label="Workbook Bonus" value={`${workbookDays} days left`} />}
      </div>

      <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 10 }}>UNLOCKED APPS</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: TOKENS.space[5] }}>
        {subscriptions.length === 0 ? (
          <div style={{ color: TOKENS.color.textMuted, fontSize: TOKENS.font.size.sm }}>None yet.</div>
        ) : subscriptions.map(s => (
          <span key={s} style={{
            fontSize: TOKENS.font.size.xs, padding: "6px 12px", borderRadius: TOKENS.radius.pill,
            border: `1px solid ${TOKENS.color.border}`, color: TOKENS.color.textMuted,
          }}>
            {s}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => navigate("/plans")} style={{
          padding: "12px 28px", borderRadius: TOKENS.radius.pill, border: "none",
          background: TOKENS.color.gold, color: "#0a0a0a", fontWeight: 800, cursor: "pointer",
        }}>
          Manage Plan / Billing
        </button>
      </div>
      <div style={{ fontSize: 10, color: TOKENS.color.textDim, marginTop: 8 }}>
        Plan changes and billing go through the existing live /plans + Stripe flow — not duplicated here.
      </div>
    </div>
  );
}

function Tile({ label, value, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 160, padding: TOKENS.space[4], borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.color.border}`, background: TOKENS.color.surfaceRaised }}>
      <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: TOKENS.font.size.xl, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
