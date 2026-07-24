// Monkeys Unlock — Gemini-backed AI Game Master (dialogue, hints, difficulty).
// Cloned from eiken-evaluate.js's proven auth/quota plumbing, kept as its own
// file (not shared code) per the decision to keep Monkeys Unlock fully
// separate from EIKEN/Monkey Party. Deliberately reuses the SAME shared daily
// quota counter (users/{uid}/chatUsage/{today}, same PLAN_LIMITS) that
// eiken-evaluate.js and chat.js already draw from — one AI-message budget per
// user across the whole platform, not a duplicated pool per app.
//
// POST { idToken, taskType, system, messages, plan? }
// taskType is a label for logging only (e.g. "npc_dialogue", "hint",
// "puzzle_feedback") — every taskType is evaluated the same way (single
// Gemini call), same "thin endpoint" philosophy as eiken-evaluate.js.

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
    console.error("monkeys-evaluate auth error:", e.message);
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
    console.error("monkeys-evaluate usage read error:", e.message);
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
      console.error("monkeys-evaluate Gemini error:", res.status, err);
      return fail(502, "AI service temporarily unavailable. Please try again.");
    }

    const data  = await res.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text  = (parts.find(p => !p.thought) ?? parts[0])?.text ?? "";

    if (!text) {
      console.error("monkeys-evaluate: empty candidate", JSON.stringify(data));
      return fail(502, "Empty response from AI. Please try again.");
    }

    // Increment usage (fire-and-forget — limit was already checked above; a
    // lost increment on rare failure just means one extra call slips through,
    // not an unbounded loophole).
    incrementField(usagePath, "count", 1).catch((e) => console.error("monkeys-evaluate usage write error:", e.message));

    console.log("GEMINI_MONKEYS_EVALUATE", JSON.stringify({
      taskType, uid, plan,
      inputTokens:  data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
    }));

    return ok({ content: text });
  } catch (err) {
    console.error("monkeys-evaluate error:", err.message);
    return fail(500, "AI service temporarily unavailable. Please try again.");
  }
};
