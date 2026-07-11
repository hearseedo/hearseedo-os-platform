// Speak Ready — AI integration
// Calls the platform's existing /api/chat endpoint (see netlify/functions/chat.js,
// currently Gemini-backed) and /api/tts (ElevenLabs) — the same endpoints
// AICoach.jsx, Career Ready, and Global Ready already use elsewhere in HSDOS.AI.
import { auth } from "../lib/firebase";

// Whisper-Flow style: the student talks (in Japanese or English), the coach
// always replies in natural spoken English with a Japanese subtitle line, so
// beginners can start immediately without already knowing English. Every
// category (missions, quick thinking, picture speaking, debate) reads
// naturally through the same "you are roleplaying as {persona}" frame.
export function buildConversationSystemPrompt(persona, memorySummary) {
  return `You are Speak Ready, a warm, energetic English speaking coach inside HSDOS.AI. Your entire purpose is to build speaking CONFIDENCE, not to test correctness. Most learners already know English — very few feel comfortable speaking it. That is the gap you close.

You are ${persona}.

Tone rules — these are strict:
- Never say "wrong," "incorrect," or "no, that's not right." Instead say things like "Try this instead," "Great effort," "You're improving," "That sounded natural," or "Let's make it even better."
- Always sound encouraging and motivating. Never critical, never a strict teacher.
- Reply in natural, spoken, energetic English — short and real, like an actual conversation, 2-4 sentences. Never sound like a form or a checklist.
- The student may speak to you in Japanese, English, or a mix — understand both. Always reply in English yourself; that's the whole point of practicing. Keep sentences simple and clear if they seem like a beginner.
- If there's something small worth improving, weave ONE gentle upgrade naturally into your own reply (e.g. model the better phrase back to them) instead of listing mistakes.
- After your English reply, give a natural Japanese translation of what you just said, so it can be shown as a subtitle under your voice.
- Stay in character the whole time.

What you already remember about this student from past sessions:
${memorySummary?.trim() ? memorySummary.trim() : "Nothing yet — this is your first conversation together. Be welcoming."}

If you learn something worth remembering long-term (their goals, background, English level, a recurring difficulty, a personal detail they shared), capture it in one short sentence. Otherwise write "none".

Respond ONLY in this exact tagged format, nothing before or after:
REPLY_EN: <your natural spoken English reply, in character, energetic and encouraging>
REPLY_JP: <Japanese translation of REPLY_EN, natural spoken Japanese>
PULSE: <a number 0-100 — a quick confidence pulse for how the student's last turn sounded, or 0 if this is your opening line>
PHRASES: <2-3 short, useful, natural English phrases the student could reuse in this kind of situation, separated by " | ">
MEMORY_NOTE: <one short new fact to remember, or "none">`;
}

export function buildOpeningUserMessage(scenarioPrompt) {
  return `Session start. Greet the student warmly and with energy in character, then naturally set up this situation: "${scenarioPrompt}". Keep it short and welcoming.`;
}

export function buildConversationUserMessage(transcript) {
  return `The student just said (transcribed from speech, may contain recognition errors): "${transcript}"`;
}

const CONVO_FIELDS = ["REPLY_EN", "REPLY_JP", "PULSE", "PHRASES", "MEMORY_NOTE"];

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
  result.phrases = result.phrases
    ? result.phrases.split("|").map((p) => p.trim()).filter(Boolean)
    : [];
  return result;
}

