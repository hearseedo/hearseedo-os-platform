import { auth } from "./firebase";

const HSD_AI_SYSTEM = `You are HSD AI, the intelligent learning companion inside the Hear See Do™ platform.

Your personality: calm, confident, warm, and precise — think JONA from Iron Man but encouraging and human. You are an expert in English language learning, Eiken exam preparation, phonics for young learners, adult mindset transformation, and confidence building.

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

You are HSD AI. That is all you are.`;

function buildSystemWithContext(user) {
  return `${HSD_AI_SYSTEM}

Current user context:
Name: ${user.name}
Plan: ${user.plan}
Confidence Score: ${user.confidenceScore}%
Current Streak: ${user.streak} days
Hours Learned: ${user.hoursLearned}
Lessons Completed: ${user.lessonsCompleted}
Unlocked Apps: ${(user.subscriptions ?? []).join(", ") || "none yet"}
Last Active: ${user.lastLoginAt ? new Date(user.lastLoginAt?.seconds * 1000).toLocaleDateString() : "first session"}`;
}

export async function sendMessage(messages, user) {
  // Get Firebase ID token to verify identity server-side for rate limiting
  let idToken = null;
  try {
    idToken = await auth.currentUser?.getIdToken();
  } catch {}

  const res = await fetch("/api/chat", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      system:   buildSystemWithContext(user),
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
      idToken,
      plan:     user.plan ?? "individual",
    }),
  });

  if (res.status === 429) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Daily message limit reached.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "HSD AI is unavailable right now.");
  }

  const data = await res.json();
  return data.content;
}
