import { useNavigate } from "react-router-dom";
import { TOKENS } from "../../constants/tokens";
import { worldHref } from "../../constants/worlds";
import { useLang } from "../../hooks/useLang";

// Rebuild prompt section 6 — Today's Mission hero, the largest card on the
// Individual Home. Uses the recommended World's hero art (or the World
// registry's art-gap placeholder when missing, e.g. Speak Ready).
export default function MissionHero({ world, missionName, timeEstimate = "~10 min" }) {
  const navigate = useNavigate();
  const { t } = useLang();

  return (
    <div style={{
      position: "relative", borderRadius: TOKENS.radius.xl, overflow: "hidden", minHeight: 260,
      border: `1px solid ${TOKENS.color.border}`, boxShadow: TOKENS.shadow.soft,
      display: "flex", alignItems: "flex-end", marginBottom: TOKENS.space[5],
    }}>
      {world.artStatus === "missing" ? (
        <div style={{ position: "absolute", inset: 0, background: TOKENS.color.surfaceRaised }} />
      ) : (
        <img src={world.art.hero} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(5,6,8,0.92) 0%, rgba(5,6,8,0.45) 55%, rgba(5,6,8,0.1) 100%)" }} />

      <div style={{ position: "relative", padding: TOKENS.space[5], width: "100%" }}>
        <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 6 }}>{t("lb_todays_mission").toUpperCase()}</div>
        <div style={{ fontSize: TOKENS.font.size.sm, color: TOKENS.color.textMuted, marginBottom: 4 }}>{world.name}</div>
        <h2 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800, marginBottom: 14, maxWidth: 480, lineHeight: 1.2 }}>
          {missionName}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => navigate(worldHref(world))}
            style={{
              padding: "12px 28px", borderRadius: TOKENS.radius.pill, border: "none",
              background: TOKENS.color.gold, color: "#0a0a0a", fontWeight: 800, cursor: "pointer",
            }}
          >
            {t("lb_begin")}
          </button>
          <span style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted }}>{timeEstimate}</span>
        </div>
      </div>
    </div>
  );
}
