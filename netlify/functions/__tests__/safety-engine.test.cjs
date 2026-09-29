// Gate B Stage 4 — unit tests for _safetyEngine.js's classify(). No live
// Gemini project is available in this environment (same constraint noted
// throughout this test suite), so the Gemini call is replaced with an
// injectable fake fetch (classify() accepts { fetchImpl } exactly for this
// reason, mirroring _profileContext.js's injectable-firestoreFetch
// pattern). This covers: the empty-input null-guard (Stage 3 Revision §2 —
// the ONLY thing allowed to skip classification), the required
// responseSchema/JSON shape, and — critically — that malformed/invalid
// output is treated as a hard failure (SafetyClassificationError), never
// silently coerced to NORMAL, per the explicit instruction.
//
// Run with: npm run test:functions

const test = require("node:test");
const assert = require("node:assert/strict");

const { classify, SafetyClassificationError, validateClassification } = require("../_safetyEngine.js");

function fakeFetchReturning(jsonText, { ok = true, status = 200 } = {}) {
  return async () => ({
    ok,
    status,
    text: async () => jsonText,
    json: async () => ({ candidates: [{ content: { parts: [{ text: jsonText }] } }] }),
  });
}

const VALID_NORMAL_RESPONSE = JSON.stringify({
  register: "topic", intent: "none", imminence: "none",
  tier: "NORMAL", confidence: "high", reasoning: "School topic, no personal disclosure.",
});

// ── Null-input guard (the ONLY thing that skips the model) ─────────────────

test("classify: empty text never calls the model, returns NORMAL/skipped", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  const result = await classify({ text: "" }, { fetchImpl, apiKey: "test" });
  assert.equal(called, false, "the model must never be called for empty input");
  assert.equal(result.tier, "NORMAL");
  assert.equal(result.skipped, true);
});

test("classify: whitespace-only text never calls the model", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  const result = await classify({ text: "   \n\t  " }, { fetchImpl, apiKey: "test" });
  assert.equal(called, false);
  assert.equal(result.skipped, true);
});

test("classify: a single-character/word substantive turn (e.g. \"ok\") IS classified — no semantic pre-filter for child beta", async () => {
  let called = false;
  const fetchImpl = async (...args) => { called = true; return fakeFetchReturning(VALID_NORMAL_RESPONSE)(...args); };
  const result = await classify({ text: "ok" }, { fetchImpl, apiKey: "test" });
  assert.equal(called, true, "even a trivial-looking turn must reach the contextual classifier");
  assert.equal(result.tier, "NORMAL");
});

// ── Happy path / schema shape ────────────────────────────────────────────

test("classify: a well-formed response is parsed into the expected shape", async () => {
  const fetchImpl = fakeFetchReturning(VALID_NORMAL_RESPONSE);
  const result = await classify({ text: "we learned about suicide prevention at school today" }, { fetchImpl, apiKey: "test" });
  assert.deepEqual(result.dimensions, { register: "topic", intent: "none", imminence: "none" });
  assert.equal(result.tier, "NORMAL");
  assert.equal(result.confidence, "high");
  assert.equal(typeof result.reasoning, "string");
});

test("classify: request body includes structured-output config (responseSchema/responseMimeType), never relying on free-text + regex", async () => {
  let capturedBody = null;
  const fetchImpl = async (url, opts) => {
    capturedBody = JSON.parse(opts.body);
    return fakeFetchReturning(VALID_NORMAL_RESPONSE)();
  };
  await classify({ text: "hello" }, { fetchImpl, apiKey: "test" });
  assert.equal(capturedBody.generationConfig.responseMimeType, "application/json");
  assert.ok(capturedBody.generationConfig.responseSchema, "must declare a responseSchema");
  assert.ok(Array.isArray(capturedBody.generationConfig.responseSchema.required));
  assert.ok(capturedBody.generationConfig.responseSchema.required.includes("tier"));
});

// ── Malformed output is a FAILURE, never NORMAL ────────────────────────────

test("classify: invalid JSON in the candidate text throws SafetyClassificationError", async () => {
  const fetchImpl = fakeFetchReturning("this is not json");
  await assert.rejects(
    () => classify({ text: "something" }, { fetchImpl, apiKey: "test" }),
    SafetyClassificationError
  );
});

test("classify: a tier outside the enum throws rather than silently passing through", async () => {
  const bad = JSON.stringify({ register: "topic", intent: "none", imminence: "none", tier: "TOTALLY_FINE", confidence: "high", reasoning: "x" });
  const fetchImpl = fakeFetchReturning(bad);
  await assert.rejects(() => classify({ text: "something" }, { fetchImpl, apiKey: "test" }), SafetyClassificationError);
});

test("classify: a missing required field (reasoning) throws", async () => {
  const bad = JSON.stringify({ register: "topic", intent: "none", imminence: "none", tier: "NORMAL", confidence: "high" });
  const fetchImpl = fakeFetchReturning(bad);
  await assert.rejects(() => classify({ text: "something" }, { fetchImpl, apiKey: "test" }), SafetyClassificationError);
});

test("classify: an invalid register/intent/imminence value throws even if tier itself is valid", async () => {
  const bad = JSON.stringify({ register: "made_up_value", intent: "none", imminence: "none", tier: "NORMAL", confidence: "high", reasoning: "x" });
  const fetchImpl = fakeFetchReturning(bad);
  await assert.rejects(() => classify({ text: "something" }, { fetchImpl, apiKey: "test" }), SafetyClassificationError);
});

test("classify: an empty candidate (no text at all) throws", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [] } }] }) });
  await assert.rejects(() => classify({ text: "something" }, { fetchImpl, apiKey: "test" }), SafetyClassificationError);
});

test("classify: a non-ok HTTP response throws (never silently treated as NORMAL)", async () => {
  const fetchImpl = async () => ({ ok: false, status: 503, text: async () => "service unavailable" });
  await assert.rejects(() => classify({ text: "something" }, { fetchImpl, apiKey: "test" }), SafetyClassificationError);
});

test("classify: a network-level throw from fetch itself is wrapped as SafetyClassificationError", async () => {
  const fetchImpl = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(() => classify({ text: "something" }, { fetchImpl, apiKey: "test" }), SafetyClassificationError);
});

test("classify: missing API key throws before attempting any network call", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return fakeFetchReturning(VALID_NORMAL_RESPONSE)(); };
  await assert.rejects(() => classify({ text: "something" }, { fetchImpl, apiKey: "" }), SafetyClassificationError);
  assert.equal(called, false);
});

// ── The historical false positive, at the unit level (schema validation only —
// judging real Gemini behavior on this input is a red-team/manual-test
// concern, covered separately; this just proves the *pipe* accepts and
// correctly threads through a NORMAL/topic verdict for this exact input). ──

test("classify: a NORMAL/topic verdict for the known-false-positive sentence threads through cleanly (schema-level check)", async () => {
  const fetchImpl = fakeFetchReturning(VALID_NORMAL_RESPONSE);
  const result = await classify({ text: "We learned about suicide prevention at school today." }, { fetchImpl, apiKey: "test" });
  assert.equal(result.tier, "NORMAL");
  assert.equal(result.dimensions.register, "topic");
});

// ── validateClassification exported directly ───────────────────────────────

test("validateClassification: rejects a non-object", () => {
  assert.throws(() => validateClassification(null), SafetyClassificationError);
  assert.throws(() => validateClassification("a string"), SafetyClassificationError);
});
