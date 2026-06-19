import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { sendMessage } from "../lib/claude";
import { COLORS } from "../constants/colors";
import { APP_MAP } from "../constants/apps";

// ── Weekly check-in ───────────────────────────────────────────────────────────
function thisMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

const SESSION_TYPES = [
  { id: "vocab",    label: "Vocabulary Drill",   icon: "📖", desc: "Build and test your word bank",        color: "#4488ff" },
  { id: "speaking", label: "Speaking Practice",  icon: "🎤", desc: "Speak freely, get instant feedback",   color: COLORS.red },
  { id: "grammar",  label: "Grammar Focus",      icon: "✏️", desc: "Fix common mistakes with Jona",      color: "#22c55e" },
  { id: "eiken",    label: "Eiken Prep",         icon: "📝", desc: "Exam-style questions & band scoring",  color: COLORS.gold },
];

const COACH_PROMPTS = {
  vocab: (user) => `You are HSD AI acting as a vocabulary coach for ${user.name}, a ${user.plan} member at roughly CEFR level based on their profile.

Run a 5-round vocabulary drill:
1. Give a word in context (a sentence with the word missing, marked _____)
2. Wait for their answer
3. Give brief feedback (correct/incorrect + the right answer + a memory tip)
4. Move to next word

Start immediately with Round 1. Words should match their level. Keep each exchange under 3 sentences. After 5 rounds, give a score and one study tip.`,

  speaking: (user) => `You are HSD AI acting as a speaking coach for ${user.name}.

Give them a speaking prompt, then respond to what they type as if they spoke it. Give:
- Natural conversation response (1-2 lines)
- One specific language tip (vocabulary, grammar, or phrasing they could improve)
- A follow-up question to keep the conversation going

Start with a warm, interesting speaking prompt suited to an adult Japanese learner. Keep it natural and encouraging. Never be robotic.`,

  grammar: (user) => `You are HSD AI acting as a grammar coach for ${user.name}.

Run a grammar correction session:
1. Give them a sentence with a common mistake Japanese learners make
2. Ask them to correct it
3. Explain the rule simply (1-2 sentences max)
4. Give another sentence

Focus on mistakes Japanese speakers typically make in English (articles, prepositions, verb tenses, subject-verb agreement). After 5 rounds give a summary of patterns to watch.`,

  eiken: (user) => `You are HSD AI acting as an Eiken examiner for ${user.name}.

Run an Eiken-style interview session:
1. Start with a Topic Card question (describe a situation or opinion)
2. Follow up with 2-3 examiner questions
3. After their response, give: band score estimate (1-5), what they did well, one thing to improve
4. Move to next topic

Match the difficulty to their plan: kids_starter/english_boost = Grade 3/Pre-2, adult_growth/family_full = Grade 2/Pre-1, all_access = Grade 1. Be encouraging but honest about scores.`,
};

const WEEKLY_PROMPT = (user) => `You are HSD AI doing ${user.name}'s Monday weekly check-in.

Their stats:
- Streak: ${user.streak} days
- XP earned: ${user.xpEarned}
- Confidence score: ${user.confidenceScore}%
- Lessons completed: ${user.lessonsCompleted}
- Apps unlocked: ${(user.subscriptions ?? []).join(", ") || "starter"}
- Plan: ${user.plan}

Give a personalised Monday briefing in exactly this structure (use line breaks between sections):
1. One sentence acknowledging their week (reference their actual stats, be specific)
2. THIS WEEK'S FOCUS: One clear focus area for the week (2 sentences max)
3. YOUR CHALLENGE: One specific challenge to complete this week
4. JONA SAYS: One motivational line in your JONA voice

Keep the whole thing under 120 words. Sound human, not corporate.`;

