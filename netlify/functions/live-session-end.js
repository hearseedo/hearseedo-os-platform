// Talk with Jona (Gemini Live) — session-end logging. Logs enough
// non-sensitive metadata (start/end timestamps, duration, end reason,
// token usage, estimated cost) to learn real usage/cost shape, without
// ever storing audio or a transcript. Called by the client when a Live
// session ends for any reason — never trusted blindly: the sessionId must
// belong to the calling uid's own liveSessions doc, verified server-side
// before any write, same fail-closed shape as the rest of this Jona
// safety work.
//
// Also releases the one-active-session-per-account concurrency lock
// (_liveSessionLock.js) — this is the primary release path, but not the
// only one: the lock has its own expiresAt lease, so a crashed tab that
// never calls this endpoint still self-clears rather than permanently
// locking the account out.

const { firestoreFetch, incrementField, fromFirestoreFields } = require("./_firebaseAdmin");
const { releaseSessionLockIfOwned } = require("./_liveSessionLock");
const { loadLivePricingConfig, estimateSessionCostUSD } = require("./_livePricingConfig");

const FIREBASE_KEY = process.env.FIREBASE_API_KEY    || "";

// Explicit, machine-readable end reasons (2026-09-25) — consistent across
// client (TalkWithJona.jsx), server, and admin reporting. Anything else
// the client sends collapses to "unknown" rather than being trusted
// verbatim.
const VALID_END_REASONS = new Set([
  "user_end", "idle_timeout", "session_limit", "monthly_limit", "daily_limit",
  "profile_switch", "logout", "route_change", "connection_error",
  "admin_disabled", "safety", "unknown",
]);
// "Completed normally" for reporting purposes — every reason that isn't a
// crash/error/unexpected-drop. Used only for the admin dashboard's
// success-rate view, not for any enforcement decision.
const ABNORMAL_REASONS = new Set(["connection_error", "unknown"]);

function todayJST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
function thisMonthJST() {
  return todayJST().slice(0, 7);
}

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

  const { idToken, sessionId, durationSeconds, endReason, usageMetadata } = body;

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

  // Release the concurrency lock — AWAITED (2026-09-25 fix). This was
  // previously fire-and-forget on the theory that it "never blocks the
  // response," but a serverless function's execution environment can be
  // frozen/torn down immediately after the response is returned, with no
  // guarantee an un-awaited promise actually completes first — this was
  // the real reason a clean session end didn't always release the lock,
  // not the lock's lease duration (see
  // docs/JONA_LIVE_LOCK_RECOVERY_2026-09-25.md). It's a single small
  // Firestore round-trip, cheap enough to simply wait for.
  await releaseSessionLockIfOwned(uid, sessionId).catch(() => {});

  const safeDuration = Number.isFinite(durationSeconds) && durationSeconds >= 0 ? Math.round(durationSeconds) : null;
  const safeReason = VALID_END_REASONS.has(endReason) ? endReason : "unknown";
  const completedNormally = !ABNORMAL_REASONS.has(safeReason);

  // Usage metadata (2026-09-25) — whatever Gemini's own serverContent
  // messages reported (see TalkWithJona.jsx's onmessage capture of the
  // LAST usageMetadata seen during the session, which is cumulative per
  // Google's documented shape). Never raw audio, never a transcript —
  // just token counts. Cost is an ESTIMATE computed from a centralized,
  // remotely-adjustable pricing config (_livePricingConfig.js), not a
  // number Gemini itself returns — see that file's own honesty note.
  const promptTokenCount   = Number.isFinite(usageMetadata?.promptTokenCount)   ? usageMetadata.promptTokenCount   : null;
  const responseTokenCount = Number.isFinite(usageMetadata?.responseTokenCount) ? usageMetadata.responseTokenCount : null;
  const totalTokenCount    = Number.isFinite(usageMetadata?.totalTokenCount)    ? usageMetadata.totalTokenCount    : null;

  let estimatedCostUSD = null;
  if (promptTokenCount != null || responseTokenCount != null) {
    try {
      const pricing = await loadLivePricingConfig(firestoreFetch, fromFirestoreFields);
      estimatedCostUSD = estimateSessionCostUSD({ promptTokenCount: promptTokenCount ?? 0, responseTokenCount: responseTokenCount ?? 0 }, pricing);
    } catch (e) {
      console.error("live session cost estimate failed (non-blocking):", e.message);
    }
  }

  try {
    await firestoreFetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          ...(existing.fields ?? {}),
          endedAt:            { timestampValue: new Date().toISOString() },
          endReason:          { stringValue: safeReason },
          durationSeconds:    safeDuration != null ? { integerValue: String(safeDuration) } : { nullValue: null },
          completedNormally:  { booleanValue: completedNormally },
          promptTokenCount:   promptTokenCount   != null ? { integerValue: String(promptTokenCount) }   : { nullValue: null },
          responseTokenCount: responseTokenCount != null ? { integerValue: String(responseTokenCount) } : { nullValue: null },
          totalTokenCount:    totalTokenCount    != null ? { integerValue: String(totalTokenCount) }    : { nullValue: null },
          estimatedCostUSD:   estimatedCostUSD   != null ? { doubleValue: estimatedCostUSD }             : { nullValue: null },
        },
      }),
    });
  } catch (e) {
    console.error("live-session-end write failed:", e.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Could not record session end." }) };
  }

  // Monthly minutes accounting — ACCOUNT level, atomic increment (seconds,
  // not minutes, to stay integer-safe — see live-token.js's own note on
  // why). Best-effort: a failure here must never block the user from
  // actually leaving the conversation, which is why this runs after the
  // session doc's own PATCH already succeeded and the response is about
  // to return regardless.
  if (safeDuration != null && safeDuration > 0) {
    incrementField(`/users/${uid}/liveUsageMonthly/${thisMonthJST()}`, "secondsUsed", safeDuration).catch((e) =>
      console.error("live monthly usage increment failed (non-blocking):", e.message)
    );
  }

  return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
};
