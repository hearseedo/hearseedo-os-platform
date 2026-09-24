// HSD OS AI — formal pathway configuration (Phase 1, 2026-09-09; extended
// Phase 2, 2026-09-09 with the visual/copy fields the pathway selector and
// <PathwayCard/> need).
//
// The four pathways the platform will eventually offer as distinct
// experiences on one shared account: Family, Confidence Student, Confidence
// Adult, HSD Educator. This is the "one authoritative config" for what a
// pathway IS — id, display name, route, description, visual identity —
// separate from whether a given account can currently access it (see
// pathwayAccess.js for that resolver) and separate from
// constants/worldCategories.js, which groups individual APPS (phonics,
// eiken, career-ready, ...) into four display categories for the Worlds
// page. worldCategories.js's four categories ("Kids", "Teens & University",
// "Adults", "Family") are the audit's cited precedent for this concept and
// map closely 1:1 onto these pathway ids, but are NOT merged into this file
// — that page's categories are a UI grouping of apps, this is the pathway
// product concept itself. A future pass could derive worldCategories from
// PATHWAYS + APP_PATHWAY_MAP below, but that's a later cleanup, not done
// here to keep this change additive and low-risk.
//
// `enabled` is the feature flag referenced throughout Phase 2 — flipping it
// per pathway (without deleting any UI/code) is how Family Beta, Confidence
// Alpha, and Educator development get turned on independently. Family,
// Student, and Adult are enabled now (Phase 2 builds their entry points);
// Educator stays disabled ("Coming Soon") — no educator environment exists
// yet, per the Phase 2 brief's explicit instruction not to fake it.
//
// `releaseStage` is a separate, purely-cosmetic signal from `enabled` — it's
// the badge shown on an accessible card ("Beta"/"Alpha"), independent of
// whether the pathway is reachable at all. Family is closest to real
// (December beta target); Student/Adult are earlier (Confidence AI Alpha);
// Educator has no stage since it isn't enabled.

export const PATHWAY_IDS = ["family", "student", "adult", "educator"];

const HERO_BASE = "/assets/hsd/core/pathway-heroes";

export const PATHWAYS = {
  family: {
    id:          "family",
    displayName: "HSD Family",
    audience:    "For children and parents",
    tagline:     "Play, learn, speak and grow together.",
    description: "Play, learn, speak and grow together with Monkey Yoga Phonics, Monkeys Talk & Unlock and more.",
    displayNameJp: "HSD ファミリー",
    audienceJp:    "お子さまと保護者の方へ",
    taglineJp:     "遊んで、学んで、話して、一緒に成長しよう。",
    descriptionJp: "モンキーヨガフォニックスやモンキーズ・トーク＆アンロックなどで、遊びながら学び、話し、一緒に成長しましょう。",
    route:       "/family",
    heroAsset:   `${HERO_BASE}/path-family-hero.webp`,
    accent:      { primary: "#e0559c", soft: "#fce8f2" }, // pink
    enabled:     true,
    releaseStage: "beta",
  },
  student: {
    id:          "student",
    displayName: "Confidence Student",
    audience:    "For high school to university",
    tagline:     "Learn. Practice. Prepare. Achieve.",
    description: "Build real-world English for exams, study abroad, presentations and your future.",
    displayNameJp: "コンフィデンス・スチューデント",
    audienceJp:    "高校生から大学生の方へ",
    taglineJp:     "学ぶ。練習する。備える。達成する。",
    descriptionJp: "試験、留学、プレゼンテーション、そして将来のために、実践的な英語力を身につけましょう。",
    route:       "/student",
    heroAsset:   `${HERO_BASE}/path-student-hero.webp`,
    accent:      { primary: "#2f6fed", soft: "#e8f0fe" }, // blue
    enabled:     true,
    releaseStage: "alpha",
  },
  adult: {
    id:          "adult",
    displayName: "Confidence Adult",
    audience:    "For professionals and lifelong learners",
    tagline:     "Work. Travel. Connect. Grow.",
    description: "Communicate with confidence at work, while travelling and in everyday life.",
    displayNameJp: "コンフィデンス・アダルト",
    audienceJp:    "社会人・生涯学習者の方へ",
    taglineJp:     "働く。旅する。つながる。成長する。",
    descriptionJp: "仕事でも旅行でも日常生活でも、自信を持ってコミュニケーションしましょう。",
    route:       "/adult",
    heroAsset:   `${HERO_BASE}/path-adult-hero.webp`,
    accent:      { primary: "#d99a1b", soft: "#fdf3df" }, // yellow/gold
    enabled:     true,
    releaseStage: "alpha",
  },
  educator: {
    id:          "educator",
    displayName: "HSD Educator",
    audience:    "For teachers and schools",
    tagline:     "Teach. Empower. Inspire. Together.",
    description: "Curriculum, classroom resources and AI support to make a bigger impact together.",
    displayNameJp: "HSD エデュケーター",
    audienceJp:    "教員・学校関係者の方へ",
    taglineJp:     "教える。力になる。刺激を与える。ともに。",
    descriptionJp: "カリキュラム、教室リソース、AIサポートで、より大きな成果を一緒に生み出しましょう。",
    route:       "/educator",
    heroAsset:   `${HERO_BASE}/path-educator-hero.webp`,
    accent:      { primary: "#2f9e5c", soft: "#e6f5ec" }, // green
    // 2026-09-23 — enabled for the October AI Summit: organizes existing
    // curriculum (WonderCamp's Seasonal Lessons), books, and Jona into a
    // real Educators experience (src/pathways/educator/). Non-admin
    // accounts still need an explicit pathwayAccess.educator grant to see
    // it as anything but "Coming Soon" — see lib/pathwayAccess.js, which
    // deliberately never infers educator access automatically.
    enabled:     true,
    releaseStage: "alpha",
  },
};

// Picks the display copy for a pathway in the given language (2026-09-24
// fix — PathwayCard/PathwayEntry/StudentHome/AdultHome were reading
// pathway.displayName/audience/tagline/description directly, which are
// always English; the *Jp fields above were unused). Falls back to the
// English fields if a Jp one is somehow missing, so this never renders
// blank text.
export function getPathwayText(pathway, lang) {
  if (!pathway) return null;
  const jp = lang === "jp";
  return {
    displayName: (jp && pathway.displayNameJp) || pathway.displayName,
    audience:    (jp && pathway.audienceJp)    || pathway.audience,
    tagline:     (jp && pathway.taglineJp)     || pathway.tagline,
    description: (jp && pathway.descriptionJp) || pathway.description,
  };
}

// App id -> pathway id. Used only for compatibility inference (mapping an
// existing account's subscriptions[] to a pathway when it has no explicit
// pathwayAccess yet — see pathwayAccess.js). Deliberately conservative:
// "music-album" and any future app id not listed here maps to nothing.
export const APP_PATHWAY_MAP = {
  phonics:          "family",
  eiken:             "family",
  wondercamp:        "family",
  "monkeys-unlock":  "family",
  family:            "family",
  "career-ready":    "student",
  "global-ready":    "student",
  "speak-ready":     "student",
  innerkey:          "adult",
  sipswitch:         "adult",
  speak:             "adult",
  "sip-speak-learn": "adult",
};

export function isValidPathwayId(id) {
  return PATHWAY_IDS.includes(id);
}
