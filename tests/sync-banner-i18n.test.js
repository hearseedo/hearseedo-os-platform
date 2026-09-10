// Staging correction (2026-09-11) — the curriculum-progress sync banner
// (AppModal.jsx) previously called t("progress_sync_pending") /
// t("progress_sync_failed") / t("retry") / t("dismiss") with no matching
// entries in src/lib/i18n.js's STRINGS table. Since t() falls back to the
// raw key itself (`STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key`), the
// banner rendered the literal key text ("progress_sync_pending") instead
// of real English/Japanese copy. These tests prove both languages now
// resolve to real, distinct, human-readable text. No Firebase dependency —
// run with: node --test tests/sync-banner-i18n.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { t } from "../src/lib/i18n.js";

const SYNC_KEYS = ["progress_sync_pending", "progress_sync_failed", "retry", "dismiss"];

for (const lang of ["en", "jp"]) {
  for (const key of SYNC_KEYS) {
    test(`t("${lang}", "${key}") resolves to real text, not the raw key`, () => {
      const result = t(lang, key);
      assert.notEqual(result, key, `${lang}/${key} must not fall back to the raw key`);
      assert.ok(result.length > 0, `${lang}/${key} must not be empty`);
    });
  }
}

test("English and Japanese sync-banner strings are actually different text (real translation, not a copy-paste)", () => {
  for (const key of SYNC_KEYS) {
    assert.notEqual(t("en", key), t("jp", key), `${key} should differ between en and jp`);
  }
});

test("progress_sync_pending and progress_sync_failed are distinct messages in both languages", () => {
  assert.notEqual(t("en", "progress_sync_pending"), t("en", "progress_sync_failed"));
  assert.notEqual(t("jp", "progress_sync_pending"), t("jp", "progress_sync_failed"));
});

test("exact approved English copy", () => {
  assert.equal(t("en", "progress_sync_pending"), "Still saving your progress…");
  assert.equal(t("en", "progress_sync_failed"), "We couldn't save your progress.");
  assert.equal(t("en", "retry"), "Retry now");
  assert.equal(t("en", "dismiss"), "Dismiss");
});

test("exact approved Japanese copy", () => {
  assert.equal(t("jp", "progress_sync_pending"), "学習記録を保存しています…");
  assert.equal(t("jp", "progress_sync_failed"), "学習記録を保存できませんでした。");
  assert.equal(t("jp", "retry"), "もう一度試す");
  assert.equal(t("jp", "dismiss"), "閉じる");
});
