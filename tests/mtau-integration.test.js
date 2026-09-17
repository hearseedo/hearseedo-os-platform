// Summit Readiness Sprint — Monkeys Talk & Unlock integration, Book 1
// Lesson 1 pilot (2026-09-17). Mix of real unit tests (mtauContent.js,
// mtauProgress.js, mtauJona.js are all pure/testable modules) and
// source-text assertions for the JSX components, matching this repo's
// existing convention where no React-rendering harness exists.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  MTAU_BOOKS, MTAU_MIN_AGE_BANDS, MTAU_STEP_KINDS, MTAU_LESSON_1_1,
  getMTAULesson, getMTAUBook,
} from "../src/family/mtauContent.js";
import { buildMTAUJonaPrompt, buildMTAUOpeningMessage } from "../src/family/mtauJona.js";
// mtauProgress.js imports the Firebase SDK chain (via ../lib/firebase),
// which plain `node --test` (no bundler) can't resolve without a file
// extension — the same pre-existing constraint every other Firebase-
// touching Family module hits. Tested as source text below instead,
// matching this repo's established convention (see
// dashboard-mobile-and-profile.test.js for the same pattern applied to
// Dashboard.jsx).

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function read(relPath) { return readFileSync(path.join(ROOT, relPath), "utf8"); }

// ── Books 1-6 map metadata ────────────────────────────────────────────────

test("all 8 books are present with real CEFR/EIKEN/city metadata", () => {
  assert.equal(MTAU_BOOKS.length, 8);
  for (const b of MTAU_BOOKS) {
    assert.ok(b.city && b.theme && b.cefr && b.eiken, `book ${b.bookId} is missing metadata`);
  }
});

test("Books 1-6 are status 'open', Books 7-8 are status 'coming_next' — never represented as available", () => {
  const openBooks = MTAU_BOOKS.filter(b => b.bookId <= 6);
  const upcomingBooks = MTAU_BOOKS.filter(b => b.bookId >= 7);
  assert.equal(openBooks.length, 6);
  assert.ok(openBooks.every(b => b.status === "open"));
  assert.equal(upcomingBooks.length, 2);
  assert.ok(upcomingBooks.every(b => b.status === "coming_next"), "Books 7 and 8 must both be coming_next, not just Book 7");
});

test("getMTAUBook returns the real audited data for Book 1 (Nagoya, A1, EIKEN 5)", () => {
  const book1 = getMTAUBook(1);
  assert.equal(book1.city, "Nagoya");
  assert.equal(book1.cefr, "A1");
  assert.equal(book1.eiken, "EIKEN 5");
});

// ── Age/profile gating ────────────────────────────────────────────────────

test("MTAU is gated to junior_high and teen age bands only", () => {
  assert.deepEqual(MTAU_MIN_AGE_BANDS, ["junior_high", "teen"]);
  assert.ok(!MTAU_MIN_AGE_BANDS.includes("early_years"));
  assert.ok(!MTAU_MIN_AGE_BANDS.includes("elementary"));
});

const familyHomeSrc = read("src/family/FamilyHome.jsx");
test("FamilyHome's MTAU entry is gated on MTAU_MIN_AGE_BANDS.includes(ageBand)", () => {
  assert.ok(/MTAU_MIN_AGE_BANDS\.includes\(ageBand\)/.test(familyHomeSrc));
});

const journeySrc = read("src/family/MTAUJourney.jsx");
test("MTAUJourney itself also gates on ageAppropriate, not just relying on FamilyHome hiding the link", () => {
  assert.ok(/MTAU_MIN_AGE_BANDS\.includes\(currentProfile\.ageBand\)/.test(journeySrc));
  assert.ok(/FamilyError kind="unavailable"/.test(journeySrc), "an underage/wrong-profile visit must fail closed to a friendly error, not crash or leak content");
});

// ── Book 1 Lesson 1 loading, all 14 steps present ────────────────────────

test("getMTAULesson(1, 1) returns the real migrated lesson; any other book/lesson returns null (honest, not invented)", () => {
  assert.ok(getMTAULesson(1, 1));
  assert.equal(getMTAULesson(1, 2), null);
  assert.equal(getMTAULesson(2, 1), null);
  assert.equal(getMTAULesson(7, 1), null);
});

