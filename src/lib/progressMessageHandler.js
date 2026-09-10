// HSD OS AI — pure HSD_OS_PROGRESS message-handling logic (staging bug fix,
// 2026-09-10).
//
// No Firebase import, deliberately — same reasoning as curriculumRouting.js
// and curriculumProgressSync.js: this is the exact sequencing bug that broke
// curriculum-progress recording for every iframe_app activity, and it needs
// to be directly unit-testable. AppModal.jsx imports this and wires in the
// real Firestore legacy write / processAppEvent().
//
// The bug: the legacy `users/{uid}/appProgress/{module}` write and
// processAppEvent() used to share one try/catch. firestore.rules has no
// allow-rule for that legacy collection at all (default-deny), so the write
// always threw, and the empty catch silently skipped processAppEvent()
// too — curriculum-progress was never recorded, for any app, ever.
//
// The fix: the legacy write gets its own try/catch, its failure is
// swallowed (never blocks anything) and only ever logged as a category-only
// note — no event contents (uid, module, profileId, lessonId, etc.) ever
// reach the log. processAppEvent() always runs and its result is always
// awaited and returned, regardless of the legacy write's outcome.

// Field-shape validation for an incoming HSD_OS_PROGRESS payload — rejects
// anything that doesn't look like a real progress event before it ever
// reaches processAppEvent()/Firestore. Deliberately permissive on which
// fields may be PRESENT (other apps send different shapes) but strict on
// the TYPE of whichever fields are present.
export function isPlausibleProgressPayload(data) {
  if (!data || typeof data !== "object") return false;
  if (data.module !== undefined && typeof data.module !== "string") return false;
  if (data.profileId !== undefined && data.profileId !== null && typeof data.profileId !== "string") return false;
  if (data.lessonId !== undefined && typeof data.lessonId !== "string") return false;
  if (data.curriculumId !== undefined && typeof data.curriculumId !== "string") return false;
  return true;
}

/**
 * Runs the legacy appProgress write (best-effort, isolated) and then always
 * runs processEvent — the one that actually matters for curriculum
 * progress and everything else processAppEvent() does. Never throws: a
 * legacyWrite failure is caught and logged (sanitized, no event contents);
 * a processEvent failure is the caller's problem (processAppEvent() itself
 * already catches its own internal errors and returns a result object, per
 * src/lib/appEvents.js).
 *
 * @param {() => Promise<any>} legacyWrite - the old users/{uid}/appProgress write
 * @param {() => Promise<any>} processEvent - processAppEvent(uid, enrichedEvent)
 * @param {(message: string) => void} [log] - injectable logger, defaults to console.warn
 * @returns {Promise<any>} processEvent's result, always awaited and returned
 */
export async function handleProgressMessage({ legacyWrite, processEvent, log }) {
  const warn = log ?? ((msg) => console.warn(msg));
  try {
    await legacyWrite();
  } catch {
    // Known-expected failure path (no Firestore rule covers this legacy
    // collection) — sanitized, category-only note. Never includes the
    // event's own contents.
    warn("[app-progress] legacy write failed (expected: no Firestore rule covers this collection) — curriculum sync continues independently");
  }
  // Always runs, always awaited, regardless of the legacy write's outcome.
  return processEvent();
}
