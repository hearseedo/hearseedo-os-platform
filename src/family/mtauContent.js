// Monkeys Talk & Unlock (MTAU) — Family-native curriculum data (Summit
// Readiness Sprint: content-migration pipeline validation, 2026-09-18).
//
// Source of truth: this file, not the standalone reference product at
// monkeys-talk-unlock.waltho79.chatgpt.site. Lesson 1 was migrated by live
// navigation (2026-09-17). Lessons 2 and 3 were migrated by extracting the
// compiled per-lesson JS bundle's switch(step.id) source directly
// (2026-09-18) — the reference product exposes a clean, validated
// structured array for BOOK-LEVEL lesson-list metadata (lesson/title/
// place/pages/canDo, confirmed to match all 18 Book 1 entries exactly) but
// the full 14-step CONTENT (dialogue, prompts, etc.) is compiled into
// per-lesson React render code, not a clean data export — so it was read
// directly from that source rather than invented or re-typed from
// screenshots. Nothing below is invented; any field the source didn't
// provide is simply absent.
//
// Architecture finding from Lessons 2/3: the 14-step TEMPLATE POSITION is
// consistent, but which STEP KIND occupies position 8 and 9 genuinely
// varies by lesson (Lesson 1 has "meet_team" + "repair"; Lessons 2/3 have
// "meet_team"/"number_hunt" + "ask_switch") — these are real content
// differences in the source product, not something to force into one
// shape. MTAU_STEP_KINDS below lists every kind seen so far as a growing,
// reusable vocabulary — a future lesson introducing yet another position-8
// activity adds one more reusable kind here, never lesson-specific code.
//
// Batch 2 (Lessons 4-6, 2026-09-18) added "item_grid" as the one new
// reusable kind — it covers three different position-8 activities
// (Lesson 4's family map, Lesson 5's object lab, Lesson 6's mission lab)
// that all turned out to share the same real shape: tap every card in a
// grid. It also found that the "see" step's interaction genuinely differs
// per lesson (tiles / pronounCards / possessiveCards / articleCards /
// patternLines) — each is an optional field on the same "see" kind, not a
// new kind, since the step's pedagogical role never changes.

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
  "arrive", "confidence", "quickstart", "review", "hear", "respond", "shadow", "see",
  "meet_team", "number_hunt", "item_grid", "repair", "ask_switch", "workbook", "create", "jona", "unlock", "reflect",
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

