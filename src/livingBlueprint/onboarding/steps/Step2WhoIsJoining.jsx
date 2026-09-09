import { TOKENS } from "../../../constants/tokens";
import { useLang } from "../../../hooks/useLang";
import StepShell from "./StepShell";

// Rebuild prompt section 5, Step 2 — Who is joining?
const OPTIONS = [
  { id: "solo",         labelKey: "lb_opt_solo",   descKey: "lb_opt_solo_desc",   icon: "◆" },
  { id: "family",       labelKey: "lb_opt_family", descKey: "lb_opt_family_desc", icon: "◇" },
  { id: "school",       labelKey: "lb_opt_school", descKey: "lb_opt_school_desc", icon: "◈" },
  { id: "organization", labelKey: "lb_opt_org",    descKey: "lb_opt_org_desc",    icon: "▣" },
];

export default function Step2WhoIsJoining({ value, onChange, onBack, onNext }) {
  const { t } = useLang();
  return (
    <StepShell
      title={t("lb_who_is_joining")}
      step={2}
      onBack={onBack}
      onContinue={onNext}
      continueDisabled={!value}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {OPTIONS.map(opt => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              aria-pressed={selected}
              style={{
                textAlign: "left", padding: 20, borderRadius: TOKENS.radius.lg, cursor: "pointer",
                border: `1px solid ${selected ? TOKENS.color.gold : TOKENS.color.border}`,
                background: selected ? "rgba(201,168,76,0.08)" : TOKENS.color.surfaceRaised,
                minHeight: 96,
                transition: `border-color ${TOKENS.motion.fast} ${TOKENS.motion.easing}`,
              }}
            >
              <div style={{ fontSize: 20, color: selected ? TOKENS.color.gold : TOKENS.color.textMuted, marginBottom: 8 }}>{opt.icon}</div>
              <div style={{ fontWeight: 700, fontSize: TOKENS.font.size.base, marginBottom: 4 }}>{t(opt.labelKey)}</div>
              <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted, lineHeight: 1.4 }}>{t(opt.descKey)}</div>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
