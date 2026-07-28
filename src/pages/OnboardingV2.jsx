import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { COLORS } from "../constants/colors";

// ── Data ───────────────────────────────────────────────────────────────────

const ROLES = [
  { id: "student",      en: "Student",            jp: "学生",       icon: "📚" },
  { id: "university",   en: "University",          jp: "大学生",     icon: "🎓" },
  { id: "professional", en: "Professional",        jp: "社会人",     icon: "💼" },
  { id: "parent",       en: "Parent",              jp: "保護者",     icon: "👨‍👩‍👧" },
  { id: "traveler",     en: "Traveler",            jp: "旅行者",     icon: "✈️" },
  { id: "other",        en: "Other",               jp: "その他",     icon: "🌟" },
];

const GOALS = [
  { id: "speak",         en: "Speak Confidently", jp: "自信を持って話す", icon: "💬" },
  { id: "eiken",         en: "Pass EIKEN",        jp: "英検合格",         icon: "🐒" },
  { id: "travel",        en: "Travel",            jp: "旅行英語",         icon: "✈️" },
  { id: "abroad",        en: "Study Abroad",      jp: "留学",             icon: "🌍" },
  { id: "career",        en: "Career",            jp: "キャリア",         icon: "💼" },
  { id: "business",      en: "Business",          jp: "ビジネス",         icon: "📊" },
  { id: "presentations", en: "Presentations",     jp: "プレゼン",         icon: "🎤" },
  { id: "conversation",  en: "Conversation",      jp: "日常会話",         icon: "🗣️" },
  { id: "other",         en: "Other",             jp: "その他",           icon: "⭐" },
];

const CONFIDENCE_LEVELS = [
  { score: 10, en: "Very Nervous",   jp: "かなり緊張する",   emoji: "😰" },
  { score: 30, en: "Nervous",        jp: "緊張する",         emoji: "😬" },
  { score: 50, en: "Comfortable",    jp: "まあまあ",         emoji: "😊" },
  { score: 70, en: "Confident",      jp: "自信がある",       emoji: "😎" },
  { score: 90, en: "Very Confident", jp: "とても自信がある", emoji: "🔥" },
];

const COMMITMENT = [
  { mins: 5,    en: "5 Minutes",  jp: "5分",          desc_en: "Quick daily habit",  desc_jp: "短い毎日の習慣" },
  { mins: 10,   en: "10 Minutes", jp: "10分",         desc_en: "Steady progress",    desc_jp: "着実な進歩" },
  { mins: 15,   en: "15 Minutes", jp: "15分",         desc_en: "Recommended",        desc_jp: "おすすめ", badge: true },
  { mins: 20,   en: "20 Minutes", jp: "20分",         desc_en: "Faster growth",      desc_jp: "より速い成長" },
  { mins: null, en: "Flexible",   jp: "フレキシブル", desc_en: "When I have time",   desc_jp: "時間がある時に" },
];

const LEARN_TIMES = [
  { id: "morning",   en: "Morning",    jp: "朝",         icon: "🌅", hint: "6am – 12pm"  },
  { id: "afternoon", en: "Afternoon",  jp: "午後",       icon: "☀️", hint: "12pm – 6pm"  },
  { id: "evening",   en: "Evening",    jp: "夜",         icon: "🌙", hint: "6pm – 10pm"  },
  { id: "ai",        en: "AI decides", jp: "AIに任せる", icon: "🤖", hint: "Jona picks best time" },
];

const GOAL_APP_MAP = {
  speak: "speak", eiken: "eiken", travel: "sipswitch",
  abroad: "speak", career: "career-ready", business: "sipswitch",
  presentations: "speak-ready", conversation: "speak", other: "speak",
};

