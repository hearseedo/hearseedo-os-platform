// Monkey Party — content data (game modes, topics, prompts).
// Mirrors the src/eiken/data.js pattern: pure data, no logic, no React.
// Prompts are level-agnostic by design — Gemini evaluation adapts the rubric
// per EIKEN level (see monkeyPartyPrompt.js), so the same "Would you rather
// study abroad or travel with family?" works for every grade, just judged
// differently. This keeps content authoring bounded instead of needing
// 7-grades x 15-topics variants.

export const GAME_MODES = [
  { id: "quick_mix",           label: "Quick Mix",           icon: "🎉", desc: "A surprise mix of everything", recommended: true },
  { id: "would_you_rather",    label: "Would You Rather",    icon: "🤔", desc: "Pick a side and explain why" },
  { id: "category_rush",       label: "Category Rush",       icon: "⚡", desc: "Name as many as you can before time's up" },
  { id: "answer_or_challenge", label: "Answer or Challenge", icon: "🎯", desc: "Answer normally or take a bonus challenge" },
  { id: "beat_the_monkey",     label: "Beat the Monkey",     icon: "🐵", desc: "Give a better answer than the monkey" },
];

export const TOPICS = [
  "School", "Family", "Friends", "Hobbies", "Food", "Travel", "Animals", "Sports",
  "Daily Life", "Future Dreams", "Technology", "Environment", "Careers", "Study Abroad", "Random",
];

export const SESSION_LENGTHS = [5, 10, 15];

// ─── WOULD YOU RATHER ─────────────────────────────────────────────────────────
export const WOULD_YOU_RATHER = {
  School:        [{ a: "study alone", b: "study in a group" }, { a: "have more homework", b: "have longer school days" }, { a: "take a test", b: "give a presentation" }],
  Family:        [{ a: "have a big family", b: "have a small family" }, { a: "eat dinner together every night", b: "have your own schedule" }, { a: "live near your grandparents", b: "live in a new city" }],
  Friends:       [{ a: "have one best friend", b: "have many friends" }, { a: "meet new people", b: "spend time with old friends" }, { a: "text your friends", b: "call your friends" }],
  Hobbies:       [{ a: "learn a musical instrument", b: "learn a sport" }, { a: "paint", b: "write stories" }, { a: "collect things", b: "build things" }],
  Food:          [{ a: "eat the same favourite meal every day", b: "try a new food every day" }, { a: "cook at home", b: "eat at a restaurant" }, { a: "eat sweet food", b: "eat salty food" }],
  Travel:        [{ a: "visit the mountains", b: "visit the beach" }, { a: "travel with your family", b: "study abroad" }, { a: "visit a big city", b: "visit a small village" }],
  Animals:       [{ a: "have a dog", b: "have a cat" }, { a: "see animals at a zoo", b: "see animals in the wild" }, { a: "have a pet bird", b: "have a pet fish" }],
  Sports:        [{ a: "play a team sport", b: "play an individual sport" }, { a: "watch sports", b: "play sports" }, { a: "swim", b: "run" }],
  "Daily Life":  [{ a: "wake up early", b: "stay up late" }, { a: "have a busy schedule", b: "have a relaxed schedule" }, { a: "walk to school", b: "take the bus" }],
  "Future Dreams": [{ a: "have a job you love", b: "have a job that pays well" }, { a: "work in Japan", b: "work in another country" }, { a: "start your own business", b: "work for a big company" }],
  Technology:    [{ a: "use a phone", b: "use a computer" }, { a: "play video games", b: "watch videos" }, { a: "learn coding", b: "learn robotics" }],
  Environment:   [{ a: "plant trees", b: "clean a beach" }, { a: "recycle at home", b: "use less plastic" }, { a: "walk more", b: "use public transport more" }],
  Careers:       [{ a: "be a teacher", b: "be a doctor" }, { a: "work outdoors", b: "work in an office" }, { a: "have a creative job", b: "have a technical job" }],
  "Study Abroad": [{ a: "study in an English-speaking country", b: "study somewhere with a different language" }, { a: "study for one month", b: "study for one year" }, { a: "live with a host family", b: "live in a dormitory" }],
};
WOULD_YOU_RATHER.Random = Object.values(WOULD_YOU_RATHER).flat();

