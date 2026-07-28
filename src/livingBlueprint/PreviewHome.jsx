import { useAuth } from "../hooks/useAuth";
import AppShell from "./components/AppShell";
import IndividualHome from "./home/IndividualHome";

// Phase 3 preview — NOT linked from production nav. Reachable behind the
// living-blueprint feature flag at /preview/home. Always renders Individual
// Home — your personal daily view, regardless of account type. Family Home
// is its own destination now (PreviewFamily.jsx / "Family" nav item), per
// rebuild prompt section 4: Home and Family are separate nav destinations,
// not one page that swallows the other.
export default function PreviewHome() {
  const { user } = useAuth();
  const isFamily = user?.accountType === "family" || (user?.familyMembers?.length ?? 0) > 0;

  return (
    <AppShell active="home" showFamily={isFamily}>
      <IndividualHome user={user} />
    </AppShell>
  );
}
