// Netlify Function — ElevenLabs TTS proxy
const { firestoreFetch } = require("./_firebaseAdmin");
const { consumeSafetyGrant: consumeSafetyGrantWith } = require("./_safetyTtsGrant");
const consumeSafetyGrant = (uid, token) => consumeSafetyGrantWith(firestoreFetch, uid, token);
const VOICE_ID_EN  = "nzFihrBIvB34imQBuxub"; // Jona's voice (English)
const VOICE_ID_JP  = "5FNeYl6NmyAXYQWW7CEV"; // Jona's voice (Japanese only)
const MODEL_ID     = "eleven_turbo_v2";        // faster + cheaper than monolingual_v1
const MAX_CHARS    = 1200;
const PROJECT_ID   = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
const FIREBASE_KEY = process.env.FIREBASE_API_KEY    || "";
const FS_BASE      = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function todayJST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

// Abuse/rate protection (2026-09-24 — see
// docs/JONA_VOICE_COST_PROPOSAL_2026-09-24.md). Deliberately generous and
// NOT the eventual customer-facing voice allowance — this is only a safety
// valve against a runaway/abusive caller (a stuck retry loop, a scripted
// abuser), not a product limit. A real customer-visible "Jona voice" concept
// comes later, once real cost data justifies specific numbers. Never
// mentions tokens/characters/ElevenLabs in its (rare) rejection message.
const DAILY_CALL_CAP = 300;

async function getTtsUsage(uid) {
  const today = todayJST();
  try {
    const res = await fetch(`${FS_BASE}/users/${uid}/ttsUsage/${today}?key=${FIREBASE_KEY}`);
    if (!res.ok) return { calls: 0, chars: 0 };
    const doc = await res.json();
    return {
      calls: parseInt(doc.fields?.calls?.integerValue ?? "0", 10),
      chars: parseInt(doc.fields?.chars?.integerValue ?? "0", 10),
    };
  } catch {
    return { calls: 0, chars: 0 };
  }
}

async function isKilled(service) {
  try {
    const r = await fetch(`${FS_BASE}/config/killSwitch?key=${FIREBASE_KEY}`);
    if (!r.ok) return false;
    const doc = await r.json();
    const f   = doc.fields ?? {};
    if (f.allEnabled?.booleanValue === false)                    return true;
    if (service && f[`${service}Enabled`]?.booleanValue === false) return true;
    return false;
  } catch { return false; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  if (await isKilled("elevenLabs")) {
    return { statusCode: 503, body: JSON.stringify({ error: "Voice features temporarily paused." }) };
  }

  const API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!API_KEY) return { statusCode: 503, body: "TTS not configured" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad request" }; }

  const uid  = body.uid || body.sso_token;
  if (!uid) return { statusCode: 401, body: "Unauthorized" };

  const text = (body.text || "").replace(/\bJona\b/g, "Jawna").slice(0, MAX_CHARS).trim();
  if (!text) return { statusCode: 400, body: "No text" };

  // Abuse/rate protection (2026-09-24) — generous, per-account. A verified
  // safety reply (safetyToken, see consumeSafetyGrant above) bypasses this
  // specific cap check ONLY — everything else (ElevenLabs call, per-account
  // logging below) is unchanged, and normal Jona text/voice usage for this
  // account remains exactly as limited as before. Ordinary requests never
  // carry a valid token, so this can't become a general bypass.
  let safetyBypass = false;
  const usage = await getTtsUsage(uid);
  if (usage.calls >= DAILY_CALL_CAP) {
    safetyBypass = await consumeSafetyGrant(uid, body.safetyToken);
    if (!safetyBypass) {
      return { statusCode: 429, body: JSON.stringify({ error: "Jona's voice is taking a short break — try again in a moment, or keep typing." }) };
    }
  }

  const VOICE_ID = body.lang === "jp" ? VOICE_ID_JP : VOICE_ID_EN;

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key":   API_KEY,
        "Content-Type": "application/json",
        "Accept":       "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("ElevenLabs error:", res.status, err);
    return { statusCode: res.status, body: "TTS failed" };
  }

  const buf = await res.arrayBuffer();

  // Fire-and-forget: log TTS usage to Firestore for cost tracking — the
  // platform-wide aggregate always (cost visibility matters regardless of
  // path); the per-account cap counter only for NON-safety-bypass calls,
  // symmetric with chat.js never incrementing the text quota for a safety
  // reply — a safety-triggered call must not push this account any closer
  // to its normal voice cap.
  const today = todayJST();
  const costWrites = [
    {
      transform: {
        document: `projects/${PROJECT_ID}/databases/(default)/documents/apiCosts/${today}`,
        fieldTransforms: [
          { fieldPath: "ttsCalls", increment: { integerValue: "1" } },
          { fieldPath: "ttsChars", increment: { integerValue: String(text.length) } },
        ],
      },
    },
  ];
  if (!safetyBypass) {
    costWrites.push({
      transform: {
        document: `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/ttsUsage/${today}`,
        fieldTransforms: [
          { fieldPath: "calls", increment: { integerValue: "1" } },
          { fieldPath: "chars", increment: { integerValue: String(text.length) } },
        ],
      },
    });
  }
  fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit?key=${FIREBASE_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ writes: costWrites }),
  }).catch(() => {});

  return {
    statusCode: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    body: Buffer.from(buf).toString("base64"),
    isBase64Encoded: true,
  };
};
