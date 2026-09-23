import { useState, useEffect, useRef, useCallback } from "react";
import GlobalJonaAssistant, { openGlobalJona } from "../jona/GlobalJonaAssistant";
import { LEVELS, MODULES, LISTENING_BANK, READING_BANK, SPEAKING_BANK, WRITING_BANK, VOCABULARY_BANK, GRAMMAR_BANK, CEFR_TO_EIKEN, ACHIEVEMENTS, MOCK_TESTS } from "../eiken/data";
import { MONKEY_IMAGES, MONKEYS } from "../eiken/companions";
import { speakElevenLabs, stopSpeaking, askJonathan } from "../eiken/jonathan";
import { getEikenLocalState, saveEikenLocalState, initEikenProgress, logPlacementResult, logMockAttempt, logAchievementUnlock, logMonkeyPartySession, nextMonkeyPartyStreak } from "../eiken/storage";
import { createPlacementSession, submitPlacementAnswer, summarizePlacement, recommendGrade } from "../eiken/placementEngine";
import { missionTheme } from "../eiken/missionThemes";
import { buildEvaluationSystemPrompt, fallbackFeedback } from "../eiken/feedback";
import { GAME_MODES, TOPICS, SESSION_LENGTHS, WOULD_YOU_RATHER, CATEGORY_RUSH_BY_TIER, categoryTierForLevel, CHALLENGES, BEAT_THE_MONKEY, MONKEY_PARTY_BADGES } from "../eiken/monkeyParty/data";
import { buildQuickMixSequence, clampStars, summarizeSession, resultTierForCount, addCandidateAnswer, sessionBadgeDeltas, computeMonkeyPartyBadgeUnlocks } from "../eiken/monkeyParty/gameEngine";
import { buildMonkeyPartyPrompt } from "../eiken/monkeyParty/monkeyPartyPrompt";
import TalkingMonkey from "../eiken/monkeyParty/TalkingMonkey";


// ─── GLOBAL STYLES ──────────────────────────────────────────────────────────
const injectStyles = () => {
  if (typeof document === "undefined" || document.getElementById("eiken-styles")) return;
  const s = document.createElement("style");
  s.id = "eiken-styles";
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    .eiken-root { font-family: 'Nunito', sans-serif; }
    ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
    @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
    @keyframes pulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
    @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
    @keyframes starPop { 0%{transform:scale(0) rotate(-30deg);opacity:0} 60%{transform:scale(1.3) rotate(10deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
    @keyframes wiggle { 0%,100%{transform:rotate(0deg)} 25%{transform:rotate(-4deg)} 75%{transform:rotate(4deg)} }
    @keyframes glow { 0%,100%{filter:drop-shadow(0 0 8px currentColor)} 50%{filter:drop-shadow(0 0 20px currentColor)} }
    .float { animation: float 3s ease-in-out infinite; }
    .slide-up { animation: slideUp 0.4s ease forwards; }
    .fade-in { animation: fadeIn 0.3s ease forwards; }
    .wiggle { animation: wiggle 0.5s ease-in-out; }
    textarea:focus, input:focus { outline: none; }
    textarea::placeholder, input::placeholder { color: rgba(255,255,255,0.3); }
  `;
  document.head.appendChild(s);
};
injectStyles();








// ─── MONKEY IMAGE COMPONENT ──────────────────────────────────────────────────
function MonkeyImg({ monkey, size = 120, floating = false, wiggling = false, style = {} }) {
  const m = MONKEYS[monkey];
  return (
    <div style={{
      width: size, height: size, position: "relative", display: "inline-block",
      animation: floating ? "float 3s ease-in-out infinite" : wiggling ? "wiggle 0.5s ease-in-out" : "none",
      filter: `drop-shadow(0 8px 24px ${m.glow})`,
      ...style
    }}>
      <img src={MONKEY_IMAGES[monkey]} alt={m.name}
        style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center bottom" }} />
    </div>
  );
}

// ─── STAR RATING ─────────────────────────────────────────────────────────────
function StarRating({ score, max = 5 }) {
  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{
          fontSize: 22, color: i < score ? "#FFD700" : "rgba(255,255,255,0.2)",
          animation: i < score ? `starPop 0.4s ease ${i * 0.1}s both` : "none",
          display: "inline-block", filter: i < score ? "drop-shadow(0 0 6px #FFD70080)" : "none"
        }}>★</span>
      ))}
    </div>
  );
}

// ─── XP BAR ──────────────────────────────────────────────────────────────────
function XPBar({ xp, maxXp = 200, color }) {
  const pct = Math.min((xp / maxXp) * 100, 100);
  return (
    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 99, height: 10, overflow: "hidden", width: "100%" }}>
      <div style={{
        height: "100%", width: `${pct}%`, borderRadius: 99,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        transition: "width 1.2s cubic-bezier(.34,1.56,.64,1)",
        boxShadow: `0 0 10px ${color}80`
      }} />
    </div>
  );
}

// ─── MONKEY SELECTOR CARD ─────────────────────────────────────────────────────
function MonkeyCard({ id, selected, onSelect }) {
  const m = MONKEYS[id];
  return (
    <button onClick={() => onSelect(id)} style={{
      background: selected ? `linear-gradient(160deg, ${m.color}28, ${m.color}10)` : "rgba(255,255,255,0.04)",
      border: `2px solid ${selected ? m.color : "rgba(255,255,255,0.08)"}`,
      borderRadius: 22, padding: "14px 10px 12px", cursor: "pointer", color: "#fff",
      transition: "all 0.3s cubic-bezier(.34,1.56,.64,1)", width: "100%",
      boxShadow: selected ? `0 0 28px ${m.color}50, inset 0 0 20px ${m.color}08` : "none",
      transform: selected ? "scale(1.04) translateY(-2px)" : "scale(1)",
    }}>
      <MonkeyImg monkey={id} size={80} floating={selected} />
      <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 16, marginTop: 4, color: selected ? m.color : "#fff" }}>{m.name}</div>
      <div style={{ fontSize: 10, opacity: 0.55, marginTop: 1 }}>{m.role}</div>
      <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 7, flexWrap: "wrap" }}>
        {m.traits.map(t => (
          <span key={t} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 99, background: `${m.color}25`, color: m.color, fontWeight: 800 }}>{t}</span>
        ))}
      </div>
    </button>
  );
}

// ─── SCREEN: ONBOARDING ──────────────────────────────────────────────────────
function OnboardingScreen({ onComplete }) {
  const [step, setStep]   = useState(0);
  const [coach, setCoach] = useState("milo");
  const [level, setLevel] = useState("Pre-2");
  const m = MONKEYS[coach];

  if (step === 0) return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",padding:32,textAlign:"center" }} className="slide-up">
      {/* Hero monkeys row */}
      <div style={{ display:"flex", justifyContent:"center", gap:-10, marginBottom:4, position:"relative" }}>
        {["momo","kiko","lola","milo"].map((id,i) => (
          <div key={id} style={{ marginLeft: i > 0 ? -20 : 0, zIndex: i, animation: `float ${2.5 + i*0.3}s ease-in-out infinite`, animationDelay:`${i*0.2}s` }}>
            <MonkeyImg monkey={id} size={72} style={{ filter: `drop-shadow(0 6px 16px ${MONKEYS[id].glow})` }} />
          </div>
        ))}
      </div>
      <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:44, lineHeight:1.05, marginBottom:8 }}>
        <span style={{ color:"#FFD700" }}>HEAR</span>{" "}
        <span style={{ color:"#FF6B9D" }}>SEE</span>{" "}
        <span style={{ color:"#4CAF7D" }}>DO</span>
      </div>
      <div style={{ fontSize:14, opacity:0.65, marginBottom:6, letterSpacing:3, fontWeight:700 }}>EIKEN AI COACH</div>
      <div style={{ fontSize:13, opacity:0.5, maxWidth:270, lineHeight:1.7, marginBottom:40 }}>
        Learn English with your own monkey coach. Practice listening, reading, speaking &amp; writing — the fun way!
      </div>
      <button onClick={() => setStep(1)} style={{
        background:"linear-gradient(135deg, #FFD700, #F5A623)", color:"#1a1000",
        border:"none", borderRadius:99, padding:"14px 44px", fontSize:17, fontWeight:900,
        cursor:"pointer", fontFamily:"'Nunito',sans-serif", boxShadow:"0 8px 28px #F5A62350",
        letterSpacing:0.5
      }}>Let's Start! 🚀</button>
    </div>
  );

  if (step === 1) return (
    <div style={{ padding:"22px 18px", overflowY:"auto", height:"100%" }} className="slide-up">
      <div style={{ textAlign:"center", marginBottom:20 }}>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:26, color:"#FFD700" }}>Choose Your Coach</div>
        <div style={{ fontSize:12, opacity:0.55, marginTop:4 }}>Your monkey guide for the journey</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
        {Object.keys(MONKEYS).map(id => <MonkeyCard key={id} id={id} selected={coach===id} onSelect={setCoach} />)}
      </div>
      {/* Speech bubble */}
      <div style={{
        background:`linear-gradient(135deg,${m.color}18,${m.color}08)`,
        border:`1px solid ${m.color}35`, borderRadius:18, padding:"14px 16px",
        marginBottom:20, textAlign:"center", position:"relative"
      }}>
        <div style={{ fontSize:11, color:m.color, fontWeight:800, marginBottom:5 }}>{m.name} says:</div>
        <div style={{ fontSize:13, fontWeight:700, lineHeight:1.5, fontStyle:"italic" }}>"{m.phrases[0]}"</div>
      </div>
      <button onClick={() => setStep(2)} style={{
        width:"100%", background:`linear-gradient(135deg,${m.color},${m.color}bb)`,
        border:"none", borderRadius:16, padding:"14px", fontSize:16, fontWeight:900,
        color:"#fff", cursor:"pointer", fontFamily:"'Nunito',sans-serif",
        boxShadow:`0 8px 24px ${m.color}45`
      }}>Choose {m.name}! →</button>
    </div>
  );

  return (
    <div style={{ padding:"22px 18px", overflowY:"auto", height:"100%" }} className="slide-up">
      <div style={{ textAlign:"center", marginBottom:8 }}>
        <MonkeyImg monkey={coach} size={80} floating />
      </div>
      <div style={{ textAlign:"center", marginBottom:20 }}>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:26, color:"#FFD700" }}>Your EIKEN Level</div>
        <div style={{ fontSize:12, opacity:0.55, marginTop:4 }}>We'll tailor everything just for you</div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:24 }}>
        {LEVELS.map(lv => (
          <button key={lv} onClick={() => setLevel(lv)} style={{
            background: level===lv ? `linear-gradient(135deg,${m.color}30,${m.color}10)` : "rgba(255,255,255,0.04)",
            border:`2px solid ${level===lv ? m.color : "rgba(255,255,255,0.08)"}`,
            borderRadius:14, padding:"12px 18px", cursor:"pointer", color:"#fff",
            fontSize:15, fontWeight:level===lv ? 800 : 600, textAlign:"left",
            display:"flex", justifyContent:"space-between", alignItems:"center",
            transition:"all 0.2s",
          }}>
            <span>{lv}</span>
            {level===lv && <span style={{ color:m.color, fontSize:18 }}>✓</span>}
          </button>
        ))}
      </div>
      <button onClick={() => onComplete({ coach, level })} style={{
        width:"100%", background:"linear-gradient(135deg,#FFD700,#F5A623)",
        border:"none", borderRadius:16, padding:"14px", fontSize:16, fontWeight:900,
        color:"#1a1000", cursor:"pointer", fontFamily:"'Nunito',sans-serif",
        boxShadow:"0 8px 24px #F5A62345"
      }}>Start Learning! 🍌</button>
    </div>
  );
}

// ─── SCREEN: DASHBOARD ───────────────────────────────────────────────────────
// ─── SCREEN: WELCOME (opening experience) ────────────────────────────────────
const WELCOME_BTN_PRIMARY = {
  width:"100%", background:"linear-gradient(135deg,#FFD700,#F5A623)", color:"#1a1000",
  border:"none", borderRadius:16, padding:"14px", fontSize:15, fontWeight:900,
  cursor:"pointer", fontFamily:"'Nunito',sans-serif", boxShadow:"0 8px 24px #F5A62345",
};
const WELCOME_BTN_SECONDARY = {
  width:"100%", background:"rgba(255,255,255,0.06)", color:"#fff",
  border:"1.5px solid rgba(255,255,255,0.12)", borderRadius:16, padding:"13px", fontSize:14, fontWeight:700,
  cursor:"pointer", fontFamily:"'Nunito',sans-serif",
};

function WelcomeScreen({ name, eikenUser, platformUser, coachColor, onNavigate, onAcceptGrade }) {
  const recommended = recommendGrade(eikenUser, platformUser);
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:"32px 28px", textAlign:"center" }} className="slide-up">
      <div style={{ fontSize:60, marginBottom:6 }} className="float">🐵</div>
      <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:24, color:"#FFD700", marginBottom:10 }}>
        Welcome back, {name}!
      </div>
      <div style={{ fontSize:16, fontWeight:800, marginBottom:6 }}>Hi! I'm Jonathan AI.</div>
      <div style={{ fontSize:13, opacity:0.65, maxWidth:270, lineHeight:1.7, marginBottom:recommended ? 16 : 28 }}>
        Today we're going to build your confidence for EIKEN.
      </div>
      {recommended && (
        <div style={{ background:`linear-gradient(135deg,${coachColor}22,${coachColor}08)`, border:`1.5px solid ${coachColor}45`, borderRadius:16, padding:"14px 16px", marginBottom:20, width:"100%", maxWidth:300 }}>
          <div style={{ fontSize:13, fontWeight:800, marginBottom:10 }}>We recommend EIKEN {recommended}.</div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => onAcceptGrade(recommended)} style={{ ...WELCOME_BTN_PRIMARY, padding:"10px", fontSize:13 }}>Accept</button>
            <button onClick={() => onNavigate("placement")} style={{ ...WELCOME_BTN_SECONDARY, padding:"10px", fontSize:13 }}>Take Assessment</button>
          </div>
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", maxWidth:300 }}>
        <button onClick={() => onNavigate("dashboard")} style={WELCOME_BTN_PRIMARY}>Continue Learning</button>
        <button onClick={() => onNavigate("placement")} style={WELCOME_BTN_SECONDARY}>Take a Level Check</button>
        <button onClick={() => onNavigate("gradeSelect")} style={WELCOME_BTN_SECONDARY}>Choose My Grade</button>
        <button onClick={() => onNavigate("parents")} style={WELCOME_BTN_SECONDARY}>Parents Dashboard</button>
        <button onClick={() => onNavigate("achievements")} style={WELCOME_BTN_SECONDARY}>Achievements</button>
      </div>
    </div>
  );
}

// ─── SCREEN: CHOOSE MY GRADE ──────────────────────────────────────────────────
function GradeSelectScreen({ level, coachColor, onSelect, onBack }) {
  return (
    <div style={{ padding:"22px 18px", overflowY:"auto", height:"100%" }} className="slide-up">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12, padding:"8px 14px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>←</button>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color:"#FFD700" }}>Choose My Grade</div>
      </div>
      <div style={{ fontSize:12, opacity:0.55, marginBottom:18 }}>Pick the EIKEN grade you want to practice — you can change this anytime.</div>
      <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
        {LEVELS.map(lv => (
          <button key={lv} onClick={() => onSelect(lv)} style={{
            background: level===lv ? `linear-gradient(135deg,${coachColor}30,${coachColor}10)` : "rgba(255,255,255,0.04)",
            border:`2px solid ${level===lv ? coachColor : "rgba(255,255,255,0.08)"}`,
            borderRadius:14, padding:"12px 18px", cursor:"pointer", color:"#fff",
            fontSize:15, fontWeight:level===lv ? 800 : 600, textAlign:"left",
            display:"flex", justifyContent:"space-between", alignItems:"center",
          }}>
            <span>{lv}</span>
            {level===lv && <span style={{ color:coachColor, fontSize:18 }}>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── SCREEN: ACHIEVEMENTS ─────────────────────────────────────────────────────
// Client-computed from currently-tracked local stats only. Achievements that
// need systems built in later phases (interview simulator, EIKEN readiness
// score, per-module mission counts) show as locked rather than faked — Phase 8
// replaces this with persisted server-side unlock records for all of them.
function computeUnlockedAchievements(user) {
  const unlocked = new Set();
  if ((user.sessions ?? 0) >= 1)   unlocked.add("first_conversation");
  if ((user.sessions ?? 0) >= 10)  unlocked.add("brave_speaker");
  if ((user.streak ?? 0)   >= 100) unlocked.add("hundred_day_streak");
  return unlocked;
}

function AchievementsScreen({ user, activeMember, onBack }) {
  const unlocked = computeUnlockedAchievements(user);
  const mpUnlocked = computeMonkeyPartyBadgeUnlocks(user);

  // Persist unlock records (idempotent — logAchievementUnlock merge-sets by
  // achievement id, so re-checking on every visit never creates duplicates).
  useEffect(() => {
    for (const id of unlocked) {
      const def = ACHIEVEMENTS.find(a => a.id === id);
      if (def) logAchievementUnlock(activeMember, id, { label: def.label });
    }
    for (const id of mpUnlocked) {
      const def = MONKEY_PARTY_BADGES.find(b => b.id === id);
      if (def) logAchievementUnlock(activeMember, id, { label: def.label });
    }
  }, [Array.from(unlocked).join(","), Array.from(mpUnlocked).join(","), activeMember?.id]);

  const renderBadge = (a, isUnlocked) => (
    <div key={a.id} style={{
      display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:14,
      background: isUnlocked ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.03)",
      border:`1.5px solid ${isUnlocked ? "rgba(255,215,0,0.35)" : "rgba(255,255,255,0.06)"}`,
      opacity: isUnlocked ? 1 : 0.5,
    }}>
      <div style={{ fontSize:26 }}>{isUnlocked ? a.icon : "🔒"}</div>
      <div>
        <div style={{ fontSize:14, fontWeight:800 }}>{a.label}</div>
        <div style={{ fontSize:11, opacity:0.6, marginTop:2 }}>{a.desc}</div>
      </div>
    </div>
  );

  return (
    <div style={{ padding:"22px 18px", overflowY:"auto", height:"100%" }} className="slide-up">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12, padding:"8px 14px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>←</button>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color:"#FFD700" }}>Achievements</div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:22 }}>
        {ACHIEVEMENTS.map(a => renderBadge(a, unlocked.has(a.id)))}
      </div>

      <div style={{ fontSize:12, fontWeight:800, color:"#FFD700", marginBottom:10 }}>🎉 MONKEY PARTY BADGES</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {MONKEY_PARTY_BADGES.map(b => renderBadge(b, mpUnlocked.has(b.id)))}
      </div>
    </div>
  );
}

// ─── SCREEN: COMING SOON (placement / parents — built out in later phases) ───
// ─── SCREEN: PLACEMENT ASSESSMENT (Take a Level Check) ───────────────────────
function PlacementScreen({ startLevel, coachColor, plan, uid, activeMember, onComplete, onBack }) {
  const [session, setSession] = useState(() => createPlacementSession(startLevel));
  const [selected, setSelected] = useState(null);
  const [phase, setPhase] = useState("question"); // question | scoring | result
  const [narration, setNarration] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recTime, setRecTime] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const questionShownAtRef = useRef(Date.now());

  const q = session.question;

  // Reset per-question state whenever a new question comes in, and mark when
  // it appeared (used to measure real hesitation: time until the student
  // starts recording, not just time until they tap "done").
  useEffect(() => {
    questionShownAtRef.current = Date.now();
    setSelected(null);
    setRecording(false);
    setRecorded(false);
    setTranscript("");
  }, [q]);

  // Read listening passages and speaking prompts aloud in Jonathan AI's
  // (Daniel/ElevenLabs) voice — reading-type items stay silent/visual,
  // consistent with ReadingLesson elsewhere in the app.
  useEffect(() => {
    if (!q) return;
    if (q.type === "speaking") {
      speakElevenLabs(q.prompt, {}, uid);
    }
  }, [q, uid]);

  const playScript = useCallback(() => {
    if (!q?.script) return;
    if (speaking) { setSpeaking(false); return; }
    speakElevenLabs(q.script, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) }, uid);
  }, [q, speaking, uid]);

  const answerMcq = () => {
    if (selected === null) return;
    const correct = selected === q.answer;
    setSelected(null);
    setSession(s => submitPlacementAnswer(s, { correct }));
  };

  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTranscript("(Speech recognition not available in this browser. Please type your answer below.)");
      setRecorded(true);
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "en-US"; rec.continuous = true; rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e) => {
      finalText = Array.from(e.results).map(r => r[0].transcript).join(" ");
      setTranscript(finalText);
    };
    rec.onend = () => { setRecording(false); setRecorded(true); if (finalText) setTranscript(finalText); };
    rec.start();
    recognitionRef.current = rec;
    setRecording(true);
    setRecTime(0);
    timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
    setRecorded(true);
  }, []);

  const answerSpeaking = () => {
    const elapsedMs = Date.now() - questionShownAtRef.current;
    setSession(s => submitPlacementAnswer(s, { elapsedMs }));
  };

  useEffect(() => {
    if (!session.done || phase !== "question") return;
    setPhase("scoring");
    (async () => {
      const summary = summarizePlacement(session);
      try {
        const { content } = await askJonathan({
          taskType: "explain",
          system: `You are Jonathan AI, a warm, encouraging EIKEN teacher. A student just finished a short placement check. Never say "wrong" — celebrate effort first, then coach. Respond ONLY as JSON: {"praise":"one warm sentence about their effort","tip":"one encouraging, specific next step for ${summary.recommendedLevel}"}`,
          messages: [{ role: "user", content: `Recommended grade: ${summary.recommendedLevel}. MCQ: ${summary.mcqCorrect}/${summary.mcqTotal} correct. Speaking questions attempted: ${summary.speakingCount}, hesitated on ${summary.hesitationCount}.` }],
          user: { plan },
        });
        try {
          setNarration(JSON.parse((content || "{}").replace(/```json|```/g, "").trim()));
        } catch {
          setNarration({ praise: "Great effort working through that Level Check!", tip: `Let's build your confidence at ${summary.recommendedLevel}.` });
        }
      } catch {
        setNarration({ praise: "Great effort working through that Level Check!", tip: `Let's build your confidence at ${summary.recommendedLevel}.` });
      }
      logPlacementResult(activeMember, summary);
      setPhase("result");
    })();
  }, [session.done, phase]);

  if (phase === "scoring") {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:32, textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:14 }} className="float">🐵</div>
        <div style={{ fontSize:14, opacity:0.6 }}>Jonathan AI is looking over your answers...</div>
      </div>
    );
  }

  if (phase === "result") {
    const summary = summarizePlacement(session);
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:32, textAlign:"center" }} className="slide-up">
        <div style={{ fontSize:44, marginBottom:12 }}>🎉</div>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:22, color:"#FFD700", marginBottom:10 }}>
          We recommend EIKEN {summary.recommendedLevel}
        </div>
        {narration && (
          <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:16, padding:"14px 16px", marginBottom:22, maxWidth:280 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:6, lineHeight:1.6 }}>{narration.praise}</div>
            <div style={{ fontSize:12, opacity:0.65, lineHeight:1.6 }}>{narration.tip}</div>
          </div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", maxWidth:280 }}>
          <button onClick={() => onComplete(summary.recommendedLevel)} style={WELCOME_BTN_PRIMARY}>Accept & Continue</button>
          <button onClick={onBack} style={WELCOME_BTN_SECONDARY}>Back to Welcome</button>
        </div>
      </div>
    );
  }

  // phase === "question"
  return (
    <div style={{ padding:"18px 16px", height:"100%", overflowY:"auto", display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12, padding:"8px 14px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>←</button>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:18, color:"#FFD700" }}>Level Check</div>
        <div style={{ fontSize:11, opacity:0.5, marginLeft:"auto" }}>{q.skill} · {q.level}</div>
      </div>

      {q.type === "mcq" ? (
        <>
          {q.script && (
            <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:14, padding:"14px", marginBottom:14, textAlign:"center" }}>
              <button onClick={playScript} style={{
                background: speaking ? `${coachColor}40` : `linear-gradient(135deg,${coachColor},${coachColor}bb)`,
                border:`2px solid ${coachColor}`, borderRadius:99, padding:"10px 22px", color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer",
              }}>{speaking ? "🔊 Playing..." : "▶ Play Passage"}</button>
            </div>
          )}
          {q.passage && (
            <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:14, padding:"14px", marginBottom:14, fontSize:13, lineHeight:1.7 }}>
              {q.passage}
            </div>
          )}
          <div style={{ fontSize:15, fontWeight:800, marginBottom:14 }}>{q.question}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:20 }}>
            {q.choices.map((c, i) => (
              <button key={i} onClick={() => setSelected(i)} style={{
                background: selected===i ? `linear-gradient(135deg,${coachColor}30,${coachColor}10)` : "rgba(255,255,255,0.04)",
                border:`2px solid ${selected===i ? coachColor : "rgba(255,255,255,0.08)"}`,
                borderRadius:14, padding:"12px 16px", cursor:"pointer", color:"#fff",
                fontSize:14, fontWeight:selected===i ? 800 : 600, textAlign:"left",
              }}>{c}</button>
            ))}
          </div>
          <button onClick={answerMcq} disabled={selected===null} style={{ ...WELCOME_BTN_PRIMARY, opacity: selected===null ? 0.4 : 1 }}>Submit</button>
        </>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
          <div style={{ width:"100%", background:`linear-gradient(135deg,${coachColor}22,${coachColor}08)`, border:`1.5px solid ${coachColor}35`, borderRadius:20, padding:"18px 16px", marginBottom:10, textAlign:"center" }}>
            <div style={{ fontSize:10, color:coachColor, fontWeight:800, marginBottom:8 }}>🗣️ SPEAKING QUESTION</div>
            <div style={{ fontSize:16, fontWeight:800, lineHeight:1.6 }}>{q.prompt}</div>
          </div>

          <button onClick={recording ? stopRecording : startRecording} style={{
            width:90, height:90, borderRadius:"50%",
            background: recording ? "linear-gradient(135deg,#FF4444,#CC0000)" : `linear-gradient(135deg,${coachColor},${coachColor}bb)`,
            border: `4px solid ${recording ? "#FF666680" : coachColor+"80"}`,
            cursor:"pointer", fontSize:36, marginBottom:12,
            boxShadow: recording ? "0 0 30px #FF444480, 0 0 60px #FF222240" : `0 8px 28px ${coachColor}50`,
            animation: recording ? "pulse 1s ease infinite" : "none", transition:"all 0.3s"
          }}>{recording ? "⏹" : "🎤"}</button>

          <div style={{ fontSize:12, opacity:0.7, marginBottom:8 }}>
            {recording ? `🔴 Recording... ${recTime}s — tap to stop` : recorded ? "✅ Recorded! Review below." : "Tap the mic to answer out loud"}
          </div>

          {recorded && (
            <textarea value={transcript} onChange={e=>setTranscript(e.target.value)}
              placeholder="Your speech appears here. You can also type or edit..."
              style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(255,255,255,0.15)", borderRadius:16, padding:"13px", color:"#fff", fontSize:13, lineHeight:1.65, resize:"none", minHeight:70, marginBottom:10 }} />
          )}

          {recorded && (
            <button onClick={answerSpeaking} style={{ ...WELCOME_BTN_PRIMARY, width:"100%" }}>Continue →</button>
          )}
          <div style={{ fontSize:11, opacity:0.4, marginTop:8, maxWidth:260, textAlign:"center" }}>There's no wrong answer here — just speak naturally. Jonathan AI is coaching, not testing.</div>
        </div>
      )}
    </div>
  );
}

