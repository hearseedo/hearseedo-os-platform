import { COLORS } from "../constants/colors";

// ── Category config ────────────────────────────────────────────────────────

const CATS = {
  streak:  { label: "Streak",       color: "#f97316", emoji: "🔥" },
  mission: { label: "Mission",      color: "#22c55e", emoji: "✅" },
  weekly:  { label: "Weekly",       color: "#C9A84C", emoji: "📊" },
  return:  { label: "Welcome Back", color: "#e01010", emoji: "👋" },
  feature: { label: "New",          color: "#8b5cf6", emoji: "✨" },
  message: { label: "Message",      color: "#06b6d4", emoji: "💌" },
};

function cat(category) {
  return CATS[category] ?? CATS.message;
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function JonaInbox({ notifications, onDismiss, onDismissAll, onClose, onAction }) {
  const unread = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300, backdropFilter: "blur(2px)" }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(420px, 100vw)",
        background: COLORS.surface,
        borderLeft: "1px solid #222",
        zIndex: 301,
        display: "flex", flexDirection: "column",
        animation: "jonaInboxIn 0.32s cubic-bezier(0.16,1,0.3,1) forwards",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.6)",
      }}>
        <style>{`@keyframes jonaInboxIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* ── Header ── */}
        <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid #1e1e1e", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%", overflow: "hidden",
              border: "2px solid rgba(224,16,16,0.5)",
              boxShadow: "0 0 14px rgba(224,16,16,0.28)",
              flexShrink: 0,
            }}>
              <img src="/assets/jona.png" alt="Jona" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: COLORS.red, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>JONA</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, display: "flex", alignItems: "center", gap: 8 }}>
                Inbox
                {unread > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: COLORS.red, borderRadius: 10, padding: "2px 8px" }}>
                    {unread}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: "50%", background: "#1a1a1a", border: "1px solid #2a2a2a", color: COLORS.textMuted, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
          {unread > 0 && (
            <button
              onClick={onDismissAll}
              style={{ fontSize: 11, color: COLORS.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0, letterSpacing: 0.3 }}
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* ── Message list ── */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 20 }}>
          {notifications.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>📭</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}>All caught up</div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6 }}>
                Jona will message you about milestones, missions, and what's new.
              </div>
            </div>
          ) : (
            notifications.map(notif => {
              const c = cat(notif.category);
              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.read && onDismiss(notif.id)}
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid #181818",
                    background: notif.read ? "transparent" : "rgba(255,255,255,0.015)",
                    cursor: notif.read ? "default" : "pointer",
                    transition: "background 0.15s",
                    display: "flex", gap: 12, alignItems: "flex-start",
                  }}
                >
                  {/* Left accent stripe */}
                  <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: notif.read ? "#222" : c.color, flexShrink: 0 }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Top row: category tag + time + unread dot */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                        color: c.color, background: `${c.color}18`,
                        border: `1px solid ${c.color}38`,
                        borderRadius: 4, padding: "2px 8px",
                      }}>
                        {c.emoji} {c.label}
                      </span>
                      <span style={{ fontSize: 11, color: COLORS.textDim, marginLeft: "auto" }}>{timeAgo(notif.createdAt)}</span>
                      {!notif.read && (
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.red, flexShrink: 0, boxShadow: "0 0 6px rgba(224,16,16,0.6)" }} />
                      )}
                    </div>

                    {/* Title */}
                    {notif.title && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: notif.read ? COLORS.textMuted : COLORS.text, marginBottom: 4, lineHeight: 1.4 }}>
                        {notif.title}
                      </div>
                    )}

                    {/* Body */}
                    <div style={{ fontSize: 13, color: notif.read ? "#4a4a4a" : "#999", lineHeight: 1.65, marginBottom: notif.action ? 12 : 0 }}>
                      {notif.message}
                    </div>

                    {/* Action button */}
                    {notif.action && (
                      <button
                        onClick={e => { e.stopPropagation(); onAction(notif); }}
                        style={{
                          fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
                          color: c.color, background: `${c.color}18`,
                          border: `1px solid ${c.color}38`,
                          borderRadius: 8, padding: "7px 14px",
                          cursor: "pointer", transition: "all 0.15s",
                        }}
                      >
                        {notif.action.label} →
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
