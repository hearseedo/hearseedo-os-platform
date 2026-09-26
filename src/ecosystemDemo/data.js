// HSD OS AI ecosystem demo — scripted content, real app data only. Every
// app card below is a genuinely existing app (constants/apps.js /
// constants/worlds.js), not invented for the demo. Per the 2026-09-23
// decision: no separate "University" pathway exists in the real account
// system — Career Ready / Global Ready / Speak Ready already live under
// Student, shown here with a "university track" badge rather than a
// fictional 5th pathway.
export const PATHWAYS_DEMO = [
  {
    id: "family",
    name: "HSD Family",
    accent: "#e0559c",
    tagline: "Play, learn, speak and grow together.",
    apps: [
      { name: "Monkey Yoga Phonics", desc: "Phonics, movement, and confidence for ages 4–8.", image: "/assets/worlds/monkey-yoga-card.jpg" },
      { name: "WonderCamp", desc: "36-lesson turnkey curriculum — songs, games, worksheets.", image: "/assets/worlds/wondercamp-card.jpg" },
      { name: "Monkeys Unlock", desc: "Hear it, see it, say it — unlock the room.", image: "/assets/worlds/monkeys-unlock-card.jpg", comingSoon: true },
    ],
  },
  {
    id: "student",
    name: "HSD Students",
    accent: "#2f6fed",
    tagline: "Learn. Practice. Prepare. Achieve.",
    apps: [
      { name: "EIKEN", desc: "Grade 5 through Grade 1 — placement, missions, confidence-first coaching.", image: "/assets/worlds/eiken-card.jpg" },
      { name: "Career Ready", desc: "AI interview & resume coaching for university and career.", image: "/assets/worlds/career-ready-card.jpg", badge: "University track" },
      { name: "Global Ready", desc: "Study abroad prep, TOEFL/IELTS, cross-cultural communication.", image: "/assets/worlds/global-ready-card.jpg", badge: "University track" },
      { name: "Speak Ready", desc: "Confidence-first speaking practice for real life.", image: "/assets/worlds/speak-ready-card.jpg", badge: "University track" },
    ],
  },
  {
    id: "adult",
    name: "HSD Adults",
    accent: "#d99a1b",
    tagline: "Work. Travel. Connect. Grow.",
    apps: [
      { name: "Inner Key Blueprint", desc: "Guided self-reflection, aligned action, growth tracking.", image: "/assets/worlds/innerkey-card.jpg" },
      { name: "Sip & Switch", desc: "English conversation, one sip at a time.", image: "/assets/worlds/sip-switch-card.jpg" },
      { name: "Sip Speak Learn", desc: "Adult conversation practice, one session at a time.", image: "/assets/worlds/sip-speak-learn-card.jpg" },
      { name: "Speak & Sweat", desc: "Fitness and movement-based English confidence.", image: "/assets/worlds/speak-sweat-card.jpg" },
    ],
  },
  {
    id: "educator",
    name: "HSD Educators",
    accent: "#2f9e5c",
    tagline: "Teach. Empower. Inspire. Together.",
    apps: [
      { name: "Seasonal Lessons", desc: "36 ready-to-use lessons, live inside WonderCamp.", image: "/assets/worlds/wondercamp-card.jpg" },
      { name: "Curriculum & Books", desc: "Monkeys Talk and Unlock and other HSD curriculum.", image: "/assets/hsd/educator/books/mtau-book1-cover.jpg" },
      { name: "Confidence First Lessons", desc: "36 confidence-building lessons.", image: null, comingSoon: true },
    ],
  },
];

// Step 4 "Meet Jona" — reuses the real Monkey Yoga Phonics lesson script
// already built for the Family demo (src/familyDemo/data.js) rather than
// writing a second copy, per "reuse it as one example" — imported directly
// in steps.jsx.

// A function of `picked` (the option id the visitor actually tapped, or
// null before they've chosen) so "Is my answer okay?" reflects the real
// selection instead of always claiming the correct one was picked — see
// GlobalJonaAssistant.jsx's demoState/demoScript-as-function support.
const OPTION_LABELS = { frog: "frog", flag: "flag", fox: "fox" };

export function JONA_HELP_SCRIPT(picked) {
  const answerLine = picked == null
    ? "Give it a try first — tap one of the three pictures, then ask me again and I'll tell you how it went."
    : picked === "frog"
      ? "You picked the frog — that's exactly right! And even if it wasn't, trying counts. That's how the sound sticks."
      : `You picked the ${OPTION_LABELS[picked] ?? picked} — that's not quite it this time. Listen for the “fr” blend again: “ffff…rrr…og.” Want to try once more?`;

  return {
    "I don't understand this": "No problem — let's slow down. “Fr” is a blend of two sounds, F and R, said together quickly. Try saying “ffff” then “rrr”, then put them together: “fr…og.”",
    "Can you give me a hint?": "Sure — listen for the word that starts with the same blend as “free”. One of the three pictures matches that sound.",
    "Can we practise this together?": "Let's do it. Say “frog” with me: fr…og. One more time, a little slower: ffrr…og. Nice — you've got it.",
    "Is my answer okay?": answerLine,
    _default: "This guided demo only responds to a few set questions and to your actual picture pick — try tapping frog, flag, or fox above, then ask me again and I'll respond to exactly what you chose.",
  };
}

export const CONFIDENCE_EXAMPLE = {
  learnerAttempt: "“I go to... um... the... store yesterday.”",
  wrongWay: "Incorrect. The correct form is “I went to the store yesterday.”",
  jonaWay: "Great start — I understood you. Want to try it one more time? ‘I went to the store yesterday.’ You try.",
};
