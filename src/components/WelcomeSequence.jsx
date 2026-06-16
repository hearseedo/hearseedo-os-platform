import { useState, useEffect, useCallback, useRef } from "react";
import { getWelcomeLine } from "../constants/bundles";

// AudioContext — unlocked on first user gesture, persists across calls
let _ctx = null;
let _pendingBuffer = null;

function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}

async function _playBuffer(arrayBuffer) {
  const ctx = getCtx();
  if (ctx.state === "suspended") {
    _pendingBuffer = arrayBuffer; // will play when user taps
    return;
  }
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.connect(ctx.destination);
    src.start(0);
  } catch {}
}

export async function unlockAndFlush() {
  const ctx = getCtx();
  await ctx.resume();
  if (_pendingBuffer) {
    const ab = _pendingBuffer;
    _pendingBuffer = null;
    _playBuffer(ab);
  }
}

async function playWelcomeVoice(text) {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    await _playBuffer(await res.arrayBuffer());
  } catch {}
}

// For AI chat — call this with any text to get Jarvis to speak
export async function speakAsJarvis(text) {
  return playWelcomeVoice(text);
}

function useTypewriter(text, speed = 45, active = true) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!active) { setDisplayed(text); return; }
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      setDisplayed(text.slice(0, ++i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, active]);
  return displayed;
}

const STEPS = {
  FADE_IN:    0,
  ORB:        1,
  SCANLINE:   2,
  LINE1:      3,
  LINE2:      4,
  LINE3:      5,
  LINE4:      6,
  SLIDE_OUT:  7,
  DONE:       8,
};

