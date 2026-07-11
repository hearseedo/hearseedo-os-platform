// Netlify Function — ElevenLabs TTS proxy for Speak Ready's Listening Lab
// Separate from tts.js so it can carry its own accent-voice map without
// touching that function while it's under active development elsewhere.
// Falls back to the known-working Daniel voice if an accent voice fails.
const DANIEL_VOICE_ID = "onwK4e9ZLuTAKqWW03F9"; // deep British male — already used elsewhere in HSDOS.AI
const MODEL_ID = "eleven_turbo_v2";
const MAX_CHARS = 1200;

// Reasonable ElevenLabs default-library picks. Extend/replace once real
// account voice IDs are confirmed for more accents (Australian, Japanese-English).
const ACCENT_VOICES = {
  american: "21m00Tcm4TlvDq8ikWAM", // Rachel — common ElevenLabs default voice
  british:  DANIEL_VOICE_ID,
};

async function synthesize(voiceId, text) {
  return fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key":   process.env.ELEVENLABS_API_KEY,
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
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!API_KEY) return { statusCode: 503, body: "TTS not configured" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad request" }; }

  const uid = body.uid;
  if (!uid) return { statusCode: 401, body: "Unauthorized" };

  const text = (body.text || "").slice(0, MAX_CHARS).trim();
  if (!text) return { statusCode: 400, body: "No text" };

  const requestedVoiceId = ACCENT_VOICES[body.accent] || DANIEL_VOICE_ID;

  let res = await synthesize(requestedVoiceId, text);

  // Graceful fallback — if the accent voice isn't available on this account, retry with Daniel.
  if (!res.ok && requestedVoiceId !== DANIEL_VOICE_ID) {
    console.error("speak-ready-tts: accent voice failed, falling back to Daniel", body.accent, res.status);
    res = await synthesize(DANIEL_VOICE_ID, text);
  }

  if (!res.ok) {
    const err = await res.text();
    console.error("speak-ready-tts: ElevenLabs error:", res.status, err);
    return { statusCode: res.status, body: "TTS failed" };
  }

  const buf = await res.arrayBuffer();
  return {
    statusCode: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    body: Buffer.from(buf).toString("base64"),
    isBase64Encoded: true,
  };
};
