// HSD OS – Confidence Engine
// Computes a dynamic confidence score from learner signals.
// Score range: 0–100. Higher = more confident communicator.

export const CONFIDENCE_WEIGHTS = {
  consistency:  0.25, // streak-based daily practice
  frequency:    0.25, // total AI interactions
  persistence:  0.25, // lesson completion
  engagement:   0.25, // message quality signals
};

// Compute confidence score from user profile + learner profile
export function computeConfidenceScore(userProfile, learnerProfile) {
  const streak        = userProfile?.streak ?? 0;
  const lessons       = userProfile?.lessonsCompleted ?? 0;
  const interactions  = learnerProfile?.totalInteractions ?? 0;
  const engagementAvg = learnerProfile?.engagementScore ?? 50;

  const consistency  = Math.min(streak / 30, 1) * 100;
  const frequency    = Math.min(interactions / 200, 1) * 100;
  const persistence  = Math.min(lessons / 50, 1) * 100;
  const engagement   = engagementAvg;

  const score = (
    consistency  * CONFIDENCE_WEIGHTS.consistency +
    frequency    * CONFIDENCE_WEIGHTS.frequency +
    persistence  * CONFIDENCE_WEIGHTS.persistence +
    engagement   * CONFIDENCE_WEIGHTS.engagement
  );

  return {
    score: Math.round(score),
    components: {
      consistency:  Math.round(consistency),
      frequency:    Math.round(frequency),
      persistence:  Math.round(persistence),
      engagement:   Math.round(engagement),
    },
  };
}

// Analyze a single message for confidence signals (client or server)
export function analyzeMessage(message) {
  if (!message || typeof message !== "string") return { score: 50, signals: [] };

  const text     = message.toLowerCase();
  const length   = message.trim().length;
  const signals  = [];
  let delta      = 0;

  // Length signal — longer messages show more engagement
  if (length > 100)      { delta += 10; signals.push("detailed_response"); }
  else if (length > 40)  { delta += 5;  signals.push("moderate_response"); }
  else if (length < 10)  { delta -= 5;  signals.push("minimal_response"); }

  // Curiosity — questions indicate active engagement
  const questionCount = (message.match(/\?/g) || []).length;
  if (questionCount >= 2) { delta += 8; signals.push("high_curiosity"); }
  else if (questionCount === 1) { delta += 4; signals.push("curious"); }

  // Confidence barrier words
  const barriers = ["i can't", "i dont know", "i don't know", "too hard", "impossible", "give up", "no idea"];
  if (barriers.some(b => text.includes(b))) { delta -= 10; signals.push("confidence_barrier"); }

  // Persistence signals — trying despite difficulty
  const persistence = ["let me try", "i think", "maybe", "perhaps", "could it be", "is it"];
  if (persistence.some(p => text.includes(p))) { delta += 5; signals.push("attempting"); }

  // Success signals
  const success = ["i understand", "i got it", "makes sense", "thank you", "great", "i see", "oh i see"];
  if (success.some(s => text.includes(s))) { delta += 8; signals.push("breakthrough"); }

  // Challenge acceptance
  const challenge = ["harder", "more difficult", "challenge me", "next level", "what else"];
  if (challenge.some(c => text.includes(c))) { delta += 12; signals.push("challenge_accepted"); }

  // Clamp to 0–100 range
  const base  = 50;
  const score = Math.max(0, Math.min(100, base + delta));

  return { score, signals, delta };
}

// Determine trend from history array [{ score, date }]
export function computeConfidenceTrend(history) {
  if (!history || history.length < 2) return "stable";
  const sorted  = [...history].sort((a, b) => a.date > b.date ? 1 : -1);
  const recent  = sorted.slice(-1)[0]?.score ?? 50;
  const older   = sorted.slice(-8, -1).reduce((s, h) => s + h.score, 0) / Math.max(1, sorted.slice(-8, -1).length);
  if (recent > older + 3)  return "rising";
  if (recent < older - 3)  return "declining";
  return "stable";
}

// Confidence level label
export function confidenceLabel(score) {
  if (score >= 85) return "Breakthrough";
  if (score >= 70) return "Confident";
  if (score >= 55) return "Growing";
  if (score >= 40) return "Building";
  if (score >= 25) return "Starting";
  return "Beginning";
}

export function trendIcon(trend) {
  if (trend === "rising")   return "↑";
  if (trend === "declining") return "↓";
  return "→";
}
