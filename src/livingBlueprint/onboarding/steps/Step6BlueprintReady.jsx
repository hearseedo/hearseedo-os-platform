import { TOKENS } from "../../../constants/tokens";
import { useLang } from "../../../hooks/useLang";

// Rebuild prompt section 5, Step 6 — Your Blueprint is ready. Restrained
// completion moment — no confetti, a brief gold glow only.
export default function Step6BlueprintReady({ onFinish }) {
  const { t } = useLang();
  return (
    <div style={{
      minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: `radial-gradient(circle at 50% 40%, ${TOKENS.color.goldGlow} 0%, ${TOKENS.color.bg} 60%)`,
      color: TOKENS.color.starlight, padding: 24, textAlign: "center", boxSizing: "border-box",
    }}>
      <img src="/assets/innerkey/golden.png" alt="" style={{ width: 150, height: 150, marginBottom: 24, filter: `drop-shadow(0 0 30px ${TOKENS.color.goldGlow})` }} />
      <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800, marginBottom: 8 }}>{t("lb_blueprint_ready")}</h1>
      <p style={{ color: TOKENS.color.textMuted, marginBottom: 32, maxWidth: 360 }}>
        {t("lb_uncover_potential")}
      </p>
      <button
        onClick={onFinish}
        style={{
          padding: "14px 32px", borderRadius: TOKENS.radius.pill, border: "none",
          background: TOKENS.color.gold, color: "#0a0a0a", fontWeight: 800, fontSize: TOKENS.font.size.base,
          cursor: "pointer", boxShadow: TOKENS.shadow.glow,
        }}
      >
        {t("lb_see_my_blueprint")}
      </button>
    </div>
  );
}
