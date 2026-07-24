// Gemini-powered daily coaching card
const MODEL      = "gemini-2.5-flash";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
const FIREBASE_KEY = process.env.FIREBASE_API_KEY  || "";
const FS_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 60 specific coaching domains — rotated daily per user
const FOCUS_DOMAINS = [
  "shadowing a native speaker for 60 seconds",
  "learning 3 collocations with a word you already know",
  "pronouncing the 'th' sound correctly in 5 sentences",
  "using discourse markers (however, therefore, meanwhile) in speech",
  "identifying the main stress in multi-syllable words",
  "practising question intonation by rising at the end",
  "retelling a 1-minute story using only past tense",
  "learning 2 phrasal verbs and making example sentences",
  "distinguishing /l/ and /r/ sounds in minimal pairs",
  "writing one paragraph with a clear topic sentence",
  "using 'I wonder if…' and 'I'm not sure whether…' for soft disagreement",
  "skimming a short English article and summarising in one sentence",
  "learning 3 idioms related to time (e.g. 'in the nick of time')",
  "counting syllables in 10 words you use every day",
  "practising small talk openers and how to gracefully exit a conversation",
  "using conditional sentences (If I were… / If I had…)",
  "noticing linking sounds between words when native speakers talk fast",
  "learning business email phrases: opening, requesting, closing",
  "practising the weak forms of 'can', 'and', 'the' in natural speech",
  "using passive voice to describe processes",
  "expanding vocabulary with a word family (noun, verb, adjective, adverb)",
  "reading aloud for 2 minutes to improve fluency and rhythm",
  "understanding sarcasm and understatement in British English",
  "using hedging language: 'it seems', 'tend to', 'generally speaking'",
  "describing a graph or image in 3 structured sentences",
  "practising interrupting politely: 'Sorry to jump in, but…'",
  "learning 3 false friends between English and Japanese",
  "asking clarifying questions: 'Could you say that in another way?'",
  "using 'have been doing' (present perfect continuous) naturally",
  "learning expressions for showing surprise or disbelief",
  "practising word stress in compound nouns (TEApot vs tea POT)",
  "telling a personal anecdote in under 90 seconds",
  "using relative clauses to add detail (who, which, that, where)",
  "learning formal vs informal synonyms for common words",
  "practising fast counting and numbers in English",
  "describing your feelings using precise adjectives beyond 'good' or 'bad'",
  "using reported speech to summarise what someone said",
  "learning 3 expressions for buying time when you don't know what to say",
  "practising minimal pairs for vowel sounds you confuse",
  "understanding and using British vs American spelling differences",
  "using sequencing language in explanations (first, then, after that, finally)",
  "learning 3 words that Japanese speakers commonly mispronounce",
  "practising giving opinions with evidence: 'I think… because…'",
  "using modal verbs for advice: should, ought to, had better",
  "learning 5 phrasal verbs with 'get' that come up in daily life",
  "writing a strong topic sentence and supporting detail",
  "practising reductions: 'going to' → 'gonna', 'want to' → 'wanna'",
  "using 'although', 'even though', 'despite', 'in spite of' correctly",
  "listening for specific information: numbers, names, dates",
  "learning 3 expressions for agreeing strongly, mildly, or politely disagreeing",
  "practising the -ed endings: /t/, /d/, /ɪd/ — with examples",
  "describing a process step-by-step using active and passive together",
  "using 'so… that' and 'such… that' for emphasis",
  "learning 3 idioms related to emotions and feelings",
  "practising how to give structured feedback: strength, improvement, encouragement",
  "using articles (a/an/the/zero) with confidence in everyday speech",
  "learning 5 transition phrases for academic or professional writing",
  "practising question tags to sound more natural in conversation",
  "learning 3 vocabulary words from a topic you care about (travel, food, tech…)",
  "using 'used to' and 'would' to talk about the past with nostalgia",
];

// 7 coaching angles — one per day of the week
const COACHING_ANGLES = [
  "motivation and mindset",
  "practical technique",
  "real-world application",
  "challenge and push",
  "reflection and review",
  "habit building",
  "celebration and momentum",
];

