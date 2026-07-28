// EIKEN Monkey — adaptive Placement Assessment engine.
// A deterministic staircase state machine (no ML dependency): pulls real
// questions from the existing content banks (data.js), climbs a grade after
// 2 correct in a row, drops a grade after 2 wrong in a row. Speaking items
// have no "correct" answer — hesitation (client-timed elapsed-time-before-
// answering) nudges toward an easier, more-supportive question instead of a
// wrong one, per the spec's "coach hesitation, never punish" requirement.
import { LEVELS, LISTENING_BANK, READING_BANK, SPEAKING_BANK } from "./data";

// Vocabulary/Grammar don't have dedicated banks yet (Phase 5 adds those lesson
// types) — reading questions double as the vocabulary/grammar/reading signal
// for placement purposes until then.
const SKILLS_ORDER = ["listening", "reading", "speaking"];
const QUESTIONS_PER_SKILL = 3;
const HESITATION_THRESHOLD_MS = 8000;

function pickQuestion(skill, level) {
  const bank = skill === "listening" ? LISTENING_BANK : skill === "reading" ? READING_BANK : null;
  if (bank) {
    const items = bank[level] ?? bank[LEVELS[0]];
    const item = items[Math.floor(Math.random() * items.length)];
    return { skill, level, type: "mcq", ...item };
  }
  // speaking — free response, no answer key
  const items = SPEAKING_BANK[level] ?? SPEAKING_BANK[LEVELS[0]];
  const prompt = items[Math.floor(Math.random() * items.length)];
  return { skill, level, type: "speaking", prompt };
}

export function createPlacementSession(startLevel) {
  const levelIndex = Math.max(0, LEVELS.indexOf(startLevel));
  const state = {
    levelIndex,
    skillIndex: 0,
    questionInSkill: 0,
    correctStreak: 0,
    wrongStreak: 0,
    answers: [],
    done: false,
  };
  return { ...state, question: pickQuestion(SKILLS_ORDER[0], LEVELS[levelIndex]) };
}

// result: { correct?: boolean, hesitated?: boolean, elapsedMs?: number }
// For MCQ items pass `correct`. For speaking items pass `hesitated` (or
// `elapsedMs` and this derives hesitation from HESITATION_THRESHOLD_MS).
export function submitPlacementAnswer(state, result) {
  const hesitated = result.hesitated ?? (result.elapsedMs != null && result.elapsedMs > HESITATION_THRESHOLD_MS);
  const needsEasier = state.question.type === "mcq" ? result.correct === false : hesitated;
  const doingWell    = state.question.type === "mcq" ? result.correct === true  : !hesitated;

  let { levelIndex, correctStreak, wrongStreak } = state;

  if (doingWell) {
    correctStreak += 1;
    wrongStreak = 0;
    if (correctStreak >= 2 && levelIndex < LEVELS.length - 1) {
      levelIndex += 1;
      correctStreak = 0;
    }
  } else if (needsEasier) {
    wrongStreak += 1;
    correctStreak = 0;
    if (wrongStreak >= 2 && levelIndex > 0) {
      levelIndex -= 1;
      wrongStreak = 0;
    }
  }

  const answers = [...state.answers, {
    skill: state.question.skill,
    level: state.question.level,
    type:  state.question.type,
    correct: result.correct ?? null,
    hesitated,
  }];

  let { skillIndex, questionInSkill } = state;
  questionInSkill += 1;
  if (questionInSkill >= QUESTIONS_PER_SKILL) {
    questionInSkill = 0;
    skillIndex += 1;
    correctStreak = 0;
    wrongStreak = 0;
  }

  const done = skillIndex >= SKILLS_ORDER.length;
  const next = {
    levelIndex, skillIndex, questionInSkill, correctStreak, wrongStreak, answers, done,
  };

  return {
    ...next,
    question: done ? null : pickQuestion(SKILLS_ORDER[skillIndex], LEVELS[levelIndex]),
  };
}

// Fast, synchronous "automatic placement" check (spec: platform level, prior
// progress, completed lessons) — separate from and simpler than the full
// adaptive assessment above. No AI call, no new network reads: only signals
// already available on the local EIKEN user state and platform profile.
// Returns null when the student's current level already looks right (no
// banner needed), or the suggested level string otherwise.
export function recommendGrade(eikenUser, platformUser) {
  if (!eikenUser?.level) return null;
  const currentIndex = LEVELS.indexOf(eikenUser.level);
  if (currentIndex === -1) return null;

  // Strong, consistent progress at the current grade suggests moving up;
  // very little traction after a fair number of sessions suggests easing down.
  const xp = eikenUser.xp ?? 0;
  const sessions = eikenUser.sessions ?? 0;

  let suggestedIndex = currentIndex;
  if (sessions >= 8 && xp >= 150 && currentIndex < LEVELS.length - 1) {
    suggestedIndex = currentIndex + 1;
  } else if (sessions >= 8 && xp < 40 && currentIndex > 0) {
    suggestedIndex = currentIndex - 1;
  }

  if (suggestedIndex === currentIndex) return null;
  return LEVELS[suggestedIndex];
}

export function summarizePlacement(state) {
  const hesitationCount = state.answers.filter(a => a.hesitated).length;
  const mcqAnswers = state.answers.filter(a => a.type === "mcq");
  const mcqCorrect = mcqAnswers.filter(a => a.correct).length;
  return {
    recommendedLevel: LEVELS[state.levelIndex],
    mcqCorrect,
    mcqTotal: mcqAnswers.length,
    hesitationCount,
    speakingCount: state.answers.filter(a => a.type === "speaking").length,
    answers: state.answers,
  };
}
