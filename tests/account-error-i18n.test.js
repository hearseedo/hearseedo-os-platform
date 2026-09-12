// Phase 3.4 (2026-09-12) — regression tests for PathwayRoute.jsx's
// AccountLoadError copy, previously hardcoded English-only (found during
// Phase 3.3 staging verification — see docs/PHASE_3_3_DIAGNOSTICS.md).
// Mirrors tests/sync-banner-i18n.test.js's approach: exercises src/lib/i18n.js's
// t() directly, no component render needed. Run with:
//   node --test tests/account-error-i18n.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { t } from "../src/lib/i18n.js";

const KEYS = ["account_error_title", "account_error_body", "account_error_retry", "account_error_return"];

test("every account-error key resolves to real text in English, not the raw key", () => {
  for (const key of KEYS) {
    const value = t("en", key);
    assert.notEqual(value, key, `${key} must not fall back to the raw key in English`);
    assert.ok(value.length > 0);
  }
});

test("every account-error key resolves to real text in Japanese, not the raw key and not the English fallback", () => {
  for (const key of KEYS) {
    const en = t("en", key);
    const jp = t("jp", key);
    assert.notEqual(jp, key, `${key} must not fall back to the raw key in Japanese`);
    assert.notEqual(jp, en, `${key}'s Japanese copy must be a real translation, not a copy-paste of the English`);
  }
});

test("the account-error title and body are distinct strings in both languages", () => {
  assert.notEqual(t("en", "account_error_title"), t("en", "account_error_body"));
  assert.notEqual(t("jp", "account_error_title"), t("jp", "account_error_body"));
});

test("the retry and return actions read as distinct, non-empty calls to action in both languages", () => {
  assert.notEqual(t("en", "account_error_retry"), t("en", "account_error_return"));
  assert.notEqual(t("jp", "account_error_retry"), t("jp", "account_error_return"));
});
