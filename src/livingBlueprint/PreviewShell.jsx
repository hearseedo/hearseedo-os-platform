import { TOKENS } from "../constants/tokens";
import { WORLDS } from "../constants/worlds";
import { useAuth } from "../hooks/useAuth";
import AppShell from "./components/AppShell";
import WorldCard from "./components/WorldCard";
import { getWorldAccess } from "./home/worldAccess";

// Phase 4 — Explore Your Worlds. Started in Phase 1 as a static grid; now
// reads real per-World access from worldAccess.js (constants/appRegistry.js
// subscriptionRequirements vs the signed-in user's real subscriptions).
export default function PreviewShell() {
  const { user } = useAuth();

  return (
    <AppShell active="worlds">
      <div style={{ marginBottom: TOKENS.space[6] }}>
        <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 4 }}>
          LIVING BLUEPRINT · PREVIEW
        </div>
        <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800 }}>
          Hi{user?.name ? `, ${user.name}` : ""} — Explore Your Worlds
        </h1>
        <p style={{ color: TOKENS.color.textMuted, marginTop: 4 }}>
          Access reflects your real plan. Progress bars aren't wired to real data yet.
        </p>
      </div>

      <div style={{
        display: "grid", gap: TOKENS.space[4],
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      }}>
        {WORLDS.map(world => {
          const access = getWorldAccess(world, user);
          return (
            <WorldCard
              key={world.id}
              world={world}
              status={access.status === "locked" ? "locked" : "explore"}
              reason={access.reason}
              unlockPath={access.unlockPath}
              unlockLabel={access.unlockLabel}
            />
          );
        })}
      </div>
    </AppShell>
  );
}
