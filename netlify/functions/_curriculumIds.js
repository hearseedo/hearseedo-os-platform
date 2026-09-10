// HSD OS AI — canonical Monkey Yoga V2 curriculum identifiers, for
// server-side VALIDATION ONLY (2026-09-10).
//
// This is explicitly NOT a competing curriculum/content system — it defines
// no lesson content, poses, vocabulary, or pedagogy, only the exact set of
// real lessonIds V2's own curriculum/book1.ts–book4.ts files define today,
// so a progress-write request can be checked against real values instead of
// trusting whatever a client sends. Extracted by directly reading V2's
// source (57 lessons: 13+13+13+18), not invented or guessed.
//
// MUST be kept in sync with hsd-monkey-yoga-phonics-v2/src/curriculum/ if
// lessons are ever added, renamed, or removed there — there is no automated
// sync between the two repos, so this is a manual mirror, deliberately kept
// tiny (ids only) to minimize drift risk.
const BOOK1_LESSON_IDS = ["b1-s", "b1-a", "b1-m", "b1-t", "b1-c", "b1-k", "b1-r", "b1-i", "b1-p", "b1-b", "b1-f", "b1-o", "b1-g"];
const BOOK2_LESSON_IDS = ["b2-h", "b2-j", "b2-u", "b2-l", "b2-d", "b2-w", "b2-e", "b2-n", "b2-q", "b2-v", "b2-x", "b2-y", "b2-z"];
const BOOK3_LESSON_IDS = ["b3-ai", "b3-ie", "b3-ee", "b3-oa", "b3-th", "b3-ch", "b3-sh", "b3-ou", "b3-oi", "b3-ue", "b3-er", "b3-or", "b3-ar"];
const BOOK4_LESSON_IDS = Array.from({ length: 18 }, (_, i) => `b4-l${i + 1}`);

const LESSON_TO_BOOK = {};
for (const id of BOOK1_LESSON_IDS) LESSON_TO_BOOK[id] = 1;
for (const id of BOOK2_LESSON_IDS) LESSON_TO_BOOK[id] = 2;
for (const id of BOOK3_LESSON_IDS) LESSON_TO_BOOK[id] = 3;
for (const id of BOOK4_LESSON_IDS) LESSON_TO_BOOK[id] = 4;

const VALID_LESSON_IDS = new Set(Object.keys(LESSON_TO_BOOK));
const VALID_CURRICULUM_IDS = new Set(["monkey-yoga-phonics"]);
const VALID_SECTIONS = new Set(["welcome", "hear", "move", "see", "blend", "write", "play", "celebrate"]);
const VALID_CONFIDENCE_SIGNALS = new Set(["emerging", "developing", "confident"]);
const VALID_SKILLS = new Set(["listening", "movement", "visual_recognition", "blending", "writing", "application", "phonics", "sight_words"]);

function isValidLessonId(lessonId) {
  return typeof lessonId === "string" && VALID_LESSON_IDS.has(lessonId);
}

function bookIdForLesson(lessonId) {
  return LESSON_TO_BOOK[lessonId] ?? null;
}

module.exports = {
  VALID_CURRICULUM_IDS, VALID_LESSON_IDS, VALID_SECTIONS, VALID_CONFIDENCE_SIGNALS, VALID_SKILLS,
  isValidLessonId, bookIdForLesson,
};
