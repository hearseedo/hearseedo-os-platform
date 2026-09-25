// Talk with Jona (Gemini Live) — centralized beta-policy loader. Confirms
// requirement: conservative defaults, remotely adjustable, fails closed to
// the conservative defaults (never to "unlimited") on any read problem,
// and admin/beta tiers stay genuinely separate.
// Run with:
//   node --test tests/live-beta-policy.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { loadLiveBetaPolicy, DEFAULTS } from "../netlify/functions/_liveBetaPolicy.js";

function fromFirestoreFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if ("integerValue" in v) out[k] = parseInt(v.integerValue, 10);
    else if ("doubleValue" in v) out[k] = v.doubleValue;
    else if ("stringValue" in v) out[k] = v.stringValue;
    else if ("booleanValue" in v) out[k] = v.booleanValue;
  }
  return out;
}

test("no config doc -> conservative defaults", async () => {
  const fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  const policy = await loadLiveBetaPolicy(fetch, fromFirestoreFields);
  assert.deepEqual(policy, DEFAULTS);
});

test("a real config doc overrides the defaults", async () => {
  const fetch = async () => ({
    ok: true,
    json: async () => ({ fields: { monthlyMinutes: { integerValue: "60" }, dailySessions: { integerValue: "5" } } }),
  });
  const policy = await loadLiveBetaPolicy(fetch, fromFirestoreFields);
  assert.equal(policy.monthlyMinutes, 60);
  assert.equal(policy.dailySessions, 5);
  // Untouched fields still fall back to the defaults, not to zero/undefined.
  assert.equal(policy.maxSessionMinutes, DEFAULTS.maxSessionMinutes);
});

test("a network error fails closed to the conservative defaults, never throws", async () => {
  const fetch = async () => { throw new Error("boom"); };
  const policy = await loadLiveBetaPolicy(fetch, fromFirestoreFields);
  assert.deepEqual(policy, DEFAULTS);
});

test("a zero/negative override is rejected in favor of the default (never effectively unlimited)", async () => {
  const fetch = async () => ({
    ok: true,
    json: async () => ({ fields: { monthlyMinutes: { integerValue: "0" }, dailySessions: { integerValue: "-3" } } }),
  });
  const policy = await loadLiveBetaPolicy(fetch, fromFirestoreFields);
  assert.equal(policy.monthlyMinutes, DEFAULTS.monthlyMinutes);
  assert.equal(policy.dailySessions, DEFAULTS.dailySessions);
});

test("admin and beta tiers are genuinely different values, not aliases of each other", () => {
  assert.notEqual(DEFAULTS.monthlyMinutes, DEFAULTS.adminMonthlyMinutes);
  assert.notEqual(DEFAULTS.dailySessions, DEFAULTS.adminDailySessions);
  assert.ok(DEFAULTS.adminMonthlyMinutes > DEFAULTS.monthlyMinutes, "admin tier should be more generous, not equal or lower");
});
