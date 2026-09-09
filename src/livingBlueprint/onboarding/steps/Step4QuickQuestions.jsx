import { useState } from "react";
import { TOKENS } from "../../../constants/tokens";
import { useLang } from "../../../hooks/useLang";
import StepShell from "./StepShell";

// Rebuild prompt section 5, Step 4 — Quick questions, one at a time per
// learner. Only the first question is in scope for this foundation build
// ("What would you like help with most?") — collecting only what changes
// recommendations, per spec.

const CATEGORIES = [
  { id: "school",     labelKey: "lb_cat_school",    icon: "◆" },
  { id: "speaking",   labelKey: "lb_cat_speaking",  icon: "●" },
  { id: "reading",    labelKey: "lb_cat_reading",   icon: "▤" },
  { id: "confidence", labelKey: "lb_cat_confidence", icon: "✦" },
  { id: "eiken",      labelKey: "lb_cat_eiken",     icon: "◈" },
  { id: "fun",        labelKey: "lb_cat_fun",       icon: "◇" },
];

export default function Step4QuickQuestions({ learners, answers, onChange, onBack, onNext }) {
  const { t } = useLang();
  const [index, setIndex] = useState(0);
  const learner = learners[index];
  const selected = answers[learner.id]?.helpWith;

  const selectAnswer = (categoryId) => {
    onChange({ ...answers, [learner.id]: { ...answers[learner.id], helpWith: categoryId } });
  };

  const goNext = () => {
    if (index < learners.length - 1) setIndex(index + 1);
    else onNext();
  };
  const goBack = () => {
    if (index > 0) setIndex(index - 1);
    else onBack();
  };

  return (
    <StepShell
      title={t("lb_help_with_most")}
      subtitle={learners.length > 1 ? t("lb_for_learner_of").replace("{name}", learner.name).replace("{i}", index + 1).replace("{n}", learners.length) : undefined}
      step={4}
      onBack={goBack}
      onContinue={goNext}
      continueDisabled={!selected}
      continueLabel={index < learners.length - 1 ? t("lb_next_person") : t("lb_continue")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", overflow: "hidden", position: "relative", flexShrink: 0,
          border: `2px solid ${TOKENS.color.goldDim}`,
        }}>
          <img
            src="/assets/jona/pose-pointing.png"
            alt=""
            style={{ position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)", width: 90, height: "auto" }}
          />
        </div>
        <div style={{ fontSize: TOKENS.font.size.sm, color: TOKENS.color.textMuted }}>
          {t("lb_jona_asking_on_behalf").split("{name}")[0]}<strong style={{ color: TOKENS.color.starlight }}>{learner.name}</strong>{t("lb_jona_asking_on_behalf").split("{name}")[1]}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {CATEGORIES.map(cat => {
          const isSelected = selected === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => selectAnswer(cat.id)}
              aria-pressed={isSelected}
              style={{
                padding: "18px 14px", borderRadius: TOKENS.radius.lg, cursor: "pointer", textAlign: "center",
                border: `1px solid ${isSelected ? TOKENS.color.gold : TOKENS.color.border}`,
                background: isSelected ? "rgba(201,168,76,0.08)" : TOKENS.color.surfaceRaised,
              }}
            >
              <div style={{ fontSize: 20, color: isSelected ? TOKENS.color.gold : TOKENS.color.textMuted, marginBottom: 6 }}>{cat.icon}</div>
              <div style={{ fontWeight: 600, fontSize: TOKENS.font.size.sm }}>{t(cat.labelKey)}</div>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
