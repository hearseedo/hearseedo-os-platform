// Students demo pathway (Phase 1, 2026-09-26) — "turn a short answer into
// communication." Real recorded state, deterministic evaluation (see
// evaluateAttempt.js), and Jona coaching that reflects the visitor's actual
// attempt — never a canned line unrelated to what they just did. No chat.js
// call anywhere in this component; the floating Jona bubble below uses
// GlobalJonaAssistant's scripted demoScript path only.
import { useEffect, useReducer, useRef, useState } from "react";
import { ECO, useJourney } from "../EcosystemDemoShell";
import { useLang } from "../../hooks/useLang";
import { speakWithBrowserTts } from "../../lib/browserNarration";
import GlobalJonaAssistant from "../../jona/GlobalJonaAssistant";
import { studentsReducer, initialState } from "./studentsReducer";
import { evaluateAttempt } from "./evaluateAttempt";
import { STUDENTS_QUESTIONS } from "./data";
import StudentsResults from "./StudentsResults";
import { trackDemoEvent as trackEvent } from "../trackDemoEvent";

const trackDemoEvent = (event, meta) => trackEvent(event, "student", meta);

function buildStudentsJonaScript(demoState) {
  const { lastAttemptText, evaluation } = demoState ?? {};
  const answerLine = !lastAttemptText
    ? "Give it a try first — type your answer below, then ask me again and I'll tell you how it went."
    : evaluation?.needsReason
      ? `You wrote “${lastAttemptText}” — I can see the activity, but not yet a reason. Try adding “because…”.`
      : `You wrote “${lastAttemptText}” — that already includes a reason. Nice work!`;
  return {
    "Can you give me a hint?": "Sure — after saying what you like, add “because” and finish the thought. That's the whole trick.",
    "Is my answer okay?": answerLine,
    _default: "This guided demo only responds to a few set questions and to your actual typed answer — try typing your answer below, then ask me again and I'll respond to exactly what you wrote.",
  };
}

