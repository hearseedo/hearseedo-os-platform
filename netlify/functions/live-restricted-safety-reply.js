// Talk with Jona — Gate B Stage 4: the IMMEDIATE_DANGER restricted, non-
// Live safety pathway (approved Option C — see
// docs/JONA_LIVE_SAFETY_GATE_B_STAGE3_REVISION_2026-09-29.md §1). Called by
// the browser AFTER it has already muted Live audio and closed the Gemini
// Live WebSocket for a session the server has authoritatively marked
// IMMEDIATE_DANGER — this endpoint is the ONLY way that session continues
// hearing from Jona at all, and it is a plain, server-controlled
// generateContent call using the same RESTRICTED_SAFETY_SYSTEM prompt Ask
// Jona already uses, not another Live connection.
//
// Deliberately narrow and bounded (explicit instruction: this must not
// become unlimited free Jona usage, and must not be therapy/counseling/
// tutoring/general conversation):
//   - only reachable for a session the server itself has already marked
//     IMMEDIATE_DANGER (checked fresh from Firestore on every call — a
//     client cannot talk its way into this pathway by claiming a tier);
//   - capped at a small fixed number of exchanges AND a short wall-clock
//     window, whichever comes first — once either is hit, the caller is
//     told to fall back to the static safety message, not given another
//     generated reply;
//   - reuses the exact same containment/allowlist gate as chat.js/
//     live-token.js (defense in depth — Live remains admin/adult-tester
//     only regardless of Gate B's progress);
//   - every utterance is still run through the safety engine (this
//     pathway does not turn off supervision — a continued escalation is
//     still tracked), though the session is already at the ceiling tier
//     so this cannot itself downgrade anything.

const { firestoreFetch, fromFirestoreFields, incrementField, PROJECT_ID } = require("./_firebaseAdmin");
const { isApprovedAdultTesterProfile } = require("./_approvedJonaTesters");
const { RESTRICTED_SAFETY_SYSTEM } = require("./_restrictedSafetySystem");
const { classify } = require("./_safetyEngine");

const FIREBASE_KEY = process.env.FIREBASE_API_KEY || "";
const MODEL = "gemini-2.5-flash";

// Bounded per Stage 3 Revision §1.3: "3-4 exchanges or 2-3 minutes,
// whichever comes first." Using the upper end of each so a genuinely brief
// exchange isn't cut short mid-sentence, while still keeping this narrow.
const MAX_EXCHANGES = 4;
const MAX_WINDOW_MS = 3 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function verifyIdToken(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.users?.[0] ?? null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { idToken, sessionId, profileId, text, lang } = body;
  if (!idToken || !sessionId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "sessionId is required." }) };
  }

  const firebaseUser = await verifyIdToken(idToken);
  if (!firebaseUser) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid session. Please sign in again." }) };
  }
  const uid = firebaseUser.localId;
  const email = firebaseUser.email;

  // Same containment gate as chat.js/live-token.js — this pathway is only
  // ever reached from an already-admin-gated Live session, but this is
  // checked independently anyway (defense in depth, not trust-by-origin).
  if (!isApprovedAdultTesterProfile({ email, profileId })) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Not available for this account/profile." }) };
  }

  const sessionPath = `/users/${uid}/liveSessions/${sessionId}`;
  let sessionDoc;
  try {
    const res = await firestoreFetch(sessionPath);
    if (!res.ok) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Session not found." }) };
    sessionDoc = fromFirestoreFields((await res.json()).fields ?? {});
  } catch {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Could not verify session." }) };
  }

  // Authoritative, fresh check — the ONLY thing that gates this endpoint.
  // A client cannot reach this pathway by claiming a tier; only the
  // server's own already-written safetyTier counts.
  if (sessionDoc.safetyTier !== "IMMEDIATE_DANGER") {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "This pathway is not active for this session." }) };
  }

  const now = Date.now();
  const startedAtStr = sessionDoc.restrictedPathwayStartedAt;
  const startedAtMs = startedAtStr ? new Date(startedAtStr).getTime() : now;
  const exchangeCount = Number.isInteger(sessionDoc.restrictedExchangeCount) ? sessionDoc.restrictedExchangeCount : 0;

  // Bound check — done BEFORE calling Gemini, so a capped session never
  // consumes another generation call at all.
  if (exchangeCount >= MAX_EXCHANGES || now - startedAtMs > MAX_WINDOW_MS) {
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ capped: true, reason: exchangeCount >= MAX_EXCHANGES ? "max_exchanges" : "max_window" }),
    };
  }

  // Initialize the pathway's own clock on its first call for this session.
  if (!startedAtStr) {
    firestoreFetch(":commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [{
          update: {
            name: `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/liveSessions/${sessionId}`,
            fields: { restrictedPathwayStartedAt: { timestampValue: new Date(now).toISOString() } },
          },
          updateMask: { fieldPaths: ["restrictedPathwayStartedAt"] },
        }],
      }),
    }).catch(() => {});
  }

  // Continued supervision — does not turn off classification just because
  // the session is already at the ceiling tier. A failure here must never
  // block the restricted reply itself (this pathway's own fallback-to-
  // static-message behavior is what handles a GENERATION failure; a
  // classification hiccup on top of an already-IMMEDIATE_DANGER session
  // changes nothing about what tier this reply is delivered under).
  if (typeof text === "string" && text.trim()) {
    classify({ text, lang }).catch((e) => {
      console.error("live-restricted-safety-reply: continued classification failed (non-blocking):", e.message);
    });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "AI service not configured." }) };
  }

  try {
    const geminiBody = {
      contents: [{ role: "user", parts: [{ text: (text || "").slice(0, 2000) || "(no additional message)" }] }],
      systemInstruction: { parts: [{ text: RESTRICTED_SAFETY_SYSTEM }] },
      generationConfig: { temperature: 0.6, maxOutputTokens: 200 },
    };
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(geminiBody) }
    );
    if (!res.ok) {
      console.error("live-restricted-safety-reply: Gemini error", res.status, await res.text());
      // Explicit instruction: on failure, fall back to the static safety
      // response rather than reopening unrestricted Live or retrying
      // indefinitely.
      return { statusCode: 502, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error: "generation_failed", fallbackToStatic: true }) };
    }
    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const replyText = (parts.find((p) => !p.thought) ?? parts[0])?.text ?? "";
    if (!replyText) {
      return { statusCode: 502, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error: "empty_response", fallbackToStatic: true }) };
    }

    incrementField(sessionPath, "restrictedExchangeCount", 1).catch((e) =>
      console.error("live-restricted-safety-reply: exchange counter increment failed (non-blocking):", e.message)
    );

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ reply: replyText, exchangeCount: exchangeCount + 1, maxExchanges: MAX_EXCHANGES }),
    };
  } catch (e) {
    console.error("live-restricted-safety-reply: unexpected error:", e.message);
    return { statusCode: 502, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error: "generation_failed", fallbackToStatic: true }) };
  }
};