// ── Book 1, Lesson 2 — extracted verbatim from the compiled bundle's
// switch(step.id) source (page-CbsfoJZr.js, 2026-09-18). ────────────────
export const MTAU_LESSON_1_2 = {
  bookId: 1,
  lessonId: 2,
  title: "Meet My Friends",
  titleJp: null,
  topic: "Introducing another person using he/she/this",
  location: "Hisaya-odori Park",
  cefr: "A1",
  eiken: "EIKEN 5",
  nextDestination: "Midland Square",
  steps: [
    {
      kind: "arrive",
      title: "Arrive",
      subtitle: "Enter the park",
      heading: "Meet My Friends",
      body: "Milo has friends to introduce. Your next key starts with helping everyone meet.",
      cta: "Enter the park",
    },
    {
      kind: "confidence",
      title: "Confidence",
      subtitle: "Choose your starting point",
      heading: "How ready are you to introduce another person?",
      scaleLabels: ["Not ready yet", null, null, null, "Ready to try"],
      note: "Choose honestly. Support will fade as your voice grows.",
      phase: "before",
    },
    {
      kind: "review",
      title: "Quick review",
      subtitle: "Use Lesson 1",
      heading: "Quick review",
      character: "Milo",
      bubble: "Hi! I'm Milo. What's your name?",
      note: "Use your Lesson 1 English: greet Milo, say your name, and ask his name.",
      successNote: "Lesson 1 voice ready.",
    },
    {
      kind: "hear",
      title: "Hear",
      subtitle: "Listen for meaning",
      heading: "Who does Milo introduce?",
      dialogue: [
        { speaker: "Milo", line: "Kiko, this is my friend Lola." },
        { speaker: "Kiko", line: "Hi, Lola. Nice to meet you." },
        { speaker: "Milo", line: "And this is Momo. He is my friend, too." },
      ],
      choices: [
        { text: "Lola and Momo", correct: true },
        { text: "Kiko and Milo", correct: false },
      ],
    },
    {
      kind: "respond",
      title: "Respond",
      subtitle: "Introduce Lola",
      heading: "Respond",
      character: "Lola",
      bubble: "Who is this?",
      note: "Say: “This is Lola. She is my friend.” A shorter answer is also a strong start.",
    },
    {
      kind: "shadow",
      title: "Shadow",
      subtitle: "Speak with the team",
      heading: "Listen. Then speak along.",
      lines: ["This is Lola.", "She is my friend.", "This is Momo. He is a student."],
      note: "Match the rhythm, then make it natural.",
    },
    {
      kind: "see",
      title: "See",
      subtitle: "Notice he and she",
      heading: "Which word matches?",
      instruction: "Choose the words",
      // Pronoun-matching cards, not a single sentence-builder like Lesson 1 —
      // preserved as its own shape (pronounCards) rather than forced into "tiles".
      pronounCards: [
        { character: "Lola", options: ["She", "He"], correct: "She" },
        { character: "Momo", options: ["She", "He"], correct: "He" },
      ],
    },
    {
      kind: "meet_team",
      title: "Friend gallery",
      subtitle: "Make four introductions",
      heading: "Make four introductions.",
      characters: [
        { name: "Lola", pronoun: "She", detail: "my friend" },
        { name: "Momo", pronoun: "He", detail: "a student" },
        { name: "Kiko", pronoun: "She", detail: "my friend" },
        { name: "Milo", pronoun: "He", detail: "a student" },
      ],
      note: "Try every card. Change one detail to make the introduction yours.",
    },
    {
      kind: "ask_switch",
      title: "Ask & switch",
      subtitle: "Keep two turns going",
      heading: "Keep two turns going.",
      characterPair: ["Kiko", "Momo"],
      exchange: ["“Who is this?”", "“This is Kiko. She is my friend.”"],
    },
    {
      kind: "workbook",
      title: "Workbook",
      subtitle: "Read and write",
      heading: "Book 1 · Pages 15–20",
      pages: "15–20",
      bridge: [
        { stage: "15–16", detail: "Review + Hear" },
        { stage: "17–18", detail: "See + Do" },
        { stage: "19–20", detail: "Read + Unlock" },
      ],
      readingText: "This is Lola. She is Milo's friend. This is Momo. He is green. They are all students.",
      confirmLabel: "I completed pages 15–20.",
      note: "The workbook builds accuracy. Return here to use the language with your voice.",
      completionRequirement: "self_report_only",
    },
    {
      kind: "create",
      title: "Create",
      subtitle: "Introduce two friends",
      heading: "Introduce two real people.",
      instruction: "Speak for 20–30 seconds. Give each person a name and one detail.",
      prompts: ["This is ______.", "He / She is my ______.", "He / She is ______."],
      maxSeconds: 30,
    },
    {
      kind: "jona",
      title: "Talk with Jona",
      subtitle: "Four real questions",
      heading: "Introduce your people.",
      subheading: "Four answers. Less support each time.",
      objectives: [
        "Say a name (a name for practice, not their real identity)",
        "Add one detail about that person",
        "Introduce another person",
        "Put both introductions together with less support",
      ],
    },
    {
      kind: "unlock",
      title: "Unlock",
      subtitle: "Complete three keys",
      heading: "Three speaking keys",
      instruction: "Say: This is Lola. / Say: He is green. / Say: She is my friend.",
      cta: "Speak key",
      keysRequired: 3,
    },
    {
      kind: "reflect",
      title: "Reflect",
      subtitle: "See your progress",
      heading: "How ready are you to introduce another person now?",
      phase: "after",
      note: "Compares against the Confidence step's before-rating.",
    },
  ],
};

