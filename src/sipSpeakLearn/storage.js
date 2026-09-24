// Sip Speak Learn — local persistence (Phases 1–4)
// MVP storage layer. All progress lives in localStorage, keyed per Firebase uid
// so multiple accounts on one device don't collide. Mirrors the speakReady/
// storage pattern used elsewhere in the platform. Firestore sync arrives with
// Table/Host mode (Phases 5–6); nothing here writes to Firestore yet.
//
// The "guest" fallback previously here was removed (P0, 2026-09-24) —
// investigated and confirmed to have no legitimate use: /sip-speak-learn is
// wrapped in <ProtectedRoute> (src/App.jsx), there is no anonymous sign-in
// anywhere in this app, and Table/Host Mode's own participant flow also
// requires a real signed-in uid. It was pure defensive code for a uid that,
// in practice, is always present by the time these run — multiple real
// users would otherwise have silently shared one generic "guest" bucket,
// which is exactly the kind of ambiguous shared state the platform doesn't
// want. Callers now pass a profile-scoped identifier (see
// src/lib/profileScope.js's profileScopedStorageUid) instead.
import { LESSONS_BY_SEASON, TOTAL_LESSONS } from "./data";

const PROGRESS_KEY    = (uid) => `ssl_progress_${uid}`;
const EXPRESSIONS_KEY = (uid) => `ssl_expressions_${uid}`;

const DEFAULT_PROGRESS = {
  completedLessonIds: [],           // ["winter-1", ...]
  lastLesson: null,                 // { seasonId, n } — for "Resume"
  speakingSeconds: 0,               // total across all activities
  conversationsCompleted: 0,        // DO sessions finished
  difficulty: "intermediate",       // preferred level
  confidence: {},                   // { [lessonId]: { pre, post, date } }
  confidenceHistory: [],            // [{ score, date }] — for the journey chart
  gamesPlayed: {},                  // { conversation_roulette: 3, ... }
};

export function getProgress(uid) {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY(uid));
    if (!raw) return { ...DEFAULT_PROGRESS };
    return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

function save(uid, progress) {
  try { localStorage.setItem(PROGRESS_KEY(uid), JSON.stringify(progress)); } catch {}
}

// ── Lesson state ──────────────────────────────────────────────────────────
export function lessonState(uid, lessonId) {
  const p = getProgress(uid);
  if (p.completedLessonIds.includes(lessonId)) return "completed";
  if (p.lastLesson && `${p.lastLesson.seasonId}-${p.lastLesson.n}` === lessonId) return "in-progress";
  return "not-started";
}

export function markLessonStarted(uid, seasonId, n) {
  const p = getProgress(uid);
  p.lastLesson = { seasonId, n };
  save(uid, p);
  return p;
}

export function markLessonCompleted(uid, lessonId) {
  const p = getProgress(uid);
  if (!p.completedLessonIds.includes(lessonId)) p.completedLessonIds.push(lessonId);
  p.lastLesson = null;
  save(uid, p);
  return p;
}

// ── Speaking time & conversations ─────────────────────────────────────────
export function addSpeakingSeconds(uid, seconds) {
  if (!seconds || seconds < 0) return;
  const p = getProgress(uid);
  p.speakingSeconds += Math.round(seconds);
  save(uid, p);
}

export function recordConversationDone(uid) {
  const p = getProgress(uid);
  p.conversationsCompleted += 1;
  save(uid, p);
}

// ── Confidence (pre/post per lesson) ──────────────────────────────────────
export function recordConfidence(uid, lessonId, phase, score) {
  const p = getProgress(uid);
  const entry = p.confidence[lessonId] || {};
  entry[phase] = score;            // phase: "pre" | "post"
  entry.date = new Date().toISOString();
  p.confidence[lessonId] = entry;
  if (phase === "post") {
    p.confidenceHistory.push({ score, date: entry.date });
    if (p.confidenceHistory.length > 60) p.confidenceHistory.shift();
  }
  save(uid, p);
  return p;
}

// ── Difficulty preference ─────────────────────────────────────────────────
export function setDifficulty(uid, difficulty) {
  const p = getProgress(uid);
  p.difficulty = difficulty;
  save(uid, p);
}

// ── Games ─────────────────────────────────────────────────────────────────
export function recordGamePlayed(uid, gameId) {
  const p = getProgress(uid);
  p.gamesPlayed[gameId] = (p.gamesPlayed[gameId] || 0) + 1;
  save(uid, p);
}

// ── Saved expressions ─────────────────────────────────────────────────────
export function getSavedExpressions(uid) {
  try {
    const raw = localStorage.getItem(EXPRESSIONS_KEY(uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveExpression(uid, expression) {
  const list = getSavedExpressions(uid);
  if (list.some((e) => e.text === expression.text)) return list; // dedupe
  const next = [{ ...expression, savedAt: new Date().toISOString() }, ...list];
  try { localStorage.setItem(EXPRESSIONS_KEY(uid), JSON.stringify(next)); } catch {}
  return next;
}

export function removeExpression(uid, text) {
  const next = getSavedExpressions(uid).filter((e) => e.text !== text);
  try { localStorage.setItem(EXPRESSIONS_KEY(uid), JSON.stringify(next)); } catch {}
  return next;
}

export function isExpressionSaved(uid, text) {
  return getSavedExpressions(uid).some((e) => e.text === text);
}

// ── Derived stats for dashboards ──────────────────────────────────────────
export function getStats(uid) {
  const p = getProgress(uid);
  const completed = p.completedLessonIds.length;
  const speakingMinutes = Math.round(p.speakingSeconds / 60);
  const savedCount = getSavedExpressions(uid).length;

  // Confidence % = latest post score (1–5) mapped to 0–100, else based on progress.
  const latest = p.confidenceHistory[p.confidenceHistory.length - 1];
  const confidencePct = latest
    ? Math.round((latest.score / 5) * 100)
    : Math.min(100, Math.round((completed / TOTAL_LESSONS) * 100) + 20);

  return {
    completed,
    totalLessons: TOTAL_LESSONS,
    speakingMinutes,
    conversationsCompleted: p.conversationsCompleted,
    savedCount,
    confidencePct,
    lastLesson: p.lastLesson,
    difficulty: p.difficulty,
  };
}

// Per-season completion, for season cards / progress rings.
export function seasonProgress(uid, seasonId) {
  const p = getProgress(uid);
  const lessons = LESSONS_BY_SEASON[seasonId] || [];
  const done = lessons.filter((l) => p.completedLessonIds.includes(l.id)).length;
  return { done, total: lessons.length, pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0 };
}
