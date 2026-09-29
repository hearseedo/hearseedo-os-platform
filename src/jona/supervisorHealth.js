// Talk with Jona (Gemini Live) — Gate B Stage 4V fix: client-side
// supervisor-health enforcement. See
// docs/JONA_LIVE_SAFETY_GATE_B_STAGE3_FINAL_ARCHITECTURE_2026-09-28.md §5
// for the approved thresholds this implements.
//
// The confirmed Stage 4V blocker this closes: the server (live-transcript-
// classify.js) already tracked supervisorConsecutiveFailures/supervisorStatus,
// but nothing on the client ever read or acted on it — a degraded/
// unreachable supervisor left ordinary Live running unrestricted and
// unsupervised, indefinitely. This module is the missing enforcement.
//
// Pure, timer-injectable state machine — no Firestore, no fetch, no React —
// so all 15+ required scenarios (including timer races and stale-timer
// safety) are deterministic and testable without real timers or a network
// call. The caller (TalkWithJona.jsx) is responsible for:
//   - feeding it EVERY outcome of a transcript-forward attempt via
//     recordSuccess()/recordFailure() (a client-side network failure counts
//     as a failure exactly like a server-reported one — the whole point is
//     this must not depend purely on "fetch returned 200"),
//   - feeding it the server's own authoritative supervisorStatus via
//     applyServerStatus() whenever the session doc's onSnapshot fires
//     (server-held state takes priority wherever available),
//   - calling reset() on every new/reconnected session so a timer from a
//     previous session can never affect a new one,
//   - calling dispose() on session end so no timer outlives the session.
//
// Conceptual chain, as approved: HEALTHY -> DEGRADED -> RECOVERY ->
// UNSUPERVISED/STOP. This implementation merges DEGRADED and RECOVERY into
// one observable state ("degraded") because in this design the recovery
// window is armed in the exact same instant the failure threshold is
// crossed — there is no separate "degraded but not yet attempting
// recovery" interval to distinguish. "stopped" is the terminal
// UNSUPERVISED/STOP state; recovery succeeding returns to "healthy".

const DEFAULT_DEGRADED_AFTER_CONSECUTIVE_FAILURES = 2;
const DEFAULT_RECOVERY_WINDOW_MS = 12500;      // Stage 3 §5: "10-15 seconds"
const DEFAULT_STRICT_RECOVERY_WINDOW_MS = 4000; // shorter for an already-elevated (HIGH_RISK/IMMEDIATE_DANGER) session — Stage 3 §5's "skip or shorten" instruction

/**
 * @param {{
 *   degradedAfterConsecutiveFailures?: number,
 *   recoveryWindowMs?: number,
 *   strictRecoveryWindowMs?: number,
 *   now?: () => number,
 *   setTimeout?: typeof setTimeout,
 *   clearTimeout?: typeof clearTimeout,
 *   onUnsupervised?: () => void,
 * }} [opts]
 */
