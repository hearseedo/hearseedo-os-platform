import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { useAuth } from "../hooks/useAuth";

const BOOT_LINES = [
  "HSD OS v1.0 — INITIALISING...",
  "LOADING INTELLIGENCE LAYER...",
  "CALIBRATING VOICE SYSTEMS...",
  "SYNCING LEARNER PROFILE...",
  "ALL SYSTEMS ONLINE.",
];

function buildGreeting(name) {
  const first  = (name || "").split(" ")[0] || "there";
  const hour   = new Date().getHours();
  const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${period}, ${first}. All systems are online. Welcome to HSD OS. I'm ready when you are.`;
}

async function speakText(text) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
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
  const navigate = useNavigate();

  const [bootLines, setBootLines] = useState([]);
  const [bootDone, setBootDone]   = useState(false);
  const [speaking, setSpeaking]   = useState(false);
  const [done, setDone]           = useState(false);
  const audioRef = useRef(null);
  const didSpeak = useRef(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  // Boot sequence — type lines one by one
  useEffect(() => {
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
  }, []);

  // Once boot done + user loaded → speak greeting automatically
  // Browser allows autoplay here because the user just clicked Sign In
  useEffect(() => {
    if (!bootDone || !user?.name || didSpeak.current) return;
    didSpeak.current = true;
    const greeting = buildGreeting(user.name);
    setSpeaking(true);
    speakText(greeting)
      .then((audio) => {
        audioRef.current = audio;
        audio.play().catch(() => setSpeaking(false));
        audio.onended = () => {
          setSpeaking(false);
          audioRef.current = null;
          setDone(true);
        };
      })
      .catch(() => {
        setSpeaking(false);
        setDone(true);
      });
  }, [bootDone, user?.name]);

  const enterDashboard = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    navigate("/dashboard", { replace: true });
  };

  if (loading) return null;

  const greeting = user ? buildGreeting(user.name) : "";

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg,
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

        {/* Avatar */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 28 }}>
          {/* Outer orbit rings */}
          {[{ size: 160, dur: "5s", dir: "normal" }, { size: 190, dur: "9s", dir: "reverse" }].map((r, i) => (
            <div key={i} style={{
              position: "absolute",
              top: `calc(50% - ${r.size / 2}px)`,
              left: `calc(50% - ${r.size / 2}px)`,
              width: r.size, height: r.size,
              borderRadius: "50%",
              border: "1px solid rgba(224,16,16,0.12)",
              animation: `spin ${r.dur} linear infinite ${r.dir}`,
            }} />
          ))}

          {/* Avatar circle */}
          <div style={{
            width: 140, height: 140, borderRadius: "50%",
            border: `2px solid ${speaking ? "rgba(224,16,16,0.9)" : "rgba(224,16,16,0.4)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
            boxShadow: speaking
              ? "0 0 50px rgba(224,16,16,0.5), inset 0 0 30px rgba(224,16,16,0.08)"
              : "0 0 24px rgba(224,16,16,0.2), inset 0 0 20px rgba(224,16,16,0.04)",
            animation: speaking ? "avatarSpeak 0.8s ease-in-out infinite alternate" : "avatarIdle 3s ease-in-out infinite",
            transition: "border-color 0.4s, box-shadow 0.4s",
          }}>
            <img src="/assets/jarvis.png" alt="HSD AI" style={{ width: 128, height: 128, borderRadius: "50%", objectFit: "cover" }} />

            {/* Scanning line — shows while booting */}
            {!bootDone && (
              <div style={{
                position: "absolute", left: 0, right: 0, height: 2,
                background: "linear-gradient(90deg, transparent, rgba(224,16,16,0.9), transparent)",
                animation: "scanLine 1s ease-in-out infinite",
                pointerEvents: "none",
              }} />
            )}

            {/* Speaking waveform overlay */}
            {speaking && (
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 28,
                background: "rgba(0,0,0,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
              }}>
                {[...Array(9)].map((_, i) => (
                  <span key={i} style={{
                    display: "inline-block", width: 3, borderRadius: 2,
                    background: "#e01010",
                    animation: `wave 0.6s ${i * 0.07}s ease-in-out infinite alternate`,
                    height: `${5 + Math.sin(i) * 6 + 4}px`,
                  }} />
                ))}
              </div>
            )}

            {/* Corner brackets */}
            {[
              { top: 6, left: 6, borderTop: "2px solid #e01010", borderLeft: "2px solid #e01010" },
              { top: 6, right: 6, borderTop: "2px solid #e01010", borderRight: "2px solid #e01010" },
              { bottom: 6, left: 6, borderBottom: "2px solid #e01010", borderLeft: "2px solid #e01010" },
              { bottom: 6, right: 6, borderBottom: "2px solid #e01010", borderRight: "2px solid #e01010" },
            ].map((s, i) => (
              <div key={i} style={{ position: "absolute", width: 14, height: 14, ...s }} />
            ))}
          </div>
        </div>

        {/* Brand label */}
        <div style={{ fontSize: 10, color: COLORS.red, letterSpacing: 5, textTransform: "uppercase", marginBottom: 2 }}>HEAR SEE DO™</div>
        <div style={{ fontSize: 9, color: COLORS.textDim, letterSpacing: 3, marginBottom: 24 }}>OS AI</div>

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

        {/* Enter button — appears when voice done (or after delay) */}
        {(done || (!speaking && bootDone)) && (
          <button
            onClick={enterDashboard}
            style={{
              padding: "14px 48px",
              background: "transparent",
              border: "1px solid rgba(224,16,16,0.6)",
              borderRadius: 40, color: COLORS.red,
              fontSize: 13, fontWeight: 600, letterSpacing: 2,
              textTransform: "uppercase", cursor: "pointer",
              animation: "fadeSlideIn 0.5s ease, enterPulse 2.5s ease-in-out infinite",
              transition: "background 0.2s, border-color 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(224,16,16,0.12)"; e.currentTarget.style.borderColor = "#e01010"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(224,16,16,0.6)"; }}
          >
            ENTER THE OS
          </button>
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
