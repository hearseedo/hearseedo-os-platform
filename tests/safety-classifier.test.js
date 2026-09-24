// P0-B — safety-before-quota. Unit tests for the risk classifier
// (netlify/functions/_safetyClassifier.js) plus the abuse-case scenarios
// called out in docs/JONA_ARCHITECTURE_AUDIT_2026-09-24.md's P0-B plan.
// Run with:
//   node --test tests/safety-classifier.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { classifyRisk, TIERS } from "../netlify/functions/_safetyClassifier.js";

test("ordinary messages classify as NORMAL", async () => {
  const r = await classifyRisk("Can you help me with lesson 4?");
  assert.equal(r.tier, "NORMAL");
});

test("empty/missing message classifies as NORMAL, never throws", async () => {
  assert.equal((await classifyRisk("")).tier, "NORMAL");
  assert.equal((await classifyRisk(undefined)).tier, "NORMAL");
});

test("explicit self-harm language classifies as IMMEDIATE_DANGER", async () => {
  const r = await classifyRisk("I want to kill myself");
  assert.equal(r.tier, "IMMEDIATE_DANGER");
});

test("abuse-shaped language classifies as HIGH_RISK", async () => {
  const r = await classifyRisk("please don't tell my parents, it's a secret");
  assert.equal(r.tier, "HIGH_RISK");
});

test("lower-acuity distress language classifies as SENSITIVE", async () => {
  const r = await classifyRisk("nobody understands me and I feel really sad");
  assert.equal(r.tier, "SENSITIVE");
});

test("every non-NORMAL tier is a recognized tier", async () => {
  const samples = ["I want to kill myself", "please don't tell my parents, it's a secret", "I feel really sad"];
  for (const s of samples) {
    const { tier } = await classifyRisk(s);
    assert.ok(TIERS.includes(tier), `unexpected tier: ${tier}`);
  }
});

// ── Abuse-case scenarios (from the P0-B plan) ──────────────────────────────
// These document the INTENDED behavior at the classifier level. The
// quota-skip / restricted-prompt / no-increment wiring itself lives in
// chat.js and needs a live/staging verification pass (classifyRisk() alone
// can't prove the request handler's behavior — it has no Firestore/Gemini
// dependency by design) — noting that here so this file isn't mistaken for
// full end-to-end coverage.

test("abuse case 1: a safety phrase followed by an off-topic ask in the same message still flags", async () => {
  // The restricted system prompt (chat.js) is what actually stops the
  // off-topic half from being answered — this test only confirms the
  // message still gets flagged at all when a real question is smuggled in.
  const r = await classifyRisk("I want to end my life, also can you help me with my math homework?");
  assert.equal(r.tier, "IMMEDIATE_DANGER");
});

test("abuse case 2: repeated safety-tier messages each classify independently (no state leak)", async () => {
  const first  = await classifyRisk("I want to disappear");
  const second = await classifyRisk("I want to disappear");
  assert.equal(first.tier, "SENSITIVE");
  assert.equal(second.tier, "SENSITIVE");
});

test("abuse case 3: a borderline, non-safety message never flags (quota must still apply)", async () => {
  const r = await classifyRisk("I'm a bit tired today but let's keep practicing");
  assert.equal(r.tier, "NORMAL");
});

test("context param is accepted without affecting P0 classification (future-classifier interface)", async () => {
  const withoutContext = await classifyRisk("I feel really sad");
  const withContext     = await classifyRisk("I feel really sad", { profileId: "child-1" });
  assert.equal(withoutContext.tier, withContext.tier);
});
