import { useAuth } from "../hooks/useAuth";
import AppShell from "./components/AppShell";
import FamilyHome from "./home/FamilyHome";
import { TOKENS } from "../constants/tokens";

// QA-only fixture — never used for a real signed-in user (see the `!user`
// guard below). Lets /preview/family-dev?family=1 exercise the layout
// without needing real Firestore family data.
const MOCK_FAMILY_PREVIEW_USER = {
  name: "Preview Family", accountType: "family", streak: 4, confidenceScore: 58,
  familyMembers: [
    { id: "m1", name: "Maya", age: 8, confidenceScore: 62 },
    { id: "m2", name: "Kenji", age: 11, confidenceScore: 45 },
  ],
};

// Rebuild prompt section 7 — Family Home, its own nav destination
// (previously this content only lived inside /preview/home, indistinguishable
// from Individual Home for family accounts — see the "Family and Home are
// the same" fix). Shown to accounts with family data; others see an
// explanatory empty state rather than a blank/broken page.
export default function PreviewFamily() {
  const { user } = useAuth();
  const forceFamilyPreview = !user && new URLSearchParams(window.location.search).get("family") === "1";
  const effectiveUser = forceFamilyPreview ? MOCK_FAMILY_PREVIEW_USER : user;
  const isFamily = effectiveUser?.accountType === "family" || (effectiveUser?.familyMembers?.length ?? 0) > 0;

  return (
    <AppShell active="family" showFamily={isFamily}>
      {isFamily ? (
        <FamilyHome user={effectiveUser} />
      ) : (
        <div style={{ color: TOKENS.color.textMuted, textAlign: "center", padding: "80px 20px" }}>
          <div style={{ fontWeight: 700, fontSize: TOKENS.font.size.lg, color: TOKENS.color.starlight, marginBottom: 8 }}>
            No family added yet
          </div>
          <div>Add family members during onboarding or from Settings to see your shared constellation here.</div>
        </div>
      )}
    </AppShell>
  );
}
