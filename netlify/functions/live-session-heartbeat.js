// Talk with Jona (Gemini Live) — concurrency-lock heartbeat (2026-09-25).
// See docs/JONA_LIVE_LOCK_RECOVERY_2026-09-25.md. Called periodically by
// a genuinely-connected client (TalkWithJona.jsx) to renew its own
// session's lease on the one-active-session-per-account lock. Deliberately
// tiny and cheap: no Gemini API cost at all, one small Firestore
// read+write, called at most every ~20s for a session that runs at most
// ~5 minutes (≈15 calls/session worst case).
//
// Fail-closed the same way every other Live endpoint does: the sessionId
// must belong to the calling uid's own liveSessions doc AND still be the
// lock's current owner — a stale/foreign sessionId renews nothing.
const { firestoreFetch, fromFirestoreFields } = require("./_firebaseAdmin");
const { renewSessionLock } = require("./_liveSessionLock");
const { loadLiveBetaPolicy } = require("./_liveBetaPolicy");

const FIREBASE_KEY = process.env.FIREBASE_API_KEY || "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
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

  const { idToken, sessionId } = body;
  if (!idToken || !sessionId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "sessionId is required." }) };
  }

  const firebaseUser = await verifyIdToken(idToken);
  if (!firebaseUser) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid session. Please sign in again." }) };
  }
  const uid = firebaseUser.localId;

  // Fail closed: the session doc must exist under THIS uid (created by
  // live-token.js at mint time) — a sessionId the caller can't own
  // renews nothing, same shape as live-session-end.js.
  try {
    const res = await firestoreFetch(`/users/${uid}/liveSessions/${sessionId}`);
    if (!res.ok) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Session not found.", code: "session_not_found" }) };
  } catch {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Could not verify session." }) };
  }

  const policy = await loadLiveBetaPolicy(firestoreFetch, fromFirestoreFields);
  const renewed = await renewSessionLock(uid, sessionId, policy.lockLeaseSeconds);
  if (!renewed) {
    // This session no longer owns the lock (already released, expired
    // and reclaimed, etc.) — the client should stop heartbeating; it does
    // not need to end the Live connection itself over this alone.
    return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: "Session lock no longer held.", code: "lock_not_owned" }) };
  }

  return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
};
