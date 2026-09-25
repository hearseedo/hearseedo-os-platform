// Talk with Jona (Gemini Live) — ephemeral session-token minting.
// See docs/JONA_REALTIME_VOICE_AUDIT_2026-09-24.md,
// docs/JONA_LIVE_SAFETY_ARCHITECTURE_2026-09-24.md, and
// docs/JONA_LIVE_BETA_GUARDRAILS_2026-09-25.md for the architecture and
// safety/cost-control mapping this endpoint implements.
//
// This is the ONLY place the real GEMINI_API_KEY is ever touched for Talk
// with Jona — the browser never sees it. What it returns instead is a
// short-lived, single-use auth token from Google's auth_tokens endpoint,
// locked (via liveConnectConstraints/lockAdditionalFields) to a specific
// model AND a specific, server-built systemInstruction, so the client
// cannot see or override Jona's identity/safety instructions even though
// it connects directly to Google's Live API with this token.
//
// SERVER-SIDE AUTHORITY (2026-09-25 cost-control pass) — the browser is
// NEVER trusted for any of: monthly minutes remaining, daily session
// count, whether Live is enabled, whether an account may start a session,
// or authoritative duration. Every one of those is checked here, in this
// order, before a token is ever minted:
//   1. global kill switch (config/killSwitch.geminiLiveEnabled)
//   2. authenticated Firebase user (idToken)
//   3. admin/test allowlist (Talk with Jona stays admin-only until BOTH
//      the financial-controls gate AND the Live child-safety gate are
//      satisfied — see the guardrails doc; this task does NOT expand who
//      can reach this endpoint, only what happens once they do)
//   4. profile ownership, fail-closed
//   5. monthly allowance remaining (admin/beta tiers differ)
//   6. daily session allowance remaining
//   7. one-active-session-per-account concurrency lock (atomic)
// Only then is the ephemeral token minted.

const { GoogleGenAI } = require("@google/genai");
const { firestoreFetch, fromFirestoreFields, incrementField } = require("./_firebaseAdmin");
const { acquireSessionLock, releaseSessionLockIfOwned } = require("./_liveSessionLock");
const { resolveProfileContext: resolveProfileContextWith } = require("./_profileContext");
const resolveProfileContext = (uid, profileId) => resolveProfileContextWith(firestoreFetch, fromFirestoreFields, uid, profileId);
const { loadLiveBetaPolicy } = require("./_liveBetaPolicy");
const { buildLiveSystemInstruction } = require("./_liveSafetyInstruction");

const FIREBASE_KEY = process.env.FIREBASE_API_KEY    || "";
// Confirmed 2026-09-25 against Google's own models.list endpoint for THIS
// project's API key, filtered to models whose supportedGenerationMethods
// includes bidiGenerateContent — not taken from SDK doc comments, which
// were wrong twice before this (both a guessed native-audio preview name
// and a stale @google/genai doc example) failed in production with
// WebSocket close code 1008. This exact string IS in that verified list.
const LIVE_MODEL    = "gemini-2.5-flash-native-audio-preview-09-2025";

// Matches firestore.rules' isAdminEmail() exactly. Talk with Jona is
// admin-only for this beta — kept as a hand-maintained allowlist rather
// than a Firestore-backed flag deliberately, so there is no way to
// accidentally expose this to non-admin accounts by a stray config write
// while both release gates (financial controls + Live child safety) are
// still open. See docs/JONA_LIVE_BETA_GUARDRAILS_2026-09-25.md.
const LIVE_BETA_ADMIN_EMAILS = ["hearseedo.english@gmail.com", "waltho79@gmail.com"];

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

async function isKilled(service) {
  try {
    const r = await firestoreFetch("/config/killSwitch");
    if (!r.ok) return false;
    const doc = await r.json();
    const f   = doc.fields ?? {};
    if (f.allEnabled?.booleanValue === false)                      return true;
    if (service && f[`${service}Enabled`]?.booleanValue === false) return true;
    return false;
  } catch { return false; }
}

// JST throughout (2026-09-25 audit finding): chat.js's own daily text-quota
// reset, and every other daily-reset usage counter in this codebase
// (coaching-card.js, eiken-evaluate.js, log-page-view.js, the admin cost
// dashboard's "this month" calculation) already use
// Asia/Tokyo — HSD's primary market — as the one consistent reset
// timezone. Live's own daily/monthly counters now match that convention
// instead of the UTC this file originally used, so a household's daily
// text-chat limit and daily Live-session limit reset at the same moment.
function todayJST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
function thisMonthJST() {
  return todayJST().slice(0, 7);
}

