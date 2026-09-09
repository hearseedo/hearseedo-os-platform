import { COLORS } from "../constants/colors";

export function Card({ children, style }) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function StatCard({ label, value, trend }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: COLORS.textDim, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>{value}</div>
      {trend && <div style={{ fontSize: 11, color: COLORS.success, marginTop: 4 }}>{trend}</div>}
    </div>
  );
}

export function PageTitle({ eyebrow, title, subtitle }) {
  return (
    <div style={{ marginBottom: 4 }}>
      {eyebrow && (
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: COLORS.red, marginBottom: 6 }}>
          {eyebrow}
        </div>
      )}
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>{title}</h1>
      {subtitle && <p style={{ color: COLORS.textMuted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{subtitle}</p>}
    </div>
  );
}
