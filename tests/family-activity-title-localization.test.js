// Summit Readiness Sprint 1, Priority 4 (2026-09-17) — HSD Family activity
// titles must render in Japanese (titleJp) when Japanese is active, falling
// back to English when titleJp is missing. localizedTitle() is a real,
// pure function (unlike most Family UI tests in this repo, which read JSX
// source as text because there's no React-rendering harness) — it's
// exported from content.js specifically so it can be unit-tested directly.
// Run with:
//   node --test tests/family-activity-title-localization.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { localizedTitle, ALL_ACTIVITIES, getActivity } from "../src/family/content.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function read(relPath) {
  return readFileSync(path.join(ROOT, relPath), "utf8");
}

// ── localizedTitle(): the pure rendering rule ────────────────────────────

test("English active always renders the English title, even when titleJp exists", () => {
  const activity = getActivity("hear-hello-song");
  assert.equal(localizedTitle(activity, "en"), "Hello Song");
});

test("Japanese active renders titleJp when it exists", () => {
  const activity = getActivity("hear-hello-song");
  assert.equal(localizedTitle(activity, "jp"), "ハローソング");
});

test("Japanese active falls back to the English title when titleJp is missing", () => {
  const activityWithoutJp = { activityId: "fake-no-jp", title: "Fake Activity Title", category: "hear" };
  assert.equal(localizedTitle(activityWithoutJp, "jp"), "Fake Activity Title");
});

test("Japanese active falls back to English when titleJp is present but empty string", () => {
  const activityWithEmptyJp = { activityId: "fake-empty-jp", title: "Fake Activity", titleJp: "" };
  assert.equal(localizedTitle(activityWithEmptyJp, "jp"), "Fake Activity");
});

test("a null/undefined activity never throws — returns an empty string", () => {
  assert.equal(localizedTitle(null, "jp"), "");
  assert.equal(localizedTitle(undefined, "en"), "");
});

// ── Display-only: activity identity is untouched by language ────────────

test("localizedTitle never reads or returns activityId — it cannot affect progress keys/routing", () => {
  const activity = getActivity("hear-hello-song");
  const enResult = localizedTitle(activity, "en");
  const jpResult = localizedTitle(activity, "jp");
  assert.ok(!enResult.includes(activity.activityId));
  assert.ok(!jpResult.includes(activity.activityId));
  // The activity object itself (identity, progress keying) is the same
  // reference regardless of which language the title was rendered in.
  assert.equal(getActivity("hear-hello-song").activityId, "hear-hello-song");
});

// ── Coverage: every activity in the real catalog has a titleJp today ────

test("every activity in the real catalog currently has a non-empty titleJp (missing-translations audit)", () => {
  const missing = ALL_ACTIVITIES.filter(a => !a.titleJp || a.titleJp.trim() === "");
  assert.deepEqual(
    missing.map(a => a.activityId),
    [],
    "if this fails, the listed activityIds are missing titleJp and need content follow-up"
  );
});

// ── Every Family surface that shows a title now uses localizedTitle ─────

const familyHomeSrc = read("src/family/FamilyHome.jsx");
const activityGridSrc = read("src/family/ActivityGrid.jsx");
const activityPlayerSrc = read("src/family/ActivityPlayer.jsx");
const familyParentViewSrc = read("src/family/FamilyParentView.jsx");

test("FamilyHome's recommendation and last-activity labels both use localizedTitle", () => {
  assert.ok(/localizedTitle\(recommended, lang\)/.test(familyHomeSrc));
  assert.ok(/localizedTitle\(last, lang\)/.test(familyHomeSrc));
  assert.ok(!/\brecommended\.title\b/.test(familyHomeSrc), "no raw .title read should remain for the recommendation");
  assert.ok(!/\blast\.title\b/.test(familyHomeSrc), "no raw .title read should remain for the last activity");
});

test("ActivityGrid's category list (Hear/See/Do/Talk/Create/Hub, one shared component) uses localizedTitle for every card", () => {
  const rawTitleReads = (activityGridSrc.match(/\ba\.title\b/g) ?? []);
  assert.equal(rawTitleReads.length, 0, "every a.title read in ActivityGrid must have been replaced with localizedTitle(a, lang)");
  assert.ok(/localizedTitle\(a, lang\)/.test(activityGridSrc));
});

test("ActivityPlayer's header uses localizedTitle instead of its own inline ternary", () => {
  assert.ok(/localizedTitle\(activity, lang\)/.test(activityPlayerSrc));
});

test("FamilyParentView's recommendation uses localizedTitle", () => {
  assert.ok(/localizedTitle\(recommended, lang\)/.test(familyParentViewSrc));
  assert.ok(!/recommended\.title\b/.test(familyParentViewSrc));
});

// ── Jona: intentionally left alone, reported not fixed ───────────────────

test("Jona's system prompt still uses the English activity.title internally (intentional, left alone this task)", () => {
  const jonaFamilySrc = read("src/family/jonaFamily.js");
  assert.ok(
    /activity\?\.title \?\? "a conversation"/.test(jonaFamilySrc),
    "documents the current, intentional behavior — Jona's prompt metadata is English regardless of UI language, while REPLY_EN/REPLY_JP output is always bilingual"
  );
});
