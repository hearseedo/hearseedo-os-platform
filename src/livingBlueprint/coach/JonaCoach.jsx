import { useState } from "react";
import { TOKENS } from "../../constants/tokens";
import { useMobile } from "../../hooks/useMobile";
import { sendMessage } from "../../lib/claude";
import { getTodaysRecommendation } from "../home/recommendation";
import JonaVisualState from "./JonaVisualState";
import { JONA_STATE_ORDER, JONA_STATES } from "./jonaStates";

// Rebuild prompt section 12 — Jona Coach. Wired to the real sendMessage()
// used by the live AIChat.jsx (same /api/chat endpoint, same message shape),
// so this is a genuinely working coach, not a mockup — it just lives at a
// flagged preview route instead of the live Dashboard chat panel.
export default function JonaCoach({ user }) {
  const isMobile = useMobile();
  const [state, setState] = useState("welcome");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [listening, setListening] = useState(false);

  const { topic, activity } = getTodaysRecommendation(user || {});
  const suggestedPrompts = [topic, activity].filter(Boolean);

  // Mirrors components/AIChat.jsx's startListening — same Web Speech API
  // pattern, same "send immediately on result" behavior.
  function startListening() {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SR) { setError("Speech recognition isn't supported in this browser."); return; }
    const r = new SR();
    r.lang = "en-US";
    r.onstart = () => { setListening(true); setState("listening"); };
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); setState("welcome"); };
    r.onresult = (e) => handleSend(e.results[0][0].transcript);
    r.start();
  }

  async function handleSend(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || sending) return;
    if (!user) { setError("Sign in to chat with Jona — this preview needs a real account for /api/chat."); return; }

    const userMsg = { role: "user", text: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setError(null);
    setSending(true);
    setState("thinking");
    try {
      const reply = await sendMessage(next, user);
      setMessages([...next, { role: "assistant", text: reply }]);
      setState("speaking");
    } catch (e) {
      setError(e.message ?? "Jona is unavailable right now.");
      setState("concern");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: TOKENS.space[6] }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: isMobile ? "center" : "flex-start", gap: TOKENS.space[4], width: isMobile ? "100%" : 220, flexShrink: 0 }}>
        <JonaVisualState state={state} size={isMobile ? 110 : 170} />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: isMobile ? "center" : "flex-start" }}>
          {JONA_STATE_ORDER.map(s => (
            <button key={s} onClick={() => setState(s)} style={{
              fontSize: 10, padding: "4px 8px", borderRadius: TOKENS.radius.pill, cursor: "pointer",
              border: `1px solid ${s === state ? TOKENS.color.gold : TOKENS.color.border}`,
              background: s === state ? "rgba(201,168,76,0.1)" : "transparent",
              color: s === state ? TOKENS.color.gold : TOKENS.color.textMuted,
            }}>
              {JONA_STATES[s].label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: TOKENS.color.textDim, textAlign: isMobile ? "center" : "left" }}>
          State changes automatically while chatting — buttons above are for QA.
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{
          flex: 1, minHeight: 280, maxHeight: 420, overflowY: "auto", padding: TOKENS.space[4],
          borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.color.border}`, background: TOKENS.color.surfaceRaised,
          display: "flex", flexDirection: "column", gap: 10, marginBottom: TOKENS.space[3],
        }}>
          {messages.length === 0 && (
            <div style={{ color: TOKENS.color.textMuted, fontSize: TOKENS.font.size.sm }}>
              Ask Jona anything, or try a suggestion below.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%", padding: "8px 12px", borderRadius: TOKENS.radius.md,
              background: m.role === "user" ? TOKENS.color.gold : TOKENS.color.surface,
              color: m.role === "user" ? "#0a0a0a" : TOKENS.color.starlight,
              fontSize: TOKENS.font.size.sm,
            }}>
              {m.text}
            </div>
          ))}
          {sending && <div style={{ color: TOKENS.color.textDim, fontSize: TOKENS.font.size.xs }}>Jona is thinking…</div>}
        </div>

        {error && <div style={{ color: TOKENS.color.gold, fontSize: TOKENS.font.size.xs, marginBottom: 8 }}>{error}</div>}

        {suggestedPrompts.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: TOKENS.space[3] }}>
            {suggestedPrompts.map((p, i) => (
              <button key={i} onClick={() => handleSend(p)} style={{
                fontSize: TOKENS.font.size.xs, padding: "6px 12px", borderRadius: TOKENS.radius.pill,
                border: `1px solid ${TOKENS.color.border}`, background: "transparent", color: TOKENS.color.textMuted, cursor: "pointer",
              }}>
                {p}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder={listening ? "Listening…" : "Type a message to Jona…"}
            style={{
              flex: 1, padding: "12px 14px", borderRadius: TOKENS.radius.pill, border: `1px solid ${TOKENS.color.border}`,
              background: TOKENS.color.bg, color: TOKENS.color.starlight, fontSize: TOKENS.font.size.sm,
            }}
          />
          <button
            onClick={startListening}
            disabled={sending || listening}
            title="Speak to Jona"
            style={{
              width: 44, height: 44, flexShrink: 0, borderRadius: "50%", border: `1px solid ${listening ? TOKENS.color.gold : TOKENS.color.border}`,
              background: listening ? "rgba(201,168,76,0.15)" : "transparent",
              color: listening ? TOKENS.color.gold : TOKENS.color.textMuted,
              cursor: sending ? "not-allowed" : "pointer", fontSize: 18,
              animation: listening ? "pulse 1s ease-in-out infinite" : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
          <button onClick={() => handleSend()} disabled={sending} style={{
            padding: "12px 24px", borderRadius: TOKENS.radius.pill, border: "none",
            background: TOKENS.color.gold, color: "#0a0a0a", fontWeight: 800, cursor: sending ? "not-allowed" : "pointer",
          }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
