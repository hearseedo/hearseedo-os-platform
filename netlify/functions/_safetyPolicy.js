// Talk with Jona (Gemini Live) — Gate B Stage 4: shared safety decision/
// state logic. See docs/JONA_LIVE_SAFETY_GATE_B_STAGE3_FINAL_ARCHITECTURE_2026-09-28.md
// (§1/§3) and docs/JONA_LIVE_SAFETY_GATE_B_STAGE3_REVISION_2026-09-29.md
// (§1/§2/§4) for the approved architecture this implements.
//
// Pure functions only — no network, no Firestore, no Gemini — so the whole
// state machine is testable without a model call or a live project. This
// is deliberate: the classification call (_safetyEngine.js) can be wrong,
// slow, or unavailable, but what a given tier *means* for the session must
// never depend on that.
//
// Session state shape this module operates on (persisted by the caller,
// e.g. live-transcript-classify.js, in Firestore — this module never reads
// or writes anything itself):
//   {
//     tier: "NORMAL"|"SENSITIVE"|"HIGH_RISK"|"IMMEDIATE_DANGER",
//     consecutiveNormalCount: number,   // for SENSITIVE decay (Stage 3 §3)
//     awaitingClarification: boolean,   // for UNCERTAIN's one-round rule
//   }

const TIER_ORDER = ["NORMAL", "SENSITIVE", "HIGH_RISK", "IMMEDIATE_DANGER"];
const STICKY_TIERS = new Set(["HIGH_RISK", "IMMEDIATE_DANGER"]);
const SENSITIVE_DECAY_THRESHOLD = 3; // consecutive NORMAL reads to decay SENSITIVE -> NORMAL

function tierRank(tier) {
  const i = TIER_ORDER.indexOf(tier);
  return i === -1 ? -1 : i;
}

function isValidTier(tier) {
  return tierRank(tier) !== -1;
}

function defaultSessionState() {
  return { tier: "NORMAL", consecutiveNormalCount: 0, awaitingClarification: false };
}

/**
 * Given the current session state and a fresh classification, returns the
 * NEW session state. `classification` is what _safetyEngine.classify()
 * returns: { tier, confidence, ... } where tier is one of
 * NORMAL|SENSITIVE|UNCERTAIN|HIGH_RISK|IMMEDIATE_DANGER.
 *
 * Implements, exactly as approved:
 *   - monotonic high-water mark: newTier = max(currentTier, classifiedTier)
 *     using NORMAL < SENSITIVE < HIGH_RISK < IMMEDIATE_DANGER (UNCERTAIN is
 *     not in this ordering at all — see below).
 *   - escalation may skip levels (NORMAL -> IMMEDIATE_DANGER in one step).
 *   - HIGH_RISK/IMMEDIATE_DANGER are sticky for the rest of the session:
 *     once reached, this function can never return a lower tier for that
 *     session again, regardless of what any later classification says.
 *   - SENSITIVE decays to NORMAL after 3 consecutive NORMAL classifications
 *     — but only ever FROM SENSITIVE (never through/from a sticky tier).
 *   - UNCERTAIN does not change tier on its own. It sets
 *     awaitingClarification=true. The classification that answers the
 *     clarifying question is what actually resolves the state, via a
 *     normal call to this function with that answer's real tier. If the
 *     answer is ALSO UNCERTAIN, this function does not clarify a second
 *     time — it treats the unresolved ambiguity itself as SENSITIVE (fail
 *     toward caution, not toward silence), bounding the clarify loop to
 *     exactly one round.
 *
 * @param {{ tier: string, consecutiveNormalCount?: number, awaitingClarification?: boolean }} currentState
 * @param {{ tier: string }} classification
 * @returns {{ tier: string, consecutiveNormalCount: number, awaitingClarification: boolean, escalated: boolean }}
 */
