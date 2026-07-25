import { useAuth } from "../hooks/useAuth";
import AppShell from "./components/AppShell";
import RewardsPanel from "./rewards/RewardsPanel";

export default function PreviewRewards() {
  const { user } = useAuth();
  return (
    <AppShell active="more">
      <RewardsPanel user={user} />
    </AppShell>
  );
}
