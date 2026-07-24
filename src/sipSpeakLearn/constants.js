// Sip Speak Learn — scoped design tokens
// Derived from the approved concept art (Hear See Do/SipSpeakLearn/).
// IMPORTANT: this is a LOCAL palette for Sip Speak Learn only. It intentionally
// does NOT touch the platform-wide constants/colors.js (red/black theme).

export const SSL = {
  // Core surfaces
  navy:        "#0e2038", // sidebar / deep panels
  navyDeep:    "#0a1a2e",
  navySoft:    "#16304f",
  cream:       "#f4efe6", // main content background
  creamCard:   "#ffffff",
  creamPanel:  "#efe8db",

  // Accents
  copper:      "#b5794a", // primary buttons / active nav
  copperLight: "#c8934f",
  gold:        "#d4a24e",
  teal:        "#1f6b63", // progress rings, HEAR marker
  tealLight:   "#2c7a72",
  cranberry:   "#8f2d3b", // Table Mode primary / alerts

  // Text
  ink:         "#12263d", // headings on cream
  inkSoft:     "#3d4d5f",
  textMuted:   "#6b7683",
  onNavy:      "#f4efe6",
  onNavyMuted: "#9fb3c8",

  // Status (non-colour label always paired in UI)
  success:     "#2e7d5b",
  warning:     "#c88a2f",
  danger:      "#a83244",
  info:        "#3a6ea5",

  border:      "#dcd3c4",
  borderNavy:  "rgba(159,179,200,0.18)",

  // Type
  serif:       "'Playfair Display', Georgia, 'Times New Roman', serif",
  sans:        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",

  // Layout
  sidebarW:    248,
  radius:      16,
  radiusLg:    22,
  maxW:        1180,
};

// Emails allowed to preview the app in production builds (before Phase 8).
export const OWNER_PREVIEW_EMAILS = [
  "hearseedo.english@gmail.com",
  "waltho79@gmail.com",
];

// Confidence scale (used by lesson intro + post-conversation check).
export const CONFIDENCE_LEVELS = [
  { value: 1, label: "Not yet",       emoji: "🌱", hint: "New to this topic" },
  { value: 2, label: "A little",      emoji: "🙂", hint: "I can manage a few words" },
  { value: 3, label: "Getting there", emoji: "😌", hint: "I can hold a short chat" },
  { value: 4, label: "Confident",     emoji: "😎", hint: "I can keep it going" },
  { value: 5, label: "Very confident",emoji: "🥂", hint: "I could lead the conversation" },
];

export const DIFFICULTY_LEVELS = [
  { id: "beginner",     label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced",     label: "Advanced" },
];
