import { useEffect } from "react";
import Particles from "./Particles";

// ── Celebration presets ────────────────────────────────────────────────────
export const CEL = {
  all_missions: {
    emoji:    "🎯",
    title:    "All missions complete!",
    subtitle: "You showed up today. That's what counts.",
    colors:   ["#22c55e", "#16a34a", "#86efac"],
    duration: 2800,
  },
  streak_7: {
    emoji:    "🔥",
    title:    "7-day streak!",
    subtitle: "One full week of English practice.",
    colors:   ["#f97316", "#ea580c", "#fed7aa"],
    duration: 2800,
  },
  streak_30: {
    emoji:    "🔥🔥🔥",
    title:    "30-day streak!",
    subtitle: "A full month of consistency. Incredible.",
    colors:   ["#f97316", "#e01010", "#C9A84C"],
    duration: 3200,
  },
  first_lesson: {
    emoji:    "⭐",
    title:    "First lesson complete!",
    subtitle: "Your journey begins. Keep going.",
    colors:   ["#C9A84C", "#f59e0b", "#fde68a"],
    duration: 2800,
  },
  new_cefr: (level) => ({
    emoji:    "📈",
    title:    `${level} unlocked!`,
    subtitle: "Your English confidence just leveled up.",
    colors:   ["#C9A84C", "#22c55e", "#f59e0b"],
    duration: 2800,
  }),
};

// ── Component ──────────────────────────────────────────────────────────────
export default function CelebrationOverlay({ celebration, onDismiss }) {
  const { emoji, title, subtitle, colors = ["#e01010"], duration = 2500 } = celebration;

  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 450,
        background: "rgba(0,0,0,0.78)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)",
        cursor: "pointer",
        animation: "celFadeIn 0.3s ease forwards",
      }}
    >
      <style>{`
        @keyframes celFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes celScaleIn { from { opacity:0; transform:scale(0.65) } to { opacity:1; transform:scale(1) } }
      `}</style>

      {/* Particle burst fixed to viewport center */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        <Particles active count={36} colors={colors} spread={230} prefix="cel" />
      </div>

      {/* Content */}
      <div
        style={{
          textAlign: "center", padding: "0 32px",
          animation: "celScaleIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: 76, lineHeight: 1, marginBottom: 22 }}>{emoji}</div>
        <div style={{
          fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 10,
          textShadow: "0 0 40px rgba(255,255,255,0.25)",
          letterSpacing: -0.5,
        }}>
          {title}
        </div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.65 }}>
          {subtitle}
        </div>
        <div style={{ marginTop: 28, fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: 1 }}>
          TAP TO CONTINUE
        </div>
      </div>
    </div>
  );
}