const FIRST_WIN_PHRASES = {
  speak:         ["Hello, my name is ___. Nice to meet you.", "I've been learning English and I'm getting better.", "I feel more confident speaking every day."],
  eiken:         ["Could you please repeat that?", "In my opinion, studying English is very important.", "I think the answer is..."],
  travel:        ["Excuse me, where is the nearest station?", "I'd like to order this, please.", "How much does this cost?"],
  abroad:        ["I'm looking forward to studying abroad.", "Could you explain that again, please?", "I'd love to make friends from around the world."],
  career:        ["Thank you for this opportunity.", "I'd like to discuss the project timeline.", "Could we schedule a meeting this week?"],
  business:      ["Let's move on to the next agenda item.", "I'd like to propose a new approach.", "Please send me the report by Friday."],
  presentations: ["Good morning, everyone. My name is ___.", "Today I'll be talking about three key points.", "Are there any questions?"],
  conversation:  ["How was your weekend?", "That's really interesting — tell me more.", "I'm not sure, but I think..."],
  other:         ["Nice to meet you!", "I'm working on my English every day.", "Every day I'm getting a little better."],
};

const STEP_TITLES = {
  1: { en: "Tell me a little about yourself.",                          jp: "あなたのことを教えてください。" },
  2: { en: "What's your English goal?",                                 jp: "英語で何を達成したいですか？" },
  3: { en: "How confident do you feel speaking English right now?",     jp: "今、英語を話す自信はどのくらいありますか？" },
  4: { en: "How much time can you give each day?",                      jp: "毎日どのくらいの時間を使えますか？" },
  5: { en: "When do you prefer to learn?",                              jp: "いつ学習するのが好きですか？" },
  6: { en: "Let's start with a quick win.",                             jp: "まず、小さな成功体験をしましょう。" },
};

// ── Sub-components ─────────────────────────────────────────────────────────

function GridBg() {
  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none",
      backgroundImage: "linear-gradient(rgba(224,16,16,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(224,16,16,0.03) 1px,transparent 1px)",
      backgroundSize: "40px 40px",
    }} />
  );
}

function LangToggle({ lang, setLang }) {
  return (
    <div style={{ position: "fixed", top: 18, right: 18, zIndex: 20, display: "flex", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, overflow: "hidden" }}>
      {["en", "jp"].map(l => (
        <button key={l} onClick={() => setLang(l)} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, background: lang === l ? COLORS.red : "transparent", border: "none", color: lang === l ? "#fff" : COLORS.textMuted, cursor: "pointer" }}>
          {l === "en" ? "EN" : "日本語"}
        </button>
      ))}
    </div>
  );
}

function JonaOrb() {
  return (
    <div style={{ position: "relative", width: 130, height: 130 }}>
      {[0, 1].map(i => (
        <div key={i} style={{
          position: "absolute", inset: `${i * 10}px`, borderRadius: "50%",
          border: `1px solid rgba(224,16,16,${0.15 - i * 0.05})`,
          animation: `ob2spin ${12 + i * 6}s linear infinite ${i % 2 ? "reverse" : ""}`,
        }} />
      ))}
      <div style={{
        position: "absolute", inset: 18, borderRadius: "50%",
        border: "2px solid #e01010",
        animation: "ob2pulse 2.5s ease-in-out infinite",
        boxShadow: "0 0 24px rgba(224,16,16,0.4)",
      }} />
      <div style={{ position: "absolute", inset: 30, borderRadius: "50%", overflow: "hidden" }}>
        <img src="/assets/jona.png" alt="Jona" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    </div>
  );
}

function SmallJona() {
  return (
    <div style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(224,16,16,0.55)", boxShadow: "0 0 14px rgba(224,16,16,0.3)", flexShrink: 0 }}>
      <img src="/assets/jona.png" alt="Jona" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

function ProgressDots({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          height: 5, borderRadius: 3,
          width: i === current ? 20 : 6,
          background: i <= current ? COLORS.red : "#2a2a2a",
          transition: "all 0.3s",
        }} />
      ))}
    </div>
  );
}

function FadeLine({ visible, children, style = {} }) {
  return (
    <div style={{
      marginBottom: 14,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(10px)",
      transition: "opacity 0.65s ease, transform 0.65s ease",
      ...style,
    }}>
      {children}
    </div>
  );
}