function nextSessionState(currentState, classification) {
  const current = {
    tier: isValidTier(currentState?.tier) ? currentState.tier : "NORMAL",
    consecutiveNormalCount: Number.isInteger(currentState?.consecutiveNormalCount) ? currentState.consecutiveNormalCount : 0,
    awaitingClarification: Boolean(currentState?.awaitingClarification),
  };

  const classifiedTier = classification?.tier;

  // UNCERTAIN — the deliberate exception to "session state" (Stage 3 §3).
  if (classifiedTier === "UNCERTAIN") {
    if (current.awaitingClarification) {
      // Second consecutive UNCERTAIN with no resolution: bounded to exactly
      // one clarification round. Fail toward caution (treat as SENSITIVE),
      // never toward silence (never toward "still NORMAL, keep asking").
      return nextSessionState(
        { ...current, awaitingClarification: false },
        { tier: "SENSITIVE" }
      );
    }
    return { ...current, awaitingClarification: true, escalated: false };
  }

  if (!isValidTier(classifiedTier)) {
    // Should never happen if the caller treats malformed classifier output
    // as a supervisor failure (per the approved design) rather than calling
    // this function at all — but fail closed here too: an unrecognized
    // tier is never silently treated as NORMAL.
    throw new Error(`nextSessionState: invalid classification tier "${classifiedTier}"`);
  }

  // Sticky floor: once HIGH_RISK/IMMEDIATE_DANGER is reached, no later
  // classification — of any tier, including another UNCERTAIN resolving to
  // something lower — can ever pull the session below it.
  if (STICKY_TIERS.has(current.tier)) {
    const newTier = tierRank(classifiedTier) > tierRank(current.tier) ? classifiedTier : current.tier;
    return {
      tier: newTier,
      consecutiveNormalCount: 0, // sticky tiers never decay; count is moot
      awaitingClarification: false,
      escalated: newTier !== current.tier,
    };
  }

  const newTier = tierRank(classifiedTier) > tierRank(current.tier) ? classifiedTier : current.tier;

  // SENSITIVE decay — only ever FROM SENSITIVE, only via consecutive NORMAL
  // reads, never through/from a sticky tier (unreachable here — handled
  // above already).
  let consecutiveNormalCount = current.consecutiveNormalCount;
  let finalTier = newTier;

  if (newTier === "SENSITIVE" && classifiedTier === "NORMAL") {
    consecutiveNormalCount += 1;
    if (consecutiveNormalCount >= SENSITIVE_DECAY_THRESHOLD) {
      finalTier = "NORMAL";
      consecutiveNormalCount = 0;
    }
  } else if (classifiedTier === "NORMAL" && newTier === "NORMAL") {
    consecutiveNormalCount = 0;
  } else {
    // Any non-NORMAL classification resets the decay counter — decay
    // requires CONSECUTIVE NORMAL reads, not merely "mostly normal."
    consecutiveNormalCount = 0;
  }

  return {
    tier: finalTier,
    consecutiveNormalCount,
    awaitingClarification: false,
    escalated: tierRank(finalTier) > tierRank(current.tier),
  };
}

/**
 * Given a tier and the current session state, returns what Jona's delivery
 * layer should do THIS turn. Delivery-mechanism-agnostic — Ask Jona and
 * Talk with Jona both consume this the same way, per the approved shared-
 * policy architecture (Stage 3 §1).
 * @param {{ tier: string, awaitingClarification?: boolean }} state
 * @returns {"continue_normal"|"gentle_clarify"|"safer_guidance"|"restricted_support"|"restricted_safety_pathway"}
 */
function responseStrategyFor(state) {
  if (state?.awaitingClarification) return "gentle_clarify";
  switch (state?.tier) {
    case "NORMAL":    return "continue_normal";
    case "SENSITIVE": return "safer_guidance";
    case "HIGH_RISK": return "restricted_support";
    case "IMMEDIATE_DANGER": return "restricted_safety_pathway";
    default: throw new Error(`responseStrategyFor: invalid tier "${state?.tier}"`);
  }
}

/**
 * Talk with Jona (Live) specific — what the client should be TOLD to do,
 * beyond Jona's own tone. SENSITIVE gets no directive (in-conversation
 * steering only, Stage 3 §4). HIGH_RISK/IMMEDIATE_DANGER get an explicit
 * directive object the client's onSnapshot listener reacts to.
 *
 * IMMEDIATE_DANGER's action name matches the approved Stage 3 Revision
 * (§1): "restricted_safety_pathway", NOT "end_session_immediate_danger" —
 * the session transitions to the bounded non-Live pathway (Option C)
 * rather than ending outright on first detection.
 * @param {string} tier
 * @returns {null | { action: string }}
 */
function interventionDirectiveFor(tier) {
  if (tier === "HIGH_RISK") return { action: "reconnect_restricted_live" };
  if (tier === "IMMEDIATE_DANGER") return { action: "restricted_safety_pathway" };
  return null;
}

module.exports = {
  TIER_ORDER,
  STICKY_TIERS,
  SENSITIVE_DECAY_THRESHOLD,
  tierRank,
  isValidTier,
  defaultSessionState,
  nextSessionState,
  responseStrategyFor,
  interventionDirectiveFor,
};
