// Rebuild prompt section 12 — Jona visual-state mapping. Each state maps to
// a real pose asset from public/assets/jona/ (HSDOS Visual Production
// library). Whole-pose swaps only — compositing separate eye/mouth sprites
// needs alignment data we don't have, so it's left for a later phase rather
// than risking a misaligned Frankenstein face.
export const JONA_STATES = {
  welcome:     { pose: "pose-waving.png",      label: "Welcome" },
  listening:   { pose: "pose-listening.png",   label: "Listening" },
  thinking:    { pose: "pose-thinking.png",    label: "Thinking" },
  speaking:    { pose: "pose-talking.png",     label: "Speaking" },
  explaining:  { pose: "pose-pointing.png",    label: "Explaining" },
  encouraging: { pose: "pose-encouraging.png", label: "Encouraging" },
  concern:     { pose: "pose-concerned.png",   label: "Concern" },
  celebration: { pose: "pose-celebrating.png", label: "Celebration" },
};

export const JONA_STATE_ORDER = ["welcome", "listening", "thinking", "speaking", "explaining", "encouraging", "concern", "celebration"];