// ── Book 1, Lesson 3 — extracted verbatim from the compiled bundle's
// switch(step.id) source (page-C4bZjTyq.js, 2026-09-18). ────────────────
export const MTAU_LESSON_1_3 = {
  bookId: 1,
  lessonId: 3,
  title: "Numbers Everywhere",
  titleJp: null,
  topic: "Counting, age, and simple quantities",
  location: "Midland Square",
  cefr: "A1",
  eiken: "EIKEN 5",
  nextDestination: "Noritake Garden",
  steps: [
    {
      kind: "arrive",
      title: "Arrive",
      subtitle: "Look up at the city",
      heading: "Numbers Everywhere",
      body: "Look up, count the city clues, and use your voice to find the next key.",
      cta: "Start the number hunt",
    },
    {
      kind: "confidence",
      title: "Confidence",
      subtitle: "Choose your starting point",
      heading: "How ready are you to count and ask someone's age?",
      scaleLabels: ["Not ready yet", null, null, null, "Ready to try"],
      phase: "before",
    },
    {
      kind: "review",
      title: "Quick review",
      subtitle: "Introduce a friend",
      heading: "Quick review",
      character: "Kiko",
      bubble: "Who is this?",
      note: "Introduce Kiko using Lesson 2 English. Add one detail if you can.",
    },
    {
      kind: "hear",
      title: "Hear",
      subtitle: "Listen for numbers",
      heading: "How old is Kiko?",
      dialogue: [
        { speaker: "Kiko", line: "How old are you, Momo?" },
        { speaker: "Momo", line: "I'm ten. How old are you?" },
        { speaker: "Kiko", line: "I'm nine." },
      ],
      choices: [
        { text: "Eight", correct: false },
        { text: "Nine", correct: true },
        { text: "Ten", correct: false },
      ],
    },
    {
      kind: "respond",
      title: "Respond",
      subtitle: "Say your age",
      heading: "Respond",
      character: "Momo",
      bubble: "How old are you?",
      note: "Answer with your real age. A number alone can begin; then try the full sentence.",
    },
    {
      kind: "shadow",
      title: "Shadow",
      subtitle: "Copy question rhythm",
      heading: "Question rhythm",
      lines: ["How old are you?", "I am ten years old.", "How many books?", "There are three books."],
    },
    {
      kind: "see",
      title: "See",
      subtitle: "Build the pattern",
      heading: "Build the age question.",
      instruction: "Choose the words",
      tiles: ["How", "old", "are", "you?"],
      targetSentence: "How old are you?",
    },
    {
      kind: "number_hunt",
      title: "Number hunt",
      subtitle: "Count city clues",
      heading: "Count the city clues.",
      items: [
        { n: 3, label: "cards" },
        { n: 5, label: "lights" },
        { n: 8, label: "pencils" },
        { n: 9, label: "balloons" },
      ],
    },
    {
      kind: "ask_switch",
      title: "Ask & switch",
      subtitle: "Trade age questions",
      heading: "Ask, answer, ask back.",
      characterPair: ["Kiko", "Momo"],
      exchange: ["“How old are you?”", "“I'm ten. How old are you?”"],
    },
    {
      kind: "workbook",
      title: "Workbook",
      subtitle: "Read and write",
      heading: "Book 1 · Pages 21–26",
      pages: "21–26",
      bridge: [
        { stage: "21–22", detail: "Review + Hear" },
        { stage: "23–24", detail: "See + Do" },
        { stage: "25–26", detail: "Read + Unlock" },
      ],
      readingText: "Ren is ten years old. He has two brothers, five pencils, and three notebooks. His favourite number is seven.",
      confirmLabel: "I completed pages 21–26.",
      completionRequirement: "self_report_only",
    },
    {
      kind: "create",
      title: "Create",
      subtitle: "Make a number story",
      heading: "Make a number story.",
      instruction: "Speak for 20–30 seconds. Include your age, a quantity, and your favourite number.",
      prompts: ["I am ______ years old.", "I have ______ ______.", "My favourite number is ______."],
      maxSeconds: 30,
    },
    {
      kind: "jona",
      title: "Talk with Jona",
      subtitle: "Four real questions",
      heading: "Your number story.",
      subheading: "Four answers. Your real information.",
      objectives: [
        "Say your age",
        "Say a favourite number",
        "Say how many of something you have",
        "Tell the full number story together with less support",
      ],
    },
    {
      kind: "unlock",
      title: "Unlock",
      subtitle: "Complete three keys",
      heading: "Three number keys",
      instruction: "Say eight in English. / Ask: How old are you? / Answer with your real age.",
      cta: "Speak key",
      keysRequired: 3,
    },
    {
      kind: "reflect",
      title: "Reflect",
      subtitle: "See your progress",
      heading: "How ready are you to use numbers in conversation now?",
      phase: "after",
      note: "Compares against the Confidence step's before-rating.",
    },
  ],
};

