import { useState } from "react";
import { TOKENS } from "../../constants/tokens";
import { WORLDS } from "../../constants/worlds";
import { ACHIEVEMENTS } from "../../components/Achievements";
import { useSubscription } from "../../hooks/useSubscription";
import { useLang } from "../../hooks/useLang";
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
  const { t } = useLang();
  const [worldFilter, setWorldFilter] = useState(null);
  const earned = ACHIEVEMENTS.filter(a => a.check(user ?? {}));
  const unlockedArtifactCount = Math.round((earned.length / ACHIEVEMENTS.length) * ARTIFACTS.length);

  const filteredWorld = worldFilter ? WORLDS.find(w => w.id === worldFilter) : null;
  const recommendation = filteredWorld ? getTodaysRecommendation(user || {}) : null;

  return (
    <div>
      <div style={{ marginBottom: TOKENS.space[5] }}>
        <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 4 }}>{t("lb_your_blueprint_label")}</div>
        <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800 }}>{t("lb_growth_visible")}</h1>
      </div>

      <div style={{
        position: "relative", borderRadius: TOKENS.radius.xl, overflow: "hidden",
        border: `1px solid ${TOKENS.color.border}`, marginBottom: TOKENS.space[5],
        background: TOKENS.color.bg,
      }}>
        {/* Static image, not the animated SVG — its CSS keyframes (elements
            start at opacity:0, animate in via "forwards") don't reliably run
            when loaded through an <img> tag, leaving the illustration blank. */}
        <img
          src="/assets/progress/growing-constellation-wide.jpg"
          alt="Your growing constellation — an illustrative visualization of growth, not a literal data plot"
          style={{ width: "100%", display: "block", maxHeight: 420, objectFit: "cover" }}
        />
      </div>

      <div style={{ display: "flex", gap: TOKENS.space[3], marginBottom: TOKENS.space[5], flexWrap: "wrap" }}>
        <StatTile label={t("lb_family_label")} value={user?.familyMembers?.length ?? 0} />
        <StatTile label={t("lb_lessons_completed")} value={user?.lessonsCompleted ?? 0} />
        <StatTile label={t("lb_confidence_metric")} value={`${user?.confidenceScore ?? 0}%`} />
        <StatTile label={t("lb_achievements_label")} value={`${earned.length} / ${ACHIEVEMENTS.length}`} />
      </div>

      <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 10 }}>{t("lb_filter_by_world")}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: TOKENS.space[5] }}>
        <FilterChip label={t("lb_all_filter")} active={!worldFilter} onClick={() => setWorldFilter(null)} />
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
        {t("lb_artifact_gallery").replace("{n}", unlockedArtifactCount).replace("{total}", ARTIFACTS.length)}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {ARTIFACTS.map((name, i) => {
          const unlocked = i < unlockedArtifactCount;
          return (
            <img
              key={name}
              src={`/assets/achievements/${name}.jpg`}
              alt={unlocked ? name : "locked artifact"}
              title={unlocked ? name.replace(/-/g, " ") : t("lb_keep_growing")}
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
        {t("lb_artifacts_note")}
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
  const { t } = useLang();
  return (
    <button onClick={onClick} style={{
      fontSize: TOKENS.font.size.xs, padding: "6px 14px", borderRadius: TOKENS.radius.pill, cursor: "pointer",
      border: `1px solid ${active ? TOKENS.color.gold : TOKENS.color.border}`,
      background: active ? "rgba(201,168,76,0.1)" : "transparent",
      color: active ? TOKENS.color.gold : (locked ? TOKENS.color.textDim : TOKENS.color.textMuted),
    }}>
      {label}{locked ? ` · ${t("locked")}` : ""}
    </button>
  );
}
