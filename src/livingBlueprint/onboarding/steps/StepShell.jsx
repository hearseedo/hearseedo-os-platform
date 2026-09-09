import { TOKENS } from "../../../constants/tokens";
import { useLang } from "../../../hooks/useLang";

// Shared chrome for steps 2-4: grid background, step progress dots, Back/Continue.
export default function StepShell({ title, subtitle, step, totalSteps = 4, onBack, onContinue, continueDisabled, continueLabel, children }) {
  const { t } = useLang();
  const resolvedContinueLabel = continueLabel ?? t("lb_continue");
  return (
    <div style={{
      minHeight: "100vh", width: "100%", background: TOKENS.color.bg, color: TOKENS.color.starlight,
      display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 20px 100px", boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={{
            width: i + 1 === step ? 22 : 8, height: 8, borderRadius: TOKENS.radius.pill,
            background: i + 1 <= step ? TOKENS.color.gold : "rgba(255,255,255,0.12)",
            transition: `all ${TOKENS.motion.base} ${TOKENS.motion.easing}`,
          }} />
        ))}
      </div>

      <div style={{ maxWidth: 560, width: "100%", textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800, marginBottom: subtitle ? 6 : 0 }}>{title}</h1>
        {subtitle && <p style={{ color: TOKENS.color.textMuted, fontSize: TOKENS.font.size.sm }}>{subtitle}</p>}
      </div>

      <div style={{ maxWidth: 640, width: "100%", flex: 1 }}>
        {children}
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10,
        display: "flex", justifyContent: "center", gap: 12,
        padding: "16px 20px calc(16px + env(safe-area-inset-bottom))",
        background: "linear-gradient(180deg, transparent, rgba(5,6,8,0.9) 30%)",
      }}>
        {onBack && (
          <button onClick={onBack} style={{
            padding: "12px 24px", borderRadius: TOKENS.radius.pill, border: `1px solid ${TOKENS.color.border}`,
            background: "transparent", color: TOKENS.color.textMuted, fontWeight: 600, cursor: "pointer",
          }}>
            {t("lb_back_plain")}
          </button>
        )}
        <button
          onClick={onContinue}
          disabled={continueDisabled}
          style={{
            padding: "12px 32px", borderRadius: TOKENS.radius.pill, border: "none",
            background: continueDisabled ? "rgba(255,255,255,0.08)" : TOKENS.color.gold,
            color: continueDisabled ? TOKENS.color.textDim : "#0a0a0a",
            fontWeight: 800, cursor: continueDisabled ? "not-allowed" : "pointer",
          }}
        >
          {resolvedContinueLabel}
        </button>
      </div>
    </div>
  );
}
