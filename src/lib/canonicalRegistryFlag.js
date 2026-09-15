// Phase 3 (docs/HSD_FAMILY_PATHWAY_AUDIT_2026-09-11.md, Section 9 step 3) —
// feature flag gating the FIRST canonical-registry consumer (Kids/Monkey
// Yoga, inside src/family/ActivityPlayer.jsx). Deliberately a plain,
// literal env-var check — no dev-mode auto-enable, no localStorage
// override, no admin-email override, unlike lib/phonicsV2PreviewFlag.js.
// That flag is fine to auto-enable in dev; this one must not, per the
// phase's explicit safety requirement: the
// production default must not change, and only an explicit
// VITE_USE_CANONICAL_REGISTRY=true (currently set only in
// .env.staging.local) turns it on.
export function isCanonicalRegistryEnabled() {
  return import.meta.env?.VITE_USE_CANONICAL_REGISTRY === "true";
}