// ── Book 1, Lesson 4 — extracted verbatim from the compiled bundle's
// switch(V.id) source (page-DIwxxzrC.js, 2026-09-18). New interaction
// shapes this lesson introduces: a numbered countdown next to the review
// character (numberSequence), a possessive-pronoun matching card (see
// step's possessiveCards), and a 4-role tap grid (family-map) — the last
// is generalized as the new reusable "item_grid" kind rather than a
// lesson-specific renderer. ──────────────────────────────────────────────
export const MTAU_LESSON_1_4 = {
  bookId: 1,
  lessonId: 4,
  title: "My Family",
  titleJp: null,
  topic: "Naming family members and showing who belongs to whom",
  location: "Noritake Garden",
  cefr: "A1",
  eiken: "EIKEN 5",
  nextDestination: "SCMAGLEV Railway Park",
  steps: [
    {
      kind: "arrive",
      title: "Arrive",
      subtitle: "Open the family album",
      heading: "My Family",
      body: "Momo brought a photo. Listen, ask who each person is, and share a story of your own.",
      cta: "Open the family album",
    },
    {
      kind: "confidence",
      title: "Confidence",
      subtitle: "Choose your starting point",
      heading: "How ready are you to talk about family?",
      scaleLabels: ["Not ready yet", null, null, null, "Ready to try"],
      phase: "before",
    },
    {
      kind: "review",
      title: "Quick review",
      subtitle: "Use age and numbers",
      heading: "Quick review",
      character: "Kiko",
      numberSequence: "10 · 9 · 8 · 7 · 6 · 5 · 4 · 3 · 2 · 1",
      note: "Count backward, say your age, then ask Kiko's age.",
    },
    {
      kind: "hear",
      title: "Hear",
      subtitle: "Listen to Momo",
      heading: "Who is Mei?",
      dialogue: [
        { speaker: "Momo", line: "This is my family photo." },
        { speaker: "Lola", line: "Who is she?" },
        { speaker: "Momo", line: "She is my sister. Her name is Mei." },
      ],
      choices: [
        { text: "His mother", correct: false },
        { text: "His sister", correct: true },
        { text: "His grandmother", correct: false },
      ],
    },
    {
      kind: "respond",
      title: "Respond",
      subtitle: "Name a family member",
      heading: "Respond",
      character: "Momo",
      bubble: "Who is she?",
      note: "Say: “She is Momo's sister. Her name is Mei.” Start with fewer words if needed.",
    },
    {
      kind: "shadow",
      title: "Shadow",
      subtitle: "Copy family rhythm",
      heading: "Listen. Then speak along.",
      lines: ["This is my mother.", "Who is she?", "She is my sister.", "His name is Ken."],
    },
    {
      kind: "see",
      title: "See",
      subtitle: "Notice his and her",
      heading: "His name or her name?",
      instruction: "Choose the words",
      // A different real shape from Lesson 2's pronounCards: each card is a
      // statement + a blank to fill with a single possessive answer.
      possessiveCards: [
        { statement: "Mei is Momo's sister.", blank: "___ name is Mei.", answer: "Her" },
        { statement: "Ken is Momo's brother.", blank: "___ name is Ken.", answer: "His" },
      ],
    },
    {
      kind: "item_grid",
      title: "Family map",
      subtitle: "Connect four people",
      heading: "Introduce all four people.",
      items: [
        { label: "Mother", sublabel: "Her name is _____." },
        { label: "Father", sublabel: "His name is _____." },
        { label: "Sister", sublabel: "Her name is _____." },
        { label: "Brother", sublabel: "His name is _____." },
      ],
    },
    {
      kind: "ask_switch",
      title: "Ask & switch",
      subtitle: "Trade who questions",
      heading: "Ask, answer, add a name.",
      characterPair: ["Momo", "Lola"],
      exchange: ["“Who is he?”", "“He is my grandfather. His name is _____.”"],
    },
    {
      kind: "workbook",
      title: "Workbook",
      subtitle: "Read and write",
      heading: "Book 1 · Pages 27–32",
      pages: "27–32",
      bridge: [
        { stage: "27–28", detail: "Review + Hear" },
        { stage: "29–30", detail: "See + Do" },
        { stage: "31–32", detail: "Read + Unlock" },
      ],
      readingText: "Aya's mother is a doctor. Her father is a teacher. Aya has one brother. His name is Yuta.",
      confirmLabel: "I completed pages 27–32.",
      completionRequirement: "self_report_only",
    },
    {
      kind: "create",
      title: "Create",
      subtitle: "Share a family story",
      heading: "Share a family story.",
      instruction: "Choose a real, chosen, or imagined family. Introduce two people in 20–30 seconds.",
      prompts: ["This is my ______.", "His / Her name is ______.", "We like to ______ together."],
      maxSeconds: 30,
    },
    {
      kind: "jona",
      title: "Talk with Jona",
      subtitle: "Four real questions",
      heading: "Your family story.",
      subheading: "Four answers. Your meaning.",
      objectives: [
        "Name a person in your family or chosen family (a name for practice, not their real identity)",
        "Say that person's name",
        "Add an activity you do together",
        "Tell the full connected story with less support",
      ],
    },
    {
      kind: "unlock",
      title: "Unlock",
      subtitle: "Complete three keys",
      heading: "Three family keys",
      instruction: "Say: My mother's son is my brother. / Say: This is Momo's family. / Say one sentence about your family.",
      cta: "Speak key",
      keysRequired: 3,
    },
    {
      kind: "reflect",
      title: "Reflect",
      subtitle: "See your progress",
      heading: "How ready are you to talk about family now?",
      phase: "after",
      note: "Compares against the Confidence step's before-rating.",
    },
  ],
};

