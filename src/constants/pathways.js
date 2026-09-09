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
    route:       "/educator",
    heroAsset:   `${HERO_BASE}/path-educator-hero.webp`,
    accent:      { primary: "#2f9e5c", soft: "#e6f5ec" }, // green
    enabled:     false, // no educator environment exists yet — shown as Coming Soon
    releaseStage: null,
  },
};

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
