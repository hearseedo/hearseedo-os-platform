import { TOKENS } from "../constants/tokens";
import { WORLDS } from "../constants/worlds";
import { ALL_EXPERIENCES } from "../constants/experiences";
import { CATEGORY_ORDER, groupByCategory } from "../constants/worldCategories";
import { useAuth } from "../hooks/useAuth";
import { useSubscription } from "../hooks/useSubscription";
import AppShell from "./components/AppShell";
import WorldCard from "./components/WorldCard";
import { getWorldAccess } from "./home/worldAccess";

// Phase 4 — Explore Your Worlds. Originally split into "six curated Worlds"
// + a flat "More Experiences" grid; reorganized into simple audience
// categories (Kids / Teens & University / Adults / Family) per explicit
// request — easier to scan, and the curated/catalog distinction was an
// implementation detail, not something a user needs to know about.
export default function PreviewShell() {
  const { user } = useAuth();
  const subscription = useSubscription();

  const grouped = groupByCategory([...WORLDS, ...ALL_EXPERIENCES]);

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

      {CATEGORY_ORDER.map(category => {
        const items = grouped[category];
        if (!items?.length) return null;
        return (
          <div key={category} style={{ marginBottom: TOKENS.space[6] }}>
            <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: TOKENS.space[3] }}>
              {category.toUpperCase()}
            </div>
            <div style={{
              display: "grid", gap: TOKENS.space[4],
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            }}>
              {items.map(item => {
                const access = getWorldAccess(item, user, subscription);
                return (
                  <WorldCard
                    key={item.id}
                    world={item}
                    status={access.status === "locked" ? "locked" : "explore"}
                    reason={access.reason}
                    unlockPath={access.unlockPath}
                    unlockLabel={access.unlockLabel}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </AppShell>
  );
}