// ── Book 1, Lesson 5 — extracted verbatim from the compiled bundle's
// switch(U.id) source (page-Cdzmah14.js, 2026-09-18). Introduces
// articleCards (a/an matching, alongside see's existing tiles and
// pronounCards) and reuses item_grid for the object-lab step. ──────────
export const MTAU_LESSON_1_5 = {
  bookId: 1,
  lessonId: 5,
  title: "What's This?",
  titleJp: null,
  topic: "Identifying classroom objects and using a / an",
  location: "SCMAGLEV Railway Park",
  cefr: "A1",
  eiken: "EIKEN 5",
  nextDestination: "Sakae & Oasis 21",
  steps: [
    {
      kind: "arrive",
      title: "Arrive",
      subtitle: "Enter the discovery lab",
      heading: "What's This?",
      body: "Explore the railway lab, identify each object, and use every clue in a conversation.",
      cta: "Begin the discovery",
    },
    {
      kind: "confidence",
      title: "Confidence",
      subtitle: "Choose your starting point",
      heading: "How ready are you to identify classroom objects?",
      scaleLabels: ["Not ready yet", null, null, null, "Ready to try"],
      phase: "before",
    },
    {
      kind: "review",
      title: "Quick review",
      subtitle: "Use family English",
      heading: "Quick review",
      character: "Momo",
      bubble: "Who is he?",
      note: "Use Lesson 4: identify Momo and add one family sentence.",
    },
    {
      kind: "hear",
      title: "Hear",
      subtitle: "Listen for objects",
      heading: "What does Kiko find?",
      dialogue: [
        { speaker: "Milo", line: "What's this?" },
        { speaker: "Kiko", line: "It's a notebook." },
        { speaker: "Milo", line: "And what's that?" },
        { speaker: "Kiko", line: "It's an eraser." },
      ],
      choices: [
        { text: "A ruler and book", correct: false },
        { text: "A notebook and an eraser", correct: true },
      ],
    },
    {
      kind: "respond",
      title: "Respond",
      subtitle: "Name the object",
      heading: "Respond",
      // No character avatar in the source for this step — a real object
      // icon is shown instead, so bubble renders without a character name.
      bubble: "What's this?",
      note: "Say: “It's a notebook.” Then ask Kiko if it is hers.",
    },
    {
      kind: "shadow",
      title: "Shadow",
      subtitle: "Copy question rhythm",
      heading: "Listen. Then speak along.",
      lines: ["What's this?", "It's a book.", "It's an eraser.", "Is this your pen?"],
    },
    {
      kind: "see",
      title: "See",
      subtitle: "Choose a or an",
      heading: "A or an?",
      instruction: "Choose the words",
      // A third real shape alongside tiles (L1/L3) and pronounCards (L2):
      // each card is a word with a correct article to select.
      articleCards: [
        { word: "book", answer: "a" },
        { word: "eraser", answer: "an" },
        { word: "pencil", answer: "a" },
        { word: "orange pen", answer: "an" },
      ],
    },
    {
      kind: "item_grid",
      title: "Object lab",
      subtitle: "Identify six objects",
      heading: "Identify every object.",
      items: [
        { label: "a book" },
        { label: "a notebook" },
        { label: "a pencil" },
        { label: "an eraser" },
        { label: "a ruler" },
        { label: "a computer" },
      ],
    },
    {
      kind: "ask_switch",
      title: "Bag check",
      subtitle: "Ask and answer",
      heading: "Ask, answer, ask again.",
      exchange: ["“Is this your pen?”", "“Yes, it is. Thank you.”", "“What's that?”"],
    },
    {
      kind: "workbook",
      title: "Workbook",
      subtitle: "Read and write",
      heading: "Book 1 · Pages 33–38",
      pages: "33–38",
      bridge: [
        { stage: "33–34", detail: "Review + Hear" },
        { stage: "35–36", detail: "See + Do" },
        { stage: "37–38", detail: "Read + Unlock" },
      ],
      readingText: "The blue school bag has a notebook, two pencils, a ruler, an eraser, and an orange pen. It does not have a computer.",
      confirmLabel: "I completed pages 33–38.",
      completionRequirement: "self_report_only",
    },
    {
      kind: "create",
      title: "Create",
      subtitle: "Describe your bag",
      heading: "Describe your bag.",
      instruction: "Speak for 20–30 seconds. Name at least three objects and one thing you do not have.",
      prompts: ["My bag is ______.", "I have a / an ______.", "I do not have a ______."],
      maxSeconds: 30,
    },
    {
      kind: "jona",
      title: "Talk with Jona",
      subtitle: "Four real questions",
      heading: "Object conversation.",
      subheading: "Four answers. Less support each time.",
      objectives: [
        "Name an object you found",
        "Answer yes or no about the object",
        "Add two more objects",
        "Describe your whole bag with less support",
      ],
    },
    {
      kind: "unlock",
      title: "Unlock",
      subtitle: "Complete three keys",
      heading: "Three object keys",
      instruction: "Say: an eraser. / Ask: What's this? / Name three classroom objects.",
      cta: "Speak key",
      keysRequired: 3,
    },
    {
      kind: "reflect",
      title: "Reflect",
      subtitle: "See your progress",
      heading: "How ready are you to identify objects now?",
      phase: "after",
      note: "Compares against the Confidence step's before-rating.",
    },
  ],
};