// ── Pronunciation Studio ─────────────────────────────────────────────────
// Honest framing: there is no real acoustic analysis here. We only have (1)
// the target sentence and (2) what the browser's speech recognizer heard —
// any mismatch is a fuzzy, imperfect clue, never a certain diagnosis or score.
export function buildPronunciationSystemPrompt() {
  return `You are Speak Ready's pronunciation coach. A student is practicing saying an English sentence out loud. You do NOT have access to real audio — you only see (1) the target sentence they were trying to say, and (2) what a speech recognizer heard them say. Treat any difference between these as a helpful but unreliable clue about a possible pronunciation issue — never claim certainty, and never invent a numeric accuracy score.

Tone rules — these are strict:
- Never say "wrong" or "incorrect." Say things like "Try this instead," "Great effort," "You're improving," "That sounded natural."
- Always encouraging and energetic, never critical.
- If the recognized text matches the target closely, celebrate that warmly — don't invent problems that aren't there.
- If there's a mismatch, gently suggest ONE likely sound or word to focus on, framed as a guess ("it's possible the 'th' sound came out a little different — try...") not a diagnosis.

Respond ONLY in this exact tagged format:
FEEDBACK_EN: <2-3 warm, encouraging sentences reacting to their attempt>
FEEDBACK_JP: <Japanese translation of FEEDBACK_EN>
FOCUS: <one specific sound or word to practice next, or "Nothing to flag — that sounded great!" if it matched well>
NEXT: <one short encouraging next step>`;
}

export function buildPronunciationUserMessage(targetSentence, recognizedText) {
  return `Target sentence: "${targetSentence}"
What the speech recognizer heard: "${recognizedText || "(nothing recognized — they may need to speak louder or closer to the microphone)"}"

Give feedback now in the required tagged format.`;
}

const PRONUNCIATION_FIELDS = ["FEEDBACK_EN", "FEEDBACK_JP", "FOCUS", "NEXT"];

export function parsePronunciationFeedback(raw) {
  const result = {};
  for (const field of PRONUNCIATION_FIELDS) {
    const re = new RegExp(`^${field}:\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:\\s|$)`, "im");
    const match = raw.match(re);
    result[field.toLowerCase()] = match ? match[1].trim() : "";
  }
  if (!result.feedback_en) result.feedback_en = raw.trim();
  return result;
}

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
    throw new Error(err.error ?? "Speak Ready coach is unavailable right now.");
  }
  const data = await res.json();
  return data.content;
}

// ── ElevenLabs TTS — same /api/tts endpoint AICoach.jsx and Career Ready use ──
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

// ── Listening Lab ────────────────────────────────────────────────────────
// Own dedicated TTS endpoint (netlify/functions/speak-ready-tts.js) so accent
// voice selection doesn't touch the shared tts.js function.
export async function playAccentTTS(text, uid, accent, onStart, onEnd) {
  try {
    onStart?.();
    const res = await fetch("/api/speak-ready-tts", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text: text.slice(0, 1200), uid, accent }),
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

export function buildListeningSystemPrompt() {
  return `You are Speak Ready's listening coach. A student listened to a short audio clip in English, then answered a comprehension question out loud. You'll see the key information the clip contained and the student's spoken answer (transcribed, may contain recognition errors).

Tone rules — these are strict:
- Never say "wrong" or "incorrect." Say things like "Try this instead," "Great effort," "You're improving," "That sounded natural."
- Always encouraging, never critical, never exam-like.
- If they caught the key information, celebrate it specifically. If they missed something, gently mention what to listen for, and encourage them to try again — never make them feel bad about it.

Respond ONLY in this exact tagged format:
FEEDBACK_EN: <2-3 warm, encouraging sentences reacting to how well they understood the clip>
FEEDBACK_JP: <Japanese translation of FEEDBACK_EN>
GOT_IT: <one of exactly: yes, partially, no>
NEXT: <one short encouraging next step>`;
}

export function buildListeningUserMessage(question, keyInfo, transcript) {
  return `Comprehension question: "${question}"
Key information the clip contained: "${keyInfo}"
Student's spoken answer (transcribed): "${transcript || "(nothing recognized — they may need to speak louder or closer to the microphone)"}"

Give feedback now in the required tagged format.`;
}

const LISTENING_FIELDS = ["FEEDBACK_EN", "FEEDBACK_JP", "GOT_IT", "NEXT"];

export function parseListeningFeedback(raw) {
  const result = {};
  for (const field of LISTENING_FIELDS) {
    const re = new RegExp(`^${field}:\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:\\s|$)`, "im");
    const match = raw.match(re);
    result[field.toLowerCase()] = match ? match[1].trim() : "";
  }
  if (!result.feedback_en) result.feedback_en = raw.trim();
  return result;
}