async function getDailySessionCount(uid) {
  const day = todayJST();
  try {
    const res = await firestoreFetch(`/users/${uid}/liveSessionUsage/${day}`);
    if (!res.ok) return 0;
    const doc = await res.json();
    return parseInt(doc.fields?.sessionCount?.integerValue ?? "0", 10);
  } catch {
    return 0;
  }
}

async function incrementDailySessionCount(uid) {
  const day = todayJST();
  const path = `/users/${uid}/liveSessionUsage/${day}`;
  try {
    // Atomic increment (creates the doc with sessionCount=1 if it doesn't
    // exist yet — confirmed Firestore transform-on-absent-doc behavior,
    // already relied on elsewhere in this codebase for the same shape).
    await incrementField(path, "sessionCount", 1);
    // Merge-only PATCH for the human-readable "day" field — updateMask
    // restricts this write to exactly that field, so it can never clobber
    // the sessionCount the increment above just wrote.
    await firestoreFetch(`${path}?updateMask.fieldPaths=day`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { day: { stringValue: day } } }),
    });
  } catch (e) {
    console.error("live daily session counter write failed (non-blocking):", e.message);
  }
}

// Monthly minutes accounting — seconds, not minutes, so the atomic
// increment (integer-only) never has to deal with fractional minutes.
async function getMonthlySecondsUsed(uid) {
  const month = thisMonthJST();
  try {
    const res = await firestoreFetch(`/users/${uid}/liveUsageMonthly/${month}`);
    if (!res.ok) return 0;
    const doc = await res.json();
    return parseInt(doc.fields?.secondsUsed?.integerValue ?? "0", 10);
  } catch {
    return 0;
  }
}

