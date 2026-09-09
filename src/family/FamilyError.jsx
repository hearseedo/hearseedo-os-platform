// Child-friendly error state (item 30) — never exposes raw stack
// traces/Firebase/API/provider errors to a child. `kind` picks the message;
// the actual error detail (if any) is only logged to the console for devs.
import { useLang } from "../hooks/useLang";
import { FAMILY_COLORS } from "./theme";

const MESSAGE_KEY = {
  unavailable: "fam_error_unavailable",
  network:     "fam_error_network",
  audio:       "fam_error_audio",
  ai:          "fam_error_ai",
};

export default function FamilyError({ kind = "unavailable", onRetry, onBack }) {
  const { t } = useLang();
  return (
    <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
      <span style={{ fontSize: 48 }}>🐵</span>
      <div style={{ fontSize: 15, fontWeight: 700, color: FAMILY_COLORS.text, maxWidth: 320 }}>{t(MESSAGE_KEY[kind] ?? MESSAGE_KEY.unavailable)}</div>
      <div style={{ display: "flex", gap: 10 }}>
        {onRetry && (
          <button onClick={onRetry} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: FAMILY_COLORS.pink, color: "#fff", fontWeight: 800, cursor: "pointer" }}>
            {t("fam_continue")}
          </button>
        )}
        {onBack && (
          <button onClick={onBack} style={{ padding: "10px 20px", borderRadius: 12, border: `2px solid ${FAMILY_COLORS.border}`, background: "#fff", color: FAMILY_COLORS.text, fontWeight: 700, cursor: "pointer" }}>
            {t("fam_back_to_home")}
          </button>
        )}
      </div>
    </div>
  );
}
