// Canonical App Registry (Phase 9, steps 1–2 of docs/HSD_FAMILY_PATHWAY_AUDIT_2026-09-11.md).
// Schema corrected in Phase 3.1 (audience-vs-surface separation; explicit
// legacy->canonical translation functions for status/visibility/launch
// destination — see this file's function-level comments for what changed
// and why).
//
// This is a COMPATIBILITY ADAPTER, not a replacement. Nothing outside this
// file's own tests reads from it yet (no route, no component besides the
// single flagged Phase 3 consumer, src/family/kidsAppResolution.js).
// constants/apps.js, constants/appRegistry.js and constants/worlds.js
// remain exactly as they are and keep powering AppModal/AppOrbit/
// WorldLaunch/etc. unmodified. getCanonicalRegistry() below derives one
// canonical view by merging those three existing registries at call time,
// then layering the audit's confirmed pathway corrections and new entries
// (Confidence First, Monkeys Talk & Unlock) on top.
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
 * @typedef {"family"|"student"|"adult"|"educator"} Surface - the existing
 *   4-pathway HSDOS product surface (constants/pathways.js's PATHWAY_IDS)
 *   currently hosting/launching this app. DELIBERATELY SEPARATE from
 *   `audiencePaths` (who the content is FOR). Phase 3.1 correction: Monkey
 *   Yoga's learner audience is `kids`, but the HSDOS surface that currently
 *   launches it is the existing `family` pathway/route tree — these are not
 *   interchangeable and must never be asserted as equal.
 * @typedef {"speak"|"travel"|"work"} UniversityBranch
 * @typedef {"hear"|"see"|"do"|"talk"|"create"} ExperienceMode
 * @typedef {"book"|"workbook"|"workshop"|"presentation"|"keynote"} ContentType
 * @typedef {"child"|"parent"|"teen"|"university_student"|"adult"|"teacher"} ProfileType
 * @typedef {"active"|"beta"|"coming_soon"|"future"|"archived"} AppStatus
 * @typedef {"recommended"|"explore"|"hidden"} AppVisibility
 * @typedef {"iframe"|"native"|"modal"|"external_tab"|"none"} LaunchKind
 *
 * @typedef {Object} LaunchDestination
 * @property {LaunchKind} kind
 * @property {string|null} route - an internal HSDOS route, if any
 * @property {string|null} envVar - the VITE_APP_URL_* env var name backing an iframe/external launch, if any
 *
 * @typedef {Object} CanonicalApp
 * @property {string} id
 * @property {string} name
 * @property {AudiencePath[]} audiencePaths - WHO the content is for (learner audience)
 * @property {Surface[]} surfaces - WHERE it currently launches from today (existing HSDOS pathway/product surface)
 * @property {string[]} programs - named curriculum/program(s) this app belongs to, if any
 * @property {string|null} curriculumId - the exact stable progress-tracking identity
 *   (matches lib/curriculumRouting.js's MONKEY_YOGA_CURRICULUM_ID for phonics); null if
 *   this app has no server-tracked curriculum position
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
 * @property {LaunchDestination} launchDestination
 * @property {{ai: string[], tts: boolean, stripe: boolean, externalService: string|null}} dependencies
 */

// ── Explicit legacy -> canonical translation functions ──────────────────
// Phase 3.1 correction: the original adapter asserted legacy "visible" and
// canonical "recommended" were equivalent inline, with no single place
// that defined the translation and nothing testing it directly. These
// three functions are that single place — each is unit-tested in
// tests/canonical-schema-mapping.test.js.

/**
 * Legacy status/visibility signals come from two places that can disagree
 * (constants/apps.js's `comingSoon` boolean vs constants/appRegistry.js's
 * `status` string — the audit's original inventory found exactly one such
 * disagreement, for monkeys-unlock). `comingSoon: true` wins when present,
 * since it's the more specific, UI-enforced signal (AppOrbit/AppModal
 * actually hide/disable on it); appRegistry's `status` is the fallback.
 * @param {{comingSoon?: boolean}} legacyApp
 * @param {{status?: string}|undefined} registryEntry
 * @returns {AppStatus}
 */
export function mapLegacyStatus(legacyApp, registryEntry) {
  if (legacyApp?.comingSoon) return "coming_soon";
  if (registryEntry?.status === "active") return "active";
  if (registryEntry?.status) return registryEntry.status;
  return "active";
}

/**
 * `comingSoon: true` -> hidden (not offered at all yet). Everything else
 * legacy ever marked "live"/visible -> recommended, since none of the
 * three legacy registries have a third "browsable but not pushed" state —
 * that distinction (canonical "explore") does not exist in legacy data and
 * is only ever set by a hand-authored NEW_ENTRIES/AUDIENCE_CORRECTIONS
 * override, never inferred.
 * @param {{comingSoon?: boolean}} legacyApp
 * @returns {AppVisibility}
 */
export function mapLegacyVisibility(legacyApp) {
  return legacyApp?.comingSoon ? "hidden" : "recommended";
}

/**
 * Normalizes legacy launch information (an iframeUrl string that's either
 * empty, a real URL, or absent) plus worlds.js's `launch` kind into one
 * structured object, replacing the earlier ad-hoc `component:
 * "iframe:VITE_APP_URL_X"` string-encoding trick.
 * @param {{id: string, iframeUrl?: string}} legacyApp
 * @param {{launch?: string, route?: string}|undefined} world
 * @returns {LaunchDestination}
 */
export function buildLaunchDestination(legacyApp, world) {
  const envVar = `VITE_APP_URL_${legacyApp.id.replace(/-/g, "_").toUpperCase()}`;
  if (world?.launch === "internal") {
    return { kind: "native", route: world.route ?? null, envVar: null };
  }
  if (legacyApp.iframeUrl === "") {
    // e.g. eiken, career-ready — AppModal special-cases these as native
    // components/redirects rather than a real iframe; see apps.js comments.
    return { kind: "native", route: null, envVar: null };
  }
  if (typeof legacyApp.iframeUrl === "string" && legacyApp.iframeUrl.length > 0) {
    return { kind: world?.launch === "external" || legacyApp.iframeUrl ? "iframe" : "iframe", route: null, envVar };
  }
  return { kind: "none", route: null, envVar: null };
}

// Per-app corrections confirmed in the audit (Sections 5–6) that the three
// legacy registries don't (and shouldn't have to) encode. Keyed by app id.
// Only fields that need to differ from the legacy-derived defaults are
// listed — everything else is inferred from apps.js/appRegistry.js/worlds.js.
const AUDIENCE_CORRECTIONS = {
  eiken: {
    audiencePaths: ["teens"], // was "kids" in both legacy registries — audit Section 5
    surfaces: [],             // no dedicated route/surface today — modal-only from Dashboard/WorldLaunch
    methodology: "confidence-first",
  },
  innerkey: {
    audiencePaths: ["parents"], // was "adult" — audit Section 5/6, explicit instruction
    surfaces: ["adult"],        // legacy launch surface is still the adult/World modal today
    methodology: "confidence-first",
  },
  "monkeys-unlock": {
    audiencePaths: ["teens"], // was "family" — audit Section 5
    surfaces: [],
    status: "future",         // resolves the comingSoon/active inconsistency between
    visibility: "hidden",     // apps.js and appRegistry.js — audit Section 8
    books: ["book1","book2","book3","book4","book5","book6","book7","book8"],
    methodology: "confidence-first",
  },
  "career-ready": { universityBranches: ["work"], surfaces: ["student"] },
  "global-ready": { universityBranches: ["travel"], surfaces: ["student"] }, // kept whole — audit Section 5, do not split
  "speak-ready":  { universityBranches: ["speak"], surfaces: ["student"] },
  phonics: {
    // Phase 3.1 correction: phonics' LEARNER AUDIENCE is kids; the HSDOS
    // SURFACE that currently launches it is the existing "family" pathway
    // (src/family/ActivityPlayer.jsx -> AppModal). These are recorded as
    // two separate fields on purpose — do not collapse them back into one.
    audiencePaths: ["kids"],
    surfaces: ["family"],
    programs: ["monkey-yoga-phonics"],
    curriculumId: "monkey-yoga-phonics", // must match lib/curriculumRouting.js's MONKEY_YOGA_CURRICULUM_ID
    experienceModes: ["hear", "see", "do"],
    methodology: "confidence-first",
    progressEvent: "HSD_OS_PROGRESS",
    profileTypes: ["child"],
    books: ["book1", "book2", "book3", "book4"],
  },
  family: {
    // constants/apps.js's "family" id is the EXTERNAL iframe app (audience "both"),
    // distinct from the native HSD Family beta below — keep it cross-pathway.
    audiencePaths: ["kids", "parents"],
    surfaces: ["family"],
  },
};

// Entries that exist in the audit's confirmed architecture but have no
// corresponding row in any legacy registry yet. Hand-authored in full —
// audiencePaths/surfaces are kept separate here too, per the same
// Phase 3.1 correction.
const NEW_ENTRIES = [
  {
    id: "hsd-family-native",
    name: "HSD Family",
    audiencePaths: ["kids", "parents"],
    surfaces: ["family"],
    programs: ["monkey-yoga-phonics"],
    curriculumId: null, // this is the Family home shell itself, not a curriculum-tracked activity
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
    launchDestination: { kind: "native", route: "/family/home", envVar: null },
    dependencies: { ai: ["gemini"], tts: false, stripe: false, externalService: null },
  },
  {
    id: "wondercamp-native",
    name: "WonderCamp Lesson Library",
    audiencePaths: ["schools"], // corrected from the "kids" tag its brand-sibling app carries — audit Section 5
    surfaces: [], // no existing pathway surface hosts this yet — it's a standalone route
    programs: [],
    curriculumId: null,
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
    launchDestination: { kind: "native", route: "/wondercamp", envVar: null },
    dependencies: { ai: [], tts: false, stripe: false, externalService: null },
  },
  {
    id: "sip-speak-learn",
    name: "Sip Speak Learn",
    audiencePaths: ["adults"],
    surfaces: ["adult"],
    programs: [],
    curriculumId: null,
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
    launchDestination: { kind: "native", route: "/sip-speak-learn", envVar: null },
    dependencies: { ai: [], tts: false, stripe: false, externalService: null },
  },
  {
    id: "confidence-first",
    name: "Confidence First: Thriving in the Age of AI",
    audiencePaths: ["adults", "university", "parents", "schools"],
    surfaces: ["adult", "student"],
    programs: ["confidence-first"],
    curriculumId: null,
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
    launchDestination: { kind: "none", route: null, envVar: null },
    dependencies: { ai: [], tts: false, stripe: false, externalService: null },
  },
  {
    id: "monkeys-talk-unlock",
    name: "Monkeys Talk & Unlock™",
    audiencePaths: ["teens"],
    surfaces: [],
    programs: ["monkeys-talk-unlock"],
    curriculumId: null, // no curriculum/progress system exists yet — confirmed Future, not built this phase
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
    launchDestination: { kind: "none", route: null, envVar: null },
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
    audiencePaths: AUDIENCE_TAG_TO_PATHS[legacyApp.audience] || [],
    surfaces: [],
    programs: [],
    curriculumId: null,
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
    status: mapLegacyStatus(legacyApp, registryEntry),
    visibility: mapLegacyVisibility(legacyApp),
    launchDestination: buildLaunchDestination(legacyApp, world),
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
 * Filters the canonical registry to one learner audience. An app with
 * multiple audiencePaths appears for each audience it belongs to. This is
 * NOT the same as filtering by surface — see getAppsForSurface below.
 * @param {AudiencePath} audience
 * @returns {CanonicalApp[]}
 */
export function getAppsForPathway(audience) {
  return getCanonicalRegistry().filter(app => app.audiencePaths.includes(audience));
}

/**
 * Filters the canonical registry to one existing HSDOS product surface
 * (family/student/adult/educator) — i.e. "what currently launches from
 * this pathway's UI today", independent of who the content's learner
 * audience is. Phase 3.1 addition, kept separate from getAppsForPathway on
 * purpose per the audience-vs-surface correction.
 * @param {Surface} surface
 * @returns {CanonicalApp[]}
 */
export function getAppsForSurface(surface) {
  return getCanonicalRegistry().filter(app => app.surfaces.includes(surface));
}

/**
 * Filters University's canonical entries to one branch (speak/travel/work).
 * @param {UniversityBranch} branch
 * @returns {CanonicalApp[]}
 */
export function getUniversityBranchApps(branch) {
  return getAppsForPathway("university").filter(app => app.universityBranches.includes(branch));
}
