import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { db } from "../lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

const QUESTION_BANK = [
  // ── A1 ────────────────────────────────────────────────────────────────────
  { cefr: "A1", skill: "Vocabulary",
    text: "What is the opposite of 'hot'?",
    options: ["warm", "cold", "fast", "big"], correct: 1 },
  { cefr: "A1", skill: "Grammar",
    text: "_____ your name?",
    options: ["What is", "What are", "How is", "Who are"], correct: 0 },
  { cefr: "A1", skill: "Reading",
    text: "\"The shop opens at 9 am and closes at 6 pm.\" When does the shop open?",
    options: ["6 am", "9 am", "9 pm", "6 pm"], correct: 1 },
  { cefr: "A1", skill: "Vocabulary",
    text: "Which word is a colour?",
    options: ["table", "run", "blue", "happy"], correct: 2 },
  { cefr: "A1", skill: "Grammar",
    text: "I _____ a student.",
    options: ["am", "is", "are", "be"], correct: 0 },

  // ── A2 ────────────────────────────────────────────────────────────────────
  { cefr: "A2", skill: "Vocabulary",
    text: "She _____ to school every day by bus.",
    options: ["go", "goes", "going", "gone"], correct: 1 },
  { cefr: "A2", skill: "Grammar",
    text: "We _____ dinner when you called.",
    options: ["have", "had", "were having", "are having"], correct: 2 },
  { cefr: "A2", skill: "Reading",
    text: "\"Please bring your passport and arrive 30 minutes early.\" What should you bring?",
    options: ["A ticket", "Your passport", "A map", "Your phone"], correct: 1 },
  { cefr: "A2", skill: "Vocabulary",
    text: "Choose the correct word: She is very _____ — she always helps people.",
    options: ["lazy", "kind", "loud", "tired"], correct: 1 },
  { cefr: "A2", skill: "Grammar",
    text: "I _____ been to Japan three times.",
    options: ["have", "has", "had", "am"], correct: 0 },

  // ── B1 ────────────────────────────────────────────────────────────────────
  { cefr: "B1", skill: "Grammar",
    text: "By the time we arrived, the movie _____ already started.",
    options: ["has", "had", "have", "was"], correct: 1 },
  { cefr: "B1", skill: "Reading",
    text: "\"Despite the heavy rain, the festival continued as planned. Organisers said safety measures were in place.\" — What does this tell us?",
    options: ["The festival was cancelled", "The festival happened even in bad weather", "Safety was ignored", "It was sunny during the festival"], correct: 1 },
  { cefr: "B1", skill: "Vocabulary",
    text: "Which word means 'to make something better'?",
    options: ["destroy", "improve", "ignore", "delay"], correct: 1 },
  { cefr: "B1", skill: "Grammar",
    text: "If I _____ more time, I would study English every day.",
    options: ["have", "had", "has", "having"], correct: 1 },
  { cefr: "B1", skill: "Reading",
    text: "\"The report showed a 20% increase in sales despite a difficult economy.\" What happened to sales?",
    options: ["They fell by 20%", "They stayed the same", "They rose by 20%", "The economy improved"], correct: 2 },

  // ── B2 ────────────────────────────────────────────────────────────────────
  { cefr: "B2", skill: "Vocabulary",
    text: "The new policy will _____ a significant impact on small businesses.",
    options: ["do", "make", "have", "take"], correct: 2 },
  { cefr: "B2", skill: "Grammar",
    text: "I wish I _____ harder when I was at school.",
    options: ["studied", "had studied", "have studied", "study"], correct: 1 },
  { cefr: "B2", skill: "Vocabulary",
    text: "Choose the best word: The lawyer gave a _____ argument that convinced the jury.",
    options: ["weak", "compelling", "vague", "simple"], correct: 1 },
  { cefr: "B2", skill: "Grammar",
    text: "The project _____ by the team before the deadline if they had started earlier.",
    options: ["would complete", "would have been completed", "will be completed", "has been completed"], correct: 1 },
  { cefr: "B2", skill: "Reading",
    text: "\"The author argues that technology, while beneficial, has eroded our capacity for deep focus.\" What is the author's main concern?",
    options: ["Technology is too expensive", "Technology reduces our ability to concentrate deeply", "Technology has no benefits", "Technology improves focus"], correct: 1 },

  // ── C1 ────────────────────────────────────────────────────────────────────
  { cefr: "C1", skill: "Vocabulary",
    text: "The scientist's findings _____ the long-held belief that the earth's core was static.",
    options: ["confirmed", "undermined", "ignored", "celebrated"], correct: 1 },
  { cefr: "C1", skill: "Grammar",
    text: "_____ the circumstances, it is remarkable that the project was completed on time.",
    options: ["Despite of", "Given", "Although", "Even"], correct: 1 },
  { cefr: "C1", skill: "Reading",
    text: "\"The paradox of choice suggests that having more options can lead to greater dissatisfaction.\" What does this imply?",
    options: ["More choices always make people happier", "Fewer choices can sometimes improve satisfaction", "People should avoid making decisions", "Options reduce stress"], correct: 1 },
  { cefr: "C1", skill: "Vocabulary",
    text: "The politician's speech was deliberately _____, making it hard to understand her true position.",
    options: ["transparent", "ambiguous", "direct", "concise"], correct: 1 },
  { cefr: "C1", skill: "Grammar",
    text: "Not only _____ the deadline, but they also exceeded expectations.",
    options: ["they met", "did they meet", "they have met", "have met they"], correct: 1 },
];

