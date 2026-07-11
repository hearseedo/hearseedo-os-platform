import { useState, useEffect, useRef } from "react";
import { COLORS } from "../constants/colors";
import { useLang } from "../hooks/useLang";

const PROMPTS = [
  { en: "Say your name out loud — clearly and with confidence!", jp: "自分の名前を大きな声で言ってみよう！" },
  { en: "Say: 'Good morning! How are you today?'", jp: "「Good morning! How are you today?」と言ってみよう！" },
  { en: "Count from 1 to 5 in English as fast as you can!", jp: "1から5まで英語でできるだけ速く数えてみよう！" },
  { en: "Say: 'I am learning English and I'm getting better every day!'", jp: "英語で「I am learning English and I'm getting better every day!」と言ってみよう！" },
  { en: "Name three things you can see around you — in English!", jp: "周りにある3つのものを英語で言ってみよう！" },
  { en: "Say: 'Today is a great day to practise English!'", jp: "「Today is a great day to practise English!」と言ってみよう！" },
  { en: "Introduce yourself: 'Hi, my name is ___ and I love learning!'", jp: "英語で自己紹介してみよう：'Hi, my name is ___ and I love learning!'"},
];

const TODAY = new Date().toDateString();

export default function WarmUp({ onDone }) {
  const { t, lang }  = useLang();
  const [done, setDone] = useState(() => localStorage.getItem("hsd-warmup-date") === TODAY);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [success, setSuccess] = useState(false);
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  const [supported, setSupported] = useState(true);
  const recogRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  if (done) return null;

  function startRecording() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recog = new SR();
    recog.lang = "en-US";
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recogRef.current = recog;

    recog.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      setRecording(false);
      setSuccess(true);
    };
    recog.onerror = () => setRecording(false);
    recog.onend   = () => setRecording(false);

    recog.start();
    setRecording(true);
    setTranscript("");
    setSuccess(false);
  }

  function stopRecording() {
    recogRef.current?.stop();
    setRecording(false);
  }

  function handleDone() {
    localStorage.setItem("hsd-warmup-date", TODAY);
    setDone(true);
    onDone?.();
  }

  function skipTyped(e) {
    if (e.key === "Enter" && e.target.value.trim().length > 3) handleDone();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: COLORS.card, border: "1px solid #2a2a2a", borderRadius: 20,
        padding: 32, maxWidth: 420, width: "100%", textAlign: "center",
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🎙️</div>
        <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{t("daily_warmup")}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, marginBottom: 8, lineHeight: 1.3 }}>
          {prompt.en}
        </div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 28 }}>{lang === "jp" ? prompt.jp : ""}</div>

        {supported ? (
          <>
            <button
              onClick={recording ? stopRecording : startRecording}
              style={{
                width: 80, height: 80, borderRadius: "50%",
                background: recording ? "#e01010" : "#1e1e1e",
                border: recording ? "3px solid #ff4040" : "3px solid #333",
                color: "#fff", fontSize: 28, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
                boxShadow: recording ? "0 0 0 8px rgba(224,16,16,0.2)" : "none",
                transition: "all 0.2s",
              }}
            >
              {recording ? "⏹" : "🎤"}
            </button>

            {recording && (
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12, animation: "pulse 1s infinite" }}>
                {t("listening")}
              </div>
            )}

            {transcript && (
              <div style={{
                background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 10,
                padding: "10px 14px", marginBottom: 16, fontSize: 13, color: COLORS.textMuted, fontStyle: "italic",
              }}>
                "{transcript}"
              </div>
            )}
          </>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8 }}>
              {t("voice_not_supported")}
            </div>
            <input
              type="text"
              onKeyDown={skipTyped}
              placeholder={t("type_answer")}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8,
                background: "#0d0d0d", border: "1px solid #333",
                color: COLORS.text, fontSize: 13, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {success && (
          <div style={{
            background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 10, padding: "10px 14px", marginBottom: 16,
            fontSize: 13, color: "#22c55e",
          }}>
            {t("warmup_great")}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {success && (
            <button
              onClick={handleDone}
              style={{
                padding: "12px 28px", borderRadius: 10, border: "none",
                background: COLORS.red, color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("start_learning")}
            </button>
          )}
          <button
            onClick={handleDone}
            style={{
              padding: "12px 20px", borderRadius: 10, border: "1px solid #333",
              background: "transparent", color: COLORS.textMuted, fontSize: 13,
              cursor: "pointer",
            }}
          >
            {t("skip_today")}
          </button>
        </div>
      </div>
    </div>
  );
}
