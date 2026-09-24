// Talk with Jona (Gemini Live) — ephemeral session-token minting.
// See docs/JONA_REALTIME_VOICE_AUDIT_2026-09-24.md and
// netlify/functions/_liveSafetyInstruction.js for the architecture and
// safety-mapping this endpoint implements.
//
// This is the ONLY place the real GEMINI_API_KEY is ever touched for Talk
// with Jona — the browser never sees it. What it returns instead is a
// short-lived, single-use auth token from Google's auth_tokens endpoint,
// locked (via liveConnectConstraints/lockAdditionalFields) to a specific
// model AND a specific, server-built systemInstruction, so the client
// cannot see or override Jona's identity/safety instructions even though
// it connects directly to Google's Live API with this token.
//
// Requirement #3 (auth): verify Firebase uid AND that the active profile
// belongs to that uid, same fail-closed pattern as chat.js/resolveProfileContext.
// Requirement #13 (feature-flagged beta): admin-email allowlist only, same
// two addresses firestore.rules' isAdminEmail() recognizes — this must stay
// in lockstep with that list by hand until a real feature-flag doc exists.
// Requirement #9 (hard session limit): daily per-account session cap +
// max-session-seconds, both server-controlled via _liveVoiceConfig.js.

const { GoogleGenAI } = require("@google/genai");
const { firestoreFetch, fromFirestoreFields } = require("./_firebaseAdmin");
const { resolveProfileContext: resolveProfileContextWith } = require("./_profileContext");
const resolveProfileContext = (uid, profileId) => resolveProfileContextWith(firestoreFetch, fromFirestoreFields, uid, profileId);
const { loadLiveVoiceConfig } = require("./_liveVoiceConfig");
const { buildLiveSystemInstruction } = require("./_liveSafetyInstruction");

const PROJECT_ID   = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
const FIREBASE_KEY = process.env.FIREBASE_API_KEY    || "";
const FS_BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const LIVE_MODEL    = "gemini-2.5-flash-native-audio-preview-09-2025";

// Matches firestore.rules' isAdminEmail() exactly. Talk with Jona is
// admin-only for this beta (requirement #13) — kept as a hand-maintained
// allowlist rather than a Firestore-backed flag deliberately, so there is
// no way to accidentally expose this to non-admin accounts by a stray
// config write while it's this new/unverified.
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
    const r = await fetch(`${FS_BASE}/config/killSwitch?key=${FIREBASE_KEY}`);
    if (!r.ok) return false;
    const doc = await r.json();
    const f   = doc.fields ?? {};
    if (f.allEnabled?.booleanValue === false)                      return true;
    if (service && f[`${service}Enabled`]?.booleanValue === false) return true;
    return false;
  } catch { return false; }
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Simple per-day session counter, same shape as tts.js's ttsUsage doc.
// Not race-proof under true concurrency, which is an accepted tradeoff for
// a single-admin-account beta — revisit with a Firestore transaction before
// this ever expands past that.
async function getAndIncrementDailySessionCount(uid) {
  const day = todayUTC();
  const path = `/users/${uid}/liveSessionUsage/${day}`;
  let count = 0;
  try {
    const res = await firestoreFetch(path);
    if (res.ok) {
      const doc = await res.json();
      count = parseInt(doc.fields?.sessionCount?.integerValue ?? "0", 10);
    }
  } catch { /* treat as 0 and let the write attempt below fail soft */ }

  try {
    await firestoreFetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { sessionCount: { integerValue: String(count + 1) }, day: { stringValue: day } } }),
    });
  } catch (e) {
    console.error("live session usage counter write failed (non-blocking):", e.message);
  }
  return count; // count BEFORE this session — used against the cap below
}

async function logSessionStart(uid, sessionId, profileId, context) {
  try {
    await firestoreFetch(`/users/${uid}/liveSessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          startedAt: { timestampValue: new Date().toISOString() },
          profileId: profileId ? { stringValue: String(profileId) } : { nullValue: null },
          pathway:   context?.pathway ? { stringValue: String(context.pathway) } : { nullValue: null },
          appName:   context?.appName ? { stringValue: String(context.appName) } : { nullValue: null },
          endedAt:   { nullValue: null },
          endReason: { nullValue: null },
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

  if (await isKilled("geminiLive")) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Talk with Jona is temporarily paused." }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { idToken, profileId, pathway, appName, lesson, lang } = body;

  if (!idToken) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Authentication required." }) };
  }

  const firebaseUser = await verifyIdToken(idToken);
  if (!firebaseUser) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid session. Please sign in again." }) };
  }
  const uid = firebaseUser.localId;
  const email = firebaseUser.email;

  // Requirement #13 — feature-flagged beta, admin-only for now.
  if (!email || !LIVE_BETA_ADMIN_EMAILS.includes(email)) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Talk with Jona isn't available on this account yet." }) };
  }

  // Requirement #3 — profile must belong to this uid, fail closed.
  const profileResult = await resolveProfileContext(uid, profileId);
  if (!profileResult.ok) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Could not verify the active profile." }) };
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Voice service not configured." }) };
  }

  const config = await loadLiveVoiceConfig(firestoreFetch, fromFirestoreFields);
  const priorCount = await getAndIncrementDailySessionCount(uid);
  if (priorCount >= config.dailySessionCap) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: "You've reached today's Talk with Jona limit. Try again tomorrow." }) };
  }

  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const systemInstruction = buildLiveSystemInstruction(
    profileResult.profile,
    { pathway, appName, lesson },
    lang === "jp" ? "jp" : "en"
  );

  try {
    // Ephemeral tokens are minted via the SDK's own authTokens.create() —
    // NOT a hand-rolled REST call — because this API is documented as
    // v1alpha-only (see @google/genai's Tokens.create() doc comment) and
    // the SDK owns the correct endpoint/version/wire-format internally.
    // See CreateAuthTokenConfig in @google/genai's type definitions for
    // the exact shape: uses, expireTime, newSessionExpireTime,
    // liveConnectConstraints (model + config), lockAdditionalFields.
    const mintAi = new GoogleGenAI({ apiKey: API_KEY, httpOptions: { apiVersion: "v1alpha" } });
    const minted = await mintAi.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + config.maxSessionSeconds * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: ["AUDIO"],
            systemInstruction: { parts: [{ text: systemInstruction }] },
          },
        },
        lockAdditionalFields: ["model", "config.responseModalities", "config.systemInstruction"],
      },
    });

    const token = minted.name; // e.g. "auth_tokens/abc123..." — used as apiKey by the client SDK
    if (!token) {
      console.error("Gemini auth_tokens mint returned no token name:", JSON.stringify(minted));
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Could not start Talk with Jona right now." }) };
    }

    await logSessionStart(uid, sessionId, profileId, { pathway, appName });

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        sessionId,
        model: LIVE_MODEL,
        maxSessionSeconds: config.maxSessionSeconds,
        inactivitySeconds: config.inactivitySeconds,
      }),
    };
  } catch (e) {
    console.error("live-token error:", e.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Something went wrong starting Talk with Jona." }) };
  }
};