// ─── SCREEN: MOCK TEST (Treasure Challenge) — Practice mode ──────────────────
// One aggregate AI evaluation call at the end rather than one per item — a
// mock test has ~14 items, and per-item calls would burn through the shared
// daily AI quota fast (see eiken-evaluate.js). Timed/Review/Adaptive modes
// are designed (see MOCK_TESTS section shape / timeLimitSec) but not wired
// into the UI yet — Practice mode (no timer) ships first.
function MockTestScreen({ user, plan, uid, activeMember, onBack, onXP }) {
  const test = (MOCK_TESTS[user.level] || [])[0];
  const [sectionIdx, setSectionIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [responses, setResponses] = useState([]);
  const [current, setCurrent] = useState({ mcq: null, text: "" });
  const [phase, setPhase] = useState("running"); // running | scoring | result
  const [result, setResult] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recTime, setRecTime] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  const section = test?.sections[sectionIdx];
  const item = section?.items[itemIdx];

  // Read listening passages and speaking prompts aloud in Jonathan AI's
  // (Daniel/ElevenLabs) voice — reading/writing items stay silent/visual.
  useEffect(() => {
    if (!section) return;
    setRecording(false); setRecorded(false); setTranscript("");
    if (section.type === "speaking" && item) {
      speakElevenLabs(item, {}, uid);
    }
  }, [section, item, uid]);

  const playItemScript = useCallback(() => {
    if (!item?.script) return;
    if (speaking) { setSpeaking(false); return; }
    speakElevenLabs(item.script, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) }, uid);
  }, [item, speaking, uid]);

  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTranscript("(Speech recognition not available in this browser. Please type your answer below.)");
      setRecorded(true);
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "en-US"; rec.continuous = true; rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e) => {
      finalText = Array.from(e.results).map(r => r[0].transcript).join(" ");
      setTranscript(finalText);
    };
    rec.onend = () => { setRecording(false); setRecorded(true); if (finalText) setTranscript(finalText); };
    rec.start();
    recognitionRef.current = rec;
    setRecording(true);
    setRecTime(0);
    timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
    setRecorded(true);
  }, []);

  if (!test) return <ComingSoonScreen title="Mock Test" message="No mock test is available for this grade yet." onBack={onBack} />;

  const recordAndAdvance = (response) => {
    const next = [...responses, { section: section.type, ...response }];
    setResponses(next);
    setCurrent({ mcq: null, text: "" });
    if (itemIdx + 1 < section.items.length) {
      setItemIdx(i => i + 1);
    } else if (sectionIdx + 1 < test.sections.length) {
      setSectionIdx(s => s + 1);
      setItemIdx(0);
    } else {
      finishTest(next);
    }
  };

  const finishTest = async (allResponses) => {
    setPhase("scoring");
    const mcqResponses = allResponses.filter(r => r.type === "mcq");
    const mcqCorrect = mcqResponses.filter(r => r.correct).length;
    const writingSample = allResponses.find(r => r.section === "writing")?.text ?? "";
    const speakingCount = allResponses.filter(r => r.section === "speaking").length;

    let parsed;
    try {
      const { content } = await askJonathan({
        taskType: "explain",
        system: buildEvaluationSystemPrompt(
          `A student just completed a full practice EIKEN mock test at ${user.level} level (listening, reading, writing, and speaking sections).`,
          { tipLabel: "one specific, encouraging next step before their real exam", correctionLabel: "one thing they clearly did well, named specifically" }
        ),
        messages: [{ role: "user", content: `Listening+Reading MCQ: ${mcqCorrect}/${mcqResponses.length} correct. Writing sample: "${writingSample}". Speaking items attempted: ${speakingCount}.` }],
        user: { plan },
      });
      try { parsed = JSON.parse((content || "{}").replace(/```json|```/g, "").trim()); }
      catch { parsed = fallbackFeedback(mcqCorrect >= mcqResponses.length / 2, ""); }
    } catch {
      parsed = fallbackFeedback(mcqCorrect >= mcqResponses.length / 2, "");
    }

    setResult({ ...parsed, mcqCorrect, mcqTotal: mcqResponses.length });
    logMockAttempt(activeMember, { testId: test.id, level: user.level, mcqCorrect, mcqTotal: mcqResponses.length, speakingCount, praise: parsed.praise, tip: parsed.tip });
    onXP(100);
    setPhase("result");
  };

  if (phase === "scoring") {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:32, textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:14 }} className="float">🏆</div>
        <div style={{ fontSize:14, opacity:0.6 }}>Jonathan AI is reviewing your whole test...</div>
      </div>
    );
  }

  if (phase === "result" && result) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:32, textAlign:"center" }} className="slide-up">
        <div style={{ fontSize:44, marginBottom:12 }}>🏆</div>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color:"#FFD700", marginBottom:6 }}>Mock Test Complete!</div>
        <div style={{ fontSize:12, opacity:0.5, marginBottom:16 }}>{result.mcqCorrect}/{result.mcqTotal} listening & reading correct</div>
        <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:16, padding:"14px 16px", marginBottom:22, maxWidth:280 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:6, lineHeight:1.6 }}>{result.praise}</div>
          <div style={{ fontSize:12, opacity:0.65, lineHeight:1.6 }}>{result.tip}</div>
        </div>
        <button onClick={onBack} style={{ ...WELCOME_BTN_PRIMARY, maxWidth:220 }}>Back to Dashboard</button>
      </div>
    );
  }

  // phase === "running"
  return (
    <div style={{ padding:"18px 16px", height:"100%", overflowY:"auto", display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12, padding:"8px 14px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>←</button>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:16, color:"#FFD700" }}>🏆 Mock Test</div>
        <div style={{ fontSize:11, opacity:0.5, marginLeft:"auto" }}>{section.type} · {itemIdx+1}/{section.items.length}</div>
      </div>

      {section.type === "listening" || section.type === "reading" ? (
        <>
          {item.script && (
            <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:14, padding:"14px", marginBottom:14, textAlign:"center" }}>
              <button onClick={playItemScript} style={{
                background: speaking ? "#FFD70040" : "linear-gradient(135deg,#FFD700,#F5A623)",
                border:"2px solid #FFD700", borderRadius:99, padding:"10px 22px", color:"#1a1000", fontSize:13, fontWeight:800, cursor:"pointer",
              }}>{speaking ? "🔊 Playing..." : "▶ Play Passage"}</button>
            </div>
          )}
          {item.passage && (
            <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:14, padding:"14px", marginBottom:14, fontSize:13, lineHeight:1.7 }}>{item.passage}</div>
          )}
          <div style={{ fontSize:15, fontWeight:800, marginBottom:14 }}>{item.question}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:20 }}>
            {item.choices.map((c, i) => (
              <button key={i} onClick={() => setCurrent({ mcq: i })} style={{
                background: current.mcq===i ? "rgba(255,215,0,0.2)" : "rgba(255,255,255,0.04)",
                border:`2px solid ${current.mcq===i ? "#FFD700" : "rgba(255,255,255,0.08)"}`,
                borderRadius:14, padding:"12px 16px", cursor:"pointer", color:"#fff", fontSize:14, textAlign:"left",
              }}>{c}</button>
            ))}
          </div>
          <button onClick={() => current.mcq !== null && recordAndAdvance({ type:"mcq", correct: current.mcq === item.answer })}
            disabled={current.mcq === null} style={{ ...WELCOME_BTN_PRIMARY, opacity: current.mcq===null?0.4:1 }}>Next →</button>
        </>
      ) : section.type === "writing" ? (
        <>
          <div style={{ fontSize:15, fontWeight:800, marginBottom:6 }}>{item.prompt}</div>
          <div style={{ fontSize:11, opacity:0.5, marginBottom:12 }}>Target: about {item.target} words</div>
          <textarea value={current.text} onChange={e=>setCurrent({ text:e.target.value })} rows={8}
            style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:14, padding:12, color:"#fff", fontSize:14, marginBottom:14, resize:"none" }} />
          <button onClick={() => current.text.trim() && recordAndAdvance({ type:"writing", text: current.text })}
            disabled={!current.text.trim()} style={{ ...WELCOME_BTN_PRIMARY, opacity: current.text.trim()?1:0.4 }}>Submit →</button>
        </>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
          <div style={{ width:"100%", background:"rgba(255,215,0,0.08)", border:"1.5px solid rgba(255,215,0,0.3)", borderRadius:20, padding:"18px 16px", marginBottom:10, textAlign:"center" }}>
            <div style={{ fontSize:10, color:"#FFD700", fontWeight:800, marginBottom:8 }}>🗣️ SPEAKING QUESTION</div>
            <div style={{ fontSize:16, fontWeight:800, lineHeight:1.6 }}>{item}</div>
          </div>

          <button onClick={recording ? stopRecording : startRecording} style={{
            width:90, height:90, borderRadius:"50%",
            background: recording ? "linear-gradient(135deg,#FF4444,#CC0000)" : "linear-gradient(135deg,#FFD700,#F5A623)",
            border: `4px solid ${recording ? "#FF666680" : "#FFD70080"}`,
            cursor:"pointer", fontSize:36, marginBottom:12,
            boxShadow: recording ? "0 0 30px #FF444480, 0 0 60px #FF222240" : "0 8px 28px #FFD70050",
            animation: recording ? "pulse 1s ease infinite" : "none", transition:"all 0.3s"
          }}>{recording ? "⏹" : "🎤"}</button>

          <div style={{ fontSize:12, opacity:0.7, marginBottom:8 }}>
            {recording ? `🔴 Recording... ${recTime}s — tap to stop` : recorded ? "✅ Recorded! Review below." : "Tap the mic to answer out loud"}
          </div>

          {recorded && (
            <textarea value={transcript} onChange={e=>setTranscript(e.target.value)}
              placeholder="Your speech appears here. You can also type or edit..."
              style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(255,255,255,0.15)", borderRadius:16, padding:"13px", color:"#fff", fontSize:13, lineHeight:1.65, resize:"none", minHeight:70, marginBottom:10 }} />
          )}

          {recorded && (
            <button onClick={() => recordAndAdvance({ type:"speaking", transcript })} style={{ ...WELCOME_BTN_PRIMARY, width:"100%" }}>Next →</button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MONKEY PARTY ─────────────────────────────────────────────────────────────
// Fast single-player speaking games, built inside the existing EIKEN Monkey
// screen-routing/scoring/progress system — no separate app, login, or AI
// service. Phase 1 scope: core game loop, text/score feedback only (voice +
// talking-monkey animation are explicitly Phase 2 per the build spec).

function MonkeyPartySetup({ user, onStart, onBack }) {
  const [mode, setMode] = useState("quick_mix");
  const [topic, setTopic] = useState("Random");
  const [roundCount, setRoundCount] = useState(5);

  return (
    <div style={{ padding:"18px 16px", height:"100%", overflowY:"auto", display:"flex", flexDirection:"column" }} className="slide-up">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12, padding:"8px 14px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>←</button>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color:"#FFD700" }}>🎉 Monkey Party</div>
      </div>
      <div style={{ fontSize:12, opacity:0.55, marginBottom:6, marginLeft:46 }}>Fast speaking games for EIKEN confidence.</div>
      <div style={{ fontSize:11, opacity:0.5, marginBottom:18, marginLeft:46 }}>Playing at {user.level}</div>

      <div style={{ fontSize:12, fontWeight:800, color:"#FFD700", marginBottom:8 }}>GAME MODE</div>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
        {GAME_MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            display:"flex", alignItems:"center", gap:12, textAlign:"left",
            background: mode===m.id ? "linear-gradient(135deg,#FFD70030,#F5A62312)" : "rgba(255,255,255,0.04)",
            border:`2px solid ${mode===m.id ? "#FFD700" : "rgba(255,255,255,0.08)"}`,
            borderRadius:14, padding:"12px 14px", cursor:"pointer", color:"#fff",
          }}>
            <span style={{ fontSize:24 }}>{m.icon}</span>
            <span>
              <div style={{ fontSize:14, fontWeight:800, display:"flex", alignItems:"center", gap:6 }}>
                {m.label}
                {m.recommended && <span style={{ fontSize:9, fontWeight:800, color:"#1a1000", background:"#FFD700", borderRadius:6, padding:"1px 6px" }}>RECOMMENDED</span>}
              </div>
              <div style={{ fontSize:11, opacity:0.6 }}>{m.desc}</div>
            </span>
          </button>
        ))}
      </div>

      <div style={{ fontSize:12, fontWeight:800, color:"#FFD700", marginBottom:8 }}>TOPIC</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
        {TOPICS.map(t => (
          <button key={t} onClick={() => setTopic(t)} style={{
            background: topic===t ? "#FFD700" : "rgba(255,255,255,0.06)",
            color: topic===t ? "#1a1000" : "#fff",
            border:"none", borderRadius:99, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer",
          }}>{t}</button>
        ))}
      </div>

      <div style={{ fontSize:12, fontWeight:800, color:"#FFD700", marginBottom:8 }}>SESSION LENGTH</div>
      <div style={{ display:"flex", gap:8, marginBottom:24 }}>
        {SESSION_LENGTHS.map(n => (
          <button key={n} onClick={() => setRoundCount(n)} style={{
            flex:1, background: roundCount===n ? "#FFD700" : "rgba(255,255,255,0.06)",
            color: roundCount===n ? "#1a1000" : "#fff",
            border:"none", borderRadius:12, padding:"10px", fontSize:13, fontWeight:800, cursor:"pointer",
          }}>{n} rounds</button>
        ))}
      </div>

      <button onClick={() => onStart({ mode, topic, roundCount })} style={WELCOME_BTN_PRIMARY}>Play Now 🎉</button>
    </div>
  );
}

