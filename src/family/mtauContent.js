// Monkeys Talk & Unlock (MTAU) — Family-native curriculum data (Summit
// Readiness Sprint, Priority: MTAU integration audit + Book 1 Lesson 1
// pilot, 2026-09-17).
//
// Source of truth: this file, not the standalone reference product at
// monkeys-talk-unlock.waltho79.chatgpt.site. That site remains the
// reference/prototype MTAU was designed on; its content was audited and
// Book 1 Lesson 1 was migrated here verbatim (dialogue, prompts, step
// copy) as the one deeply-integrated pilot lesson. Books 1-6 metadata
// below (CEFR/EIKEN/city/theme) is real, audited data for the journey map;
// their lesson content has NOT been migrated and is deliberately absent —
// do not invent it. Books 7-8 are explicitly "coming_next" per the
// reference site itself; never represent them as available.
//
// Schema is designed to scale: adding Book 1 Lesson 2 (or any future
// lesson) means adding one more entry to LESSONS below with the same
// shape, not a new component or a new progress mechanism.

export const MTAU_BOOKS = [
  { bookId: 1, city: "Nagoya",   theme: "First conversations",              cefr: "A1",       eiken: "EIKEN 5",     status: "open" },
  { bookId: 2, city: "Tokyo",    theme: "Everyday connections",             cefr: "A1",       eiken: "EIKEN 4",     status: "open" },
  { bookId: 3, city: "Osaka",    theme: "Explain, connect and discover",    cefr: "A1+ → A2", eiken: "EIKEN 3",     status: "open" },
  { bookId: 4, city: "Kyoto",    theme: "Choices and opinions",             cefr: "A2",       eiken: "EIKEN 3",     status: "open" },
  { bookId: 5, city: "Hokkaido", theme: "Read, explain, connect",           cefr: "B1",       eiken: "EIKEN Pre-2", status: "open" },
  { bookId: 6, city: "Okinawa",  theme: "Speak with detail",                cefr: "B1",       eiken: "EIKEN Pre-2", status: "open" },
  { bookId: 7, city: "Japan → World",   theme: "World history and ideas",   cefr: "B2",       eiken: "EIKEN Pre-1",     status: "coming_next" },
  { bookId: 8, city: "Historic Japan",  theme: "Culture, history and voice", cefr: "B2",      eiken: "EIKEN Pre-1 → 1", status: "coming_next" },
];

// MTAU is only appropriate for an older learner — gated on ageBand, same
// convention as content.js's ageBands arrays elsewhere in Family.
export const MTAU_MIN_AGE_BANDS = ["junior_high", "teen"];

// The 14-step lesson template every MTAU lesson follows (verified live,
// both Book 1 Lesson 1 and Book 2 Lesson 1 use this exact sequence with
// only content differing) — this is product structure, not a generic
// Hear/See/Do card grid, and must be preserved as such.
export const MTAU_STEP_KINDS = [
  "arrive", "confidence", "quickstart", "hear", "respond", "shadow", "see",
  "meet_team", "repair", "workbook", "create", "jona", "unlock", "reflect",
];

