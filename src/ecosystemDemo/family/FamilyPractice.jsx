// Family demo pathway — reuses the real Monkey Yoga Phonics lesson script
// (src/familyDemo/data.js) and characters, unchanged. Adds real attempt
// tracking and an honest results step, which the Family branch previously
// lacked entirely (2026-09-26). Every pick — correct or incorrect —
// produces a response derived from ACTIVITY_SCRIPT.options[].correct, never
// a hardcoded assumption about which option is right.
import { useEffect, useReducer, useRef, useState } from "react";
import { ECO, useJourney } from "../EcosystemDemoShell";
import { useLang } from "../../hooks/useLang";
import { speakWithBrowserTts } from "../../lib/browserNarration";
import GlobalJonaAssistant from "../../jona/GlobalJonaAssistant";
import { ACTIVITY_SCRIPT } from "../../familyDemo/data";
import { JONA_HELP_SCRIPT } from "../data";
import { familyReducer, initialState } from "./familyReducer";
import { trackDemoEvent as trackEvent } from "../trackDemoEvent";
import { withGeneration } from "../withGeneration";
import FamilyResults from "./FamilyResults";

const trackDemoEvent = (event, meta) => trackEvent(event, "family", meta);
const reducer = withGeneration(familyReducer);

export default function FamilyPractice() {
  const { t } = useLang();
  const { voiceOn } = useJourney();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [showResults, setShowResults] = useState(false);
  const spokenRef = useRef("");

  const lastAttempt = state.attempts[state.attempts.length - 1] ?? null;

  useEffect(() => {
    trackDemoEvent("eco_demo_entry");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!voiceOn || !lastAttempt) return;
    const line = lastAttempt.correct ? t("family_demo_correct") : t("family_demo_incorrect");
    if (spokenRef.current === line) return;
    spokenRef.current = line;
    speakWithBrowserTts(line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, lastAttempt?.optionId, lastAttempt?.correct]);

  function handlePick(opt) {
    dispatch({ type: "PICK", optionId: opt.id, correct: !!opt.correct });
    trackDemoEvent(
      state.attempts.length === 0 ? "family_first_pick" : "family_retry",
      { addedReason: !!opt.correct }
    );
  }

  function handleHint() {
    dispatch({ type: "REQUEST_HINT" });
    trackDemoEvent("family_help_requested");
  }

  function handleSeeResults() {
    dispatch({ type: "COMPLETE" });
    setShowResults(true);
    trackDemoEvent("family_task_completed", { questionsCompleted: state.attempts.length });
  }

  if (showResults) {
    return <FamilyResults state={state} word={ACTIVITY_SCRIPT.word} />;
  }

  return (
    <>
      <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: 18, padding: 24, textAlign: "center", marginBottom: 20, position: "relative" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ECO.gold, textTransform: "uppercase", marginBottom: 8 }}>{ACTIVITY_SCRIPT.title}</div>
        <div style={{ fontSize: 13, color: ECO.textMuted, marginBottom: 8 }}>{ACTIVITY_SCRIPT.prompt}</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#2f8fed", marginBottom: 18 }}>{ACTIVITY_SCRIPT.word}</div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          {ACTIVITY_SCRIPT.options.map((opt) => {
            const wasPicked = lastAttempt?.optionId === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handlePick(opt)}
                aria-pressed={wasPicked}
                style={{ fontSize: 30, background: wasPicked ? "rgba(201,168,76,0.15)" : "#0d0d0d", border: `2px solid ${wasPicked ? ECO.gold : ECO.border}`, borderRadius: 14, padding: "12px 18px", cursor: "pointer" }}
              >
                <div>{opt.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: ECO.textMuted, marginTop: 4 }}>{opt.label}</div>
              </button>
            );
          })}
        </div>
        {!state.usedHint && (
          <button type="button" onClick={handleHint} style={{ marginTop: 16, padding: "8px 16px", borderRadius: 10, border: `2px solid ${ECO.border}`, background: "transparent", color: ECO.text, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            {t("family_demo_hint_button")}
          </button>
        )}
        <p style={{ fontSize: 12, color: ECO.textMuted, marginTop: 18 }}>
          Stuck? Tap the Jona bubble in the corner — a real student never needs to leave this screen to get help.
        </p>
      </div>

      {lastAttempt && (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 18 }}>
          <img src="/assets/hsd/family/characters/family-jona.webp" alt="Jona" width={48} height={48} style={{ width: 48, height: 48, objectFit: "contain", flexShrink: 0 }} />
          <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: "4px 18px 18px 18px", padding: "14px 18px", maxWidth: 520, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: ECO.gold, textTransform: "uppercase", marginBottom: 4 }}>Jona</div>
            <div style={{ fontSize: 14, color: ECO.text, lineHeight: 1.6, marginBottom: 12 }}>
              {lastAttempt.correct ? (ACTIVITY_SCRIPT.successLine || t("family_demo_correct")) : t("family_demo_incorrect")}
            </div>
            {lastAttempt.correct && (
              <button type="button" onClick={handleSeeResults} style={{ padding: "8px 16px", borderRadius: 10, border: `2px solid ${ECO.gold}`, background: "transparent", color: ECO.gold, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
                {t("family_demo_see_results")}
              </button>
            )}
          </div>
        </div>
      )}

      <GlobalJonaAssistant
        context={{ pathway: "family", appName: "Monkey Yoga Phonics", lesson: ACTIVITY_SCRIPT.title }}
        suggestedPrompts={["I don't understand this", "Can you give me a hint?", "Can we practise this together?", "Is my answer okay?"]}
        demoScript={JONA_HELP_SCRIPT}
        demoState={lastAttempt?.optionId ?? null}
        demoGeneration={state.generation}
        bottomOffset={88}
        size={84}
      />
    </>
  );
}
