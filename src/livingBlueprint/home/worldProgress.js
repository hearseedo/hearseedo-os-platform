// Real per-World progress, where it actually exists. Speak/Global/Career
// Ready each already track XP + a level ladder in localStorage (see
// speakReady/storage.js, globalReady/storage.js, careerReady/storage.js —
// same getProgress/levelForXP/nextLevel shape in all three). This computes
// "percent toward next level" from that real data.
//
// No such unified, easily-readable progress exists yet for the other
// Worlds/experiences (EIKEN's local state has xp/level but no clean
// level-ladder percent; phonics/innerkey/etc. are iframe apps whose
// progress lives in their own storage, not reachable from here) — those
// return null, and WorldCard simply omits the bar rather than faking one.
import { getProgress as getSpeakReadyProgress } from "../../speakReady/storage";
import { levelForXP as speakReadyLevelForXP, nextLevel as speakReadyNextLevel } from "../../speakReady/data";
import { getProgress as getGlobalReadyProgress } from "../../globalReady/storage";
import { levelForXP as globalReadyLevelForXP, nextLevel as globalReadyNextLevel } from "../../globalReady/data";
import { getProgress as getCareerReadyProgress } from "../../careerReady/storage";
import { levelForXP as careerReadyLevelForXP, nextLevel as careerReadyNextLevel } from "../../careerReady/data";

const SOURCES = {
  "speak-ready":  { getProgress: getSpeakReadyProgress,  levelForXP: speakReadyLevelForXP,  nextLevel: speakReadyNextLevel },
  "global-ready": { getProgress: getGlobalReadyProgress, levelForXP: globalReadyLevelForXP, nextLevel: globalReadyNextLevel },
  "career-ready": { getProgress: getCareerReadyProgress, levelForXP: careerReadyLevelForXP, nextLevel: careerReadyNextLevel },
};

export function getWorldProgress(worldId, uid) {
  const source = SOURCES[worldId];
  if (!source || !uid) return null;

  const { xp } = source.getProgress(uid);
  const current = source.levelForXP(xp);
  const next = source.nextLevel(xp);
  if (!next) return 100; // max level reached

  const span = next.minXP - current.minXP;
  if (span <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((xp - current.minXP) / span) * 100)));
}
