// Cloudflare Pages Function — AI chat proxy with in-memory rate limiting + response cache
// Replaces: netlify/functions/chat.js

const PLAN_LIMITS = {
  free: 5, individual: 5,
  phonics: 15, eiken: 15, sipswitch: 15, speak: 15, innerkey: 15,
  kids_starter: 30, english_boost: 30, adult_growth: 30, family_full: 30, adult_complete: 30,
  all_access: 100,
};

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function todayJST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

async function sha1(str) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("").slice(0,16);
}

async function verifyIdToken(idToken, firebaseKey) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.users?.[0] ?? null;
}

async function firestoreIncrement(projectId, apiKey, path, field) {
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents${path}:commit?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [{ transform: {
          document: `projects/${projectId}/databases/(default)/documents${path.replace(/:commit$/,"")}`,
          fieldTransforms: [{ fieldPath: field, increment: { integerValue: "1" } }],
        }}],
      }),
    }
  ).catch(() => {});
}

async function getUsageCount(projectId, apiKey, uid) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/chatUsage/${todayJST()}?key=${apiKey}`
  );
  if (!res.ok) return 0;
  const doc = await res.json();
  return parseInt(doc.fields?.count?.integerValue ?? "0", 10);
}

async function getCachedAI(projectId, apiKey, hash) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/aiCache/${hash}?key=${apiKey}`
  );
  if (!res.ok) return null;
  const doc = await res.json();
  const ttl = parseInt(doc.fields?.ttl?.integerValue ?? "0", 10);
  if (Date.now() > ttl) return null;
  return doc.fields?.response?.stringValue ?? null;
}

async function setCachedAI(projectId, apiKey, hash, response) {
  fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/aiCache/${hash}?updateMask.fieldPaths=response&updateMask.fieldPaths=ttl&key=${apiKey}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: {
        response: { stringValue: response },
        ttl:      { integerValue: String(Date.now() + 86400000) },
      }}),
    }
  ).catch(() => {});
}

// Signal analysis for Learner Intelligence Engine
function analyzeMessageSignals(message) {
  if (!message) return { score: 50, signals: [], delta: 0 };
  const text  = message.toLowerCase();
  const len   = message.trim().length;
  const signals = [];
  let delta = 0;

  if (len > 100)     { delta += 10; signals.push("detailed"); }
  else if (len > 40) { delta += 5;  signals.push("moderate"); }
  else if (len < 10) { delta -= 5;  signals.push("minimal"); }

  const questions = (message.match(/\?/g) || []).length;
  if (questions >= 2) { delta += 8; signals.push("high_curiosity"); }
  else if (questions) { delta += 4; signals.push("curious"); }

  const barriers = ["i can't", "i dont know", "i don't know", "too hard", "give up"];
  if (barriers.some(b => text.includes(b))) { delta -= 10; signals.push("confidence_barrier"); }

  const trying = ["let me try", "i think", "maybe", "perhaps", "could it be"];
  if (trying.some(p => text.includes(p))) { delta += 5; signals.push("attempting"); }

  const success = ["i understand", "i got it", "makes sense", "i see"];
  if (success.some(s => text.includes(s))) { delta += 8; signals.push("breakthrough"); }

  const challenge = ["harder", "more difficult", "challenge me", "next level"];
  if (challenge.some(c => text.includes(c))) { delta += 12; signals.push("challenge_accepted"); }

  return { score: Math.max(0, Math.min(100, 50 + delta)), signals, delta };
}

