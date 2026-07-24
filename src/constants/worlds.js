// Living Blueprint — World registry
// Presentation/layout metadata for the six launch Worlds (rebuild prompt
// section 8). This is additive to constants/appRegistry.js, which remains
// the source of truth for access control (subscriptionRequirements). Each
// entry here maps to an appRegistry appId by `id` — do not duplicate access
// logic here, read it from APP_REGISTRY_MAP at render time.
//
// launch:
//   "internal" — a real in-app route, stays inside the HSDOS shell.
//   "external" — a cross-origin iframe sub-app launched via the existing
//                 AppModal SSO bridge (constants/apps.js APPS[id].iframeUrl,
//                 sso_token/id_token query params). `iframeAppId` points at
//                 the APPS entry to read the URL from.
//   "modal"    — a native in-app component (e.g. EIKEN's lazy-loaded
//                 EikenApp) that currently only opens from Dashboard's app
//                 grid via AppModal, not a standalone route yet. Flagged
//                 rather than given a fake route.

import { TOKENS } from "./tokens";

export const WORLDS = [
  {
    id:      "speak-ready",
    name:    "Speak Ready",
    promise: "Confident, purposeful spoken communication — even when it gets difficult.",
    audience: ["university_students", "young_adults"],
    route:   "/speak-ready",
    launch:  "internal",
    accent:  TOKENS.worldAccent["speak-ready"],
    art: {
      card:   "/assets/worlds/speak-ready-card.jpg",
      hero:   "/assets/worlds/speak-ready-hero.jpg",
      mobile: "/assets/worlds/speak-ready-mobile.jpg",
    },
    artStatus: "missing", // not present in public/assets/worlds/ or source visuals folder — flagged, needs production
    analyticsName: "world_speak_ready",
  },
  {
    id:      "global-ready",
    name:    "Global Ready",
    promise: "Study abroad, travel, and cross-cultural confidence.",
    audience: ["university_students", "young_adults"],
    route:   "/global-ready",
    launch:  "internal",
    accent:  TOKENS.worldAccent["global-ready"],
    art: {
      card:   "/assets/worlds/global-ready-card.jpg",
      hero:   "/assets/worlds/global-ready-hero.jpg",
      mobile: "/assets/worlds/global-ready-mobile.jpg",
    },
    artStatus: "ok",
    analyticsName: "world_global_ready",
  },
  {
    id:      "career-ready",
    name:    "Career Ready",
    promise: "Career identity, interviews, and professional communication.",
    audience: ["university_students", "young_adults"],
    route:   "/career-ready",
    launch:  "internal",
    accent:  TOKENS.worldAccent["career-ready"],
    art: {
      card:   "/assets/worlds/career-ready-card.jpg",
      hero:   "/assets/worlds/career-ready-hero.jpg",
      mobile: "/assets/worlds/career-ready-mobile.jpg",
    },
    artStatus: "ok",
    analyticsName: "world_career_ready",
  },
  {
    id:      "phonics",
    name:    "Monkey Yoga Phonics",
    promise: "Phonics, movement, and confidence for ages 4–8.",
    audience: ["children"],
    launch:  "external", // manus.space iframe (V1) — see project_phonics_v2 memory for V2 plan
    iframeAppId: "phonics", // constants/apps.js → VITE_APP_URL_PHONICS
    accent:  TOKENS.worldAccent["phonics"],
    art: {
      card:   "/assets/worlds/monkey-yoga-card.jpg",
      hero:   "/assets/worlds/monkey-yoga-hero.jpg",
      mobile: "/assets/worlds/monkey-yoga-mobile.jpg",
    },
    artStatus: "ok",
    analyticsName: "world_monkey_yoga_phonics",
  },
  {
    id:      "eiken",
    name:    "EIKEN",
    promise: "EIKEN Grade 5 through Grade 1 — placement, missions, and confidence-first coaching.",
    audience: ["students", "test_prep"],
    launch:  "modal", // native EikenApp component, currently only opens via Dashboard's AppModal — no standalone route yet
    accent:  TOKENS.worldAccent["eiken"],
    art: {
      card:   "/assets/worlds/eiken-card.jpg",
      hero:   "/assets/worlds/eiken-hero.jpg",
      mobile: "/assets/worlds/eiken-mobile.jpg",
    },
    artStatus: "ok",
    analyticsName: "world_eiken",
  },
  {
    id:      "innerkey",
    name:    "Inner Key Blueprint",
    promise: "Guided self-reflection, aligned action, and growth tracking.",
    audience: ["adults"],
    launch:  "external", // The Inner Key Blueprint™ iframe app (VITE_APP_URL_INNERKEY) — NOT /blueprint,
                          // which is a separate one-time "building your blueprint" transition page
    iframeAppId: "innerkey",
    accent:  TOKENS.worldAccent["innerkey"],
    art: {
      card:   "/assets/worlds/innerkey-card.jpg",
      hero:   "/assets/worlds/innerkey-hero.jpg",
      mobile: "/assets/worlds/innerkey-mobile.jpg",
    },
    artStatus: "ok",
    analyticsName: "world_inner_key_blueprint",
  },
];

export const WORLDS_MAP = Object.fromEntries(WORLDS.map(w => [w.id, w]));

// Internal Worlds link straight to their real route; external/modal Worlds
// route through the Living Blueprint World landing page, which owns the
// iframe SSO launch / "opens from Dashboard" messaging for those.
export function worldHref(world) {
  return world.launch === "internal" ? world.route : `/preview/world/${world.id}`;
}