function MonkeyPartyGame({ user, plan, uid, activeMember, config, onComplete, onExit }) {
  const [roundSequence] = useState(() =>
    config.mode === "quick_mix" ? buildQuickMixSequence(config.roundCount) : Array(config.roundCount).fill(config.mode)
  );
  const [roundIdx, setRoundIdx] = useState(0);
  const [rounds, setRounds] = useState([]);
  const [subPhase, setSubPhase] = useState("play"); // play | evaluating | feedback
  const [choice, setChoice] = useState(null); // would_you_rather selection / answer_or_challenge selection
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recTime, setRecTime] = useState(0);
  const [evaluation, setEvaluation] = useState(null);
  const [roundStartAt, setRoundStartAt] = useState(() => Date.now());
  const [rushCandidates, setRushCandidates] = useState([]);
  const [rushTimeLeft, setRushTimeLeft] = useState(30);
  const [rushActive, setRushActive] = useState(false);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const rushTimerRef = useRef(null);
  const rushActiveRef = useRef(false); // ref copy of rushActive for onend closure

  // Phase 2: talking monkey + voice. monkeyState drives TalkingMonkey's
  // emotional pose (idle/listening/thinking/correct/try_again/celebration);
  // isSpeaking is tracked separately so mouth animation can layer on top of
  // whichever pose is active (e.g. speaking while celebrating).
  const [monkeyState, setMonkeyState] = useState("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [caption, setCaption] = useState("");
  const [lastAudioEl, setLastAudioEl] = useState(null);

  // Stop TTS + clear all timers when the game exits or the component unmounts.
  useEffect(() => {
    return () => {
      stopSpeaking();
      clearInterval(timerRef.current);
      clearInterval(rushTimerRef.current);
      try { recognitionRef.current?.stop(); } catch {}
      rushActiveRef.current = false;
    };
  }, []);

  const speak = useCallback((text) => {
    setCaption(text);
    setIsSpeaking(true);
    speakElevenLabs(text, {
      onAudioReady: (el) => setLastAudioEl(el),
      onEnd: () => setIsSpeaking(false),
      muted,
    }, uid);
  }, [uid, muted]);

  const replay = useCallback(() => {
    if (!caption) return;
    speak(caption);
  }, [caption, speak]);

  const currentMode = roundSequence[roundIdx];

  // Generate this round's content once per round index, using a stable ref
  // keyed by roundIdx so it doesn't regenerate on every re-render.
  const [roundContentByIdx, setRoundContentByIdx] = useState({});
  useEffect(() => {
    if (roundContentByIdx[roundIdx]) return;
    const topicPool = config.topic === "Random" ? TOPICS.filter(t => t !== "Random") : [config.topic];
    const pickedTopic = topicPool[Math.floor(Math.random() * topicPool.length)];
    let content = { topic: pickedTopic };

    if (currentMode === "would_you_rather") {
      const pairs = WOULD_YOU_RATHER[pickedTopic] || WOULD_YOU_RATHER.Random;
      content.pair = pairs[Math.floor(Math.random() * pairs.length)];
    } else if (currentMode === "category_rush") {
      const tier = categoryTierForLevel(user.level);
      const categories = CATEGORY_RUSH_BY_TIER[tier];
      content.category = categories[Math.floor(Math.random() * categories.length)];
    } else if (currentMode === "answer_or_challenge") {
      const bank = SPEAKING_BANK[user.level] || SPEAKING_BANK[LEVELS[0]];
      content.prompt = bank[Math.floor(Math.random() * bank.length)];
      content.challenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    } else if (currentMode === "beat_the_monkey") {
      const pairs = BEAT_THE_MONKEY[pickedTopic] || BEAT_THE_MONKEY.Random;
      content.pair = pairs[Math.floor(Math.random() * pairs.length)];
    }
    setRoundContentByIdx(prev => ({ ...prev, [roundIdx]: content }));
  }, [roundIdx, currentMode]);

  // Monkey introduces the challenge and reads the prompt aloud — steps 1-3 of
  // the spec's round flow. Runs once per round as soon as content is ready.
  useEffect(() => {
    const content = roundContentByIdx[roundIdx];
    if (!content) return;
    let intro = "";
    if (currentMode === "would_you_rather") intro = `Would you rather ${content.pair.a}, or ${content.pair.b}?`;
    else if (currentMode === "category_rush") intro = `Ready? Name things in this category: ${content.category}!`;
    else if (currentMode === "answer_or_challenge") intro = `Here's your question: ${content.prompt}`;
    else if (currentMode === "beat_the_monkey") intro = `${content.pair.question} My answer is: ${content.pair.monkeyAnswer}. Can you beat me?`;
    if (intro) speak(intro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundIdx, !!roundContentByIdx[roundIdx]]);

  const roundContent = roundContentByIdx[roundIdx];

  // Reset per-round UI state and mark the round start time (used for
  // speakingSeconds and, for Category Rush, kicking off the countdown).
  useEffect(() => {
    setSubPhase("play");
    setChoice(null);
    setRecording(false);
    setRecorded(false);
    setTranscript("");
    setEvaluation(null);
    setRoundStartAt(Date.now());
    setRushCandidates([]);
    setRushTimeLeft(30);
    setRushActive(false);
  }, [roundIdx]);

  const startRecording = useCallback(() => {
    // Stop any monkey speech before the mic opens so voices don't overlap.
    stopSpeaking();
    setIsSpeaking(false);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTranscript("(Speech recognition not available in this browser. Please type your answer below.)");
      setRecorded(true);
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "en-US"; rec.continuous = true; rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e) => {
      finalText = Array.from(e.results).map(r => r[0].transcript).join(" ");
      setTranscript(finalText);
    };
    rec.onend = () => {
      setRecording(false); setRecorded(true); setMonkeyState("idle");
      clearInterval(timerRef.current);
      if (finalText) setTranscript(finalText);
    };
    rec.start();
    recognitionRef.current = rec;
    setRecording(true);
    setMonkeyState("listening");
    setRecTime(0);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
    setRecorded(true);
    setMonkeyState("idle");
  }, []);

  // ── Category Rush: continuous recording for the whole countdown ──────────
  const startRush = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    rushActiveRef.current = true;
    setRushActive(true);
    setMonkeyState("listening");
    setRushTimeLeft(30);
    if (SpeechRecognition) {
      const startRec = () => {
        if (!rushActiveRef.current) return;
        const rec = new SpeechRecognition();
        rec.lang = "en-US"; rec.continuous = true; rec.interimResults = false;
        rec.onresult = (e) => {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
              const text = e.results[i][0].transcript;
              setRushCandidates(prev => addCandidateAnswer(prev, text));
            }
          }
        };
        // Mobile Web Speech API silently stops after ~10s; restart it while
        // the rush timer is still running so the mic stays live the full 30s.
        rec.onend = () => { if (rushActiveRef.current) startRec(); };
        rec.start();
        recognitionRef.current = rec;
      };
      startRec();
    }
    clearInterval(rushTimerRef.current);
    rushTimerRef.current = setInterval(() => {
      setRushTimeLeft(t => {
        if (t <= 1) {
          clearInterval(rushTimerRef.current);
          rushActiveRef.current = false;
          try { recognitionRef.current?.stop(); } catch {}
          setRushActive(false);
          setRecorded(true);
          setMonkeyState("idle");
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  const submitRound = useCallback(async (extra = {}) => {
    setSubPhase("evaluating");
    setMonkeyState("thinking");
    const speakingSeconds = Math.round((Date.now() - roundStartAt) / 1000);
    const promptCtx = { mode: currentMode, level: user.level, topic: roundContent?.topic, transcript, ...extra };

    if (currentMode === "would_you_rather") {
      promptCtx.optionA = roundContent.pair.a;
      promptCtx.optionB = roundContent.pair.b;
    } else if (currentMode === "category_rush") {
      promptCtx.category = roundContent.category;
      promptCtx.candidates = rushCandidates;
    } else if (currentMode === "answer_or_challenge") {
      promptCtx.prompt = roundContent.prompt;
      promptCtx.challenge = choice === "challenge" ? roundContent.challenge : null;
    } else if (currentMode === "beat_the_monkey") {
      promptCtx.prompt = roundContent.pair.question;
      promptCtx.monkeyAnswer = roundContent.pair.monkeyAnswer;
    }

    const { system, userMessage } = buildMonkeyPartyPrompt(promptCtx);
    let parsedEval;
    try {
      const { content } = await askJonathan({ taskType: "monkey_party_evaluate", system, messages: [{ role: "user", content: userMessage }], user: { plan } });
      parsedEval = JSON.parse((content || "{}").replace(/```json|```/g, "").trim());
    } catch {
      parsedEval = {
        relevant: true, braveryScore: 2, clarityScore: 2, englishScore: 2, powerScore: 1, totalPoints: 7,
        strengths: ["You gave it a try!"], improvementTip: "Add one more detail next time.",
        correctedVersion: "", followUpQuestion: "", vocabularyUsed: [], grammarUsed: [],
        targetCompleted: false, beatTheMonkey: null, confidenceMessage: "Nice effort — keep going!",
      };
    }

    setEvaluation(parsedEval);
    setRounds(prev => [...prev, { mode: currentMode, topic: roundContent?.topic, evaluation: parsedEval, speakingSeconds, transcript }]);
    setSubPhase("feedback");

    const proud = parsedEval.beatTheMonkey || parsedEval.totalPoints >= 9;
    setMonkeyState(proud ? "celebration" : parsedEval.totalPoints >= 5 ? "correct" : "try_again");
    if (parsedEval.confidenceMessage) speak(parsedEval.confidenceMessage);
  }, [currentMode, roundContent, transcript, rushCandidates, choice, plan, roundStartAt, user.level, speak]);

  const nextRound = () => {
    if (roundIdx + 1 < roundSequence.length) {
      setRoundIdx(i => i + 1);
    } else {
      onComplete(rounds);
    }
  };

  if (!roundContent) return null;

  const color = "#FFD700";

  if (subPhase === "evaluating") {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:32, textAlign:"center" }}>
        <TalkingMonkey monkey={user.coach} state="thinking" speaking={false} size={90} />
        <div style={{ fontSize:14, opacity:0.6, marginTop:14 }}>Jonathan AI is thinking...</div>
      </div>
    );
  }

  if (subPhase === "feedback" && evaluation) {
    return (
      <div style={{ padding:"18px 16px", height:"100%", overflowY:"auto", display:"flex", flexDirection:"column" }} className="slide-up">
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:10 }}>
          <TalkingMonkey monkey={user.coach} state={monkeyState} speaking={isSpeaking} audioEl={lastAudioEl} size={90} />
        </div>
        <div style={{ fontSize:15, fontWeight:800, marginBottom:6, textAlign:"center" }}>{evaluation.confidenceMessage}</div>
        <div style={{ display:"flex", justifyContent:"center", gap:14, marginBottom:14 }}>
          <button onClick={replay} style={{ background:"none", border:"none", color:"#FFD700", fontSize:12, cursor:"pointer" }}>🔁 Replay</button>
          <button onClick={() => setMuted(m => !m)} style={{ background:"none", border:"none", color:"#FFD700", fontSize:12, cursor:"pointer" }}>{muted ? "🔇 Unmute" : "🔊 Mute"}</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
          {[["Bravery", evaluation.braveryScore], ["Clarity", evaluation.clarityScore], ["English", evaluation.englishScore], ["Power", evaluation.powerScore]].map(([label, score]) => (
            <div key={label} style={{ background:"rgba(255,255,255,0.05)", borderRadius:12, padding:"10px 12px" }}>
              <div style={{ fontSize:11, opacity:0.6, marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:16 }}>{"⭐".repeat(clampStars(score)) || "—"}</div>
            </div>
          ))}
        </div>

        {evaluation.currentMode === "beat_the_monkey" || currentMode === "beat_the_monkey" ? (
          <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <div style={{ fontSize:11, opacity:0.5, marginBottom:4 }}>Monkey Answer:</div>
            <div style={{ fontSize:13, marginBottom:10, opacity:0.7 }}>{roundContent.pair.monkeyAnswer}</div>
            <div style={{ fontSize:11, opacity:0.5, marginBottom:4 }}>Your Answer:</div>
            <div style={{ fontSize:13, marginBottom:10 }}>{transcript}</div>
            <div style={{ fontSize:14, fontWeight:800, color: evaluation.beatTheMonkey ? "#22c55e" : color }}>
              {evaluation.beatTheMonkey ? "You beat the monkey! 🎉" : "Great start. Add one more detail to beat the monkey."}
            </div>
          </div>
        ) : null}

        {evaluation.improvementTip && (
          <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:14, padding:"12px 14px", marginBottom:14, fontSize:12, lineHeight:1.6 }}>
            💡 {evaluation.improvementTip}
          </div>
        )}
        {evaluation.followUpQuestion && (
          <div style={{ background:`${color}18`, borderRadius:14, padding:"12px 14px", marginBottom:14, fontSize:12, lineHeight:1.6 }}>
            🐵 {evaluation.followUpQuestion}
          </div>
        )}

        <button onClick={nextRound} style={WELCOME_BTN_PRIMARY}>
          {roundIdx + 1 < roundSequence.length ? "Next Round →" : "See Results 🎉"}
        </button>
      </div>
    );
  }

  // subPhase === "play"
  return (
    <div style={{ padding:"18px 16px", height:"100%", overflowY:"auto", display:"flex", flexDirection:"column" }} className="slide-up">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
        <button onClick={onExit} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12, padding:"8px 14px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>✕</button>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:16, color }}>{GAME_MODES.find(m=>m.id===currentMode)?.icon} {GAME_MODES.find(m=>m.id===currentMode)?.label}</div>
        <div style={{ fontSize:11, opacity:0.5, marginLeft:"auto" }}>Round {roundIdx+1}/{roundSequence.length}</div>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <TalkingMonkey monkey={user.coach} state={monkeyState} speaking={isSpeaking} audioEl={lastAudioEl} size={54} />
        {caption && (
          <div style={{ flex:1, background:"rgba(255,255,255,0.05)", borderRadius:12, padding:"8px 12px", fontSize:12, lineHeight:1.5 }}>
            {caption}
            <div style={{ display:"flex", gap:10, marginTop:4 }}>
              <button onClick={replay} style={{ background:"none", border:"none", color:"#FFD700", fontSize:10, cursor:"pointer", padding:0 }}>🔁 Replay</button>
              <button onClick={() => setMuted(m => !m)} style={{ background:"none", border:"none", color:"#FFD700", fontSize:10, cursor:"pointer", padding:0 }}>{muted ? "🔇 Unmute" : "🔊 Mute"}</button>
            </div>
          </div>
        )}
      </div>

      {currentMode === "would_you_rather" && (
        choice === null ? (
          <div style={{ display:"flex", flexDirection:"column", gap:12, flex:1, justifyContent:"center" }}>
            <div style={{ fontSize:14, opacity:0.6, textAlign:"center", marginBottom:6 }}>Would you rather...</div>
            <button onClick={() => setChoice("a")} style={{ background:"linear-gradient(135deg,#4A90E830,#4A90E812)", border:"2px solid #4A90E8", borderRadius:18, padding:"22px 16px", color:"#fff", fontSize:16, fontWeight:800, cursor:"pointer" }}>{roundContent.pair.a}</button>
            <div style={{ textAlign:"center", fontSize:12, opacity:0.5 }}>or</div>
            <button onClick={() => setChoice("b")} style={{ background:"linear-gradient(135deg,#E84A8F30,#E84A8F12)", border:"2px solid #E84A8F", borderRadius:18, padding:"22px 16px", color:"#fff", fontSize:16, fontWeight:800, cursor:"pointer" }}>{roundContent.pair.b}</button>
          </div>
        ) : (
          <RecordingPanel
            promptLabel={`You chose: ${choice === "a" ? roundContent.pair.a : roundContent.pair.b}. Explain why!`}
            color={color} recording={recording} recorded={recorded} transcript={transcript} recTime={recTime}
            onStart={startRecording} onStop={stopRecording} setTranscript={setTranscript}
            onSubmit={() => submitRound({ chosenOption: choice === "a" ? roundContent.pair.a : roundContent.pair.b })}
          />
        )
      )}

      {currentMode === "category_rush" && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1, justifyContent:"center", gap:10 }}>
          <div style={{ fontSize:13, opacity:0.6 }}>Name things in this category:</div>
          <div style={{ fontSize:20, fontWeight:800, textAlign:"center", marginBottom:10 }}>{roundContent.category}</div>
          {!rushActive && !recorded && (
            <button onClick={startRush} style={WELCOME_BTN_PRIMARY}>Start! (30s)</button>
          )}
          {rushActive && (
            <>
              <div style={{ fontSize:32, fontWeight:900, color:"#FF6B9D" }}>{rushTimeLeft}s</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center", maxHeight:120, overflowY:"auto" }}>
                {rushCandidates.map((c, i) => <span key={i} style={{ background:"rgba(255,215,0,0.15)", borderRadius:99, padding:"5px 12px", fontSize:12 }}>{c}</span>)}
              </div>
            </>
          )}
          {recorded && (
            <>
              <div style={{ fontSize:13, opacity:0.6 }}>{rushCandidates.length} answers given</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center", maxHeight:120, overflowY:"auto", marginBottom:10 }}>
                {rushCandidates.map((c, i) => <span key={i} style={{ background:"rgba(255,215,0,0.15)", borderRadius:99, padding:"5px 12px", fontSize:12 }}>{c}</span>)}
              </div>
              <button onClick={() => submitRound()} style={WELCOME_BTN_PRIMARY}>Check My Answers →</button>
            </>
          )}
        </div>
      )}

      {currentMode === "answer_or_challenge" && (
        choice === null ? (
          <div style={{ display:"flex", flexDirection:"column", gap:12, flex:1, justifyContent:"center" }}>
            <button onClick={() => setChoice("answer")} style={{ background:"rgba(255,255,255,0.05)", border:"2px solid rgba(255,255,255,0.15)", borderRadius:18, padding:"18px 16px", color:"#fff", cursor:"pointer", textAlign:"left" }}>
              <div style={{ fontSize:11, opacity:0.5, marginBottom:6 }}>ANSWER</div>
              <div style={{ fontSize:14, fontWeight:700 }}>{roundContent.prompt}</div>
            </button>
            <button onClick={() => setChoice("challenge")} style={{ background:"linear-gradient(135deg,#FFD70030,#F5A62312)", border:"2px solid #FFD700", borderRadius:18, padding:"18px 16px", color:"#fff", cursor:"pointer", textAlign:"left" }}>
              <div style={{ fontSize:11, color:"#FFD700", marginBottom:6 }}>⭐ CHALLENGE (bonus points)</div>
              <div style={{ fontSize:13, opacity:0.8, marginBottom:6 }}>{roundContent.prompt}</div>
              <div style={{ fontSize:14, fontWeight:800 }}>{roundContent.challenge}</div>
            </button>
          </div>
        ) : (
          <RecordingPanel
            promptLabel={choice === "challenge" ? `${roundContent.prompt} — Challenge: ${roundContent.challenge}` : roundContent.prompt}
            color={color} recording={recording} recorded={recorded} transcript={transcript} recTime={recTime}
            onStart={startRecording} onStop={stopRecording} setTranscript={setTranscript}
            onSubmit={() => submitRound()}
          />
        )
      )}

      {currentMode === "beat_the_monkey" && (
        <div style={{ display:"flex", flexDirection:"column", flex:1 }}>
          <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <div style={{ fontSize:11, opacity:0.5, marginBottom:4 }}>{roundContent.pair.question}</div>
            <div style={{ fontSize:11, opacity:0.5, marginTop:8, marginBottom:4 }}>🐵 Monkey says:</div>
            <div style={{ fontSize:13, fontStyle:"italic" }}>"{roundContent.pair.monkeyAnswer}"</div>
          </div>
          <div style={{ fontSize:12, opacity:0.6, marginBottom:10, textAlign:"center" }}>Can you give a better answer?</div>
          <RecordingPanel
            promptLabel={null} color={color} recording={recording} recorded={recorded} transcript={transcript} recTime={recTime}
            onStart={startRecording} onStop={stopRecording} setTranscript={setTranscript}
            onSubmit={() => submitRound()}
          />
        </div>
      )}
    </div>
  );
}

