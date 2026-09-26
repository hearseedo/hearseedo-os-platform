// Adults demo pathway (Phase 2, 2026-09-26) — "order a small coffee to take
// away." The barista turn-taking is the ONE primary conversation interface;
// Jona stays in the separate floating bubble for supplementary help, so the
// two never compete as parallel chat panels on the same screen. No chat.js
// call anywhere — barista replies are derived deterministically from
// evaluateOrder()'s slot extraction, never a live model call.
import { useEffect, useReducer, useRef, useState } from "react";
import { ECO, useJourney } from "../EcosystemDemoShell";
import { useLang } from "../../hooks/useLang";
import { speakWithBrowserTts } from "../../lib/browserNarration";
import GlobalJonaAssistant from "../../jona/GlobalJonaAssistant";
import { adultsReducer, initialState } from "./adultsReducer";
import { nextMissingSlot } from "./evaluateOrder";
import { trackDemoEvent as trackEvent } from "../trackDemoEvent";
import AdultsResults from "./AdultsResults";

const trackDemoEvent = (event, meta) => trackEvent(event, "adult", meta);

function baristaReplyKey(order) {
  const missing = nextMissingSlot(order);
  if (missing === "size") return "adults_demo_ask_size";
  if (missing === "service") return "adults_demo_ask_service";
  if (missing === null) return "adults_demo_order_complete";
  return null; // still missing the drink itself — no scripted line, just wait for it
}

function buildAdultsJonaScript() {
  return {
    "Can you help me say this?": "Try naming the drink, the size, and whether it's for here or to go — all in one sentence if you can.",
    _default: "This guided demo only responds to a few set questions and to what you actually say to the barista — try typing your order below, then ask me again and I'll respond to exactly what you said.",
  };
}

export default function AdultsPractice() {
  const { t } = useLang();
  const { voiceOn } = useJourney();
  const [state, dispatch] = useReducer(adultsReducer, undefined, initialState);
  const [draft, setDraft] = useState("");
  const [showResults, setShowResults] = useState(false);
  const spokenRef = useRef("");

  useEffect(() => {
    trackDemoEvent("eco_demo_entry");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replyKey = state.turns.length > 0 ? baristaReplyKey(state.order) : null;
  const replyText = replyKey ? t(replyKey) : null;

  useEffect(() => {
    if (!voiceOn || !replyText || spokenRef.current === replyText) return;
    spokenRef.current = replyText;
    speakWithBrowserTts(replyText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, replyText]);

  function handleSubmit(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const wasComplete = state.status === "complete";
    dispatch({ type: "SUBMIT_MESSAGE", text });
    setDraft("");
    if (!wasComplete) {
      trackDemoEvent(state.turns.length === 0 ? "adults_order_started" : "adults_order_turn", {});
    }
  }

  function handleHint() {
    dispatch({ type: "REQUEST_HINT" });
    trackDemoEvent("adults_help_requested");
  }

  function handleSeeResults() {
    setShowResults(true);
    trackDemoEvent("adults_task_completed");
  }

  function handleOrderAgain() {
    dispatch({ type: "RESET" });
    setShowResults(false);
    trackDemoEvent("adults_order_again");
  }

  if (showResults) {
    return <AdultsResults state={state} onOrderAgain={handleOrderAgain} />;
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: ECO.gold, marginBottom: 6 }}>
        {t("adults_demo_eyebrow")}
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 8px" }}>{t("adults_demo_title")}</h2>
      <p style={{ color: ECO.textMuted, fontSize: 13, lineHeight: 1.6, margin: "0 0 20px" }}>{t("adults_demo_subtitle")}</p>

      <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: 18, padding: 22, marginBottom: 18 }}>
        {state.turns.map((turn, i) => (
          <div key={i} style={{ marginBottom: 10, display: "flex", flexDirection: "column", alignItems: turn.role === "visitor" ? "flex-end" : "flex-start" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: ECO.textMuted, textTransform: "uppercase", marginBottom: 2 }}>
              {turn.role === "visitor" ? "You" : t("adults_demo_barista_label")}
            </div>
            <div style={{
              background: turn.role === "visitor" ? "rgba(201,168,76,0.15)" : "#0d0d0d",
              border: `2px solid ${turn.role === "visitor" ? ECO.gold : ECO.border}`,
              borderRadius: 14, padding: "10px 14px", maxWidth: "80%", fontSize: 13.5,
            }}>
              {turn.text}
            </div>
          </div>
        ))}
        {replyText && (
          <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: ECO.textMuted, textTransform: "uppercase", marginBottom: 2 }}>{t("adults_demo_barista_label")}</div>
            <div style={{ background: "#0d0d0d", border: `2px solid ${ECO.border}`, borderRadius: 14, padding: "10px 14px", maxWidth: "80%", fontSize: 13.5 }}>
              {replyText}
            </div>
          </div>
        )}

        {state.status === "complete" ? (
          <button type="button" onClick={handleSeeResults} style={{ marginTop: 10, padding: "10px 20px", borderRadius: 12, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
            {t("students_demo_see_results")}
          </button>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("adults_demo_input_placeholder")}
              rows={2}
              style={{
                width: "100%", boxSizing: "border-box", background: "#0d0d0d", color: ECO.text,
                border: `2px solid ${ECO.border}`, borderRadius: 14, padding: 12, fontSize: 14, fontFamily: "inherit",
                resize: "vertical", marginBottom: 10,
              }}
            />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="submit" disabled={!draft.trim()} style={{
                padding: "10px 20px", borderRadius: 12, border: "none", cursor: draft.trim() ? "pointer" : "default",
                background: draft.trim() ? ECO.gold : ECO.border, color: draft.trim() ? "#0a0700" : ECO.textMuted, fontWeight: 800, fontSize: 13,
              }}>
                {t("adults_demo_submit")}
              </button>
              {!state.usedHint && (
                <button type="button" onClick={handleHint} style={{ padding: "10px 16px", borderRadius: 12, border: `2px solid ${ECO.border}`, background: "transparent", color: ECO.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {t("adults_demo_hint_button")}
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <GlobalJonaAssistant
        context={{ pathway: "adult", appName: "Speak Ready" }}
        suggestedPrompts={["Can you help me say this?"]}
        demoScript={buildAdultsJonaScript}
        demoState={null}
        bottomOffset={88}
      />
    </div>
  );
}
