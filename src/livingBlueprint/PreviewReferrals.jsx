import { useAuth } from "../hooks/useAuth";
import AppShell from "./components/AppShell";
import ReferralPanel from "./referrals/ReferralPanel";

export default function PreviewReferrals() {
  const { user } = useAuth();
  return (
    <AppShell active="more">
      <ReferralPanel user={user} />
    </AppShell>
  );
}
