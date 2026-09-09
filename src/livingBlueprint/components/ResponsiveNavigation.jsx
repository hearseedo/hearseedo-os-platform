import { TOKENS } from "../../constants/tokens";
import { useMobile } from "../../hooks/useMobile";
import { useLang } from "../../hooks/useLang";

// Rebuild prompt section 4: restrained left rail (desktop) / persistent
// bottom nav (mobile). Destinations are fixed per spec, not data-driven —
// this is intentionally a thin nav, not a generic menu renderer.

const DESKTOP_ITEMS = [
  { id: "home",     labelKey: "lb_nav_home",   icon: "◆" },
  { id: "worlds",   labelKey: "lb_nav_worlds", icon: "✦" },
  { id: "progress", labelKey: "lb_nav_progress", icon: "◈" },
  { id: "coach",    labelKey: "lb_nav_coach",  icon: "●" },
  { id: "family",   labelKey: "lb_nav_family", icon: "◇" },
  { id: "messages", labelKey: "lb_nav_messages", icon: "▣" },
  { id: "more",     labelKey: "lb_nav_more",   icon: "…" },
];

const MOBILE_ITEMS = [
  { id: "home",     labelKey: "lb_nav_home",   icon: "◆" },
  { id: "progress", labelKey: "lb_nav_progress", icon: "◈" },
  { id: "coach",    labelKey: "lb_nav_coach_short", icon: "●" },
  { id: "history",  labelKey: "lb_nav_history", icon: "▤" },
  { id: "more",     labelKey: "lb_nav_more",   icon: "…" },
];

export default function ResponsiveNavigation({ active, onNavigate, showFamily = true }) {
  const isMobile = useMobile();
  const { t } = useLang();

  if (isMobile) {
    return (
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
        display: "flex", justifyContent: "space-around",
        padding: "10px 4px calc(10px + env(safe-area-inset-bottom))",
        background: TOKENS.color.surface,
        borderTop: `1px solid ${TOKENS.color.border}`,
        backdropFilter: "blur(12px)",
      }}>
        {MOBILE_ITEMS.map(item => (
          <NavButton key={item.id} item={item} label={t(item.labelKey)} active={active === item.id} onClick={() => onNavigate(item.id)} mobile />
        ))}
      </nav>
    );
  }

  const items = DESKTOP_ITEMS.filter(item => item.id !== "family" || showFamily);

  return (
    <nav style={{
      position: "sticky", top: 0, height: "100vh", flexShrink: 0,
      width: 220, padding: `${TOKENS.space[6]}px ${TOKENS.space[4]}px`,
      background: TOKENS.color.surface,
      borderRight: `1px solid ${TOKENS.color.border}`,
      display: "flex", flexDirection: "column", gap: TOKENS.space[2],
    }}>
      {items.map(item => (
        <NavButton key={item.id} item={item} label={t(item.labelKey)} active={active === item.id} onClick={() => onNavigate(item.id)} />
      ))}
    </nav>
  );
}

function NavButton({ item, label, active, onClick, mobile }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      style={{
        display: "flex", alignItems: "center",
        flexDirection: mobile ? "column" : "row",
        gap: mobile ? 2 : TOKENS.space[3],
        padding: mobile ? "4px 10px" : "10px 12px",
        borderRadius: TOKENS.radius.md,
        border: "none",
        background: active ? "rgba(201,168,76,0.1)" : "transparent",
        color: active ? TOKENS.color.gold : TOKENS.color.textMuted,
        fontSize: mobile ? 10 : TOKENS.font.size.sm,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        transition: `background ${TOKENS.motion.fast} ${TOKENS.motion.easing}, color ${TOKENS.motion.fast} ${TOKENS.motion.easing}`,
      }}
    >
      <span style={{ fontSize: mobile ? 16 : 14, lineHeight: 1 }}>{item.icon}</span>
      <span>{label}</span>
    </button>
  );
}
