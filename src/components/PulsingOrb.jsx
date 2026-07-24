import { useState, useEffect } from "react";
import { useJona } from "../context/JonaContext";

const TALK_SEQUENCE = [3, 4, 2, 4, 3, 1, 3, 4, 2, 1];
const FRAME_MS      = 130;
const FRAMES        = [1, 2, 3, 4];

export default function PulsingOrb({ onClick }) {
  const { jonaSpeaking } = useJona();
  const [frame, setFrame] = useState(0);

  // Preload all frames so there's no flash on first use
  useEffect(() => {
    FRAMES.forEach(n => { const img = new Image(); img.src = `/assets/jona${n}.png`; });
  }, []);

  useEffect(() => {
    if (!jonaSpeaking) { setFrame(0); return; }
    const id = setInterval(() => setFrame(f => (f + 1) % TALK_SEQUENCE.length), FRAME_MS);
    return () => clearInterval(id);
  }, [jonaSpeaking]);

  const jonaNum = jonaSpeaking ? TALK_SEQUENCE[frame] : 1;

  return (
    <div
      onClick={onClick}
      title={onClick ? "Talk to Jona" : undefined}
      style={{
        position: "relative", width: 280, height: 280, margin: "0 auto",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {/* Outer ambient rings */}
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: `${i * 14}px`,
            borderRadius: "50%",
            border: `1px solid rgba(224,16,16,${0.08 - i * 0.02})`,
            animation: `spin ${20 + i * 8}s linear infinite ${i % 2 === 0 ? "" : "reverse"}`,
          }}
        />
      ))}

      {/* Outer rotating dashed ring */}
      <div style={{
        position: "absolute", inset: 28, borderRadius: "50%",
        border: "1.5px dashed rgba(224,16,16,0.35)",
        animation: "spin 10s linear infinite",
        boxShadow: "0 0 8px rgba(224,16,16,0.15)",
      }}>
        {[0, 90, 180, 270].map((deg) => (
          <div key={deg} style={{ position: "absolute", inset: 0, transform: `rotate(${deg}deg)` }}>
            <div style={{
              position: "absolute", top: -3, left: "50%",
              width: 6, height: 6, borderRadius: "50%",
              background: "#e01010",
              transform: "translateX(-50%)",
              boxShadow: "0 0 8px #e01010, 0 0 16px rgba(224,16,16,0.5)",
            }} />
          </div>
        ))}
      </div>

      {/* Inner counter-rotating ring with tick marks */}
      <div style={{
        position: "absolute", inset: 44, borderRadius: "50%",
        border: "2px solid #e01010",
        animation: "spin 7s linear infinite reverse",
        boxShadow: jonaSpeaking
          ? "0 0 32px rgba(224,16,16,0.7), inset 0 0 12px rgba(224,16,16,0.2)"
          : "0 0 20px rgba(224,16,16,0.4), inset 0 0 10px rgba(224,16,16,0.1)",
        transition: "box-shadow 0.4s",
      }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <div key={deg} style={{ position: "absolute", inset: 0, transform: `rotate(${deg}deg)` }}>
            <div style={{
              position: "absolute", top: -1, left: "50%",
              width: deg % 90 === 0 ? 10 : 5,
              height: deg % 90 === 0 ? 3 : 2,
              background: deg % 90 === 0 ? "#e01010" : "rgba(224,16,16,0.5)",
              transform: "translateX(-50%)",
              boxShadow: deg % 90 === 0 ? "0 0 6px #e01010" : "none",
            }} />
          </div>
        ))}
      </div>

      {/* Jona face — all frames stacked, opacity toggle eliminates flash */}
      <div style={{
        position: "absolute", inset: 58, borderRadius: "50%",
        overflow: "hidden", background: "#0a0a0a",
        boxShadow: jonaSpeaking
          ? "0 0 60px rgba(224,16,16,0.8), inset 0 0 20px rgba(224,16,16,0.2)"
          : "0 0 40px rgba(224,16,16,0.5), inset 0 0 20px rgba(224,16,16,0.15)",
        animation: "pulse 3s ease-in-out infinite",
        transition: "box-shadow 0.4s",
      }}>
        {FRAMES.map(n => (
          <img
            key={n}
            src={`/assets/jona${n}.png`}
            alt={n === 1 ? "Jona" : ""}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "center 18%",
              opacity: n === jonaNum ? 1 : 0,
            }}
          />
        ))}
      </div>

      {/* Hover label when clickable and idle */}
      {onClick && (
        <div style={{
          position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)",
          fontSize: 10, color: "rgba(224,16,16,0.6)", letterSpacing: 1.5,
          textTransform: "uppercase", pointerEvents: "none",
          opacity: jonaSpeaking ? 0 : 0.8, transition: "opacity 0.3s",
          whiteSpace: "nowrap",
        }}>
          Talk to Jona ↑
        </div>
      )}

      <style>{`
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 30px rgba(224,16,16,0.4)} 50%{box-shadow:0 0 60px rgba(224,16,16,0.7)} }
      `}</style>
    </div>
  );
}
