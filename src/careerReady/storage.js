// Career Ready — local persistence
// MVP storage layer. All progress and saved answers live in localStorage,
// keyed per Firebase uid so multiple accounts on one device don't collide.
import { BADGES, PRACTICE_BANKS, levelForXP } from "./data";

const PROGRESS_KEY = (uid) => `career_ready_progress_${uid}`;
const ANSWERS_KEY   = (uid) => `career_ready_answers_${uid}`;

const DEFAULT_PROGRESS = {
  xp: 0,
  sessionsCompleted: { interview: 0, internship: 0, parttime: 0 },
  completedQuestionIds: { interview: [], internship: [], parttime: [] },
  resumeToolsUsed: 0,
  confidenceHistory: [], // [{ score, date }]
  badges: [],
};

export function getProgress(uid) {
  if (!uid) return { ...DEFAULT_PROGRESS };
  try {
    const raw = localStorage.getItem(PROGRESS_KEY(uid));
    if (!raw) return { ...DEFAULT_PROGRESS };
    return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

function saveProgress(uid, progress) {
  if (!uid) return;
  localStorage.setItem(PROGRESS_KEY(uid), JSON.stringify(progress));
}

// Records a completed practice round, awards XP, and checks badge criteria.
// Returns { progress, newBadges } so the UI can celebrate newly earned badges.
export function recordPracticeResult(uid, { category, questionId, confidenceScore }) {
  const progress = getProgress(uid);

  progress.xp += 15 + Math.round((confidenceScore ?? 50) / 10);
  progress.sessionsCompleted[category] = (progress.sessionsCompleted[category] ?? 0) + 1;
  if (questionId && !progress.completedQuestionIds[category]?.includes(questionId)) {
    progress.completedQuestionIds[category] = [...(progress.completedQuestionIds[category] ?? []), questionId];
  }
  progress.confidenceHistory.push({ score: confidenceScore ?? 50, date: new Date().toISOString() });
  if (progress.confidenceHistory.length > 50) progress.confidenceHistory.shift();

  const newBadges = [];
  const has = (id) => progress.badges.includes(id);
  const award = (id) => { if (!has(id)) { progress.badges.push(id); newBadges.push(id); } };

  const totalSessions = Object.values(progress.sessionsCompleted).reduce((a, b) => a + b, 0);

  if (category === "interview") award("first_interview");
  if (category === "interview" && questionId === "tell_me" && (confidenceScore ?? 0) >= 80) award("strong_intro");
  if (category === "internship" && PRACTICE_BANKS.internship.every(q => progress.completedQuestionIds.internship?.includes(q.id))) award("internship_ready");
  if (category === "parttime" && PRACTICE_BANKS.parttime.every(q => progress.completedQuestionIds.parttime?.includes(q.id))) award("parttime_hero");
  if (totalSessions >= 10) award("confidence_builder");

  saveProgress(uid, progress);
  return { progress, newBadges: newBadges.map(id => BADGES.find(b => b.id === id)).filter(Boolean) };
}

export function recordResumeToolUse(uid) {
  const progress = getProgress(uid);
  progress.xp += 10;
  progress.resumeToolsUsed += 1;
  const newBadges = [];
  if (!progress.badges.includes("professional_email")) {
    progress.badges.push("professional_email");
    newBadges.push(BADGES.find(b => b.id === "professional_email"));
  }
  saveProgress(uid, progress);
  return { progress, newBadges };
}

export function getLevelInfo(uid) {
  const progress = getProgress(uid);
  return levelForXP(progress.xp);
}

// ── Saved answers ────────────────────────────────────────────────────────
export function getSavedAnswers(uid) {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(ANSWERS_KEY(uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSavedAnswer(uid, entry) {
  if (!uid) return [];
  const answers = getSavedAnswers(uid);
  const next = [{ id: `${Date.now()}`, savedAt: new Date().toISOString(), ...entry }, ...answers];
  localStorage.setItem(ANSWERS_KEY(uid), JSON.stringify(next));
  return next;
}

export function deleteSavedAnswer(uid, id) {
  if (!uid) return [];
  const next = getSavedAnswers(uid).filter(a => a.id !== id);
  localStorage.setItem(ANSWERS_KEY(uid), JSON.stringify(next));
  return next;
}
