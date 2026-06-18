import { useState, useEffect } from "react";
import { COLORS } from "../constants/colors";
import { APPS, APP_MAP } from "../constants/apps";
import { sendMessage } from "../lib/claude";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

// ── CEFR map — every app mapped to levels + skills ───────────────────────────
const CEFR_LEVELS = [
  { id: "A1", label: "A1", name: "Beginner",      color: "#4488ff", apps: ["phonics"],              skills: ["Alphabet", "Basic sounds", "Simple words"] },
  { id: "A2", label: "A2", name: "Elementary",    color: "#22c55e", apps: ["phonics", "wondercamp"], skills: ["Simple sentences", "Everyday vocabulary", "Basic listening"] },
  { id: "B1", label: "B1", name: "Pre-Intermediate", color: "#f59e0b", apps: ["speak", "eiken", "family"], skills: ["Conversational English", "Reading comprehension", "Eiken Pre-3 / 3"] },
  { id: "B2", label: "B2", name: "Intermediate",  color: "#e01010", apps: ["speak", "eiken", "sipswitch"], skills: ["Fluent conversation", "Debate & opinion", "Eiken Pre-2 / 2"] },
  { id: "C1", label: "C1", name: "Advanced",      color: "#7B5EA7", apps: ["sipswitch", "innerkey", "eiken"], skills: ["Near-native fluency", "Nuance & tone", "Eiken Pre-1"] },
  { id: "C2", label: "C2", name: "Mastery",       color: "#ff6b35", apps: ["innerkey", "sipswitch"],  skills: ["Full proficiency", "Mindset mastery", "Eiken 1"] },
];

// ── Daily mission pool — picked by rule, zero AI cost ────────────────────────
const MISSION_POOL = {
  phonics:    ["Practise 5 vowel sounds aloud", "Read one phonics story", "Record yourself reading 3 words"],
  eiken:      ["Answer 10 Eiken vocabulary questions", "Read one Eiken passage", "Write 3 sentences using new words"],
  speak:      ["Speak for 5 minutes on any topic", "Describe your day in English", "Shadow a 60-second audio clip"],
  wondercamp: ["Complete one Wondercamp adventure", "Write a short story about your day", "Play 1 vocabulary game"],
  family:     ["Do one English activity with a family member", "Teach a family member 5 new words"],
  sipswitch:  ["Have a 10-minute English conversation", "Switch to English for your next coffee break", "Summarise a podcast in English"],
  innerkey:   ["Write 5 lines in your English journal", "Read one self-improvement article in English", "Set one English goal for the week"],
};

function getDailyMissions(subscriptions = [], plan = "individual") {
  const available = subscriptions.length > 0 ? subscriptions : ["phonics"];
  const today     = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  // Deterministic seed from date so missions are consistent all day
  const seed      = today.split("-").reduce((a, b) => a + parseInt(b), 0);

  const missions = [];
  const apps     = [...available];
  for (let i = 0; i < 3; i++) {
    const appId  = apps[(seed + i) % apps.length];
    const pool   = MISSION_POOL[appId] ?? MISSION_POOL.phonics;
    const task   = pool[(seed + i * 3) % pool.length];
    missions.push({ appId, task, icon: APP_MAP[appId]?.image ?? null, appName: APP_MAP[appId]?.name ?? appId });
  }
  return missions;
}

// ── Onboarding questions for AI path generation ───────────────────────────────
const QUESTIONS = [
  { id: "level",   question: "What's your current English level?",          options: ["Complete beginner", "Can understand basics", "Can have simple conversations", "Fairly confident", "Advanced"] },
  { id: "goal",    question: "What's your main goal?",                      options: ["Help my child learn", "Pass Eiken exam", "Speak confidently at work", "Travel English", "Personal growth"] },
  { id: "time",    question: "How much time can you study each day?",       options: ["5–10 minutes", "15–20 minutes", "30 minutes", "1 hour+"] },
  { id: "style",   question: "How do you learn best?",                      options: ["Listening & speaking", "Reading & writing", "Games & activities", "All of the above"] },
];

