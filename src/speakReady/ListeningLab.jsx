import { useState } from "react";
import { COLORS } from "../constants/colors";
import { useLang } from "../hooks/useLang";
import { LISTENING_CLIPS, ACCENTS } from "./data";
import { srt } from "./i18n";
import { askCoach, playAccentTTS, buildListeningSystemPrompt, buildListeningUserMessage, parseListeningFeedback } from "./ai";
import { recordPracticeResult } from "./storage";

const ACCENT_COLOR = "#06b6d4";
const GOT_IT_SCORE = { yes: 85, partially: 60, no: 40 };

export default function ListeningLab({ user, onExit, onBadgesEarned }) {
  const { lang } = useLang();
  const tr = (k) => srt(lang, k);
  const jp = lang === "jp";

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [listening, setListening] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null);

  const clip = LISTENING_CLIPS[index];
  const accent = ACCENTS.find((a) => a.id === clip.accent);
  const isLast = index === LISTENING_CLIPS.length - 1;

  function resetClip() {
    setTextInput("");
    setFeedback(null);
    setError("");
  }

  function nextClip() {
    resetClip();
    if (!isLast) setIndex((i) => i + 1);
  }

  function playClip() {
    playAccentTTS(clip.script, user?.uid, clip.accent, () => setPlaying(true), () => setPlaying(false));
  }

  function startListening() {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "en-US";
    r.onstart = () => setListening(true);
    r.onend   = () => setListening(false);
    r.onerror = () => setListening(false);
    r.onresult = (e) => setTextInput((prev) => (prev ? prev + " " : "") + e.results[0][0].transcript);
    r.start();
  }

  async function submitAnswer() {
    const trimmed = textInput.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError("");
    try {
      const raw = await askCoach(
        buildListeningSystemPrompt(),
        [{ role: "user", content: buildListeningUserMessage(clip.question, clip.keyInfo, trimmed) }],
        user
      );
      const parsed = parseListeningFeedback(raw);
      setFeedback(parsed);
      const { newBadges } = recordPracticeResult(user?.uid, {
        category: "listening",
        scenarioId: clip.id,
        confidenceScore: GOT_IT_SCORE[parsed.got_it] ?? 60,
      });
      if (newBadges.length) onBadgesEarned?.(newBadges);
    } catch (e) {
      setError(jp ? tr("coach_unavailable") : (e.message || tr("coach_unavailable")));
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onExit} style={backBtnStyle}>{tr("back_to_speak_ready")}</button>
        <button
          onClick={nextClip}
          disabled={isLast}
          style={{ marginLeft: "auto", background: "none", border: "none", color: isLast ? COLORS.textDim : ACCENT_COLOR, fontSize: 12, fontWeight: 700, cursor: isLast ? "default" : "pointer" }}
        >
          {isLast ? tr("last_topic") : (jp ? "次のクリップへ →" : "Next Clip →")}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${ACCENT_COLOR}22`, border: `1px solid ${ACCENT_COLOR}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
          🎧
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{jp ? "リスニングラボ" : "Listening Lab"}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>
            {index + 1} / {LISTENING_CLIPS.length} ·
            <span style={{ color: ACCENT_COLOR, fontWeight: 700 }}> {jp && accent?.labelJp ? accent.labelJp : accent?.label}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {LISTENING_CLIPS.map((c, i) => (
          <div key={c.id} style={{ flex: 1, height: 4, borderRadius: 2, background: i < index ? ACCENT_COLOR : i === index ? `${ACCENT_COLOR}88` : "#222" }} />
        ))}
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${ACCENT_COLOR}44`, borderRadius: 14, padding: "22px", marginBottom: 18, textAlign: "center" }}>
        <button
          onClick={playClip}
          style={{
            width: 72, height: 72, borderRadius: "50%", border: "none", background: ACCENT_COLOR,
            color: "#fff", fontSize: 28, cursor: "pointer", marginBottom: 14,
            boxShadow: `0 0 20px ${ACCENT_COLOR}44`, animation: playing ? "pulse 1s ease-in-out infinite" : "none",
          }}
        >
          🔊
        </button>
        <div style={{ fontSize: 13, color: COLORS.textMuted }}>{jp ? "タップしてクリップを再生" : "Tap to play the clip"}</div>
      </div>

      <div style={{ background: "rgba(6,182,212,0.08)", border: `1px solid ${ACCENT_COLOR}33`, borderRadius: 12, padding: "14px 18px", marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT_COLOR, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
          {jp ? "質問" : "Question"}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>{jp && clip.questionJp ? clip.questionJp : clip.question}</div>
      </div>

      {!feedback && (
        <>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={tr("type_placeholder")}
            rows={4}
            style={{
              width: "100%", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 12,
              padding: 16, color: COLORS.text, fontSize: 14, lineHeight: 1.6, resize: "vertical",
              fontFamily: "inherit", marginBottom: 14,
            }}
          />
          {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>{error}</div>}
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
              disabled={!textInput.trim() || loading}
              style={{
                flex: 1, padding: "13px 20px", borderRadius: 12, border: "none",
                background: !textInput.trim() || loading ? "#333" : ACCENT_COLOR,
                color: "#fff", fontSize: 15, fontWeight: 700,
                cursor: !textInput.trim() || loading ? "default" : "pointer",
              }}
            >
              {loading ? (jp ? "確認中…" : "Checking…") : (jp ? "答えを送る →" : "Submit Answer →")}
            </button>
          </div>
        </>
      )}

      {feedback && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <FeedbackRow icon="💬" label={jp ? "コメント" : "Feedback"} text={jp && feedback.feedback_jp ? feedback.feedback_jp : feedback.feedback_en} />
          <FeedbackRow icon="➡️" label={jp ? "次に" : "Next"} text={feedback.next} />
          <button onClick={resetClip} style={{ ...backBtnStyle, marginTop: 10 }}>{jp ? "↺ もう一度" : "↺ Try Again"}</button>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}} @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
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
