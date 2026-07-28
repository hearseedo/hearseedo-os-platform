import { useMemo } from "react";

// Reusable particle burst. Renders a spray of colored dots animating outward
// from the center of the nearest positioned parent. Pass a unique `prefix` per
// instance so CSS @keyframe names never collide across simultaneous bursts.
export default function Particles({
  active,
  count   = 24,
  colors  = ["#e01010"],
  spread  = 140,
  prefix  = "par",
}) {
  const ps = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * 360 + (Math.random() - 0.5) * (360 / count) * 0.6,
        dist:  spread * (0.45 + Math.random() * 0.65),
        size:  2 + Math.random() * 3.5,
        dur:   0.5 + Math.random() * 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      })),
    [active], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!active) return null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {ps.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: p.size, height: p.size,
            borderRadius: "50%",
            background: p.color,
            boxShadow: `0 0 6px ${p.color}`,
            animation: `${prefix}${i} ${p.dur}s ease-out forwards`,
          }}
        />
      ))}
      <style>{
        ps.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180;
          const tx  = Math.cos(rad) * p.dist;
          const ty  = Math.sin(rad) * p.dist;
          return `@keyframes ${prefix}${i} {
            0%   { transform:translate(-50%,-50%) scale(1); opacity:1; }
            100% { transform:translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(0); opacity:0; }
          }`;
        }).join("")
      }</style>
    </div>
  );
}
