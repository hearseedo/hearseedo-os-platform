// HSD OS — App Event Processor
// Receives learning events from individual apps (via postMessage or REST)
// and writes enriched data to Firestore learnerProfiles.

import { db } from "./firebase";
import {
  doc, getDoc, setDoc, updateDoc, collection, serverTimestamp,
} from "firebase/firestore";
import { computeConfidenceTrend } from "./confidenceEngine";

const SKILL_MAP = {
  eiken:      ["vocabulary", "reading", "listening", "speaking"],
  phonics:    ["pronunciation", "reading", "listening"],
  speak:      ["speaking", "grammar"],
  sipswitch:  ["listening", "speaking", "vocabulary"],
  wondercamp: ["vocabulary", "reading", "grammar"],
  family:     ["speaking", "listening", "vocabulary"],
  innerkey:   ["mindset", "speaking"],
};

// Called whenever an app sends HSD_OS_PROGRESS (via postMessage or REST)
export async function processAppEvent(uid, event) {
  if (!uid) return;

  const {
    module: appId = "unknown",
    lessonType  = "practice",
    xp          = 0,
    isCorrect   = true,
    score       = null,
  } = event;

  try {
    const profileRef = doc(db, "learnerProfiles", uid);
    const snap       = await getDoc(profileRef);

    if (!snap.exists()) return; // profile must be initialised first

    const profile            = snap.data();
    const totalInteractions  = (profile.totalInteractions ?? 0) + 1;
    const appUsage           = { ...(profile.appUsage ?? {}), [appId]: ((profile.appUsage?.[appId] ?? 0) + 1) };

    // Engagement delta based on correctness and XP
    const engagementDelta   = isCorrect ? Math.min(xp / 4, 15) : 5;
    const prevEngagement    = profile.engagementScore ?? 50;
    const newEngagement     = Math.round(prevEngagement * 0.85 + (prevEngagement + engagementDelta) * 0.15);

    // Skill updates — each relevant skill for this app nudges up on correct, down on wrong
    const skills = { ...(profile.skills ?? {}) };
    const relevantSkills = SKILL_MAP[appId] ?? ["vocabulary"];
    for (const skill of relevantSkills) {
      const prev  = skills[skill] ?? 50;
      const delta = isCorrect ? 2 : -1;
      skills[skill] = Math.max(0, Math.min(100, prev + delta));
    }

    // Confidence trend from recent history
    const histSnap = await getDoc(doc(db, "learnerProfiles", uid, "confidenceHistory",
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" })));
    const trend = computeConfidenceTrend(histSnap.exists() ? [histSnap.data()] : []);

    // Write interaction record (no raw content — privacy)
    await setDoc(doc(collection(db, "learnerProfiles", uid, "interactions")), {
      appId,
      lessonType,
      xp,
      isCorrect,
      score:          score ?? null,
      engagementScore: Math.round(prevEngagement + engagementDelta),
      confidenceImpact: isCorrect ? engagementDelta : -2,
      signals:        isCorrect ? ["lesson_correct"] : ["lesson_attempted"],
      timestamp:      serverTimestamp(),
    });

    // Update learner profile
    await updateDoc(profileRef, {
      totalInteractions,
      appUsage,
      engagementScore: newEngagement,
      confidenceTrend: trend,
      skills,
      updatedAt: serverTimestamp(),
    });

    // Daily confidence snapshot
    const today   = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
    const histRef = doc(db, "learnerProfiles", uid, "confidenceHistory", today);
    const todaySnap = await getDoc(histRef);
    if (!todaySnap.exists()) {
      await setDoc(histRef, {
        date:      today,
        score:     profile.confidenceScore ?? 50,
        timestamp: serverTimestamp(),
      });
    }

    return { ok: true, totalInteractions, newEngagement };
  } catch (err) {
    console.error("processAppEvent:", err);
    return null;
  }
}
