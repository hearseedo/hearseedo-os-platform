import { COLORS } from "../constants/colors";

export default function ConfidenceRing({ score }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div style={{ position: "relative", width: 130, height: 130 }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#2a2a2a" strokeWidth="8" />
        <circle
          cx="65" cy="65" r={r}
          fill="none"
          stroke={COLORS.red}
          strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 6px #e01010)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 26, fontWeight: 800, color: COLORS.red }}>{score}%</span>
        <span style={{ fontSize: 10, color: COLORS.red, fontWeight: 600 }}>Amazing!</span>
      </div>
    </div>
  );
}
