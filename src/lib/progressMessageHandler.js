// HSD OS AI — pure HSD_OS_PROGRESS message-handling logic.
//
// No Firebase import, deliberately — same reasoning as curriculumRouting.js
// and curriculumProgressSync.js: this needs to be directly unit-testable.
// AppModal.jsx imports isPlausibleProgressPayload and wires it in before
// calling processAppEvent() (src/lib/appEvents.js) with the validated event.
//
// Phase 3.4 (2026-09-12): this file used to also export
// handleProgressMessage(), which isolated a legacy users/{uid}/appProgress
// write from processAppEvent() so the (always-permission-denied) legacy
// write's failure could never block curriculum-progress recording. That
// legacy write has since been removed outright (an audit confirmed nothing
// ever read that collection — see docs/PHASE_3_3_DIAGNOSTICS.md and
// docs/PHASE_3_4_DATA_MODEL.md), so there is nothing left to isolate:
// AppModal.jsx now calls processAppEvent() directly.

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
