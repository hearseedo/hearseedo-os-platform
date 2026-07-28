// Monkey Party — Gemini evaluation prompt builder.
// Calls the *existing* askJonathan()/eiken-evaluate.js pipeline with a new
// taskType label — no new AI service, no new endpoint. One call per round
// (per the spec's cost-control requirement), returning the full
// MonkeyPartyEvaluation JSON in a single response.
import { CONFIDENCE_FIRST_RULE } from "../feedback";

const LEVEL_EXPECTATIONS = {
  "Grade 5": "Basic vocabulary, simple present tense, short personal answers, 5-10 second answers.",
  "Grade 4": "Short sentences, basic past/future tense, simple reasons, 10-15 second answers.",
  "Grade 3": "Personal opinions, \"because\" statements, past experiences, short follow-up answers, 15-25 second answers.",
  "Pre-2":  "Reasons and examples, advice, comparisons, school/social topics, 20-30 second answers.",
  "Grade 2": "Structured opinions with two supporting points, broader social topics, 30-45 second answers.",
  "Pre-1":  "Abstract topics, cause and effect, advantages/disadvantages, stronger vocabulary, 45-60 second answers.",
  "Grade 1": "Complex social/global issues, nuanced arguments, counterpoints, evidence and examples, advanced vocabulary, ~60 second answers.",
};

const MODE_INSTRUCTIONS = {
  would_you_rather: (ctx) =>
    `Game: Would You Rather. The student chose between "${ctx.optionA}" and "${ctx.optionB}" and explained why, then may have answered one short follow-up. Judge whether they stated a choice and supported it appropriately for their level.`,
  category_rush: (ctx) =>
    `Game: Category Rush. Category: "${ctx.category}". The student named as many valid items as they could before time ran out. Their candidate answers: ${JSON.stringify(ctx.candidates)}. Identify which candidates are genuinely valid for this category (ignore near-duplicates/mispronunciation variants of the same item, reject irrelevant items), and count the valid total.`,
  answer_or_challenge: (ctx) =>
    ctx.challenge
      ? `Game: Answer or Challenge (Challenge chosen). The challenge rule was: "${ctx.challenge}". Question: "${ctx.prompt}". Check whether the student's answer both addresses the question AND satisfies the challenge rule — targetCompleted should reflect whether they met the challenge specifically.`
      : `Game: Answer or Challenge (standard Answer chosen). Question: "${ctx.prompt}". Evaluate as a standard EIKEN-style speaking answer for this level.`,
  beat_the_monkey: (ctx) =>
    `Game: Beat the Monkey. Question: "${ctx.prompt}". The monkey's basic answer was: "${ctx.monkeyAnswer}". The student must give a MEANINGFULLY BETTER answer — stronger reasons, more detail, a second reason, an example, better vocabulary, or clearer structure. Do NOT reward length alone. Set beatTheMonkey to true only if the improvement is genuine and appropriate for their level.`,
};

export function buildMonkeyPartyPrompt({ mode, level, topic, transcript, ...ctx }) {
  const levelGuidance = LEVEL_EXPECTATIONS[level] ?? LEVEL_EXPECTATIONS["Pre-2"];
  const modeGuidance = (MODE_INSTRUCTIONS[mode] ?? (() => ""))(ctx);

  const system = `You are Jonathan AI, hosting "Monkey Party" — a fast, fun speaking game for EIKEN confidence-building. ${CONFIDENCE_FIRST_RULE}

Student's EIKEN level: ${level}. Expected level: ${levelGuidance}
${modeGuidance}

Prioritize whether the student communicated successfully over perfect grammar. Do not overcorrect every error. Never rate an attempt with braveryScore below 1 — any genuine spoken attempt deserves bravery credit.

Respond ONLY as JSON, no markdown, matching exactly this shape:
{
  "relevant": true,
  "braveryScore": 0-3,
  "clarityScore": 0-3,
  "englishScore": 0-3,
  "powerScore": 0-3,
  "totalPoints": 0-12,
  "strengths": ["short phrase", "short phrase"],
  "improvementTip": "one short, specific, encouraging tip",
  "correctedVersion": "a natural corrected version of their sentence, or empty string",
  "followUpQuestion": "one short natural follow-up question, or empty string",
  "vocabularyUsed": ["word", "word"],
  "grammarUsed": ["grammar point", "grammar point"],
  "targetCompleted": true or false,
  "beatTheMonkey": true or false or null,
  "confidenceMessage": "one warm, short sentence — celebrate effort first, always"
}`;

  const userMessage = mode === "category_rush"
    ? `Please validate and count the candidate answers listed above.`
    : `Student said: "${transcript || "(no speech detected)"}"`;

  return { system, userMessage };
}
