// Talk with Jona (Gemini Live) — session-end logging. Requirement #9: log
// enough non-sensitive metadata (start/end timestamps, duration, end
// reason, abnormal-disconnect tracking) to learn real usage/cost shape,
// without ever storing audio or a transcript. Called by the client when a
// Live session ends for any reason (End conversation, timeout, error,
// component unmount) — never trusted blindly: the sessionId must belong to
// the calling uid's own liveSessions doc, verified server-side before any
// write, same fail-closed shape as the rest of this Jona safety work.

const { firestoreFetch, fromFirestoreFields } = require("./_firebaseAdmin");

const PROJECT_ID   = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
const FIREBASE_KEY = process.env.FIREBASE_API_KEY    || "";
const FS_BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const VALID_END_REASONS = new Set(["user_ended", "timeout", "inactivity", "error", "abnormal_disconnect", "route_exit", "logout", "profile_switch"]);

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

  const { idToken, sessionId, durationSeconds, endReason } = body;

  if (!idToken || !sessionId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "sessionId is required." }) };
  }

  const firebaseUser = await verifyIdToken(idToken);
  if (!firebaseUser) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid session. Please sign in again." }) };
  }
  const uid = firebaseUser.localId;
  const path = `/users/${uid}/liveSessions/${sessionId}`;

  // Fail closed: the session doc must already exist under THIS uid (it was
  // created by live-token.js at mint time) — a sessionId the caller can't
  // own can't be written to, by construction of the path.
  let existing;
  try {
    const res = await firestoreFetch(path);
    if (!res.ok) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Session not found." }) };
    existing = await res.json();
  } catch {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Could not verify session." }) };
  }

  const safeDuration = Number.isFinite(durationSeconds) && durationSeconds >= 0 ? Math.round(durationSeconds) : null;
  const safeReason = VALID_END_REASONS.has(endReason) ? endReason : "unknown";

  try {
    await firestoreFetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          ...(existing.fields ?? {}),
          endedAt:         { timestampValue: new Date().toISOString() },
          endReason:       { stringValue: safeReason },
          durationSeconds: safeDuration != null ? { integerValue: String(safeDuration) } : { nullValue: null },
        },
      }),
    });
  } catch (e) {
    console.error("live-session-end write failed:", e.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Could not record session end." }) };
  }

  return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
};
