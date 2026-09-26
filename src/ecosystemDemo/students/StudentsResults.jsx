// Students demo pathway — results screen. Renders only real recorded
// fields: the visitor's actual last submitted text (verbatim), whether a
// starter/hint was used (labelled, never presented as independent work),
// and one honest i18n-keyed observation. No score, no CEFR level, no
// pronunciation judgment — none of those fields exist in this data shape.
import { ECO } from "../EcosystemDemoShell";
import { useLang } from "../../hooks/useLang";

function observationKey(state, evaluation) {
  if (!evaluation) return null;
  if (evaluation.addedReason) return "students_demo_obs_added_reason";
  if (evaluation.hadReasonFromStart) return "students_demo_obs_reason_from_start";
  return "students_demo_obs_present_no_reason";
}

export default function StudentsResults({ state, lastAttempt, evaluation, onNextQuestion }) {
  const { t } = useLang();
  if (!lastAttempt) return null;

  const obsKey = observationKey(state, evaluation);

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: ECO.gold, marginBottom: 6 }}>
        {t("students_demo_eyebrow")}
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 16px" }}>{t("students_demo_results_heading")}</h2>

      <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: 18, padding: 22, marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: ECO.textMuted, textTransform: "uppercase", marginBottom: 6 }}>
          {t("students_demo_your_answer")}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: ECO.text, marginBottom: 14 }}>"{lastAttempt.text}"</div>

        {obsKey && (
          <div style={{ fontSize: 13, color: ECO.text, lineHeight: 1.6, marginBottom: lastAttempt.source === "starter" || state.usedHint ? 10 : 0 }}>
            {t(obsKey)}
          </div>
        )}

        {lastAttempt.source === "starter" && (
          <div style={{ fontSize: 12.5, color: ECO.textMuted, marginBottom: 6 }}>{t("students_demo_used_starter")}</div>
        )}
        {state.usedHint && (
          <div style={{ fontSize: 12.5, color: ECO.textMuted }}>{t("students_demo_used_hint")}</div>
        )}
      </div>

      <button
        type="button"
        onClick={onNextQuestion}
        style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
      >
        {t("students_demo_next_question")}
      </button>
    </div>
  );
}
