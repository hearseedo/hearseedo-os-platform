import { useAuth } from "../hooks/useAuth";
import AppShell from "./components/AppShell";
import MembershipPanel from "./membership/MembershipPanel";

export default function PreviewMembership() {
  const { user } = useAuth();
  return (
    <AppShell active="more">
      <MembershipPanel user={user} />
    </AppShell>
  );
}
