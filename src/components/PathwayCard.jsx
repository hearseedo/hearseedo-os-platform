// Phase 2 — reusable pathway card. One implementation for all four
// pathways, entirely configuration-driven (constants/pathways.js +
// lib/pathwayAccess.js's state resolver) — never four hand-built cards.
//
// Visual update (2026-09-11): restyled for the Nagoya street-art
// /choose-path background — dark ink-navy translucent surface, thin
// pathway-coloured border, matching coloured glow, no per-card hero image
// (the shared background artwork now carries the visual identity; a
// per-card photo would compete with it). Logic, aria-label, disabled
// handling and i18n keys are byte-for-byte unchanged from the previous
// version — only rendering below the (removed) image box changed.
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
        position: "relative",
        display: "flex", flexDirection: "column", textAlign: "left",
        borderRadius: 18,
        border: `1.5px solid ${disabled ? "rgba(255,255,255,0.16)" : accent.primary + "80"}`,
        background: disabled ? "rgba(14,15,22,0.58)" : "rgba(11,12,20,0.64)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        boxShadow: disabled ? "none" : `0 0 0 1px ${accent.primary}22, 0 14px 32px -14px ${accent.primary}66`,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.65 : 1,
        padding: "20px 18px",
        minHeight: 208,
        width: "100%",
        transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
      }}
    >
      {!disabled && pathway.releaseStage && (
        <span style={{
          position: "absolute", top: 14, right: 14, fontSize: 10, fontWeight: 800,
          letterSpacing: 0.5, textTransform: "uppercase", color: "#fff",
          background: accent.primary, padding: "3px 9px", borderRadius: 12,
        }}>
          {t(STAGE_LABEL_KEY[pathway.releaseStage])}
        </span>
      )}
      {disabled && (
        <span style={{
          position: "absolute", top: 14, right: 14, fontSize: 10, fontWeight: 800,
          letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(255,255,255,0.8)",
          background: "rgba(0,0,0,0.55)", padding: "3px 9px", borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.25)",
        }}>
          {t(STATE_LABEL_KEY[state])}
        </span>
      )}

      {/* Paint-accent mark — a small glowing dot in the pathway's colour,
          standing in for the removed hero photo without baking any text
          into artwork. */}
      <div aria-hidden="true" style={{
        width: 11, height: 11, borderRadius: "50%", background: accent.primary,
        boxShadow: `0 0 12px ${accent.primary}, 0 0 2px ${accent.primary}`,
        marginBottom: 16,
      }} />

      <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.3, color: "#fff", marginBottom: 6 }}>
        {pathway.displayName}
      </div>
      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.62)", marginBottom: 10 }}>
        {pathway.audience}
      </div>
      <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.86)", lineHeight: 1.5, marginBottom: 16, flex: 1 }}>
        {pathway.tagline}
      </div>

      {!disabled && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700,
          color: accent.primary,
        }}>
          {t(STATE_LABEL_KEY[state])} <span aria-hidden="true">→</span>
        </div>
      )}
    </button>
  );
}