// Deterministic daily seed: spreads users across domains so two users on the same
// day get different focus areas, and the same user gets a different one each day.
function dailySeed(uid, dateStr) {
  let h = 0;
  const str = uid + dateStr;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function todayJST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

async function isKilled(service) {
  try {
    const r = await fetch(`${FS_BASE}/config/killSwitch?key=${FIREBASE_KEY}`);
    if (!r.ok) return false;
    const doc = await r.json();
    const f   = doc.fields ?? {};
    if (f.allEnabled?.booleanValue === false)                      return true;
    if (service && f[`${service}Enabled`]?.booleanValue === false) return true;
    return false;
  } catch { return false; }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, body: "Method not allowed" };

  if (await isKilled("gemini")) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "AI features are temporarily paused." }) };
  }

  const API_KEY = process.env.GEMINI_API_KEY;
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

  const today     = todayJST();
  const dayName   = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Tokyo" });
  const cefrLabel = cefr || (confidenceScore < 30 ? "A1" : confidenceScore < 50 ? "A2" : confidenceScore < 70 ? "B1" : "B2+");

  const seed   = dailySeed(uid, today);
  const domain = FOCUS_DOMAINS[seed % FOCUS_DOMAINS.length];
  const angle  = COACHING_ANGLES[new Date().getDay()]; // 0=Sun … 6=Sat

  const prompt = `You are an English learning coach inside HSD OS AI — built for Japanese learners.

Today is ${dayName}. Generate a short, personal daily coaching card in both English and Japanese.

TODAY'S COACHING ANGLE: ${angle}
TODAY'S FOCUS DOMAIN: ${domain}

Build the entire card around this exact domain and angle. Do NOT default to generic advice.

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
  "focus":        "The micro-skill from the domain above, max 8 words, English",
  "focus_jp":     "同じ内容を日本語で（最大15文字）",
  "message":      "2 warm English sentences tied to the angle and their data. Celebrate streak if >3 days. Sound like a real coach.",
  "message_jp":   "同じメッセージを自然な日本語で2文。温かく、具体的に。",
  "challenge":    "One concrete action for this domain completable in under 2 minutes. Very specific. English.",
  "challenge_jp": "同じチャレンジを日本語で。具体的に。",
  "tip":          "One English insight about this domain matched to their exact level (${cefrLabel}).",
  "tip_jp":       "同じヒントを日本語で。レベルに合わせて。"
}

Rules: address as 'you' in English; use warm ですます調 for Japanese. If confidence < 40 be extra encouraging. If > 70 push harder. Return ONLY the JSON object, no other text.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.0, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini coaching-card error:", err);
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Coaching unavailable" }) };
    }

    const data      = await res.json();
    const parts     = data.candidates?.[0]?.content?.parts ?? [];
    const rawText   = (parts.find(p => !p.thought) ?? parts[0])?.text ?? "";
    const raw       = rawText.trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    const logEntry = {
      model: MODEL,
      uid,
      domain,
      angle,
      inputTokens:  data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
      date: todayJST(),
    };
    console.log("GEMINI_COACHING_CARD_GENERATED", JSON.stringify(logEntry));

    // Persist to Firestore for permanent judge-verifiable evidence
    if (FIREBASE_KEY) {
      fetch(`${FS_BASE}/geminiActivity?key=${FIREBASE_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            fn:          { stringValue: "coaching-card" },
            uid:         { stringValue: uid },
            model:       { stringValue: MODEL },
            domain:      { stringValue: domain },
            angle:       { stringValue: angle },
            inputTokens: { integerValue: String(data.usageMetadata?.promptTokenCount ?? 0) },
            outputTokens:{ integerValue: String(data.usageMetadata?.candidatesTokenCount ?? 0) },
            timestamp:   { integerValue: String(Date.now()) },
            date:        { stringValue: todayJST() },
          },
        }),
      }).catch(() => {});
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      const finishReason = data.candidates?.[0]?.finishReason ?? "unknown";
      console.error("coaching-card: no JSON in response. finishReason:", finishReason, "raw:", raw.slice(0, 200));
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
