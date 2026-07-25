import { useAuth } from "../hooks/useAuth";
import AppShell from "./components/AppShell";
import JonaCoach from "./coach/JonaCoach";

export default function PreviewCoach() {
  const { user } = useAuth();
  return (
    <AppShell active="coach">
      <JonaCoach user={user} />
    </AppShell>
  );
}
