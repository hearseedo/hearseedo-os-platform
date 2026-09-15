// Netlify Function — ElevenLabs TTS proxy
const VOICE_ID_EN  = "BnRBNgpLmN6RYIWw3eEw"; // Jona's voice (English)
const VOICE_ID_JP  = "5FNeYl6NmyAXYQWW7CEV"; // Jona's voice (Japanese only)
const MODEL_ID     = "eleven_turbo_v2";        // faster + cheaper than monolingual_v1
const MAX_CHARS    = 1200;
// Staging-isolation hardening (2026-09-16) — see _firebaseAdmin.js's
// resolveProjectId: fails closed for a real deploy, never silently
// defaults to production.
const { resolveProjectId } = require("./_firebaseAdmin.js");
const PROJECT_ID   = resolveProjectId();
const FIREBASE_KEY = process.env.FIREBASE_API_KEY    || "";
const FS_BASE      = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function todayJST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
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

  // Fire-and-forget: log TTS usage to Firestore for cost tracking
  const today = todayJST();
  fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit?key=${FIREBASE_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      writes: [{ transform: {
        document: `projects/${PROJECT_ID}/databases/(default)/documents/apiCosts/${today}`,
        fieldTransforms: [
          { fieldPath: "ttsCalls", increment: { integerValue: "1" } },
          { fieldPath: "ttsChars", increment: { integerValue: String(text.length) } },
        ],
      }}],
    }),
  }).catch(() => {});

  return {
    statusCode: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    body: Buffer.from(buf).toString("base64"),
    isBase64Encoded: true,
  };
};
