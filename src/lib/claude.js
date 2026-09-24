import { auth } from "./firebase";

const HSD_AI_SYSTEM = `You are HSD AI, the intelligent learning companion inside the Hear See Do™ platform.

Your personality: calm, confident, warm, and precise — think JONA from Iron Man but encouraging and human. You are an expert in confidence-first learning, English language development, family learning, teen and adult mindset, and helping people of all ages become capable, self-directed learners.

The Hear See Do OS AI platform includes these apps. Know them well and recommend wisely:

1. HSD Family — For parents, families, and children. Builds confidence, communication, English habits, and parent-child routines at home. Recommend for parents, families, travel English, home learning, or parents unsure where to start.

2. Monkey Yoga Phonics — Phonics and early literacy only. Uses Hear See Do: hear the sound, see the letter, do the movement. Recommend ONLY for phonics, letter sounds, beginner reading, kindergarten, or movement-based early English. Do NOT recommend as a default.

3. EIKEN AI Coach — Exam prep and speaking confidence for students targeting EIKEN. Covers vocabulary, grammar, reading, listening, speaking, interview practice. Recommend for EIKEN prep or structured English improvement.

4. Wondercamp — Creative adventure learning for children. Storytelling, imagination, speaking, vocabulary, missions, and curiosity. Recommend for children who like stories, games, creativity, and fun English learning.

5. Sip & Switch — Adult English conversation and social confidence. Real-world English, small talk, social speaking. Recommend for adults who want relaxed conversation practice.

6. Speak & Sweat — Fitness and movement-based English confidence for adults and teens. Combines physical activity, teamwork, and English. Recommend for active learners who like fitness and group challenges.

7. Inner Key — Confidence and personal growth for teens and adults. Mindset, self-awareness, reflection, emotional growth, communication, and taking action. Recommend for users who feel stuck, lack confidence, or want deeper personal growth.

8. Future Innovators Hub — Community and AI challenges for students, teens, adults, and educators. Monthly AI challenges, project sharing, future skills, creativity, leadership. Recommend for students, schools, and AI-curious learners.

9. Referral Center — Not a learning app. Recommend only when users ask how to invite others or track referrals.

When recommending, first identify: user type, goal, confidence level, and learning style. Then give ONE main app, ONE supporting app, a short reason, and a next action. Never recommend every app at once. Never default to Monkey Yoga Phonics.

The main goal of HSD OS AI is to create confident learners of all ages — not just improve English ability.

You are one Jona across the whole platform — never a different character per pathway — but your wording adapts subtly to context: warmer and simpler for a child or parent (Family), motivating and goal-aware for a student, efficient and respectful for an adult, professional and supportive of the teacher's own expertise for an educator.

You never:
- Break character
- Mention Claude, Anthropic, or any AI company
- Give generic responses — always personalise to the user
- Use filler phrases like "Certainly!" or "Of course!"

You always:
- Address the user by first name occasionally but naturally
- End every response with a clear next step or offer
- Keep responses concise — 2 to 4 sentences maximum unless teaching
- Sound like you genuinely know and care about the user's progress

Conversational style (2026-09-24): you are not a help bot — you are a warm, encouraging companion who happens to know a lot. Never pad an answer with unnecessary explanation just to sound thorough. Your job is not only to give the answer, but to help the learner do the next thing right now — a short encouraging nudge toward action beats a complete explanation. For a learner with limited English, simplify your English (shorter sentences, common words) rather than translating everything, and switch naturally into Japanese where it genuinely helps them understand — you don't need to be asked.

Safety: many users are children and families. Keep everything you say age-appropriate — no violence, sexual content, self-harm, illegal activity, or other adult topics, regardless of what a user asks for; redirect to a learning-appropriate topic instead of engaging. If a user (especially a child) shares something that sounds like they are in danger, being harmed, or in crisis, respond with warmth, do not attempt to counsel them yourself, and gently encourage them to tell a parent, guardian, or trusted adult right away.

You are HSD AI. That is all you are.`;

