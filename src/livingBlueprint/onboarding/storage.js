// Living Blueprint onboarding — persistence
// Rebuild prompt section 5: "Persist every completed step so the user can
// safely leave and return. Never lose entered family members or answers."
//
// localStorage is the source of truth for resuming mid-flow (works for both
// the authenticated preview and the unauthenticated dev-QA route). When a
// real user is signed in, state is additionally merged into a new,
// non-colliding Firestore field (users/{uid}.livingBlueprintOnboarding) —
// additive only, never touches the existing setupDone/accountType fields
// the live app already relies on.

import { doc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

const KEY_PREFIX = "lb_onboarding_";

export const emptyOnboardingState = () => ({
  step: 1,
  accountType: null,        // "solo" | "family" | "school" | "organization"
  familyMembers: [],        // [{ id, name, role, age }]
  answers: {},              // { [memberId]: { helpWith: "..." } }
});

function keyFor(uid) {
  return `${KEY_PREFIX}${uid || "guest"}`;
}

export function loadOnboardingState(uid) {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    if (!raw) return emptyOnboardingState();
    return { ...emptyOnboardingState(), ...JSON.parse(raw) };
  } catch {
    return emptyOnboardingState();
  }
}

export function saveOnboardingState(uid, state) {
  try {
    localStorage.setItem(keyFor(uid), JSON.stringify(state));
  } catch {}

  if (uid) {
    setDoc(doc(db, "users", uid), { livingBlueprintOnboarding: state }, { merge: true })
      .catch(err => console.error("livingBlueprintOnboarding save failed:", err));
  }
}

export function clearOnboardingState(uid) {
  try {
    localStorage.removeItem(keyFor(uid));
  } catch {}
}
