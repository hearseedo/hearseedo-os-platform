import { getBadgeConfig } from "../lib/founding";

// size: "sm" (40px) | "md" (80px) | "lg" (140px)
export default function FoundingBadge({ badgeId, memberNumber, size = "md", showLabel = false }) {
  const config = getBadgeConfig(badgeId);
  if (!config) return null;

  const dim = size === "sm" ? 40 : size === "lg" ? 140 : 80;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{
        width: dim, height: dim, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
        boxShadow: `0 0 ${dim * 0.2}px ${config.glow}, 0 0 ${dim * 0.08}px ${config.glow}`,
      }}>
        <img
          src={config.image}
          alt={config.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={(e) => {
            e.target.style.display = "none";
            e.target.parentElement.style.background = "#111";
            e.target.parentElement.style.border = `2px solid ${config.color}`;
            e.target.parentElement.innerHTML =
              `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;` +
              `justify-content:center;font-family:sans-serif;padding:4px;box-sizing:border-box">` +
              `<div style="font-size:${dim * 0.16}px;font-weight:900;color:${config.color};text-align:center;letter-spacing:1px">${config.name.split(" ")[0]}</div>` +
              `<div style="font-size:${dim * 0.12}px;color:${config.color}80;text-align:center">${config.subtitle}</div>` +
              `</div>`;
          }}
        />
      </div>

      {showLabel && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: size === "sm" ? 9 : 11, fontWeight: 700, color: config.color, letterSpacing: 0.5 }}>
            {config.name}
          </div>
          {memberNumber && (
            <div style={{ fontSize: size === "sm" ? 8 : 10, color: "#666", marginTop: 1 }}>
              #{String(memberNumber).padStart(3, "0")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