export default function AICoach({ user }) {
  const [view, setView]               = useState("home");      // home | session | weekly
  const [sessionType, setSessionType] = useState(null);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [weeklyData, setWeeklyData]   = useState(null);
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [listening, setListening]     = useState(false);
  const bottomRef                     = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Load weekly check-in from Firestore
  useEffect(() => {
    async function loadWeekly() {
      if (!user?.uid) return;
      try {
        const monday = thisMonday();
        const snap   = await getDoc(doc(db, "users", user.uid, "weeklyCheckin", monday));
        if (snap.exists()) setWeeklyData(snap.data());
      } catch {}
      setLoadingWeekly(false);
    }
    loadWeekly();
  }, [user?.uid]);

  const generateWeekly = async () => {
    setLoadingWeekly(true);
    try {
      const reply  = await sendMessage([{ role: "user", text: "Give me my weekly check-in." }], { ...user, _systemOverride: WEEKLY_PROMPT(user) });
      const data   = { content: reply, week: thisMonday(), generatedAt: Date.now() };
      setWeeklyData(data);
      if (user?.uid) await setDoc(doc(db, "users", user.uid, "weeklyCheckin", thisMonday()), data);
    } catch (e) {
      setWeeklyData({ content: "Jona couldn't connect this week — try again in a moment.", week: thisMonday(), generatedAt: Date.now() });
    }
    setLoadingWeekly(false);
  };

  const startSession = async (type) => {
    setSessionType(type);
    setMessages([]);
    setView("session");
    setLoading(true);
    try {
      const systemPrompt = COACH_PROMPTS[type.id](user);
      const reply = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system:   systemPrompt,
          messages: [{ role: "user", content: "Start the session." }],
          plan:     user?.plan ?? "individual",
        }),
      }).then((r) => r.json());
      setMessages([{ role: "assistant", text: reply.content }]);
    } catch {
      setMessages([{ role: "assistant", text: "I'm having trouble connecting. Try again in a moment." }]);
    }
    setLoading(false);
  };

  const send = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;
    const userMsg = { role: "user", text: trimmed };
    const next    = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system:   COACH_PROMPTS[sessionType.id](user),
          messages: next.map((m) => ({ role: m.role, content: m.text })),
          plan:     user?.plan ?? "individual",
        }),
      }).then((r) => r.json());
      setMessages([...next, { role: "assistant", text: reply.content }]);
    } catch {
      setMessages([...next, { role: "assistant", text: "Connection issue — try again." }]);
    }
    setLoading(false);
  };

  const startListening = () => {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SR) { alert("Speech recognition not supported in this browser."); return; }
    const r = new SR();
    r.lang = "en-US";
    r.onstart  = () => setListening(true);
    r.onend    = () => setListening(false);
    r.onerror  = () => setListening(false);
    r.onresult = (e) => send(e.results[0][0].transcript);
    r.start();
  };

  if (view === "session" && sessionType) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", animation: "fadeIn 0.3s ease" }}>
        {/* Session header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>←</button>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: `${sessionType.color}22`, border: `1px solid ${sessionType.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
            {sessionType.icon}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{sessionType.label}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>with Jona · session active</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.success, animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 11, color: COLORS.success }}>Live</span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 12, padding: 16, marginBottom: 14, minHeight: 300, maxHeight: 420 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%", padding: "10px 14px", borderRadius: 12,
                background: m.role === "user" ? `rgba(224,16,16,0.18)` : "#1a1a1a",
                border: `1px solid ${m.role === "user" ? "rgba(224,16,16,0.3)" : "#2a2a2a"}`,
                fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", animation: "fadeIn 0.2s ease",
              }}>
                {m.role === "assistant" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <img src="/assets/jona.png" alt="Jona" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />
                    <span style={{ fontSize: 10, color: COLORS.red, fontWeight: 700, letterSpacing: 1 }}>JONA</span>
                  </div>
                )}
                {m.text}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: "flex-start", padding: "10px 16px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12 }}>
                <span style={{ display: "inline-flex", gap: 4 }}>
                  {[0,1,2].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.red, animation: `blink 1.2s ${i*0.2}s ease-in-out infinite` }} />)}
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 25, padding: "4px 16px", gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Reply to Jona…"
              style={{ flex: 1, background: "none", border: "none", color: COLORS.text, fontSize: 13, padding: "8px 0" }}
            />
            <button onClick={() => send()} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 16 }}>➤</button>
          </div>
          <button
            onClick={startListening}
            style={{ width: 44, height: 44, borderRadius: "50%", background: listening ? "#ff2020" : COLORS.red, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: "0 0 14px rgba(224,16,16,0.4)", flexShrink: 0, animation: listening ? "pulse 1s ease-in-out infinite" : "none" }}
          >🎤</button>
        </div>

        <style>{`@keyframes blink{0%,80%,100%{opacity:0}40%{opacity:1}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}} @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    );
  }

  // ── HOME VIEW ───────────────────────────────────────────────────────────────
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const isMonday  = new Date().getDay() === 1;

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>

      {/* Weekly check-in card */}
      <div style={{ background: COLORS.card, border: `1px solid ${weeklyData ? "rgba(34,197,94,0.25)" : "#1e1e1e"}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <img src="/assets/jona.png" alt="Jona" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", filter: "drop-shadow(0 0 8px rgba(224,16,16,0.5))" }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Monday Check-In</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Jona reviews your week and sets your focus</div>
          </div>
          {weeklyData && <span style={{ marginLeft: "auto", fontSize: 10, color: COLORS.success, fontWeight: 700, border: "1px solid rgba(34,197,94,0.3)", padding: "3px 8px", borderRadius: 20 }}>THIS WEEK</span>}
        </div>

        {loadingWeekly ? (
          <div style={{ fontSize: 13, color: COLORS.textMuted, padding: "8px 0" }}>Loading…</div>
        ) : weeklyData ? (
          <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.8, whiteSpace: "pre-wrap", padding: "12px 14px", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10 }}>
            {weeklyData.content}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 12 }}>
              {isMonday ? `It's Monday, ${firstName}. Let Jona review your week and set your focus.` : `Your next check-in is this Monday. Come back then for your weekly briefing.`}
            </div>
            {isMonday && (
              <button
                onClick={generateWeekly}
                style={{ padding: "10px 20px", background: COLORS.red, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 0 14px rgba(224,16,16,0.3)" }}
              >
                Get This Week's Briefing →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Coaching sessions */}
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
        Coaching Sessions
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {SESSION_TYPES.map((type) => {
          const isSpeaking    = type.id === "speaking";
          const needsAllAccess = isSpeaking && user?.plan !== "all_access";
          return (
            <div
              key={type.id}
              onClick={() => !needsAllAccess && startSession(type)}
              style={{
                background: COLORS.card, border: `1px solid ${needsAllAccess ? "#1e1e1e" : `${type.color}33`}`,
                borderRadius: 12, padding: 16, cursor: needsAllAccess ? "default" : "pointer",
                opacity: needsAllAccess ? 0.55 : 1, transition: "all 0.2s", position: "relative",
              }}
              onMouseEnter={(e) => { if (!needsAllAccess) { e.currentTarget.style.borderColor = type.color; e.currentTarget.style.boxShadow = `0 0 16px ${type.color}22`; } }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = needsAllAccess ? "#1e1e1e" : `${type.color}33`; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{type.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: needsAllAccess ? COLORS.textMuted : COLORS.text }}>{type.label}</div>
              <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.5 }}>{type.desc}</div>
              {needsAllAccess && (
                <div style={{ position: "absolute", top: 10, right: 10, fontSize: 9, fontWeight: 700, color: COLORS.gold, border: `1px solid ${COLORS.gold}44`, padding: "2px 7px", borderRadius: 20 }}>
                  ALL ACCESS
                </div>
              )}
              {!needsAllAccess && (
                <div style={{ marginTop: 12, fontSize: 11, color: type.color, fontWeight: 600 }}>Start session →</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats strip */}
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        {[
          { label: "Day Streak",  value: user?.streak ?? 0,                        color: COLORS.red  },
          { label: "Total XP",    value: (user?.xpEarned ?? 0).toLocaleString(),   color: COLORS.gold },
          { label: "Confidence",  value: `${user?.confidenceScore ?? 0}%`,          color: "#4488ff"  },
          { label: "Lessons",     value: user?.lessonsCompleted ?? 0,              color: COLORS.success },
        ].map((s) => (
          <div key={s.label} style={{ flex: 1, background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
