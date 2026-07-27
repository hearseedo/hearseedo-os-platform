import { useState } from "react";
import { TOKENS } from "../../constants/tokens";
import { WORLDS } from "../../constants/worlds";
import { ACHIEVEMENTS } from "../../components/Achievements";
import { useSubscription } from "../../hooks/useSubscription";
import { getWorldAccess } from "../home/worldAccess";
import { getTodaysRecommendation } from "../home/recommendation";

const ARTIFACTS = [
  "golden-key", "crystal", "compass", "lantern", "star",
  "blueprint-piece", "galaxy-fragment", "medal", "ancient-coin", "light-orb",
];

// Rebuild prompt section 10 — Living Blueprint / Progress. The animated
// constellation SVG (found unused in the visuals folder — see the "Place
// remaining artwork" commit) is illustrative, not a literal data plot: real
// numbers are shown alongside it, not invented to match the art. Honors
// prefers-reduced-motion via the SVG's own built-in media query.
export default function LivingBlueprint({ user }) {
  const subscription = useSubscription();
  const [worldFilter, setWorldFilter] = useState(null);
  const earned = ACHIEVEMENTS.filter(a => a.check(user ?? {}));
  const unlockedArtifactCount = Math.round((earned.length / ACHIEVEMENTS.length) * ARTIFACTS.length);

  const filteredWorld = worldFilter ? WORLDS.find(w => w.id === worldFilter) : null;
  const recommendation = filteredWorld ? getTodaysRecommendation(user || {}) : null;

  return (
    <div>
      <div style={{ marginBottom: TOKENS.space[5] }}>
        <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 4 }}>YOUR LIVING BLUEPRINT</div>
        <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800 }}>Growth, visible over time</h1>
      </div>

      <div style={{
        position: "relative", borderRadius: TOKENS.radius.xl, overflow: "hidden",
        border: `1px solid ${TOKENS.color.border}`, marginBottom: TOKENS.space[5],
        background: `url('/assets/constellation/ambient-field.svg') center/cover, ${TOKENS.color.bg}`,
      }}>
        <img
          src="/assets/constellation/growing-constellation-animated.svg"
          alt="Your growing constellation — an illustrative visualization of Family, Learning, Goal, and Achievement growth"
          style={{ width: "100%", display: "block", maxHeight: 420, objectFit: "contain" }}
        />
      </div>

      <div style={{ display: "flex", gap: TOKENS.space[3], marginBottom: TOKENS.space[5], flexWrap: "wrap" }}>
        <StatTile label="Family" value={user?.familyMembers?.length ?? 0} />
        <StatTile label="Lessons Completed" value={user?.lessonsCompleted ?? 0} />
        <StatTile label="Confidence" value={`${user?.confidenceScore ?? 0}%`} />
        <StatTile label="Achievements" value={`${earned.length} / ${ACHIEVEMENTS.length}`} />
      </div>

      <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 10 }}>FILTER BY WORLD</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: TOKENS.space[5] }}>
        <FilterChip label="All" active={!worldFilter} onClick={() => setWorldFilter(null)} />
        {WORLDS.map(w => {
          const access = getWorldAccess(w, user, subscription);
          return (
            <FilterChip
              key={w.id}
              label={w.name}
              active={worldFilter === w.id}
              locked={access.status === "locked"}
              onClick={() => setWorldFilter(w.id)}
            />
          );
        })}
      </div>

      {filteredWorld && recommendation && (
        <div style={{
          padding: TOKENS.space[4], borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.color.border}`,
          background: TOKENS.color.surfaceRaised, marginBottom: TOKENS.space[5],
        }}>
          <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 6 }}>{filteredWorld.name.toUpperCase()}</div>
          <div style={{ fontSize: TOKENS.font.size.sm }}>{recommendation.lesson}</div>
        </div>
      )}

      <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 10 }}>
        ARTIFACT GALLERY · {unlockedArtifactCount} / {ARTIFACTS.length} unlocked
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {ARTIFACTS.map((name, i) => {
          const unlocked = i < unlockedArtifactCount;
          return (
            <img
              key={name}
              src={`/assets/achievements/${name}.jpg`}
              alt={unlocked ? name : "locked artifact"}
              title={unlocked ? name.replace(/-/g, " ") : "Keep growing to unlock"}
              style={{
                width: 64, height: 64, borderRadius: TOKENS.radius.md, objectFit: "cover",
                border: `1px solid ${TOKENS.color.border}`,
                filter: unlocked ? "none" : "grayscale(1) brightness(0.4)",
              }}
            />
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: TOKENS.color.textDim, marginTop: 8 }}>
        Artifacts unlock proportionally to overall achievement progress — not tied to specific milestones yet.
      </div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div style={{ flex: 1, minWidth: 130, padding: TOKENS.space[4], borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.color.border}`, background: TOKENS.color.surfaceRaised }}>
      <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: TOKENS.font.size.xl, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function FilterChip({ label, active, locked, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontSize: TOKENS.font.size.xs, padding: "6px 14px", borderRadius: TOKENS.radius.pill, cursor: "pointer",
      border: `1px solid ${active ? TOKENS.color.gold : TOKENS.color.border}`,
      background: active ? "rgba(201,168,76,0.1)" : "transparent",
      color: active ? TOKENS.color.gold : (locked ? TOKENS.color.textDim : TOKENS.color.textMuted),
    }}>
      {label}{locked ? " · locked" : ""}
    </button>
  );
}
