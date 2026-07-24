// EIKEN Monkey — Gemini-backed AI evaluation/conversation endpoint.
// Replaces netlify/functions/eiken-chat.js (Anthropic Claude, zero auth, zero
// rate limiting — a live abuse vector). Reuses the platform's existing shared
// daily message quota (users/{uid}/chatUsage/{today}, same PLAN_LIMITS as
// chat.js) so EIKEN draws from the same credit pool as the rest of the
// platform ("never duplicate credit tracking") rather than a parallel system.
//
// NOTE: chat.js reads/writes that same counter via bare REST + API key, which
// Firestore rejects (request.auth is null for API-key-only requests) — its
// quota check is a silent no-op in production today. This endpoint uses the
// JWT-signed service-account token from _firebaseAdmin.js instead, so
// EIKEN's quota actually works. Fixing chat.js itself is a separate,
// platform-wide follow-up.
//
// POST { idToken, taskType, system, messages, plan? }
// taskType is a label for logging/analytics only (e.g. "explain",
// "evaluate_answer", "conversation_reply", "interview_followup") — every
// taskType is evaluated the same way (single Gemini call), keeping this a
// thin, general-purpose endpoint rather than branching server-side logic.

const crypto = require("crypto");
const { firestoreFetch, verifyIdToken, incrementField, fromFirestoreFields } = require("./_firebaseAdmin");

const MODEL = "gemini-2.5-flash";

const PLAN_LIMITS = {
  free: 5, individual: 50, family: 100,
  phonics: 15, eiken: 15, sipswitch: 15, speak: 15, innerkey: 15, wondercamp: 15,
  kids_starter: 30, english_boost: 30, adult_growth: 30, adult_complete: 30,
  family_core: 30, family_plus: 60, family_premium: 100, all_access: 100,
};

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function todayJST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function ok(payload) {
  return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}
function fail(statusCode, error, extra = {}) {
  return { statusCode, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error, ...extra }) };
}

function hashMessages(system, messages) {
  const str = (system || "") + JSON.stringify((messages || []).slice(-2));
  return crypto.createHash("sha1").update(str).digest("hex").slice(0, 16);
}

// Gemini requires alternating user/model turns starting with "user".
function toGeminiContents(messages) {
  const contents = [];
  for (const m of messages || []) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const role = m.role === "assistant" ? "model" : "user";
    const text = typeof m.content === "string" ? m.content : "";
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += "\n" + text;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }
  if (contents.length > 0 && contents[0].role === "model") contents.shift();
  return contents;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST") return fail(405, "Method not allowed");

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return fail(400, "Invalid JSON"); }

  const { idToken, taskType = "unspecified", system, messages, plan = "free" } = body;
  if (!idToken) return fail(401, "Authentication required.");
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return fail(400, "messages array is required");
  }

  let uid;
  try {
    uid = await verifyIdToken(idToken);
  } catch (e) {
    console.error("eiken-evaluate auth error:", e.message);
    return fail(401, "Invalid session. Please sign in again.");
  }

  const usagePath = `/users/${uid}/chatUsage/${todayJST()}`;
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  let count = 0;
  try {
    const res = await firestoreFetch(usagePath);
    if (res.ok) {
      const doc = await res.json();
      count = fromFirestoreFields(doc.fields).count ?? 0;
    }
  } catch (e) {
    console.error("eiken-evaluate usage read error:", e.message);
  }

  if (count >= limit) {
    return fail(429, "daily_limit_reached", {
      count, limit,
      message: `You've used all ${limit} messages for today. Resets at midnight Japan time.`,
    });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return fail(503, "AI service not configured.");

  try {
    const geminiBody = {
      contents: toGeminiContents(messages),
      generationConfig: { temperature: 0.9, maxOutputTokens: 700 },
    };
    if (system) geminiBody.systemInstruction = { parts: [{ text: system }] };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(geminiBody) }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("eiken-evaluate Gemini error:", res.status, err);
      return fail(502, "AI service temporarily unavailable. Please try again.");
    }

    const data  = await res.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text  = (parts.find(p => !p.thought) ?? parts[0])?.text ?? "";

    if (!text) {
      console.error("eiken-evaluate: empty candidate", JSON.stringify(data));
      return fail(502, "Empty response from AI. Please try again.");
    }

    // Increment usage (fire-and-forget is fine here — we already checked the
    // limit above; a lost increment just means one extra call slips through
    // on rare failure, not an unbounded loophole).
    incrementField(usagePath, "count", 1).catch((e) => console.error("eiken-evaluate usage write error:", e.message));

    console.log("GEMINI_EIKEN_EVALUATE", JSON.stringify({
      taskType, uid, plan,
      inputTokens:  data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
    }));

    return ok({ content: text });
  } catch (err) {
    console.error("eiken-evaluate error:", err.message);
    return fail(500, "AI service temporarily unavailable. Please try again.");
  }
};
