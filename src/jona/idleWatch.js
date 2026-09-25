// Talk with Jona (Gemini Live) — idle check-in / disconnect state machine.
// Extracted from TalkWithJona.jsx (2026-09-25 idle-timing bug fix) into a
// pure, dependency-injected module specifically so it can be unit tested
// directly — the previous version lived entirely as closures inside a
// React effect, which cannot be exercised by an automated test without a
// full browser/DOM/timer harness. `schedule`/`unschedule` are injectable
// (default to real setTimeout/clearTimeout) so tests can use a fake
// scheduler and advance state deterministically without real waiting.
//
// Intended state machine (per the redesign brief):
//   USER finishes meaningful speech -> Jona thinks -> Jona speaks ->
//   Jona finishes speaking -> Jona is now waiting for the learner ->
//   START the idle clock -> idleCheckSeconds of silence -> Jona checks in
//   ("Are you still there?") -> Jona finishes that check-in -> ONLY the
//   remaining grace window (idleDisconnectSeconds - idleCheckSeconds,
//   floor 5s) -> no meaningful response -> disconnect with "idle_timeout".
//   A meaningful reply at any point resets fully back to the start.
//
// The check-in is a warning INSIDE the same idle cycle, not a new 45s
// cycle of its own — `idlePhase` below ("active" -> "checkinSent" ->
// "awaitingFinal") is what enforces that distinction.
//
// Root cause of the original ~2-minute bug (2026-09-25, confirmed via
// manual testing): Gemini's own VAD runs continuously on the mic,
// including during the idle wait itself — a barge-in-shaped
// `interrupted` signal can arrive even when Jona wasn't actually
// speaking (background noise, room sound). The original caller treated
// every such signal as real learner activity and force-reset the whole
// idle cycle unconditionally. `onBargeIn` below only resets when told the
// signal genuinely interrupted speech in progress (`wasActuallySpeaking`)
// — the caller (TalkWithJona.jsx) is responsible for knowing whether Jona
// was actually speaking when the signal arrived.
export function createIdleWatch({
  idleCheckSeconds,
  idleDisconnectSeconds,
  onCheckIn,
  onDisconnect,
  schedule = (fn, ms) => setTimeout(fn, ms),
  unschedule = (id) => clearTimeout(id),
}) {
  let idlePhase = "active"; // active | checkinSent | awaitingFinal
  let timerId = null;
  let stopped = false;

  function clear() {
    if (timerId != null) { unschedule(timerId); timerId = null; }
  }

  function armCheck() {
    clear();
    timerId = schedule(() => {
      idlePhase = "checkinSent";
      onCheckIn();
    }, idleCheckSeconds * 1000);
  }

  // Called whenever the conversation genuinely arrives at "now waiting for
  // the learner" — a fresh start, a real reply, or a real barge-in.
  // `isCheckInCompleting` distinguishes "Jona just finished delivering its
  // OWN check-in line" (move to the short final grace window, not a new
  // full cycle) from every other arrival (full reset).
  function onEnterListening(isCheckInCompleting) {
    if (stopped) return;
    if (isCheckInCompleting && idlePhase === "checkinSent") {
      idlePhase = "awaitingFinal";
      const finalSeconds = Math.max(5, idleDisconnectSeconds - idleCheckSeconds);
      timerId = schedule(() => onDisconnect(), finalSeconds * 1000);
      return;
    }
    idlePhase = "active";
    armCheck();
  }

  // Jona is now thinking/speaking — never counts against the learner,
  // whether it's a real reply or Jona's own check-in/warning line. Also
  // cancels a pending disconnect if the learner replied during the grace
  // window (the reply itself routes back through onEnterListening once
  // Jona's response to it completes, which performs the actual reset).
  function onLeaveListening() {
    if (stopped) return;
    clear();
  }

  // A native interruption signal arrived. Only counts as real learner
  // activity when it genuinely interrupted Jona mid-speech — a signal
  // arriving while already "listening" (nothing being said) is spurious
  // (background noise, VAD false-positive) and must be ignored entirely,
  // not treated as a full reset.
  function onBargeIn(wasActuallySpeaking) {
    if (stopped) return;
    if (wasActuallySpeaking) onEnterListening(false);
  }

  // A deliberate UI interaction (e.g. tapping the card) counts as "still
  // here" too. `isCurrentlyListening` tells this whether to restart the
  // check timer now or just clear pending timers (a real arrival at
  // listening will (re)start it).
  function resetOnInteraction(isCurrentlyListening) {
    if (stopped) return;
    idlePhase = "active";
    if (isCurrentlyListening) armCheck(); else clear();
  }

  function stop() {
    stopped = true;
    clear();
  }

  function getPhase() {
    return idlePhase; // exposed for tests; not needed by production callers
  }

  return { onEnterListening, onLeaveListening, onBargeIn, resetOnInteraction, stop, getPhase };
}