// Shared mic-recording UI used by 3 of the 4 game modes (Category Rush has
// its own continuous-countdown recording flow, handled separately above).
function RecordingPanel({ promptLabel, color, recording, recorded, transcript, recTime, onStart, onStop, setTranscript, onSubmit }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1, justifyContent:"center", gap:8 }}>
      {promptLabel && <div style={{ fontSize:15, fontWeight:800, textAlign:"center", marginBottom:14, maxWidth:280 }}>{promptLabel}</div>}
      <button onClick={recording ? onStop : onStart} style={{
        width:90, height:90, borderRadius:"50%",
        background: recording ? "linear-gradient(135deg,#FF4444,#CC0000)" : `linear-gradient(135deg,${color},#F5A623)`,
        border: `4px solid ${recording ? "#FF666680" : color+"80"}`,
        cursor:"pointer", fontSize:36, marginBottom:12,
        boxShadow: recording ? "0 0 30px #FF444480, 0 0 60px #FF222240" : `0 8px 28px ${color}50`,
        animation: recording ? "pulse 1s ease infinite" : "none", transition:"all 0.3s"
      }}>{recording ? "⏹" : "🎤"}</button>
      <div style={{ fontSize:12, opacity:0.7, marginBottom:8 }}>
        {recording ? `🔴 Recording... ${recTime}s` : recorded ? "✅ Recorded!" : "Tap the mic to answer"}
      </div>
      {recorded && (
        <textarea value={transcript} onChange={e=>setTranscript(e.target.value)}
          placeholder="Your speech appears here. You can also type or edit..."
          style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(255,255,255,0.15)", borderRadius:16, padding:"13px", color:"#fff", fontSize:13, lineHeight:1.65, resize:"none", minHeight:70, marginBottom:10 }} />
      )}
      {recorded && <button onClick={onSubmit} style={{ ...WELCOME_BTN_PRIMARY, width:"100%" }}>Submit →</button>}
    </div>
  );
}

