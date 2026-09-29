// Gate B Stage 4 — deterministic unit tests for the session safety state
// machine (_safetyPolicy.js), fully independent of Gemini/Firestore per
// the explicit instruction ("Add deterministic unit tests around the state
// machine independently of Gemini"). See
// docs/JONA_LIVE_SAFETY_GATE_B_STAGE3_FINAL_ARCHITECTURE_2026-09-28.md §3
// and docs/JONA_LIVE_SAFETY_GATE_B_STAGE3_REVISION_2026-09-29.md.
//
// Run with: npm run test:functions

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  nextSessionState,
  responseStrategyFor,
  interventionDirectiveFor,
  defaultSessionState,
  tierRank,
} = require("../_safetyPolicy.js");

// ── Monotonic high-water mark ────────────────────────────────────────────

test("nextSessionState: NORMAL -> NORMAL stays NORMAL", () => {
  const s = nextSessionState(defaultSessionState(), { tier: "NORMAL" });
  assert.equal(s.tier, "NORMAL");
  assert.equal(s.escalated, false);
});

test("nextSessionState: NORMAL -> SENSITIVE escalates", () => {
  const s = nextSessionState(defaultSessionState(), { tier: "SENSITIVE" });
  assert.equal(s.tier, "SENSITIVE");
  assert.equal(s.escalated, true);
});

test("nextSessionState: escalation can skip levels — NORMAL straight to IMMEDIATE_DANGER", () => {
  const s = nextSessionState(defaultSessionState(), { tier: "IMMEDIATE_DANGER" });
  assert.equal(s.tier, "IMMEDIATE_DANGER");
  assert.equal(s.escalated, true);
});

test("nextSessionState: a lower-tier classification never downgrades the current tier", () => {
  const s = nextSessionState({ tier: "HIGH_RISK", consecutiveNormalCount: 0, awaitingClarification: false }, { tier: "NORMAL" });
  assert.equal(s.tier, "HIGH_RISK");
  assert.equal(s.escalated, false);
});

// ── Stickiness ────────────────────────────────────────────────────────────

test("nextSessionState: HIGH_RISK is sticky — many subsequent NORMALs never pull it down", () => {
  let state = nextSessionState(defaultSessionState(), { tier: "HIGH_RISK" });
  for (let i = 0; i < 20; i++) {
    state = nextSessionState(state, { tier: "NORMAL" });
    assert.equal(state.tier, "HIGH_RISK", `still HIGH_RISK after ${i + 1} NORMAL reads`);
  }
});

test("nextSessionState: IMMEDIATE_DANGER is sticky — nothing later can lower it, including SENSITIVE/HIGH_RISK", () => {
  let state = nextSessionState(defaultSessionState(), { tier: "IMMEDIATE_DANGER" });
  state = nextSessionState(state, { tier: "SENSITIVE" });
  assert.equal(state.tier, "IMMEDIATE_DANGER");
  state = nextSessionState(state, { tier: "HIGH_RISK" });
  assert.equal(state.tier, "IMMEDIATE_DANGER");
  state = nextSessionState(state, { tier: "NORMAL" });
  assert.equal(state.tier, "IMMEDIATE_DANGER");
});

test("nextSessionState: HIGH_RISK -> IMMEDIATE_DANGER can still escalate further (sticky floor, not a ceiling)", () => {
  let state = nextSessionState(defaultSessionState(), { tier: "HIGH_RISK" });
  state = nextSessionState(state, { tier: "IMMEDIATE_DANGER" });
  assert.equal(state.tier, "IMMEDIATE_DANGER");
  assert.equal(state.escalated, true);
});

test("nextSessionState: a sudden subject change (all-NORMAL sequence) cannot undo a sticky tier", () => {
  let state = nextSessionState(defaultSessionState(), { tier: "IMMEDIATE_DANGER" });
  for (let i = 0; i < 10; i++) state = nextSessionState(state, { tier: "NORMAL" });
  assert.equal(state.tier, "IMMEDIATE_DANGER");
});

// ── SENSITIVE decay ───────────────────────────────────────────────────────

test("nextSessionState: SENSITIVE decays to NORMAL after exactly 3 consecutive NORMAL reads", () => {
  let state = nextSessionState(defaultSessionState(), { tier: "SENSITIVE" });
  assert.equal(state.tier, "SENSITIVE");
  state = nextSessionState(state, { tier: "NORMAL" });
  assert.equal(state.tier, "SENSITIVE", "1 of 3 — not yet decayed");
  state = nextSessionState(state, { tier: "NORMAL" });
  assert.equal(state.tier, "SENSITIVE", "2 of 3 — not yet decayed");
  state = nextSessionState(state, { tier: "NORMAL" });
  assert.equal(state.tier, "NORMAL", "3 of 3 — decayed");
});

test("nextSessionState: SENSITIVE decay counter resets if a non-NORMAL reading interrupts the streak", () => {
  let state = nextSessionState(defaultSessionState(), { tier: "SENSITIVE" });
  state = nextSessionState(state, { tier: "NORMAL" });
  state = nextSessionState(state, { tier: "NORMAL" });
  // Interrupted on the 3rd read by another SENSITIVE instead of NORMAL.
  state = nextSessionState(state, { tier: "SENSITIVE" });
  assert.equal(state.tier, "SENSITIVE");
  // Counter must have reset — two more NORMALs should NOT be enough now.
  state = nextSessionState(state, { tier: "NORMAL" });
  state = nextSessionState(state, { tier: "NORMAL" });
  assert.equal(state.tier, "SENSITIVE", "counter reset — needs 3 fresh consecutive NORMALs");
  state = nextSessionState(state, { tier: "NORMAL" });
  assert.equal(state.tier, "NORMAL");
});

