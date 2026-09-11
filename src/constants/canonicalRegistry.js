// Canonical App Registry (Phase 9, steps 1–2 of docs/HSD_FAMILY_PATHWAY_AUDIT_2026-09-11.md).
//
// This is the shared source of truth the audit calls for — but it is a
// COMPATIBILITY ADAPTER, not a replacement. Nothing reads from this file
// yet (no route, no component). constants/apps.js, constants/appRegistry.js
// and constants/worlds.js remain exactly as they are and keep powering
// AppModal/AppOrbit/WorldLaunch/etc. unmodified. getCanonicalRegistry()
// below derives one canonical view by merging those three existing
// registries at call time, then layering the audit's confirmed pathway
// corrections and new entries (Confidence First, Monkeys Talk & Unlock) on
// top. When a future phase migrates a pathway's real UI onto this
// registry, that pathway's entries can be hand-authored directly here
// instead of derived — see PATHWAY-9 step order in the audit doc.
//
// Do not delete apps.js/appRegistry.js/worlds.js. Per the audit's migration
// approach: define schema (this file) -> compatibility layer (this file's
// derivation logic) -> migrate one pathway at a time -> confirm parity ->
// only then retire an old registry.

import { APPS, APP_MAP } from "./apps.js";
import { APP_REGISTRY_MAP } from "./appRegistry.js";
import { WORLDS_MAP } from "./worlds.js";

/**
 * @typedef {"kids"|"teens"|"university"|"parents"|"adults"|"schools"} AudiencePath
 * @typedef {"speak"|"travel"|"work"} UniversityBranch
 * @typedef {"hear"|"see"|"do"|"talk"|"create"} ExperienceMode
 * @typedef {"book"|"workbook"|"workshop"|"presentation"|"keynote"} ContentType
 * @typedef {"child"|"parent"|"teen"|"university_student"|"adult"|"teacher"} ProfileType
 * @typedef {"active"|"beta"|"coming_soon"|"future"|"archived"} AppStatus
 * @typedef {"recommended"|"explore"|"hidden"} AppVisibility
 *
 * @typedef {Object} CanonicalApp
 * @property {string} id
 * @property {string} name
 * @property {string|null} route
 * @property {string|null} component        - file path, or "iframe:<ENV_VAR_NAME>" for external apps
 * @property {AudiencePath[]} audiencePaths
 * @property {string[]} programs
 * @property {"confidence-first"|null} methodology
 * @property {UniversityBranch[]} universityBranches
 * @property {ExperienceMode[]} experienceModes
 * @property {ContentType[]} contentTypes
 * @property {{min: number|null, max: number|null}} ageRange
 * @property {string[]|null} levels
 * @property {string[]} books
 * @property {string[]|null} lessons
 * @property {string[]} sections
 * @property {ProfileType[]} profileTypes
 * @property {boolean} requiresAI
 * @property {boolean} requiresCredits
 * @property {string|null} progressEvent
 * @property {AppStatus} status
 * @property {AppVisibility} visibility
 * @property {{ai: string[], tts: boolean, stripe: boolean, externalService: string|null}} dependencies
 */

// Per-app corrections confirmed in the audit (Sections 5–6) that the three
// legacy registries don't (and shouldn't have to) encode. Keyed by app id.
// Only fields that need to differ from the legacy-derived defaults are
// listed — everything else is inferred from apps.js/appRegistry.js/worlds.js.
const AUDIENCE_CORRECTIONS = {
  eiken: {
    audiencePaths: ["teens"], // was "kids" in both legacy registries — audit Section 5
    methodology: "confidence-first",
  },
  innerkey: {
    audiencePaths: ["parents"], // was "adult" — audit Section 5/6, explicit instruction
    methodology: "confidence-first",
  },
  "monkeys-unlock": {
    audiencePaths: ["teens"], // was "family" — audit Section 5
    status: "future",         // resolves the comingSoon/active inconsistency between
    visibility: "hidden",     // apps.js and appRegistry.js — audit Section 8
    books: ["book1","book2","book3","book4","book5","book6","book7","book8"],
    methodology: "confidence-first",
  },
  "career-ready": { universityBranches: ["work"] },
  "global-ready": { universityBranches: ["travel"] }, // kept whole — audit Section 5, do not split
  "speak-ready":  { universityBranches: ["speak"] },
  phonics: {
    audiencePaths: ["kids"],
    experienceModes: ["hear", "see", "do"],
    methodology: "confidence-first",
  },
  family: {
    // constants/apps.js's "family" id is the EXTERNAL iframe app (audience "both"),
    // distinct from the native HSD Family beta below — keep it cross-pathway.
    audiencePaths: ["kids", "parents"],
  },
};

