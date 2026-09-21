// HSD Family Demo — scripted content only. Every string, number, and
// "AI response" on this page is fixed data, not a live model or database
// call. It exists to show what the HSD Family pathway does without
// depending on Gemini, Firestore, Stripe, or ElevenLabs being up.
//
// Persona is intentionally fictional/composite, not a real family.

export const DEMO_CHILD = {
  name: "Sam",
  age: 8,
  ageBand: "elementary",
  curriculum: "Monkey Yoga Phonics",
  book: 1,
  lessonBefore: { id: "Lesson 3", title: "Short vowel sounds", status: "in progress" },
  lessonAfter: { id: "Lesson 4", title: "Blending consonant pairs", status: "recommended next" },
};

export const DEMO_PARENT = {
  name: "Mei",
};

export const MAIN_CATEGORIES = ["hear", "see", "do", "talk", "create"];

// Mirrors the real Family Home "Continue Your Journey" hero — same copy
// pattern, fixed values instead of a live progress read.
export const CONTINUE_JOURNEY = {
  lastActivity: { icon: "🎧", title: "Monkey Yoga Phonics — Lesson 3" },
  recommended: { icon: "🎧", title: "Monkey Yoga Phonics — Lesson 4" },
};

// The "Ask Jona" exchange — grounded in the same kind of evidence the real
// Confidence Worker collects (a self-rating and a completion record, each
// labeled with its source), never a fabricated "confidence score."
export const ASK_JONA = {
  question: "What should Sam do today?",
  thinkingMs: 900,
  answer:
    "Sam finished Lesson 3 two days ago and rated it “pretty easy” afterward. " +
    "Today's recommended step is Lesson 4 — Blending consonant pairs, the next " +
    "lesson in Book 1. It builds directly on the short-vowel sounds Sam just practiced.",
  evidence: [
    { source: "selfRating", label: "Sam rated Lesson 3 “pretty easy” after finishing it" },
    { source: "completion", label: "Lesson 3 marked complete 2 days ago" },
  ],
};

// A trimmed, static walk-through of one real lesson screen — no audio
// playback, no scoring engine, just the shape of the activity.
export const ACTIVITY_SCRIPT = {
  title: "Monkey Yoga Phonics — Lesson 4",
  subtitle: "Blending consonant pairs",
  prompt: "Listen to Milo say the word, then tap the picture that matches.",
  word: "“frog”",
  options: [
    { id: "frog", emoji: "🐸", label: "frog", correct: true },
    { id: "flag", emoji: "🚩", label: "flag", correct: false },
    { id: "fox", emoji: "🦊", label: "fox", correct: false },
  ],
  successLine: "Nice blending! “Fr” + “og” = frog.",
};

// Matches the real mood check-in (ConfidenceCheckIn.jsx) — three options,
// not a numeric score.
export const CONFIDENCE_MOODS = [
  { id: "shy", emoji: "😊", label: "A little shy" },
  { id: "ok", emoji: "🙂", label: "OK" },
  { id: "excited", emoji: "😄", label: "Excited!" },
];

// Before/after stats shown on the Progress step — demonstrates the loop
// closing exactly the way the real recommendation engine does: complete a
// lesson, log a confidence signal, get a new recommendation.
export const PROGRESS_STATS = {
  before: {
    hear: { done: 3, total: 18 },
    see: { done: 1, total: 12 },
    do: { done: 2, total: 10 },
    talk: { done: 0, total: 8 },
    create: { done: 1, total: 6 },
  },
  after: {
    hear: { done: 4, total: 18 },
    see: { done: 1, total: 12 },
    do: { done: 2, total: 10 },
    talk: { done: 0, total: 8 },
    create: { done: 1, total: 6 },
  },
  weeklyLine: "Sam completed 3 activities this week — and felt excited about 2 of them! 😄",
};

export const PROGRAMS = [
  {
    id: "hear",
    icon: "🎧",
    title: "Hear",
    body: "Listening and phonics practice, starting with Monkey Yoga Phonics.",
  },
  {
    id: "see",
    icon: "👀",
    title: "See",
    body: "Visual recognition and reading-readiness activities.",
  },
  {
    id: "do",
    icon: "🙌",
    title: "Do",
    body: "Hands-on, movement-based practice for younger learners.",
  },
  {
    id: "talk",
    icon: "💬",
    title: "Talk",
    body: "Speaking practice with Jona, building toward real conversation.",
  },
  {
    id: "create",
    icon: "🎨",
    title: "Create",
    body: "Open-ended, creative activities that reinforce what's been learned.",
  },
];

export const JONA_LINES = {
  welcome:
    "Hi, I'm Jona. This is a guided walkthrough of HSD Family — a demo family, " +
    "so you can see how the pathway works without needing a real account.",
  home:
    "This is Family Home — what Sam sees when they sign in. Hear, See, Do, Talk, " +
    "and Create are the five ways to practice, front and center.",
  askJona:
    "Parents can ask me directly what their child should do next. I only answer " +
    "from real evidence — progress and self-reported confidence — never a guess.",
  activity:
    "Here's what a lesson actually looks like inside Monkey Yoga Phonics.",
  confidence:
    "After a lesson, we ask how it felt — not a test score, just a quick check-in.",
  progress:
    "Progress updates right away, and so does the next recommendation — that's " +
    "the loop: complete something, tell us how it felt, get a better next step.",
  programs:
    "HSD Family is one part of a wider platform built around the same idea for " +
    "different ages and goals.",
  complete:
    "That's the HSD Family walkthrough. Everything you just saw was scripted demo " +
    "data — the real thing runs on live progress tracking for your own family.",
};
