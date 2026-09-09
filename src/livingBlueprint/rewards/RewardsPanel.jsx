import { TOKENS } from "../../constants/tokens";
import { useLang } from "../../hooks/useLang";
import Achievements from "../../components/Achievements";

// Rebuild prompt section 13 — Achievements and Rewards. Reuses the live,
// already-shipped Achievements component (real earned/locked logic against
// the real user profile) rather than re-deriving a second copy.
export default function RewardsPanel({ user }) {
  const { t } = useLang();
  return (
    <div>
      <div style={{ marginBottom: TOKENS.space[5] }}>
        <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 4 }}>{t("lb_rewards_label")}</div>
        <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800 }}>{t("lb_your_collection")}</h1>
      </div>
      <Achievements user={user} />
    </div>
  );
}