// Entries that exist in the audit's confirmed architecture but have no
// corresponding row in any legacy registry yet. Hand-authored in full.
const NEW_ENTRIES = [
  {
    id: "hsd-family-native",
    name: "HSD Family",
    route: "/family/home",
    component: "src/family/FamilyHome.jsx",
    audiencePaths: ["kids", "parents"],
    programs: ["monkey-yoga-phonics"],
    methodology: "confidence-first",
    universityBranches: [],
    experienceModes: ["hear", "see", "do", "talk", "create"],
    contentTypes: [],
    ageRange: { min: 4, max: 12 },
    levels: null,
    books: [],
    lessons: null,
    sections: [],
    profileTypes: ["child", "parent"],
    requiresAI: true,
    requiresCredits: false,
    progressEvent: "HSD_OS_PROGRESS",
    status: "beta",
    visibility: "recommended",
    dependencies: { ai: ["gemini"], tts: false, stripe: false, externalService: null },
  },
  {
    id: "wondercamp-native",
    name: "WonderCamp Lesson Library",
    route: "/wondercamp",
    component: "src/pages/WonderCamp.jsx",
    audiencePaths: ["schools"], // corrected from the "kids" tag its brand-sibling app carries — audit Section 5
    programs: [],
    methodology: "confidence-first",
    universityBranches: [],
    experienceModes: [],
    contentTypes: [],
    ageRange: { min: null, max: null },
    levels: null,
    books: [],
    lessons: null,
    sections: [],
    profileTypes: ["teacher"],
    requiresAI: false,
    requiresCredits: false,
    progressEvent: null,
    status: "active",
    visibility: "recommended",
    dependencies: { ai: [], tts: false, stripe: false, externalService: null },
  },
  {
    id: "sip-speak-learn",
    name: "Sip Speak Learn",
    route: "/sip-speak-learn",
    component: "src/pages/SipSpeakLearn.jsx",
    audiencePaths: ["adults"],
    programs: [],
    methodology: "confidence-first",
    universityBranches: [],
    experienceModes: [],
    contentTypes: [],
    ageRange: { min: 18, max: null },
    levels: null,
    books: [],
    lessons: null,
    sections: [],
    profileTypes: ["adult"],
    requiresAI: true,
    requiresCredits: false,
    progressEvent: null,
    status: "beta", // built, feature-flagged off in production nav — audit Section 1/9 step 7
    visibility: "hidden",
    dependencies: { ai: [], tts: false, stripe: false, externalService: null },
  },
  {
    id: "confidence-first",
    name: "Confidence First: Thriving in the Age of AI",
    route: null,
    component: null,
    audiencePaths: ["adults", "university", "parents", "schools"],
    programs: ["confidence-first"],
    methodology: "confidence-first",
    universityBranches: [],
    experienceModes: [],
    contentTypes: ["book", "workbook", "workshop", "presentation", "keynote"],
    ageRange: { min: 16, max: null },
    levels: null,
    books: [],
    lessons: null,
    sections: [],
    profileTypes: ["adult", "university_student", "parent", "teacher"],
    requiresAI: false,
    requiresCredits: false,
    progressEvent: null,
    status: "future", // no code exists yet — audit Section 4
    visibility: "hidden",
    dependencies: { ai: [], tts: false, stripe: false, externalService: null },
  },
  {
    id: "monkeys-talk-unlock",
    name: "Monkeys Talk & Unlock™",
    route: null,
    component: null,
    audiencePaths: ["teens"],
    programs: ["monkeys-talk-unlock"],
    methodology: "confidence-first",
    universityBranches: [],
    experienceModes: [],
    contentTypes: [],
    ageRange: { min: 10, max: 15 }, // placeholder, not confirmed anywhere — audit Section 12, risk 3
    levels: null,
    books: ["book1","book2","book3","book4","book5","book6","book7","book8"],
    lessons: null,
    sections: [],
    profileTypes: ["child"], // placeholder — no distinct "teen" profileType exists yet, audit Section 12 risk 3
    requiresAI: true,
    requiresCredits: false,
    progressEvent: null,
    status: "future", // confirmed: do not build during this integration phase
    visibility: "hidden",
    dependencies: { ai: ["gemini"], tts: false, stripe: false, externalService: null },
  },
];

