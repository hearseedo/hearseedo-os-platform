import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TOKENS } from "../../constants/tokens";
import ResponsiveNavigation from "./ResponsiveNavigation";
import { useMobile } from "../../hooks/useMobile";

// Nav-id → preview route. Bug found while building Phase 6: no preview page
// was ever passing `onNavigate`, so the sidebar/bottom nav only highlighted
// itself and never actually navigated, since Phase 1. Fixed centrally here
// instead of wiring every page individually.
const DEFAULT_ROUTES = {
  home: "/preview/home", worlds: "/preview/shell", progress: "/preview/progress",
  coach: "/preview/coach", family: "/preview/home", messages: "/preview/messages",
  more: "/preview/more", history: "/preview/progress",
};

// Rebuild prompt section 4: one application shell with role-aware content.
// This mounts navigation + a max-width content column on a near-black
// background. It does not render page content itself — pass children.
export default function AppShell({ active = "home", onNavigate, showFamily = true, children }) {
  const isMobile = useMobile();
  const navigateTo = useNavigate();
  const [navActive, setNavActive] = useState(active);

  const handleNavigate = (id) => {
    setNavActive(id);
    if (onNavigate) onNavigate(id);
    else if (DEFAULT_ROUTES[id]) navigateTo(DEFAULT_ROUTES[id]);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: TOKENS.color.bg, color: TOKENS.color.starlight,
      fontFamily: TOKENS.font.family,
    }}>
      {!isMobile && (
        <ResponsiveNavigation active={navActive} onNavigate={handleNavigate} showFamily={showFamily} />
      )}
      <main style={{
        flex: 1, minWidth: 0,
        padding: isMobile ? `${TOKENS.space[4]}px ${TOKENS.space[3]}px 96px` : `${TOKENS.space[6]}px ${TOKENS.space[6]}px`,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {children}
        </div>
      </main>
      {isMobile && (
        <ResponsiveNavigation active={navActive} onNavigate={handleNavigate} showFamily={showFamily} />
      )}
    </div>
  );
}