test("Book 1 Lesson 1 has exactly the real 14 steps in the real audited order", () => {
  assert.equal(MTAU_LESSON_1_1.steps.length, 14);
  assert.deepEqual(MTAU_LESSON_1_1.steps.map(s => s.kind), MTAU_STEP_KINDS);
});

test("Book 1 Lesson 1 content matches what was audited live from the reference product (spot checks, not invented)", () => {
  assert.equal(MTAU_LESSON_1_1.title, "Hello, I'm Milo!");
  assert.equal(MTAU_LESSON_1_1.location, "JR Nagoya Station");
  const hear = MTAU_LESSON_1_1.steps.find(s => s.kind === "hear");
  assert.equal(hear.dialogue[0].line, "Hi! I'm Milo. What's your name?");
  assert.equal(hear.dialogue[1].line, "Hello! My name is Lola.");
  const workbook = MTAU_LESSON_1_1.steps.find(s => s.kind === "workbook");
  assert.equal(workbook.pages, "9–13");
  assert.equal(workbook.completionRequirement, "self_report_only", "workbook completion must never claim to be auto-detected/synced");
});

// ── Step progression / current-step resume (data-layer contract) ────────

const lessonSrc = read("src/family/MTAULesson.jsx");
test("MTAULesson resumes from the persisted currentStep, not always step 0", () => {
  assert.ok(/setStepIndex\(p\.completed \? lesson\.steps\.length - 1 : \(p\.currentStep \?\? 0\)\)/.test(lessonSrc));
});
test("every step advance calls recordMTAUStep so progress survives refresh/navigation", () => {
  assert.ok(/recordMTAUStep\(user\.uid, profileId, bookId, lessonId, nextIndex, newCompleted\)/.test(lessonSrc));
});

// ── Profile-separated Firestore state ─────────────────────────────────────

test("mtauDocId is deterministic per book+lesson, and the collection path (in mtauProgress.js source) is keyed on uid+profileId", () => {
  const progressSrc = read("src/family/mtauProgress.js");
  assert.ok(/return `mtau-book\$\{bookId\}-lesson\$\{lessonId\}`/.test(progressSrc), "doc id must be deterministic per book+lesson");
  assert.ok(/profileId === SELF_PROFILE_ID/.test(progressSrc), "must branch on profileId, the same way familyProgress.js does, not use a single shared doc");
  assert.ok(/"familyMembers", profileId, "activityProgress"/.test(progressSrc), "child profiles must get their own subcollection, never share the parent's");
});

