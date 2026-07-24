import { useNavigate } from "react-router-dom";
import { TOKENS } from "../../constants/tokens";
import { worldHref } from "../../constants/worlds";

// Rebuild prompt section 8: World card — title, promise, approved art,
// access/progress state, Continue/Explore/Locked action.
// Rebuild prompt section 11: locked cards must explain themselves, not just
// show a padlock — `reason` and `unlockPath` come from worldAccess.js.
export default function WorldCard({ world, status = "explore", progress = null, reason, unlockPath, unlockLabel }) {
  const navigate = useNavigate();
  const locked = status === "locked";

  const handleClick = () => {
    if (locked) { if (unlockPath) navigate(unlockPath); return; }
    navigate(worldHref(world));
  };

  return (
    <div style={{
      position: "relative", borderRadius: TOKENS.radius.lg, overflow: "hidden",
      border: `1px solid ${TOKENS.color.border}`,
      background: TOKENS.color.surfaceRaised,
      boxShadow: TOKENS.shadow.soft,
      opacity: locked ? 0.75 : 1,
    }}>
      <div style={{
        position: "relative", aspectRatio: "5 / 3", background: TOKENS.color.surface,
        borderBottom: `2px solid ${world.accent}55`,
      }}>
        {world.artStatus === "missing" ? (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            color: TOKENS.color.textDim, fontSize: TOKENS.font.size.xs, letterSpacing: 1, textAlign: "center", padding: 12,
          }}>
            ART MISSING — placeholder
          </div>
        ) : (
          <img src={world.art.card} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: locked ? "grayscale(0.5)" : "none" }} />
        )}
        {locked && (
          <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.6)", borderRadius: TOKENS.radius.pill, padding: "4px 10px", fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted }}>
            Locked
          </div>
        )}
      </div>

      <div style={{ padding: TOKENS.space[4] }}>
        <div style={{ fontSize: TOKENS.font.size.lg, fontWeight: 700, marginBottom: 4 }}>{world.name}</div>
        <div style={{ fontSize: TOKENS.font.size.sm, color: TOKENS.color.textMuted, marginBottom: TOKENS.space[3], lineHeight: 1.5 }}>
          {world.promise}
        </div>

        {locked && reason && (
          <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.gold, marginBottom: TOKENS.space[3] }}>
            {reason}
          </div>
        )}

        {typeof progress === "number" && !locked && (
          <div style={{ height: 4, borderRadius: TOKENS.radius.pill, background: "rgba(255,255,255,0.08)", marginBottom: TOKENS.space[3], overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: TOKENS.color.gold, borderRadius: TOKENS.radius.pill }} />
          </div>
        )}

        <button onClick={handleClick} style={{
          width: "100%", padding: "10px 14px", borderRadius: TOKENS.radius.md, border: "none",
          fontWeight: 700, fontSize: TOKENS.font.size.sm, cursor: "pointer",
          background: locked ? "rgba(255,255,255,0.08)" : (status === "continue" ? TOKENS.color.gold : "rgba(255,255,255,0.08)"),
          color: locked ? TOKENS.color.starlight : (status === "continue" ? "#0a0a0a" : TOKENS.color.starlight),
        }}>
          {locked ? (unlockLabel || "See plans") : status === "continue" ? "Continue" : "Explore"}
        </button>
      </div>
    </div>
  );
}
