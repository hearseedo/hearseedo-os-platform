// Gemini-powered personalised learning path generator
// Uses: gemini-2.0-flash via Google AI Studio API
const MODEL = "gemini-2.5-flash";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, body: "Method not allowed" };

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Gemini not configured" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { uid, level, goal, time, style, cefr, baselineScore, subscriptions = [], confidenceScore = 0, streak = 0, memberName, memberAge, isMember } = body;

  if (!uid) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };

  if (!level || !goal) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  const learnerLabel = isMember && memberName ? memberName : "this learner";
  const ageContext   = isMember && memberAge ? ` (age ${memberAge})` : "";

  const prompt = `You are the learning path intelligence inside Hear See Do OS AI.

Your purpose is not only to improve English ability. Your deeper purpose is to help each person become a confident, capable, self-directed learner — for life.

English is the starting point. Confidence is the operating system.

${isMember ? `IMPORTANT: This learning path is being created for a FAMILY MEMBER named ${learnerLabel}${ageContext}.
- Write ALL content (tip, milestone, encouragement, confidenceBoost, daily plan, weekly focus) DIRECTLY TO ${memberName ?? "the child"} using "you" language.
- Do NOT address a parent. Do NOT say "help your child", "encourage them", or any third-person phrasing about the learner.
- Use age-appropriate, warm, encouraging language suitable for ${memberAge ? `a ${memberAge}-year-old` : "a young learner"}.
- The tip and encouragement should speak directly to ${memberName ?? "the child"} as the learner.` : `Write all content directly to the learner using "you" language.`}

When building this learning path, also ask:
- What kind of learner is this person becoming?
- What gives this learner confidence?
- What might be blocking them from trying?
- What kind of support helps them take the next step?

The skills you are developing alongside English:
Confidence, Communication, Creativity, Critical thinking, Emotional awareness, Self-expression, Learning independence, Problem-solving, Motivation, Resilience, and Social confidence.

Learner Profile:
- Name: ${learnerLabel}${ageContext}
- Current level: ${cefr ? `${cefr} (verified by placement assessment)` : level}
- Baseline assessment score: ${baselineScore != null ? `${baselineScore}/100` : "not taken"}
- Main goal: ${goal}
- Daily study time: ${time}
- Learning style: ${style}
- Apps available: ${subscriptions.length > 0 ? subscriptions.join(", ") : "family (starter)"}
- Confidence score: ${confidenceScore}%
- Current streak: ${streak} days

Available apps and what they do:
- family: HSD Family — for parents, families, and children. Confidence, communication, English habits, parent-child routines. Best for families, parents unsure where to start, home learning, travel English. (A1-B1)
- phonics: Monkey Yoga Phonics — STRICTLY for children ages 3–12 only. Phonics, letter sounds, early reading, movement-based English for young learners. NEVER recommend to anyone over age 12, regardless of level. If the learner is a teen or adult, always choose a different app even at A1 level. (A1-A2 children only)
- eiken: EIKEN AI Coach — exam prep and speaking confidence for students targeting EIKEN. Vocabulary, grammar, reading, listening, speaking, interview practice. (A2-C1)
- wondercamp: Wondercamp — creative adventure learning for children. Storytelling, imagination, speaking, vocabulary, missions, curiosity. For children who like stories, games, and fun English. (A2-B1)
- speak: Sip & Switch — adult English conversation and social confidence. Real-world English, small talk, social speaking. For adults who want relaxed conversation practice. (B1-C1)
- sipswitch: Speak & Sweat — fitness and movement-based English for adults and teens. Combines physical activity, teamwork, and English. For active learners. (B2-C2)
- innerkey: Inner Key — confidence and personal growth for teens and adults. Mindset, self-awareness, reflection, emotional growth, communication. For users who feel stuck or want deeper growth. (B2-C2)

IMPORTANT: The goal is to create confident learners, not just improve English. Recommend the app that best matches the user's type, goal, confidence level, and learning style. Never default to phonics unless the need is clearly phonics or early literacy.

Reply ONLY with valid JSON in this exact format, no markdown, no explanation:
{
  "cefr": "A1",
  "cefrName": "Beginner",
  "weeklyFocus": [
    "Week 1: one specific focus — blend English skill with a confidence or life skill",
    "Week 2: one specific focus",
    "Week 3: one specific focus",
    "Week 4: one specific focus"
  ],
  "primaryApp": "appId",
  "secondaryApp": "appId or null",
  "dailyPlan": {
    "morning": "5-minute morning habit — focus on confidence activation, not just study",
    "main": "Core session — English skill + one of: creativity, expression, problem-solving, or reflection",
    "evening": "Evening habit — celebrate progress, not just review content"
  },
  "tip": "One deeply personalised tip that addresses both their English goal and what will help them grow as a confident learner",
  "milestone": "A specific, human thing they will be able to DO after 4 weeks — not just a test score",
  "encouragement": "One sentence that speaks to who they are becoming, not just what they are learning",
  "confidenceBoost": "One small action they can take today that will make them feel like a learner — before they even open an app"
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini error:", res.status, err);
      return { statusCode: res.status, headers: CORS, body: JSON.stringify({ error: "Gemini API error" }) };
    }

    const data     = await res.json();
    const text     = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    // Strip markdown code fences if model wraps JSON in them
    const cleaned  = text.trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    const parsed   = JSON.parse(cleaned);

    // Log for hackathon evidence — agent execution record
    console.log("GEMINI_LEARNING_PATH_GENERATED", JSON.stringify({
      timestamp:       new Date().toISOString(),
      model:           MODEL,
      inputTokens:     data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens:    data.usageMetadata?.candidatesTokenCount ?? 0,
      level, goal, time, style,
      cefrAssigned:    parsed.cefr,
      primaryApp:      parsed.primaryApp,
    }));

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ ...parsed, generatedBy: "gemini", model: MODEL, generatedAt: new Date().toISOString() }),
    };

  } catch (err) {
    console.error("Learning path error:", err.message, err.stack);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Failed to generate learning path" }),
    };
  }
};
