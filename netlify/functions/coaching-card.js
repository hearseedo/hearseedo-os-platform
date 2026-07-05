// Claude-powered daily coaching card
const MODEL = "claude-haiku-4-5-20251001";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function todayJST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, body: "Method not allowed" };

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Not configured" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const {
    uid, name,
    confidenceScore = 50,
    cefr           = null,
    streak         = 0,
    xpEarned       = 0,
    plan           = "free",
    topWeakness    = null,
  } = body;

  if (!uid) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };

  const dayName   = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Tokyo" });
  const cefrLabel = cefr || (confidenceScore < 30 ? "A1" : confidenceScore < 50 ? "A2" : confidenceScore < 70 ? "B1" : "B2+");

  const prompt = `You are an English learning coach inside HSD OS AI — built for Japanese learners.

Today is ${dayName}. Generate a short, personal daily coaching card in both English and Japanese.

Learner snapshot:
- Name: ${name || "learner"}
- Confidence: ${confidenceScore}%
- Level: ${cefrLabel}
- Streak: ${streak} days
- XP: ${xpEarned.toLocaleString()}
- Plan: ${plan}
${topWeakness ? `- Growth area: ${topWeakness}` : ""}

Return JSON with exactly these 8 keys — English and Japanese for each field:
{
  "focus":      "One micro-skill to practice today (max 8 words, English)",
  "focus_jp":   "同じ内容を日本語で（最大15文字）",
  "message":    "2 warm English sentences referencing their actual data. Celebrate streak if >3 days. Be a real coach, not a bot.",
  "message_jp": "同じメッセージを自然な日本語で2文。温かく、具体的に。",
  "challenge":  "One concrete action completable in under 2 minutes. Very specific. English.",
  "challenge_jp": "同じチャレンジを日本語で。具体的に。",
  "tip":        "One English insight matched to their exact level.",
  "tip_jp":     "同じヒントを日本語で。レベルに合わせて。"
}

Rules: address as 'you' in English, '你' is wrong — use warm Japanese tone (ですます調) for Japanese fields. Stay specific, never generic. If confidence < 40 be extra encouraging. If > 70 push harder. Return only the JSON object, no other text.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type":      "application/json",
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 800,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Claude coaching-card error:", err);
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Coaching unavailable" }) };
    }

    const data      = await res.json();
    const raw       = data.content?.[0]?.text ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("coaching-card: no JSON in response:", raw);
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Invalid coaching response" }) };
    }

    const card = JSON.parse(jsonMatch[0]);
    card.date  = todayJST();

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify(card),
    };
  } catch (err) {
    console.error("coaching-card:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Coaching service error" }) };
  }
};
