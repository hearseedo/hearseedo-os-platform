// EIKEN Monkey — "Monkey Missions" naming layer.
// Display-only skin over the stable lesson-type ids from data.js/MODULES.
// Firestore keys, analytics, and progress tracking always use the underlying
// lessonType id (e.g. "listen", "grammar") — mission names are applied only
// at render time, so renaming or re-theming missions later never requires a
// data migration.
export const MISSION_THEMES = {
  listen:      { name: "Jungle Listening",     icon: "🌴", tagline: "Tune in and track the story" },
  read:        { name: "Treasure Reading",     icon: "📜", tagline: "Explore a passage for clues" },
  speak:       { name: "Monkey Talk",          icon: "🎤", tagline: "Speak your answer out loud" },
  write:       { name: "Banana Quest",         icon: "🍌", tagline: "Write your way to the prize" },
  vocab:       { name: "Vocabulary Hunt",      icon: "🔤", tagline: "Track down new words" },
  grammar:     { name: "Monkey Bridge Grammar",icon: "🌉", tagline: "Cross the bridge, one pattern at a time" },
  chat:        { name: "Monkey Chat",          icon: "💬", tagline: "Practice a real conversation" },
  review:      { name: "Monkey Memory",        icon: "🧠", tagline: "Remember what you've learned" },
  interview:   { name: "Interview Island",     icon: "🏝️", tagline: "Face a friendly interview" },
  mocktest:    { name: "Treasure Challenge",   icon: "🏆", tagline: "Show everything you know" },
  confidence:  { name: "Confidence Quest",     icon: "🌟", tagline: "Build bravery, one step at a time" },
};

export function missionTheme(lessonType) {
  return MISSION_THEMES[lessonType] ?? { name: lessonType, icon: "🐵", tagline: "" };
}