export default function LearningPath({ user }) {
  const [tab, setTab]               = useState("path");       // path | cefr | missions
  const [pathData, setPathData]     = useState(null);
  const [loadingPath, setLoadingPath] = useState(true);
  const [onboarding, setOnboarding] = useState(false);
  const [answers, setAnswers]       = useState({});
  const [step, setStep]             = useState(0);
  const [generating, setGenerating] = useState(false);
  const [missions]                  = useState(() => getDailyMissions(user?.subscriptions, user?.plan));
  const [missionsDone, setMissionsDone] = useState([]);

  // Load saved path from Firestore
  useEffect(() => {
    async function load() {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "learningPath", "current"));
        if (snap.exists()) {
          setPathData(snap.data());
        } else {
          setOnboarding(true);
        }
      } catch { setOnboarding(true); }
      setLoadingPath(false);
    }
    load();
  }, [user?.uid]);

  const handleAnswer = (qId, value) => {
    const next = { ...answers, [qId]: value };
    setAnswers(next);
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      generatePath(next);
    }
  };

  const generatePath = async (finalAnswers) => {
    setGenerating(true);
    setOnboarding(false);
    try {
      // Gemini API via Netlify function — satisfies hackathon Google Cloud requirement
      const res = await fetch("/api/learning-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level:           finalAnswers.level,
          goal:            finalAnswers.goal,
          time:            finalAnswers.time,
          style:           finalAnswers.style,
          subscriptions:   user?.subscriptions ?? [],
          confidenceScore: user?.confidenceScore ?? 0,
          streak:          user?.streak ?? 0,
        }),
      });

      if (!res.ok) throw new Error("Gemini API error");
      const parsed = await res.json();
      const data   = { ...parsed, answers: finalAnswers, createdAt: Date.now() };
      setPathData(data);
      if (user?.uid) {
        await setDoc(doc(db, "users", user.uid, "learningPath", "current"), data);
      }
    } catch {
      // Fallback if Gemini fails
      const fallback = {
        cefr: "A2", cefrName: "Elementary",
        weeklyFocus: ["Build daily habit", "Core vocabulary", "Speaking practice", "Review & advance"],
        primaryApp: user?.subscriptions?.[0] ?? "phonics",
        secondaryApp: null,
        dailyPlan: {
          morning: "5-minute vocabulary review",
          main:    "20-minute focused study session",
          evening: "Listen to 5 minutes of English audio",
        },
        tip: "Consistency beats intensity — 10 minutes daily beats 2 hours on weekends.",
        milestone: "You'll be able to hold simple conversations with confidence.",
        encouragement: "Every expert was once a beginner. You've got this.",
        generatedBy: "fallback",
        answers: finalAnswers, createdAt: Date.now(),
      };
      setPathData(fallback);
      if (user?.uid) await setDoc(doc(db, "users", user.uid, "learningPath", "current"), fallback);
    }
    setGenerating(false);
  };

  const resetPath = () => { setAnswers({}); setStep(0); setOnboarding(true); setPathData(null); };

  if (loadingPath || generating) return <LoadingState generating={generating} />;
  if (onboarding) return <OnboardingFlow step={step} answers={answers} onAnswer={handleAnswer} />;

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "path",     label: "My Path"       },
          { id: "cefr",     label: "CEFR Roadmap"  },
          { id: "missions", label: "Daily Missions" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
            background: tab === t.id ? COLORS.red : "transparent",
            border: `1px solid ${tab === t.id ? COLORS.red : "#2a2a2a"}`,
            color: tab === t.id ? "#fff" : COLORS.textMuted, cursor: "pointer", transition: "all 0.2s",
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "path"     && <MyPath     pathData={pathData} user={user} onReset={resetPath} />}
      {tab === "cefr"     && <CEFRMap    user={user} pathData={pathData} />}
      {tab === "missions" && <DailyMissions missions={missions} done={missionsDone} setDone={setMissionsDone} />}
    </div>
  );
}

