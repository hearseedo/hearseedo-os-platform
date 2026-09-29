// Talk with Jona (Gemini Live) — Gate B Stage 4V fix: the three missing
// CLIENT-side safety-latency timestamps. See
// docs/JONA_LIVE_SAFETY_GATE_B_STAGE3_REVISION_2026-09-29.md §3 — the
// server side (T0-T3: speech-end, transcript-available, classifier
// dispatched, verdict) is already logged by live-transcript-classify.js's
// own logLatency(). This endpoint completes the chain with T4-T6, which can
// only be observed client-side:
//   directiveReceivedAt   — the browser's onSnapshot actually fired
//   audioMutedAt          — ordinary Live audio was actually muted/stopped
//   restrictedResponseBeginAt — the first restricted-pathway reply started
//
// METADATA/TIMING ONLY — this endpoint accepts and stores nothing but
// finite numeric timestamps against an eventId. No transcript text, no
// reply text, no audio, ever. It is fire-and-forget from the caller's
// perspective by design (see TalkWithJona.jsx's call sites): a failure
// here must have zero effect on any safety transition — that transition
// (mute, close, restricted reply) has already happened client-side by the
// time this is called, this only records WHEN it happened.

const { firestoreFetch } = require("./_firebaseAdmin");

const FIREBASE_KEY = process.env.FIREBASE_API_KEY || "";

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

const ALLOWED_FIELDS = ["directiveReceivedAt", "audioMutedAt", "restrictedResponseBeginAt"];

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { idToken, sessionId, eventId } = body;
  if (!idToken || !sessionId || !eventId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "sessionId and eventId are required." }) };
  }

  const firebaseUser = await verifyIdToken(idToken);
  if (!firebaseUser) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid session. Please sign in again." }) };
  }
  const uid = firebaseUser.localId;

  // Session must exist under THIS uid — same path-scoping guarantee as
  // live-transcript-classify.js; no value of sessionId a caller supplies
  // reaches another account's data.
  try {
    const res = await firestoreFetch(`/users/${uid}/liveSessions/${sessionId}`);
    if (!res.ok) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Session not found." }) };
  } catch {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Could not verify session." }) };
  }

  // Only finite-number values for the three allowed fields — never
  // transcript/reply text, regardless of what the client sends.
  const fields = {};
  const fieldPaths = [];
  for (const key of ALLOWED_FIELDS) {
    if (Number.isFinite(body[key])) {
      fields[key] = { integerValue: String(Math.round(body[key])) };
      fieldPaths.push(key);
    }
  }
  if (fieldPaths.length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "No valid timing fields provided." }) };
  }

  try {
    await firestoreFetch(
      `/users/${uid}/liveSessions/${sessionId}/latencyLog/${String(eventId).slice(0, 200)}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }) }
    );
  } catch (e) {
    // Best-effort, matching every other latency/logging call in this
    // codebase — a logging failure is never surfaced as an error the
    // caller should act on.
    console.error("live-safety-timing: write failed (non-blocking):", e.message);
  }

  return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
};
