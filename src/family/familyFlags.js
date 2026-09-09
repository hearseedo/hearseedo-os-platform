// HSD Family — feature flags / kill switches (Phase 4, item 23).
//
// Deliberately reuses the config/killSwitch SHAPE (public read, admin/
// service-account-only write) rather than the Phase-0-era open-write
// mistake — see firestore.rules' familyFlags comment. A separate document
// from config/killSwitch so Family can be toggled independently of the
// platform-wide AI kill switch.
import { db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export const DEFAULT_FLAGS = {
  familyEnabled:       true,  // disable the whole /family entry
  jonaFamilyEnabled:   true,  // disable Talk to Jona / Create (both use Jona)
  ttsEnabled:          true,  // reserved — no TTS wired into Family yet (Phase 3)
  betaInvitesEnabled:  true,  // disable new invite redemption without touching existing families
  disabledActivityIds: [],    // per-activity kill switch (item 23: "disable individual broken activities")
};

export function subscribeToFamilyFlags(onChange) {
  return onSnapshot(doc(db, "familyFlags", "current"), (snap) => {
    onChange(snap.exists() ? { ...DEFAULT_FLAGS, ...snap.data() } : DEFAULT_FLAGS);
  }, () => onChange(DEFAULT_FLAGS)); // fail open to defaults on read error, not fail closed on children
}
