import { TOKENS } from "../constants/tokens";
import { WORLDS } from "../constants/worlds";
import { LEGACY_EXPERIENCES } from "../constants/experiences";
import { useAuth } from "../hooks/useAuth";
import { useSubscription } from "../hooks/useSubscription";
import AppShell from "./components/AppShell";
import WorldCard from "./components/WorldCard";
import { getWorldAccess } from "./home/worldAccess";

// Phase 4 — Explore Your Worlds. Started in Phase 1 as a static grid; now
// reads real per-World access via useSubscription().isUnlocked (same check
// the live Dashboard/AppModal use — includes admin, access pass, HSD
// Family-always-free, and workbook-bonus special cases).
export default function PreviewShell() {
  const { user } = useAuth();
  const subscription = useSubscription();

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
          const access = getWorldAccess(world, user, subscription);
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

      <div style={{ marginTop: TOKENS.space[6], marginBottom: TOKENS.space[4] }}>
        <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 4 }}>
          MORE EXPERIENCES
        </div>
        <p style={{ color: TOKENS.color.textMuted, fontSize: TOKENS.font.size.sm }}>
          Existing HSDOS apps not yet part of the six curated Worlds — nothing here has been removed or merged.
        </p>
      </div>
      <div style={{
        display: "grid", gap: TOKENS.space[4],
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      }}>
        {LEGACY_EXPERIENCES.map(exp => {
          const access = getWorldAccess(exp, user, subscription);
          return (
            <WorldCard
              key={exp.id}
              world={exp}
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