// ── MY PATH ───────────────────────────────────────────────────────────────────
function MyPath({ pathData, user, onReset }) {
  const level     = CEFR_LEVELS.find((l) => l.id === pathData?.cefr) ?? CEFR_LEVELS[1];
  const primaryApp = APP_MAP[pathData?.primaryApp];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header card */}
      <div style={{ background: COLORS.card, border: `1px solid ${level.color}33`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: `${level.color}22`, border: `2px solid ${level.color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: level.color }}>{level.id}</span>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Your Learning Path</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted }}>{level.name} level · {level.id}</div>
          </div>
          <button onClick={onReset} style={{ marginLeft: "auto", background: "none", border: "1px solid #2a2a2a", borderRadius: 6, color: COLORS.textDim, fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>
            Reset
          </button>
        </div>
        {pathData?.tip && (
          <div style={{ padding: "10px 14px", background: `${level.color}11`, border: `1px solid ${level.color}33`, borderRadius: 8, fontSize: 13, color: COLORS.textMuted, fontStyle: "italic" }}>
            "{pathData.tip}"
          </div>
        )}
      </div>

      {/* 4-week plan */}
      <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>4-Week Plan</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(pathData?.weeklyFocus ?? []).map((focus, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${level.color}22`, border: `1px solid ${level.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: level.color, flexShrink: 0 }}>
                {i + 1}
              </div>
              <div style={{ fontSize: 13, color: COLORS.text }}>Week {i + 1}: {focus}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily plan — new Gemini field */}
      {pathData?.dailyPlan && (
        <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Daily Study Plan</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "MORNING", text: pathData.dailyPlan.morning, color: "#f59e0b" },
              { label: "MAIN SESSION", text: pathData.dailyPlan.main, color: COLORS.red },
              { label: "EVENING", text: pathData.dailyPlan.evening, color: "#4488ff" },
            ].map(({ label, text, color }) => (
              <div key={label} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 14px", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: 1, minWidth: 80, paddingTop: 2 }}>{label}</div>
                <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5 }}>{text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Encouragement + Gemini badge */}
      {pathData?.encouragement && (
        <div style={{ padding: "12px 16px", background: "rgba(224,16,16,0.05)", border: "1px solid rgba(224,16,16,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 13, color: COLORS.textMuted, fontStyle: "italic", lineHeight: 1.5 }}>"{pathData.encouragement}"</div>
          {pathData?.generatedBy === "gemini" && (
            <div style={{ fontSize: 9, color: "#4285f4", letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0 }}>✦ Gemini AI</div>
          )}
        </div>
      )}

      {/* Milestone + primary app */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.gold, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>4-Week Goal</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6 }}>{pathData?.milestone}</div>
        </div>
        {primaryApp && (
          <div style={{ background: COLORS.card, border: `1px solid ${primaryApp.accent}33`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Start Here</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {primaryApp.image && <img src={primaryApp.image} alt={primaryApp.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{primaryApp.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{primaryApp.desc}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CEFR MAP ──────────────────────────────────────────────────────────────────
function CEFRMap({ user, pathData }) {
  const userLevel = pathData?.cefr ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 4 }}>
        Every app maps to a CEFR level. Here's where each one fits your journey.
      </div>
      {CEFR_LEVELS.map((level) => {
        const isUser    = level.id === userLevel;
        const levelApps = level.apps.map((id) => APP_MAP[id]).filter(Boolean);
        return (
          <div key={level.id} style={{
            background: isUser ? `${level.color}12` : COLORS.card,
            border: `1px solid ${isUser ? level.color : "#1e1e1e"}`,
            borderRadius: 12, padding: "14px 16px",
            transition: "all 0.2s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${level.color}22`, border: `1.5px solid ${level.color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: level.color }}>{level.id}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isUser ? level.color : COLORS.text }}>{level.name}</span>
                  {isUser && <span style={{ fontSize: 10, background: level.color, color: "#fff", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>YOUR LEVEL</span>}
                </div>
                <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>{level.skills.join(" · ")}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {levelApps.map((app) => {
                const unlocked = user?.subscriptions?.includes(app.id);
                return (
                  <div key={app.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: unlocked ? `${app.accent}15` : "#1a1a1a", border: `1px solid ${unlocked ? app.accent + "44" : "#2a2a2a"}` }}>
                    {app.image && <img src={app.image} alt={app.name} style={{ width: 16, height: 16, borderRadius: 4, objectFit: "cover" }} />}
                    <span style={{ fontSize: 11, color: unlocked ? COLORS.text : COLORS.textDim }}>{app.name.replace("™", "")}</span>
                    {!unlocked && <span style={{ fontSize: 9, color: COLORS.textDim }}>🔒</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── DAILY MISSIONS ────────────────────────────────────────────────────────────
function DailyMissions({ missions, done, setDone }) {
  const allDone = done.length === missions.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 13, color: COLORS.textMuted }}>Complete all 3 to earn bonus XP. Resets at midnight JST.</div>
        {allDone && <span style={{ fontSize: 11, color: COLORS.success, fontWeight: 700 }}>✓ All done!</span>}
      </div>
      {missions.map((m, i) => {
        const isDone = done.includes(i);
        return (
          <div key={i} onClick={() => setDone(isDone ? done.filter((d) => d !== i) : [...done, i])} style={{
            background: isDone ? "rgba(34,197,94,0.08)" : COLORS.card,
            border: `1px solid ${isDone ? "rgba(34,197,94,0.3)" : "#1e1e1e"}`,
            borderRadius: 12, padding: "14px 16px",
            cursor: "pointer", transition: "all 0.2s",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden", flexShrink: 0, filter: isDone ? "grayscale(0.5)" : "none" }}>
              {m.icon
                ? <img src={m.icon} alt={m.appName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", background: COLORS.red + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📚</div>
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 2 }}>{m.appName}</div>
              <div style={{ fontSize: 13, color: isDone ? COLORS.textMuted : COLORS.text, textDecoration: isDone ? "line-through" : "none" }}>{m.task}</div>
            </div>
            <div style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${isDone ? COLORS.success : "#2a2a2a"}`, background: isDone ? COLORS.success : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
              {isDone && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
            </div>
          </div>
        );
      })}
      <div style={{ padding: "12px 16px", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: COLORS.textMuted }}>Daily XP reward</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.gold }}>+{done.length * 25} / 75 XP</span>
      </div>
    </div>
  );
}

