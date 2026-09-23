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

// 2 & 3. Confidence First Lessons and the 10 yearly themes — per
// 2026-09-23 decision: no real lesson/theme content or names were found
// anywhere in the project, so these are placeholder roadmap cards only.
// Do not add lesson content or theme names here without confirming them
// first — see the audit this file was created alongside.
export const CONFIDENCE_FIRST_LESSONS = {
  title: "Confidence First Lessons",
  subtitle: "36 confidence-building lessons",
  status: "coming_soon",
};

export const YEARLY_THEME_COLLECTION = {
  title: "HSD Yearly Theme Collection",
  subtitle: "10 themed curriculum journeys",
  status: "coming_soon",
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
