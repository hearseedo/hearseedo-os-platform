import { useNavigate } from "react-router-dom";
import { TOKENS } from "../../constants/tokens";
import JonaInbox from "../../components/JonaInbox";
import { useNotifications } from "./useNotifications";

// Rebuild prompt section 4 — Messages / AI Inbox. Reuses the real,
// already-shipped JonaInbox component and users/{uid}/notifications data
// (same as the live Dashboard) instead of rebuilding an inbox UI from
// scratch — genuine notifications, not mock content.
export default function MessagesPanel({ user }) {
  const navigate = useNavigate();
  const { notifications, dismiss, dismissAll } = useNotifications(user?.uid);

  if (!user) {
    return <div style={{ color: TOKENS.color.textMuted }}>Sign in to see your messages.</div>;
  }

  function handleAction(action) {
    if (action?.type === "navigate" && action.to) navigate(action.to);
  }

  return (
    <div>
      <div style={{ marginBottom: TOKENS.space[4] }}>
        <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 4 }}>MESSAGES</div>
        <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800 }}>Your Inbox</h1>
      </div>
      <JonaInbox
        notifications={notifications}
        onDismiss={dismiss}
        onDismissAll={dismissAll}
        onClose={() => navigate("/preview/home")}
        onAction={handleAction}
      />
    </div>
  );
}
