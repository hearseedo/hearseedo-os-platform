import { useAuth } from "../hooks/useAuth";
import AppShell from "./components/AppShell";
import IndividualHome from "./home/IndividualHome";
import FamilyHome from "./home/FamilyHome";

// QA-only fixture — never used for a real signed-in user (see the `!user`
// guard below). Lets /preview/home-dev?family=1 exercise the Family Home
// layout without needing real Firestore family data.
const MOCK_FAMILY_PREVIEW_USER = {
  name: "Preview Family", accountType: "family", streak: 4, confidenceScore: 58,
  familyMembers: [
    { id: "m1", name: "Maya", age: 8, confidenceScore: 62 },
    { id: "m2", name: "Kenji", age: 11, confidenceScore: 45 },
  ],
};

// Phase 3 preview — NOT linked from production nav. Reachable behind the
// living-blueprint feature flag at /preview/home. Renders Family Home when
// the real profile's accountType is "family" (or has family members),
// otherwise Individual Home — same switch the live Dashboard.jsx does today.
export default function PreviewHome() {
  const { user } = useAuth();
  const forceFamilyPreview = !user && new URLSearchParams(window.location.search).get("family") === "1";
  const effectiveUser = forceFamilyPreview ? MOCK_FAMILY_PREVIEW_USER : user;
  const isFamily = effectiveUser?.accountType === "family" || (effectiveUser?.familyMembers?.length ?? 0) > 0;

  return (
    <AppShell active="home" showFamily={isFamily}>
      {isFamily ? <FamilyHome user={effectiveUser} /> : <IndividualHome user={effectiveUser} />}
    </AppShell>
  );
}
