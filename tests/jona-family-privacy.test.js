// Privacy correction (Phase A/B review, 2026-09-10) — the child's real
// first name must never be interpolated into the Jona Family system prompt
// that gets sent to Gemini. Pure logic, no network — run with:
//   node --test tests/jona-family-privacy.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { buildFamilyJonaPrompt } from "../src/family/jonaFamily.js";

test("privacy: buildFamilyJonaPrompt does not include a real name even when one would previously have been passed", () => {
  const REAL_NAME = "Sakura";
  // Old call sites passed profileName — the function must ignore any such
  // field entirely now, not merely default it when absent.
  const prompt = buildFamilyJonaPrompt({ activityId: "talk-first-hello", ageBand: "elementary", profileName: REAL_NAME });
  assert.ok(!prompt.includes(REAL_NAME), "the child's real name must never appear in the outgoing prompt");
});

test("privacy: the prompt instructs Jona to address the child without a personal name", () => {
  const prompt = buildFamilyJonaPrompt({ activityId: "talk-first-hello", ageBand: "elementary" });
  assert.match(prompt, /without using a personal name/i);
});

test("privacy: prompt generation works normally with no name-related field at all (the common, correct call shape going forward)", () => {
  const prompt = buildFamilyJonaPrompt({ activityId: "talk-first-hello", ageBand: "early_years" });
  assert.ok(prompt.length > 0);
  assert.match(prompt, /friend|champion/i);
});