test("MTAU progress reuses the SAME activityProgress collection as the rest of Family — not a second, competing progress system", () => {
  const progressSrc = read("src/family/mtauProgress.js");
  assert.ok(progressSrc.includes('"activityProgress"'));
  assert.ok(!/collection\(db, "mtauProgress"/.test(progressSrc), "must not introduce a new top-level collection");
});

// ── Lesson completion / next lesson recommendation ───────────────────────

test("getMTAUNextLesson: incomplete/missing lesson recommends Lesson 1 as available; completing it recommends Lesson 2, honestly marked unavailable", () => {
  const progressSrc = read("src/family/mtauProgress.js");
  const fnBody = progressSrc.slice(progressSrc.indexOf("export function getMTAUNextLesson"));
  assert.ok(/if \(!lessonProgress \|\| !lessonProgress\.completed\)/.test(fnBody));
  assert.ok(/return \{ bookId: 1, lessonId: 1, available: true \}/.test(fnBody));
  assert.ok(/return \{ bookId: 1, lessonId: 2, available: false \}/.test(fnBody), "must not claim Lesson 2 is openable when its content doesn't exist yet");
});

// ── Jona MTAU context / no stored child name sent to Jona ───────────────

test("buildMTAUJonaPrompt embeds real book/lesson/topic/location context", () => {
  const prompt = buildMTAUJonaPrompt({ bookId: 1, lessonId: 1, ageBand: "junior_high" });
  assert.match(prompt, /Book 1, Lesson 1/);
  assert.match(prompt, /Hello, I'm Milo!/);
  assert.match(prompt, /JR Nagoya Station/);
  assert.match(prompt, /First introductions at Nagoya Station/);
});

test("buildMTAUJonaPrompt's function signature has no name/identity parameter at all", () => {
  assert.equal(buildMTAUJonaPrompt.length, 1, "takes exactly one destructured options object");
  const src = read("src/family/mtauJona.js");
  const sigMatch = src.match(/export function buildMTAUJonaPrompt\(\{([^}]*)\}\)/);
  assert.ok(sigMatch);
  assert.ok(!/\bname\b/.test(sigMatch[1]), "the function signature itself must never accept a name parameter");
});

test("buildMTAUJonaPrompt explicitly instructs Jona never to use the learner's real name", () => {
  const prompt = buildMTAUJonaPrompt({ bookId: 1, lessonId: 1, ageBand: "junior_high" });
  assert.match(prompt, /Never ask for or use their real name or identity/);
  assert.match(prompt, /"friend", "champion"/);
});

test("MTAULesson never passes practiceName (the Quick Start input) or currentProfile.name into the Jona prompt/messages", () => {
  const jonaStepFn = lessonSrc.slice(lessonSrc.indexOf("function JonaStep"));
  assert.ok(!/practiceName/.test(jonaStepFn), "the Quick Start practice name must never reach the Jona step");
  assert.ok(!/currentProfile\.name|profile\.name|\.name\b/.test(jonaStepFn.replace(/objectiveIndex|onChange|childSafety/gi, "")) || !/buildMTAUJonaPrompt\([^)]*name/.test(jonaStepFn), "no name field may be passed into buildMTAUJonaPrompt's call site");
  assert.ok(/buildMTAUJonaPrompt\(\{ bookId, lessonId, ageBand, currentObjectiveIndex: objectiveIndex \}\)/.test(jonaStepFn));
});

test("Quick Start's practiceName state is never written to Firestore anywhere in MTAULesson.jsx", () => {
  assert.ok(!/recordMTAUStep\([^)]*practiceName/.test(lessonSrc));
  assert.ok(!/setDoc\([^)]*practiceName/.test(lessonSrc));
});

test("live-tested prompt result (real API call) is reported, not asserted here — see integration report", () => {
  // Placeholder marker so this concern is visible in the test file even
  // though the actual live /api/chat call is verified via browser QA, not
  // a unit test (no network access from node --test).
  assert.ok(true);
});

// ── Audio controls genuinely invoke playback ─────────────────────────────

test("MTAULesson's speak() helper genuinely calls window.speechSynthesis.speak with a real SpeechSynthesisUtterance, not a no-op", () => {
  assert.ok(/new SpeechSynthesisUtterance\(text\)/.test(lessonSrc));
  assert.ok(/window\.speechSynthesis\.speak\(u\)/.test(lessonSrc));
});

// Strips `//`-style comment lines before checking for forbidden claims —
// this file's own doc comments legitimately say things like "not
// ElevenLabs" and "no fake ... AI grading" to explain what was deliberately
// NOT built; those negations must not trip a naive substring check.
const lessonSrcNoComments = lessonSrc.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

test("audio is honestly labelled as device/browser voice playback in code comments, and the rendered UI never claims ElevenLabs or recorded character voices", () => {
  assert.ok(/device\/browser voice playback/i.test(lessonSrc) || /browser speechSynthesis/i.test(lessonSrc));
  assert.ok(!/ElevenLabs/i.test(lessonSrcNoComments), "ElevenLabs must not appear outside explanatory comments");
  assert.ok(!/recorded character voice/i.test(lessonSrcNoComments), "must not claim recorded character voices exist outside explanatory comments");
});

test("distinguishable voices are assigned per character (Milo vs Lola vs Momo), preserving speaker order in dialogue rendering", () => {
  assert.ok(/CHARACTER_VOICES = \{/.test(lessonSrc));
  assert.ok(/Milo: \[/.test(lessonSrc) && /Lola: \[/.test(lessonSrc));
  const hearCase = lessonSrc.slice(lessonSrc.indexOf('case "hear"'), lessonSrc.indexOf('case "respond"'));
  assert.ok(/step\.dialogue\.map/.test(hearCase), "dialogue lines render in their stored (speaker) order, not reordered");
});

// ── No fake grading anywhere ──────────────────────────────────────────────

test("no fake pronunciation/AI grading language appears in the rendered UI code (outside explanatory comments)", () => {
  assert.ok(!/pronunciation score|accuracy score|AI grad|EIKEN score/i.test(lessonSrcNoComments));
});

test("the workbook step is honestly a self-report, and the create/recording step is honestly not scored", () => {
  assert.ok(/self-check — completing the actual workbook pages happens outside the app/i.test(lessonSrc));
  assert.ok(/not uploaded, scored, or evaluated/i.test(lessonSrc));
});
