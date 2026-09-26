// Family demo pathway — results screen. Only real recorded fields: how many
// tries it actually took (from state.attempts), whether the hint was used.
// No invented "confidence score" — just an honest count of real attempts.
import { ECO } from "../EcosystemDemoShell";
import { useLang } from "../../hooks/useLang";

export default function FamilyResults({ state, word }) {
  const { t } = useLang();
  const tries = state.attempts.length;

  return (
    <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: 18, padding: 22, marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: ECO.textMuted, textTransform: "uppercase", marginBottom: 6 }}>
        {t("family_demo_results_heading")}
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, color: ECO.textMuted, textTransform: "uppercase", marginBottom: 4 }}>{t("family_demo_word_label")}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#2f8fed", marginBottom: 12 }}>{word}</div>
      <div style={{ fontSize: 13, color: ECO.text, lineHeight: 1.6, marginBottom: state.usedHint ? 8 : 0 }}>
        {tries <= 1 ? t("family_demo_tries_one") : t("family_demo_tries_many").replace("{count}", String(tries))}
      </div>
      {state.usedHint && (
        <div style={{ fontSize: 12.5, color: ECO.textMuted }}>{t("family_demo_used_hint")}</div>
      )}
      <div style={{ fontSize: 12.5, color: ECO.gold, marginTop: 12, fontWeight: 700 }}>{t("family_demo_continue_note")}</div>
    </div>
  );
}
