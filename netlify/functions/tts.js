// Netlify Function — ElevenLabs TTS proxy
const VOICE_ID = "onwK4e9ZLuTAKqWW03F9"; // Daniel — deep British male
const MODEL_ID = "eleven_monolingual_v1";
const MAX_CHARS = 800;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!API_KEY) return { statusCode: 503, body: "TTS not configured" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad request" }; }

  const text = (body.text || "").slice(0, MAX_CHARS).trim();
  if (!text) return { statusCode: 400, body: "No text" };

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
  return {
    statusCode: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    body: Buffer.from(buf).toString("base64"),
    isBase64Encoded: true,
  };
};
