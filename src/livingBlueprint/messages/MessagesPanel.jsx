import { useNavigate } from "react-router-dom";
import { TOKENS } from "../../constants/tokens";
import { useLang } from "../../hooks/useLang";
import { useNotifications } from "./useNotifications";

// Rebuild prompt section 4 — Messages / AI Inbox. Reads the real
// users/{uid}/notifications data (same collection the live Dashboard's
// JonaInbox writes to and reads from) but with Living Blueprint's own
// presentation — the legacy JonaInbox component was reused verbatim at
// first, which is why it still showed the old raw jona.png and red brand
// color instead of the gold/navy palette and cropped Jona avatar used
// everywhere else in this rebuild.
const CAT_KEYS = {
  streak:  { labelKey: "lb_streak",             color: TOKENS.color.gold },
  mission: { labelKey: "lb_mission_label",      color: TOKENS.color.success },
  weekly:  { labelKey: "lb_weekly_label",       color: TOKENS.color.gold },
  return:  { labelKey: "lb_welcome_back_label", color: TOKENS.worldAccent["career-ready"] },
  feature: { labelKey: "lb_new_label",          color: TOKENS.worldAccent["eiken"] },
  message: { labelKey: "lb_message_label",      color: TOKENS.worldAccent["speak-ready"] },
};

function cat(category) {
  return CAT_KEYS[category] ?? CAT_KEYS.message;
}

function timeAgo(iso, t) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return t("lb_just_now");
  if (mins < 60) return t("lb_minutes_ago").replace("{n}", mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return t("lb_hours_ago").replace("{n}", hrs);
  const days = Math.floor(hrs / 24);
  if (days < 7)  return t("lb_days_ago").replace("{n}", days);
  return t("lb_weeks_ago").replace("{n}", Math.floor(days / 7));
}

export default function MessagesPanel({ user }) {
  const navigate = useNavigate();
  const { t } = useLang();
  const { notifications, dismiss, dismissAll } = useNotifications(user?.uid);

  if (!user) {
    return <div style={{ color: TOKENS.color.textMuted }}>{t("lb_sign_in_messages")}</div>;
  }

  const unread = notifications.filter(n => !n.read).length;

  function handleAction(notif) {
    const action = notif.action;
    if (action?.type === "navigate" && action.to) navigate(action.to);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: TOKENS.space[5] }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%", overflow: "hidden", position: "relative", flexShrink: 0,
          border: `2px solid ${TOKENS.color.goldDim}`, boxShadow: TOKENS.shadow.glow,
        }}>
          <img src="/assets/jona/pose-waving.png" alt="Jona" style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", width: 66, height: "auto" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 2 }}>MESSAGES</div>
          <div style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
            {t("lb_your_inbox")}
            {unread > 0 && (
              <span style={{ fontSize: TOKENS.font.size.xs, fontWeight: 800, color: "#0a0a0a", background: TOKENS.color.gold, borderRadius: TOKENS.radius.pill, padding: "2px 10px" }}>
                {unread}
              </span>
            )}
          </div>
        </div>
        {unread > 0 && (
          <button onClick={dismissAll} style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted, background: "none", border: `1px solid ${TOKENS.color.border}`, borderRadius: TOKENS.radius.pill, padding: "8px 16px", cursor: "pointer" }}>
            {t("lb_mark_all_read")}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center", borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.color.border}`, background: TOKENS.color.surfaceRaised }}>
          <div style={{ fontWeight: 700, fontSize: TOKENS.font.size.lg, marginBottom: 6 }}>{t("lb_all_caught_up")}</div>
          <div style={{ color: TOKENS.color.textMuted, fontSize: TOKENS.font.size.sm }}>
            {t("lb_inbox_empty_desc")}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifications.map(notif => {
            const c = cat(notif.category);
            return (
              <div
                key={notif.id}
                onClick={() => !notif.read && dismiss(notif.id)}
                style={{
                  display: "flex", gap: 12, padding: TOKENS.space[4],
                  borderRadius: TOKENS.radius.lg,
                  border: `1px solid ${notif.read ? TOKENS.color.border : TOKENS.color.goldDim}`,
                  background: notif.read ? "transparent" : TOKENS.color.surfaceRaised,
                  cursor: notif.read ? "default" : "pointer",
                }}
              >
                <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: notif.read ? TOKENS.color.border : c.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: c.color,
                      background: `${c.color}18`, border: `1px solid ${c.color}38`,
                      borderRadius: TOKENS.radius.sm, padding: "2px 8px",
                    }}>
                      {t(c.labelKey)}
                    </span>
                    <span style={{ fontSize: 11, color: TOKENS.color.textDim, marginLeft: "auto" }}>{timeAgo(notif.createdAt, t)}</span>
                    {!notif.read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: TOKENS.color.gold, flexShrink: 0 }} />}
                  </div>
                  {notif.title && (
                    <div style={{ fontWeight: 700, fontSize: TOKENS.font.size.sm, color: notif.read ? TOKENS.color.textMuted : TOKENS.color.starlight, marginBottom: 4 }}>
                      {notif.title}
                    </div>
                  )}
                  <div style={{ fontSize: TOKENS.font.size.sm, color: TOKENS.color.textMuted, lineHeight: 1.6, marginBottom: notif.action ? 10 : 0 }}>
                    {notif.message}
                  </div>
                  {notif.action && (
                    <button
                      onClick={e => { e.stopPropagation(); handleAction(notif); }}
                      style={{
                        fontSize: TOKENS.font.size.xs, fontWeight: 700, color: c.color,
                        background: `${c.color}18`, border: `1px solid ${c.color}38`,
                        borderRadius: TOKENS.radius.md, padding: "7px 14px", cursor: "pointer",
                      }}
                    >
                      {notif.action.label} →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
