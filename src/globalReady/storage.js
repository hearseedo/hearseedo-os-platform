// Global Ready — local persistence
// MVP storage layer. All progress and saved phrases live in localStorage,
// keyed per Firebase uid so multiple accounts on one device don't collide.
import { BADGES, PRACTICE_BANKS, levelForXP } from "./data";

const PROGRESS_KEY = (uid) => `global_ready_progress_${uid}`;
const PHRASES_KEY  = (uid) => `global_ready_phrases_${uid}`;

const CULTURE_SCENARIO_IDS = ["culture", "explain_japan"];

const DEFAULT_PROGRESS = {
  xp: 0,
  sessionsCompleted: { study_abroad: 0, travel: 0, friends: 0, campus: 0 },
  completedScenarioIds: { study_abroad: [], travel: [], friends: [], campus: [] },
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

  award("first_global");
  if (category === "travel" && allDone("travel")) award("travel_ready");
  if (category === "study_abroad" && allDone("study_abroad")) award("study_abroad_ready");
  if (category === "friends" && allDone("friends")) award("friendly_convo");
  if (category === "campus" && allDone("campus")) award("campus_communicator");
  if (CULTURE_SCENARIO_IDS.includes(scenarioId)) award("culture_connector");
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
