import { TOKENS } from "../../../constants/tokens";
import StepShell from "./StepShell";

// Rebuild prompt section 5, Step 2 — Who is joining?
const OPTIONS = [
  { id: "solo",         label: "Just Me",           desc: "A personal learning journey, just for you.", icon: "◆" },
  { id: "family",        label: "My Family",         desc: "Learn together — everyone's progress in one place.", icon: "◇" },
  { id: "school",        label: "School / University", desc: "Learning connected to your institution.", icon: "◈" },
  { id: "organization",  label: "Organization",      desc: "For teams and organizations.", icon: "▣" },
];

export default function Step2WhoIsJoining({ value, onChange, onBack, onNext }) {
  return (
    <StepShell
      title="Who is joining HSDOS today?"
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
              <div style={{ fontWeight: 700, fontSize: TOKENS.font.size.base, marginBottom: 4 }}>{opt.label}</div>
              <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted, lineHeight: 1.4 }}>{opt.desc}</div>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
