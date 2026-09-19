// One-off local script — NOT deployed, NOT imported by the app, NOT run at
// build/runtime. Generates static ElevenLabs character-voice MP3s for a
// single MTAU lesson's "hear" dialogue, using the locked, approved voice
// map. Run manually, once, per lesson you want to generate:
//
//   ELEVENLABS_API_KEY=$(cat ~/.elevenlabs_key) node scripts/generate-mtau-lesson1-audio.mjs
//
// The API key is read from the environment only — it is never written to
// any file this script produces, never logged, and this script is never
// deployed to Netlify. Ordinary staging playback makes zero ElevenLabs API
// calls; this script is the one-time exception that produces the static
// assets playback then reads from disk.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MTAU_LESSON_1_1 } from "../src/family/mtauContent.js";

// Locked, approved voice map (do not substitute or auto-select).
const VOICE_IDS = {
  Milo: "Ho8lEgLAUvibG7H3G3TK",
  Lola: "Nggzl2QAXh3OijoXD116",
  Kiko: "nBoLwpO4PAjQaQwVKPI1",
  Momo: "egdQA558M1sKeWXK6DIf",
  // Student intentionally omitted — stays on browser speechSynthesis.
};
const MODEL_ID = "eleven_turbo_v2";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function synthesize(voiceId, text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${res.status} for voice ${voiceId}: ${errText.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error("ELEVENLABS_API_KEY is not set in this shell's environment. Aborting — nothing generated.");
    process.exit(1);
  }

  const lesson = MTAU_LESSON_1_1;
  const hearStep = lesson.steps.find(s => s.kind === "hear");
  if (!hearStep) throw new Error("Lesson 1 has no 'hear' step — nothing to generate.");

  const bookDir = `book-${lesson.bookId}`;
  const lessonDir = `lesson-${String(lesson.lessonId).padStart(2, "0")}`;
  const outDir = path.join(ROOT, "public", "assets", "hsd", "mtau", "audio", bookDir, lessonDir);
  await mkdir(outDir, { recursive: true });

  console.log(`Generating ${hearStep.dialogue.length} line(s) for Book ${lesson.bookId} Lesson ${lesson.lessonId} ("${lesson.title}")...`);

  const results = [];
  for (let i = 0; i < hearStep.dialogue.length; i++) {
    const { speaker, line } = hearStep.dialogue[i];
    const voiceId = VOICE_IDS[speaker];
    const order = String(i + 1).padStart(2, "0");
    const filename = `${order}-${speaker.toLowerCase()}.mp3`;
    const outPath = path.join(outDir, filename);

    if (!voiceId) {
      console.log(`  skip ${filename} — no locked ElevenLabs voice for speaker "${speaker}" (falls back to browser TTS at runtime)`);
      continue;
    }

    console.log(`  generating ${filename} — ${speaker}: "${line}"`);
    const audioBuffer = await synthesize(voiceId, line);
    await writeFile(outPath, audioBuffer);
    results.push({ filename, speaker, line, bytes: audioBuffer.length });
  }

  console.log("\nDone. Generated files:");
  for (const r of results) {
    console.log(`  ${r.filename} (${r.bytes} bytes) — ${r.speaker}: "${r.line}"`);
  }
  console.log(`\nOutput directory: ${outDir}`);
}

main().catch(err => {
  console.error("Generation failed:", err.message);
  process.exit(1);
});
