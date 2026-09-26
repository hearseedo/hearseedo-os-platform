// Adults demo pathway — results screen. The "ticket" is built only from
// slots the visitor's own messages actually established (state.order) —
// never an idealized order. Labelled as practice throughout, never
// resembling a real purchase or payment confirmation.
import { ECO } from "../EcosystemDemoShell";
import { useLang } from "../../hooks/useLang";

export default function AdultsResults({ state, onOrderAgain }) {
  const { t } = useLang();
  const { order } = state;

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: ECO.gold, marginBottom: 6 }}>
        {t("adults_demo_eyebrow")}
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 16px" }}>{t("adults_demo_results_heading")}</h2>

      <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: 18, padding: 22, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: ECO.gold, textTransform: "uppercase" }}>{t("adults_demo_ticket_heading")}</div>
        </div>
        <div style={{ fontSize: 11, color: ECO.textMuted, marginBottom: 14 }}>{t("adults_demo_ticket_label")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 8, columnGap: 16, fontSize: 14 }}>
          <div style={{ color: ECO.textMuted }}>{t("adults_demo_ticket_drink")}</div>
          <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{order.drink}</div>
          <div style={{ color: ECO.textMuted }}>{t("adults_demo_ticket_size")}</div>
          <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{order.size}</div>
          <div style={{ color: ECO.textMuted }}>{t("adults_demo_ticket_service")}</div>
          <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{order.service}</div>
        </div>
        {state.usedHint && (
          <div style={{ fontSize: 12.5, color: ECO.textMuted, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${ECO.border}` }}>
            {t("family_demo_used_hint")}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onOrderAgain}
        style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
      >
        {t("adults_demo_order_again")}
      </button>
    </div>
  );
}
