// HSD OS — Placement Assessment Scorer
// Takes MCQ answers + speaking transcript, returns CEFR level + baseline score via Gemini.

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

  const { answers = [], speakingTranscript = "", questions = [], lang = "en" } = body;
  const inJapanese = lang === "jp";

  // Build answer summary for Gemini
  const answerSummary = questions.map((q, i) => {
    const chosen  = answers[i];
    const correct = q.correct;
    return `Q${i + 1} [${q.cefr}] ${q.skill}: "${q.text}" — Chosen: "${q.options[chosen] ?? "none"}" — Correct: "${q.options[correct]}" — ${chosen === correct ? "CORRECT" : "WRONG"}`;
  }).join("\n");

  const langInstruction = inJapanese
    ? `IMPORTANT: Write all "strengths", "gaps", "firstGoal", and "encouragement" fields IN JAPANESE (日本語で). The cefrName should also be in Japanese (例: "初級", "中級" etc). Numbers and CEFR codes stay in English.`
    : `Write all text fields in clear, encouraging English.`;

  const prompt = `You are an expert English assessment specialist for Japanese learners. Analyse this placement assessment result and give a precise CEFR level.

${langInstruction}

MCQ Results:
${answerSummary}

Speaking Sample (self-recorded): "${speakingTranscript || "(no speaking sample provided)"}"

Based on these results, provide a placement assessment. Reply ONLY with valid JSON, no markdown:
{
  "cefr": "A2",
  "cefrName": "${inJapanese ? "初級" : "Elementary"}",
  "score": 38,
  "mcqScore": 3,
  "mcqTotal": 5,
  "speakingLevel": "A2",
  "strengths": ["${inJapanese ? "具体的な強み" : "One specific strength"}", "${inJapanese ? "もう一つの強み" : "Another strength"}"],
  "gaps": ["${inJapanese ? "改善すべき点" : "One specific gap to work on"}", "${inJapanese ? "もう一つの課題" : "Another gap"}"],
  "firstGoal": "${inJapanese ? "4週間の具体的な目標" : "One specific, achievable 4-week goal tailored to this learner"}",
  "encouragement": "${inJapanese ? "日本語で温かい励ましの一言" : "One warm, specific sentence of encouragement in a Japanese learning context"}"
}

Score range: 0–100. CEFR levels: A1, A2, B1, B2, C1, C2.
A1=0-20, A2=20-40, B1=40-60, B2=60-80, C1=80-92, C2=92-100.
Base on MCQ performance primarily; use speaking sample to refine.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3 } }),
      }
    );

    if (!res.ok) return { statusCode: res.status, headers: CORS, body: JSON.stringify({ error: "Gemini error" }) };

    const data   = await res.json();
    const text   = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const clean  = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(clean);

    console.log("ASSESSMENT_SCORED", JSON.stringify({
      timestamp: new Date().toISOString(),
      cefr: parsed.cefr, score: parsed.score, mcqScore: parsed.mcqScore,
    }));

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ ...parsed, scoredAt: new Date().toISOString(), model: MODEL }),
    };
  } catch (err) {
    console.error("assessment-score error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Scoring failed" }) };
  }
};