export default function StudentsPractice() {
  const { t } = useLang();
  const { voiceOn } = useJourney();
  const [state, dispatch] = useReducer(studentsReducer, undefined, () => initialState(0));
  const [draft, setDraft] = useState("");
  const [showResults, setShowResults] = useState(false);
  const attemptSeqRef = useRef(0);
  const spokenRef = useRef("");

  const question = STUDENTS_QUESTIONS[state.questionIndex] ?? STUDENTS_QUESTIONS[0];
  const attempts = state.attempts;
  const lastAttempt = attempts[attempts.length - 1] ?? null;
  const previousAttempt = attempts.length > 1 ? attempts[attempts.length - 2] : null;
  const evaluation = lastAttempt
    ? evaluateAttempt(lastAttempt.text, previousAttempt?.text ?? null)
    : null;

  useEffect(() => {
    trackDemoEvent("eco_demo_entry");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Narrate Jona's coaching line when it changes, matching the same
  // voiceOn-gated pattern the shell's own step narration already uses.
  useEffect(() => {
    if (!voiceOn || !lastAttempt || !evaluation) return;
    const line = coachingCopy();
    if (!line || spokenRef.current === line) return;
    spokenRef.current = line;
    speakWithBrowserTts(line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, lastAttempt?.text, evaluation?.addedReason, evaluation?.needsReason]);

  function coachingCopy() {
    if (!lastAttempt || !evaluation) return null;
    const template = evaluation.addedReason
      ? "students_demo_coach_added_reason"
      : evaluation.hadReasonFromStart
        ? "students_demo_coach_reason_from_start"
        : previousAttempt
          ? "students_demo_coach_still_missing"
          : "students_demo_coach_needs_reason";
    return t(template).replace("{attempt}", lastAttempt.text);
  }

  function handleUseStarter(starter) {
    dispatch({ type: "USE_STARTER", starterId: starter.id });
    setDraft(t(starter.textKey));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const seq = attempts.length;
    attemptSeqRef.current = seq;
    dispatch({ type: "SUBMIT_ATTEMPT", text });
    trackDemoEvent(seq === 0 ? "students_first_attempt_submitted" : "students_retry_submitted", {
      hasReason: evaluateAttempt(text, lastAttempt?.text ?? null).hasReason,
    });
  }

  function handleRetry() {
    dispatch({ type: "RETRY" });
    setDraft("");
  }

  function handleHint() {
    dispatch({ type: "REQUEST_HELP" });
    trackDemoEvent("students_help_requested");
  }

  function handleRevealModel() {
    dispatch({ type: "REVEAL_MODEL_ANSWER" });
  }

  function handleNextQuestion() {
    const nextIndex = (state.questionIndex + 1) % STUDENTS_QUESTIONS.length;
    dispatch({ type: "NEXT_QUESTION", nextIndex });
    setDraft("");
    setShowResults(false);
    trackDemoEvent("students_next_question_started");
  }

  function handleSeeResults() {
    dispatch({ type: "COMPLETE" });
    setShowResults(true);
    trackDemoEvent("students_task_completed", { questionsCompleted: state.questionIndex + 1 });
  }

  if (showResults) {
    return (
      <StudentsResults
        state={state}
        lastAttempt={lastAttempt}
        evaluation={evaluation}
        onNextQuestion={handleNextQuestion}
      />
    );
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: ECO.gold, marginBottom: 6 }}>
        {t("students_demo_eyebrow")}
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 8px" }}>{t("students_demo_title")}</h2>
      <p style={{ color: ECO.textMuted, fontSize: 13, lineHeight: 1.6, margin: "0 0 20px" }}>{t("students_demo_subtitle")}</p>

      <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: 18, padding: 22, marginBottom: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{t(question.promptKey)}</div>

        <div style={{ marginBottom: 10, fontSize: 12, color: ECO.textMuted }}>{t("students_demo_starter_label")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {question.starters.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleUseStarter(s)}
              aria-pressed={state.usedStarterId === s.id}
              style={{
                fontSize: 12.5, fontWeight: 700, padding: "8px 14px", borderRadius: 999, cursor: "pointer",
                background: state.usedStarterId === s.id ? "rgba(201,168,76,0.18)" : "#0d0d0d",
                border: `2px solid ${state.usedStarterId === s.id ? ECO.gold : ECO.border}`,
                color: state.usedStarterId === s.id ? ECO.gold : ECO.text,
              }}
            >
              {t(s.textKey)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="students-demo-answer" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            {t("students_demo_input_placeholder")}
          </label>
          <textarea
            id="students-demo-answer"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("students_demo_input_placeholder")}
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box", background: "#0d0d0d", color: ECO.text,
              border: `2px solid ${ECO.border}`, borderRadius: 14, padding: 14, fontSize: 14, fontFamily: "inherit",
              resize: "vertical", marginBottom: 12,
            }}
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={!draft.trim()}
              style={{
                padding: "10px 20px", borderRadius: 12, border: "none", cursor: draft.trim() ? "pointer" : "default",
                background: draft.trim() ? ECO.gold : ECO.border, color: draft.trim() ? "#0a0700" : ECO.textMuted,
                fontWeight: 800, fontSize: 13,
              }}
            >
              {t("students_demo_submit")}
            </button>
            {!state.usedHint && (
              <button type="button" onClick={handleHint} style={{ padding: "10px 16px", borderRadius: 12, border: `2px solid ${ECO.border}`, background: "transparent", color: ECO.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {t("students_demo_hint_button")}
              </button>
            )}
          </div>
        </form>
      </div>

      {lastAttempt && evaluation && (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 18 }}>
          <img src="/assets/hsd/family/characters/family-jona.webp" alt="Jona" width={48} height={48} style={{ width: 48, height: 48, objectFit: "contain", flexShrink: 0 }} />
          <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: "4px 18px 18px 18px", padding: "14px 18px", maxWidth: 520, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: ECO.gold, textTransform: "uppercase", marginBottom: 4 }}>Jona</div>
            <div style={{ fontSize: 14, color: ECO.text, lineHeight: 1.6, marginBottom: 12 }}>{coachingCopy()}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {evaluation.needsReason && (
                <>
                  <button type="button" onClick={handleRetry} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
                    {t("students_demo_retry")}
                  </button>
                  {!state.modelAnswerRevealed && (
                    <button type="button" onClick={handleRevealModel} style={{ padding: "8px 16px", borderRadius: 10, border: `2px solid ${ECO.border}`, background: "transparent", color: ECO.text, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                      {t("students_demo_show_model")}
                    </button>
                  )}
                </>
              )}
              <button type="button" onClick={handleSeeResults} style={{ padding: "8px 16px", borderRadius: 10, border: `2px solid ${ECO.gold}`, background: "transparent", color: ECO.gold, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
                {t("students_demo_see_results")}
              </button>
            </div>
            {state.modelAnswerRevealed && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${ECO.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: ECO.textMuted, textTransform: "uppercase", marginBottom: 4 }}>{t("students_demo_model_label")}</div>
                <div style={{ fontSize: 13, color: ECO.textMuted, fontStyle: "italic" }}>{t(question.modelAnswerKey)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <GlobalJonaAssistant
        context={{ pathway: "student", appName: "Speak Ready" }}
        suggestedPrompts={["Can you give me a hint?", "Is my answer okay?"]}
        demoScript={buildStudentsJonaScript}
        demoState={{ lastAttemptText: lastAttempt?.text ?? null, evaluation }}
        bottomOffset={88}
      />
    </div>
  );
}