// Pick 5 questions: one from each difficulty tier, shuffled
function pickQuestions() {
  const tiers = ["A1", "A2", "B1", "B2", "C1"];
  const picked = tiers.map(cefr => {
    const pool = QUESTION_BANK.filter(q => q.cefr === cefr);
    return pool[Math.floor(Math.random() * pool.length)];
  });
  // Shuffle so order isn't always A1→C1
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

const SPEAKING_PROMPT = "Tell me about yourself — your name, where you're from, and one thing you enjoy doing. Speak for 15–30 seconds.";

const CEFR_META = {
  A1: { label: "Starter",     color: "#64748b", emoji: "🌱", eiken: "英検5級",     eikenEn: "Eiken Grade 5",     toeic: "~225" },
  A2: { label: "Elementary",  color: "#3b82f6", emoji: "🌿", eiken: "英検4級",     eikenEn: "Eiken Grade 4",     toeic: "~350" },
  B1: { label: "Intermediate",color: "#8b5cf6", emoji: "🌳", eiken: "英検3級〜準2級", eikenEn: "Eiken Grade 3–Pre-2", toeic: "~550" },
  B2: { label: "Upper-Inter.", color: "#f59e0b", emoji: "⭐", eiken: "英検2級",     eikenEn: "Eiken Grade 2",     toeic: "~730" },
  C1: { label: "Advanced",    color: "#e01010", emoji: "🔥", eiken: "英検準1級",   eikenEn: "Eiken Pre-Grade 1", toeic: "~880" },
  C2: { label: "Mastery",     color: "#C9A84C", emoji: "💎", eiken: "英検1級",     eikenEn: "Eiken Grade 1",     toeic: "~980" },
};

export default function Assessment() {
  const { user, refreshProfile } = useAuth();
  const navigate  = useNavigate();
  const { t, lang } = useLang();
  const [phase, setPhase]             = useState("intro");      // intro | questions | speaking | scoring | result
  const [questions, setQuestions]     = useState(() => pickQuestions());
  const [qIndex, setQIndex]           = useState(0);
  const [answers, setAnswers]         = useState([]);
  const [selected, setSelected]       = useState(null);
  const [transcript, setTranscript]   = useState("");
  const [listening, setListening]     = useState(false);
  const [result, setResult]           = useState(null);
  const [saving, setSaving]           = useState(false);
  const [skipSpeaking, setSkipSpeaking] = useState(false);
  const [ttsPlaying, setTtsPlaying]   = useState(false);
  const srRef  = useRef(null);
  const audioRef = useRef(null);

  const speakText = async (text) => {
    if (ttsPlaying) { audioRef.current?.pause(); setTtsPlaying(false); return; }
    if (!user?.uid) return;
    try {
      setTtsPlaying(true);
      const spokenText = text.replace(/_+/g, " blank ");
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, text: spokenText }),
      });
      if (!res.ok) { setTtsPlaying(false); return; }
      const buf  = await res.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
      audio.onerror = () => setTtsPlaying(false);
      audio.play();
    } catch { setTtsPlaying(false); }
  };

  useEffect(() => {
    if (!user) navigate("/", { replace: true });
  }, [user, navigate]);

  // ── Speech recognition ────────────────────────────────────────────────────
  const startListening = () => {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SR) { setSkipSpeaking(true); return; }
    const r     = new SR();
    r.lang      = "en-US";
    r.continuous     = true;
    r.interimResults = false;
    r.onstart  = () => setListening(true);
    r.onend    = () => setListening(false);
    r.onerror  = () => { setListening(false); };
    r.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join(" ");
      setTranscript(t);
    };
    srRef.current = r;
    r.start();
  };

  const stopListening = () => {
    srRef.current?.stop();
    setListening(false);
  };

  // ── MCQ flow ──────────────────────────────────────────────────────────────
  const submitAnswer = () => {
    if (selected === null) return;
    const next = [...answers, selected];
    setAnswers(next);
    setSelected(null);
    if (qIndex + 1 < questions.length) {
      setQIndex(i => i + 1);
    } else {
      setPhase("speaking");
    }
  };

  // ── Score via Gemini ──────────────────────────────────────────────────────
  const scoreAssessment = async (finalTranscript) => {
    setPhase("scoring");
    try {
      const res  = await fetch("/api/assessment-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user?.uid, answers, questions, speakingTranscript: finalTranscript, lang }),
      });
      const data = await res.json();
      setResult(data);
      setPhase("result");
    } catch {
      // Fallback — calculate locally
      const correct = answers.filter((a, i) => a === questions[i].correct).length;
      const score   = Math.round((correct / questions.length) * 60) + 10;
      const cefr    = score < 25 ? "A1" : score < 40 ? "A2" : score < 55 ? "B1" : score < 70 ? "B2" : "C1";
      setResult({ cefr, cefrName: CEFR_META[cefr].label, score, mcqScore: correct, mcqTotal: questions.length,
        strengths: ["You completed the assessment — that takes courage!"],
        gaps: ["Keep practising every day to see improvement"],
        firstGoal: "Build a 7-day learning streak",
        encouragement: "Every expert was once a beginner. You've taken the first step." });
      setPhase("result");
    }
  };

  // ── Save to Firestore + navigate ──────────────────────────────────────────
  const saveAndContinue = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        baselineScore:   result.score,
        baselineCefr:    result.cefr,
        baselineDate:    new Date().toISOString(),
        cefr:            result.cefr,
        assessmentDone:  true,
        confidenceScore: result.score,
        updatedAt:       serverTimestamp(),
      });
    } catch {}
    await refreshProfile();
    navigate("/dashboard", { replace: true, state: { assessmentJustDone: true } });
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const wrap = {
    minHeight: "100vh", background: COLORS.bg, color: COLORS.text,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    padding: 24, fontFamily: "'Inter', sans-serif",
  };
  const card = {
    width: "100%", maxWidth: 560,
    background: COLORS.card, border: "1px solid #1e1e1e",
    borderRadius: 16, padding: 36,
  };

  // ── Phases ────────────────────────────────────────────────────────────────
  if (phase === "intro") return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>{t("assessment_title")}</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 12px" }}>{t("assessment_headline")}</h1>
          <p style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.7, margin: 0 }}>
            {t("assessment_desc").split("\n").map((l, i) => <span key={i}>{l}{i === 0 && <br />}</span>)}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {[["📝", t("assessment_q_label"),     t("assessment_q_sub")],
            ["🎤", t("assessment_speak_label"), t("assessment_speak_sub")],
            ["🤖", t("assessment_ai_label"),    t("assessment_ai_sub")]].map(([icon, title, sub]) => (
            <div key={title} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "#0d0d0d", borderRadius: 10, border: "1px solid #1e1e1e" }}>
              <span style={{ fontSize: 22 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setPhase("questions")} style={{
          width: "100%", padding: 16, background: COLORS.red, border: "none",
          borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 0 20px rgba(224,16,16,0.3)",
        }}>
          {t("start_assessment")}
        </button>
        <button onClick={() => navigate("/dashboard", { replace: true, state: { assessmentJustDone: true } })} style={{
          width: "100%", marginTop: 10, padding: 12, background: "none", border: "none",
          color: COLORS.textMuted, fontSize: 12, cursor: "pointer",
        }}>
          {t("skip_for_now")}
        </button>
      </div>
    </div>
  );

  if (phase === "questions") {
    const q   = questions[qIndex];
    const pct = ((qIndex) / questions.length) * 100;
    // Stop audio when question changes
    if (audioRef.current && !audioRef.current.paused) { audioRef.current.pause(); }
    return (
      <div style={wrap}>
        <div style={card}>
          {/* Progress */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>
              <span>{t("path_question")} {qIndex + 1} {t("path_of")} {questions.length}</span>
              <span style={{ color: COLORS.red }}>{q.cefr} · {q.skill}</span>
            </div>
            <div style={{ height: 3, background: "#1e1e1e", borderRadius: 2 }}>
              <div style={{ height: 3, width: `${pct}%`, background: COLORS.red, borderRadius: 2, transition: "width 0.4s" }} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 24 }}>
            <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.6, margin: 0, flex: 1 }}>{q.text}</p>
            <button onClick={() => speakText(q.text)} title="Listen to question" style={{
              flexShrink: 0, width: 36, height: 36, borderRadius: "50%",
              background: ttsPlaying ? "rgba(224,16,16,0.15)" : "#1a1a1a",
              border: `1px solid ${ttsPlaying ? COLORS.red : "#2a2a2a"}`,
              color: ttsPlaying ? COLORS.red : COLORS.textMuted,
              fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}>
              {ttsPlaying ? "⏹" : "🔊"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
            {q.options.map((opt, i) => (
              <button key={i} onClick={() => setSelected(i)} style={{
                padding: "14px 18px", textAlign: "left", borderRadius: 10, fontSize: 14,
                cursor: "pointer", transition: "all 0.15s",
                background: selected === i ? "rgba(224,16,16,0.12)" : "#0d0d0d",
                border: `1px solid ${selected === i ? COLORS.red : "#2a2a2a"}`,
                color: selected === i ? COLORS.text : COLORS.textMuted,
                fontWeight: selected === i ? 600 : 400,
              }}>
                <span style={{ color: COLORS.textDim, marginRight: 10 }}>{String.fromCharCode(65 + i)}.</span>
                {opt}
              </button>
            ))}
          </div>

          <button onClick={submitAnswer} disabled={selected === null} style={{
            width: "100%", padding: 14, background: selected !== null ? COLORS.red : "#1e1e1e",
            border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 600,
            cursor: selected !== null ? "pointer" : "not-allowed", transition: "background 0.2s",
          }}>
            {qIndex + 1 < questions.length ? t("next") : t("continue_to_speaking")}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "speaking") return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎤</div>
          <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Speaking Sample</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>{t("speaking_title")}</h2>
          <div style={{ padding: "14px 18px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 10, marginBottom: 16, textAlign: "left" }}>
            <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 1, marginBottom: 6 }}>{t("speaking_prompt_label")}</div>
            <p style={{ fontSize: 15, color: COLORS.text, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>
              "{SPEAKING_PROMPT}"
            </p>
          </div>
          <p style={{ fontSize: 11, color: COLORS.textDim, margin: 0 }}>{t("speaking_privacy")}</p>
        </div>

        {skipSpeaking ? (
          <div style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid #2a2a2a", marginBottom: 20, fontSize: 13, color: COLORS.textMuted, textAlign: "center" }}>
            {t("browser_no_speech")}<br />
            <span style={{ color: COLORS.text }}>{t("score_from_written")}</span>
          </div>
        ) : (
          <>
            {/* NOT recording state — explicit start */}
            {!listening && !transcript && (
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 14, padding: "8px 14px", background: "#0d0d0d", borderRadius: 8, border: "1px solid #2a2a2a" }}>
                  {t("not_recording_yet")}
                </div>
                <button onClick={startListening} style={{
                  width: 80, height: 80, borderRadius: "50%",
                  background: "#1a1a1a", border: `3px solid ${COLORS.red}`,
                  cursor: "pointer", fontSize: 32,
                  boxShadow: "0 0 20px rgba(224,16,16,0.2)",
                  transition: "all 0.2s",
                }}>
                  🎤
                </button>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 10 }}>{t("press_to_record")}</div>
              </div>
            )}

            {/* RECORDING state */}
            {listening && (
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <button onClick={stopListening} style={{
                  width: 80, height: 80, borderRadius: "50%",
                  background: "#ff2020", border: "none",
                  cursor: "pointer", fontSize: 32,
                  boxShadow: "0 0 0 8px rgba(224,16,16,0.2), 0 0 0 16px rgba(224,16,16,0.1)",
                  animation: "pulse 1s ease-in-out infinite",
                  transition: "all 0.2s",
                }}>
                  ⏹
                </button>
                <div style={{ fontSize: 12, color: COLORS.red, marginTop: 10, letterSpacing: 1, fontWeight: 700 }}>{t("recording_active")}</div>
              </div>
            )}

            {/* Transcript */}
            {transcript && (
              <div style={{ padding: 14, background: "rgba(34,197,94,0.06)", borderRadius: 10, border: "1px solid rgba(34,197,94,0.25)", marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: "#22c55e", letterSpacing: 1, marginBottom: 6 }}>{t("recorded_label")}</div>
                <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.6, fontStyle: "italic" }}>"{transcript}"</div>
                <button onClick={() => { setTranscript(""); }} style={{ marginTop: 10, fontSize: 11, color: COLORS.textMuted, background: "none", border: "1px solid #2a2a2a", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                  {t("re_record")}
                </button>
              </div>
            )}
          </>
        )}

        <button
          onClick={() => scoreAssessment(transcript)}
          disabled={!skipSpeaking && !transcript}
          style={{
            width: "100%", padding: 14,
            background: (skipSpeaking || transcript) ? COLORS.red : "#1e1e1e",
            border: "none", borderRadius: 10, color: "#fff",
            fontSize: 14, fontWeight: 600,
            cursor: (skipSpeaking || transcript) ? "pointer" : "not-allowed",
          }}>
          {transcript ? t("get_results") : skipSpeaking ? t("continue_no_speaking") : t("record_first")}
        </button>
        <button onClick={() => scoreAssessment("")} style={{ width: "100%", marginTop: 8, padding: 10, background: "none", border: "none", color: COLORS.textDim, fontSize: 12, cursor: "pointer" }}>
          {t("skip_speaking")}
        </button>
        <style>{`@keyframes pulse{0%,100%{box-shadow:0 0 0 8px rgba(224,16,16,0.2)}50%{box-shadow:0 0 0 16px rgba(224,16,16,0.1)}}`}</style>
      </div>
    </div>
  );

  if (phase === "scoring") return (
    <div style={wrap}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", border: `3px solid ${COLORS.red}33`, borderTop: `3px solid ${COLORS.red}`, margin: "0 auto 20px", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 14, color: COLORS.textMuted }}>{t("scoring")}</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (phase === "result" && result) {
    const meta    = CEFR_META[result.cefr] ?? CEFR_META.A2;
    const correct = result.mcqScore ?? answers.filter((a, i) => a === questions[i].correct).length;
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: "center" }}>
          {/* CEFR badge */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>{meta.emoji}</div>
            <div style={{ display: "inline-block", padding: "6px 20px", background: `${meta.color}22`, border: `1px solid ${meta.color}66`, borderRadius: 100, marginBottom: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: meta.color }}>{result.cefr}</span>
              <span style={{ fontSize: 13, color: COLORS.textMuted, marginLeft: 8 }}>{result.cefrName ?? meta.label}</span>
            </div>

            {/* Eiken + TOEIC equivalents */}
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <div style={{ padding: "5px 14px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 20, fontSize: 12 }}>
                <span style={{ color: COLORS.textDim }}>英検 </span>
                <span style={{ color: meta.color, fontWeight: 700 }}>{meta.eiken}</span>
              </div>
              <div style={{ padding: "5px 14px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 20, fontSize: 12 }}>
                <span style={{ color: COLORS.textDim }}>TOEIC </span>
                <span style={{ color: meta.color, fontWeight: 700 }}>{meta.toeic}</span>
              </div>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>{t("baseline_set")}</h2>
            <p style={{ fontSize: 13, color: COLORS.textMuted, margin: 0 }}>
              {t("correct_of").replace("{n}", correct).replace("{total}", questions.length)} · {t("confidence_score_label")}: <strong style={{ color: COLORS.text }}>{result.score}</strong>
            </p>
          </div>

          {/* Score bar */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ height: 8, background: "#1e1e1e", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${result.score}%`, background: `linear-gradient(to right, ${meta.color}, ${meta.color}99)`, borderRadius: 4, transition: "width 1s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.textDim, marginTop: 4 }}>
              <span>A1</span><span>A2</span><span>B1</span><span>B2</span><span>C1</span><span>C2</span>
            </div>
          </div>

          {/* Strengths & gaps */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20, textAlign: "left" }}>
            <div style={{ padding: 14, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", letterSpacing: 1, marginBottom: 8 }}>{t("strengths")}</div>
              {(result.strengths ?? []).map((s, i) => <div key={i} style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 4 }}>· {s}</div>)}
            </div>
            <div style={{ padding: 14, background: "rgba(224,16,16,0.06)", border: "1px solid rgba(224,16,16,0.2)", borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.red, letterSpacing: 1, marginBottom: 8 }}>{t("to_work_on")}</div>
              {(result.gaps ?? []).map((g, i) => <div key={i} style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 4 }}>· {g}</div>)}
            </div>
          </div>

          {/* First goal */}
          <div style={{ padding: 14, background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 10, marginBottom: 20, textAlign: "left" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.gold ?? "#C9A84C", letterSpacing: 1, marginBottom: 6 }}>{t("first_goal_label")}</div>
            <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>{result.firstGoal}</div>
          </div>

          {/* Encouragement */}
          <p style={{ fontSize: 13, color: COLORS.textMuted, fontStyle: "italic", lineHeight: 1.7, marginBottom: 24 }}>
            "{result.encouragement}"
          </p>

          <button onClick={saveAndContinue} disabled={saving} style={{
            width: "100%", padding: 16, background: COLORS.red, border: "none",
            borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 0 24px rgba(224,16,16,0.3)",
          }}>
            {saving ? t("saving") : t("enter_hsd")}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
