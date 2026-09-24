// HSD Educators — shared content. Everything here is either (a) a link out
// to a real, already-deployed asset (WonderCamp, the worksheets site), (b)
// real book cover art extracted from the actual KDP print files in
// `new books/` (no invented titles/covers), or (c) explicitly labeled
// placeholder/demo data where no real content or system exists yet — see
// each section's comment. Nothing here duplicates or replaces WonderCamp,
// classroom.js, or any other existing system; it only links to or reads
// from them.

// 1. Seasonal Lessons — real, live, external. This IS WonderCamp's 36-lesson
// curriculum (see wondercamp-app/WonderCamp.jsx's CURRICULUM array) and its
// printable-worksheets companion site. Per 2026-09-23 decision: link out
// as-is rather than duplicating or reframing WonderCamp itself.
export const SEASONAL_LESSONS = {
  title: "Seasonal Lessons",
  subtitle: "36 ready-to-use lessons",
  description: "A full 12-month, 36-lesson curriculum with vocabulary, songs, and printable worksheets — already live inside WonderCamp.",
  status: "available",
  appUrl: import.meta.env?.VITE_APP_URL_WONDERCAMP || "https://wondercamp.hsdos.ai",
  worksheetsUrl: "https://wondercamp-worksheets.netlify.app/",
};

// 2. Wonder Works — real, live, external (2026-09-24). A 36-lesson,
// song-led kindergarten (Nensho/Nenchu/Nencho) curriculum built on the
// Hear It / See It / Do It method, replacing the earlier "Confidence
// First Lessons" card (2026-09-24 decision: that card was the same
// content as Seasonal Lessons above — same 36-lesson WonderCamp
// curriculum re-labeled — so it was removed rather than kept as a
// duplicate; Wonder Works is a distinct, separate curriculum).
export const WONDER_WORKS = {
  title: "Wonder Works",
  subtitle: "36 song-led discovery lessons",
  description: "A full-year, 36-lesson kindergarten curriculum — 72 song titles across 3 age groups (Nensho/Nenchu/Nencho) — built on the Hear It, See It, Do It method: hear it, see it, do it, then speak, where every small attempt counts.",
  status: "available",
  appUrl: "https://wonder-works.waltho79.chatgpt.site",
};

// 3. Brave Beginnings — real, live, external (2026-09-24). A separate
// 36-lesson kindergarten curriculum focused specifically on social-
// emotional/confidence development ("Hear It, See It, Do It"), with its
// own named characters (Milo, Lola, Kiko, Momo). Distinct from Confidence
// First Lessons above — not the same content re-labeled — so it gets its
// own card rather than being folded in.
export const BRAVE_BEGINNINGS = {
  title: "Brave Beginnings: Lesson Studio",
  subtitle: "36 social-emotional confidence lessons",
  description: "A kindergarten social-emotional curriculum — Start / Keep Going / Shine — teaching kids to try, with characters Milo, Lola, Kiko, and Momo modelling each stage of confidence.",
  status: "available",
  appUrl: "https://brave-beginnings-hsd.waltho79.chatgpt.site",
};

// 4. HSD Curriculum & Books — real cover art (extracted from
// new books/Monkeys_Talk_and_Unlock_Book_*_KDP_*_Cover_*.pdf, the actual
// print-ready files), real titles. No real Amazon product links exist
// anywhere in the project (only a mock placeholder page elsewhere) — per
// 2026-09-23 decision, using generic Amazon search links until real
// ASINs/URLs are provided.
const AMZN_SEARCH = (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;
export const BOOKS = [
  { id: 1, title: "Monkeys Talk and Unlock — Book 1", cover: "/assets/hsd/educator/books/mtau-book1-cover.jpg", amazonUrl: AMZN_SEARCH("Monkeys Talk and Unlock Book 1 Hear See Do") },
  { id: 2, title: "Monkeys Talk and Unlock — Book 2", cover: "/assets/hsd/educator/books/mtau-book2-cover.jpg", amazonUrl: AMZN_SEARCH("Monkeys Talk and Unlock Book 2 Hear See Do") },
  { id: 4, title: "Monkeys Talk and Unlock — Book 4", cover: "/assets/hsd/educator/books/mtau-book4-cover.jpg", amazonUrl: AMZN_SEARCH("Monkeys Talk and Unlock Book 4 Hear See Do") },
  { id: 5, title: "Monkeys Talk and Unlock — Book 5", cover: "/assets/hsd/educator/books/mtau-book5-cover.jpg", amazonUrl: AMZN_SEARCH("Monkeys Talk and Unlock Book 5 Hear See Do") },
  { id: 6, title: "Monkeys Talk and Unlock — Book 6", cover: "/assets/hsd/educator/books/mtau-book6-cover.jpg", amazonUrl: AMZN_SEARCH("Monkeys Talk and Unlock Book 6 Hear See Do") },
  { id: 7, title: "Monkeys Talk and Unlock — Book 7: World History", cover: "/assets/hsd/educator/books/mtau-book7-cover.jpg", amazonUrl: AMZN_SEARCH("Monkeys Talk and Unlock Book 7 World History") },
  { id: 8, title: "Monkeys Talk and Unlock — Book 8: Japanese History", cover: "/assets/hsd/educator/books/mtau-book8-cover.jpg", amazonUrl: AMZN_SEARCH("Monkeys Talk and Unlock Book 8 Japanese History") },
];

// Students/Classes — per 2026-09-23 decision: the only real system
// (src/lib/classroom.js) is admin-only and stores nothing beyond a
// book/lesson position — no confidence, speaking, or participation data is
// aggregated anywhere in the platform to show here. This is entirely
// fabricated, clearly-labeled demo data for the summit, matching the same
// pattern as src/familyDemo — never real Firestore data.
export const DEMO_CLASS = {
  name: "Demo Class — Grade 5B",
  confidencePercent: 82,
  speakingVoluntarily: { count: 18, total: 22 },
  needingEncouragement: 4,
  recommendedActivity: "Pair speaking challenge",
  students: [
    { name: "Aoi", confidence: "Confident", note: "Ready for extension activities" },
    { name: "Kenji", confidence: "Building", note: "Volunteers more with partner work" },
    { name: "Yui", confidence: "Needs encouragement", note: "Prefers small-group speaking" },
    { name: "Sora", confidence: "Confident", note: "Strong voluntary participation" },
  ],
};
