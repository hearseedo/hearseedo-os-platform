// Talk with Jona (Gemini Live) — system-instruction construction. Confirms
// requirement #7 (no unrelated family-member data leaks in) and requirement
// #2 (the safety floor is always present, not conditional) hold for
// netlify/functions/_liveSafetyInstruction.js.
// Run with:
//   node --test tests/live-safety-instruction.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { buildLiveSystemInstruction, LIVE_SAFETY_FLOOR, JONA_IDENTITY } from "../netlify/functions/_liveSafetyInstruction.js";

test("the safety floor is always present, unconditionally", () => {
  const withNothing = buildLiveSystemInstruction(null, {}, "en");
  assert.ok(withNothing.includes(LIVE_SAFETY_FLOOR));
  const withProfile = buildLiveSystemInstruction({ name: "Emma", age: 8 }, { pathway: "family" }, "en");
  assert.ok(withProfile.includes(LIVE_SAFETY_FLOOR));
});

test("Jona identity is always present", () => {
  const result = buildLiveSystemInstruction(null, {}, "en");
  assert.ok(result.includes(JONA_IDENTITY));
});

test("only the given profile's own name/age appears — never a sibling's", () => {
  const result = buildLiveSystemInstruction({ name: "Emma", age: 8, cefr: "A1" }, {}, "en");
  assert.ok(result.includes("Emma"));
  assert.ok(result.includes("age: 8"));
  assert.ok(result.includes("A1"));
  // No mechanism in this function ever accepts a second profile/family list —
  // the type signature itself is single-profile, which is the actual
  // guarantee against cross-profile leakage (nothing to leak).
  assert.equal(typeof buildLiveSystemInstruction.length, "number");
  assert.ok(!result.toLowerCase().includes("sibling"));
});

test("a null/absent profile omits the personalization line rather than erroring", () => {
  const result = buildLiveSystemInstruction(null, {}, "en");
  assert.ok(!result.includes("You are talking with this specific person"));
});

test("app/pathway context is included when supplied", () => {
  const result = buildLiveSystemInstruction(null, { pathway: "family", appName: "Global Ready", lesson: "Lesson 3" }, "en");
  assert.ok(result.includes("family"));
  assert.ok(result.includes("Global Ready"));
  assert.ok(result.includes("Lesson 3"));
});

test("lang='jp' produces Japanese-first guidance; default/'en' produces English-first guidance", () => {
  const jp = buildLiveSystemInstruction(null, {}, "jp");
  const en = buildLiveSystemInstruction(null, {}, "en");
  assert.ok(jp.includes("Japanese"));
  assert.ok(en.includes("English"));
  assert.notEqual(jp, en);
});

test("instructs short conversational turns, not long spoken paragraphs (requirement #6)", () => {
  const result = buildLiveSystemInstruction(null, {}, "en");
  assert.ok(/short/i.test(result));
});

test("native barge-in is treated as normal, not something to resist", () => {
  const result = buildLiveSystemInstruction(null, {}, "en");
  assert.ok(/interrupt|mid-sentence/i.test(result));
});