function MonkeyPartyResults({ summary, streak, onPlayAgain, onQuickMix, onPracticeSkill, onHome }) {
  const tier = resultTierForCount(summary.roundCount);
  return (
    <div style={{ padding:"22px 18px", height:"100%", overflowY:"auto", display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center" }} className="slide-up">
      <div style={{ fontSize:44, marginBottom:10 }}>🎉</div>
      <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:22, color:"#FFD700", marginBottom:6 }}>Session Complete!</div>
      <div style={{ fontSize:13, opacity:0.6, marginBottom:18 }}>{tier} tier · {summary.totalScore} points</div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, width:"100%", marginBottom:16 }}>
        <StatBox label="Rounds" value={summary.roundCount} />
        <StatBox label="Speaking Time" value={`${summary.speakingSeconds}s`} />
        <StatBox label="Bravery" value={summary.braveryAverage} />
        <StatBox label="Power" value={summary.powerAverage} />
        <StatBox label="Streak" value={`🔥 ${streak ?? 0}d`} />
        <StatBox label="Beat the Monkey" value={summary.beatMonkeyCount} />
      </div>

      {summary.strongestCategory && (
        <div style={{ fontSize:12, opacity:0.6, marginBottom:8 }}>Strongest topic: <b style={{color:"#FFD700"}}>{summary.strongestCategory}</b></div>
      )}
      {summary.bestRound?.evaluation?.improvementTip && (
        <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:14, padding:"12px 14px", marginBottom:18, fontSize:12, lineHeight:1.6, width:"100%" }}>
          🎯 Next goal: {summary.bestRound.evaluation.improvementTip}
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%" }}>
        <button onClick={onPlayAgain} style={WELCOME_BTN_PRIMARY}>Play Again</button>
        <button onClick={onQuickMix} style={WELCOME_BTN_SECONDARY}>Try Quick Mix</button>
        <button onClick={onPracticeSkill} style={WELCOME_BTN_SECONDARY}>Practice This Skill</button>
        <button onClick={onHome} style={WELCOME_BTN_SECONDARY}>Return to EIKEN Home</button>
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:12, padding:"10px 12px" }}>
      <div style={{ fontSize:18, fontWeight:800, color:"#FFD700" }}>{value}</div>
      <div style={{ fontSize:10, opacity:0.55, marginTop:2 }}>{label}</div>
    </div>
  );
}

function ComingSoonScreen({ title, message, onBack }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:32, textAlign:"center" }} className="slide-up">
      <div style={{ fontSize:48, marginBottom:14 }}>🐵</div>
      <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color:"#FFD700", marginBottom:10 }}>{title}</div>
      <div style={{ fontSize:13, opacity:0.6, maxWidth:260, lineHeight:1.7, marginBottom:26 }}>{message}</div>
      <button onClick={onBack} style={{ ...WELCOME_BTN_SECONDARY, maxWidth:220 }}>← Back</button>
    </div>
  );
}

function DashboardScreen({ user, onNavigate }) {
  const m = MONKEYS[user.coach];
  const phraseIdx = Math.floor(Date.now() / 8000) % m.phrases.length;

  return (
    <div style={{ padding:"18px 16px", overflowY:"auto", height:"100%" }}>
      {/* Top bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:18 }}>
        <div>
          <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:24, color:"#FFD700" }}>Hello! 👋</div>
          <div style={{ fontSize:12, opacity:0.55, marginTop:2 }}>{user.level} · {user.xp} XP earned</div>
        </div>
        <MonkeyImg monkey={user.coach} size={70} floating style={{ marginRight:-4 }} />
      </div>

      {/* Coach speech bubble */}
      <div style={{
        background:`linear-gradient(135deg,${m.color}18,${m.color}06)`,
        border:`1px solid ${m.color}30`, borderRadius:16, padding:"12px 15px", marginBottom:18,
        animation:"slideUp 0.4s ease"
      }}>
        <div style={{ fontSize:10, color:m.color, fontWeight:800, marginBottom:4 }}>{m.name} says:</div>
        <div style={{ fontSize:13, lineHeight:1.6, fontWeight:600 }}>"{m.phrases[phraseIdx]}"</div>
      </div>

      {/* Monkey Party card */}
      <button onClick={() => onNavigate("monkeyPartySetup")} style={{
        width:"100%", textAlign:"left", background:"linear-gradient(135deg,#FFD70022,#F5A62310)",
        border:"2px solid #FFD70055", borderRadius:20, padding:"16px", marginBottom:18,
        cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", gap:14,
        boxShadow:"0 6px 24px #FFD70020",
      }}>
        <div style={{ fontSize:44 }} className="float">🎉</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:17, color:"#FFD700" }}>Monkey Party</div>
          <div style={{ fontSize:11, opacity:0.6, marginBottom:6 }}>Fast speaking games for EIKEN confidence</div>
          <div style={{ display:"flex", gap:10, fontSize:10, opacity:0.65 }}>
            <span>{user.level}</span>
            <span>🔥 {user.monkeyPartyStreak ?? 0}d</span>
            <span>🏆 Best {user.monkeyPartyBest ?? 0}</span>
          </div>
        </div>
        <div style={{ background:"#FFD700", color:"#1a1000", borderRadius:99, padding:"9px 16px", fontSize:12, fontWeight:900, whiteSpace:"nowrap" }}>Play Now</div>
      </button>

      {/* XP */}
      <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:16, padding:"13px 15px", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
          <span style={{ fontSize:12, fontWeight:800 }}>🏆 Your Progress</span>
          <span style={{ fontSize:12, opacity:0.55 }}>{user.xp} / 200 XP</span>
        </div>
        <XPBar xp={user.xp} color={m.color} />
        <div style={{ fontSize:11, opacity:0.45, marginTop:6 }}>{200 - user.xp} XP until next level ✨</div>
      </div>

      {/* Stats row */}
      <div style={{ display:"flex", gap:9, marginBottom:18 }}>
        {[["🔥","Streak",`${user.streak}d`],["⭐","Stars",user.stars],["📚","Sessions",user.sessions]].map(([icon,label,val]) => (
          <div key={label} style={{ flex:1, background:"rgba(255,255,255,0.05)", borderRadius:14, padding:"11px 6px", textAlign:"center" }}>
            <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color:m.color }}>{val}</div>
            <div style={{ fontSize:10, opacity:0.55, marginTop:2 }}>{icon} {label}</div>
          </div>
        ))}
      </div>

      {/* Skill modules */}
      <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:18, marginBottom:11, color:"#FFD700" }}>Today's Practice</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        {MODULES.map(mod => {
          const mission = missionTheme(mod.id);
          return (
            <button key={mod.id} onClick={() => onNavigate("lesson",{module:mod.id})} style={{
              background:`linear-gradient(160deg,${mod.color}22,${mod.color}08)`,
              border:`1.5px solid ${mod.color}30`, borderRadius:18, padding:"16px 10px",
              cursor:"pointer", color:"#fff", textAlign:"center", transition:"all 0.2s",
            }}>
              <div style={{ fontSize:30, marginBottom:6 }}>{mission.icon}</div>
              <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:14, color:mod.color }}>{mission.name}</div>
              <div style={{ fontSize:10, opacity:0.55, marginTop:3, lineHeight:1.4 }}>{mod.label} · {mission.tagline}</div>
            </button>
          );
        })}
      </div>

      {/* Chat button — opens the platform-wide Global Jona Assistant
          (floating bubble, rendered once at EikenApp's root) rather than
          a separate in-app chat screen. One Jona across HSD OS AI. */}
      <button onClick={openGlobalJona} style={{
        width:"100%", background:`linear-gradient(135deg,${m.color}30,${m.color}12)`,
        border:`1.5px solid ${m.color}40`, borderRadius:16, padding:"14px", marginBottom:10,
        cursor:"pointer", color:"#fff", fontFamily:"'Fredoka One',cursive", fontSize:17,
        boxShadow:`0 4px 20px ${m.color}20`, display:"flex", alignItems:"center", justifyContent:"center", gap:10
      }}>
        <MonkeyImg monkey={user.coach} size={32} />
        Chat with Jona
      </button>

      {/* Interview Island button */}
      <button onClick={() => onNavigate("interview")} style={{
        width:"100%", background:"linear-gradient(135deg,#FFD70030,#F5A62312)",
        border:"1.5px solid #FFD70040", borderRadius:16, padding:"14px", marginBottom:10,
        cursor:"pointer", color:"#fff", fontFamily:"'Fredoka One',cursive", fontSize:17,
        boxShadow:"0 4px 20px #FFD70020", display:"flex", alignItems:"center", justifyContent:"center", gap:10
      }}>
        🏝️ Interview Island
      </button>

      {/* Mock Test button */}
      <button onClick={() => onNavigate("mocktest")} style={{
        width:"100%", background:"linear-gradient(135deg,#FF6B9D30,#FF6B9D12)",
        border:"1.5px solid #FF6B9D40", borderRadius:16, padding:"14px",
        cursor:"pointer", color:"#fff", fontFamily:"'Fredoka One',cursive", fontSize:17,
        boxShadow:"0 4px 20px #FF6B9D20", display:"flex", alignItems:"center", justifyContent:"center", gap:10
      }}>
        🏆 Treasure Challenge (Mock Test)
      </button>
    </div>
  );
}

