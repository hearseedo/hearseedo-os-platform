import { COLORS } from "../constants/colors";

export default function ProgressBar({ current, total, color = COLORS.red }) {
  const pct = Math.min(100, Math.round((current / total) * 100));
  return (
    <div style={{ width: "100%", height: 4, background: "#2a2a2a", borderRadius: 2, overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: 2,
          transition: "width 0.5s ease",
          boxShadow: `0 0 6px ${color}`,
        }}
      />
    </div>
  );
}
