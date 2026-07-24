// Bridges the existing recommendationEngine (constants/apps.js appIds, e.g.
// "eiken", "speak", "innerkey") to the Living Blueprint World registry
// (constants/worlds.js ids, e.g. "eiken", "speak-ready", "innerkey"). Two
// different id spaces exist because appRegistry/apps.js predate the World
// concept — this crosswalk is additive, not a replacement for either.
import { generateRecommendations } from "../../lib/recommendationEngine";
import { WORLDS_MAP } from "../../constants/worlds";

const LEGACY_APP_TO_WORLD = {
  eiken:     "eiken",
  speak:     "speak-ready",
  innerkey:  "innerkey",
  sipswitch: null,
  family:    null,
  wondercamp: null,
};

export function getTodaysRecommendation(user) {
  const rec = generateRecommendations(user, null);
  const worldId = LEGACY_APP_TO_WORLD[rec.app?.appId] ?? "innerkey";
  const world = WORLDS_MAP[worldId] ?? WORLDS_MAP.innerkey;
  return { ...rec, world };
}
