import { useState, useEffect, useCallback, useRef } from "react";
import { getWelcomeLine } from "../constants/bundles";

// ── Web Audio beep (no fetch, no autoplay issues after user gesture) ────────
let _ctx = null;
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}
export async function unlockAudio() {
  const ctx = getCtx();
  if (ctx.state === "suspended") await ctx.resume();
}
function beep(freq = 880, dur = 0.04, vol = 0.08) {
  try {
    const ctx  = getCtx();
    if (ctx.state !== "running") return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = "square";
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch {}
}
function chime() {
  // Two-tone chime for line completion
  beep(660, 0.08, 0.12);
  setTimeout(() => beep(880, 0.12, 0.1), 80);
}

// ── Glitch typewriter — scrambles before resolving ─────────────────────────
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
function useGlitchTypewriter(text, speed = 38, active = true) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!active) { setDisplayed(text); return; }
    setDisplayed("");
    let revealed = 0;
    let glitchCount = 0;
    const id = setInterval(() => {
      if (revealed >= text.length) { clearInterval(id); chime(); return; }
      // Each char glitches 2–3 times before locking
      if (glitchCount < 2) {
        const scrambled = text.slice(0, revealed) +
          CHARS[Math.floor(Math.random() * CHARS.length)] +
          (revealed + 1 < text.length ? "█" : "");
        setDisplayed(scrambled);
        beep(200 + Math.random() * 600, 0.02, 0.05);
        glitchCount++;
      } else {
        glitchCount = 0;
        revealed++;
        setDisplayed(text.slice(0, revealed));
        if (text[revealed - 1] !== " ") beep(880, 0.03, 0.07);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, active]);
  return displayed;
}

// ── Counting number animation ──────────────────────────────────────────────
function useCountUp(target, duration = 1200, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active || target === 0) { if (active) setVal(target); return; }
    const steps = 40;
    const step  = target / steps;
    let cur = 0;
    const id = setInterval(() => {
      cur = Math.min(cur + step, target);
      setVal(Math.round(cur));
      beep(300 + cur * 3, 0.02, 0.04);
      if (cur >= target) clearInterval(id);
    }, duration / steps);
    return () => clearInterval(id);
  }, [target, active]);
  return val;
}

// ── Particles ──────────────────────────────────────────────────────────────
function Particles({ active }) {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    angle: (i / 18) * 360,
    dist:  60 + Math.random() * 80,
    size:  2 + Math.random() * 3,
    dur:   0.6 + Math.random() * 0.4,
  }));
  if (!active) return null;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: p.size, height: p.size,
          borderRadius: "50%",
          background: "#e01010",
          boxShadow: "0 0 6px #e01010",
          animation: `particle${i} ${p.dur}s ease-out forwards`,
        }} />
      ))}
      <style>{particles.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const tx  = Math.cos(rad) * p.dist;
        const ty  = Math.sin(rad) * p.dist;
        return `@keyframes particle${i} {
          0%   { transform: translate(-50%,-50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0); opacity: 0; }
        }`;
      }).join("")}</style>
    </div>
  );
}

const STEPS = {
  FADE_IN:   0,
  ORB:       1,
  SCANLINE:  2,
  LINE1:     3,
  LINE2:     4,
  LINE3:     5,
  LINE4:     6,
  SLIDE_OUT: 7,
  DONE:      8,
};

