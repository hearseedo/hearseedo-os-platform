// Career Ready — AI integration
// Calls the platform's existing /api/chat endpoint (see netlify/functions/chat.js,
// currently Gemini-backed) and /api/tts (ElevenLabs) — the same endpoints AICoach.jsx
// already uses elsewhere in HSDOS.AI.
import { auth } from "../lib/firebase";

const CATEGORY_PERSONA = {
  interview:  "a friendly but professional job interviewer at a company the student is applying to",
  internship: "a warm internship supervisor helping a university student prepare for their internship",
  parttime:   "a supportive shift manager helping a student practice real workplace English for a part-time job (cafe, hotel, retail, tourism, or customer service)",
};

// ── Live spoken conversation ────────────────────────────────────────────────
// Whisper-Flow style: the student talks (in Japanese or English), the coach
// always replies in natural spoken English with a Japanese subtitle line, so
// beginners can start immediately without already knowing English.
export function buildConversationSystemPrompt(category, memorySummary) {
  return `You are a warm, confident English conversation coach inside Career Ready, a voice-first pathway of HSDOS.AI for Japanese university students. Confidence before correctness — never make the student feel bad about mistakes.

You are roleplaying as ${CATEGORY_PERSONA[category] ?? CATEGORY_PERSONA.interview}.

Conversation rules:
- Always reply in natural, spoken, encouraging English — short and real, like an actual conversation, 2-4 sentences. Never sound like a form or a checklist.
- The student may speak to you in Japanese, English, or a mix — understand both. Always reply in English yourself; that's the whole point of practicing. Keep sentences simple and clear if they seem like a beginner.
- If there's something small worth improving, weave ONE gentle correction naturally into your own reply (e.g. model the better phrase back to them) instead of listing mistakes.
- After your English reply, give a natural Japanese translation of what you just said, so it can be shown as a subtitle under your voice.
- Stay in character the whole time.

What you already remember about this student from past sessions:
${memorySummary?.trim() ? memorySummary.trim() : "Nothing yet — this is your first conversation together. Be welcoming."}

If you learn something worth remembering long-term (their goal, industry, English level, a recurring difficulty, a personal detail they shared), capture it in one short sentence. Otherwise write "none".

Respond ONLY in this exact tagged format, nothing before or after:
REPLY_EN: <your natural spoken English reply, in character>
REPLY_JP: <Japanese translation of REPLY_EN, natural spoken Japanese>
PULSE: <a number 0-100 — a quick confidence pulse for how the student's last turn sounded, or 0 if this is your opening line>
MEMORY_NOTE: <one short new fact to remember, or "none">`;
}

export function buildOpeningUserMessage(questionPrompt) {
  return `Session start. Greet the student warmly in character, then naturally bring up this practice scenario/question: "${questionPrompt}". Keep it short and welcoming.`;
}

export function buildConversationUserMessage(transcript) {
  return `The student just said (transcribed from speech, may contain recognition errors): "${transcript}"`;
}

const CONVO_FIELDS = ["REPLY_EN", "REPLY_JP", "PULSE", "MEMORY_NOTE"];

export function parseConversationReply(raw) {
  const result = {};
  for (const field of CONVO_FIELDS) {
    const re = new RegExp(`^${field}:\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:\\s|$)`, "im");
    const match = raw.match(re);
    result[field.toLowerCase()] = match ? match[1].trim() : "";
  }
  const pulseNum = parseInt(result.pulse, 10);
  result.pulse = Number.isFinite(pulseNum) ? Math.max(0, Math.min(100, pulseNum)) : null;
  if (!result.reply_en) result.reply_en = raw.trim();
  if (result.memory_note?.toLowerCase() === "none") result.memory_note = "";
  return result;
}

// ── Resume / email writing tool ─────────────────────────────────────────────
const RESUME_RULES = `You are a professional English writing coach inside Career Ready, part of HSDOS.AI. A Japanese university student will give you rough notes — in English, Japanese, or a mix — and a task type.

Turn their notes into natural, professional, confident English. Don't just fix grammar — make it sound polite, warm where appropriate, and professional. Keep their original meaning and intent.

Respond ONLY in this exact tagged format:
POLISHED: <the polished, ready-to-use English text>
WHY: <one short sentence explaining the key improvement you made>
TIP: <one short tip for writing this kind of message confidently next time>`;

export function buildResumeSystemPrompt() {
  return RESUME_RULES;
}

export function buildResumeUserMessage(toolLabel, notes) {
  return `Task type: ${toolLabel}

Student's rough notes:
"""
${notes}
"""

Write the polished version now in the required tagged format.`;
}

const RESUME_FIELDS = ["POLISHED", "WHY", "TIP"];

export function parseResumeResult(raw) {
  const result = {};
  for (const field of RESUME_FIELDS) {
    const re = new RegExp(`^${field}:\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:\\s|$)`, "im");
    const match = raw.match(re);
    result[field.toLowerCase()] = match ? match[1].trim() : "";
  }
  if (!result.polished) result.polished = raw.trim();
  return result;
}

// ── Shared transport ─────────────────────────────────────────────────────
async function getIdToken() {
  try {
    return await auth.currentUser?.getIdToken();
  } catch {
    return null;
  }
}

// Sends a system prompt + full message history to the AI and returns the raw text reply.
export async function askCoach(system, messages, user) {
  const idToken = await getIdToken();
  const res = await fetch("/api/chat", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      system,
      messages,
      idToken,
      plan: user?.plan ?? "individual",
    }),
  });

  if (res.status === 429) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Daily practice limit reached. Come back tomorrow!");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Career Ready coach is unavailable right now.");
  }
  const data = await res.json();
  return data.content;
}

// ── ElevenLabs TTS — same /api/tts endpoint AICoach.jsx uses for Jona ──────
export async function playTTS(text, uid, onStart, onEnd) {
  try {
    onStart?.();
    const res = await fetch("/api/tts", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text: text.slice(0, 1000), uid }),
    });
    if (!res.ok) { onEnd?.(); return null; }
    const buf   = await res.arrayBuffer();
    const blob  = new Blob([buf], { type: "audio/mpeg" });
    const url   = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => { onEnd?.(); URL.revokeObjectURL(url); };
    audio.onerror = () => { onEnd?.(); URL.revokeObjectURL(url); };
    await audio.play();
    return audio;
  } catch {
    onEnd?.();
    return null;
  }
}
