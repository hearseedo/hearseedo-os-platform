import { useAuth } from "../hooks/useAuth";
import AppShell from "./components/AppShell";
import CalendarPanel from "./calendar/CalendarPanel";

export default function PreviewCalendar() {
  const { user } = useAuth();
  return (
    <AppShell active="more">
      <CalendarPanel user={user} />
    </AppShell>
  );
}
