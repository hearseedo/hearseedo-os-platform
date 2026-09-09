// HSD OS AI — pathway/profile analytics foundation (Phase 1, 2026-09-09).
//
// Reuses the existing append-only-log pattern already used for adminLogs/
// geminiActivity (firestore.rules: allow create: if request.auth != null,
// no read for non-admins, no update/delete) rather than introducing any new
// analytics platform. Fire-and-forget by design — an analytics write must
// never block or fail a real user action.
import { db } from "./firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

// Phase 1 defines these four event names; nothing calls profile_created yet
// (profile creation already existed pre-Phase-1 in FamilySetup.jsx — wiring
// that call is a small follow-up, not done here to keep this change scoped
// to the account/profile/pathway data model itself).
export const PATHWAY_EVENTS = {
  PATHWAY_SELECTED:           "pathway_selected",
  PATHWAY_SWITCHED:           "pathway_switched",
  PROFILE_SELECTED:           "profile_selected",
  PROFILE_CREATED:            "profile_created",
  // Phase 2
  PATHWAY_SELECTOR_VIEWED:    "pathway_selector_viewed",
  PATHWAY_ONBOARDING_STARTED: "pathway_onboarding_started",
};

export function logPathwayEvent(uid, eventType, data = {}) {
  addDoc(collection(db, "pathwayEvents"), {
    uid,
    eventType,
    ...data,
    timestamp: serverTimestamp(),
  }).catch(() => {}); // best-effort — never block on analytics
}
