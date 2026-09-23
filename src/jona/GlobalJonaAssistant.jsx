// Global Jona Assistant (2026-09-24) — the reusable, droppable component
// referenced throughout this brief: "Jona should be available inside the
// apps," "reusable platform component," "Global Jona Assistant." One Jona
// across HSD OS AI — this is the single implementation meant to eventually
// sit inside every app (EIKEN, WonderCamp, Career Ready, etc.), not a
// one-off built for this demo.
//
// Two modes, same component:
//  - Real mode (default): calls the live sendMessage() (lib/claude.js),
//    the same backend AIChat.jsx already uses — genuinely functional
//    wherever a real, signed-in user drops it in.
//  - Demo mode (`demoScript` prop): for the public, no-auth ecosystem
//    demo — canned, pre-written answers to the suggested prompts, no live
//    AI/Firestore call, same "demos must not depend on live services"
//    principle as src/familyDemo. Only used where demoScript is passed.
//
// `context` — { pathway, appName, lesson } — is threaded into the real
// backend call via sendMessage's new optional context param, so Jona's
// answer is grounded in what the learner is actually looking at instead
// of a generic reply. This is the "understand the context of the
// experience" requirement.
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { sendMessage } from "../lib/claude";

export default function GlobalJonaAssistant({ context, suggestedPrompts, demoScript, accent = "#e0559c", bottomOffset = 20 }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || sending) return;
    const next = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setInput("");
    setError("");

    if (demoScript) {
      // Scripted demo path — no live call. Falls back to a friendly
      // generic line if this exact prompt wasn't scripted, so the demo
      // never looks broken for an unscripted question.
      setSending(true);
      await new Promise((r) => setTimeout(r, 500));
      const reply = demoScript[trimmed] ?? demoScript._default ?? "Good question — in the real app I'd help you with exactly that, right here.";
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
      setSending(false);
      return;
    }

    if (!user) {
      setError("Sign in to talk with Jona.");
      return;
    }
    setSending(true);
    try {
      const reply = await sendMessage(next, user, undefined, context);
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch (e) {
      setError(e.message ?? "Jona is taking a quick break — try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Floating launcher — never covers content, stays bottom-right */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Jona" : "Ask Jona"}
        style={{
          position: "fixed", bottom: bottomOffset, right: 20, zIndex: 999,
          width: 60, height: 60, borderRadius: "50%", border: "none", cursor: "pointer",
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          boxShadow: `0 6px 20px ${accent}66`,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", padding: 0,
        }}
      >
        {open ? (
          <span style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>✕</span>
        ) : (
          <img src="/assets/hsd/jona/jona-avatar.png" alt="Jona" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </button>

      {open && (
        <div
          style={{
            position: "fixed", bottom: bottomOffset + 72, right: 20, zIndex: 999,
            width: "min(360px, calc(100vw - 40px))", maxHeight: "min(520px, calc(100vh - 140px))",
            background: "#fff", borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          <div style={{ background: accent, color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/assets/hsd/jona/jona-avatar.png" alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Jona</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>{context?.appName ? `Helping with ${context.appName}` : "Your guide across HSD OS AI"}</div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10, minHeight: 160 }}>
            {messages.length === 0 && (
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
                {context?.lesson
                  ? `Hi, I'm Jona. I can see you're working on "${context.lesson}" — ask me anything about it.`
                  : "Hi, I'm Jona — your guide, teacher, practice partner, and confidence coach. You're never learning alone. What can I help with?"}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%", padding: "9px 13px", fontSize: 13, lineHeight: 1.5,
                  borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.role === "user" ? accent : "#f4f0f2",
                  color: m.role === "user" ? "#fff" : "#1a1a1a",
                }}
              >
                {m.text}
              </div>
            ))}
            {sending && <div style={{ fontSize: 12, color: "#999", fontStyle: "italic" }}>Jona is thinking…</div>}
            {error && <div style={{ fontSize: 12, color: "#c23a3a" }}>{error}</div>}
            <div ref={bottomRef} />
          </div>

          {suggestedPrompts?.length > 0 && messages.length === 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 14px 10px" }}>
              {suggestedPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 20, border: `1px solid ${accent}55`, background: `${accent}11`, color: accent, cursor: "pointer", fontWeight: 700 }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: 10, borderTop: "1px solid #eee", display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask Jona…"
              style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 13, outline: "none" }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || sending}
              style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: input.trim() ? accent : "#eee", color: input.trim() ? "#fff" : "#999", fontWeight: 700, fontSize: 13, cursor: input.trim() ? "pointer" : "default" }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