const AUDIENCE_TAG_TO_PATHS = {
  kids: ["kids"],
  adult: ["adults"],
  family: ["kids", "parents"],
  both: ["kids", "parents"],
  university: ["university"],
};

function legacyComponentFor(app) {
  if (!app.iframeUrl && app.iframeUrl !== "") return null;
  if (app.iframeUrl === "") return "native"; // e.g. eiken, career-ready — see apps.js comments
  return `iframe:VITE_APP_URL_${app.id.replace(/-/g, "_").toUpperCase()}`;
}

/**
 * Derives one canonical entry from the three legacy registries for a given
 * app id, then applies any confirmed correction. Returns null if the app
 * id isn't found in constants/apps.js (the most complete legacy source).
 * @param {string} id
 * @returns {CanonicalApp|null}
 */
export function getCanonicalApp(id) {
  const legacyApp = APP_MAP[id];
  if (!legacyApp) return null;
  const registryEntry = APP_REGISTRY_MAP[id];
  const world = Object.values(WORLDS_MAP).find(w => w.id === id || w.iframeAppId === id);
  const correction = AUDIENCE_CORRECTIONS[id] || {};

  /** @type {CanonicalApp} */
  const base = {
    id,
    name: legacyApp.name,
    route: world?.launch === "internal" ? world.route : null,
    component: legacyComponentFor(legacyApp),
    audiencePaths: AUDIENCE_TAG_TO_PATHS[legacyApp.audience] || [],
    programs: [],
    methodology: null,
    universityBranches: [],
    experienceModes: [],
    contentTypes: [],
    ageRange: { min: null, max: null },
    levels: null,
    books: [],
    lessons: null,
    sections: [],
    profileTypes: [],
    requiresAI: false,
    requiresCredits: false,
    progressEvent: legacyApp.iframeUrl ? "HSD_OS_PROGRESS" : null,
    status: legacyApp.comingSoon ? "coming_soon" : (registryEntry?.status || "active"),
    visibility: legacyApp.comingSoon ? "hidden" : "recommended",
    dependencies: {
      ai: [],
      tts: false,
      stripe: !legacyApp.free,
      externalService: legacyApp.iframeUrl || null,
    },
  };

  return { ...base, ...correction };
}

/**
 * The full canonical registry: every app.js-derived entry (with corrections
 * applied) plus the hand-authored NEW_ENTRIES that have no legacy row yet.
 * Pure function, no caching — cheap enough to call per-render if this is
 * ever wired into UI in a later phase.
 * @returns {CanonicalApp[]}
 */
export function getCanonicalRegistry() {
  const derived = APPS.map(a => getCanonicalApp(a.id)).filter(Boolean);
  return [...derived, ...NEW_ENTRIES];
}

/**
 * Filters the canonical registry to one audience pathway. An app with
 * multiple audiencePaths appears for each pathway it belongs to.
 * @param {AudiencePath} pathway
 * @returns {CanonicalApp[]}
 */
export function getAppsForPathway(pathway) {
  return getCanonicalRegistry().filter(app => app.audiencePaths.includes(pathway));
}

/**
 * Filters University's canonical entries to one branch (speak/travel/work).
 * @param {UniversityBranch} branch
 * @returns {CanonicalApp[]}
 */
export function getUniversityBranchApps(branch) {
  return getAppsForPathway("university").filter(app => app.universityBranches.includes(branch));
}
