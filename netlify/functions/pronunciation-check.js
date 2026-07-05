// HSD OS — Pronunciation Feedback via Gemini
// Analyses a spoken English transcript for common Japanese-speaker errors.

const MODEL = "gemini-2.5-flash";
const CORS  = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Gemini not configured" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const uid = body.uid || body.sso_token;
  if (!uid) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };

  const { transcript = "", targetPhrase = "" } = body;
  if (!transcript) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "No transcript" }) };

  const prompt = `You are a pronunciation coach specialising in Japanese learners of English. A student just spoke the following:

What they said: "${transcript}"
${targetPhrase ? `What they were trying to say: "${targetPhrase}"` : ""}

Analyse for the most common Japanese-speaker pronunciation challenges:
- R vs L confusion (e.g. "rice"/"lice", "right"/"light")
- TH sound (often replaced with s/z/d)
- V vs B confusion
- Final consonant deletion (e.g. "tes" for "test")
- Vowel length (Japanese has short/long vowels, English has different patterns)
- Word stress (Japanese is mora-timed, English is stress-timed)
- Schwa sound (often overpronounced)

Reply ONLY with valid JSON, no markdown:
{
  "overallScore": 72,
  "fluencyNote": "One sentence about overall fluency",
  "issues": [
    {
      "type": "R vs L",
      "example": "the specific word from their speech",
      "tip": "Short, clear tip to fix it — one sentence",
      "drill": "A 3-word drill to practise this sound"
    }
  ],
  "praise": "One specific thing they did well",
  "nextStep": "The single most important thing to practise next",
  "improvedPhrase": "Their phrase corrected and written phonetically if helpful"
}

Limit issues to the top 2 most important ones. Be warm, encouraging, specific.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4 } }),
      }
    );

    if (!res.ok) return { statusCode: res.status, headers: CORS, body: JSON.stringify({ error: "Gemini error" }) };

    const data   = await res.json();
    const text   = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const clean  = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    console.error("pronunciation-check error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Analysis failed" }) };
  }
};