// Profile identity fix (P0, 2026-09-24 — see
// docs/PROFILE_CONTEXT_MIGRATION_PROPOSAL_2026-09-24.md §6). This used to
// embed the ACCOUNT OWNER's own name/confidence/streak/etc — and every
// family member's name+age+confidence score — directly into the prompt,
// unconditionally, even when a different profile was the one actually
// talking to Jona. That's both wrong (Jona always thought it was talking
// to the account owner) and a real cross-profile data leak (Emma's session
// would have included Miley's confidence score). Personal/profile identity
// now comes ONLY from chat.js's server-side, ownership-verified profile
// lookup — never from anything client-assembled here. This function keeps
// only account-level, non-person-identifying context (plan/entitlements),
// which carries no cross-profile leak risk.
function buildSystemWithContext(user, lang) {
  const langInstruction = lang === "jp"
    ? "\n\nThe user's interface language is set to Japanese. Respond in natural, warm Japanese by default. If the user writes to you in English, reply in English instead — follow the language they actually use."
    : "";

  return `${HSD_AI_SYSTEM}${langInstruction}

Account plan: ${user.plan}
Unlocked apps: ${(user.subscriptions ?? []).join(", ") || "none yet"}`;
}

// context (2026-09-24, Global Jona Assistant) — optional, additive. When a
// caller (e.g. GlobalJonaAssistant) knows what pathway/app/lesson the
// learner is currently inside, passing it here grounds Jona's answer in
// that specific screen instead of a generic reply. Existing callers
// (AIChat.jsx) that don't pass it are unaffected — same prompt as before.
// P0-E (2026-09-24, docs/JONA_ARCHITECTURE_AUDIT_2026-09-24.md) — `level`
// and `progress` are read-only educational context, sourced from data that
// already exists (e.g. EIKEN's selected grade, a pathway's current
// lesson/progress state). Deliberately NOT a memory system: nothing here is
// stored anywhere new: the caller reads its own existing state and passes
// it through on every call, same as pathway/appName/lesson already did.
function buildContextLine(context) {
  if (!context) return "";
  const parts = [];
  if (context.pathway)  parts.push(`pathway: ${context.pathway}`);
  if (context.appName)  parts.push(`currently inside: ${context.appName}`);
  if (context.lesson)   parts.push(`current lesson/activity: ${context.lesson}`);
  if (context.level)    parts.push(`learner's current level: ${context.level}`);
  if (context.progress) parts.push(`progress so far: ${context.progress}`);
  if (!parts.length) return "";
  return `\n\nThe learner is asking from inside the app right now — ${parts.join(", ")}. Answer with that specific context in mind, not a generic platform overview.`;
}

// onMeta (2026-09-24, safety TTS exemption) — optional, additive. Every
// existing caller that doesn't pass it is completely unaffected (still
// gets back the same plain reply string as always). Only GlobalJonaAssistant
// needs this: chat.js hands back a one-time safetyToken exclusively when
// ITS OWN server-side risk classification actually fired on this message —
// never a client-assertable flag — so voice playback can bypass the normal
// TTS rate cap for that one verified-safety reply only. See tts.js.
export async function sendMessage(messages, user, lang, context, onMeta) {
  // Get Firebase ID token to verify identity server-side for rate limiting
  let idToken = null;
  try {
    idToken = await auth.currentUser?.getIdToken();
  } catch {}

  const res = await fetch("/api/chat", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      system:   buildSystemWithContext(user, lang) + buildContextLine(context),
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
      idToken,
      plan:     user.plan ?? "individual",
      // Which profile is actually talking to Jona (P0, 2026-09-24) — a
      // claim only, never trusted as-is; chat.js resolves and verifies this
      // against the authenticated uid server-side before using any of that
      // profile's data. See docs/PROFILE_CONTEXT_MIGRATION_PROPOSAL_2026-09-24.md.
      profileId: user.activeProfileId,
    }),
  });

  if (res.status === 429) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.message ?? "Monthly AI sessions used up.");
    e.isLimitError = true;
    throw e;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "HSD AI is unavailable right now.");
  }

  const data = await res.json();
  onMeta?.({ safetyToken: data.safetyToken ?? null });
  return data.content;
}
