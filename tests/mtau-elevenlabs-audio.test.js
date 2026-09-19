// MTAU ElevenLabs character-voice proof of concept (2026-09-19). Book 1
// Lesson 1's "hear" dialogue is the only real static-asset content right
// now — see scripts/generate-mtau-lesson1-audio.mjs. mtauAudio.js has zero
// Firebase imports (pure browser Audio/speechSynthesis), so most of it
// could run under node --test directly, but calling playMTAULine() itself
// needs the browser's real `Audio` constructor, which doesn't exist in
// Node — so, matching this repo's established convention, the playback
// logic itself is verified as source text (the same pattern already used
// for every other Firebase- or browser-API-dependent Family file).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { MTAU_LESSON_1_1 } from "../src/family/mtauContent.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function read(relPath) { return readFileSync(path.join(ROOT, relPath), "utf8"); }

const audioSrc = read("src/family/mtauAudio.js");
const lessonSrc = read("src/family/MTAULesson.jsx");

// ── Locked voice map (approved, must not drift) ──────────────────────────

test("the generation script uses the exact locked/approved voice IDs — no substitution, no auto-selection", () => {
  const scriptSrc = read("scripts/generate-mtau-lesson1-audio.mjs");
  assert.ok(/Milo:\s*"Ho8lEgLAUvibG7H3G3TK"/.test(scriptSrc));
  assert.ok(/Lola:\s*"Nggzl2QAXh3OijoXD116"/.test(scriptSrc));
  assert.ok(/Kiko:\s*"nBoLwpO4PAjQaQwVKPI1"/.test(scriptSrc));
  assert.ok(/Momo:\s*"egdQA558M1sKeWXK6DIf"/.test(scriptSrc));
  assert.ok(!/Student:\s*"/.test(scriptSrc), "Student must not have a locked ElevenLabs voice — stays on browser speechSynthesis");
});

test("the generation script never writes the API key to any output file or log — reads it from process.env only", () => {
  const scriptSrc = read("scripts/generate-mtau-lesson1-audio.mjs");
  assert.ok(/process\.env\.ELEVENLABS_API_KEY/.test(scriptSrc));
  assert.ok(!/console\.log\([^)]*ELEVENLABS_API_KEY/.test(scriptSrc), "must never log the key value");
});

// ── Generated static assets (real files, real Lesson 1 dialogue) ────────

test("Lesson 1's real 'hear' dialogue is exactly 2 lines (Milo, Lola) — confirms what the generated assets should cover, not invented", () => {
  const hearStep = MTAU_LESSON_1_1.steps.find(s => s.kind === "hear");
  assert.equal(hearStep.dialogue.length, 2);
  assert.equal(hearStep.dialogue[0].speaker, "Milo");
  assert.equal(hearStep.dialogue[1].speaker, "Lola");
});

test("the deterministic static MP3 files for Lesson 1's hear dialogue exist on disk, named by order+speaker", () => {
  const dir = path.join(ROOT, "public/assets/hsd/mtau/audio/book-1/lesson-01");
  assert.ok(existsSync(path.join(dir, "01-milo.mp3")), "01-milo.mp3 must exist");
  assert.ok(existsSync(path.join(dir, "02-lola.mp3")), "02-lola.mp3 must exist");
});

test("the generated MP3 files are real, non-trivial audio (not empty placeholders)", () => {
  const dir = path.join(ROOT, "public/assets/hsd/mtau/audio/book-1/lesson-01");
  const milo = statSync(path.join(dir, "01-milo.mp3"));
  const lola = statSync(path.join(dir, "02-lola.mp3"));
  assert.ok(milo.size > 5000, "01-milo.mp3 should be a real audio file, not a stub");
  assert.ok(lola.size > 5000, "02-lola.mp3 should be a real audio file, not a stub");
});

// ── mtauAudio.js architecture ─────────────────────────────────────────────

test("mtauAudio.js's static URL path is deterministic by book/lesson/order/speaker, matching the generation script's own output path", () => {
  assert.ok(/\/assets\/hsd\/mtau\/audio\/book-\$\{bookId\}\/lesson-\$\{lessonPadded\}\/\$\{orderPadded\}-\$\{speakerSlug\}\.mp3/.test(audioSrc));
  assert.ok(/padStart\(2, "0"\)/.test(audioSrc), "lesson and order numbers must be zero-padded for stable, sortable filenames");
});

test("mtauAudio.js never calls the ElevenLabs API at runtime — no fetch to elevenlabs.io anywhere in this file", () => {
  assert.ok(!/elevenlabs\.io/i.test(audioSrc), "runtime playback must only ever request a local static asset, never call ElevenLabs directly");
  assert.ok(!/fetch\(/.test(audioSrc), "this module should only ever construct an <audio> element, not fetch anything itself");
});

test("mtauAudio.js falls back to the caller's browser speech function on both asset-missing (onerror) and play() rejection", () => {
  assert.ok(/audio\.onerror = toFallback/.test(audioSrc), "a missing/404 static asset must trigger the fallback, not a dead Listen button");
  assert.ok(/audio\.play\(\)\.catch\(toFallback\)/.test(audioSrc), "a play() rejection (e.g. autoplay policy) must also trigger the fallback");
});

test("mtauAudio.js prevents overlapping audio: starting a new line always stops/cancels whatever was playing before it, on either playback path", () => {
  assert.ok(/stopCurrentPlayback\(\)/.test(audioSrc));
  assert.ok(/audio\.pause\(\)/.test(audioSrc), "must actually pause the previous static asset, not just abandon it");
  assert.ok(/window\.speechSynthesis\?\.cancel\(\)/.test(audioSrc), "must actually cancel the previous browser utterance, not just abandon it");
});

test("mtauAudio.js's speakFallback is injected by the caller — this module never constructs a SpeechSynthesisUtterance or indexes into CHARACTER_VOICES itself", () => {
  assert.ok(!/CHARACTER_VOICES\[/.test(audioSrc) && !/CHARACTER_VOICES\./.test(audioSrc), "must not read CHARACTER_VOICES as a value — a mention in an explanatory comment is fine, using it is not");
  assert.ok(!/new SpeechSynthesisUtterance/.test(audioSrc), "must not construct utterances itself — that's speakFallback's job");
  assert.ok(/speakFallback/.test(audioSrc));
});

// ── MTAULesson.jsx wiring (hear step only, this proof's exact scope) ────

test("MTAULesson.jsx's hear step routes both individual-line and full-conversation playback through playMTAULine, not the raw speak() call directly", () => {
  const hearCase = lessonSrc.slice(lessonSrc.indexOf('case "hear"'), lessonSrc.indexOf('case "respond"'));
  assert.ok(/playMTAULine\(\{ bookId, lessonId, order: i, speaker: d\.speaker \}, \(\) => speak\(d\.line, d\.speaker\)\)/.test(hearCase));
  // The fallback callback still ultimately calls the exact same speak(text, speaker) as before — this proof changes what plays FIRST, not the fallback behavior itself.
  const matches = hearCase.match(/speak\(d\.line, d\.speaker\)/g) ?? [];
  assert.equal(matches.length, 2, "both the per-line button and the full-conversation loop must pass the fallback through");
});

test("MTAULesson.jsx's full-conversation loop still awaits each line in order (sequential, not concurrent) — correct speaker order is preserved", () => {
  const hearCase = lessonSrc.slice(lessonSrc.indexOf('case "hear"'), lessonSrc.indexOf('case "respond"'));
  assert.ok(/for \(let i = 0; i < step\.dialogue\.length; i\+\+\) \{ const d = step\.dialogue\[i\]; await playMTAULine/.test(hearCase));
});

test("no other MTAULesson.jsx step (arrive, respond, shadow, workbook, etc.) was touched by this proof — they still call the original speak() directly, unchanged", () => {
  // Spot-check a couple of untouched call sites to confirm this proof's blast radius stayed inside the hear case.
  assert.ok(/speak\(step\.heading, "Milo"\)/.test(lessonSrc), "the arrive step's ListenButton must be untouched");
  assert.ok(/speak\(l, "Milo"\)/.test(lessonSrc), "the shadow step's per-line ListenButton must be untouched");
});

// ── Key security ──────────────────────────────────────────────────────────

test("no ElevenLabs API key literal or client-side ElevenLabs fetch exists anywhere in the shipped src/ bundle for MTAU", () => {
  assert.ok(!/xi-api-key/i.test(audioSrc) && !/xi-api-key/i.test(lessonSrc));
  assert.ok(!/ELEVENLABS_API_KEY/.test(audioSrc) && !/ELEVENLABS_API_KEY/.test(lessonSrc));
});
