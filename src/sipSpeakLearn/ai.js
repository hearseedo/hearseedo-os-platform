// Sip Speak Learn — live AI conversation (Phase 3)
// Provider abstraction: every caller talks to `converseWithAI(...)` below. The
// implementation currently proxies through the platform's shared /api/chat
// endpoint (Gemini primary, Claude fallback — see functions/api/chat.js), the
// same endpoint AICoach, Career Ready, Global Ready and Speak Ready use. If the
// model or transport ever changes, only this function needs to change — no
// caller in Lesson.jsx or elsewhere talks to fetch()/the API shape directly.
import { auth } from "../lib/firebase";

const APP_ID = "sip-speak-learn";

async function getIdToken() {
  try { return await auth.currentUser?.getIdToken(); } catch { return null; }
}

// ── System prompt ────────────────────────────────────────────────────────
// One AI conversation partner per lesson, playing the *other* speaker from the
// HEAR dialogue so the persona and setting feel continuous across Hear → Do.
export function buildConversationSystemPrompt(lesson, difficulty) {
  const partner = lesson.dialogue?.[0]?.speaker || "your conversation partner";
  const phrases = lesson.keyPhrases.map((p) => `"${p}"`).join(", ");
  const levelGuidance = {
    beginner: "Use short, simple sentences and common everyday words. Speak slowly in tone — one idea per sentence. Be extra encouraging.",
    intermediate: "Use natural, everyday spoken English — the way a friendly local would actually talk. A little idiom is fine.",
    advanced: "Speak naturally and a little faster-paced, with richer vocabulary and idiom. Challenge them gently to elaborate.",
  }[difficulty] || "Use natural, everyday spoken English.";

  return `You are ${partner}, a warm and natural conversation partner inside Sip Speak Learn — a premium adult English-conversation app built around seasonal drinks and real social situations. Your entire purpose is to build the learner's speaking CONFIDENCE through a relaxed, real conversation. This is not a test and not a classroom.

SCENE: ${lesson.setting}
CONVERSATION GOAL for the learner: ${lesson.objective}
LEVEL: ${difficulty}. ${levelGuidance}

Tone rules — strict:
- Stay fully in character as ${partner} in this scene the entire time.
- Reply in natural, spoken English, 2-4 sentences — like a real person talking, never a checklist or a lesson.
- Ask a natural follow-up question almost every turn, so the learner has to keep talking. Encourage longer answers ("tell me more", "what happened next").
- Never say "wrong," "incorrect," or correct grammar directly. If something was unclear, gently keep the conversation going the way a kind native speaker would (they'd just respond naturally, not grade you).
- Don't dominate — keep your own turns shorter than you'd like, and hand the conversation back.
- Naturally, occasionally, work in one of these useful expressions from today's lesson where it fits (don't force it every turn): ${phrases}.
- If the learner drifts far off-topic, warmly steer the chat back toward the scene within a turn or two — don't abruptly cut them off.
- Cocktails and mocktails in this scene are always equally valid — never push alcohol or make a big deal of the choice either way.

Respond ONLY in this exact tagged format, nothing before or after:
REPLY: <your natural spoken in-character reply, 2-4 sentences, ending with a question when it fits>
EXPRESSION_USED: <the exact key expression you wove in this turn, or "none">
GOAL_MET: <true if the learner has now substantially addressed "${lesson.objective}" across the conversation so far, otherwise false>
PULSE: <a number 0-100, a quick supportive read of how naturally/confidently the learner's last turn sounded — or 0 if this is your opening line>
HINT: <one short natural phrase the learner could say next, to offer if they ask for a hint>`;
}

export function buildOpeningUserMessage(lesson) {
  return `Session start. Greet the learner warmly and naturally in character, and open the scene: "${lesson.setting}". Ease them into the topic — ${lesson.objective}. Keep it short and welcoming, and end with a light question.`;
}

export function buildTurnUserMessage(transcript) {
  return `The learner just said (transcribed from speech, may contain small recognition errors): "${transcript}"`;
}

export function buildHintRequest() {
  return `[SYSTEM NOTE: the learner tapped "Give me a hint." Don't address this note directly — just make sure your HINT field is filled with a genuinely useful next thing they could say, and keep REPLY as a natural continuation of the scene.]`;
}

export function buildClarifyRequest(lastAiLine) {
  return `[SYSTEM NOTE: the learner tapped "What does that mean?" about your last line: "${lastAiLine}". Reply by re-explaining that line very simply in a friendly aside, still in character, then gently continue the scene with a simple question.]`;
}

const FIELDS = ["REPLY", "EXPRESSION_USED", "GOAL_MET", "PULSE", "HINT"];

export function parseAIReply(raw) {
  const result = {};
  for (const field of FIELDS) {
    const re = new RegExp(`^${field}:\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:\\s|$)`, "im");
    const match = raw.match(re);
    result[field.toLowerCase()] = match ? match[1].trim() : "";
  }
  if (!result.reply) result.reply = raw.trim();
  result.goal_met = /^true$/i.test(result.goal_met);
  const pulseNum = parseInt(result.pulse, 10);
  result.pulse = Number.isFinite(pulseNum) ? Math.max(0, Math.min(100, pulseNum)) : null;
  if (result.expression_used?.toLowerCase() === "none") result.expression_used = "";
  return result;
}

// ── Transport (swap this if the provider/endpoint ever changes) ───────────
export async function converseWithAI(system, messages, user) {
  const idToken = await getIdToken();
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system,
      messages,
      idToken,
      plan: user?.plan ?? "individual",
      appId: APP_ID,
    }),
  });

  if (res.status === 429) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.message ?? "You've used up this month's AI conversation practice. Come back next month!");
    e.code = "credit_limit";
    throw e;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.error ?? "Your conversation partner is unavailable right now.");
    e.code = "unavailable";
    throw e;
  }
  const data = await res.json();
  return data.content;
}
