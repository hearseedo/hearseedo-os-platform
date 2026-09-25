// Talk with Jona (Gemini Live) — centralized cost-estimation config.
// Confirms the pricing config loads/falls-back correctly and the cost
// formula is deterministic and correctly weights input vs output tokens
// (they have very different per-million rates — a bug here would most
// likely be swapping the two).
// Run with:
//   node --test tests/live-pricing-config.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { loadLivePricingConfig, estimateSessionCostUSD, DEFAULTS } from "../netlify/functions/_livePricingConfig.js";

function fromFirestoreFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if ("integerValue" in v) out[k] = parseInt(v.integerValue, 10);
    else if ("doubleValue" in v) out[k] = v.doubleValue;
  }
  return out;
}

test("no config doc -> default pricing", async () => {
  const fetch = async () => ({ ok: false, status: 404 });
  const pricing = await loadLivePricingConfig(fetch, fromFirestoreFields);
  assert.deepEqual(pricing, DEFAULTS);
});

test("a real config doc overrides the defaults", async () => {
  const fetch = async () => ({ ok: true, json: async () => ({ fields: { inputPerMillionUSD: { doubleValue: 5 }, outputPerMillionUSD: { doubleValue: 20 } } }) });
  const pricing = await loadLivePricingConfig(fetch, fromFirestoreFields);
  assert.equal(pricing.inputPerMillionUSD, 5);
  assert.equal(pricing.outputPerMillionUSD, 20);
});

test("a network error fails closed to the default pricing, never throws", async () => {
  const fetch = async () => { throw new Error("boom"); };
  const pricing = await loadLivePricingConfig(fetch, fromFirestoreFields);
  assert.deepEqual(pricing, DEFAULTS);
});

test("zero tokens -> zero estimated cost", () => {
  const cost = estimateSessionCostUSD({ promptTokenCount: 0, responseTokenCount: 0 }, DEFAULTS);
  assert.equal(cost, 0);
});

test("input and output tokens are priced at their own distinct rates, not swapped or averaged", () => {
  const pricing = { inputPerMillionUSD: 1, outputPerMillionUSD: 10 };
  const inputOnly  = estimateSessionCostUSD({ promptTokenCount: 1_000_000, responseTokenCount: 0 }, pricing);
  const outputOnly = estimateSessionCostUSD({ promptTokenCount: 0, responseTokenCount: 1_000_000 }, pricing);
  assert.equal(inputOnly, 1);
  assert.equal(outputOnly, 10);
  assert.notEqual(inputOnly, outputOnly);
});

test("missing usage fields default to zero rather than throwing or producing NaN", () => {
  const cost = estimateSessionCostUSD({}, DEFAULTS);
  assert.equal(cost, 0);
  assert.ok(Number.isFinite(cost));
});
