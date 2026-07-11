import { useState, useRef, useEffect } from "react";
import { COLORS } from "../constants/colors";
import { useLang } from "../hooks/useLang";
import { PRONUNCIATION_DRILLS } from "./data";
import { srt } from "./i18n";
import { askCoach, playTTS, buildPronunciationSystemPrompt, buildPronunciationUserMessage, parsePronunciationFeedback } from "./ai";
import { recordPracticeResult } from "./storage";

// Honest by design: no real acoustic pronunciation scoring here (that needs a
// dedicated phonetic-analysis API, a separate decision). This is listen,
// record, compare-by-ear, with the speech-recognition transcript used as a
// fuzzy, honestly-caveated clue for the AI's text feedback — not a score.
export default function PronunciationStudio({ user, onExit, onBadgesEarned }) {
  const { lang } = useLang();
  const tr = (k) => srt(lang, k);
  const jp = lang === "jp";

  const [index, setIndex] = useState(0);
  const [modelSpeaking, setModelSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [recognizedText, setRecognizedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const modelAudioRef = useRef(null);

  const drill = PRONUNCIATION_DRILLS[index];
  const isLast = index === PRONUNCIATION_DRILLS.length - 1;

  useEffect(() => () => {
    modelAudioRef.current?.pause();
    mediaRecorderRef.current?.stream?.getTracks()?.forEach((t) => t.stop());
  }, []);

  function resetDrill() {
    setAudioURL(null);
    setRecognizedText("");
    setFeedback(null);
    setError("");
  }

  function nextDrill() {
    resetDrill();
    if (!isLast) setIndex((i) => i + 1);
  }

  function playModel() {
    playTTS(drill.sentence, user?.uid, () => setModelSpeaking(true), () => setModelSpeaking(false))
      .then((a) => { if (a) modelAudioRef.current = a; });
  }

  async function startRecording() {
    resetDrill();
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = SR ? new SR() : null;
    if (recognition) {
      recognition.lang = "en-US";
      recognition.onresult = (e) => setRecognizedText(e.results[0][0].transcript);
      recognitionRef.current = recognition;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        setAudioURL(URL.createObjectURL(new Blob(chunks, { type: "audio/webm" })));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      recognition?.start();
      setRecording(true);
    } catch {
      setError(jp ? "マイクへのアクセスが必要です。" : "Microphone access is needed for Pronunciation Studio.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    recognitionRef.current?.stop();
    setRecording(false);
  }

  async function getFeedback() {
    setLoading(true);
    setError("");
    try {
      const raw = await askCoach(
        buildPronunciationSystemPrompt(),
        [{ role: "user", content: buildPronunciationUserMessage(drill.sentence, recognizedText) }],
        user
      );
      const parsed = parsePronunciationFeedback(raw);
      setFeedback(parsed);
      const { newBadges } = recordPracticeResult(user?.uid, { category: "pronunciation", scenarioId: drill.id, confidenceScore: 70 });
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
          onClick={nextDrill}
          disabled={isLast}
          style={{ marginLeft: "auto", background: "none", border: "none", color: isLast ? COLORS.textDim : "#818cf8", fontSize: 12, fontWeight: 700, cursor: isLast ? "default" : "pointer" }}
        >
          {isLast ? tr("last_topic") : (jp ? "次のドリルへ →" : "Next Drill →")}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(129,140,248,0.15)", border: "1px solid rgba(129,140,248,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
          👂
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{jp ? "発音スタジオ" : "Pronunciation Studio"}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>{index + 1} / {PRONUNCIATION_DRILLS.length} · {jp ? drill.focusJp : drill.focus}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {PRONUNCIATION_DRILLS.map((d, i) => (
          <div key={d.id} style={{ flex: 1, height: 4, borderRadius: 2, background: i < index ? "#818cf8" : i === index ? "#818cf888" : "#222" }} />
        ))}
      </div>

      <div style={{ background: COLORS.card, border: "1px solid rgba(129,140,248,0.3)", borderRadius: 14, padding: "20px 22px", marginBottom: 18, textAlign: "center" }}>
        <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.5, marginBottom: jp ? 8 : 0 }}>{drill.sentence}</div>
        {jp && <div style={{ fontSize: 13, color: COLORS.textMuted }}>{drill.sentenceJp}</div>}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <button
          onClick={playModel}
          style={{ flex: 1, padding: "13px 16px", borderRadius: 12, background: "#1a1a1a", border: "1px solid #333", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          {modelSpeaking ? "🔊 …" : "🔊"} {jp ? "お手本を聞く" : "Listen to Model"}
        </button>
        <button
          onClick={recording ? stopRecording : startRecording}
          style={{
            flex: 1, padding: "13px 16px", borderRadius: 12, border: "none",
            background: recording ? "#ff2020" : "#818cf8", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            animation: recording ? "pulse 1s ease-in-out infinite" : "none",
          }}
        >
          🎤 {recording ? (jp ? "停止" : "Stop") : (jp ? "録音する" : "Record Yourself")}
        </button>
      </div>

      {audioURL && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, marginBottom: 6 }}>{jp ? "あなたの録音" : "Your recording"}</div>
          <audio controls src={audioURL} style={{ width: "100%" }} />
        </div>
      )}

      {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 14 }}>{error}</div>}

      {audioURL && !feedback && (
        <button
          onClick={getFeedback}
          disabled={loading}
          style={{ width: "100%", padding: "13px 20px", borderRadius: 12, border: "none", background: loading ? "#333" : "#818cf8", color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer" }}
        >
          {loading ? (jp ? "確認中…" : "Getting feedback…") : (jp ? "コーチのコメントをもらう →" : "Get Coach Feedback →")}
        </button>
      )}

      {feedback && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <FeedbackRow icon="💬" label={jp ? "コメント" : "Feedback"} text={jp && feedback.feedback_jp ? feedback.feedback_jp : feedback.feedback_en} />
          <FeedbackRow icon="🎯" label={jp ? "ポイント" : "Focus"} text={feedback.focus} />
          <FeedbackRow icon="➡️" label={jp ? "次に" : "Next"} text={feedback.next} />
          <button onClick={resetDrill} style={{ ...backBtnStyle, marginTop: 10 }}>{jp ? "↺ もう一度" : "↺ Try Again"}</button>
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 11, color: COLORS.textDim, lineHeight: 1.6, textAlign: "center" }}>
        {jp
          ? "※ これは実際の発音の音響分析ではありません。お手本との聞き比べと、AIによるテキストベースのヒントです。"
          : "Note: this isn't real acoustic pronunciation scoring — it's listen-and-compare plus AI text tips based on what a speech recognizer heard."}
      </div>

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
