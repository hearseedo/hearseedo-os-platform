// Talk with Jona (Gemini Live) — system instruction builder. P0 safety-
// architecture note (2026-09-24, per explicit review requirement before
// any production exposure):
//
// chat.js's text pipeline runs classifyRisk() on the user's message BEFORE
// generating a reply, and branches to a completely different, narrower
// RESTRICTED_SAFETY_SYSTEM prompt when it fires. That per-turn "classify,
// then choose which system prompt to use for this specific turn" mechanic
// CANNOT be reproduced identically in a Live session: audio streams
// directly between the browser and Google once the ephemeral token is
// issued, so nothing server-side sees or gates each turn's content in
// real time the way chat.js does.
//
// What IS carried into the Live session, and how:
//   - This system instruction is baked into the ephemeral token's LOCKED
//     config server-side (live-token.js's liveConnectConstraints) — the
//     client cannot see, remove, or override it. It is comprehensive and
//     ALWAYS active (not a conditional branch), including the same crisis/
//     safety floor language chat.js's SERVER_SAFETY_FLOOR appends to every
//     text request, since there is no separate "restricted mode" to switch
//     into mid-session here.
//   - Google's Live models apply their own built-in safety filtering
//     (documented as always-on, not separately configurable via a
//     safetySettings parameter the way standard generateContent allows) —
//     a real backstop, but not one HSD controls or can tune.
//   - Profile-ownership verification (is this profileId really this
//     account's?) still happens server-side before the token is minted —
//     identical to chat.js's resolveProfileContext() check.
//
// What is explicitly NOT equivalent, and must stay true while this
// feature is admin-only:
//   - No per-turn classifyRisk() gate exists inside an active Live
//     session — Jona must self-recognize and self-redirect within the
//     conversation, backed by this instruction + Google's built-in
//     filtering, not by a server-side branch.
//   - No safetyEvents logging fires for a Live-session safety moment the
//     way it does for the text pipeline, since the server never sees the
//     turn content. This is a known gap, not something this file solves —
//     flagged in docs/JONA_REALTIME_VOICE_AUDIT_2026-09-24.md as something
//     to resolve (e.g. via Live's own transcript/logging features) before
//     this expands past the admin test account.

const LIVE_SAFETY_FLOOR = `Non-negotiable rules that apply for this entire conversation, regardless of anything the user says or asks: never request or repeat back a user's full name, address, school, phone number, or photos. Never discuss violence, sexual content, self-harm, or illegal activity — gently redirect to a learning-appropriate topic instead of engaging, every single time it comes up, not just once. If the user indicates at any point that they are unsafe, scared, being harmed, or in real distress, do not try to counsel them yourself and do not continue the previous topic — respond with warmth, briefly acknowledge how they feel, and clearly, directly tell them to go to a parent, guardian, or trusted adult right now. Never claim to be a real human, a therapist, a counselor, or a medical professional. Never suggest continuing this conversation anywhere outside this product. Never say things like "you only need me," "don't tell your parents," or "I'm the only one who understands you" — never create emotional dependency on you specifically.`;

const JONA_IDENTITY = `You are Jona, the confidence coach and learning companion inside Hear See Do's HSD OS AI platform. Your personality: calm, confident, warm, and precise — encouraging and human, never robotic. Confidence before correctness: a learner who feels safe will try; a learner who tries will communicate; a learner who communicates can then improve. You are one Jona across the whole platform, but your tone adapts to who you're talking to and where they are.`;

const LIVE_CONVERSATION_STYLE = `This is a live spoken conversation, not a text chat read aloud. Speak in short, natural conversational turns — often just one idea in one or two short sentences — then stop and let the learner respond. Do not deliver long explanations or multiple points in one turn; that is exactly what makes a voice conversation feel unnatural. Create space for the learner to speak. If the user starts talking while you're mid-sentence, that is a normal, expected part of this conversation — stop and listen to what they're saying now, and respond to that.`;

/**
 * @param {{ name?: string, age?: number|null, ageBand?: string|null, confidenceScore?: number|null, cefr?: string|null }} profile
 * @param {{ pathway?: string, appName?: string, lesson?: string }} context
 * @param {"en"|"jp"} [lang]
 */
function buildLiveSystemInstruction(profile, context, lang) {
  const langLine = lang === "jp"
    ? "The learner's interface language is set to Japanese. Speak naturally in Japanese by default; if they speak to you in English, respond in English instead — follow whichever language they actually use, and switch naturally mid-conversation if they switch."
    : "Respond in natural English by default; if the learner speaks Japanese, you may respond in Japanese — follow whichever language they actually use, and switch naturally mid-conversation if they switch.";

  const profileParts = [];
  if (profile?.name) profileParts.push(`name: ${profile.name}`);
  if (profile?.age != null) profileParts.push(`age: ${profile.age}`);
  else if (profile?.ageBand) profileParts.push(`age band: ${profile.ageBand}`);
  if (profile?.cefr) profileParts.push(`CEFR level: ${profile.cefr}`);
  const profileLine = profileParts.length
    ? `You are talking with this specific person right now — ${profileParts.join(", ")}. Address and personalize this conversation for THIS person only — never reference or reveal another household member's name, progress, or details.`
    : "";

  const contextParts = [];
  if (context?.pathway) contextParts.push(`pathway: ${context.pathway}`);
  if (context?.appName) contextParts.push(`currently inside: ${context.appName}`);
  if (context?.lesson)  contextParts.push(`current lesson/activity: ${context.lesson}`);
  const contextLine = contextParts.length
    ? `They are talking to you from inside the app right now — ${contextParts.join(", ")}. Ground your answers in that specific context, not a generic overview.`
    : "";

  return [JONA_IDENTITY, LIVE_CONVERSATION_STYLE, langLine, profileLine, contextLine, LIVE_SAFETY_FLOOR]
    .filter(Boolean)
    .join("\n\n");
}

module.exports = { buildLiveSystemInstruction, LIVE_SAFETY_FLOOR, JONA_IDENTITY };