test("nextSessionState: SENSITIVE decay never applies to a sticky tier (HIGH_RISK ignores the counter entirely)", () => {
  let state = nextSessionState(defaultSessionState(), { tier: "HIGH_RISK" });
  for (let i = 0; i < 5; i++) state = nextSessionState(state, { tier: "NORMAL" });
  assert.equal(state.tier, "HIGH_RISK");
});

// ── UNCERTAIN — one clarification round, then fail-safe ──────────────────

test("nextSessionState: UNCERTAIN does not change tier, sets awaitingClarification", () => {
  const state = nextSessionState(defaultSessionState(), { tier: "UNCERTAIN" });
  assert.equal(state.tier, "NORMAL");
  assert.equal(state.awaitingClarification, true);
});

test("nextSessionState: after UNCERTAIN, a resolving classification (e.g. HIGH_RISK) is applied normally and clears awaitingClarification", () => {
  let state = nextSessionState(defaultSessionState(), { tier: "UNCERTAIN" });
  state = nextSessionState(state, { tier: "HIGH_RISK" });
  assert.equal(state.tier, "HIGH_RISK");
  assert.equal(state.awaitingClarification, false);
});

test("nextSessionState: after UNCERTAIN, a resolving NORMAL clears the flag and stays NORMAL", () => {
  let state = nextSessionState(defaultSessionState(), { tier: "UNCERTAIN" });
  state = nextSessionState(state, { tier: "NORMAL" });
  assert.equal(state.tier, "NORMAL");
  assert.equal(state.awaitingClarification, false);
});

test("nextSessionState: two UNCERTAIN readings in a row fail toward SENSITIVE, not toward silence, and stop clarifying", () => {
  let state = nextSessionState(defaultSessionState(), { tier: "UNCERTAIN" });
  assert.equal(state.awaitingClarification, true);
  state = nextSessionState(state, { tier: "UNCERTAIN" });
  assert.equal(state.tier, "SENSITIVE", "bounded to exactly one clarification round, then fails safe to SENSITIVE");
  assert.equal(state.awaitingClarification, false);
});

test("nextSessionState: UNCERTAIN while already HIGH_RISK does not touch the sticky tier", () => {
  let state = nextSessionState(defaultSessionState(), { tier: "HIGH_RISK" });
  state = nextSessionState(state, { tier: "UNCERTAIN" });
  assert.equal(state.tier, "HIGH_RISK");
});

// ── Invalid input fails closed, never silently NORMAL ─────────────────────

test("nextSessionState: an invalid/unrecognized tier throws rather than defaulting to NORMAL", () => {
  assert.throws(() => nextSessionState(defaultSessionState(), { tier: "NOT_A_REAL_TIER" }));
  assert.throws(() => nextSessionState(defaultSessionState(), { tier: undefined }));
  assert.throws(() => nextSessionState(defaultSessionState(), {}));
});

// ── responseStrategyFor ────────────────────────────────────────────────────

test("responseStrategyFor: maps every tier to its approved strategy", () => {
  assert.equal(responseStrategyFor({ tier: "NORMAL" }), "continue_normal");
  assert.equal(responseStrategyFor({ tier: "SENSITIVE" }), "safer_guidance");
  assert.equal(responseStrategyFor({ tier: "HIGH_RISK" }), "restricted_support");
  assert.equal(responseStrategyFor({ tier: "IMMEDIATE_DANGER" }), "restricted_safety_pathway");
});

test("responseStrategyFor: awaitingClarification overrides tier to gentle_clarify", () => {
  assert.equal(responseStrategyFor({ tier: "NORMAL", awaitingClarification: true }), "gentle_clarify");
});

// ── interventionDirectiveFor ────────────────────────────────────────────────

test("interventionDirectiveFor: NORMAL/SENSITIVE get no directive (in-conversation steering only)", () => {
  assert.equal(interventionDirectiveFor("NORMAL"), null);
  assert.equal(interventionDirectiveFor("SENSITIVE"), null);
});

test("interventionDirectiveFor: HIGH_RISK directs a restricted Live reconnect", () => {
  assert.deepEqual(interventionDirectiveFor("HIGH_RISK"), { action: "reconnect_restricted_live" });
});

test("interventionDirectiveFor: IMMEDIATE_DANGER directs the restricted non-Live safety pathway (approved Option C — not an immediate hard end)", () => {
  assert.deepEqual(interventionDirectiveFor("IMMEDIATE_DANGER"), { action: "restricted_safety_pathway" });
});

// ── tierRank sanity ─────────────────────────────────────────────────────────

test("tierRank: strictly increasing in the approved order", () => {
  assert.ok(tierRank("NORMAL") < tierRank("SENSITIVE"));
  assert.ok(tierRank("SENSITIVE") < tierRank("HIGH_RISK"));
  assert.ok(tierRank("HIGH_RISK") < tierRank("IMMEDIATE_DANGER"));
});
