import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";

function getBootLines(lang) {
  return lang === "jp"
    ? ["ファミリーダッシュボードを準備中...", "あなたの学習ジャーニーを読み込み中...", "準備完了。"]
    : ["Setting up your family dashboard...", "Loading your learning journey...", "Everything is ready."];
}

function buildGreeting(name, lang) {
  const first  = (name || "").split(" ")[0] || "there";
  const hour   = new Date().getHours();
  if (lang === "jp") {
    const period = hour < 12 ? "おはようございます" : hour < 17 ? "こんにちは" : "こんばんは";
    return `${period}、${first}さん。HSDダッシュボードへようこそ。今日も家族の英語学習を始めましょう。`;
  }
  const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${period}, ${first}. Your HSD dashboard is ready. Let's start your family's English journey today.`;
}

async function speakText(text, uid, lang) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, uid, lang }),
  });
  if (!res.ok) throw new Error("TTS failed");
  const blob  = await res.blob();
  const url   = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  return audio;
}

export default function Welcome() {
  const { user, loading } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();

  const [bootLines, setBootLines] = useState([]);
  const [bootDone, setBootDone]   = useState(false);
  const [countdown, setCountdown] = useState(3);
  const audioRef = useRef(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  // Boot sequence — type lines one by one
  useEffect(() => {
    const BOOT_LINES = getBootLines(lang);
    let i = 0;
    const iv = setInterval(() => {
      if (i < BOOT_LINES.length) {
        setBootLines((p) => [...p, BOOT_LINES[i]]);
        i++;
      } else {
        clearInterval(iv);
        setTimeout(() => setBootDone(true), 300);
      }
    }, 350);
    return () => clearInterval(iv);
  }, [lang]);

  // Auto-advance countdown after boot completes
  useEffect(() => {
    if (!bootDone) return;
    if (countdown <= 0) { enterDashboard(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [bootDone, countdown]);

  const enterDashboard = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    navigate("/dashboard", { replace: true });
  };

  if (loading) return null;

  const greeting = user ? buildGreeting(user.name, lang) : "";

  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.bg,
      backgroundImage: "url('/assets/bg/midnight-nebula.png')",
      backgroundSize: "cover", backgroundPosition: "center",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, position: "relative", overflow: "hidden",
    }}>
      {/* Background grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(224,16,16,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(224,16,16,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Radial glow behind avatar */}
      <div style={{
        position: "absolute", top: "35%", left: "50%", transform: "translate(-50%,-50%)",
        width: 700, height: 700,
        background: "radial-gradient(circle, rgba(224,16,16,0.07) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 480, width: "100%" }}>

        {/* Adult Jona — waving, cropped to a circular bust frame */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 12 }}>
          <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 200, height: 48, background: "radial-gradient(ellipse, rgba(201,168,76,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{
            width: 170, height: 170, borderRadius: "50%", overflow: "hidden",
            position: "relative", margin: "0 auto",
            border: "2px solid rgba(201,168,76,0.45)",
            boxShadow: "0 0 24px rgba(201,168,76,0.25)",
            background: "radial-gradient(circle, rgba(224,16,16,0.1) 0%, rgba(0,0,0,0.5) 100%)",
          }}>
            <img
              src="/assets/jona/pose-waving.png"
              alt="Jona"
              style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 230, height: "auto", display: "block" }}
            />
          </div>
        </div>

        {/* Brand label */}
        <div style={{ fontSize: 10, color: "#C9A84C", letterSpacing: 5, textTransform: "uppercase", marginBottom: 2 }}>HEAR SEE DO™</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 3, marginBottom: 24 }}>OS AI</div>

        {/* Boot terminal */}
        <div style={{
          padding: "12px 16px", background: "rgba(0,0,0,0.7)",
          border: "1px solid #1a1a1a", borderRadius: 10,
          textAlign: "left", fontFamily: "monospace", marginBottom: 20,
        }}>
          {bootLines.map((line, i) => (
            <div key={i} style={{
              fontSize: 11, lineHeight: 1.9,
              color: i === bootLines.length - 1 && bootDone ? COLORS.red : i === bootLines.length - 1 ? "#888" : "#333",
              letterSpacing: 0.5,
              animation: "fadeSlideIn 0.3s ease",
            }}>
              <span style={{ color: "#2a2a2a", marginRight: 8 }}>›</span>{line}
            </div>
          ))}
          {!bootDone && (
            <span style={{ display: "inline-block", width: 7, height: 13, background: "#e01010", animation: "cursorBlink 0.7s step-end infinite", verticalAlign: "middle" }} />
          )}
        </div>

        {/* Greeting text — appears once boot done */}
        {bootDone && (
          <div style={{
            fontSize: 15, color: COLORS.text, lineHeight: 1.7,
            marginBottom: 28, fontWeight: 300, letterSpacing: 0.3,
            animation: "fadeSlideIn 0.6s ease",
          }}>
            {greeting}
          </div>
        )}

        {/* Buttons — appear after boot completes */}
        {bootDone && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, animation: "fadeSlideIn 0.6s ease" }}>
            <button
              onClick={enterDashboard}
              style={{
                padding: "15px 52px",
                background: COLORS.red,
                border: "none", borderRadius: 40,
                color: "#fff", fontSize: 13, fontWeight: 700,
                letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                boxShadow: "0 0 30px rgba(224,16,16,0.5)",
              }}
            >
              {lang === "jp" ? "ダッシュボードへ →" : "Enter Dashboard →"}
            </button>
            <div style={{ fontSize: 11, color: COLORS.textDim, letterSpacing: 1 }}>
              {lang === "jp" ? `${countdown}秒後に自動で進みます` : `Auto-entering in ${countdown}s…`}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin          { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes scanLine      { 0%{top:0%;opacity:1} 100%{top:100%;opacity:0.1} }
        @keyframes avatarIdle    { 0%,100%{box-shadow:0 0 24px rgba(224,16,16,0.2)} 50%{box-shadow:0 0 40px rgba(224,16,16,0.35)} }
        @keyframes avatarSpeak   { from{box-shadow:0 0 40px rgba(224,16,16,0.4)} to{box-shadow:0 0 70px rgba(224,16,16,0.7)} }
        @keyframes wave          { from{transform:scaleY(0.4)} to{transform:scaleY(1.6)} }
        @keyframes cursorBlink   { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeSlideIn   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes enterPulse    { 0%,100%{box-shadow:0 0 0 0 rgba(224,16,16,0)} 50%{box-shadow:0 0 0 8px rgba(224,16,16,0)} }
      `}</style>
    </div>
  );
}