// ── Book 1, Lesson 6 — extracted from the reference product's own clean
// RSC config payload (fetched directly from the /book-1/lesson-6 HTML
// response, 2026-09-18) rather than a compiled bundle switch — the
// reference product itself refactored to a config-driven generic lesson
// runner starting at Lesson 6 (kind: "clothes"), which is why this
// extraction is more direct than Lessons 4/5's. Cross-checked against the
// generic renderer's switch(K[0]) source (lesson-mission-CIwWZ4yO.js) to
// confirm exactly how each config field maps to each step. Introduces
// patternLines (a third "see" shape: select whole sentences, not tiles or
// cards) and reuses item_grid for the "Mission lab" step. ──────────────
export const MTAU_LESSON_1_6 = {
  bookId: 1,
  lessonId: 6,
  title: "Colours and Clothes",
  titleJp: null,
  topic: "Describing clothes using colours and simple adjectives",
  location: "Sakae & Oasis 21",
  cefr: "A1",
  eiken: "EIKEN 5",
  nextDestination: "Osu Shopping Street",
  steps: [
    {
      kind: "arrive",
      title: "Arrive",
      subtitle: "Enter the city mission",
      heading: "Colours and Clothes",
      body: "Hear it, see it, then use it in a real conversation.",
      cta: "Start Lesson 6",
    },
    {
      kind: "confidence",
      title: "Confidence",
      subtitle: "Choose your starting point",
      heading: "How ready are you to describe clothes using colours and simple adjectives?",
      scaleLabels: ["Not yet", null, null, null, "Ready to try"],
      phase: "before",
    },
    {
      kind: "review",
      title: "Quick review",
      subtitle: "Bring back the last lesson",
      heading: "Quick review",
      character: "Lola",
      bubble: "What's this? Name it with a or an.",
      note: "Say your answer, then add one more detail from the last lesson.",
    },
    {
      kind: "hear",
      title: "Hear",
      subtitle: "Listen for meaning",
      heading: "What colours are the clothes?",
      dialogue: [
        { speaker: "Lola", line: "Look at this jacket!" },
        { speaker: "Kiko", line: "It's a cool pink jacket." },
        { speaker: "Lola", line: "What colour are those shoes?" },
        { speaker: "Kiko", line: "They are black and yellow." },
        { speaker: "Lola", line: "I like them!" },
      ],
      // The source renders one confirm button here, not multiple options —
      // kept as a single-item choices array so no new field is needed.
      choices: [{ text: "I found the key meaning.", correct: true }],
    },
    {
      kind: "respond",
      title: "Respond",
      subtitle: "Give a fast answer",
      heading: "Fast response",
      bubble: "What colour is the jacket?",
      note: "Answer: “It's a cool pink jacket.” Then give a different answer.",
    },
    {
      kind: "shadow",
      title: "Shadow",
      subtitle: "Copy the rhythm",
      heading: "Listen. Then speak along.",
      lines: ["It's a red shirt.", "They are black shoes.", "What colour are they?", "I am wearing a blue jacket."],
    },
    {
      kind: "see",
      title: "See",
      subtitle: "Build the pattern",
      heading: "Build three useful lines.",
      // A third real "see" shape: select whole sentences from a stack,
      // rather than build one from tiles or match pronoun/article cards.
      patternLines: ["It's a red shirt.", "They are black shoes.", "What colour are they?"],
    },
    {
      kind: "item_grid",
      title: "Mission lab",
      subtitle: "Collect every clue",
      heading: "Build three complete looks.",
      items: [
        { label: "red shirt" },
        { label: "blue trousers" },
        { label: "green hat" },
        { label: "white shoes" },
        { label: "pink jacket" },
        { label: "yellow skirt" },
      ],
    },
    {
      kind: "ask_switch",
      title: "Ask & switch",
      subtitle: "Keep the exchange moving",
      heading: "Run a fashion interview.",
      characterPair: ["Milo", "Lola"],
      exchange: ["What colour is the jacket?", "It's a cool pink jacket.", "Ask one follow-up question."],
    },
    {
      kind: "workbook",
      title: "Workbook",
      subtitle: "Read, write and connect",
      heading: "Book 1 · Pages 39–44",
      pages: "39–44",
      // This lesson's real source shape is 6 single pages, not 3 paired
      // ranges (Lessons 1-5) — genuinely different content, not invented.
      bridge: [
        { stage: "39", detail: "Hear" },
        { stage: "40", detail: "See" },
        { stage: "41", detail: "Do" },
        { stage: "42", detail: "Read" },
        { stage: "43", detail: "Speak + Write" },
        { stage: "44", detail: "Unlock" },
      ],
      readTitle: "Colour Day",
      readingText: "Today is Colour Day at school. Emi wears a red shirt and blue trousers. Kai wears a green hat and white shoes. Their teacher wears a funny yellow jacket.",
      confirmLabel: "I completed the Book 1 workbook task.",
      completionRequirement: "self_report_only",
    },
    {
      kind: "create",
      title: "Create",
      subtitle: "Make it personal",
      heading: "Make the English yours.",
      instruction: "Describe what you are wearing for 20–30 seconds. Add a colour and one opinion.",
      prompts: ["I am wearing a ______ ______.", "My ______ are ______.", "I like ______ because ______."],
      maxSeconds: 30,
    },
    {
      kind: "jona",
      title: "Talk with Jona",
      subtitle: "Guided practice questions",
      heading: "Keep the meaning moving.",
      subheading: "4 scripted practice turns. Less support each time.",
      objectives: [
        "Say what you are wearing today",
        "Say what colour it is",
        "Add another item you're wearing",
        "Say which item you like best and why, with less support",
      ],
    },
    {
      kind: "unlock",
      title: "Unlock",
      subtitle: "Complete three voice keys",
      heading: "Three voice keys",
      instruction: "Put in order and say: a red shirt. / Complete and say: They are black shoes. / Describe one thing you are wearing.",
      cta: "Speak key",
      keysRequired: 3,
    },
    {
      kind: "reflect",
      title: "Reflect",
      subtitle: "See your progress",
      heading: "How ready are you now?",
      phase: "after",
      note: "Compares against the Confidence step's before-rating.",
    },
  ],
};

