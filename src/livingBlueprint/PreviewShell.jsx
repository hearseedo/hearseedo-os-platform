import { TOKENS } from "../constants/tokens";
import { WORLDS } from "../constants/worlds";
import { useAuth } from "../hooks/useAuth";
import AppShell from "./components/AppShell";
import WorldCard from "./components/WorldCard";

// Phase 1 foundation preview — NOT linked from production nav.
// Reachable only behind the living-blueprint feature flag at /preview/shell.
// Purpose: prove out tokens + World registry + AppShell together before
// Phase 2 (onboarding) and Phase 3 (Home) build on top of them.
export default function PreviewShell() {
  const { user } = useAuth();

  return (
    <AppShell active="worlds">
      <div style={{ marginBottom: TOKENS.space[6] }}>
        <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 4 }}>
          LIVING BLUEPRINT · PHASE 1 PREVIEW
        </div>
        <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800 }}>
          Hi{user?.name ? `, ${user.name}` : ""} — Explore Your Worlds
        </h1>
        <p style={{ color: TOKENS.color.textMuted, marginTop: 4 }}>
          This is a foundation-phase preview: design tokens, World registry, and AppShell only.
          Not wired to real progress data yet.
        </p>
      </div>

      <div style={{
        display: "grid", gap: TOKENS.space[4],
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      }}>
        {WORLDS.map(world => (
          <WorldCard key={world.id} world={world} status="explore" />
        ))}
      </div>
    </AppShell>
  );
}
