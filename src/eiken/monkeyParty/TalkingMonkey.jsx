// Monkey Party — reusable talking-monkey avatar.
// Lightweight 2D animation over the existing static monkey art (no 3D, no
// sprite sheets): CSS transforms + a Web Audio AnalyserNode reading the
// ElevenLabs <audio> element's live volume drive a mouth-shaped overlay.
// Reuses MONKEY_IMAGES from companions.js — no new character art.
import { useEffect, useRef, useState } from "react";
import { MONKEY_IMAGES } from "../companions";

// state:   "idle" | "listening" | "thinking" | "correct" | "try_again" | "celebration"
// speaking: whether Jonathan AI's voice is currently playing (drives the
//   mouth overlay) — independent of `state`, so e.g. "celebration" + speaking
//   can render together instead of one clobbering the other.
export default function TalkingMonkey({ monkey = "milo", state = "idle", speaking = false, audioEl, size = 120 }) {
  const [mouthOpen, setMouthOpen] = useState(0); // 0-1
  const [blink, setBlink] = useState(false);
  const rafRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Natural blinking, independent of speaking state.
  useEffect(() => {
    const blinkLoop = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    };
    const interval = setInterval(blinkLoop, 2600 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  // Mouth movement driven by real audio volume while speaking.
  useEffect(() => {
    if (!speaking || !audioEl) {
      setMouthOpen(0);
      return;
    }

    let ctx, analyser, source;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source = ctx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      // Some browsers throw if a MediaElementSource is already attached to
      // this element (e.g. re-render) — fail silently into a static mouth
      // rather than crashing the game.
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / data.length;
      setMouthOpen(Math.min(1, avg / 90));
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      try { source.disconnect(); analyser.disconnect(); ctx.close(); } catch {}
    };
  }, [speaking, audioEl]);

  const glow = speaking ? "0 0 24px rgba(74,144,232,0.5)" : {
    idle: "none",
    listening: "0 0 24px rgba(255,215,0,0.5)",
    thinking: "0 0 20px rgba(155,108,232,0.5)",
    correct: "0 0 28px rgba(34,197,94,0.6)",
    try_again: "0 0 20px rgba(255,255,255,0.25)",
    celebration: "0 0 32px rgba(255,215,0,0.8)",
  }[state] ?? "none";

  const bounce = state === "celebration" || state === "correct";
  const pulse = state === "listening" || state === "thinking";

  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-block" }}>
      <img
        src={MONKEY_IMAGES[monkey]}
        alt=""
        style={{
          width: size, height: size, objectFit: "contain",
          filter: `drop-shadow(${glow})`,
          animation: bounce ? "bounce 0.6s ease infinite" : pulse ? "pulse 1.4s ease-in-out infinite" : "float 3s ease-in-out infinite",
          transform: blink ? "scaleY(0.97)" : "scaleY(1)",
          transition: "transform 0.08s ease",
        }}
      />
      {/* Mouth overlay: a simple dark ellipse near the lower-third of the
          image, scaling with live audio volume while speaking. Approximate
          positioning works across the 4 existing character portraits without
          needing per-character coordinate tuning. */}
      {speaking && (
        <div style={{
          position: "absolute", left: "50%", bottom: size * 0.28,
          transform: `translateX(-50%) scaleY(${0.4 + mouthOpen * 1.1})`,
          width: size * 0.16, height: size * 0.07,
          borderRadius: "50%", background: "rgba(80,30,20,0.55)",
          transition: "transform 0.05s linear",
        }} />
      )}
      {state === "listening" && (
        <div style={{
          position: "absolute", inset: -6, borderRadius: "50%",
          border: "2px solid rgba(255,215,0,0.6)", animation: "pulse 1s ease-in-out infinite",
        }} />
      )}
      {state === "thinking" && (
        <div style={{ position:"absolute", top:-6, right:-6, fontSize: size*0.18 }}>💭</div>
      )}
      {(state === "celebration" || state === "correct") && (
        <div style={{ position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)", fontSize: size*0.2 }}>
          {state === "celebration" ? "🎉" : "✨"}
        </div>
      )}
    </div>
  );
}
