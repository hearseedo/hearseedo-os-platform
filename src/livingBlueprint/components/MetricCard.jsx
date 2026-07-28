import { TOKENS } from "../../constants/tokens";

export default function MetricCard({ label, value, sub }) {
  return (
    <div style={{
      flex: 1, minWidth: 120, padding: TOKENS.space[4], borderRadius: TOKENS.radius.lg,
      border: `1px solid ${TOKENS.color.border}`, background: TOKENS.color.surfaceRaised,
    }}>
      <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: TOKENS.font.size.xl, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
