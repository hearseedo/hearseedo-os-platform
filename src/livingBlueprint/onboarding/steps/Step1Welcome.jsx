import { TOKENS } from "../../../constants/tokens";
import { useLang } from "../../../hooks/useLang";

// Rebuild prompt section 5, Step 1 — Welcome.
export default function Step1Welcome({ onNext }) {
  const { t } = useLang();
  return (
    <div style={{
      minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, textAlign: "center", boxSizing: "border-box",
      background: `radial-gradient(circle at 50% 30%, ${TOKENS.color.surfaceRaised} 0%, ${TOKENS.color.bg} 70%), url('/assets/bg/midnight-nebula.png') center/cover`,
    }}>
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div style={{
          width: 170, height: 170, borderRadius: "50%", overflow: "hidden", position: "relative",
          margin: "0 auto 20px", border: `2px solid ${TOKENS.color.goldDim}`, boxShadow: TOKENS.shadow.glow,
          background: `radial-gradient(circle, ${TOKENS.color.goldGlow} 0%, rgba(0,0,0,0.5) 100%)`,
        }}>
          <img
            src="/assets/jona/pose-waving.png"
            alt="Jona"
            style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 230, height: "auto", display: "block" }}
          />
        </div>

        <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 6 }}>{t("lb_hi_im_jona")}</div>
        <h1 style={{ fontSize: TOKENS.font.size["3xl"], fontWeight: 800, marginBottom: 10, lineHeight: 1.1 }}>
          {t("welcome_headline")}
        </h1>
        <p style={{ color: TOKENS.color.textMuted, fontSize: TOKENS.font.size.base, marginBottom: 32, lineHeight: 1.5, whiteSpace: "pre-line" }}>
          {t("welcome_sub")}
        </p>

        <button
          onClick={onNext}
          style={{
            padding: "14px 32px", borderRadius: TOKENS.radius.pill, border: "none",
            background: TOKENS.color.gold, color: "#0a0a0a", fontWeight: 800, fontSize: TOKENS.font.size.base,
            cursor: "pointer", boxShadow: TOKENS.shadow.glow,
          }}
        >
          {t("begin_journey")}
        </button>
      </div>
    </div>
  );
}