// ─── SHARED: FEEDBACK RESULT ─────────────────────────────────────────────────
function FeedbackResult({ score, feedback, modColor, coachId, uid, onNext, onBack, nextLabel = "Next Question →" }) {
  useEffect(() => {
    if (feedback?.praise) {
      speakElevenLabs(feedback.praise, {}, uid);
    }
  }, [feedback, uid]);
  return (
    <div className="slide-up" style={{ display:"flex", flexDirection:"column" }}>
      <div style={{ textAlign:"center", marginBottom:10 }}>
        <MonkeyImg monkey={coachId} size={80} floating />
      </div>
      <div style={{ marginBottom:14 }}><StarRating score={score} /></div>
      {[
        { icon:"🎉", label:"Great job!",   text: feedback.praise,     color:"#FFD700" },
        { icon:"💡", label:"Tip:",          text: feedback.tip,        color: modColor },
        { icon:"✍️", label:"Better version:", text: feedback.correction, color:"#4CAF7D" },
      ].map(card => (
        <div key={card.label} style={{ background:`${card.color}14`, border:`1px solid ${card.color}30`, borderRadius:14, padding:"11px 13px", marginBottom:9 }}>
          <div style={{ fontSize:11, color:card.color, fontWeight:800, marginBottom:4 }}>{card.icon} {card.label}</div>
          <div style={{ fontSize:13, lineHeight:1.6 }}>{card.text}</div>
        </div>
      ))}
      <div style={{ display:"flex", gap:10, marginTop:20, paddingTop:10 }}>
        <button onClick={onNext} style={{ flex:2, background:`linear-gradient(135deg,${modColor},${modColor}bb)`, border:"none", borderRadius:14, padding:"13px", color:"#fff", fontSize:14, fontWeight:900, cursor:"pointer", boxShadow:`0 4px 16px ${modColor}40` }}>{nextLabel}</button>
        <button onClick={onBack} style={{ flex:1, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:14, padding:"13px", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>Done</button>
      </div>
    </div>
  );
}

// ─── LISTENING MODULE ─────────────────────────────────────────────────────────
function ListeningLesson({ user, plan, uid, onBack, onXP }) {
  const m = MONKEYS[user.coach];
  const color = "#4A90E8";
  const bank = LISTENING_BANK[user.level] || LISTENING_BANK["Pre-2"];
  const [idx, setIdx]           = useState(() => Math.floor(Math.random() * bank.length));
  const [phase, setPhase]       = useState("intro");
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [showCaption, setShowCaption] = useState(false);

  const q = bank[idx];

  const playScript = useCallback(() => {
    if (speaking) { window.speechSynthesis?.cancel(); setSpeaking(false); return; }
    speakElevenLabs(q.script, {
      onStart: () => setSpeaking(true),
      onEnd:   () => setSpeaking(false),
    }, uid);
  }, [q, speaking, uid]);

  const submit = useCallback(async () => {
    if (selected === null) return;
    setSubmitted(true);
    setLoading(true);
    const isCorrect = selected === q.answer;
    try {
      const { content } = await askJonathan({
        taskType: "evaluate_answer",
        system:`You are Jonathan AI, a friendly EIKEN teacher. Give short encouraging feedback on a listening answer. Respond ONLY as JSON (no markdown): {"score":1-5,"praise":"one sentence","tip":"one listening tip","correction":"explain why the correct answer is '${q.choices[q.answer]}'"}`,
        messages:[{role:"user", content:`The student chose "${q.choices[selected]}". The correct answer is "${q.choices[q.answer]}". Correct: ${isCorrect}`}],
        user: { plan },
      });
      const parsed = JSON.parse((content || "{}").replace(/```json|```/g,"").trim());
      setFeedback(parsed);
      onXP(isCorrect ? 40 : 15);
    } catch {
      setFeedback({ score: isCorrect?4:2, praise: isCorrect?"Correct! Well done!":"Good try!", tip:"Listen for key words.", correction:`The correct answer is "${q.choices[q.answer]}".` });
      onXP(isCorrect ? 40 : 15);
    }
    setLoading(false);
    setPhase("result");
  }, [selected, q, m, onXP]);

  const next = () => {
    const nextIdx = Math.floor(Math.random() * bank.length);
    setIdx(nextIdx); setPhase("question"); setSelected(null); setSubmitted(false); setFeedback(null); setShowCaption(false);
  };

  return (
    <div style={{ padding:"18px 16px", height:"100%", overflowY:"auto", display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12, padding:"8px 14px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>←</button>
        <div><div style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color }}>👂 Listening</div><div style={{ fontSize:11, opacity:0.55 }}>{user.level}</div></div>
        <MonkeyImg monkey={user.coach} size={40} floating style={{ marginLeft:"auto" }} />
      </div>

      {phase === "intro" && (
        <div className="slide-up" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", minHeight:"70%" }}>
          <MonkeyImg monkey={user.coach} size={110} floating />
          <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:24, color, margin:"16px 0 8px" }}>Listen carefully!</div>
          <div style={{ fontSize:13, opacity:0.65, maxWidth:260, lineHeight:1.7, marginBottom:32 }}>
            Press play to hear a short passage, then answer the question. You can listen as many times as you need!
          </div>
          <button onClick={() => setPhase("question")} style={{ background:`linear-gradient(135deg,${color},${color}99)`, border:"none", borderRadius:99, padding:"13px 40px", color:"#fff", fontSize:17, fontWeight:900, cursor:"pointer", boxShadow:`0 8px 24px ${color}45` }}>Let's Listen! →</button>
        </div>
      )}

      {phase === "question" && (
        <div className="slide-up" style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {/* Audio player */}
          <div style={{ background:`linear-gradient(135deg,${color}22,${color}08)`, border:`1.5px solid ${color}35`, borderRadius:20, padding:"18px 16px", marginBottom:16, textAlign:"center" }}>
            <div style={{ fontSize:11, color, fontWeight:800, marginBottom:10 }}>🎧 AUDIO PASSAGE</div>
            <button onClick={playScript} style={{
              background: speaking ? `${color}40` : `linear-gradient(135deg,${color},${color}bb)`,
              border:`2px solid ${color}`, borderRadius:99, padding:"12px 28px",
              color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer",
              boxShadow: speaking ? `0 0 20px ${color}80` : `0 4px 16px ${color}40`,
              display:"flex", alignItems:"center", gap:10, margin:"0 auto",
              animation: speaking ? "pulse 1s ease infinite" : "none"
            }}>
              {speaking ? "🔊 Playing..." : "▶ Play"}
            </button>
            <div style={{ fontSize:11, opacity:0.5, marginTop:10 }}>Tap play to listen again</div>
            <button onClick={() => setShowCaption(v => !v)} style={{ background:"none", border:"none", color, fontSize:11, fontWeight:700, cursor:"pointer", marginTop:8, textDecoration:"underline" }}>
              {showCaption ? "Hide captions" : "📝 Show captions"}
            </button>
            {showCaption && (
              <div style={{ marginTop:10, padding:"10px 12px", background:"rgba(255,255,255,0.05)", borderRadius:12, fontSize:12, lineHeight:1.6, textAlign:"left" }}>{q.script}</div>
            )}
          </div>

          {/* Question */}
          <div style={{ fontSize:14, fontWeight:800, marginBottom:12, lineHeight:1.5 }}>{q.question}</div>

          {/* Choices */}
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            {q.choices.map((choice, i) => (
              <button key={i} onClick={() => !submitted && setSelected(i)} style={{
                background: selected===i ? `${color}30` : "rgba(255,255,255,0.05)",
                border: `2px solid ${selected===i ? color : "rgba(255,255,255,0.1)"}`,
                borderRadius:14, padding:"12px 16px", color:"#fff", cursor: submitted?"default":"pointer",
                fontSize:14, textAlign:"left", fontWeight: selected===i ? 800 : 600,
                transition:"all 0.2s"
              }}>
                <span style={{ color, fontWeight:900, marginRight:8 }}>{String.fromCharCode(65+i)}.</span>{choice}
              </button>
            ))}
          </div>

          <button onClick={submit} disabled={selected===null || loading} style={{
            marginTop:14, background: selected!==null ? `linear-gradient(135deg,${color},${color}bb)` : "rgba(255,255,255,0.07)",
            border:"none", borderRadius:14, padding:"13px", color:"#fff", fontSize:15, fontWeight:900,
            cursor: selected!==null?"pointer":"not-allowed", boxShadow: selected!==null?`0 4px 16px ${color}40`:"none"
          }}>{loading ? "Checking... 🐵" : "Check Answer ✓"}</button>
        </div>
      )}

      {phase === "result" && feedback && (
        <FeedbackResult score={feedback.score} feedback={feedback} modColor={color} coachId={user.coach} uid={uid} onNext={next} onBack={onBack} />
      )}
    </div>
  );
}

// ─── READING MODULE ───────────────────────────────────────────────────────────
function ReadingLesson({ user, plan, uid, onBack, onXP }) {
  const m = MONKEYS[user.coach];
  const color = "#E84A8F";
  const bank = READING_BANK[user.level] || READING_BANK["Pre-2"];
  const [idx, setIdx]           = useState(() => Math.floor(Math.random() * bank.length));
  const [phase, setPhase]       = useState("intro");
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading]   = useState(false);

  const q = bank[idx];

  const submit = useCallback(async () => {
    if (selected === null) return;
    setLoading(true);
    const isCorrect = selected === q.answer;
    try {
      const { content } = await askJonathan({
        taskType: "evaluate_answer",
        system:`You are Jonathan AI, a friendly EIKEN teacher. Respond ONLY as JSON: {"score":1-5,"praise":"one sentence","tip":"one reading comprehension tip","correction":"brief explanation of why '${q.choices[q.answer]}' is correct"}`,
        messages:[{role:"user", content:`Passage: "${q.passage}" Question: "${q.question}" Student chose: "${q.choices[selected]}", correct is: "${q.choices[q.answer]}". Correct: ${isCorrect}`}],
        user: { plan },
      });
      const parsed = JSON.parse((content || "{}").replace(/```json|```/g,"").trim());
      setFeedback(parsed);
      onXP(isCorrect ? 40 : 15);
    } catch {
      setFeedback({ score:isCorrect?4:2, praise:isCorrect?"Correct!":"Good try!", tip:"Re-read carefully for key details.", correction:`The answer is "${q.choices[q.answer]}".` });
      onXP(isCorrect ? 40 : 15);
    }
    setLoading(false);
    setPhase("result");
  }, [selected, q, m, onXP]);

  const next = () => { setIdx(Math.floor(Math.random() * bank.length)); setPhase("question"); setSelected(null); setFeedback(null); };

  return (
    <div style={{ padding:"18px 16px", height:"100%", overflowY:"auto", display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12, padding:"8px 14px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>←</button>
        <div><div style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color }}>📖 Reading</div><div style={{ fontSize:11, opacity:0.55 }}>{user.level}</div></div>
        <MonkeyImg monkey={user.coach} size={40} floating style={{ marginLeft:"auto" }} />
      </div>

      {phase === "intro" && (
        <div className="slide-up" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", minHeight:"70%" }}>
          <MonkeyImg monkey={user.coach} size={110} floating />
          <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:24, color, margin:"16px 0 8px" }}>Read carefully!</div>
          <div style={{ fontSize:13, opacity:0.65, maxWidth:260, lineHeight:1.7, marginBottom:32 }}>Read the passage and answer the comprehension question. Take your time!</div>
          <button onClick={() => setPhase("question")} style={{ background:`linear-gradient(135deg,${color},${color}99)`, border:"none", borderRadius:99, padding:"13px 40px", color:"#fff", fontSize:17, fontWeight:900, cursor:"pointer" }}>Start Reading →</button>
        </div>
      )}

      {phase === "question" && (
        <div className="slide-up" style={{ display:"flex", flexDirection:"column" }}>
          {/* Passage */}
          <div style={{ background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(255,255,255,0.12)", borderRadius:18, padding:"16px", marginBottom:14, lineHeight:1.8, fontSize:14 }}>
            <div style={{ fontSize:10, color, fontWeight:800, marginBottom:8 }}>📄 PASSAGE</div>
            {q.passage}
          </div>
          {/* Question */}
          <div style={{ fontSize:14, fontWeight:800, marginBottom:12 }}>{q.question}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            {q.choices.map((choice, i) => (
              <button key={i} onClick={() => setSelected(i)} style={{
                background: selected===i ? `${color}30` : "rgba(255,255,255,0.05)",
                border:`2px solid ${selected===i ? color : "rgba(255,255,255,0.1)"}`,
                borderRadius:14, padding:"12px 16px", color:"#fff", cursor:"pointer",
                fontSize:14, textAlign:"left", fontWeight:selected===i?800:600, transition:"all 0.2s"
              }}>
                <span style={{ color, fontWeight:900, marginRight:8 }}>{String.fromCharCode(65+i)}.</span>{choice}
              </button>
            ))}
          </div>
          <button onClick={submit} disabled={selected===null||loading} style={{
            marginTop:14, background:selected!==null?`linear-gradient(135deg,${color},${color}bb)`:"rgba(255,255,255,0.07)",
            border:"none", borderRadius:14, padding:"13px", color:"#fff", fontSize:15, fontWeight:900,
            cursor:selected!==null?"pointer":"not-allowed"
          }}>{loading?"Checking... 🐵":"Check Answer ✓"}</button>
        </div>
      )}

      {phase === "result" && feedback && (
        <FeedbackResult score={feedback.score} feedback={feedback} modColor={color} coachId={user.coach} uid={uid} onNext={next} onBack={onBack} />
      )}
    </div>
  );
}

// ─── SPEAKING MODULE ──────────────────────────────────────────────────────────
function SpeakingLesson({ user, plan, uid, onBack, onXP }) {
  const m = MONKEYS[user.coach];
  const color = "#F5C623";
  const bank = SPEAKING_BANK[user.level] || SPEAKING_BANK["Pre-2"];
  const [idx, setIdx]           = useState(() => Math.floor(Math.random() * bank.length));
  const [phase, setPhase]       = useState("intro");
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [recTime, setRecTime]   = useState(0);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  const question = bank[idx];

  // Read the speaking question aloud when phase changes to "question"
  useEffect(() => {
    if (phase === "question") {
      speakElevenLabs(question, {}, uid);
    }
  }, [phase, question, uid]);

  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTranscript("(Speech recognition not available in this browser. Please type your answer below.)");
      setRecorded(true);
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "en-US"; rec.continuous = true; rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e) => {
      finalText = Array.from(e.results).map(r => r[0].transcript).join(" ");
      setTranscript(finalText);
    };
    rec.onend = () => { setRecording(false); setRecorded(true); if (finalText) setTranscript(finalText); };
    rec.start();
    recognitionRef.current = rec;
    setRecording(true);
    setRecTime(0);
    timerRef.current = setInterval(() => setRecTime(t => t+1), 1000);
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
    setRecorded(true);
  }, []);

  const submit = useCallback(async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    try {
      const { content } = await askJonathan({
        taskType: "evaluate_answer",
        system:`You are Jonathan AI, an EIKEN speaking teacher for Japanese students at ${user.level} level. Evaluate the spoken answer for fluency, vocabulary, grammar, and content. Respond ONLY as JSON: {"score":1-5,"praise":"specific encouragement","tip":"one specific speaking improvement tip","correction":"show a model answer for this question"}`,
        messages:[{role:"user", content:`Speaking question: "${question}"\nStudent said: "${transcript}"`}],
        user: { plan },
      });
      const parsed = JSON.parse((content || "{}").replace(/```json|```/g,"").trim());
      setFeedback(parsed);
      onXP((parsed.score||3)*12);
    } catch {
      setFeedback({ score:3, praise:"Good speaking effort!", tip:"Speak clearly and use full sentences.", correction:`A model answer: "I think ${question.toLowerCase().replace("?","")} because it helps me learn and grow."` });
      onXP(30);
    }
    setLoading(false);
    setPhase("result");
  }, [transcript, question, m, user, onXP]);

  const next = () => { setIdx(Math.floor(Math.random()*bank.length)); setPhase("question"); setTranscript(""); setRecorded(false); setFeedback(null); };

  return (
    <div style={{ padding:"18px 16px", height:"100%", overflowY:"auto", display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12, padding:"8px 14px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>←</button>
        <div><div style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color }}>🎤 Speaking</div><div style={{ fontSize:11, opacity:0.55 }}>{user.level}</div></div>
        <MonkeyImg monkey={user.coach} size={40} floating style={{ marginLeft:"auto" }} />
      </div>

      {phase === "intro" && (
        <div className="slide-up" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", minHeight:"70%" }}>
          <MonkeyImg monkey={user.coach} size={110} floating />
          <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:24, color, margin:"16px 0 8px" }}>Speak up!</div>
          <div style={{ fontSize:13, opacity:0.65, maxWidth:260, lineHeight:1.7, marginBottom:32 }}>
            Read the question, then tap the microphone to record your answer. Speak clearly in English!
          </div>
          <button onClick={() => setPhase("question")} style={{ background:`linear-gradient(135deg,${color},${color}99)`, border:"none", borderRadius:99, padding:"13px 40px", color:"#1a1000", fontSize:17, fontWeight:900, cursor:"pointer" }}>Let's Speak! →</button>
        </div>
      )}

      {phase === "question" && (
        <div className="slide-up" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
          {/* Question card */}
          <div style={{ width:"100%", background:`linear-gradient(135deg,${color}22,${color}08)`, border:`1.5px solid ${color}35`, borderRadius:20, padding:"18px 16px", marginBottom:20, textAlign:"center" }}>
            <div style={{ fontSize:10, color, fontWeight:800, marginBottom:8 }}>🗣️ SPEAKING QUESTION</div>
            <div style={{ fontSize:16, fontWeight:800, lineHeight:1.6 }}>{question}</div>
          </div>

          {/* Mic button */}
          <button onClick={recording ? stopRecording : startRecording} style={{
            width:90, height:90, borderRadius:"50%",
            background: recording ? "linear-gradient(135deg,#FF4444,#CC0000)" : `linear-gradient(135deg,${color},${color}bb)`,
            border: `4px solid ${recording?"#FF666680":color+"80"}`,
            cursor:"pointer", fontSize:36, marginBottom:12,
            boxShadow: recording ? "0 0 30px #FF444480, 0 0 60px #FF222240" : `0 8px 28px ${color}50`,
            animation: recording ? "pulse 1s ease infinite" : "none", transition:"all 0.3s"
          }}>{recording ? "⏹" : "🎤"}</button>

          <div style={{ fontSize:12, opacity:0.7, marginBottom:16 }}>
            {recording ? `🔴 Recording... ${recTime}s — tap to stop` : recorded ? "✅ Recorded! Review below." : "Tap to start recording"}
          </div>

          {/* Transcript box */}
          {recorded && (
            <textarea value={transcript} onChange={e=>setTranscript(e.target.value)}
              placeholder="Your speech appears here. You can also type or edit..."
              style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(255,255,255,0.15)", borderRadius:16, padding:"13px", color:"#fff", fontSize:13, lineHeight:1.65, resize:"none", fontFamily:"'Nunito',sans-serif", minHeight:80, marginBottom:14 }} />
          )}

          {recorded && (
            <button onClick={submit} disabled={!transcript.trim()||loading} style={{
              width:"100%", background:`linear-gradient(135deg,${color},${color}bb)`, border:"none", borderRadius:14, padding:"13px", color:"#1a1000", fontSize:15, fontWeight:900, cursor:"pointer", boxShadow:`0 4px 16px ${color}40`
            }}>{loading?`🐵 ${m.name} is listening...`:"Get Feedback ✓"}</button>
          )}
        </div>
      )}

      {phase === "result" && feedback && (
        <FeedbackResult score={feedback.score} feedback={feedback} modColor={color} coachId={user.coach} uid={uid} onNext={next} onBack={onBack} />
      )}
    </div>
  );
}

