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
  MTAU_LESSON_1_2, MTAU_LESSON_1_3, MTAU_LESSON_1_4, MTAU_LESSON_1_5, MTAU_LESSON_1_6,
  MTAU_LESSON_1_7, MTAU_LESSON_1_8, MTAU_LESSON_1_9,
  MTAU_LESSON_1_10, MTAU_LESSON_1_11, MTAU_LESSON_1_12,
  getMTAULesson, getMTAUBook, getMigratedLessonIds, getMTAULessonSummary,
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

test("FamilyHome's MTAU recommendation override is additive: it does not touch getRecommendedActivity's own logic and only activates once the profile has actually started MTAU", () => {
  assert.ok(/getMTAUCurrentLesson\(1, mtauBookProgress\)/.test(familyHomeSrc));
  assert.ok(/mtauStarted = mtauBookProgress && Object\.values\(mtauBookProgress\)\.some\(p => p !== null\)/.test(familyHomeSrc), "must require real started progress, not just age-appropriateness, before overriding the normal recommendation");
  const engineSrc = read("src/family/familyProgress.js");
  assert.ok(!/mtau/i.test(engineSrc), "the generic recommendation engine itself must stay untouched by MTAU — the override lives in FamilyHome.jsx only");
});

test("REGRESSION: FamilyHome resets mtauBookProgress before fetching for the new profile, so switching away from an MTAU-eligible profile never leaks their lesson into another profile's recommendation", () => {
  const effectBody = familyHomeSrc.slice(
    familyHomeSrc.indexOf("useEffect(() => {\n    // Reset before fetching"),
    familyHomeSrc.indexOf("}, [user?.uid, profileId, mtauAgeAppropriate]")
  );
  assert.ok(/setMtauBookProgress\(undefined\);\s*\n\s*if \(!user\?\.uid \|\| !mtauAgeAppropriate\) return;/.test(effectBody), "must clear stale state BEFORE the early return, not only inside a branch that a non-eligible profile never reaches");
});

const parentViewSrc = read("src/family/FamilyParentView.jsx");
test("FamilyParentView's MTAU card mirrors the existing Monkey Yoga curriculum card shape (read-only, only shown once started) rather than a new dashboard", () => {
  assert.ok(/getMTAUCurrentLesson\(1, mtauBookProgress\)/.test(parentViewSrc));
  assert.ok(/mtauStarted &&/.test(parentViewSrc), "the card must be conditionally rendered only once the child has real MTAU progress");
  assert.ok(/Monkeys Talk & Unlock/.test(parentViewSrc));
});

test("FamilyParentView's MTAU card shows completed/migrated as a real fraction (not just a raw count) and surfaces confidence when it exists on the same doc", () => {
  assert.ok(/getMigratedLessonIds\(1\)\.length/.test(parentViewSrc), "denominator must be derived from the real migrated-lesson list, not hardcoded");
  assert.ok(/mtauCompletedCount} of {mtauMigratedCount}/.test(parentViewSrc));
  assert.ok(/mtauConfidenceDoc\?\.confidenceBefore/.test(parentViewSrc), "confidence must come from the existing per-lesson doc field, not a new signal");
});

const journeySrc = read("src/family/MTAUJourney.jsx");
test("MTAUJourney itself also gates on ageAppropriate, not just relying on FamilyHome hiding the link", () => {
  assert.ok(/MTAU_MIN_AGE_BANDS\.includes\(currentProfile\.ageBand\)/.test(journeySrc));
  assert.ok(/FamilyError kind="unavailable"/.test(journeySrc), "an underage/wrong-profile visit must fail closed to a friendly error, not crash or leak content");
});

