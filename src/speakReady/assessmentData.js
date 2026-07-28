// Speak Ready — Placement Assessment
// Reuses the exact same voice + Gemini pipeline as everything else in Speak
// Ready (speech-to-text transcript in, Gemini evaluation out) — no new
// technical surface, just a different one-time conversation flow.

export const MOTIVATIONS = [
  { id: "travel",       label: "Travel",             labelJp: "旅行" },
  { id: "business",     label: "Business",           labelJp: "ビジネス" },
  { id: "friends",      label: "Making friends",     labelJp: "友達作り" },
  { id: "study_abroad", label: "Study abroad",       labelJp: "留学" },
  { id: "work",         label: "Work",               labelJp: "仕事" },
  { id: "presentations",label: "Presentations",      labelJp: "プレゼンテーション" },
  { id: "dating",       label: "Dating",             labelJp: "デート" },
  { id: "moving",       label: "Moving overseas",    labelJp: "海外移住" },
  { id: "daily",        label: "Daily conversation", labelJp: "日常会話" },
];

export const ASSESSMENT_QUESTIONS = [
  { id: "intro",     prompt: "Tell me a little about yourself.",                                   promptJp: "少し自己紹介をしてください。" },
  { id: "day",       prompt: "What did you do yesterday?",                                          promptJp: "昨日は何をしましたか?" },
  { id: "opinion",   prompt: "What do you think is better — living in a big city or a small town? Why?", promptJp: "大都市と小さな町、どちらに住むのが良いと思いますか?その理由は?" },
  { id: "challenge", prompt: "Tell me about a time something didn't go as planned, and what you did.", promptJp: "計画通りにいかなかった経験と、その時どうしたかを教えてください。" },
  { id: "future",    prompt: "What are you hoping to do with your English in the future?",           promptJp: "将来、英語を使って何をしたいですか?" },
];

const LEVEL_NAMES = ["Starter", "Beginner", "Elementary", "Intermediate", "Upper Intermediate", "Advanced"];

export function buildAssessmentSystemPrompt(motivationLabel) {
  return `You are Speak Ready's placement coach — warm and encouraging, never clinical or exam-like. A student just had a short spoken conversation with you to find their starting point. Their goal for learning English is: "${motivationLabel}".

Evaluate their spoken answers across: speaking confidence, vocabulary range, grammar accuracy, fluency, sentence complexity, and overall comfort speaking. Be encouraging regardless of level — every level is a valid, respected starting point.

Respond ONLY in this exact tagged format, nothing before or after:
LEVEL: <one of exactly: Starter, Beginner, Elementary, Intermediate, Upper Intermediate, Advanced>
CONFIDENCE_SCORE: <a number 0-100>
SUMMARY_EN: <2-3 warm, specific sentences about how they did, referencing something real from their answers>
SUMMARY_JP: <Japanese translation of SUMMARY_EN>
STRENGTH: <one specific thing they did well>
FOCUS: <one specific, encouraging area to grow next>
RECOMMENDED_CATEGORY: <one of exactly: missions, quick_thinking, picture, debate, story_builder — whichever fits their goal and level best>`;
}

export function buildAssessmentUserMessage(qaPairs) {
  const transcript = qaPairs.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join("\n\n");
  return `Here is the full assessment conversation:\n\n${transcript}\n\nEvaluate now in the required tagged format.`;
}

const FIELDS = ["LEVEL", "CONFIDENCE_SCORE", "SUMMARY_EN", "SUMMARY_JP", "STRENGTH", "FOCUS", "RECOMMENDED_CATEGORY"];

export function parseAssessmentResult(raw) {
  const result = {};
  for (const field of FIELDS) {
    const re = new RegExp(`^${field}:\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:\\s|$)`, "im");
    const match = raw.match(re);
    result[field.toLowerCase()] = match ? match[1].trim() : "";
  }
  if (!LEVEL_NAMES.includes(result.level)) result.level = "Elementary";
  const scoreNum = parseInt(result.confidence_score, 10);
  result.confidence_score = Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, scoreNum)) : 50;
  const validCategories = ["missions", "quick_thinking", "picture", "debate", "story_builder"];
  if (!validCategories.includes(result.recommended_category)) result.recommended_category = "missions";
  return result;
}
