// Alternate generator for the HSD Family demo's Jona narration audio —
// calls the app's own already-deployed /api/tts endpoint (the same one
// real users' browsers call) instead of ElevenLabs directly, so no raw
// API key ever needs to be typed into a terminal here. The key stays
// server-side in the Netlify function the whole time.
//
// Usage:
//   node scripts/generate-family-demo-audio-via-api.mjs
//
// Writes one mp3 per JONA_LINES key to
// public/assets/hsd/family/audio/jona-demo/<key>.mp3.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JONA_LINES } from "../src/familyDemo/data.js";

const TTS_URL = "https://app.hsdos.ai/api/tts";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "assets", "hsd", "family", "audio", "jona-demo");

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const entries = Object.entries(JONA_LINES);
  console.log(`Generating ${entries.length} audio clips via ${TTS_URL}…`);

  for (const [key, text] of entries) {
    const outPath = path.join(OUT_DIR, `${key}.mp3`);
    process.stdout.write(`  ${key}… `);

    const res = await fetch(TTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, uid: "family-demo-audio-gen", lang: "en" }),
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
}

main();