export default function WelcomeSequence({ user, onComplete }) {
  const [step, setStep]         = useState(STEPS.FADE_IN);
  const [skipped, setSkipped]   = useState(false);
  const [started, setStarted]   = useState(false);
  const [particles, setParticles] = useState(false);

  const firstName  = user?.name?.split(" ")[0] ?? "there";
  const confidence = user?.confidenceScore ?? 0;
  const streak     = user?.streak ?? 0;
  const contextLine = getWelcomeLine(user?.plan, user?.subscriptions);

  const line1 = "IDENTITY CONFIRMED.";
  const line2 = `WELCOME BACK, ${firstName.toUpperCase()}.`;
  const line3 = `CONFIDENCE SCORE: ${confidence}%  •  STREAK: ${streak} DAYS`;
  const line4 = contextLine.toUpperCase();

  // Tap → unlock audio → start
  const begin = useCallback(async (e) => {
    e.stopPropagation();
    await unlockAudio();
    setStarted(true);
  }, []);

  const skip = useCallback(() => {
    setSkipped(true);
    setStep(STEPS.DONE);
    onComplete();
  }, [onComplete]);

  // Particle burst when LINE1 hits
  useEffect(() => {
    if (step === STEPS.LINE1) {
      setTimeout(() => setParticles(true), 800);
      setTimeout(() => setParticles(false), 1400);
    }
  }, [step]);

  // Auto-advance
  useEffect(() => {
    if (!started) return;
    const delays = {
      [STEPS.FADE_IN]:   500,
      [STEPS.ORB]:      1000,
      [STEPS.SCANLINE]:  500,
      [STEPS.LINE1]:    2400,
      [STEPS.LINE2]:    2600,
      [STEPS.LINE3]:    2800,
      [STEPS.LINE4]:    2800,
      [STEPS.SLIDE_OUT]: 700,
    };
    if (step === STEPS.DONE) return;
    const id = setTimeout(() => setStep((s) => s + 1), delays[step] ?? 400);
    return () => clearTimeout(id);
  }, [step, started]);

  useEffect(() => {
    if (step === STEPS.SLIDE_OUT) onComplete();
  }, [step, onComplete]);

  const tLine1 = useGlitchTypewriter(line1, 38, step >= STEPS.LINE1 && !skipped);
  const tLine2 = useGlitchTypewriter(line2, 38, step >= STEPS.LINE2 && !skipped);

  const confCount  = useCountUp(confidence, 1000, step >= STEPS.LINE3 && !skipped);
  const streakCount = useCountUp(streak, 800, step >= STEPS.LINE3 && !skipped);

  const tLine4 = useGlitchTypewriter(line4, 32, step >= STEPS.LINE4 && !skipped);

  if (step === STEPS.DONE) return null;

  // ── Splash screen ──────────────────────────────────────────────────────
  if (!started) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#000",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        animation: "wsqFadeIn 0.6s ease",
      }}>
        {/* Grid */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(224,16,16,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(224,16,16,0.04) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <OrbMini pulse />
        <div style={{ marginTop: 52, fontFamily: "monospace", fontSize: 11, color: "#e01010", letterSpacing: 5, textTransform: "uppercase", animation: "wsqBlink 1.4s step-end infinite" }}>
          SYSTEM READY
        </div>
        <button onClick={begin} style={{
          marginTop: 28, padding: "15px 52px",
          background: "#e01010", border: "none", borderRadius: 40,
          color: "#fff", fontSize: 13, fontWeight: 700,
          letterSpacing: 3, textTransform: "uppercase", cursor: "pointer",
          boxShadow: "0 0 40px rgba(224,16,16,0.6)",
          animation: "wsqPulseBtn 2s ease-in-out infinite",
        }}>
          ▶ ENTER HSD OS
        </button>
        <div style={{ marginTop: 20, fontSize: 10, color: "#333", letterSpacing: 2, fontFamily: "monospace" }}>
          TAP TO INITIALISE
        </div>
        <style>{`
          @keyframes wsqFadeIn    { from{opacity:0} to{opacity:1} }
          @keyframes wsqBlink     { 0%,100%{opacity:1} 50%{opacity:0} }
          @keyframes wsqSpin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes wsqPulse     { 0%,100%{box-shadow:0 0 20px rgba(224,16,16,0.3)} 50%{box-shadow:0 0 50px rgba(224,16,16,0.7)} }
          @keyframes wsqPulseBtn  { 0%,100%{box-shadow:0 0 20px rgba(224,16,16,0.4),0 0 0 0 rgba(224,16,16,0)} 50%{box-shadow:0 0 40px rgba(224,16,16,0.7),0 0 0 10px rgba(224,16,16,0)} }
        `}</style>
      </div>
    );
  }

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
        transform: isExiting ? "scale(1.15)" : "scale(1)",
        filter: isExiting ? "blur(14px)" : "blur(0)",
        transition: isExiting ? "opacity 0.7s ease, transform 0.7s ease, filter 0.7s ease" : "none",
        pointerEvents: isExiting ? "none" : "auto",
      }}
    >
      {/* Grid background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(224,16,16,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(224,16,16,0.03) 1px,transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Scan line sweep */}
      {step === STEPS.SCANLINE && (
        <div style={{
          position: "absolute", left: 0, right: 0, height: 3,
          background: "linear-gradient(90deg, transparent, rgba(224,16,16,0.8), transparent)",
          animation: "wsqScanline 0.5s linear forwards",
          pointerEvents: "none", zIndex: 2,
        }} />
      )}

      {/* Orb + particles */}
      {step >= STEPS.ORB && (
        <div style={{ position: "relative", marginBottom: 48, animation: "wsqOrbIn 0.8s cubic-bezier(0.16,1,0.3,1) forwards" }}>
          <Particles active={particles} />
          <OrbMini pulse={step >= STEPS.LINE1} speaking={step >= STEPS.LINE2} />
        </div>
      )}

      {/* Text block */}
      <div style={{ fontFamily: "monospace", textAlign: "center", maxWidth: 640, padding: "0 24px" }}>

        {/* LINE 1 — glitch */}
        {step >= STEPS.LINE1 && (
          <div style={{
            fontSize: 20, fontWeight: 700, letterSpacing: 3, marginBottom: 10,
            color: "#e01010",
            textShadow: step === STEPS.LINE1 ? "0 0 20px rgba(224,16,16,0.8)" : "0 0 8px rgba(224,16,16,0.4)",
            minHeight: 32,
            transition: "text-shadow 0.5s",
          }}>
            {tLine1}{step === STEPS.LINE1 && <Cursor />}
          </div>
        )}

        {/* LINE 2 — glitch */}
        {step >= STEPS.LINE2 && (
          <div style={{
            fontSize: 20, fontWeight: 700, letterSpacing: 3, marginBottom: 28,
            color: "#e01010",
            textShadow: "0 0 12px rgba(224,16,16,0.5)",
            minHeight: 32,
          }}>
            {tLine2}{step === STEPS.LINE2 && <Cursor />}
          </div>
        )}

        {/* LINE 3 — stat counters */}
        {step >= STEPS.LINE3 && (
          <div style={{
            display: "flex", justifyContent: "center", gap: 40, marginBottom: 20,
            animation: "wsqFadeUp 0.5s ease forwards",
          }}>
            <StatBox label="CONFIDENCE" value={confCount} suffix="%" color="#e01010" />
            <StatBox label="STREAK" value={streakCount} suffix=" DAYS" color="#fff" />
          </div>
        )}

        {/* LINE 4 — context */}
        {step >= STEPS.LINE4 && (
          <div style={{
            fontSize: 11, color: "#555", letterSpacing: 2, minHeight: 20,
            animation: "wsqFadeUp 0.4s ease forwards",
          }}>
            {tLine4}{step === STEPS.LINE4 && <Cursor dim />}
          </div>
        )}
      </div>

      <div style={{ position: "absolute", bottom: 28, fontSize: 10, color: "#2a2a2a", letterSpacing: 3, fontFamily: "monospace" }}>
        TAP ANYWHERE TO SKIP
      </div>

      <style>{`
        @keyframes wsqSpin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes wsqPulse    { 0%,100%{box-shadow:0 0 20px rgba(224,16,16,0.3),inset 0 0 10px rgba(224,16,16,0.05)} 50%{box-shadow:0 0 50px rgba(224,16,16,0.7),inset 0 0 20px rgba(224,16,16,0.1)} }
        @keyframes wsqScanline { from{top:0;opacity:1} to{top:100%;opacity:0.2} }
        @keyframes wsqOrbIn    { from{opacity:0;transform:scale(0.2) rotate(-20deg);filter:blur(20px)} to{opacity:1;transform:scale(1) rotate(0deg);filter:blur(0)} }
        @keyframes wsqBlink    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes wsqFadeUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes wsqSpeak    { 0%,100%{box-shadow:0 0 30px rgba(224,16,16,0.4)} 50%{box-shadow:0 0 80px rgba(224,16,16,0.9),0 0 120px rgba(224,16,16,0.3)} }
      `}</style>
    </div>
  );
}

