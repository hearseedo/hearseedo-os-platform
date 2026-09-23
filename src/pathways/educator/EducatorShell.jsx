// HSD Educators — shell (/educator/*). Home | Plan | Teach | Students |
// Resources | Jona, per the 2026-09-23 brief's requested nav structure.
// Jona stays one tab away from anywhere in the pathway, not a floating
// widget bolted onto the corner.
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { EDU_COLORS } from "./theme";

const TABS = [
  { path: "/educator/home", label: "Home" },
  { path: "/educator/plan", label: "Plan" },
  { path: "/educator/teach", label: "Teach" },
  { path: "/educator/students", label: "Students" },
  { path: "/educator/resources", label: "Resources" },
  { path: "/educator/jona", label: "Jona" },
];

export default function EducatorShell() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", color: EDU_COLORS.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", position: "relative" }}>
      {/* Full-viewport hero photo (2026-09-23) — same fixed-backdrop
          pattern as Family/Student/Adult, cream gradient overlay to match
          the Educator pathway's light theme. */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 0,
          backgroundImage: `linear-gradient(180deg, rgba(246,247,246,0.75), ${EDU_COLORS.bg} 80%), url('/assets/hsd/pathways/educator-hero.webp')`,
          backgroundSize: "cover", backgroundPosition: "center",
        }}
      />
      <header style={{ position: "relative", zIndex: 1, background: EDU_COLORS.card, borderBottom: `1px solid ${EDU_COLORS.border}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/choose-path")} style={{ background: "none", border: "none", color: EDU_COLORS.textMuted, fontSize: 13, cursor: "pointer" }}>
            ← Switch pathway
          </button>
          <span style={{ color: EDU_COLORS.border }}>|</span>
          <span style={{ fontWeight: 900, fontSize: 16, color: EDU_COLORS.primary }}>HSD Educators</span>
        </div>
        <nav style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {TABS.map((tab) => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                style={{
                  padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: active ? EDU_COLORS.primarySoft : "transparent",
                  color: active ? EDU_COLORS.primary : EDU_COLORS.textMuted,
                  fontWeight: active ? 800 : 600, fontSize: 14,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main style={{ position: "relative", zIndex: 1, maxWidth: 1040, margin: "0 auto", padding: "32px 24px 80px" }}>
        <Outlet />
      </main>
    </div>
  );
}
