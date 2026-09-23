// Shared small pieces for the Educator pages.
import { EDU_COLORS } from "./theme";

export function SectionTitle({ eyebrow, title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {eyebrow && (
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: EDU_COLORS.primary, marginBottom: 6 }}>
          {eyebrow}
        </div>
      )}
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 6px", color: EDU_COLORS.text }}>{title}</h2>
      {subtitle && <p style={{ color: EDU_COLORS.textMuted, fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 620 }}>{subtitle}</p>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const styles = {
    available: { label: "Available now", bg: EDU_COLORS.primarySoft, color: EDU_COLORS.primary },
    coming_soon: { label: "Coming Soon", bg: EDU_COLORS.amberSoft, color: EDU_COLORS.amber },
    demo: { label: "Demo data", bg: "#eef0ee", color: EDU_COLORS.textMuted },
  };
  const s = styles[status] ?? styles.coming_soon;
  return (
    <span style={{ display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", padding: "4px 10px", borderRadius: 999, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export function Card({ children, style }) {
  return (
    <div style={{ background: EDU_COLORS.card, border: `1px solid ${EDU_COLORS.border}`, borderRadius: 16, padding: 22, ...style }}>
      {children}
    </div>
  );
}