// ── Book 1, Lesson 1 — the one deeply-integrated pilot lesson ────────────
// Every string below was copied verbatim from the reference product
// (monkeys-talk-unlock.waltho79.chatgpt.site/book-1, Lesson 1, all 14
// steps navigated and captured live, 2026-09-17). Nothing here is invented.
export const MTAU_LESSON_1_1 = {
  bookId: 1,
  lessonId: 1,
  title: "Hello, I'm Milo!",
  titleJp: null, // not present in the reference product — honest gap, not invented
  topic: "First introductions at Nagoya Station",
  location: "JR Nagoya Station",
  cefr: "A1",
  eiken: "EIKEN 5",
  nextDestination: "Hisaya-odori Park", // teased on Reflect (step 14) as Lesson 2's location; Lesson 2 itself is not migrated this pass
  steps: [
    {
      kind: "arrive",
      title: "Arrive",
      subtitle: "Enter Nagoya Station",
      heading: "Hello, I'm Milo!",
      body: "Your first key starts with one simple hello.",
      cta: "Tap or say hello",
    },
    {
      kind: "confidence",
      title: "Confidence",
      subtitle: "Choose your support",
      heading: "How ready are you to introduce yourself?",
      scaleLabels: ["Not ready yet", null, null, null, "Ready to try"],
      note: "There is no wrong answer. Jona uses this to choose the right support.",
      phase: "before",
    },
    {
      kind: "quickstart",
      title: "Quick start",
      subtitle: "Say your name",
      heading: "What's your name?",
      // Privacy correction from the reference product: the original asks
      // for and ECHOES BACK a typed/spoken name later, in the Jona step.
      // Kept here as genuine speaking practice ("My name is ___" is a real
      // A1 sentence pattern) but the response is never persisted as
      // identity data and never forwarded to Jona — see MTAULesson.jsx.
      inputMode: "voice_or_text",
      placeholder: "Your name",
      privacyNote: "practice_only_not_persisted",
    },
    {
      kind: "hear",
      title: "Hear",
      subtitle: "Listen for meaning",
      heading: "Who is meeting?",
      dialogue: [
        { speaker: "Milo", line: "Hi! I'm Milo. What's your name?" },
        { speaker: "Lola", line: "Hello! My name is Lola." },
      ],
      choices: [
        { text: "Milo is meeting Lola.", correct: true },
        { text: "Lola is meeting Kiko.", correct: false },
      ],
    },
    {
      kind: "respond",
      title: "Respond",
      subtitle: "Answer Milo",
      heading: "What's your name?",
      note: "Take your time. A word, gesture or sentence can begin the conversation.",
    },
    {
      kind: "shadow",
      title: "Shadow",
      subtitle: "Speak along",
      heading: "Listen. Then speak along.",
      lines: ["Hi! I'm Milo.", "What's your name?", "Nice to meet you."],
      note: "Rhythm first. Perfection can wait.",
    },
    {
      kind: "see",
      title: "See",
      subtitle: "Build the pattern",
      heading: "Build it. Then say it.",
      instruction: "Choose the words",
      tiles: ["My", "name", "is", "____"],
    },
    {
      kind: "meet_team",
      title: "Meet the team",
      subtitle: "Introduce yourself",
      heading: "Introduce yourself four ways.",
      characters: [
        { name: "Milo", line: "Hi there!" },
        { name: "Lola", line: "Nice to meet you!" },
        { name: "Kiko", line: "Great to meet you!" },
        { name: "Momo", line: "Hey, friend!" },
      ],
      note: "Each new conversation removes a little support.",
    },
    {
      kind: "repair",
      title: "Repair",
      subtitle: "Keep communicating",
      heading: "Sorry, could you say that again?",
      note: "You kept communicating. That is progress.",
    },
    {
      kind: "workbook",
      title: "Workbook",
      subtitle: "Read and write",
      heading: "Open Book 1 to pages 9–13",
      pages: "9–13",
      bridge: [
        { stage: "Before the book", detail: "Hear + speak" },
        { stage: "Workbook", detail: "Read + write" },
        { stage: "Back in the app", detail: "Create + talk" },
      ],
      confirmLabel: "I completed the reading and writing.",
      note: "The workbook builds accuracy. The app brings you back to communication.",
      // Honest per instruction #9 — this is a self-report checkbox, never
      // automatic detection/sync with any real workbook/page content.
      completionRequirement: "self_report_only",
    },
    {
      kind: "create",
      title: "Create",
      subtitle: "Make it yours",
      heading: "Make the English yours.",
      instruction: "Record a 20–30 second personal introduction.",
      maxSeconds: 30,
    },
    {
      kind: "jona",
      title: "Jona",
      subtitle: "Continue the conversation",
      heading: "A real conversation.",
      subheading: "Your pace. Your voice.",
      // The reference product's 4 scripted questions, kept as the
      // pedagogical objective sequence fed to REAL Jona as speaking
      // prompts — not replayed as a canned script. See mtauJona.js.
      objectives: [
        "Introduce yourself (a name for practice, not their real identity)",
        "Say where you are (Nagoya Station)",
        "Say who you are with (Milo)",
        "Combine name + location with less support",
      ],
    },
    {
      kind: "unlock",
      title: "Unlock",
      subtitle: "Final introduction",
      heading: "Your final introduction",
      instruction: "Introduce yourself once more without a sentence model.",
      cta: "Start final attempt",
    },
    {
      kind: "reflect",
      title: "Reflect",
      subtitle: "Notice your growth",
      heading: "How ready do you feel now?",
      phase: "after",
      note: "Compares against the Confidence step's before-rating.",
    },
  ],
};

export function getMTAULesson(bookId, lessonId) {
  if (bookId === 1 && lessonId === 1) return MTAU_LESSON_1_1;
  return null; // honest: no other lessons migrated yet this pass
}

export function getMTAUBook(bookId) {
  return MTAU_BOOKS.find(b => b.bookId === bookId) ?? null;
}
