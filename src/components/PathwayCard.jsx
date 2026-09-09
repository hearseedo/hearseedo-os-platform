// Phase 2 — reusable pathway card. One implementation for all four
// pathways, entirely configuration-driven (constants/pathways.js +
// lib/pathwayAccess.js's state resolver) — never four hand-built cards.
import { useLang } from "../hooks/useLang";
import { PATHWAY_STATES } from "../lib/pathwayAccess";

const STATE_LABEL_KEY = {
  [PATHWAY_STATES.AVAILABLE]:   "path_state_continue",
  [PATHWAY_STATES.ELIGIBLE]:    "path_state_get_started",
  [PATHWAY_STATES.LOCKED]:      "path_state_locked",
  [PATHWAY_STATES.COMING_SOON]: "path_state_coming_soon",
};

const STAGE_LABEL_KEY = { beta: "path_stage_beta", alpha: "path_stage_alpha" };

export default function PathwayCard({ pathway, state, onSelect }) {
  const { t } = useLang();
  const disabled = state === PATHWAY_STATES.LOCKED || state === PATHWAY_STATES.COMING_SOON;
  const { accent } = pathway;

  return (
    <button
      type="button"
      onClick={disabled ? undefined : () => onSelect(pathway.id)}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={`${pathway.displayName} — ${pathway.audience}${disabled ? ` (${t(STATE_LABEL_KEY[state])})` : ""}`}
      className="hsd-pathway-card"
      style={{
        display: "flex", flexDirection: "column", textAlign: "left",
        borderRadius: 18, overflow: "hidden", border: `1px solid ${disabled ? "#2a2a2a" : accent.primary + "55"}`,
        background: "#111214", cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1, padding: 0, width: "100%",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
      }}
    >
      <div style={{ position: "relative", aspectRatio: "4 / 3", background: accent.soft, overflow: "hidden" }}>
        <img
          src={pathway.heroAsset}
          alt={pathway.displayName}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {!disabled && pathway.releaseStage && (
          <span style={{
            position: "absolute", top: 10, right: 10, fontSize: 10, fontWeight: 800,
            letterSpacing: 0.5, textTransform: "uppercase", color: "#fff",
            background: accent.primary, padding: "3px 9px", borderRadius: 12,
          }}>
            {t(STAGE_LABEL_KEY[pathway.releaseStage])}
          </span>
        )}
        {disabled && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(10,10,10,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
              color: "#fff", background: "rgba(0,0,0,0.5)", padding: "6px 14px", borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.3)",
            }}>
              {t(STATE_LABEL_KEY[state])}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: "18px 18px 20px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: accent.primary, marginBottom: 6 }}>
          {pathway.displayName}
        </div>
        <div style={{ fontSize: 13, color: "#9a9a9a", marginBottom: 10 }}>{pathway.audience}</div>
        <div style={{ fontSize: 14, color: "#d8d8d8", lineHeight: 1.5, marginBottom: 16 }}>{pathway.tagline}</div>

        {!disabled && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700,
            color: accent.primary,
          }}>
            {t(STATE_LABEL_KEY[state])} <span aria-hidden="true">→</span>
          </div>
        )}
      </div>
    </button>
  );
}
