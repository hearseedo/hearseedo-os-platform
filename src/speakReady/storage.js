// Speak Ready — local persistence
// MVP storage layer. All progress and saved phrases live in localStorage,
// keyed per Firebase uid so multiple accounts on one device don't collide.
import { BADGES, PRACTICE_BANKS, levelForXP } from "./data";

const PROGRESS_KEY = (uid) => `speak_ready_progress_${uid}`;
const PHRASES_KEY  = (uid) => `speak_ready_phrases_${uid}`;

const DEFAULT_PROGRESS = {
  xp: 0,
  sessionsCompleted: { missions: 0, quick_thinking: 0, picture: 0, debate: 0, story_builder: 0 },
  completedScenarioIds: { missions: [], quick_thinking: [], picture: [], debate: [], story_builder: [] },
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
export function recordPracticeResult(uid, { category, scenarioId, confidenceScore }) {
  const progress = getProgress(uid);

  progress.xp += 15 + Math.round((confidenceScore ?? 50) / 10);
  progress.sessionsCompleted[category] = (progress.sessionsCompleted[category] ?? 0) + 1;
  if (scenarioId && !progress.completedScenarioIds[category]?.includes(scenarioId)) {
    progress.completedScenarioIds[category] = [...(progress.completedScenarioIds[category] ?? []), scenarioId];
  }
  progress.confidenceHistory.push({ score: confidenceScore ?? 50, date: new Date().toISOString() });
  if (progress.confidenceHistory.length > 50) progress.confidenceHistory.shift();

  const newBadges = [];
  const has = (id) => progress.badges.includes(id);
  const award = (id) => { if (!has(id)) { progress.badges.push(id); newBadges.push(id); } };

  const totalSessions = Object.values(progress.sessionsCompleted).reduce((a, b) => a + b, 0);
  const allDone = (cat) => PRACTICE_BANKS[cat].every(s => progress.completedScenarioIds[cat]?.includes(s.id));

  award("first_words");
  if (category === "missions" && allDone("missions")) award("mission_ready");
  if (category === "quick_thinking" && allDone("quick_thinking")) award("quick_thinker");
  if (category === "picture" && allDone("picture")) award("picture_perfect");
  if (category === "debate" && allDone("debate")) award("great_debater");
  if (category === "story_builder" && allDone("story_builder")) award("storyteller");
  if (totalSessions >= 10) award("confidence_builder");

  saveProgress(uid, progress);
  return { progress, newBadges: newBadges.map(id => BADGES.find(b => b.id === id)).filter(Boolean) };
}

export function getLevelInfo(uid) {
  const progress = getProgress(uid);
  return levelForXP(progress.xp);
}

// ── Saved phrases ────────────────────────────────────────────────────────
export function getSavedPhrases(uid) {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(PHRASES_KEY(uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSavedPhrase(uid, entry) {
  if (!uid) return [];
  const phrases = getSavedPhrases(uid);
  const next = [{ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, savedAt: new Date().toISOString(), ...entry }, ...phrases];
  localStorage.setItem(PHRASES_KEY(uid), JSON.stringify(next));
  return next;
}

export function deleteSavedPhrase(uid, id) {
  if (!uid) return [];
  const next = getSavedPhrases(uid).filter(p => p.id !== id);
  localStorage.setItem(PHRASES_KEY(uid), JSON.stringify(next));
  return next;
}
