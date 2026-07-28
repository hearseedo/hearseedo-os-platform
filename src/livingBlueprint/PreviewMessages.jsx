import { useAuth } from "../hooks/useAuth";
import AppShell from "./components/AppShell";
import MessagesPanel from "./messages/MessagesPanel";

export default function PreviewMessages() {
  const { user } = useAuth();
  return (
    <AppShell active="messages">
      <MessagesPanel user={user} />
    </AppShell>
  );
}