async function saveLearnerIntelligence(projectId, apiKey, uid, userMessage, appId) {
  try {
    const analysis = analyzeMessageSignals(userMessage);
    const today    = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });

    // Get current learner profile
    const profileRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/learnerProfiles/${uid}?key=${apiKey}`
    );
    let prevEngagement = 50;
    let totalInteractions = 0;
    let prevConfidence = 50;
    if (profileRes.ok) {
      const pDoc = await profileRes.json();
      if (pDoc.fields) {
        prevEngagement    = parseInt(pDoc.fields.engagementScore?.integerValue ?? "50", 10);
        totalInteractions = parseInt(pDoc.fields.totalInteractions?.integerValue ?? "0", 10);
        prevConfidence    = parseInt(pDoc.fields.confidenceScore?.integerValue ?? "50", 10);
      }
    }

    const newEngagement = Math.round(prevEngagement * 0.85 + analysis.score * 0.15);
    const newTotal      = totalInteractions + 1;
    const confDelta     = Math.round(analysis.delta * 0.3);
    const newConfidence = Math.max(0, Math.min(100, prevConfidence + confDelta));

    // Save interaction log (no raw message text — privacy)
    const interactionId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/learnerProfiles/${uid}/interactions/${interactionId}?key=${apiKey}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          appId:          { stringValue: appId || "dashboard" },
          messageLength:  { integerValue: String(userMessage.length) },
          signals:        { stringValue: analysis.signals.join(",") },
          engagementScore: { integerValue: String(analysis.score) },
          confidenceImpact: { integerValue: String(analysis.delta) },
          timestamp:      { stringValue: new Date().toISOString() },
        }}),
      }
    ).catch(() => {});

    // Update learner profile
    fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/learnerProfiles/${uid}?updateMask.fieldPaths=engagementScore&updateMask.fieldPaths=totalInteractions&updateMask.fieldPaths=confidenceScore&updateMask.fieldPaths=updatedAt&key=${apiKey}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          engagementScore:   { integerValue: String(newEngagement) },
          totalInteractions: { integerValue: String(newTotal) },
          confidenceScore:   { integerValue: String(newConfidence) },
          updatedAt:         { stringValue: new Date().toISOString() },
        }}),
      }
    ).catch(() => {});

    // Platform analytics: increment total AI interactions
    fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ writes: [{ transform: {
          document: `projects/${projectId}/databases/(default)/documents/analytics/platform`,
          fieldTransforms: [{ fieldPath: "totalAIMessages", increment: { integerValue: "1" } }],
        }}]}),
      }
    ).catch(() => {});

    // Daily confidence snapshot
    fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/learnerProfiles/${uid}/confidenceHistory/${today}?updateMask.fieldPaths=score&updateMask.fieldPaths=date&key=${apiKey}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          score: { integerValue: String(newConfidence) },
          date:  { stringValue: today },
        }}),
      }
    ).catch(() => {});

  } catch (err) { console.error("saveLearnerIntelligence:", err); }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const FIREBASE_KEY  = env.FIREBASE_API_KEY;
  const PROJECT_ID    = env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
  const GEMINI_KEY    = env.GEMINI_API_KEY;
  const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS }); }

  const { system, messages, idToken, plan = "free", appId = "dashboard" } = body;

  // ── Auth + rate limit ──────────────────────────────────────────────────
  let uid = null;
  if (idToken) {
    try {
      const user = await verifyIdToken(idToken, FIREBASE_KEY);
      if (user) {
        uid = user.localId;
        const limit = PLAN_LIMITS[plan] ?? 5;
        const count = await getUsageCount(PROJECT_ID, FIREBASE_KEY, uid);
        if (count >= limit) {
          return new Response(JSON.stringify({
            error: "daily_limit_reached", count, limit,
            message: plan === "all_access"
              ? "You've reached today's message limit. Resets at midnight Japan time."
              : `You've used all ${limit} messages for today. Upgrade for more conversations.`,
          }), { status: 429, headers: { ...CORS, "Content-Type": "application/json" } });
        }
      }
    } catch (e) { console.error("Auth error:", e); }
  }

  // ── AI cache check ─────────────────────────────────────────────────────
  const hash   = await sha1((system || "") + JSON.stringify((messages || []).slice(-2)));
  const cached = await getCachedAI(PROJECT_ID, FIREBASE_KEY, hash);
  if (cached) {
    if (uid) {
      firestoreIncrement(PROJECT_ID, FIREBASE_KEY, `/users/${uid}/chatUsage/${todayJST()}`, "count");
      const lastUserMsg = (messages || []).filter(m => m.role === "user").slice(-1)[0]?.content ?? "";
      saveLearnerIntelligence(PROJECT_ID, FIREBASE_KEY, uid, lastUserMsg, appId);
    }
    return new Response(JSON.stringify({ content: cached, cached: true }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── Gemini Flash (primary) → Claude fallback ──────────────────────────
  try {
    let text;

    if (GEMINI_KEY) {
      const systemPrompt = system || "You are Jarvis, the HSD OS AI English learning assistant.";
      const geminiMessages = (messages || []).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: geminiMessages,
            generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
          }),
        }
      );

      if (!geminiRes.ok) throw new Error(await geminiRes.text());
      const geminiData = await geminiRes.json();
      text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty Gemini response");

    } else {
      // Fallback to Claude if no Gemini key
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 512,
          system: system || "You are Jarvis, the HSD OS AI English learning assistant.",
          messages: messages || [],
        }),
      });
      if (!claudeRes.ok) throw new Error(await claudeRes.text());
      const claudeData = await claudeRes.json();
      text = claudeData.content[0].text;
    }

    if (uid) {
      firestoreIncrement(PROJECT_ID, FIREBASE_KEY, `/users/${uid}/chatUsage/${todayJST()}`, "count");
      const lastUserMsg = (messages || []).filter(m => m.role === "user").slice(-1)[0]?.content ?? "";
      saveLearnerIntelligence(PROJECT_ID, FIREBASE_KEY, uid, lastUserMsg, appId);
    }
    setCachedAI(PROJECT_ID, FIREBASE_KEY, hash, text);

    return new Response(JSON.stringify({ content: text }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI error:", err.message);
    return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