test("MTAUJourney's lesson-status list is data-driven over migratedLessonIds.map, not a fixed Lesson-1-only card", () => {
  assert.ok(/migratedLessonIds\.map\(lessonId =>/.test(journeySrc));
  assert.ok(!/\/family\/mtau\/book\/1\/lesson\/1["'`]/.test(journeySrc), "must not hardcode a link straight to Lesson 1 — navigation must follow the computed current lesson");
});

// ── Book 1 Lesson 1 loading, all 14 steps present ────────────────────────

test("getMTAULesson(1,1..12) returns the real migrated lessons; any other book/lesson returns null (honest, not invented)", () => {
  for (let i = 1; i <= 12; i++) assert.ok(getMTAULesson(1, i), `Lesson ${i} should be migrated`);
  assert.equal(getMTAULesson(1, 13), null, "Lesson 13 is deliberately not migrated this pass");
  assert.equal(getMTAULesson(2, 1), null);
  assert.equal(getMTAULesson(7, 1), null);
});

test("getMTAULesson is a data-driven lookup, not a chain of hardcoded if-checks for specific lesson IDs", () => {
  const src = read("src/family/mtauContent.js");
  const fnBody = src.slice(src.indexOf("export function getMTAULesson"));
  assert.ok(!/if \(bookId === 1 && lessonId === 2\)/.test(fnBody), "must not special-case Lesson 2");
  assert.ok(!/if \(bookId === 1 && lessonId === 3\)/.test(fnBody), "must not special-case Lesson 3");
  assert.ok(/MTAU_LESSON_INDEX\[`\$\{bookId\}-\$\{lessonId\}`\]/.test(fnBody), "must be a single generic index lookup");
});

test("Lesson 1 has exactly the real 14 steps; every kind it uses is part of the shared MTAU_STEP_KINDS vocabulary", () => {
  assert.equal(MTAU_LESSON_1_1.steps.length, 14);
  assert.ok(MTAU_LESSON_1_1.steps.every(s => MTAU_STEP_KINDS.includes(s.kind)));
});

test("Lesson 2 loads with all 14 real steps", () => {
  assert.equal(MTAU_LESSON_1_2.steps.length, 14);
  assert.ok(MTAU_LESSON_1_2.steps.every(s => MTAU_STEP_KINDS.includes(s.kind)), "every step kind Lesson 2 uses must be in the shared vocabulary, not a one-off");
  assert.equal(MTAU_LESSON_1_2.title, "Meet My Friends");
  assert.equal(MTAU_LESSON_1_2.location, "Hisaya-odori Park");
});

test("Lesson 3 loads with all 14 real steps", () => {
  assert.equal(MTAU_LESSON_1_3.steps.length, 14);
  assert.ok(MTAU_LESSON_1_3.steps.every(s => MTAU_STEP_KINDS.includes(s.kind)));
  assert.equal(MTAU_LESSON_1_3.title, "Numbers Everywhere");
  assert.equal(MTAU_LESSON_1_3.location, "Midland Square");
});

test("Lesson 4 loads with all 14 real steps", () => {
  assert.equal(MTAU_LESSON_1_4.steps.length, 14);
  assert.ok(MTAU_LESSON_1_4.steps.every(s => MTAU_STEP_KINDS.includes(s.kind)), "every step kind Lesson 4 uses must be in the shared vocabulary, not a one-off");
  assert.equal(MTAU_LESSON_1_4.title, "My Family");
  assert.equal(MTAU_LESSON_1_4.location, "Noritake Garden");
});

test("Lesson 5 loads with all 14 real steps", () => {
  assert.equal(MTAU_LESSON_1_5.steps.length, 14);
  assert.ok(MTAU_LESSON_1_5.steps.every(s => MTAU_STEP_KINDS.includes(s.kind)));
  assert.equal(MTAU_LESSON_1_5.title, "What's This?");
  assert.equal(MTAU_LESSON_1_5.location, "SCMAGLEV Railway Park");
});

test("Lesson 6 loads with all 14 real steps", () => {
  assert.equal(MTAU_LESSON_1_6.steps.length, 14);
  assert.ok(MTAU_LESSON_1_6.steps.every(s => MTAU_STEP_KINDS.includes(s.kind)));
  assert.equal(MTAU_LESSON_1_6.title, "Colours and Clothes");
  assert.equal(MTAU_LESSON_1_6.location, "Sakae & Oasis 21");
});

test("Lesson 7 loads with all 14 real steps", () => {
  assert.equal(MTAU_LESSON_1_7.steps.length, 14);
  assert.ok(MTAU_LESSON_1_7.steps.every(s => MTAU_STEP_KINDS.includes(s.kind)));
  assert.equal(MTAU_LESSON_1_7.title, "I Like Bananas!");
  assert.equal(MTAU_LESSON_1_7.location, "Osu Shopping Street");
});

test("Lesson 8 loads with all 14 real steps", () => {
  assert.equal(MTAU_LESSON_1_8.steps.length, 14);
  assert.ok(MTAU_LESSON_1_8.steps.every(s => MTAU_STEP_KINDS.includes(s.kind)));
  assert.equal(MTAU_LESSON_1_8.title, "Do You Have It?");
  assert.equal(MTAU_LESSON_1_8.location, "Yanagibashi Market");
});

test("Lesson 9 loads with all 14 real steps", () => {
  assert.equal(MTAU_LESSON_1_9.steps.length, 14);
  assert.ok(MTAU_LESSON_1_9.steps.every(s => MTAU_STEP_KINDS.includes(s.kind)));
  assert.equal(MTAU_LESSON_1_9.title, "At School");
  assert.equal(MTAU_LESSON_1_9.location, "Tsuruma Library");
});

test("Batch 3 (Lessons 7-9) introduced zero new step kinds — every shape (single-choice hear, patternLines see, item_grid, ask_switch, 6-page workbook) already existed from Lesson 6", () => {
  for (const lesson of [MTAU_LESSON_1_7, MTAU_LESSON_1_8, MTAU_LESSON_1_9]) {
    assert.ok(lesson.steps.every(s => MTAU_STEP_KINDS.includes(s.kind)));
  }
  const kindsBeforeBatch3 = new Set(MTAU_LESSON_1_6.steps.map(s => s.kind));
  for (const lesson of [MTAU_LESSON_1_7, MTAU_LESSON_1_8, MTAU_LESSON_1_9]) {
    for (const step of lesson.steps) {
      assert.ok(kindsBeforeBatch3.has(step.kind), `${lesson.title}'s "${step.kind}" step must reuse a kind Lesson 6 already established`);
    }
  }
});

test("Lesson 10 loads with all 14 real steps", () => {
  assert.equal(MTAU_LESSON_1_10.steps.length, 14);
  assert.ok(MTAU_LESSON_1_10.steps.every(s => MTAU_STEP_KINDS.includes(s.kind)));
  assert.equal(MTAU_LESSON_1_10.title, "Everyday Actions");
  assert.equal(MTAU_LESSON_1_10.location, "Meijo Park");
});

test("Lesson 11 loads with all 14 real steps", () => {
  assert.equal(MTAU_LESSON_1_11.steps.length, 14);
  assert.ok(MTAU_LESSON_1_11.steps.every(s => MTAU_STEP_KINDS.includes(s.kind)));
  assert.equal(MTAU_LESSON_1_11.title, "What Time Is It?");
  assert.equal(MTAU_LESSON_1_11.location, "Golden Clock");
});

test("Lesson 12 loads with all 14 real steps", () => {
  assert.equal(MTAU_LESSON_1_12.steps.length, 14);
  assert.ok(MTAU_LESSON_1_12.steps.every(s => MTAU_STEP_KINDS.includes(s.kind)));
  assert.equal(MTAU_LESSON_1_12.title, "Where Is the Monkey?");
  assert.equal(MTAU_LESSON_1_12.location, "Nagoya Castle");
});

test("Batch 4 (Lessons 10-12) introduced zero new step kinds despite three new real 'kind' values on the source (routine/time/place) — every UI shape still reuses Lesson 6's vocabulary", () => {
  const kindsBeforeBatch4 = new Set(MTAU_LESSON_1_6.steps.map(s => s.kind));
  for (const lesson of [MTAU_LESSON_1_10, MTAU_LESSON_1_11, MTAU_LESSON_1_12]) {
    for (const step of lesson.steps) {
      assert.ok(kindsBeforeBatch4.has(step.kind), `${lesson.title}'s "${step.kind}" step must reuse a kind Lesson 6 already established`);
    }
  }
});

test("Lesson 10/11/12 content matches the reference product's own clean RSC config payloads (spot checks, not invented)", () => {
  const hear10 = MTAU_LESSON_1_10.steps.find(s => s.kind === "hear");
  assert.equal(hear10.dialogue[1].line, "I get up, eat breakfast and brush my teeth.");
  assert.equal(MTAU_LESSON_1_10.steps.find(s => s.kind === "workbook").pages, "63–68");

  const hear11 = MTAU_LESSON_1_11.steps.find(s => s.kind === "hear");
  assert.equal(hear11.dialogue[1].line, "It's half past three.");
  const grid11 = MTAU_LESSON_1_11.steps.find(s => s.kind === "item_grid");
  assert.deepEqual(grid11.items.map(i => i.label), ["3 o'clock", "half past 3", "morning", "afternoon", "start", "finish"]);

  const hear12 = MTAU_LESSON_1_12.steps.find(s => s.kind === "hear");
  assert.equal(hear12.dialogue[3].line, "Look! It's under the chair.");
  assert.equal(MTAU_LESSON_1_12.steps.find(s => s.kind === "workbook").readTitle, "My room");
});

test("Lesson 7/8/9 content matches the reference product's own clean RSC config payloads (spot checks, not invented)", () => {
  const hear7 = MTAU_LESSON_1_7.steps.find(s => s.kind === "hear");
  assert.equal(hear7.dialogue.length, 5);
  assert.equal(hear7.dialogue[3].line, "No, I don't. I like pizza.");
  assert.equal(MTAU_LESSON_1_7.steps.find(s => s.kind === "workbook").pages, "45–50");

  const hear8 = MTAU_LESSON_1_8.steps.find(s => s.kind === "hear");
  assert.equal(hear8.dialogue[4].line, "I have one!");
  const grid8 = MTAU_LESSON_1_8.steps.find(s => s.kind === "item_grid");
  assert.deepEqual(grid8.items.map(i => i.label), ["phone", "key", "ticket", "bottle", "umbrella", "lunchbox"]);

  const hear9 = MTAU_LESSON_1_9.steps.find(s => s.kind === "hear");
  assert.equal(hear9.dialogue[1].line, "I study English, math and art.");
  assert.equal(MTAU_LESSON_1_9.steps.find(s => s.kind === "workbook").readTitle, "Yui's school day");
});

test("the new item_grid kind (Batch 2) generalizes three different position-8 activities instead of adding three lesson-specific kinds", () => {
  const grid4 = MTAU_LESSON_1_4.steps.find(s => s.kind === "item_grid");
  const grid5 = MTAU_LESSON_1_5.steps.find(s => s.kind === "item_grid");
  const grid6 = MTAU_LESSON_1_6.steps.find(s => s.kind === "item_grid");
  assert.ok(grid4 && grid5 && grid6, "Lessons 4, 5, and 6 must all reuse item_grid, not separate kinds");
  assert.equal(grid4.items.length, 4);
  assert.equal(grid5.items.length, 6);
  assert.equal(grid6.items.length, 6);
});

test("the 'see' step's interaction shape genuinely differs per lesson but stays one kind (tiles / pronounCards / possessiveCards / articleCards / patternLines)", () => {
  const see1 = MTAU_LESSON_1_1.steps.find(s => s.kind === "see");
  const see2 = MTAU_LESSON_1_2.steps.find(s => s.kind === "see");
  const see4 = MTAU_LESSON_1_4.steps.find(s => s.kind === "see");
  const see5 = MTAU_LESSON_1_5.steps.find(s => s.kind === "see");
  const see6 = MTAU_LESSON_1_6.steps.find(s => s.kind === "see");
  assert.ok(see1.tiles && !see1.pronounCards);
  assert.ok(see2.pronounCards && !see2.tiles);
  assert.ok(see4.possessiveCards);
  assert.ok(see5.articleCards);
  assert.ok(see6.patternLines);
});

test("Lesson 1 content matches what was audited live from the reference product (spot checks, not invented)", () => {
  assert.equal(MTAU_LESSON_1_1.title, "Hello, I'm Milo!");
  assert.equal(MTAU_LESSON_1_1.location, "JR Nagoya Station");
  const hear = MTAU_LESSON_1_1.steps.find(s => s.kind === "hear");
  assert.equal(hear.dialogue[0].line, "Hi! I'm Milo. What's your name?");
  assert.equal(hear.dialogue[1].line, "Hello! My name is Lola.");
  const workbook = MTAU_LESSON_1_1.steps.find(s => s.kind === "workbook");
  assert.equal(workbook.pages, "9–13");
  assert.equal(workbook.completionRequirement, "self_report_only", "workbook completion must never claim to be auto-detected/synced");
});

test("Lesson 2/3 content matches what was extracted directly from the compiled bundle source (spot checks, not invented)", () => {
  const hear2 = MTAU_LESSON_1_2.steps.find(s => s.kind === "hear");
  assert.equal(hear2.dialogue[0].line, "Kiko, this is my friend Lola.");
  assert.equal(MTAU_LESSON_1_2.steps.find(s => s.kind === "workbook").pages, "15–20");

  const hear3 = MTAU_LESSON_1_3.steps.find(s => s.kind === "hear");
  assert.equal(hear3.dialogue[1].line, "I'm ten. How old are you?");
  assert.equal(MTAU_LESSON_1_3.steps.find(s => s.kind === "workbook").pages, "21–26");
  const numberHunt = MTAU_LESSON_1_3.steps.find(s => s.kind === "number_hunt");
  assert.deepEqual(numberHunt.items, [
    { n: 3, label: "cards" }, { n: 5, label: "lights" }, { n: 8, label: "pencils" }, { n: 9, label: "balloons" },
  ]);
});

test("Lesson 4/5 content matches what was extracted directly from the compiled bundle source (spot checks, not invented)", () => {
  const hear4 = MTAU_LESSON_1_4.steps.find(s => s.kind === "hear");
  assert.equal(hear4.dialogue[2].line, "She is my sister. Her name is Mei.");
  assert.equal(MTAU_LESSON_1_4.steps.find(s => s.kind === "workbook").pages, "27–32");
  const familyMap = MTAU_LESSON_1_4.steps.find(s => s.kind === "item_grid");
  assert.deepEqual(familyMap.items, [
    { label: "Mother", sublabel: "Her name is _____." },
    { label: "Father", sublabel: "His name is _____." },
    { label: "Sister", sublabel: "Her name is _____." },
    { label: "Brother", sublabel: "His name is _____." },
  ]);

  const hear5 = MTAU_LESSON_1_5.steps.find(s => s.kind === "hear");
  assert.equal(hear5.dialogue[1].line, "It's a notebook.");
  assert.equal(MTAU_LESSON_1_5.steps.find(s => s.kind === "workbook").pages, "33–38");
  const objectLab = MTAU_LESSON_1_5.steps.find(s => s.kind === "item_grid");
  assert.deepEqual(objectLab.items.map(i => i.label), ["a book", "a notebook", "a pencil", "an eraser", "a ruler", "a computer"]);
});

test("Lesson 6 content matches the reference product's own clean RSC config payload (fetched directly, not inferred from a compiled switch)", () => {
  const hear6 = MTAU_LESSON_1_6.steps.find(s => s.kind === "hear");
  assert.equal(hear6.dialogue.length, 5);
  assert.equal(hear6.dialogue[1].line, "It's a cool pink jacket.");
  assert.equal(MTAU_LESSON_1_6.steps.find(s => s.kind === "workbook").pages, "39–44");
  const missionLab = MTAU_LESSON_1_6.steps.find(s => s.kind === "item_grid");
  assert.deepEqual(missionLab.items.map(i => i.label), ["red shirt", "blue trousers", "green hat", "white shoes", "pink jacket", "yellow skirt"]);
  const askSwitch6 = MTAU_LESSON_1_6.steps.find(s => s.kind === "ask_switch");
  assert.deepEqual(askSwitch6.characterPair, ["Milo", "Lola"]);
});

test("MTAU_BOOK_1_LESSON_SUMMARY (all 18) matches the structured source extracted from the reference product's own compiled bundle", () => {
  const l4 = getMTAULessonSummary(1, 4);
  assert.deepEqual(l4, { lessonId: 4, title: "My Family", place: "Noritake Garden", pages: "27–32", canDo: "Name family members and show who belongs to whom" });
  const l18 = getMTAULessonSummary(1, 18);
  assert.equal(l18.title, "Review and Unlock Celebration");
  assert.equal(l18.place, "Mirai Tower");
  assert.equal(getMTAULessonSummary(2, 1), null, "only Book 1's summary has been extracted/validated so far — honest, not invented for other books");
});

test("lesson-to-lesson navigation chain matches the real source through Lesson 12: L1->Hisaya-odori Park, L2->Midland Square, L3->Noritake Garden, L4->SCMAGLEV Railway Park, L5->Sakae & Oasis 21, L6->Osu Shopping Street, L7->Yanagibashi Market, L8->Tsuruma Library, L9->Meijo Park, L10->Golden Clock, L11->Nagoya Castle, L12->Higashiyama Zoo (L13, not yet migrated)", () => {
  assert.equal(MTAU_LESSON_1_1.nextDestination, "Hisaya-odori Park");
  assert.equal(MTAU_LESSON_1_2.nextDestination, "Midland Square");
  assert.equal(MTAU_LESSON_1_3.nextDestination, "Noritake Garden");
  assert.equal(MTAU_LESSON_1_4.nextDestination, "SCMAGLEV Railway Park");
  assert.equal(MTAU_LESSON_1_5.nextDestination, "Sakae & Oasis 21");
  assert.equal(MTAU_LESSON_1_6.nextDestination, "Osu Shopping Street");
  assert.equal(MTAU_LESSON_1_7.nextDestination, "Yanagibashi Market");
  assert.equal(MTAU_LESSON_1_8.nextDestination, "Tsuruma Library");
  assert.equal(MTAU_LESSON_1_9.nextDestination, "Meijo Park");
  assert.equal(MTAU_LESSON_1_10.nextDestination, "Golden Clock");
  assert.equal(MTAU_LESSON_1_11.nextDestination, "Nagoya Castle");
  assert.equal(MTAU_LESSON_1_12.nextDestination, "Higashiyama Zoo");
});

test("getMTAULessonSummary(1, 13) matches MTAU_LESSON_1_12's real nextDestination — Lesson 13's summary is validated even though its full content isn't migrated yet", () => {
  const l13 = getMTAULessonSummary(1, 13);
  assert.equal(l13.place, "Higashiyama Zoo");
  assert.equal(l13.title, "My Pets and Animals");
  assert.equal(getMTAULesson(1, 13), null, "Lesson 13 must not be reachable until it is actually deep-migrated");
});

// ── Step progression / current-step resume (data-layer contract) ────────

const lessonSrc = read("src/family/MTAULesson.jsx");
test("MTAULesson resumes from the persisted currentStep, not always step 0", () => {
  assert.ok(/setStepIndex\(p\.completed \? lesson\.steps\.length - 1 : \(p\.currentStep \?\? 0\)\)/.test(lessonSrc));
});
test("every step advance calls recordMTAUStep so progress survives refresh/navigation", () => {
  assert.ok(/recordMTAUStep\(user\.uid, profileId, bookId, lessonId, nextIndex, newCompleted\)/.test(lessonSrc));
});

// ── Confidence before/after persistence (Phase 10) ───────────────────────

test("confidenceBefore/confidenceAfter are written onto the SAME per-lesson progress doc via recordMTAUConfidence, not a separate collection/function", () => {
  const progressSrc = read("src/family/mtauProgress.js");
  assert.ok(/export async function recordMTAUConfidence\(uid, profileId, bookId, lessonId, phase, value\)/.test(progressSrc));
  const fnBody = progressSrc.slice(progressSrc.indexOf("export async function recordMTAUConfidence"));
  assert.ok(/doc\(db, \.\.\.progressCollectionPath\(uid, profileId\), mtauDocId\(bookId, lessonId\)\)/.test(fnBody), "must reuse the exact same doc ref helper as step/completion writes");
  assert.ok(/\{ merge: true \}/.test(fnBody), "must merge onto the existing doc, not overwrite it");
  assert.ok(!/collection\(db, "confidence"|"mtauConfidence"/.test(progressSrc), "must not introduce a separate confidence collection");
});

test("MTAULesson persists confidence immediately when the learner picks a rating, and hydrates it back on resume", () => {
  assert.ok(/recordMTAUConfidence\(user\.uid, profileId, bookId, lessonId, phase, value\)/.test(lessonSrc), "must persist on selection, not just at lesson completion");
  assert.ok(/setConfidenceBefore\(p\.confidenceBefore \?\? null\)/.test(lessonSrc));
  assert.ok(/setConfidenceAfter\(p\.confidenceAfter \?\? null\)/.test(lessonSrc));
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

// ── Lesson completion / current+next lesson recommendation ──────────────

test("getMTAUCurrentLesson is generic (derives migrated lesson ids from getMigratedLessonIds), not hardcoded to Lesson 1/2 specifically", () => {
  const progressSrc = read("src/family/mtauProgress.js");
  const fnBody = progressSrc.slice(progressSrc.indexOf("export function getMTAUCurrentLesson"));
  assert.ok(/getMigratedLessonIds\(bookId\)/.test(fnBody), "must derive the migrated lesson list generically, not hardcode lesson numbers");
  assert.ok(!/lessonId: 2/.test(fnBody) && !/lessonId: 1,/.test(fnBody), "must not hardcode specific lesson numbers in the logic itself");
});

test("getMigratedLessonIds(1) returns exactly [1..12] — derived from the real data index, not a separately maintained list", () => {
  assert.deepEqual(getMigratedLessonIds(1), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test("progression logic: walks migrated lessons in order, returns the first incomplete one as current, and (last migrated + 1) as the honestly-unavailable next lesson once all are complete", () => {
  const progressSrc = read("src/family/mtauProgress.js");
  const fnBody = progressSrc.slice(
    progressSrc.indexOf("export function getMTAUCurrentLesson"),
    progressSrc.indexOf("export function getMTAUCurrentLesson") + 900
  );
  assert.ok(/for \(const lessonId of migratedIds\)/.test(fnBody), "must iterate the real migrated list, not a fixed range");
  assert.ok(/if \(!p \|\| !p\.completed\)/.test(fnBody), "an unstarted or incomplete lesson must be returned as current");
  assert.ok(/available: true/.test(fnBody));
  assert.ok(/migratedIds\[migratedIds\.length - 1\] \+ 1/.test(fnBody), "the lesson after the last migrated one must be computed, not hardcoded");
  assert.ok(/available: false/.test(fnBody), "a lesson beyond what's migrated must be honestly marked unavailable");
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
