// Educators demo pathway (Phase 2, 2026-09-26) — "see the evidence, choose
// the next step." Explicitly labelled sample data throughout, per spec's
// fallback clause for a preview with no live production Educator
// integration. Nothing here writes to any real backend — "Add to sample
// plan" is entirely local, ephemeral state. No chat.js call anywhere;
// Jona's suggestion is a deterministic per-learner lookup, not generated.
import { useEffect, useReducer, useState } from "react";
import { ECO } from "../EcosystemDemoShell";
import { useLang } from "../../hooks/useLang";
import GlobalJonaAssistant from "../../jona/GlobalJonaAssistant";
import { educatorsReducer, initialState } from "./educatorsReducer";
import { SAMPLE_LEARNERS } from "./data";
import { trackDemoEvent as trackEvent } from "../trackDemoEvent";
import { withGeneration } from "../withGeneration";

const trackDemoEvent = (event, meta) => trackEvent(event, "educator", meta);
const reducer = withGeneration(educatorsReducer);

function buildEducatorsJonaScript() {
  return {
    _default: "This preview uses three sample learners with a small amount of real-looking evidence — select one to see what I'd suggest, based only on what's shown.",
  };
}

export default function EducatorsPractice() {
  const { t } = useLang();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    trackDemoEvent("eco_demo_entry");
  }, []);

  const learner = SAMPLE_LEARNERS.find((l) => l.id === state.selectedLearnerId) ?? null;

  function handleSelect(l) {
    dispatch({ type: "SELECT_LEARNER", learnerId: l.id });
    setJustAdded(false);
    trackDemoEvent("educators_learner_selected", { promptId: l.id });
  }

  function handleAddToPlan() {
    if (!learner) return;
    dispatch({ type: "ADD_TO_PLAN", learnerId: learner.id, suggestionKey: learner.suggestionKey });
    setJustAdded(true);
    trackDemoEvent("educators_added_to_plan", { promptId: learner.id });
  }

  function handleComplete() {
    dispatch({ type: "COMPLETE" });
    trackDemoEvent("educators_task_completed", { questionsCompleted: state.planItems.length });
  }

  return (
    <div>
      <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 800, color: "#0a0700", background: ECO.gold, borderRadius: 999, padding: "4px 12px", marginBottom: 12 }}>
        {t("educators_demo_badge")}
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: ECO.gold, marginBottom: 6 }}>
        {t("educators_demo_eyebrow")}
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 8px" }}>{t("educators_demo_title")}</h2>
      <p style={{ color: ECO.textMuted, fontSize: 13, lineHeight: 1.6, margin: "0 0 20px" }}>{t("educators_demo_subtitle")}</p>

      <div style={{ fontSize: 12.5, color: ECO.textMuted, marginBottom: 10 }}>{t("educators_demo_pick_learner")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 18 }}>
        {SAMPLE_LEARNERS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => handleSelect(l)}
            aria-pressed={state.selectedLearnerId === l.id}
            style={{
              textAlign: "left", padding: "14px 16px", borderRadius: 14, cursor: "pointer",
              background: state.selectedLearnerId === l.id ? "rgba(201,168,76,0.15)" : ECO.card,
              border: `2px solid ${state.selectedLearnerId === l.id ? ECO.gold : ECO.border}`, color: ECO.text,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800 }}>{t(l.nameKey)}</div>
          </button>
        ))}
      </div>

      {learner && (
        <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: 18, padding: 20, marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: ECO.textMuted, textTransform: "uppercase", marginBottom: 4 }}>{t("educators_demo_evidence_label")}</div>
          <div style={{ fontSize: 14, color: ECO.text, marginBottom: 14 }}>{t(learner.evidenceKey)}</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: ECO.gold, textTransform: "uppercase", marginBottom: 4 }}>{t("educators_demo_suggestion_label")}</div>
          <div style={{ fontSize: 14, color: ECO.text, marginBottom: 14 }}>{t(learner.suggestionKey)}</div>
          <button type="button" onClick={handleAddToPlan} style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
            {t("educators_demo_add_to_plan")}
          </button>
          {justAdded && (
            <span style={{ marginLeft: 12, fontSize: 12.5, color: ECO.gold, fontWeight: 700 }}>{t("educators_demo_added_to_plan")}</span>
          )}
        </div>
      )}

      <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: 18, padding: 20, marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: ECO.gold, textTransform: "uppercase", marginBottom: 10 }}>{t("educators_demo_plan_heading")}</div>
        {state.planItems.length === 0 ? (
          <div style={{ fontSize: 13, color: ECO.textMuted }}>{t("educators_demo_plan_empty")}</div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {state.planItems.map((item, i) => {
              const itemLearner = SAMPLE_LEARNERS.find((l) => l.id === item.learnerId);
              return (
                <li key={i} style={{ fontSize: 13.5, color: ECO.text, marginBottom: 8 }}>
                  <strong>{itemLearner ? t(itemLearner.nameKey) : item.learnerId}:</strong> {t(item.suggestionKey)}
                </li>
              );
            })}
          </ul>
        )}
        {state.planItems.length > 0 && state.status !== "done" && (
          <button type="button" onClick={handleComplete} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 10, border: `2px solid ${ECO.gold}`, background: "transparent", color: ECO.gold, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
            {t("students_demo_see_results")}
          </button>
        )}
        {state.status === "done" && (
          <div style={{ marginTop: 12, fontSize: 13, color: ECO.text }}>{t("educators_demo_results_heading")}: {state.planItems.length}</div>
        )}
      </div>

      <GlobalJonaAssistant
        context={{ pathway: "educator", appName: "HSD Educators" }}
        suggestedPrompts={["How does this work?"]}
        demoScript={buildEducatorsJonaScript}
        demoState={null}
        demoGeneration={state.generation}
        bottomOffset={88}
      />
    </div>
  );
}
