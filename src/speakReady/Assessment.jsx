import { useState } from "react";
import { COLORS } from "../constants/colors";
import { useLang } from "../hooks/useLang";
import { MOTIVATIONS, ASSESSMENT_QUESTIONS, buildAssessmentSystemPrompt, buildAssessmentUserMessage, parseAssessmentResult } from "./assessmentData";
import { CATEGORY_MAP } from "./data";
import { askCoach } from "./ai";
import { savePlacement } from "./storage";
import { srt } from "./i18n";

const LANGS = [
  { id: "ja-JP", label: "日本語" },
  { id: "en-US", label: "English" },
];

export default function Assessment({ user, onFinish, onStartCategory }) {
  const { lang } = useLang();
  const tr = (k) => srt(lang, k);
  const jp = lang === "jp";

  const [step, setStep] = useState("motivation"); // motivation | questions | loading | results | error
  const [motivation, setMotivation] = useState(null);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [textInput, setTextInput] = useState("");
  const [listening, setListening] = useState(false);
  const [speechLang, setSpeechLang] = useState("ja-JP");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const question = ASSESSMENT_QUESTIONS[qIndex];
  const isLastQuestion = qIndex === ASSESSMENT_QUESTIONS.length - 1;

  function pickMotivation(m) {
    setMotivation(m);
    setStep("questions");
  }

  function startListening() {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = speechLang;
    r.onstart = () => setListening(true);
    r.onend   = () => setListening(false);
    r.onerror = () => setListening(false);
    r.onresult = (e) => setTextInput((prev) => (prev ? prev + " " : "") + e.results[0][0].transcript);
    r.start();
  }

  async function submitAnswer() {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    const next = [...answers, { question: question.prompt, answer: trimmed }];
    setAnswers(next);
    setTextInput("");
    if (isLastQuestion) {
      await finishAssessment(next);
    } else {
      setQIndex((i) => i + 1);
    }
  }

  async function finishAssessment(qaPairs) {
    setStep("loading");
    setError("");
    try {
      const motivationLabel = jp && motivation.labelJp ? motivation.labelJp : motivation.label;
      const raw = await askCoach(
        buildAssessmentSystemPrompt(motivationLabel),
        [{ role: "user", content: buildAssessmentUserMessage(qaPairs) }],
        user
      );
      const parsed = parseAssessmentResult(raw);
      setResult(parsed);
      savePlacement(user?.uid, { ...parsed, motivation: motivation.id });
      setStep("results");
    } catch (e) {
      setError(e.message || tr("coach_unavailable"));
      setStep("error");
    }
  }

  if (step === "motivation") {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 60px" }}>
        <button onClick={onFinish} style={backBtnStyle}>{tr("back_to_speak_ready")}</button>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "20px 0 6px" }}>
          {jp ? "英語を学ぶ理由は?" : "Why are you learning English?"}
        </h1>
        <p style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 24 }}>
          {jp ? "あなたに合った練習を見つけるために教えてください。" : "This helps us find the right starting point for you."}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {MOTIVATIONS.map((m) => (
            <button
              key={m.id}
              onClick={() => pickMotivation(m)}
              style={{
                padding: "14px 12px", borderRadius: 12, background: COLORS.card, border: "1px solid #1e1e1e",
                color: COLORS.text, fontSize: 14, fontWeight: 700, cursor: "pointer", textAlign: "center",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#f59e0b"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e1e1e"; }}
            >
              {jp && m.labelJp ? m.labelJp : m.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "questions") {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 60px" }}>
        <button onClick={onFinish} style={backBtnStyle}>{tr("back_to_speak_ready")}</button>
        <div style={{ display: "flex", gap: 6, margin: "20px 0 18px" }}>
          {ASSESSMENT_QUESTIONS.map((q, i) => (
            <div key={q.id} style={{ flex: 1, height: 4, borderRadius: 2, background: i < qIndex ? "#f59e0b" : i === qIndex ? "#f59e0b88" : "#222" }} />
          ))}
        </div>
        <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 14, padding: "18px 20px", marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
            {jp ? `質問 ${qIndex + 1} / ${ASSESSMENT_QUESTIONS.length}` : `Question ${qIndex + 1} of ${ASSESSMENT_QUESTIONS.length}`}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5 }}>{jp && question.promptJp ? question.promptJp : question.prompt}</div>
        </div>

        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={tr("type_placeholder")}
          rows={5}
          style={{
            width: "100%", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 12,
            padding: 16, color: COLORS.text, fontSize: 14, lineHeight: 1.6, resize: "vertical",
            fontFamily: "inherit", marginBottom: 14,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }}>
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => setSpeechLang(l.id)}
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: speechLang === l.id ? "#f59e0b" : "#1a1a1a",
                border: `1px solid ${speechLang === l.id ? "#f59e0b" : "#333"}`,
                color: speechLang === l.id ? "#1a0800" : "#fff",
              }}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={startListening}
            style={{
              width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
              background: listening ? "#ff2020" : "#1a1a1a", border: "1px solid #333",
              color: "#fff", fontSize: 18, cursor: "pointer",
              animation: listening ? "pulse 1s ease-in-out infinite" : "none",
            }}
          >🎤</button>
          <button
            onClick={submitAnswer}
            disabled={!textInput.trim()}
            style={{
              flex: 1, padding: "13px 20px", borderRadius: 12, border: "none",
              background: !textInput.trim() ? "#333" : "#f59e0b",
              color: "#1a0800", fontSize: 15, fontWeight: 800,
              cursor: !textInput.trim() ? "default" : "pointer",
            }}
          >
            {isLastQuestion ? (jp ? "評価を見る →" : "See My Results →") : (jp ? "次の質問 →" : "Next Question →")}
          </button>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>
      </div>
    );
  }

  if (step === "loading") {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "80px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🗣️</div>
        <div style={{ fontSize: 14, color: COLORS.textMuted }}>
          {jp ? "あなたの回答を確認しています…" : "Reading your answers…"}
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 60px", textAlign: "center" }}>
        <div style={{ color: "#ff6b6b", fontSize: 14, marginBottom: 16 }}>{error}</div>
        <button onClick={onFinish} style={backBtnStyle}>{tr("back_to_speak_ready")}</button>
      </div>
    );
  }

  // results
  const recommendedCategory = CATEGORY_MAP[result.recommended_category];
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 60px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
          {jp ? "あなたのレベル" : "Your Starting Point"}
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 96, height: 96, borderRadius: "50%", border: "4px solid #f59e0b",
          fontSize: 26, fontWeight: 900, color: "#f59e0b", marginBottom: 12,
        }}>
          {result.confidence_score}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800 }}>{result.level}</div>
      </div>

      <FeedbackRow icon="💬" label={jp ? "コメント" : "Summary"} text={jp && result.summary_jp ? result.summary_jp : result.summary_en} />
      <FeedbackRow icon="✅" label={jp ? "得意なところ" : "Strength"} text={result.strength} />
      <FeedbackRow icon="🎯" label={jp ? "伸ばすところ" : "Focus"} text={result.focus} />

      {recommendedCategory && (
        <div style={{
          background: `${recommendedCategory.color}15`, border: `1px solid ${recommendedCategory.color}44`,
          borderRadius: 14, padding: 20, marginTop: 20, textAlign: "center",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            {jp ? "おすすめの練習" : "Recommended for you"}
          </div>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{recommendedCategory.icon}</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>
            {jp && recommendedCategory.nameJp ? recommendedCategory.nameJp : recommendedCategory.name}
          </div>
          <button
            onClick={() => onStartCategory(result.recommended_category)}
            style={{
              padding: "13px 26px", borderRadius: 12, background: recommendedCategory.color, border: "none",
              color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer",
            }}
          >
            {tr("start_practice")}
          </button>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button onClick={onFinish} style={backBtnStyle}>{tr("back_to_speak_ready")}</button>
      </div>
    </div>
  );
}

function FeedbackRow({ icon, label, text }) {
  if (!text) return null;
  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <span>{icon}</span> {label}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

const backBtnStyle = {
  background: "none", border: "none", color: COLORS.textMuted,
  fontSize: 13, cursor: "pointer", padding: 0,
};
