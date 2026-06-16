// HSD OS – Learner Profile helpers
// Read/write the unified learner profile from Firestore.

import { db } from "./firebase";
import {
  doc, getDoc, setDoc, updateDoc, collection,
  query, orderBy, limit, getDocs, serverTimestamp,
} from "firebase/firestore";
import { computeConfidenceScore, analyzeMessage, computeConfidenceTrend } from "./confidenceEngine";
import { generateRecommendations } from "./recommendationEngine";

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getLearnerProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "learnerProfiles", uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

export async function getConfidenceHistory(uid, days = 30) {
  try {
    const q    = query(collection(db, "learnerProfiles", uid, "confidenceHistory"), orderBy("date", "desc"), limit(days));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  } catch { return []; }
}

export async function getRecentInteractions(uid, count = 20) {
  try {
    const q    = query(collection(db, "learnerProfiles", uid, "interactions"), orderBy("timestamp", "desc"), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  } catch { return []; }
}

// ── Initialize profile on first login ────────────────────────────────────────

export async function initLearnerProfile(uid) {
  const ref  = doc(db, "learnerProfiles", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(ref, {
    uid,
    confidenceScore:    50,
    confidenceTrend:    "stable",
    confidenceComponents: { consistency: 50, frequency: 0, persistence: 0, engagement: 50 },
    engagementScore:    50,
    totalInteractions:  0,
    skills: {
      vocabulary:    50,
      grammar:       50,
      pronunciation: 50,
      speaking:      50,
      listening:     50,
      reading:       50,
      writing:       50,
      mindset:       50,
    },
    appUsage:           {},
    favoriteTopics:     [],
    recurringMistakes:  [],
    successfulStrategies: [],
    recommendations:    {},
    createdAt:          serverTimestamp(),
    updatedAt:          serverTimestamp(),
  });
}

// ── Update after an AI interaction ───────────────────────────────────────────

export async function updateProfileAfterChat(uid, userMessage, aiResponse, appId = "dashboard") {
  try {
    const ref         = doc(db, "learnerProfiles", uid);
    const snap        = await getDoc(ref);
    const profile     = snap.exists() ? snap.data() : {};
    const msgAnalysis = analyzeMessage(userMessage);

    // Running engagement average
    const prevEngagement     = profile.engagementScore ?? 50;
    const newEngagement      = Math.round(prevEngagement * 0.85 + msgAnalysis.score * 0.15);
    const totalInteractions  = (profile.totalInteractions ?? 0) + 1;

    // App usage count
    const appUsage = { ...(profile.appUsage ?? {}), [appId]: ((profile.appUsage?.[appId] ?? 0) + 1) };

    // Confidence history for trend
    const history     = await getConfidenceHistory(uid, 8);
    const trend       = computeConfidenceTrend(history);

    // Save interaction signal (no raw message text — privacy)
    const interactionRef = doc(collection(db, "learnerProfiles", uid, "interactions"));
    await setDoc(interactionRef, {
      appId,
      messageLength:  userMessage.length,
      signals:        msgAnalysis.signals,
      engagementScore: msgAnalysis.score,
      confidenceImpact: msgAnalysis.delta,
      timestamp:      serverTimestamp(),
    });

    // Update profile
    await updateDoc(ref, {
      engagementScore:   newEngagement,
      totalInteractions,
      appUsage,
      confidenceTrend:   trend,
      updatedAt:         serverTimestamp(),
    });

    // Daily confidence snapshot
    const today     = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
    const histRef   = doc(db, "learnerProfiles", uid, "confidenceHistory", today);
    const histSnap  = await getDoc(histRef);
    if (!histSnap.exists()) {
      await setDoc(histRef, { date: today, score: profile.confidenceScore ?? 50, timestamp: serverTimestamp() });
    }

    return { engagementScore: newEngagement, confidenceTrend: trend };
  } catch (err) {
    console.error("updateProfileAfterChat:", err);
    return null;
  }
}

// ── Refresh recommendations ───────────────────────────────────────────────────

export async function refreshRecommendations(uid, userProfile) {
  try {
    const learnerProfile  = await getLearnerProfile(uid);
    const recommendations = generateRecommendations(userProfile, learnerProfile);
    await updateDoc(doc(db, "learnerProfiles", uid), { recommendations, updatedAt: serverTimestamp() });
    return recommendations;
  } catch { return null; }
}

// ── Update a skill score ──────────────────────────────────────────────────────

export async function updateSkill(uid, skill, delta) {
  try {
    const ref   = doc(db, "learnerProfiles", uid);
    const snap  = await getDoc(ref);
    const prev  = snap.data()?.skills?.[skill] ?? 50;
    const next  = Math.max(0, Math.min(100, prev + delta));
    await updateDoc(ref, { [`skills.${skill}`]: next, updatedAt: serverTimestamp() });
    return next;
  } catch { return null; }
}
