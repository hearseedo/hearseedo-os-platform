// Gate B Stage 4 — explicit tests proving a client cannot reconnect around
// safety containment (item 7's own instruction). resolveReconnectAuthority()
// is live-token.js's pure decision core for a safety reconnect: no network,
// no Firestore, takes only the already-fetched session doc's own
// server-held fields. Critically, it never reads anything from the
// client's request body — the tests below stress exactly that, by
// asserting the decision depends ONLY on sessionFields, never on any
// client-suppliable value.
//
// See docs/JONA_LIVE_SAFETY_GATE_B_STAGE3_REVISION_2026-09-29.md §4.
//
// Run with: npm run test:functions

const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveReconnectAuthority } = require("../live-token.js").__testables;

test("resolveReconnectAuthority: NORMAL tier -> ordinary reconnect, not restricted, not denied", () => {
  const r = resolveReconnectAuthority({ safetyTier: "NORMAL" });
  assert.equal(r.denied, false);
  assert.equal(r.forcedRestrictedLive, false);
});

test("resolveReconnectAuthority: no safetyTier at all defaults to NORMAL behavior (ordinary reconnect)", () => {
  const r = resolveReconnectAuthority({});
  assert.equal(r.denied, false);
  assert.equal(r.forcedRestrictedLive, false);
});

test("resolveReconnectAuthority: SENSITIVE -> ordinary reconnect (not itself a hard-gated tier)", () => {
  const r = resolveReconnectAuthority({ safetyTier: "SENSITIVE" });
  assert.equal(r.denied, false);
  assert.equal(r.forcedRestrictedLive, false);
});

test("resolveReconnectAuthority: HIGH_RISK -> forces the restricted Live variant, never denies outright", () => {
  const r = resolveReconnectAuthority({ safetyTier: "HIGH_RISK" });
  assert.equal(r.denied, false);
  assert.equal(r.forcedRestrictedLive, true);
});

test("resolveReconnectAuthority: IMMEDIATE_DANGER -> denies any Live token outright, no restricted-Live fallback", () => {
  const r = resolveReconnectAuthority({ safetyTier: "IMMEDIATE_DANGER" });
  assert.equal(r.denied, true);
  assert.equal(r.forcedRestrictedLive, false);
  assert.equal(r.reason, "immediate_danger_no_live");
});

test("resolveReconnectAuthority: an already-ended session is denied regardless of its tier", () => {
  const r = resolveReconnectAuthority({ safetyTier: "NORMAL", endedAt: "2026-09-29T00:00:00.000Z" });
  assert.equal(r.denied, true);
  assert.equal(r.reason, "already_ended");
});

test("resolveReconnectAuthority: endedAt denial takes priority even for a HIGH_RISK/IMMEDIATE_DANGER session", () => {
  const highRiskEnded = resolveReconnectAuthority({ safetyTier: "HIGH_RISK", endedAt: "x" });
  assert.equal(highRiskEnded.denied, true);
  assert.equal(highRiskEnded.reason, "already_ended");

  const dangerEnded = resolveReconnectAuthority({ safetyTier: "IMMEDIATE_DANGER", endedAt: "x" });
  assert.equal(dangerEnded.denied, true);
  assert.equal(dangerEnded.reason, "already_ended");
});

// ── The actual "cannot reconnect around containment" proof: the function's
//    signature itself only accepts sessionFields — there is no parameter
//    for a client-supplied tier/restricted flag to influence the outcome
//    at all. These two calls prove that even if such a value were somehow
//    threaded in from the request body, it has zero effect, because the
//    function never looks at anything but the server-held tier. ──────────

test("resolveReconnectAuthority: extra/unexpected fields on sessionFields (simulating a client-influenced object) never change the outcome for a HIGH_RISK session", () => {
  const withExtra = resolveReconnectAuthority({ safetyTier: "HIGH_RISK", restricted: false, requestedTier: "NORMAL", clientClaim: "trust me" });
  assert.equal(withExtra.forcedRestrictedLive, true, "only the server-held safetyTier field is ever consulted");
  assert.equal(withExtra.denied, false);
});

test("resolveReconnectAuthority: extra/unexpected fields never let an IMMEDIATE_DANGER session escape denial", () => {
  const withExtra = resolveReconnectAuthority({ safetyTier: "IMMEDIATE_DANGER", restricted: false, requestedTier: "NORMAL", forceNormal: true });
  assert.equal(withExtra.denied, true);
  assert.equal(withExtra.reason, "immediate_danger_no_live");
});

// ── Sanity: the handler module itself still loads (catches a syntax error
//    or a broken import introduced anywhere in this file). ────────────────
test("live-token.js module loads without throwing", () => {
  assert.equal(typeof require("../live-token.js").handler, "function");
});