function Cursor({ dim }) {
  return (
    <span style={{
      display: "inline-block", width: 2, height: "1em",
      background: dim ? "#555" : "#e01010",
      marginLeft: 3, verticalAlign: "text-bottom",
      animation: "wsqBlink 0.7s step-end infinite",
    }} />
  );
}

function StatBox({ label, value, suffix, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "monospace", letterSpacing: 1, lineHeight: 1 }}>
        {value}{suffix}
      </div>
      <div style={{ fontSize: 9, color: "#444", letterSpacing: 3, marginTop: 6 }}>{label}</div>
    </div>
  );
}

function OrbMini({ pulse, speaking }) {
  return (
    <div style={{ position: "relative", width: 180, height: 180 }}>
      {/* Orbit rings */}
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          position: "absolute", inset: `${i * 12}px`,
          borderRadius: "50%",
          border: `1px solid rgba(224,16,16,${0.18 - i * 0.04})`,
          animation: `wsqSpin ${7 + i * 4}s linear infinite ${i % 2 ? "reverse" : ""}`,
        }} />
      ))}
      {/* Glow ring */}
      <div style={{
        position: "absolute", inset: 26, borderRadius: "50%",
        border: "2px solid #e01010",
        animation: speaking ? "wsqSpeak 0.6s ease-in-out infinite" : pulse ? "wsqPulse 2s ease-in-out infinite" : "wsqPulse 3s ease-in-out infinite",
      }} />
      {/* Avatar */}
      <div style={{
        position: "absolute", inset: 38, borderRadius: "50%",
        overflow: "hidden",
        boxShadow: "0 0 30px rgba(224,16,16,0.4)",
      }}>
        <img src="/assets/jona.png" alt="Jona" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      {/* Corner brackets */}
      {[
        { top: 16, left: 16, borderTop: "2px solid #e01010", borderLeft: "2px solid #e01010" },
        { top: 16, right: 16, borderTop: "2px solid #e01010", borderRight: "2px solid #e01010" },
        { bottom: 16, left: 16, borderBottom: "2px solid #e01010", borderLeft: "2px solid #e01010" },
        { bottom: 16, right: 16, borderBottom: "2px solid #e01010", borderRight: "2px solid #e01010" },
      ].map((s, i) => (
        <div key={i} style={{ position: "absolute", width: 16, height: 16, ...s }} />
      ))}
    </div>
  );
}
