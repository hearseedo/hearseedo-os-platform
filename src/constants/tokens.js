// Living Blueprint — design tokens
// Additive to constants/colors.js (COLORS is used across the existing app and
// stays untouched). This is the token set for the Living Blueprint rebuild:
// near-black + midnight navy + cobalt, restrained antique gold for meaningful
// action only, minimal per-World accent color.
// See HSDOS_Claude_Code_Master_Rebuild_Prompt.md section 3.

export const TOKENS = {
  color: {
    bg:            "#050608",
    surface:       "#0d1220",
    surfaceRaised: "#131a2c",
    panel:         "rgba(13,18,32,0.72)",
    cobalt:        "#1f3a63",
    cobaltBright:  "#2f5490",
    border:        "rgba(255,255,255,0.08)",
    borderBright:  "rgba(255,255,255,0.16)",
    starlight:     "#ffffff",
    textMuted:     "rgba(255,255,255,0.55)",
    textDim:       "rgba(255,255,255,0.32)",
    gold:          "#C9A84C",
    goldBright:    "#E4C874",
    goldDim:       "rgba(201,168,76,0.35)",
    goldGlow:      "rgba(201,168,76,0.25)",
    success:       "#4ADE80",
    danger:        "#e01010",
  },

  // Very limited per-World accent — used only for the thin card edge / small
  // icon tint, never as a dominant background.
  worldAccent: {
    "speak-ready":     "#5B8FC9",
    "global-ready":    "#4FAE8F",
    "career-ready":    "#C98B4F",
    "phonics":         "#D98A8A",
    "eiken":           "#8F79C9",
    "innerkey":        "#C9A84C",
  },

  radius: { sm: 8, md: 12, lg: 20, xl: 28, pill: 999, circle: "50%" },

  space: [0, 4, 8, 12, 16, 24, 32, 48, 64, 96],

  font: {
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    size:   { xs: 11, sm: 13, base: 15, lg: 18, xl: 22, "2xl": 28, "3xl": 40 },
    label:  { letterSpacing: 3, textTransform: "uppercase", fontSize: 10 },
  },

  shadow: {
    soft: "0 12px 32px rgba(0,0,0,0.45)",
    glow: "0 0 24px rgba(201,168,76,0.25)",
  },

  motion: {
    fast: "150ms",
    base: "300ms",
    slow: "600ms",
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
};

export function prefersReducedMotion() {
  try {
    return typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
