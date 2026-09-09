// Real per-World progress, where it actually exists. Speak/Global/Career
// Ready each already track XP + a level ladder in localStorage (see
// speakReady/storage.js, globalReady/storage.js, careerReady/storage.js —
// same getProgress/levelForXP/nextLevel shape in all three). This computes
// "percent toward next level" from that real data.
//
// EIKEN also has real local progress (src/eiken/storage.js), just not in the
// same levelForXP/nextLevel shape — it uses a flat 200 XP per grade, the same
// threshold EikenApp.jsx's own "XP until next level" readout uses (see its
// `200 - user.xp` line), so this mirrors that rather than inventing a curve.
// EikenApp always launches with activeMember=null (see WorldLaunch.jsx), so
// progress is read from that same non-member-specific local record.
//
// No such reachable progress exists yet for the remaining Worlds/experiences
// (Family, Wondercamp, Sip & Switch, Monkeys Unlock, Inner Key, etc.) — those
// are iframe-embedded apps whose progress lives in their own separately
// hosted app's storage, not reachable from this codebase. Those return null,
// and WorldCard simply omits the bar rather than faking one.
import { getProgress as getSpeakReadyProgress } from "../../speakReady/storage";
import { levelForXP as speakReadyLevelForXP, nextLevel as speakReadyNextLevel } from "../../speakReady/data";
import { getProgress as getGlobalReadyProgress } from "../../globalReady/storage";
import { levelForXP as globalReadyLevelForXP, nextLevel as globalReadyNextLevel } from "../../globalReady/data";
import { getProgress as getCareerReadyProgress } from "../../careerReady/storage";
import { levelForXP as careerReadyLevelForXP, nextLevel as careerReadyNextLevel } from "../../careerReady/data";
import { getEikenLocalState } from "../../eiken/storage";

const EIKEN_XP_PER_LEVEL = 200;

const SOURCES = {
  "speak-ready":  { getProgress: getSpeakReadyProgress,  levelForXP: speakReadyLevelForXP,  nextLevel: speakReadyNextLevel },
  "global-ready": { getProgress: getGlobalReadyProgress, levelForXP: globalReadyLevelForXP, nextLevel: globalReadyNextLevel },
  "career-ready": { getProgress: getCareerReadyProgress, levelForXP: careerReadyLevelForXP, nextLevel: careerReadyNextLevel },
};

export function getWorldProgress(worldId, uid) {
  if (!uid) return null;

  if (worldId === "eiken") {
    const { xp } = getEikenLocalState(null);
    return Math.max(0, Math.min(100, Math.round((xp / EIKEN_XP_PER_LEVEL) * 100)));
  }

  const source = SOURCES[worldId];
  if (!source) return null;

  const { xp } = source.getProgress(uid);
  const current = source.levelForXP(xp);
  const next = source.nextLevel(xp);
  if (!next) return 100; // max level reached

  const span = next.minXP - current.minXP;
  if (span <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((xp - current.minXP) / span) * 100)));
}
