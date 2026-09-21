// One-time generator for the HSD Family demo's Jona narration audio.
//
// The demo itself never calls ElevenLabs live (see src/familyDemo/JonaBubble.jsx)
// — it plays these pre-rendered static files, falling back to the browser's
// own speechSynthesis if a file is missing or fails to load. Run this once
// (and again whenever JONA_LINES in src/familyDemo/data.js changes) to
// (re)generate them; nothing at demo runtime depends on this script or on
// ELEVENLABS_API_KEY being set.
//
// Usage:
//   ELEVENLABS_API_KEY=sk_... node scripts/generate-family-demo-audio.mjs
//
// Requires Node 18+ (global fetch). Writes one mp3 per JONA_LINES key to
// public/assets/hsd/family/audio/jona-demo/<key>.mp3.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JONA_LINES } from "../src/familyDemo/data.js";

const VOICE_ID = "nzFihrBIvB34imQBuxub"; // Jona's voice — keep in sync with netlify/functions/tts.js
const MODEL_ID = "eleven_turbo_v2";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "assets", "hsd", "family", "audio", "jona-demo");

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("ELEVENLABS_API_KEY is not set. Run:\n  ELEVENLABS_API_KEY=sk_... node scripts/generate-family-demo-audio.mjs");
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  const entries = Object.entries(JONA_LINES);
  console.log(`Generating ${entries.length} audio clips with voice ${VOICE_ID}…`);

  for (const [key, text] of entries) {
    const outPath = path.join(OUT_DIR, `${key}.mp3`);
    process.stdout.write(`  ${key}… `);

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.log(`FAILED (${res.status}) ${err}`);
      continue;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(outPath, buf);
    console.log(`ok (${(buf.length / 1024).toFixed(0)} KB)`);
  }

  console.log(`\nDone. Files written to ${path.relative(process.cwd(), OUT_DIR)}/`);
  console.log("Commit these files, then rebuild/redeploy the demo.");
}

main();
