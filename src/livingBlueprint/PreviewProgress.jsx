import { useAuth } from "../hooks/useAuth";
import AppShell from "./components/AppShell";
import LivingBlueprint from "./progress/LivingBlueprint";

export default function PreviewProgress() {
  const { user } = useAuth();
  return (
    <AppShell active="progress">
      <LivingBlueprint user={user} />
    </AppShell>
  );
}