function ChoiceCard({ selected, onClick, icon, label, compact = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: compact ? "14px 8px" : "20px 12px",
        background: selected ? "rgba(224,16,16,0.1)" : COLORS.card,
        border: `1px solid ${selected ? COLORS.red : "#2a2a2a"}`,
        borderRadius: 14, cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        textAlign: "center", transition: "all 0.15s",
        boxShadow: selected ? "0 0 16px rgba(224,16,16,0.12)" : "none",
      }}
    >
      <span style={{ fontSize: compact ? 22 : 28 }}>{icon}</span>
      <span style={{ fontSize: compact ? 11 : 13, fontWeight: 600, color: selected ? COLORS.red : COLORS.text, lineHeight: 1.3 }}>
        {label}
      </span>
    </button>
  );
}

function RadioRow({ selected, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "15px 18px",
        background: selected ? "rgba(224,16,16,0.1)" : COLORS.card,
        border: `1px solid ${selected ? COLORS.red : "#2a2a2a"}`,
        borderRadius: 14, cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.15s",
      }}
    >
      {children}
      <div style={{ marginLeft: "auto", width: 20, height: 20, borderRadius: "50%", border: `2px solid ${selected ? COLORS.red : "#333"}`, background: selected ? COLORS.red : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {selected && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
      </div>
    </button>
  );
}

function Particles({ active }) {
  if (!active) return null;
  const ps = Array.from({ length: 28 }, (_, i) => ({
    angle: (i / 28) * 360,
    dist: 60 + Math.random() * 90,
    size: 3 + Math.random() * 4,
    dur: 0.5 + Math.random() * 0.5,
    color: i % 3 === 0 ? "#e01010" : i % 3 === 1 ? "#C9A84C" : "#22c55e",
  }));
  return (
    <div style={{ position: "fixed", top: "50%", left: "50%", pointerEvents: "none", zIndex: 9999 }}>
      {ps.map((p, i) => (
        <div key={i} style={{
          position: "absolute", width: p.size, height: p.size, borderRadius: "50%",
          background: p.color, boxShadow: `0 0 6px ${p.color}`,
          animation: `ob2p${i} ${p.dur}s ease-out forwards`,
        }} />
      ))}
      <style>{ps.map((p, i) => {
        const r = (p.angle * Math.PI) / 180;
        return `@keyframes ob2p${i}{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(calc(-50% + ${Math.cos(r) * p.dist}px),calc(-50% + ${Math.sin(r) * p.dist}px)) scale(0);opacity:0}}`;
      }).join("")}</style>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function OnboardingV2() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [lang, setLang]           = useState("en");
  const [step, setStep]           = useState(0);
  const [welcomePhase, setWelcomePhase] = useState(0);

  // Selections
  const [role,       setRole]       = useState(null);
  const [goal,       setGoal]       = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [commitment, setCommitment] = useState(15);
  const [learnTime,  setLearnTime]  = useState(null);

  // First Win
  const [phrasesDone, setPhrasesDone] = useState([false, false, false]);
  const [celebrate,   setCelebrate]   = useState(false);
  const [finished,    setFinished]    = useState(false);
  const [saving,      setSaving]      = useState(false);

  const jp        = lang === "jp";
  const firstName = user?.name?.split(" ")[0] ?? "there";

  // Redirect if already onboarded
  useEffect(() => {
    if (user && (user.setupDone || user.assessmentDone)) {
      navigate("/dashboard", { replace: true });
    }
  }, [user?.setupDone, user?.assessmentDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Welcome animation sequence
  useEffect(() => {
    if (step !== 0) return;
    const ts = [
      setTimeout(() => setWelcomePhase(1), 400),
      setTimeout(() => setWelcomePhase(2), 1600),
      setTimeout(() => setWelcomePhase(3), 2900),
      setTimeout(() => setWelcomePhase(4), 4400),
    ];
    return () => ts.forEach(clearTimeout);
  }, [step]);

  // First Win: watch for completion
  useEffect(() => {
    if (phrasesDone.every(Boolean) && !celebrate && step === 6) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 900);
      setTimeout(() => setFinished(true), 700);
    }
  }, [phrasesDone, step]); // eslint-disable-line react-hooks/exhaustive-deps

  function markPhrase(i) {
    setPhrasesDone(prev => { const n = [...prev]; n[i] = true; return n; });
  }

  function next()  { setStep(s => s + 1); }
  function back()  { setStep(s => s - 1); }

  async function finish() {
    if (saving || !user?.uid) return;
    setSaving(true);
    try {
      const goalId     = goal ?? "speak";
      const primaryApp = GOAL_APP_MAP[goalId] ?? "speak";
      await setDoc(doc(db, "users", user.uid), {
        setupDone:     true,
        assessmentDone: true,
        accountType:   role === "parent" ? "family" : "individual",
        role:          role       ?? "other",
        goal:          goalId,
        dailyMinutes:  commitment ?? 15,
        preferredTime: learnTime  ?? "ai",
        confidenceScore: confidence ?? 50,
      }, { merge: true });
      await setDoc(doc(db, "users", user.uid, "learningPath", "current"), {
        primaryApp,
        goal:      goalId,
        seededAt:  new Date().toISOString(),
      });
      navigate("/dashboard", { replace: true, state: { assessmentJustDone: true } });
    } catch {
      setSaving(false);
    }
  }

  const phrases    = FIRST_WIN_PHRASES[goal ?? "speak"];
  const canContinue = { 1: !!role, 2: !!goal, 4: true, 5: !!learnTime };

  // ── STEP 0: WELCOME ──────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div style={PAGE}>
        <GridBg />
        <LangToggle lang={lang} setLang={setLang} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "32px 24px", textAlign: "center" }}>

          <div style={{ marginBottom: 36, opacity: welcomePhase >= 1 ? 1 : 0, transform: welcomePhase >= 1 ? "scale(1)" : "scale(0.4)", transition: "opacity 0.9s ease, transform 0.9s cubic-bezier(0.16,1,0.3,1)" }}>
            <JonaOrb />
          </div>

          <div style={{ maxWidth: 420 }}>
            <FadeLine visible={welcomePhase >= 1}>
              <span style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>
                {jp ? "HSD OSへようこそ。" : "Welcome to HSD OS."}
              </span>
            </FadeLine>
            <FadeLine visible={welcomePhase >= 2}>
              <span style={{ fontSize: 20, fontWeight: 700, color: COLORS.red }}>
                {jp ? "私はJonaです。" : "I'm Jona."}
              </span>
            </FadeLine>
            <FadeLine visible={welcomePhase >= 3}>
              <span style={{ fontSize: 15, color: "#888", lineHeight: 1.75 }}>
                {jp
                  ? "あなたがより自信を持って話せるようになるお手伝いをします。"
                  : "I'll help you become a more confident communicator."}
              </span>
            </FadeLine>
          </div>

          {welcomePhase >= 4 && (
            <div style={{ marginTop: 44, animation: "ob2fadeup 0.6s ease forwards" }}>
              <button
                onClick={next}
                style={{ padding: "15px 52px", background: COLORS.red, border: "none", borderRadius: 40, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 0 40px rgba(224,16,16,0.4)", letterSpacing: 0.3 }}
              >
                {jp ? "始めましょう →" : "Let's begin →"}
              </button>
              <div style={{ marginTop: 14 }}>
                <button onClick={finish} style={{ background: "none", border: "none", color: "#3a3a3a", fontSize: 12, cursor: "pointer", letterSpacing: 1 }}>
                  {jp ? "スキップ" : "Skip setup"}
                </button>
              </div>
            </div>
          )}
        </div>
        <Keyframes />
      </div>
    );
  }

  // ── STEPS 1–6 ─────────────────────────────────────────────────────────────
  return (
    <div style={PAGE}>
      <GridBg />
      <LangToggle lang={lang} setLang={setLang} />

      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", padding: "20px 20px 36px", maxWidth: 560, margin: "0 auto", width: "100%" }}>

        {/* Jona header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 24, marginTop: 52 }}>
          <SmallJona />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: COLORS.red, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>JONA</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, lineHeight: 1.5 }}>
              {jp ? STEP_TITLES[step]?.jp : STEP_TITLES[step]?.en}
            </div>
          </div>
        </div>

        {/* Progress dots */}
        <div style={{ marginBottom: 24 }}>
          <ProgressDots current={step - 1} total={6} />
        </div>

        {/* Content — key forces re-mount so new step animates in */}
        <div style={{ flex: 1, animation: "ob2fadeup 0.35s ease forwards" }} key={step}>

          {/* STEP 1: Who are you */}
          {step === 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {ROLES.map(r => (
                <ChoiceCard key={r.id} selected={role === r.id} onClick={() => setRole(r.id)} icon={r.icon} label={jp ? r.jp : r.en} />
              ))}
            </div>
          )}

          {/* STEP 2: Goal */}
          {step === 2 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {GOALS.map(g => (
                <ChoiceCard key={g.id} selected={goal === g.id} onClick={() => setGoal(g.id)} icon={g.icon} label={jp ? g.jp : g.en} compact />
              ))}
            </div>
          )}

          {/* STEP 3: Confidence — tapping auto-advances */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {CONFIDENCE_LEVELS.map(c => (
                <RadioRow key={c.score} selected={confidence === c.score} onClick={() => { setConfidence(c.score); setTimeout(next, 260); }}>
                  <span style={{ fontSize: 26, flexShrink: 0 }}>{c.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: confidence === c.score ? COLORS.red : COLORS.text }}>
                    {jp ? c.jp : c.en}
                  </span>
                </RadioRow>
              ))}
            </div>
          )}

          {/* STEP 4: Commitment */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {COMMITMENT.map(c => (
                <RadioRow key={String(c.mins)} selected={commitment === c.mins} onClick={() => setCommitment(c.mins)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: commitment === c.mins ? COLORS.red : COLORS.text }}>
                        {jp ? c.jp : c.en}
                      </span>
                      {c.badge && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 4, padding: "2px 7px" }}>
                          {jp ? "おすすめ" : "Recommended"}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{jp ? c.desc_jp : c.desc_en}</div>
                  </div>
                </RadioRow>
              ))}
            </div>
          )}

          {/* STEP 5: Learning time */}
          {step === 5 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {LEARN_TIMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setLearnTime(t.id)}
                  style={{
                    padding: "24px 12px",
                    background: learnTime === t.id ? "rgba(224,16,16,0.1)" : COLORS.card,
                    border: `1px solid ${learnTime === t.id ? COLORS.red : "#2a2a2a"}`,
                    borderRadius: 16, cursor: "pointer", textAlign: "center", transition: "all 0.15s",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                    boxShadow: learnTime === t.id ? "0 0 16px rgba(224,16,16,0.12)" : "none",
                  }}
                >
                  <span style={{ fontSize: 28 }}>{t.icon}</span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: learnTime === t.id ? COLORS.red : COLORS.text }}>{jp ? t.jp : t.en}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted }}>{t.hint}</div>
                </button>
              ))}
            </div>
          )}

          {/* STEP 6: First Win */}
          {step === 6 && !finished && (
            <div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.65, marginBottom: 20 }}>
                {jp
                  ? "各フレーズを声に出して読んでから「言えた！」をタップしてください。"
                  : "Read each phrase aloud, then tap \"I said it!\""}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {phrases.map((phrase, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "18px 20px",
                      background: phrasesDone[i] ? "rgba(34,197,94,0.07)" : COLORS.card,
                      border: `1px solid ${phrasesDone[i] ? "rgba(34,197,94,0.3)" : "#2a2a2a"}`,
                      borderRadius: 14, transition: "all 0.3s",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: phrasesDone[i] ? "#22c55e" : COLORS.text, lineHeight: 1.55, marginBottom: 14 }}>
                      "{phrase}"
                    </div>
                    <button
                      onClick={() => markPhrase(i)}
                      disabled={phrasesDone[i]}
                      style={{
                        padding: "8px 18px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                        cursor: phrasesDone[i] ? "default" : "pointer",
                        background: phrasesDone[i] ? "rgba(34,197,94,0.12)" : "rgba(224,16,16,0.08)",
                        border: `1px solid ${phrasesDone[i] ? "rgba(34,197,94,0.4)" : "rgba(224,16,16,0.25)"}`,
                        color: phrasesDone[i] ? "#22c55e" : COLORS.red,
                        transition: "all 0.2s",
                      }}
                    >
                      {phrasesDone[i] ? (jp ? "✓ 完了！" : "✓ Done!") : (jp ? "言えた！✓" : "I said it! ✓")}
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "center", fontSize: 12, color: COLORS.textDim }}>
                {phrasesDone.filter(Boolean).length} / 3 {jp ? "完了" : "complete"}
              </div>
            </div>
          )}

          {/* STEP 6: First Win — celebration */}
          {step === 6 && finished && (
            <div style={{ textAlign: "center", animation: "ob2fadeup 0.5s ease forwards", paddingTop: 20 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 10 }}>
                {jp ? "最初の一歩、踏み出しました！" : "First win. Well done."}
              </div>
              <div style={{ fontSize: 14, color: "#888", lineHeight: 1.75, marginBottom: 36, maxWidth: 340, margin: "0 auto 36px" }}>
                {jp
                  ? `${firstName}さん、英語への第一歩を踏み出しました。自信は積み重ねで生まれます。ここからが本当の旅の始まりです。`
                  : `${firstName}, every confident speaker started exactly here. You just took your first step.`}
              </div>
              <button
                onClick={finish}
                disabled={saving}
                style={{ padding: "16px 44px", background: saving ? "#333" : COLORS.red, border: "none", borderRadius: 40, color: "#fff", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 0 30px rgba(224,16,16,0.4)" }}
              >
                {saving ? (jp ? "設定中…" : "Setting up…") : (jp ? "ダッシュボードへ →" : "Go to my dashboard →")}
              </button>
            </div>
          )}
        </div>

        {/* Footer nav — hidden on steps that self-advance (3) or have their own CTA (6) */}
        {step !== 3 && step !== 6 && (
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button
              onClick={back}
              style={{ padding: "13px 20px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 10, color: COLORS.textMuted, fontSize: 14, cursor: "pointer" }}
            >
              ← {jp ? "戻る" : "Back"}
            </button>
            <button
              onClick={next}
              disabled={!canContinue[step]}
              style={{
                flex: 1, padding: "13px 20px",
                background: canContinue[step] ? COLORS.red : "#1a1a1a",
                border: "none", borderRadius: 10,
                color: canContinue[step] ? "#fff" : COLORS.textDim,
                fontSize: 14, fontWeight: 700,
                cursor: canContinue[step] ? "pointer" : "not-allowed",
                transition: "all 0.15s",
                boxShadow: canContinue[step] ? "0 4px 20px rgba(224,16,16,0.28)" : "none",
              }}
            >
              {jp ? "次へ →" : "Continue →"}
            </button>
          </div>
        )}
      </div>

      <Particles active={celebrate} />
      <Keyframes />
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const PAGE = {
  minHeight: "100vh",
  background: COLORS.bg,
  color: COLORS.text,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  position: "relative",
  overflowX: "hidden",
};

function Keyframes() {
  return (
    <style>{`
      @keyframes ob2fadeup  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      @keyframes ob2pulse   { 0%,100%{box-shadow:0 0 20px rgba(224,16,16,0.3)} 50%{box-shadow:0 0 50px rgba(224,16,16,0.7)} }
      @keyframes ob2spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    `}</style>
  );
}
