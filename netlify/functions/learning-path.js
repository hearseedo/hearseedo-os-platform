// Gemini-powered personalised learning path generator
// Uses: gemini-2.0-flash via Google AI Studio API
const MODEL = "gemini-2.5-flash-lite";

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

  const { level, goal, time, style, subscriptions = [], confidenceScore = 0, streak = 0 } = body;

  if (!level || !goal) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  const prompt = `You are an expert English learning coach. Create a personalised 4-week learning path for a student based on their profile.

Student Profile:
- Current level: ${level}
- Main goal: ${goal}
- Daily study time: ${time}
- Learning style: ${style}
- Apps available: ${subscriptions.length > 0 ? subscriptions.join(", ") : "phonics (starter)"}
- Confidence score: ${confidenceScore}%
- Current streak: ${streak} days

Available apps and what they do:
- phonics: Phonics & reading fundamentals (A1-A2)
- wondercamp: Story-based learning for families (A2-B1)
- eiken: Japanese Eiken exam preparation (A2-C1)
- speak: Conversational English speaking (B1-C1)
- sipswitch: Advanced English immersion (B2-C2)
- family: Family learning journeys (A1-B1)
- innerkey: English mindset & self-development (C1-C2)

Reply ONLY with valid JSON in this exact format, no markdown, no explanation:
{
  "cefr": "A1",
  "cefrName": "Beginner",
  "weeklyFocus": [
    "Week 1: one specific focus",
    "Week 2: one specific focus",
    "Week 3: one specific focus",
    "Week 4: one specific focus"
  ],
  "primaryApp": "appId",
  "secondaryApp": "appId or null",
  "dailyPlan": {
    "morning": "5-minute morning habit description",
    "main": "Core study session description",
    "evening": "Evening review habit description"
  },
  "tip": "One highly personalised tip based on their specific goal and level in 1-2 sentences",
  "milestone": "Specific, measurable thing they will be able to do after 4 weeks",
  "encouragement": "One motivational sentence tailored to their situation"
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
            temperature:     0.7,
            maxOutputTokens: 800,
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
    const cleaned  = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
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
    console.error("Learning path error:", err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Failed to generate learning path" }),
    };
  }
};
