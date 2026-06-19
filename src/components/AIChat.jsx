import { useState, useRef, useEffect } from "react";
import { COLORS } from "../constants/colors";
import { useAuth } from "../hooks/useAuth";
import { sendMessage } from "../lib/claude";

const QUICK_ACTIONS = [
  { label: "What should I study next?", icon: "🎯" },
  { label: "Help me prepare for Eiken Pre-2", icon: "📚" },
  { label: "Create a lesson for my child", icon: "👶" },
  { label: "Practice travel English", icon: "✈️" },
];

const PLAN_LIMITS = {
  individual: 5, kids_starter: 15, english_boost: 15,
  adult_growth: 30, family_full: 30, all_access: 100,
};

function buildGreeting(name) {
  const first = (name || "").split(" ")[0] || "there";
  const hour  = new Date().getHours();
  const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${period}, ${first}. All systems are online. How may I assist you today?`;
}

async function speakText(text) {
  // Strip markdown symbols before sending to TTS
  const clean = text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/#+\s/g, "")
    .replace(/`(.+?)`/g, "$1")
    .slice(0, 800);

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: clean }),
  });
  if (!res.ok) throw new Error("TTS failed");
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  await audio.play();
  return audio;
}

export default function AIChat() {
  const { user }   = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [listening, setListening] = useState(false);
  const [limitHit, setLimitHit]   = useState(false);
  const [msgCount, setMsgCount]   = useState(0);
  const [voiceOn, setVoiceOn]       = useState(false);
  const [speaking, setSpeaking]     = useState(false);
  const [greeted, setGreeted]       = useState(false);
  const [greetBlocked, setGreetBlocked] = useState(false);
  const audioRef    = useRef(null);
  const bottomRef   = useRef(null);
  const greetingRef = useRef(null);

  const dailyLimit = PLAN_LIMITS[user?.plan] ?? PLAN_LIMITS.individual;
  const remaining  = Math.max(0, dailyLimit - msgCount);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build greeting text once user is known, but don't autoplay (browser blocks it)
  useEffect(() => {
    if (!user?.name || greeted) return;
    setGreeted(true);
    greetingRef.current = buildGreeting(user.name);
    setGreetBlocked(true); // show the play button immediately
  }, [user?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const playGreeting = () => {
    setGreetBlocked(false);
    setSpeaking(true);
    speakText(greetingRef.current)
      .then((audio) => {
        audioRef.current = audio;
        audio.onended = () => { setSpeaking(false); audioRef.current = null; };
      })
      .catch(() => setSpeaking(false));
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(false);
  };

  const send = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading || limitHit) return;
    stopSpeaking();
    const userMsg = { role: "user", text: trimmed };
    const next    = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await sendMessage(next, user);
      setMessages([...next, { role: "assistant", text: reply }]);
      setMsgCount((c) => c + 1);

      if (voiceOn) {
        setSpeaking(true);
        try {
          const audio = await speakText(reply);
          audioRef.current = audio;
          audio.onended = () => { setSpeaking(false); audioRef.current = null; };
        } catch {
          setSpeaking(false);
        }
      }
    } catch (err) {
      if (err.message?.includes("limit")) {
        setLimitHit(true);
        setMessages([...next, { role: "assistant", text: err.message }]);
      } else {
        setMessages([...next, { role: "assistant", text: "I'm having a moment. Try again in a second." }]);
      }
    }
    setLoading(false);
  };

  const startListening = () => {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SR) { alert("Speech recognition isn't supported in this browser."); return; }
    const r    = new SR();
    r.lang     = "en-US";
    r.onstart  = () => setListening(true);
    r.onend    = () => setListening(false);
    r.onerror  = () => setListening(false);
    r.onresult = (e) => send(e.results[0][0].transcript);
    r.start();
  };

  const toggleVoice = () => {
    if (voiceOn) stopSpeaking();
    setVoiceOn((v) => !v);
  };

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase" }}>
          HSD AI ASSISTANT
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Voice toggle */}
          <button
            onClick={toggleVoice}
            title={voiceOn ? "Voice on — click to mute" : "Click to enable Kai voice"}
            style={{
              background: voiceOn ? "rgba(224,16,16,0.15)" : "transparent",
              border: `1px solid ${voiceOn ? "rgba(224,16,16,0.5)" : "#2a2a2a"}`,
              borderRadius: 20, padding: "3px 10px",
              color: voiceOn ? COLORS.red : COLORS.textDim,
              fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              transition: "all 0.2s",
            }}
          >
            {speaking ? (
              <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
                {[0,1,2,3].map((i) => (
                  <span key={i} style={{
                    width: 2, borderRadius: 2, background: COLORS.red,
                    animation: `kaiBar 0.8s ${i * 0.15}s ease-in-out infinite alternate`,
                    height: `${6 + i * 3}px`,
                  }} />
                ))}
              </span>
            ) : (
              <span>{voiceOn ? "🔊" : "🔇"}</span>
            )}
            <span>{voiceOn ? "Voice" : "Voice off"}</span>
          </button>
          <div style={{ fontSize: 10, color: remaining <= 3 ? COLORS.red : COLORS.textDim }}>
            {user?.plan === "all_access" ? "∞ unlimited" : `${remaining} msg${remaining !== 1 ? "s" : ""} left today`}
          </div>
        </div>
      </div>

      {limitHit && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(224,16,16,0.08)", border: "1px solid rgba(224,16,16,0.25)", borderRadius: 8, fontSize: 12, color: "#ff6060", textAlign: "center", lineHeight: 1.5 }}>
          Daily limit reached — resets at midnight Japan time.<br />
          <a href={import.meta.env.VITE_LANDING_PAGE_URL + "/#pricing"} target="_blank" rel="noreferrer" style={{ color: COLORS.red, fontWeight: 700 }}>
            Upgrade your plan →
          </a>
        </div>
      )}

      {/* Messages */}
      <div style={{ minHeight: 90, maxHeight: 300, overflowY: "auto", marginBottom: 14, padding: 16, background: "#0d0d0d", borderRadius: 10, border: "1px solid #1e1e1e" }}>
        {messages.length === 0 ? (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Avatar speaking={speaking} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>
                {greetingRef.current || buildGreeting(user?.name)}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>
                I'm here to help you learn, grow, and build confidence in English.
              </p>
              {greetBlocked && !speaking && (
                <button
                  onClick={playGreeting}
                  style={{
                    marginTop: 10, padding: "7px 16px",
                    background: "rgba(224,16,16,0.12)",
                    border: "1px solid rgba(224,16,16,0.4)", borderRadius: 20,
                    color: COLORS.red, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    animation: "greetPulse 2s ease-in-out infinite",
                  }}
                >
                  <span style={{ fontSize: 14 }}>▶</span> Hear Kai
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "82%", padding: "9px 13px", borderRadius: 10,
                background: m.role === "user" ? "rgba(224,16,16,0.18)" : "#1a1a1a",
                border: `1px solid ${m.role === "user" ? "rgba(224,16,16,0.3)" : "#2a2a2a"}`,
                fontSize: 13, lineHeight: 1.5, animation: "fadeIn 0.2s ease",
              }}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: "flex-start", padding: "9px 16px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10 }}>
                <span style={{ display: "inline-flex", gap: 4 }}>
                  {[0,1,2].map((i) => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#e01010", animation: `blink 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                  ))}
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {QUICK_ACTIONS.map((qa, i) => (
          <button
            key={i}
            onClick={() => send(qa.label)}
            style={{
              padding: "6px 12px", background: "#0d0d0d",
              border: "1px solid #2a2a2a", borderRadius: 20,
              color: COLORS.textMuted, fontSize: 11, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, transition: "all 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "#e01010"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "#2a2a2a"}
          >
            {qa.icon} {qa.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          background: "#0d0d0d", border: "1px solid #2a2a2a",
          borderRadius: 25, padding: "4px 16px", gap: 8,
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={limitHit ? "Upgrade to keep chatting…" : "Ask HSD AI anything…"}
            disabled={limitHit}
            style={{ flex: 1, background: "none", border: "none", color: limitHit ? COLORS.textDim : COLORS.text, fontSize: 13, padding: "7px 0", cursor: limitHit ? "not-allowed" : "text" }}
          />
          <button onClick={() => send()} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>➤</button>
        </div>
        <button
          onClick={startListening}
          style={{
            width: 44, height: 44, borderRadius: "50%",
            background: listening ? "#ff2020" : COLORS.red,
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, boxShadow: "0 0 16px rgba(224,16,16,0.4)",
            animation: listening ? "pulse 1s ease-in-out infinite" : "glowPulse 3s ease-in-out infinite",
            flexShrink: 0,
          }}
          title="Tap to speak"
        >
          🎤
        </button>
      </div>
      <div style={{ textAlign: "center", fontSize: 10, color: COLORS.textDim, marginTop: 8 }}>
        {voiceOn ? "Kai voice active — responses will be spoken aloud" : "Tap to talk • Enable voice for Kai responses"}
      </div>

      <style>{`
        @keyframes blink { 0%,80%,100%{opacity:0} 40%{opacity:1} }
        @keyframes kaiBar { from{opacity:0.4} to{opacity:1} }
        @keyframes greetPulse { 0%,100%{box-shadow:0 0 0 0 rgba(224,16,16,0.3)} 50%{box-shadow:0 0 0 6px rgba(224,16,16,0)} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 8px rgba(224,16,16,0.4)} 50%{box-shadow:0 0 18px rgba(224,16,16,0.8)} }
      `}</style>
    </div>
  );
}

function Avatar({ speaking }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
      background: "rgba(224,16,16,0.15)",
      border: `1px solid ${speaking ? "#e01010" : "rgba(224,16,16,0.3)"}`,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      boxShadow: speaking ? "0 0 12px rgba(224,16,16,0.5)" : "none",
      animation: speaking ? "glowPulse 1.2s ease-in-out infinite" : "none",
      transition: "box-shadow 0.3s, border-color 0.3s",
    }}>🤖</div>
  );
}