export default function WelcomeSequence({ user, onComplete }) {
  const [step, setStep]     = useState(STEPS.FADE_IN);
  const [skipped, setSkipped] = useState(false);

  // Unlock AudioContext on first interaction (tap, click, touchstart)
  useEffect(() => {
    const handler = () => unlockAndFlush();
    document.addEventListener("click",      handler, { once: true });
    document.addEventListener("touchstart", handler, { once: true });
    return () => {
      document.removeEventListener("click",      handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  const firstName    = user?.name?.split(" ")[0] ?? "there";
  const confidence   = user?.confidenceScore ?? 0;
  const streak       = user?.streak ?? 0;
  const contextLine  = getWelcomeLine(user?.plan, user?.subscriptions);

  const line1 = "IDENTITY CONFIRMED.";
  const line2 = `WELCOME BACK, ${firstName.toUpperCase()}.`;
  const line3 = `Confidence score: ${confidence}%  •  Current streak: ${streak} days`;
  const line4 = contextLine;

  const skip = useCallback(() => {
    setSkipped(true);
    setStep(STEPS.DONE);
    onComplete();
  }, [onComplete]);

  // Auto-advance through steps
  useEffect(() => {
    const delays = {
      [STEPS.FADE_IN]:   600,   // fade in
      [STEPS.ORB]:      1200,   // orb appears, pause to admire
      [STEPS.SCANLINE]:  600,   // scan sweep
      [STEPS.LINE1]:    2200,   // "IDENTITY CONFIRMED." — let it sit
      [STEPS.LINE2]:    2400,   // "WELCOME BACK, NAME." — dramatic pause
      [STEPS.LINE3]:    2800,   // confidence + streak line
      [STEPS.LINE4]:    3000,   // context/plan line
      [STEPS.SLIDE_OUT]: 600,   // fade out
    };
    if (step === STEPS.DONE) return;
    const id = setTimeout(() => setStep((s) => s + 1), delays[step] ?? 400);
    return () => clearTimeout(id);
  }, [step]);

  // Voice
  useEffect(() => {
    if (step === STEPS.LINE1) playWelcomeVoice(line1);
    if (step === STEPS.LINE2) playWelcomeVoice(line2);
    if (step === STEPS.LINE3) playWelcomeVoice(line3);
    if (step === STEPS.LINE4) playWelcomeVoice(line4);
  }, [step]);

  useEffect(() => {
    if (step === STEPS.SLIDE_OUT) onComplete();
  }, [step, onComplete]);

  const tLine1 = useTypewriter(line1, 45, step >= STEPS.LINE1 && !skipped);
  const tLine2 = useTypewriter(line2, 45, step >= STEPS.LINE2 && !skipped);
  const tLine3 = useTypewriter(line3, 30, step >= STEPS.LINE3 && !skipped);
  const tLine4 = useTypewriter(line4, 35, step >= STEPS.LINE4 && !skipped);

  if (step === STEPS.DONE) return null;

  const isExiting = step >= STEPS.SLIDE_OUT;

  return (
    <div
      onClick={skip}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#000",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? "scale(1.18)" : "scale(1)",
        filter: isExiting ? "blur(12px)" : "blur(0)",
        transition: isExiting
          ? "opacity 0.65s ease, transform 0.65s cubic-bezier(0.4,0,1,1), filter 0.65s ease"
          : step === STEPS.FADE_IN ? "opacity 0.4s ease" : "none",
        pointerEvents: isExiting ? "none" : "auto",
      }}
    >
      {/* Scan line */}
      {step === STEPS.SCANLINE && (
        <div style={{
          position: "absolute", left: 0, right: 0, height: 2,
          background: "rgba(224,16,16,0.4)",
          animation: "scanline 0.5s linear forwards",
          pointerEvents: "none",
        }} />
      )}

      {/* Orb */}
      {step >= STEPS.ORB && (
        <div style={{
          animation: "orbIn 0.8s cubic-bezier(0.16,1,0.3,1) forwards",
          marginBottom: 48,
        }}>
          <OrbMini />
        </div>
      )}

      {/* Text lines */}
      <div style={{ fontFamily: "monospace", textAlign: "center", maxWidth: 600, padding: "0 24px" }}>
        {step >= STEPS.LINE1 && (
          <div style={{ fontSize: 18, color: "#e01010", letterSpacing: 2, marginBottom: 12, minHeight: 28 }}>
            {tLine1}
            {step === STEPS.LINE1 && <Cursor />}
          </div>
        )}
        {step >= STEPS.LINE2 && (
          <div style={{ fontSize: 18, color: "#e01010", letterSpacing: 2, marginBottom: 24, minHeight: 28 }}>
            {tLine2}
            {step === STEPS.LINE2 && <Cursor />}
          </div>
        )}
        {step >= STEPS.LINE3 && (
          <div style={{ fontSize: 13, color: "#ffffff", letterSpacing: 1, marginBottom: 12, minHeight: 22 }}>
            {tLine3}
            {step === STEPS.LINE3 && <Cursor />}
          </div>
        )}
        {step >= STEPS.LINE4 && (
          <div style={{ fontSize: 13, color: "#888", letterSpacing: 1, minHeight: 22 }}>
            {tLine4}
            {step === STEPS.LINE4 && <Cursor />}
          </div>
        )}
      </div>

      <div style={{ position: "absolute", bottom: 32, fontSize: 11, color: "#333", letterSpacing: 2 }}>
        TAP ANYWHERE TO SKIP
      </div>

      <style>{`
        @keyframes orbIn {
          from { opacity: 0; transform: scale(0.3); filter: blur(12px); }
          to   { opacity: 1; transform: scale(1);   filter: blur(0); }
        }
        @keyframes scanline {
          from { top: 0; }
          to   { top: 100%; }
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%     { opacity: 0; }
        }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 20px rgba(224,16,16,0.3)} 50%{opacity:0.8;box-shadow:0 0 40px rgba(224,16,16,0.6)} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 20px rgba(224,16,16,0.4)} 50%{box-shadow:0 0 40px rgba(224,16,16,0.7)} }
      `}</style>
    </div>
  );
}

function Cursor() {
  return <span style={{ display: "inline-block", width: 2, height: "1em", background: "#e01010", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 0.7s step-end infinite" }} />;
}

function OrbMini() {
  return (
    <div style={{ position: "relative", width: 180, height: 180 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          position: "absolute", inset: `${i * 14}px`,
          borderRadius: "50%",
          border: `1px solid rgba(224,16,16,${0.2 - i * 0.05})`,
          animation: `spin ${8 + i * 3}s linear infinite ${i % 2 ? "reverse" : ""}`,
        }} />
      ))}
      <div style={{
        position: "absolute", inset: 28, borderRadius: "50%",
        border: "2px solid #e01010",
        boxShadow: "0 0 20px #e01010, inset 0 0 20px rgba(224,16,16,0.1)",
        animation: "pulse 2s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", inset: 40, borderRadius: "50%",
        overflow: "hidden",
        boxShadow: "0 0 30px rgba(224,16,16,0.5)",
      }}>
        <img src="/assets/jarvis.png" alt="Jarvis" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    </div>
  );
}