async function logSessionStart(uid, sessionId, profileId, context, usageClass) {
  try {
    await firestoreFetch(`/users/${uid}/liveSessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          startedAt:  { timestampValue: new Date().toISOString() },
          profileId:  profileId ? { stringValue: String(profileId) } : { nullValue: null },
          pathway:    context?.pathway ? { stringValue: String(context.pathway) } : { nullValue: null },
          appName:    context?.appName ? { stringValue: String(context.appName) } : { nullValue: null },
          usageClass: { stringValue: usageClass },
          endedAt:    { nullValue: null },
          endReason:  { nullValue: null },
        },
      }),
    });
  } catch (e) {
    console.error("live session-start logging failed (non-blocking):", e.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  // 1. Global kill switch — checked before anything else, including auth,
  // so a disabled Live feature never even validates a token needlessly.
  if (await isKilled("geminiLive")) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Talk with Jona is temporarily unavailable. You can still Ask Jona." }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { idToken, profileId, pathway, appName, lesson, lang } = body;

  // 2. Authenticated Firebase user.
  if (!idToken) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Authentication required." }) };
  }
  const firebaseUser = await verifyIdToken(idToken);
  if (!firebaseUser) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid session. Please sign in again." }) };
  }
  const uid = firebaseUser.localId;
  const email = firebaseUser.email;

  // 3. Admin/test allowlist — still the only path in, per the release-gate
  // decision (see file header). usageClass tags every session from here
  // on so admin testing is always distinguishable from real beta usage in
  // accounting/dashboards, never silently mixed in.
  if (!email || !LIVE_BETA_ADMIN_EMAILS.includes(email)) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Talk with Jona isn't available on this account yet." }) };
  }
  const usageClass = "admin_test"; // every account that can reach this point today is admin/test by construction

  // 4. Profile ownership, fail-closed.
  const profileResult = await resolveProfileContext(uid, profileId);
  if (!profileResult.ok) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Could not verify the active profile." }) };
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Voice service not configured." }) };
  }

  const policy = await loadLiveBetaPolicy(firestoreFetch, fromFirestoreFields);
  const isAdminTier = usageClass === "admin_test";
  const monthlyMinutesLimit = isAdminTier ? policy.adminMonthlyMinutes    : policy.monthlyMinutes;
  const dailySessionsLimit  = isAdminTier ? policy.adminDailySessions    : policy.dailySessions;
  const maxSessionMinutes   = isAdminTier ? policy.adminMaxSessionMinutes: policy.maxSessionMinutes;
  const maxSessionSeconds   = maxSessionMinutes * 60;

  // 5. Monthly allowance — ACCOUNT level (shared across every profile in
  // the household), never per-profile. Checked at session START against
  // usage accumulated so far; a session in progress can push the account
  // slightly over the cap by up to one session's length in the worst
  // case (this is a start-of-session gate, not continuous metering) —
  // an accepted, documented tradeoff for a cost *guardrail*, not a
  // hard real-time meter.
  const secondsUsedThisMonth = await getMonthlySecondsUsed(uid);
  if (secondsUsedThisMonth / 60 >= monthlyMinutesLimit) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: "You've used this month's Talk with Jona time. You can still Ask Jona anytime.", code: "monthly_limit" }) };
  }

  // 6. Daily session count — abuse/cost guardrail, resets at JST midnight
  // (see todayJST() above for why JST specifically).
  const dailyCount = await getDailySessionCount(uid);
  if (dailyCount >= dailySessionsLimit) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: "That's all your Talk with Jona sessions for today. You can still Ask Jona, and Talk with Jona will be available again tomorrow.", code: "daily_limit" }) };
  }

  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // 7. One active session per account, across devices — real atomicity,
  // not a read-then-write race (see acquireSessionLock's own comment). A
  // SHORT, client-renewed lease (not maxSessionSeconds+30) — see
  // docs/JONA_LIVE_LOCK_RECOVERY_2026-09-25.md — so an abnormal disconnect
  // recovers in ~lockLeaseSeconds, not up to 5.5 minutes.
  const gotLock = await acquireSessionLock(uid, sessionId, policy.lockLeaseSeconds);
  if (!gotLock) {
    return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: "Jona is already in a live conversation on another device.", code: "concurrent_session" }) };
  }

  const systemInstruction = buildLiveSystemInstruction(
    profileResult.profile,
    { pathway, appName, lesson },
    lang === "jp" ? "jp" : "en"
  );

  try {
    // Ephemeral tokens are minted via the SDK's own authTokens.create() —
    // NOT a hand-rolled REST call — because this API is documented as
    // v1alpha-only and the SDK owns the correct endpoint/version/wire-
    // format internally. See CreateAuthTokenConfig in @google/genai's
    // type definitions for the exact shape.
    const mintAi = new GoogleGenAI({ apiKey: API_KEY, httpOptions: { apiVersion: "v1alpha" } });
    const minted = await mintAi.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + maxSessionSeconds * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: ["AUDIO"],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            // "Puck" — Google's most consistently documented example voice
            // (male-toned), chosen to match Jona's established character.
            // Not verified against a per-project voices.list (no such
            // public endpoint exists) the way the model name was.
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
          },
        },
        // Empty array (not field-path strings — Google's API rejected
        // dotted paths with "field_mask is invalid for
        // BidiGenerateContentSetup") already locks every field explicitly
        // set above in liveConnectConstraints.config plus model.
        lockAdditionalFields: [],
      },
    });

    const token = minted.name; // e.g. "auth_tokens/abc123..." — used as apiKey by the client SDK
    if (!token) {
      console.error("Gemini auth_tokens mint returned no token name:", JSON.stringify(minted));
      await releaseSessionLockIfOwned(uid, sessionId);
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Could not start Talk with Jona right now." }) };
    }

    await logSessionStart(uid, sessionId, profileId, { pathway, appName }, usageClass);
    await incrementDailySessionCount(uid);

    const remainingMinutes = Math.max(0, Math.floor(monthlyMinutesLimit - secondsUsedThisMonth / 60));

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        sessionId,
        model: LIVE_MODEL,
        maxSessionSeconds,
        idleCheckSeconds: policy.idleCheckSeconds,
        idleDisconnectSeconds: policy.idleDisconnectSeconds,
        heartbeatIntervalSeconds: policy.heartbeatIntervalSeconds,
        remainingMinutes,
        usageClass,
      }),
    };
  } catch (e) {
    console.error("live-token error:", e.message);
    await releaseSessionLockIfOwned(uid, sessionId);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Something went wrong starting Talk with Jona." }) };
  }
};
