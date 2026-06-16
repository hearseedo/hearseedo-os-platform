// Cloudflare Pages Function — ElevenLabs TTS proxy
// Daniel voice — deep British male, Jarvis-style

const VOICE_ID  = "onwK4e9ZLuTAKqWW03F9"; // Daniel
const MODEL_ID  = "eleven_monolingual_v1";
const MAX_CHARS = 800; // cap to avoid runaway usage

export async function onRequestPost(context) {
  const { request, env } = context;
  const API_KEY = env.ELEVENLABS_API_KEY;
  if (!API_KEY) return new Response("TTS not configured", { status: 503 });

  let body;
  try { body = await request.json(); }
  catch { return new Response("Bad request", { status: 400 }); }

  const text = (body.text || "").slice(0, MAX_CHARS).trim();
  if (!text) return new Response("No text", { status: 400 });

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
    return new Response("TTS failed", { status: res.status });
  }

  const audio = await res.arrayBuffer();
  return new Response(audio, {
    status: 200,
    headers: {
      "Content-Type":  "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
