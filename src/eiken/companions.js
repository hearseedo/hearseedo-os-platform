// EIKEN Monkey — companion mascots (Milo/Lola/Kiko/Momo).
// Phase 3: these are non-verbal companions now, not teachers — they appear as
// a chosen buddy/avatar (missions, cheer bubbles, milestone celebrations) but
// never narrate or speak. Jonathan AI (src/eiken/jonathan.js) is the single
// consistent teaching voice throughout the app. `phrases` below are cheer-only
// text shown in speech bubbles, never sent to TTS.

export const MONKEY_IMAGES = {
  milo: "/assets/eiken-milo.png",
  kiko: "/assets/eiken-kiko.png",
  momo: "/assets/eiken-momo.png",
  lola: "/assets/eiken-lola.png",
};

export const MONKEYS = {
  milo: { name: "Milo", role: "Brave Buddy",    color: "#4A90E8", glow: "rgba(74,144,232,0.3)",
    traits: ["Confident", "Adventurous"], phrases: ["Let's go!", "You can do hard things!", "Mistakes help us grow!"] },
  lola: { name: "Lola", role: "Creative Buddy", color: "#E84A8F", glow: "rgba(232,74,143,0.3)",
    traits: ["Kind", "Imaginative"],     phrases: ["Let's imagine!", "Wonderful effort!", "Tell me your story."] },
  kiko: { name: "Kiko", role: "Action Buddy",   color: "#F5C623", glow: "rgba(245,198,35,0.3)",
    traits: ["Energetic", "Playful"],    phrases: ["Ready? Go!", "Earn those bananas! 🍌", "Challenge accepted!"] },
  momo: { name: "Momo", role: "Focus Buddy",    color: "#4CAF7D", glow: "rgba(76,175,125,0.3)",
    traits: ["Calm", "Patient"],         phrases: ["Take your time.", "Think it through.", "You improve every day."] },
};