// ─── CATEGORY RUSH — categories adapt by EIKEN level tier ────────────────────
export const CATEGORY_RUSH_BY_TIER = {
  beginner: [ // Grade 5-4
    "animals", "food", "school items", "colours", "places in a town",
  ],
  intermediate: [ // Grade 3-Pre2
    "things at an airport", "hobbies", "jobs", "things at school", "daily routines",
  ],
  advanced: [ // Grade 2-Pre1
    "environmental problems", "types of technology", "careers", "social issues", "reasons to study abroad",
  ],
  expert: [ // Grade 1
    "public policy issues", "education reforms", "economic issues", "international challenges",
  ],
};

export function categoryTierForLevel(level) {
  if (level === "Grade 5" || level === "Grade 4") return "beginner";
  if (level === "Grade 3" || level === "Pre-2")   return "intermediate";
  if (level === "Grade 2" || level === "Pre-1")   return "advanced";
  return "expert"; // Grade 1
}

// ─── ANSWER OR CHALLENGE ──────────────────────────────────────────────────────
// The "Answer" side reuses SPEAKING_BANK (data.js) per level — no duplicate
// question content. Challenges are level-agnostic bonus rules.
export const CHALLENGES = [
  'Use "because" twice',
  "Give two reasons",
  "Speak for 20 seconds",
  "Use three describing words",
  "Add one example",
  "Use the past tense",
  "Use a comparison (more than / less than)",
  "Ask the monkey one question",
  'Answer without saying "I think"',
  "Add one detail nobody would expect",
];

// ─── BEAT THE MONKEY ──────────────────────────────────────────────────────────
// Deliberately simple baseline answers, regardless of level — the student's
// own level determines how much improvement is expected, via Gemini's rubric.
export const BEAT_THE_MONKEY = {
  School:        [{ question: "What is your favourite subject?", monkeyAnswer: "I like math because it is fun." }],
  Family:        [{ question: "Tell me about your family.", monkeyAnswer: "I have a mother and a father. They are nice." }],
  Friends:       [{ question: "What makes a good friend?", monkeyAnswer: "A good friend is kind." }],
  Hobbies:       [{ question: "What do you like to do in your free time?", monkeyAnswer: "I like to play games." }],
  Food:          [{ question: "What is your favourite food?", monkeyAnswer: "I like pizza because it is tasty." }],
  Travel:        [{ question: "Where would you like to travel?", monkeyAnswer: "I want to go to America." }],
  Animals:       [{ question: "What is your favourite animal?", monkeyAnswer: "I like dogs because they are cute." }],
  Sports:        [{ question: "What sport do you like?", monkeyAnswer: "I like soccer because it is fun." }],
  "Daily Life":  [{ question: "What do you do after school?", monkeyAnswer: "I go home and eat dinner." }],
  "Future Dreams": [{ question: "What do you want to be in the future?", monkeyAnswer: "I want to be a teacher." }],
  Technology:    [{ question: "How do you use technology every day?", monkeyAnswer: "I use my phone to talk to friends." }],
  Environment:   [{ question: "Why is it important to protect the environment?", monkeyAnswer: "Because nature is important." }],
  Careers:       [{ question: "What job would you like to have?", monkeyAnswer: "I want to be a doctor." }],
  "Study Abroad": [{ question: "Why do people study abroad?", monkeyAnswer: "Because it is a good experience." }],
};
BEAT_THE_MONKEY.Random = Object.values(BEAT_THE_MONKEY).flat();

// ─── BADGES (rewards) ─────────────────────────────────────────────────────────
// Persisted via the existing eikenAchievements system (logAchievementUnlock,
// storage.js) — not a new currency/reward system, per the spec's own
// instruction to reuse whatever the EIKEN app already has.
export const MONKEY_PARTY_BADGES = [
  { id: "mp_brave_speaker",      label: "Brave Speaker",       icon: "🦁", desc: "Complete 10 Monkey Party rounds" },
  { id: "mp_clear_communicator", label: "Clear Communicator",  icon: "💬", desc: "Score 3 stars in Clarity 5 times" },
  { id: "mp_reason_master",      label: "Reason Master",       icon: "🧠", desc: "Score 3 stars in Power 5 times" },
  { id: "mp_example_expert",     label: "Example Expert",      icon: "💡", desc: "Complete a challenge target 5 times" },
  { id: "mp_category_champion",  label: "Category Champion",   icon: "⚡", desc: "Reach Gold tier in Category Rush" },
  { id: "mp_monkey_beater",      label: "Monkey Beater",       icon: "🐵", desc: "Beat the monkey 5 times" },
  { id: "mp_five_day_streak",    label: "Five-Day Streak",     icon: "🔥", desc: "Play Monkey Party 5 days in a row" },
  { id: "mp_quick_mix_champion", label: "Quick Mix Champion",  icon: "🎉", desc: "Complete 10 Quick Mix sessions" },
];