// Data-driven lookup — adding a lesson means adding one entry here, never
// touching getMTAULesson's logic. Keyed the same way Firestore doc IDs
// already are (mtauProgress.js's mtauDocId), for consistency.
const MTAU_LESSON_INDEX = {
  "1-1": MTAU_LESSON_1_1,
  "1-2": MTAU_LESSON_1_2,
  "1-3": MTAU_LESSON_1_3,
  "1-4": MTAU_LESSON_1_4,
  "1-5": MTAU_LESSON_1_5,
  "1-6": MTAU_LESSON_1_6,
};

export function getMTAULesson(bookId, lessonId) {
  return MTAU_LESSON_INDEX[`${bookId}-${lessonId}`] ?? null; // honest: anything not in the index simply isn't migrated yet
}

// ── Book 1 lesson-list SUMMARY (all 18) — validated structured source ────
// Extracted verbatim from the reference product's own compiled bundle
// (page-DVya-t1-.js, the /book-1 map route's array literal), then verified
// to reproduce the same title/location/pages for Lessons 1-3 that had
// already been captured by live navigation and by direct source
// extraction — a 100% match, which is why this array is trusted. This is
// SUMMARY metadata only (title/place/pages/canDo) — it does NOT mean the
// lesson's full 14-step content is migrated; check getMTAULesson for that.
export const MTAU_BOOK_1_LESSON_SUMMARY = [
  { lessonId: 1,  title: "Hello, I'm Milo!",              place: "Nagoya Station",         pages: "9–14",   canDo: "Greet someone and say your name confidently" },
  { lessonId: 2,  title: "Meet My Friends",                place: "Hisaya-odori Park",      pages: "15–20",  canDo: "Introduce another person using he, she and this" },
  { lessonId: 3,  title: "Numbers Everywhere",              place: "Midland Square",         pages: "21–26",  canDo: "Count, say your age and ask someone's age" },
  { lessonId: 4,  title: "My Family",                       place: "Noritake Garden",        pages: "27–32",  canDo: "Name family members and show who belongs to whom" },
  { lessonId: 5,  title: "What's This?",                    place: "SCMAGLEV Railway Park",  pages: "33–38",  canDo: "Identify classroom objects and use a or an" },
  { lessonId: 6,  title: "Colours and Clothes",              place: "Sakae & Oasis 21",       pages: "39–44",  canDo: "Describe clothes using colours and simple adjectives" },
  { lessonId: 7,  title: "I Like Bananas!",                  place: "Osu Shopping Street",    pages: "45–50",  canDo: "Say which foods you like and do not like" },
  { lessonId: 8,  title: "Do You Have It?",                  place: "Yanagibashi Market",     pages: "51–56",  canDo: "Ask and answer questions about possessions" },
  { lessonId: 9,  title: "At School",                        place: "Tsuruma Library",        pages: "57–62",  canDo: "Talk about subjects and things you do at school" },
  { lessonId: 10, title: "Everyday Actions",                 place: "Meijo Park",             pages: "63–68",  canDo: "Describe a simple daily routine" },
  { lessonId: 11, title: "What Time Is It?",                 place: "Golden Clock",           pages: "69–74",  canDo: "Tell the time and understand a simple schedule" },
  { lessonId: 12, title: "Where Is the Monkey?",             place: "Nagoya Castle",          pages: "75–80",  canDo: "Describe where people and objects are" },
  { lessonId: 13, title: "My Pets and Animals",              place: "Higashiyama Zoo",        pages: "81–86",  canDo: "Describe one animal and groups of animals" },
  { lessonId: 14, title: "What Can You Do?",                 place: "Nagoya Science Museum",  pages: "87–92",  canDo: "Talk about abilities and encourage another learner" },
  { lessonId: 15, title: "Let's Go to the Park",             place: "Tsuruma Park",           pages: "93–98",  canDo: "Make, accept and decline a simple invitation" },
  { lessonId: 16, title: "Do You Like Sports?",              place: "Vantelin Dome",          pages: "99–104", canDo: "Ask and answer questions about sports and hobbies" },
  { lessonId: 17, title: "What's the Weather Like?",         place: "Nagoya Port",            pages: "105–110", canDo: "Describe weather and give a simple reason for a preference" },
  { lessonId: 18, title: "Review and Unlock Celebration",    place: "Mirai Tower",            pages: "111–116", canDo: "Use Book 1 English in one confident real-world conversation" },
];

export function getMTAULessonSummary(bookId, lessonId) {
  if (bookId !== 1) return null; // only Book 1's summary list has been extracted/validated so far
  return MTAU_BOOK_1_LESSON_SUMMARY.find(l => l.lessonId === lessonId) ?? null;
}

// Data-driven — derives from MTAU_LESSON_INDEX's own keys rather than a
// separately-maintained list, so it can never drift out of sync with what
// getMTAULesson actually serves.
export function getMigratedLessonIds(bookId) {
  return Object.keys(MTAU_LESSON_INDEX)
    .map(key => key.split("-").map(Number))
    .filter(([b]) => b === bookId)
    .map(([, lessonId]) => lessonId)
    .sort((a, b) => a - b);
}

export function getMTAUBook(bookId) {
  return MTAU_BOOKS.find(b => b.bookId === bookId) ?? null;
}
