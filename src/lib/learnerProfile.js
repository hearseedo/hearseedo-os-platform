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

// ── Profile initialization ────────────────────────────────────────────────
//
// Phase 3.4 (2026-09-12): initLearnerProfile(), formerly here, made an
// eager, UNCAUGHT client-side setDoc to learnerProfiles/{uid} on every
// sign-in (src/hooks/useAuth.jsx). firestore.rules has denied that write
// since Phase 0 (2026-09-09) — "server writes via /api/intelligence and
// /api/chat" was the stated intent, but no such server write ever existed,
// so this always threw an unhandled promise rejection (see
// docs/PHASE_3_3_DIAGNOSTICS.md). Removed outright rather than wrapped in a
// try/catch: profile creation is now on-demand and server-side, triggered
// by the first trusted engagement event (netlify/functions/
// record-engagement-event.js's plain Firestore `update` write has upsert
// semantics — it creates the document the first time an event arrives, no
// separate init call needed). getLearnerProfile() below already treats a
// not-yet-created profile as `null`, which every caller (Dashboard.jsx,
// generateRecommendations()) already handles.

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
