import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { TOKENS } from "../constants/tokens";
import AppShell from "./components/AppShell";

const ITEMS = [
  { id: "membership", label: "Membership & Access", desc: "Plan, AI limits, unlocked apps.", route: "/preview/membership" },
  { id: "rewards",     label: "Rewards",             desc: "Earned achievements and your collection.", route: "/preview/rewards" },
  { id: "calendar",    label: "Calendar",             desc: "Upcoming community live sessions.", route: "/preview/calendar" },
  { id: "referrals",   label: "Referral Center",       desc: "Your invite link and referral stats.", route: "/preview/referrals" },
];

// Rebuild prompt section 4 — "More" hub for supporting areas that don't
// need their own top-level nav slot.
export default function PreviewMore() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSchoolOrOrg = user?.accountType === "school" || user?.accountType === "organization";

  return (
    <AppShell active="more">
      <div style={{ marginBottom: TOKENS.space[5] }}>
        <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 4 }}>MORE</div>
        <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800 }}>More from HSDOS</h1>
      </div>

      <div style={{ display: "grid", gap: TOKENS.space[3], gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", marginBottom: TOKENS.space[5] }}>
        {ITEMS.map(item => (
          <button key={item.id} onClick={() => navigate(item.route)} style={{
            textAlign: "left", padding: 18, borderRadius: TOKENS.radius.lg, cursor: "pointer",
            border: `1px solid ${TOKENS.color.border}`, background: TOKENS.color.surfaceRaised, color: TOKENS.color.starlight,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted }}>{item.desc}</div>
          </button>
        ))}
      </div>

      {isSchoolOrOrg && (
        <div style={{ padding: TOKENS.space[4], borderRadius: TOKENS.radius.lg, border: `1px dashed ${TOKENS.color.border}`, color: TOKENS.color.textMuted, fontSize: TOKENS.font.size.sm }}>
          Role-aware School/University/Organization cohort dashboards (rebuild prompt section 15) aren't built yet —
          this account is flagged as {user.accountType}, but no institutional view exists to show. Flagging as a gap
          rather than faking cohort data.
        </div>
      )}
    </AppShell>
  );
}
