// HSD OS – Recommendation Engine
// Generates personalized recommendations from the unified learner profile.

import { APPS } from "../constants/apps";

const SKILL_TO_APP = {
  pronunciation: "phonics",
  vocabulary:    "eiken",
  speaking:      "speak",
  listening:     "sipswitch",
  mindset:       "innerkey",
  family:        "family",
  kids:          "wondercamp",
};

const CONFIDENCE_TOPICS = [
  "Tell me about a time you felt proud of yourself",
  "Describe your favorite place in Japan",
  "What is one goal you have for this week?",
  "Tell me about something you're good at",
];

const VOCABULARY_TOPICS = [
  "Let's practice 5 new words about daily life",
  "Can you use 'however' in a sentence?",
  "What's the difference between 'make' and 'do'?",
  "Let's practice business vocabulary together",
];

const GRAMMAR_TOPICS = [
  "Practice using past perfect tense with me",
  "Let's review when to use 'a' vs 'the'",
  "Can you explain what you did yesterday? (past simple practice)",
  "Let's practice conditional sentences: If I had more time...",
];

export function generateRecommendations(userProfile, learnerProfile) {
  const skills       = learnerProfile?.skills ?? {};
  const confidence   = learnerProfile?.confidenceScore ?? userProfile?.confidenceScore ?? 50;
  const plan         = userProfile?.plan ?? "free";
  const subscriptions = userProfile?.subscriptions ?? [];
  const weakest      = findWeakestSkill(skills);
  const trend        = learnerProfile?.confidenceTrend ?? "stable";

  return {
    lesson:    recommendLesson(confidence, weakest, trend),
    challenge: recommendChallenge(confidence, skills),
    app:       recommendApp(weakest, subscriptions),
    topic:     recommendTopic(confidence, weakest, learnerProfile?.favoriteTopics),
    activity:  recommendActivity(confidence, trend),
    generatedAt: new Date().toISOString(),
  };
}

function findWeakestSkill(skills) {
  const defaults = { vocabulary: 50, grammar: 50, pronunciation: 50, speaking: 50, listening: 50, mindset: 50 };
  const merged   = { ...defaults, ...skills };
  return Object.entries(merged).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "speaking";
}

function recommendLesson(confidence, weakest, trend) {
  if (confidence < 35) return "5-minute confidence warm-up: introduce yourself in 3 sentences";
  if (trend === "declining") return "Revisit a past success: describe something you achieved recently";
  const lessons = {
    pronunciation: "Practice the /r/ and /l/ sounds with 10 minimal pairs",
    vocabulary:    "Learn 5 new collocations for everyday conversations",
    grammar:       "Master one grammar pattern: practice 10 sentences",
    speaking:      "Record yourself speaking for 2 minutes on any topic",
    listening:     "Shadow a 1-minute native speaker clip 3 times",
    mindset:       "Write 3 sentences about a growth mindset moment",
  };
  return lessons[weakest] ?? "Have a free conversation about your day for 5 minutes";
}

function recommendChallenge(confidence, skills) {
  if (confidence < 30) return "Say one sentence in English out loud right now — any sentence";
  if (confidence < 50) return "Start today's conversation without looking anything up";
  if (confidence < 70) return "Teach Kai something you know — explain it in English";
  return "Have a full 10-minute English-only conversation with no Japanese";
}

function recommendApp(weakest, subscriptions) {
  const appId = SKILL_TO_APP[weakest];
  const app   = APPS.find(a => a.id === appId);
  if (app && subscriptions.includes(app.id)) return { appId: app.id, appName: app.name, reason: `Best for improving your ${weakest}` };
  const unlocked = APPS.filter(a => subscriptions.includes(a.id));
  if (unlocked.length > 0) return { appId: unlocked[0].id, appName: unlocked[0].name, reason: "Continue your active learning" };
  return { appId: "eiken", appName: "EIKEN AI Monkey", reason: "Great starting point for English improvement" };
}

function recommendTopic(confidence, weakest, favoriteTopics) {
  if (favoriteTopics?.length > 0) {
    const idx = Math.floor(Date.now() / 86400000) % favoriteTopics.length;
    return favoriteTopics[idx];
  }
  if (confidence < 40)     return pickRandom(CONFIDENCE_TOPICS);
  if (weakest === "vocabulary") return pickRandom(VOCABULARY_TOPICS);
  if (weakest === "grammar")    return pickRandom(GRAMMAR_TOPICS);
  return "Tell me about something interesting that happened to you recently";
}

function recommendActivity(confidence, trend) {
  if (trend === "rising")    return "Push yourself — try a topic outside your comfort zone";
  if (trend === "declining") return "Start small — one short conversation to rebuild momentum";
  if (confidence < 40)       return "Confidence builder: share one opinion about anything";
  if (confidence < 60)       return "Speaking practice: 3 sentences describing your week";
  return "Advanced challenge: debate a topic you feel strongly about";
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