// ─── GENERIC MCQ LESSON (shared shell — used by Vocabulary & Grammar) ───────
// A single reusable component for simple {question, choices, answer} content,
// rather than forking ReadingLesson/ListeningLesson's inline pattern again —
// the shared-shell principle Phase 5 introduces for new lesson types.
function MCQLesson({ bank, moduleId, color, icon, title, introText, evalHint, user, plan, uid, onBack, onXP }) {
  const items = bank[user.level] || bank[LEVELS[0]];
  const [idx, setIdx]           = useState(() => Math.floor(Math.random() * items.length));
  const [phase, setPhase]       = useState("intro");
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading]   = useState(false);

  const q = items[idx];

  const submit = useCallback(async () => {
    if (selected === null) return;
    setLoading(true);
    const isCorrect = selected === q.answer;
    try {
      const { content } = await askJonathan({
        taskType: "evaluate_answer",
        system: `You are Jonathan AI, a friendly EIKEN teacher. Give short encouraging feedback on a ${title.toLowerCase()} answer. Respond ONLY as JSON: {"score":1-5,"praise":"one sentence","tip":"${evalHint}","correction":"explain why '${q.choices[q.answer]}' is correct"}`,
        messages: [{ role: "user", content: `Question: "${q.question}" Student chose: "${q.choices[selected]}", correct is: "${q.choices[q.answer]}". Correct: ${isCorrect}` }],
        user: { plan },
      });
      const parsed = JSON.parse((content || "{}").replace(/```json|```/g, "").trim());
      setFeedback(parsed);
      onXP(isCorrect ? 40 : 15);
    } catch {
      setFeedback({ score: isCorrect ? 4 : 2, praise: isCorrect ? "Correct!" : "Good try!", tip: evalHint, correction: `The answer is "${q.choices[q.answer]}".` });
      onXP(isCorrect ? 40 : 15);
    }
    setLoading(false);
    setPhase("result");
  }, [selected, q, plan, onXP]);

  const next = () => { setIdx(Math.floor(Math.random() * items.length)); setPhase("question"); setSelected(null); setFeedback(null); };

  return (
    <div style={{ padding:"18px 16px", height:"100%", overflowY:"auto", display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12, padding:"8px 14px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>←</button>
        <div><div style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color }}>{icon} {title}</div><div style={{ fontSize:11, opacity:0.55 }}>{user.level}</div></div>
        <MonkeyImg monkey={user.coach} size={40} floating style={{ marginLeft:"auto" }} />
      </div>

      {phase === "intro" && (
        <div className="slide-up" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", minHeight:"70%" }}>
          <MonkeyImg monkey={user.coach} size={110} floating />
          <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:24, color, margin:"16px 0 8px" }}>{title} time!</div>
          <div style={{ fontSize:13, opacity:0.65, maxWidth:260, lineHeight:1.7, marginBottom:32 }}>{introText}</div>
          <button onClick={() => setPhase("question")} style={{ background:`linear-gradient(135deg,${color},${color}99)`, border:"none", borderRadius:99, padding:"13px 40px", color:"#fff", fontSize:17, fontWeight:900, cursor:"pointer" }}>Let's Go →</button>
        </div>
      )}

      {phase === "question" && (
        <div className="slide-up" style={{ display:"flex", flexDirection:"column" }}>
          <div style={{ fontSize:15, fontWeight:800, marginBottom:14 }}>{q.question}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            {q.choices.map((choice, i) => (
              <button key={i} onClick={() => setSelected(i)} style={{
                background: selected===i ? `${color}30` : "rgba(255,255,255,0.05)",
                border:`2px solid ${selected===i ? color : "rgba(255,255,255,0.1)"}`,
                borderRadius:14, padding:"12px 16px", color:"#fff", cursor:"pointer",
                fontSize:14, textAlign:"left", fontWeight:selected===i?800:600, transition:"all 0.2s"
              }}>
                <span style={{ color, fontWeight:900, marginRight:8 }}>{String.fromCharCode(65+i)}.</span>{choice}
              </button>
            ))}
          </div>
          <button onClick={submit} disabled={selected===null||loading} style={{
            marginTop:14, background:selected!==null?`linear-gradient(135deg,${color},${color}bb)`:"rgba(255,255,255,0.07)",
            border:"none", borderRadius:14, padding:"13px", color:"#fff", fontSize:15, fontWeight:900,
            cursor:selected!==null?"pointer":"not-allowed"
          }}>{loading?"Checking... 🐵":"Check Answer ✓"}</button>
        </div>
      )}

      {phase === "result" && feedback && (
        <FeedbackResult score={feedback.score} feedback={feedback} modColor={color} coachId={user.coach} uid={uid} onNext={next} onBack={onBack} />
      )}
    </div>
  );
}

// ─── WRITING MODULE ───────────────────────────────────────────────────────────
function WritingLesson({ user, plan, uid, onBack, onXP }) {
  const m = MONKEYS[user.coach];
  const color = "#4CAF7D";
  const bank = WRITING_BANK[user.level] || WRITING_BANK["Pre-2"];
  const [idx, setIdx]     = useState(() => Math.floor(Math.random() * bank.length));
  const [phase, setPhase] = useState("intro");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading]   = useState(false);

  const task = bank[idx];
  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const targetMet = wordCount >= task.target;

  const submit = useCallback(async () => {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const { content } = await askJonathan({
        taskType: "evaluate_answer",
        system:`You are Jonathan AI, an EIKEN writing teacher for Japanese students at ${user.level} level. Evaluate the writing for content, vocabulary, grammar, and organisation. Target word count: ${task.target}. Task type: ${task.type}. Respond ONLY as JSON: {"score":1-5,"praise":"specific praise about their writing","tip":"one specific writing improvement","correction":"show one improved sentence or paragraph from their text"}`,
        messages:[{role:"user", content:`Writing task: "${task.prompt}"\nStudent wrote: "${answer}"`}],
        user: { plan },
      });
      const parsed = JSON.parse((content || "{}").replace(/```json|```/g,"").trim());
      setFeedback(parsed);
      onXP((parsed.score||3)*15);
    } catch {
      setFeedback({ score:3, praise:"Good writing effort!", tip:"Try to use more varied vocabulary.", correction:"Check your grammar and spelling carefully." });
      onXP(30);
    }
    setLoading(false);
    setPhase("result");
  }, [answer, task, m, user, onXP]);

  const next = () => { setIdx(Math.floor(Math.random()*bank.length)); setPhase("question"); setAnswer(""); setFeedback(null); };

  return (
    <div style={{ padding:"18px 16px", height:"100%", overflowY:"auto", display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12, padding:"8px 14px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>←</button>
        <div><div style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color }}>✏️ Writing</div><div style={{ fontSize:11, opacity:0.55 }}>{user.level}</div></div>
        <MonkeyImg monkey={user.coach} size={40} floating style={{ marginLeft:"auto" }} />
      </div>

      {phase === "intro" && (
        <div className="slide-up" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", minHeight:"70%" }}>
          <MonkeyImg monkey={user.coach} size={110} floating />
          <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:24, color, margin:"16px 0 8px" }}>Time to write!</div>
          <div style={{ fontSize:13, opacity:0.65, maxWidth:260, lineHeight:1.7, marginBottom:32 }}>
            Read the task carefully and write your best answer. Aim for the target word count!
          </div>
          <button onClick={() => setPhase("question")} style={{ background:`linear-gradient(135deg,${color},${color}99)`, border:"none", borderRadius:99, padding:"13px 40px", color:"#fff", fontSize:17, fontWeight:900, cursor:"pointer" }}>Start Writing →</button>
        </div>
      )}

      {phase === "question" && (
        <div className="slide-up" style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {/* Task card */}
          <div style={{ background:`linear-gradient(135deg,${color}22,${color}08)`, border:`1.5px solid ${color}35`, borderRadius:18, padding:"15px 15px", marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ fontSize:10, color, fontWeight:800 }}>✍️ {task.type.toUpperCase()} TASK</span>
              <span style={{ fontSize:10, background:`${color}30`, color, borderRadius:99, padding:"2px 10px", fontWeight:800 }}>Target: ~{task.target} words</span>
            </div>
            <div style={{ fontSize:14, fontWeight:700, lineHeight:1.6 }}>{task.prompt}</div>
          </div>

          {/* Writing area */}
          <textarea value={answer} onChange={e=>setAnswer(e.target.value)}
            placeholder="Write your answer here..."
            style={{ background:"rgba(255,255,255,0.06)", border:`1.5px solid ${targetMet?color:"rgba(255,255,255,0.12)"}`, borderRadius:16, padding:"14px", color:"#fff", fontSize:14, lineHeight:1.7, resize:"none", fontFamily:"'Nunito',sans-serif", marginBottom:10, minHeight:160, transition:"border-color 0.3s" }} />

          {/* Word counter */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontSize:12, color: targetMet ? color : "rgba(255,255,255,0.5)", fontWeight:700 }}>
              {wordCount} / {task.target} words {targetMet ? "✓" : ""}
            </span>
            <span style={{ fontSize:11, opacity:0.45 }}>AI will give personalised feedback</span>
          </div>

          <button onClick={submit} disabled={!answer.trim()||loading} style={{
            background:answer.trim()?`linear-gradient(135deg,${color},${color}bb)`:"rgba(255,255,255,0.07)",
            border:"none", borderRadius:14, padding:"13px", color:"#fff", fontSize:15, fontWeight:900,
            cursor:answer.trim()?"pointer":"not-allowed", boxShadow:answer.trim()?`0 4px 16px ${color}40`:"none"
          }}>{loading?`🐵 ${m.name} is reading...`:"Submit Writing ✓"}</button>
        </div>
      )}

      {phase === "result" && feedback && (
        <FeedbackResult score={feedback.score} feedback={feedback} modColor={color} coachId={user.coach} uid={uid} onNext={next} onBack={onBack} nextLabel="Next Task →" />
      )}
    </div>
  );
}

// ─── LESSON ROUTER ────────────────────────────────────────────────────────────
function LessonScreen({ user, plan, uid, moduleId, onBack, onXP }) {
  if (moduleId === "listen") return <ListeningLesson user={user} plan={plan} uid={uid} onBack={onBack} onXP={onXP} />;
  if (moduleId === "read")   return <ReadingLesson   user={user} plan={plan} uid={uid} onBack={onBack} onXP={onXP} />;
  if (moduleId === "speak")  return <SpeakingLesson  user={user} plan={plan} uid={uid} onBack={onBack} onXP={onXP} />;
  if (moduleId === "write")  return <WritingLesson   user={user} plan={plan} uid={uid} onBack={onBack} onXP={onXP} />;
  if (moduleId === "vocab") return (
    <MCQLesson bank={VOCABULARY_BANK} moduleId="vocab" color="#9B6CE8" icon="🔤" title="Vocabulary"
      introText="Test your word power! Pick the correct meaning for each word." evalHint="one vocabulary tip"
      user={user} plan={plan} uid={uid} onBack={onBack} onXP={onXP} />
  );
  if (moduleId === "grammar") return (
    <MCQLesson bank={GRAMMAR_BANK} moduleId="grammar" color="#3FBFA0" icon="🌉" title="Grammar"
      introText="Cross the grammar bridge! Choose the word that completes each sentence." evalHint="one grammar tip"
      user={user} plan={plan} uid={uid} onBack={onBack} onXP={onXP} />
  );
  return null;
}

// ─── SCREEN: CHAT ─────────────────────────────────────────────────────────────
// ─── SCREEN: INTERVIEW SIMULATOR (Interview Island) ──────────────────────────
const INTERVIEW_TURNS = 4;