// ── ONBOARDING ────────────────────────────────────────────────────────────────
function OnboardingFlow({ step, answers, onAnswer }) {
  const q = QUESTIONS[step];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", animation: "fadeIn 0.3s ease" }}>
      <img src="/assets/jarvis.png" alt="Jarvis" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", marginBottom: 16, filter: "drop-shadow(0 0 12px rgba(224,16,16,0.6))" }} />
      <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 2, marginBottom: 12 }}>JARVIS · LEARNING ASSESSMENT</div>
      <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 6, textAlign: "center" }}>Question {step + 1} of {QUESTIONS.length}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, textAlign: "center", maxWidth: 420, lineHeight: 1.4 }}>{q.question}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 380 }}>
        {q.options.map((opt) => (
          <button key={opt} onClick={() => onAnswer(q.id, opt)} style={{
            padding: "13px 18px", background: "#111", border: "1px solid #2a2a2a",
            borderRadius: 10, color: COLORS.text, fontSize: 14, cursor: "pointer",
            textAlign: "left", transition: "all 0.15s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.red; e.currentTarget.style.background = "rgba(224,16,16,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.background = "#111"; }}
          >
            {opt}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
        {QUESTIONS.map((_, i) => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i <= step ? COLORS.red : "#2a2a2a", transition: "all 0.3s" }} />
        ))}
      </div>
    </div>
  );
}

function LoadingState({ generating }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 16 }}>
      <img src="/assets/jarvis.png" alt="Jarvis" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", animation: "pulse 2s ease-in-out infinite", filter: "drop-shadow(0 0 16px rgba(224,16,16,0.7))" }} />
      <div style={{ fontSize: 14, color: COLORS.textMuted }}>{generating ? "Jarvis is building your personal learning path…" : "Loading your path…"}</div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }`}</style>
    </div>
  );
}
