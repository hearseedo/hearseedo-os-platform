import { TOKENS } from "../../constants/tokens";
import { useLang } from "../../hooks/useLang";

// Rebuild prompt section 4/7 — Family Calendar. Previously wrapped the
// legacy Events component, but its EVENTS list is hand-maintained demo
// content (mostly already-past dates) — showing it here read as fake
// scheduled events rather than an honest "nothing planned yet" state.
// components/Events.jsx is left untouched (it's a separate, shared, live
// surface); this page just no longer borrows its stale placeholder content.
export default function CalendarPanel() {
  const { t } = useLang();
  return (
    <div>
      <div style={{ marginBottom: TOKENS.space[5] }}>
        <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 4 }}>{t("lb_calendar_label")}</div>
        <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800 }}>{t("lb_upcoming_events")}</h1>
      </div>
      <div style={{
        padding: "60px 20px", textAlign: "center", borderRadius: TOKENS.radius.lg,
        border: `1px solid ${TOKENS.color.border}`, background: TOKENS.color.surfaceRaised,
      }}>
        <div style={{ fontWeight: 700, fontSize: TOKENS.font.size.lg, marginBottom: 6 }}>{t("lb_nothing_planned")}</div>
        <div style={{ color: TOKENS.color.textMuted, fontSize: TOKENS.font.size.sm }}>
          {t("lb_calendar_empty_desc")}
        </div>
      </div>
    </div>
  );
}