function InterviewSimulator({ user, plan, uid, onBack, onXP }) {
  const bank = SPEAKING_BANK[user.level] || SPEAKING_BANK[LEVELS[0]];
  const [opening] = useState(() => bank[Math.floor(Math.random() * bank.length)]);
  const [messages, setMessages] = useState([
    { role: "assistant", text: `Hi, I'm Jonathan AI — I'll be your interview examiner today. There's no need to be nervous, this is just practice! Let's begin: ${opening}` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [phase, setPhase] = useState("interview"); // interview | wrapup | done
  const [wrapup, setWrapup] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (turnCount < INTERVIEW_TURNS || phase !== "interview") return;
    setPhase("wrapup");
    (async () => {
      const transcript = messages.map(m => `${m.role === "assistant" ? "Examiner" : "Student"}: ${m.text}`).join("\n");
      const { content } = await askJonathan({
        taskType: "explain",
        system: buildEvaluationSystemPrompt(
          `A student just finished a short practice EIKEN interview at ${user.level} level. Look at the whole conversation and give a warm wrap-up.`,
          { tipLabel: "one specific way to build interview confidence next time", correctionLabel: "a short model phrase they could use next time" }
        ),
        messages: [{ role: "user", content: transcript }],
        user: { plan },
      });
      try {
        setWrapup(JSON.parse((content || "{}").replace(/```json|```/g, "").trim()));
      } catch {
        setWrapup(fallbackFeedback(true, ""));
      }
      onXP(60);
      setPhase("done");
    })();
  }, [turnCount, phase]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || phase !== "interview") return;
    setInput("");
    const newMsgs = [...messages, { role: "user", text }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const history = newMsgs.map(msg => ({ role: msg.role === "assistant" ? "assistant" : "user", content: msg.text }));
      const { content: reply } = await askJonathan({
        taskType: "interview_followup",
        system: `You are Jonathan AI, acting as a friendly EIKEN interview examiner for a student at ${user.level} level. Ask ONE natural follow-up question building on their last answer — the way a real (but kind) EIKEN interviewer would. Keep it to 1-2 short sentences. Weave in brief encouragement naturally; never say "wrong."`,
        messages: history,
        user: { plan },
      });
      const finalReply = reply || "That's great — tell me a bit more!";
      setMessages(prev => [...prev, { role: "assistant", text: finalReply }]);
      speakElevenLabs(finalReply, {}, uid);
      setTurnCount(c => c + 1);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Sorry, I had a small hiccup — could you say that again?" }]);
    }
    setLoading(false);
  }, [input, messages, loading, phase, user, plan, uid]);

  const handleKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  if (phase === "done" && wrapup) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:32, textAlign:"center" }} className="slide-up">
        <div style={{ fontSize:44, marginBottom:12 }}>🏝️</div>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:20, color:"#FFD700", marginBottom:14 }}>Interview Complete!</div>
        <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:16, padding:"14px 16px", marginBottom:22, maxWidth:280 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:6, lineHeight:1.6 }}>{wrapup.praise}</div>
          <div style={{ fontSize:12, opacity:0.65, lineHeight:1.6, marginBottom:6 }}>{wrapup.tip}</div>
          {wrapup.correction && <div style={{ fontSize:12, opacity:0.5, lineHeight:1.6, fontStyle:"italic" }}>{wrapup.correction}</div>}
        </div>
        <button onClick={onBack} style={{ ...WELCOME_BTN_PRIMARY, maxWidth:220 }}>Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12, padding:"8px 14px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>←</button>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:16, color:"#FFD700" }}>🏝️ Interview Island</div>
        <div style={{ fontSize:11, opacity:0.5, marginLeft:"auto" }}>{phase === "wrapup" ? "Finishing up..." : `${turnCount}/${INTERVIEW_TURNS}`}</div>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ alignSelf: msg.role === "assistant" ? "flex-start" : "flex-end", maxWidth:"80%" }}>
            <div style={{
              background: msg.role === "assistant" ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#FFD700,#F5A623)",
              color: msg.role === "assistant" ? "#fff" : "#1a1000",
              borderRadius:16, padding:"10px 14px", fontSize:13, lineHeight:1.6, fontWeight: msg.role==="assistant"?500:700,
            }}>{msg.text}</div>
          </div>
        ))}
        {(loading || phase === "wrapup") && <div style={{ fontSize:12, opacity:0.5 }}>Jonathan AI is thinking... 🐵</div>}
        <div ref={bottomRef} />
      </div>
      {phase === "interview" && (
        <div style={{ padding:"12px 16px", borderTop:"1px solid rgba(255,255,255,0.07)", display:"flex", gap:8 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} placeholder="Type your answer..."
            style={{ flex:1, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:14, padding:"11px 14px", color:"#fff", fontSize:14 }} />
          <button onClick={send} disabled={loading || !input.trim()} style={{ background:"#FFD700", border:"none", borderRadius:14, padding:"11px 18px", fontWeight:900, cursor:"pointer" }}>→</button>
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ────────────────────────────────────────────────────────────────

export default function EikenApp({ user: platformUser, activeMember }) {
  // Per-child local state on family plans keeps siblings' grade/XP/progress
  // independent instead of blending into one shared record.
  const savedRaw  = getEikenLocalState(activeMember);
  const initLevel = savedRaw.level || CEFR_TO_EIKEN[(activeMember ?? platformUser)?.cefr] || "Pre-2";
  const initCoach = savedRaw.coach || "milo";

  const [screen, setScreen]           = useState(savedRaw.coach ? "welcome" : "onboarding");
  const firstName = (activeMember ?? platformUser)?.name?.split(" ")[0] ?? "there";
  const [user, setUser]               = useState({
    coach: initCoach, level: initLevel, xp: savedRaw.xp ?? 0, streak: (activeMember ?? platformUser)?.streak ?? 0,
    stars: savedRaw.stars ?? 0, sessions: savedRaw.sessions ?? 0,
    monkeyPartyBest: savedRaw.monkeyPartyBest ?? 0, monkeyPartyStreak: savedRaw.monkeyPartyStreak ?? 0, monkeyPartyLastPlayed: savedRaw.monkeyPartyLastPlayed ?? null,
    monkeyPartyRoundsTotal: savedRaw.monkeyPartyRoundsTotal ?? 0, monkeyPartyClarity3Count: savedRaw.monkeyPartyClarity3Count ?? 0,
    monkeyPartyPower3Count: savedRaw.monkeyPartyPower3Count ?? 0, monkeyPartyCategoryGoldCount: savedRaw.monkeyPartyCategoryGoldCount ?? 0,
    monkeyPartyBeatCount: savedRaw.monkeyPartyBeatCount ?? 0, monkeyPartyQuickMixCount: savedRaw.monkeyPartyQuickMixCount ?? 0,
  });
  const [lessonModule, setLessonModule] = useState("speak");

  // Persist eiken user state, scoped per-child
  useEffect(() => {
    saveEikenLocalState(activeMember, {
      coach: user.coach, level: user.level, xp: user.xp, stars: user.stars, sessions: user.sessions,
      monkeyPartyBest: user.monkeyPartyBest, monkeyPartyStreak: user.monkeyPartyStreak, monkeyPartyLastPlayed: user.monkeyPartyLastPlayed,
      monkeyPartyRoundsTotal: user.monkeyPartyRoundsTotal, monkeyPartyClarity3Count: user.monkeyPartyClarity3Count,
      monkeyPartyPower3Count: user.monkeyPartyPower3Count, monkeyPartyCategoryGoldCount: user.monkeyPartyCategoryGoldCount,
      monkeyPartyBeatCount: user.monkeyPartyBeatCount, monkeyPartyQuickMixCount: user.monkeyPartyQuickMixCount,
    });
  }, [user, activeMember]);

  // Ensure a durable progress record exists server-side (Phase 0's
  // eiken-progress endpoint) as soon as a student opens EIKEN.
  useEffect(() => {
    initEikenProgress(activeMember);
  }, [activeMember?.id]);

  const navigate = useCallback((to, params={}) => {
    if (params.module) setLessonModule(params.module);
    setScreen(to);
  }, []);

  const addXP = useCallback(amount => {
    setUser(u => ({ ...u, xp: u.xp+amount, stars: u.stars + (amount>=30?1:0), sessions: u.sessions + (amount>=20?1:0) }));
  }, []);

  // Monkey Party — config carries setup choices into the game screen;
  // lastSummary carries the completed session's stats into the results
  // screen. Both live here (not inside the game screens) so "Play Again"/
  // "Try Quick Mix" from the results screen can start a fresh game cleanly.
  const [monkeyPartyConfig, setMonkeyPartyConfig] = useState(null);
  const [monkeyPartySummary, setMonkeyPartySummary] = useState(null);

  const startMonkeyParty = useCallback((config) => {
    setMonkeyPartyConfig(config);
    setScreen("monkeyPartyGame");
  }, []);

  const finishMonkeyParty = useCallback((rounds) => {
    const summary = summarizeSession(rounds);
    setMonkeyPartySummary(summary);
    addXP(summary.totalScore * 2);
    const deltas = sessionBadgeDeltas(rounds, monkeyPartyConfig);
    setUser(u => {
      const { streak, lastPlayed } = nextMonkeyPartyStreak(u.monkeyPartyStreak, u.monkeyPartyLastPlayed);
      const updated = {
        ...u,
        monkeyPartyBest: Math.max(u.monkeyPartyBest ?? 0, summary.totalScore),
        monkeyPartyStreak: streak, monkeyPartyLastPlayed: lastPlayed,
        monkeyPartyRoundsTotal: (u.monkeyPartyRoundsTotal ?? 0) + deltas.roundsTotal,
        monkeyPartyClarity3Count: (u.monkeyPartyClarity3Count ?? 0) + deltas.clarity3Count,
        monkeyPartyPower3Count: (u.monkeyPartyPower3Count ?? 0) + deltas.power3Count,
        monkeyPartyCategoryGoldCount: (u.monkeyPartyCategoryGoldCount ?? 0) + deltas.categoryGoldCount,
        monkeyPartyBeatCount: (u.monkeyPartyBeatCount ?? 0) + deltas.beatCount,
        monkeyPartyQuickMixCount: (u.monkeyPartyQuickMixCount ?? 0) + deltas.quickMixCompleted,
      };
      const unlocked = computeMonkeyPartyBadgeUnlocks(updated);
      for (const id of unlocked) {
        const def = MONKEY_PARTY_BADGES.find(b => b.id === id);
        if (def) logAchievementUnlock(activeMember, id, { label: def.label });
      }
      return updated;
    });
    logMonkeyPartySession(activeMember, {
      eikenLevel: user.level,
      gameMode: monkeyPartyConfig?.mode,
      topic: monkeyPartyConfig?.topic,
      roundCount: monkeyPartyConfig?.roundCount,
      completedRounds: summary.roundCount,
      totalScore: summary.totalScore,
      speakingSeconds: summary.speakingSeconds,
      braveryAverage: summary.braveryAverage,
      clarityAverage: summary.clarityAverage,
      englishAverage: summary.englishAverage,
      powerAverage: summary.powerAverage,
    });
    setScreen("monkeyPartyResults");
  }, [activeMember, monkeyPartyConfig, user.level]);

  const m = MONKEYS[user.coach] || MONKEYS.milo;

  // Responsive: fill screen on mobile, phone frame on desktop
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = windowSize.w <= 500;
  const isTablet = windowSize.w > 500 && windowSize.w <= 900;

  // On real mobile: fill entire screen. On tablet/desktop: show phone frame.
  const shellStyle = isMobile ? {
    width: "100%",
    height: "100%",
    borderRadius: 0,
    background: "linear-gradient(180deg,#13102a 0%,#0d0d1e 100%)",
    overflow: "hidden", position: "relative", display: "flex", flexDirection: "column",
    transition: "box-shadow 0.7s ease",
  } : isTablet ? {
    width: Math.min(windowSize.w * 0.6, 440),
    height: Math.min(windowSize.h * 0.92, 860),
    borderRadius: 36,
    background: "linear-gradient(180deg,#13102a 0%,#0d0d1e 100%)",
    boxShadow: `0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.07), 0 0 60px ${m.glow}`,
    overflow: "hidden", position: "relative", display: "flex", flexDirection: "column",
    transition: "box-shadow 0.7s ease",
  } : {
    width: 390,
    height: Math.min(windowSize.h * 0.94, 820),
    borderRadius: 46,
    background: "linear-gradient(180deg,#13102a 0%,#0d0d1e 100%)",
    boxShadow: `0 48px 120px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.07), inset 0 0 0 1px rgba(255,255,255,0.03), 0 0 80px ${m.glow}`,
    overflow: "hidden", position: "relative", display: "flex", flexDirection: "column",
    transition: "box-shadow 0.7s ease",
  };

  return (
    <div style={{
      width:"100%", height:"100%",
      background:"radial-gradient(ellipse at 20% 20%, #1a0a3e 0%, #0f0a1e 55%, #0a1a10 100%)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Nunito',sans-serif",
    }}>
      <div style={shellStyle}>
        {/* Status bar — hide on real mobile (OS handles it) */}
        {!isMobile && (
          <div style={{ padding:"12px 26px 0", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
            <span style={{ fontSize:12, fontWeight:800 }}>9:41</span>
            <div style={{ width:118, height:28, background:"#000", borderRadius:20 }} />
            <div style={{ fontSize:11, opacity:0.6 }}>●●●</div>
          </div>
        )}

        {/* Screen */}
        <div style={{ flex:1, overflow:"auto", position:"relative" }}>
          {screen==="onboarding" && (
            <OnboardingScreen onComplete={({coach,level}) => { setUser(u=>({...u,coach,level})); setScreen("welcome"); }} />
          )}
          {screen==="welcome" && (
            <WelcomeScreen
              name={firstName}
              eikenUser={user}
              platformUser={platformUser}
              coachColor={m.color}
              onNavigate={navigate}
              onAcceptGrade={(lv) => { setUser(u=>({...u,level:lv})); setScreen("dashboard"); }}
            />
          )}
          {screen==="dashboard" && <DashboardScreen user={user} onNavigate={navigate} />}
          {screen==="lesson"    && <LessonScreen user={user} plan={platformUser?.plan} uid={platformUser?.uid} moduleId={lessonModule} onBack={()=>setScreen("dashboard")} onXP={addXP} />}
          {screen==="interview" && <InterviewSimulator user={user} plan={platformUser?.plan} uid={platformUser?.uid} onBack={()=>setScreen("dashboard")} onXP={addXP} />}
          {screen==="mocktest"  && <MockTestScreen user={user} plan={platformUser?.plan} uid={platformUser?.uid} activeMember={activeMember} onBack={()=>setScreen("dashboard")} onXP={addXP} />}
          {screen==="monkeyPartySetup" && (
            <MonkeyPartySetup user={user} onStart={startMonkeyParty} onBack={()=>setScreen("dashboard")} />
          )}
          {screen==="monkeyPartyGame" && monkeyPartyConfig && (
            <MonkeyPartyGame
              user={user} plan={platformUser?.plan} uid={platformUser?.uid} activeMember={activeMember}
              config={monkeyPartyConfig} onComplete={finishMonkeyParty} onExit={()=>setScreen("dashboard")}
            />
          )}
          {screen==="monkeyPartyResults" && monkeyPartySummary && (
            <MonkeyPartyResults
              summary={monkeyPartySummary}
              streak={user.monkeyPartyStreak}
              onPlayAgain={() => startMonkeyParty(monkeyPartyConfig)}
              onQuickMix={() => startMonkeyParty({ mode: "quick_mix", topic: "Random", roundCount: 5 })}
              onPracticeSkill={() => {
                const s = monkeyPartySummary;
                const weakest = Object.entries({ grammar: s.englishAverage, vocab: s.powerAverage }).sort((a,b)=>a[1]-b[1])[0]?.[0] ?? "grammar";
                navigate("lesson", { module: weakest });
              }}
              onHome={()=>setScreen("welcome")}
            />
          )}
          {screen==="gradeSelect" && (
            <GradeSelectScreen level={user.level} coachColor={m.color} onSelect={(lv) => { setUser(u=>({...u,level:lv})); setScreen("dashboard"); }} onBack={()=>setScreen("welcome")} />
          )}
          {screen==="achievements" && <AchievementsScreen user={user} activeMember={activeMember} onBack={()=>setScreen("welcome")} />}
          {screen==="placement" && (
            <PlacementScreen
              startLevel={user.level}
              coachColor={m.color}
              plan={platformUser?.plan}
              uid={platformUser?.uid}
              activeMember={activeMember}
              onComplete={(lv) => { setUser(u=>({...u,level:lv})); setScreen("dashboard"); }}
              onBack={()=>setScreen("welcome")}
            />
          )}
          {screen==="parents" && (
            <ComingSoonScreen title="Parents Dashboard" message="A dedicated parent view of progress, strengths, and confidence growth is coming in a future update." onBack={()=>setScreen("welcome")} />
          )}
        </div>

        {/* Bottom nav */}
        {screen !== "onboarding" && (
          <div style={{
            padding: isMobile ? "10px 20px max(18px, env(safe-area-inset-bottom))" : "10px 20px 18px",
            borderTop:"1px solid rgba(255,255,255,0.06)",
            display:"flex", justifyContent:"space-around",
            background:"rgba(0,0,0,0.35)", backdropFilter:"blur(20px)", flexShrink:0
          }}>
            {[
              { id:"dashboard", icon:"🏠", label:"Home" },
              { id:"lesson",    icon:"📚", label:"Practice" },
            ].map(tab => (
              <button key={tab.id} onClick={()=>navigate(tab.id)} style={{
                background:"none", border:"none", cursor:"pointer",
                color: screen===tab.id ? m.color : "rgba(255,255,255,0.35)",
                display:"flex", flexDirection:"column", alignItems:"center", gap:3,
                transition:"color 0.2s", padding:"4px 16px"
              }}>
                <span style={{ fontSize:21 }}>{tab.icon}</span>
                <span style={{ fontSize:10, fontWeight:800 }}>{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Global Jona Assistant (2026-09-24) — replaces the old separate
            "Chat with Jonathan AI" screen/tab. Docked to this phone-frame
            shell (anchor="absolute", shellStyle above is position:relative)
            rather than the browser viewport, so it sits at this app's own
            corner instead of the far corner of the page on desktop. */}
        <GlobalJonaAssistant
          anchor="absolute"
          context={{ appName: "EIKEN", lesson: screen !== "dashboard" && screen !== "onboarding" ? screen : undefined }}
          bottomOffset={screen !== "onboarding" ? 82 : 20}
        />
      </div>
    </div>
  );
}