export function createSupervisorHealthTracker(opts = {}) {
  const {
    degradedAfterConsecutiveFailures = DEFAULT_DEGRADED_AFTER_CONSECUTIVE_FAILURES,
    recoveryWindowMs = DEFAULT_RECOVERY_WINDOW_MS,
    strictRecoveryWindowMs = DEFAULT_STRICT_RECOVERY_WINDOW_MS,
    now = () => Date.now(),
    setTimeout: setTimeoutImpl = setTimeout,
    clearTimeout: clearTimeoutImpl = clearTimeout,
    onUnsupervised = () => {},
  } = opts;

  let status = "healthy"; // "healthy" | "degraded" | "stopped"
  let consecutiveFailures = 0;
  let recoveryTimerId = null;
  // Bumped on every reset() (i.e. every new/reconnected session). A timer
  // captures the token it was armed under; if that token no longer matches
  // when the timer fires, the timer is stale (belongs to a session that
  // has since ended or been superseded) and must be a no-op — this is
  // what makes "a stale timer from a previous session cannot terminate a
  // newly opened session" true by construction, not by convention.
  let sessionToken = 0;

  function clearArmedTimer() {
    if (recoveryTimerId !== null) {
      clearTimeoutImpl(recoveryTimerId);
      recoveryTimerId = null;
    }
  }

  function armRecoveryWindow(windowMs) {
    clearArmedTimer();
    const tokenAtArm = sessionToken;
    recoveryTimerId = setTimeoutImpl(() => {
      recoveryTimerId = null;
      if (tokenAtArm !== sessionToken) return; // stale — superseded by reset()
      if (status !== "degraded") return;       // already recovered or stopped
      status = "stopped";
      onUnsupervised();
    }, windowMs);
  }

  /**
   * A transcript-forward attempt (or an explicit server-reported failure on
   * one) succeeded. Resets the consecutive-failure count and, if currently
   * degraded, restores healthy status and cancels the recovery timer —
   * "successful supervision during recovery restores normal supervisor
   * health."
   */
  function recordSuccess() {
    if (status === "stopped") return; // already terminated; nothing to recover into
    consecutiveFailures = 0;
    if (status === "degraded") {
      status = "healthy";
      clearArmedTimer();
    }
  }

  /**
   * A transcript-forward attempt failed to prove healthy supervision —
   * this covers a server-reported classification failure (malformed
   * output, non-ok HTTP status) AND a client-side network failure/timeout
   * (the fetch itself never completed) identically, per the explicit
   * instruction that a client network failure must also count.
   * @param {{ isElevated?: boolean }} [ctx] — pass isElevated:true when the
   *   session's current safety tier is HIGH_RISK/IMMEDIATE_DANGER, for the
   *   shorter/stricter recovery window.
   */
  function recordFailure(ctx = {}) {
    if (status === "stopped") return;
    consecutiveFailures += 1;
    if (status === "healthy" && consecutiveFailures >= degradedAfterConsecutiveFailures) {
      status = "degraded";
      armRecoveryWindow(ctx.isElevated ? strictRecoveryWindowMs : recoveryWindowMs);
    }
  }

  /**
   * Applies the SERVER's own authoritative supervisorStatus ("ok"|
   * "degraded"), as read from the session doc's onSnapshot listener —
   * preferred over inferring health purely from this client's own fetch
   * outcomes, per the explicit instruction to use server-held state
   * wherever practical. Safe to call redundantly alongside
   * recordSuccess()/recordFailure() — both converge on the same state
   * machine and neither can un-stop a stopped tracker.
   * @param {"ok"|"degraded"} serverStatus
   * @param {{ isElevated?: boolean }} [ctx]
   */
  function applyServerStatus(serverStatus, ctx = {}) {
    if (status === "stopped") return;
    if (serverStatus === "ok") {
      recordSuccess();
    } else if (serverStatus === "degraded" && status === "healthy") {
      status = "degraded";
      armRecoveryWindow(ctx.isElevated ? strictRecoveryWindowMs : recoveryWindowMs);
    }
  }

  function getStatus() {
    return status;
  }

  function getConsecutiveFailures() {
    return consecutiveFailures;
  }

  /**
   * Starts tracking a new/reconnected session. Invalidates any
   * still-pending recovery timer from a prior session (it will no-op if it
   * fires) and returns to healthy — a genuinely new session is never
   * penalized for a prior session's supervisor trouble.
   */
  function reset() {
    sessionToken += 1;
    clearArmedTimer();
    status = "healthy";
    consecutiveFailures = 0;
  }

  /** Permanently stops timer activity — call on session end/unmount. */
  function dispose() {
    sessionToken += 1; // invalidate any in-flight timer defensively
    clearArmedTimer();
  }

  return {
    recordSuccess,
    recordFailure,
    applyServerStatus,
    getStatus,
    getConsecutiveFailures,
    reset,
    dispose,
  };
}
