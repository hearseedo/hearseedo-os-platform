import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { TOKENS } from "../constants/tokens";
import AppShell from "./components/AppShell";

const ITEMS = [
  { id: "membership", labelKey: "lb_item_membership", descKey: "lb_item_membership_desc", route: "/preview/membership" },
  { id: "rewards",     labelKey: "lb_item_rewards",    descKey: "lb_item_rewards_desc",    route: "/preview/rewards" },
  { id: "calendar",    labelKey: "lb_item_calendar",   descKey: "lb_item_calendar_desc",   route: "/preview/calendar" },
  { id: "referrals",   labelKey: "lb_item_referrals",  descKey: "lb_item_referrals_desc",  route: "/preview/referrals" },
];

// Rebuild prompt section 4 — "More" hub for supporting areas that don't
// need their own top-level nav slot.
export default function PreviewMore() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLang();
  const isSchoolOrOrg = user?.accountType === "school" || user?.accountType === "organization";

  return (
    <AppShell active="more">
      <div style={{ marginBottom: TOKENS.space[5] }}>
        <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 4 }}>{t("lb_more_label")}</div>
        <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800 }}>{t("lb_more_from_hsdos")}</h1>
      </div>

      <div style={{ display: "grid", gap: TOKENS.space[3], gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", marginBottom: TOKENS.space[5] }}>
        {ITEMS.map(item => (
          <button key={item.id} onClick={() => navigate(item.route)} style={{
            textAlign: "left", padding: 18, borderRadius: TOKENS.radius.lg, cursor: "pointer",
            border: `1px solid ${TOKENS.color.border}`, background: TOKENS.color.surfaceRaised, color: TOKENS.color.starlight,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{t(item.labelKey)}</div>
            <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted }}>{t(item.descKey)}</div>
          </button>
        ))}
      </div>

      {isSchoolOrOrg && (
        <div style={{ padding: TOKENS.space[4], borderRadius: TOKENS.radius.lg, border: `1px dashed ${TOKENS.color.border}`, color: TOKENS.color.textMuted, fontSize: TOKENS.font.size.sm }}>
          {t("lb_institutional_gap_note").replace("{type}", user.accountType)}
        </div>
      )}
    </AppShell>
  );
}
